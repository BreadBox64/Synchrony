import "./jsdoc.js"
import { delay } from './UtilsRenderer.mjs'
import { createModpackElement, updateElementDetails, updateElementTheme } from "./modpackElement.mjs"
import { themes, nextMapThemeColor, nextMapThemeBrightness, symbolMapThemeBrightness } from "./theme.mjs"

console.log(`\x1b[1;34mRENDERER\x1b[0m`)
const electronAPI = window.electronAPI
const root = document.querySelector(':root')
const modpackList = document.getElementById('modpackList')
const modpackAdd = document.getElementById('modpackAdd')
const promptBackground = document.getElementById('promptBackground')
const addButtons = {
	/** @type {!Element} */
	existing: modpackAdd.children.item(0),
	/** @type {!Element} */
	file: modpackAdd.children.item(1),
	/** @type {!Element} */
	url: modpackAdd.children.item(2)
}
const themeSwitch = document.getElementById('themeSwitch')
const colorSwitch = document.getElementById('colorSwitch')
let currentThemeBrightness = 'system'
let currentThemeColor = 'purple'
let usingDarkMode = true

const pressedKeys = {};
window.onkeyup = (e) => { pressedKeys[e.keyCode] = false; }
window.onkeydown = (e) => { pressedKeys[e.keyCode] = true; }

const transitionEnd = (() => {
	let t;
	const el = document.createElement('fakeelement');
	const transitions = {
		'transition': 'transitionend',
		'OTransition': 'oTransitionEnd',
		'MozTransition': 'transitionend',
		'WebkitTransition': 'webkitTransitionEnd'
	}

	for (t in transitions) {
		if (el.style[t] !== undefined) {
			return transitions[t];
		}
	}
})()

/** @type {Object.<string, packConfig>} */
let configs = {}
/** @type {Object.<string, dom>} */
let dom = {}
/** @type {Object.<string, string>} */
let states = {}
/** @type {Object.<string, displayConfig>} */
let displayConfigs = {}

/* #region  Helpers */
/**
 * 
 * @async
 * @param {string} modpackId 
 * @param {boolean} pret Fade out previous symbol
 * @param {boolean} postt Fade in new symbol
*/
async function setSymbolByState(modpackId, pret, postt) {
	const { symbol, loading } = dom[modpackId]
	if (pret) {
		symbol.style.opacity = 0
		await delay(600)
	}
	symbol.className = "loadingElement-symbol material-symbols-outlined size-80 wght-7 "
	switch (states[modpackId]) {
		case 'syncing':
			symbol.className = "loadingElement-symbol material-symbols-outlined size-80 wght-7 spin"
			symbol.innerText = "sync"
			loading.title = ""
			break
		case 'postsync':
		case 'presync':
			symbol.innerText = "sync"
			loading.title = "Click to check for updates."
			break
		case 'downloading':
			symbol.className = "loadingElement-symbol material-symbols-outlined size-80 wght-7 pulse"
			symbol.innerText = "downloading"
			loading.title = ""
			break
		case 'predownload':
			symbol.innerText = "download"
			loading.title = "Click to download update."
			break
		case 'postdownload':
			symbol.innerText = "download_done"
			loading.title = "Click to re-check for updates."
			break
		case 'failedsync':
			symbol.innerText = "sync_problem"
			loading.title = "Click to re-check for updates."
			break
		case 'faileddownload':
			symbol.innerText = "error"
			loading.title = "Click to re-try update, Shift+Click to re-check for updates."
			break
		default:
			symbol.innerText = 'report'
			loading.title = "There was an internal error, please report this immediately on GitHub."
	}
	symbol.style.opacity = 1
	if (postt) {
		await delay(600)
	}
}

/**
 * 
 * @param {string} modpackId 
 * @returns {Function} Symbol click handler
*/
function symbolClickHandlerFactory(modpackId) {
	return () => {
		console.log(`state: ${states[modpackId]}, modpackId: ${modpackId}`)
		switch (states[modpackId]) {
			case 'postdownload':
			case 'failedsync':
				updateElementDetails(dom[modpackId], null, "Checking Online for Updates...")
				states[modpackId] = 'syncing'
				setSymbolByState(modpackId, true, true)
				electronAPI.checkForUpdate(modpackId)
				break;
			case 'postsync':
			case 'presync':
				updateElementDetails(dom[modpackId], null, "Checking Online for Updates...")
				states[modpackId] = 'syncing'
				setSymbolByState(modpackId, false, true)
				electronAPI.checkForUpdate(modpackId)
				break;
			case 'faileddownload':
				if (pressedKeys[16]) { // resync
					updateElementDetails(dom[modpackId], null, "Checking Online for Updates...")
					states[modpackId] = 'syncing'
					setSymbolByState(modpackId, true, true)
					electronAPI.checkForUpdate(modpackId)
				} else { // download
					updateElementDetails(dom[modpackId], null, "Downloading Updates...")
					electronAPI.startProcess(modpackId)
					states[modpackId] = 'downloading'
					setSymbolByState(modpackId, true, false)
				}
				break;
			case 'predownload':
				electronAPI.startProcess(modpackId)
				updateElementDetails(dom[modpackId], null, "Downloading Updates...")
				states[modpackId] = 'downloading'
				setSymbolByState(modpackId, true, false)
				break
		}
	}
}

/**
 * 
 * @param {string} modpackId 
 * @returns 
*/
function getModpackElements(modpackId) {
	//console.log(modpackId)
	const modpackContainer = document.getElementById(`modpack-${modpackId}`)
	//console.log(modpackContainer)
	/** @type {dom} */
	const elements = {
		container: modpackContainer,
		loading: modpackContainer.getElementsByClassName('loadingElement')[0],
		staticE: modpackContainer.getElementsByClassName('loadingElement-static')[0],
		inner: modpackContainer.getElementsByClassName('inner')[0],
		symbol: modpackContainer.getElementsByClassName('loadingElement-symbol')[0],
		svg: modpackContainer.getElementsByClassName('loadingElement-svg')[0],
		circle: modpackContainer.getElementsByClassName('loadingElement-circle')[0],
		title: modpackContainer.getElementsByClassName('content-title')[0],
		status: modpackContainer.getElementsByClassName('content-status')[0],
		details: modpackContainer.getElementsByClassName('details')[0]
	}

	return elements
}

/**
 * 
 * @param {string} modpackId 
 */
function clearLoadingProgress(modpackId) {
	const svg = dom[modpackId].svg
	svg.style.opacity = 0
	setSymbolByState(modpackId, true, true)
	svg.addEventListener(transitionEnd, async () => {
		await delay(600)
		root.style.setProperty(`--loadValue-${modpackId}`, '440px')
		await delay(1000)
		svg.style.opacity = 1
	}, { once: true })
}
/* #endregion */

/* #region  Themes */
function setTheme() {
	themeSwitch.innerText = symbolMapThemeBrightness[currentThemeBrightness]
	colorSwitch.style.color = (usingDarkMode) ? 'var(--terColor)' : 'var(--quatColor)'
	themes[currentThemeColor][usingDarkMode ? 'dark' : 'light']?.forEach(([v, c]) => {
		root.style.setProperty(v, c)
	})
	Object.keys(states).forEach(id => {
		updateElementTheme(id, root, displayConfigs[id], usingDarkMode)
	})
}

themeSwitch.addEventListener('click', async () => {
	currentThemeBrightness = nextMapThemeBrightness[currentThemeBrightness]
	usingDarkMode = await electronAPI.ThemeChange(currentThemeBrightness)
	setTheme()
})

colorSwitch.addEventListener('click', async () => {
	currentThemeColor = nextMapThemeColor[currentThemeColor]
	setTheme()
})

electronAPI.onNativeThemeChange((useDarkMode) => {
	if(currentThemeBrightness === 'system') {usingDarkMode = useDarkMode; setTheme()}
})

/* #endregion */

/* #region  Prompts */
/**
 * Displays prompt to user with given HTML as content. Returns user response according to dataShape
 * @param {Object<string, string>} dataShape 
 * @param {string} innerHTML 
 * @param {Function} validate Predicate to confirm data is valid before closing prompt
 */
async function displayUserPrompt(innerHTML, dataShape = {}, validate = (_) => {return true}, reset = () => {}, resetTime = 0) {
	return new Promise(async (resolve) => {
		promptBackground.innerHTML = innerHTML
		promptBackground.style.top = '124px'
		await delay(600)

		const submitButton = document.getElementById('promptSubmit')

		const closePrompt = () => {
			promptBackground.style.top = '100%'
		}
		const submit = async () => {
			reset()
			await delay(resetTime)
			const outData = Object.fromEntries(
				Object.entries(dataShape).map(([key, elementID]) => {
					/** @type {HTMLInputElement} */
					const element = document.getElementById(elementID)
					let data
					switch(element.type) {
						default:
							data = element.value
						break;
					}

					return [key, data]
				})
			)
			
			if(await validate(outData)) {
				reset()
				closePrompt()
				submitButton.removeEventListener('click', submit)
				resolve(outData)
			}
		}
		const confirm = async () => {
			closePrompt()
			resolve(true)
		}
		const cancel = async () => {
			closePrompt()
			resolve(false)
		}

		submitButton?.addEventListener('click', submit)
		document.getElementById('promptConfirm')?.addEventListener('click', confirm, {once: true})
		document.getElementById('promptCancel')?.addEventListener('click', cancel, {once: true})
	})
}

electronAPI.onDisplayPrompt(async (respond, promptOptions) => {
	respond(await displayUserPrompt(...promptOptions))
})
/* #endregion */

/* #region  Startup */
/**
 * 
 * @param {packConfig} modpackConfig 
 * @returns {displayConfig}
*/
function generateDisplayConfig(modpackConfig) {
	const gradientColors = modpackConfig.customGradient?.split(' ') ?? ['#db59ff', '#4980f7']
	const colorSet = modpackConfig.customColorSet?.split(' ') ?? ['#ebe6ff', '#dcd3ff', '#49445b', '#413d4f']

	return {
		gradient: gradientColors,
		colors: colorSet
	}
}
/**
 * 
 * @param {string} id 
 * @param {packConfig} packConfig 
 */
function addModpack(id, packConfig) {
	configs[id] = packConfig
	states[id] = 'presync'
	
	const container = document.createElement('div')
	modpackList.insertBefore(container, modpackAdd)
	
	root.style.setProperty(`--loadValue-${id}`, `440px`)
	const displayConfig = generateDisplayConfig(packConfig)
	root.style.setProperty(`--color0-${id}`, displayConfig.colors[0])
	root.style.setProperty(`--color1-${id}`, displayConfig.colors[1])
	container.outerHTML = createModpackElement(packConfig, displayConfig)
	
	const elements = getModpackElements(id)
	elements.loading.addEventListener('click', symbolClickHandlerFactory(id))
	elements.container.addEventListener('mouseover', () => {
		elements.container.style.backgroundColor = `var(--color1-${id})`
	})
	elements.container.addEventListener('mouseout', () => {
		elements.container.style.backgroundColor = `var(--color0-${id})`
	})
	elements.title.innerText = packConfig.name
	

	dom[id] = elements
	displayConfigs[id] = displayConfig
	setSymbolByState(id, false, false)
}

function setupModpackAdd() {
	addButtons.existing.addEventListener('click', async () => {
		const [status, data] = await electronAPI.AddPack('existing')
		if(status) addModpack(data.id, data)
	})
	addButtons.file.addEventListener('click', async () => {
		const [status, data] = await electronAPI.AddPack('file')
		if(status) addModpack(data.id, data)
	})
	addButtons.url.addEventListener('click', async () => {
		const addData = await displayUserPrompt(`
				<div class="vflex hcenter">
					<h1 class="josefin-sans hcenter">Add A Modpack</h1>
					<br>
					<input id="promptUrl" class="hcenter josefin-sans" type="text" placeholder="URL of Modpack to Add" style="font-size:24px">
					<h4 class="josefin-sans" style="font-size:20px; color: red; height:16px">Ensure you trust any link you enter! Prompts are not stripped of potentially harmful content!</h4>
					<p id="promptError" class="josefin-sans fade50ms" style="font-size:16px; color: red; height:16px"></p>
					<div class="hflex hcenter" style="height:96px;width: min-content;">
						<button id="promptSubmit" class="" style="width:192px;">
							<h2 class="josefin-sans">Ok</h2>
						</button>
						<p></p>
						<button id="promptCancel" class="" style="width:192px;">
							<h2 class="josefin-sans">Cancel</h2>
						</button>
					</div>
				</div>
			`,
			{
				url: 'promptUrl'
			},
			async (promptData) => {
				if(!promptData.url.trim().match(/^(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/)) {
					document.getElementById('promptError').innerText = "Adding Modpack Failed: Invalid URL!"
					return false
				}
				const [status, data] = [false, 'idk']
				//const [status, data] = await electronAPI.AddPack('url', data.url.trim())
				if(status) {
					addModpack(data.id, data)
				} else {
					document.getElementById('promptError').innerText = `Adding Modpack Failed: ${data}`
				}
				return status
			},
			(_) => {document.getElementById('promptError').innerText = "";}
		)
		console.log(addData)
	})
}

electronAPI.onConfigRead(async (config) => {
	currentThemeBrightness = config.themeBrightness
	currentThemeColor = config.themeColor
	usingDarkMode = await electronAPI.ThemeChange(currentThemeBrightness)
	console.log(`Theme: ${currentThemeBrightness} | Use Dark Mode: ${usingDarkMode} | Color: ${currentThemeColor}`)
	setTheme()
})

electronAPI.onPackConfigRead((packConfigs) => {
	console.log("Recieved PackConfigRead Event")
	
	setupModpackAdd()
	
	for(const [id, config] of Object.entries(packConfigs)) {
		console.log(id)
		addModpack(id, config)
		states[id] = 'syncing'
		setSymbolByState(id, false, false)
	}
})
/* #endregion */

/* #region  Errors */
electronAPI.onVersionDownloadError((modpackId, err) => {
	console.warn(`VersionDownloadError for modpack ${modpackId}:`, err)
	updateElementDetails(dom[modpackId], configs[modpackId], `Failed: ${(err == 'Timed Out') ? "Request Timed Out" : "VersionDownloadError"}`)
	states[modpackId] = "failedsync"
	setSymbolByState(modpackId, true, true)
})

electronAPI.onVersionReadError((modpackId, _err) => {
	console.warn(`VersionReadError for modpack: ${modpackId}`)
	updateElementDetails(dom[modpackId], configs[modpackId], 'Failed: VersionReadError')
	states[modpackId] = "failedsync"
	setSymbolByState(modpackId, true, true)
})

electronAPI.onChangelistDownloadError((modpackId, _err) => {
	console.warn(`ChangelistDownloadError for modpack ${modpackId}`)
	updateElementDetails(dom[modpackId], null, "Failed: ChangelistDownloadError")
	states[modpackId] = "faileddownload"
	setSymbolByState(modpackId, true, true)
	clearLoadingProgress(modpackId)
})

electronAPI.onChangelistCompileError((modpackId, _err) => {
	console.warn(`ChangelistCompileError for modpack: ${modpackId}`)
	updateElementDetails(dom[modpackId], null, "Failed: ChangelistCompileError")
	states[modpackId] = "faileddownload"
	setSymbolByState(modpackId, true, true)
	clearLoadingProgress(modpackId)
})

electronAPI.onChangelistParseError((modpackId, _err) => {
	console.warn(`ChangelistParseError for modpack: ${modpackId}`)
	updateElementDetails(dom[modpackId], null, "Failed: ChangelistParseError")
	states[modpackId] = "faileddownload"
	setSymbolByState(modpackId, true, true)
	clearLoadingProgress(modpackId)
})
/* #endregion */

/* #region  Response Handlers */
electronAPI.onUpdateCheckedFor((modpackId, updateNeeded, config) => {
	console.log("Recieved UpdateCheck Response")
	console.log(config)
	configs[modpackId] = config
	updateElementDetails(dom[modpackId], config, updateNeeded ? 'A Modpack Update is Needed' : 'Modpack is Up-To-Date')
	states[modpackId] = updateNeeded ? 'predownload' : 'postdownload'
	setSymbolByState(modpackId, true, true)
})

electronAPI.onUpdateProcessPercent((modpackId, percent) => {
	root.style.setProperty(`--loadValue-${modpackId}`, `${440 - (percent * 4.4)}px`)
})

electronAPI.onUpdateProcessComplete(async (modpackId, config) => {
	updateElementDetails(dom[modpackId], config, 'Update Completed!')
	states[modpackId] = 'postdownload'
	clearLoadingProgress(modpackId)
})

electronAPI.onUpdateProcessFailed((modpackId, reason) => {
	console.warn(`Update failed for modpack: ${modpackId} with reason: ${reason}`)
	updateElementDetails(dom[modpackId], null, "Update Failed.")
	states[modpackId] = "faileddownload"
	setSymbolByState(modpackId, true, true)
	clearLoadingProgress(modpackId)
})

//electronAPI.onUserPrompt(() => {})
/* #endregion */

//state = "syncing"
//setIconByState(false, false)
//electronAPI.checkForUpdate()