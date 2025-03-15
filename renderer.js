import "./jsdoc.js"
import { delay } from './utils.js'
import { createModpackElement, updateElementTheme } from "./modpackElement.js"

const electronAPI = window.electronAPI
const root = document.querySelector(':root')
const modpackList = document.getElementById('modpackList')
const modpackAdd = document.getElementById('modpackAdd')
const addButtons = {
	/** @type {!Element} */
	existing: modpackAdd.children.item(0),
	/** @type {!Element} */
	file: modpackAdd.children.item(1),
	/** @type {!Element} */
	url: modpackAdd.children.item(2)
}
const themeSwitch = document.getElementById('themeSwitch')
let currentTheme = 'system'

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

/** @type {Object.<string, config>} */
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
	const { symbol, staticE } = dom[modpackId]
	if (pret) {
		symbol.style.opacity = 0
		await delay(600)
	}
	symbol.className = "loadingElement-symbol material-symbols-outlined size-80 wght-7 "
	switch (states[modpackId]) {
		case 'syncing':
			symbol.className = "loadingElement-symbol material-symbols-outlined size-80 wght-7 spin"
			symbol.innerText = "sync"
			staticE.title = "Checking for updates..."
			break
		case 'postsync':
		case 'presync':
			symbol.innerText = "sync"
			staticE.title = "Click to check for updates."
			break
		case 'downloading':
			symbol.innerText = ""
			staticE.title = "Downloading..."
			break
		case 'predownload':
			symbol.innerText = "download"
			staticE.title = "Click to download update."
			break
		case 'postdownload':
			symbol.innerText = "download_done"
			staticE.title = "Update complete!"
			break
		case 'failedsync':
			symbol.innerText = "sync_problem"
			staticE.title = "Sync error: check network connection."
			break
		case 'faileddownload':
			symbol.innerText = "error"
			staticE.title = "Update error: check network connection."
			break
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
				states[modpackId] = 'syncing'
				setSymbolByState(modpackId, true, true)
				electronAPI.checkForUpdate(modpackId)
				break;
			case 'postsync':
			case 'presync':
				states[modpackId] = 'syncing'
				setSymbolByState(modpackId, false, true)
				electronAPI.checkForUpdate(modpackId)
				break;
			case 'faileddownload':
				if (pressedKeys[16]) { // resync
					states[modpackId] = 'syncing'
					setSymbolByState(modpackId, true, true)
					electronAPI.checkForUpdate(modpackId)
				} else { // download
					electronAPI.startProcess(modpackId)
					states[modpackId] = 'downloading'
					setSymbolByState(modpackId, true, false)
				}
				break;
			case 'predownload':
				electronAPI.startProcess(modpackId)
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
	const modpackContainer = document.getElementById(`modpack-${modpackId}`)
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
	}

	return elements
}
/* #endregion */

/* #region  Themes */
const themes = {
	light: [
		['--mainColor', '#ffffff'],
		['--secColor', '#2c2c2c'],
		['--terColor', '#ebe6ff'],
		['--quatColor', '#dcd3ff']
	],
	dark: [
		['--mainColor', '#2c2c2c'],
		['--secColor', '#ffffff'],
		['--terColor', '#49445b'],
		['--quatColor', '#413d4f']
	]
}

function setTheme(useDarkMode) {
	themeSwitch.innerText = themeSymbolMap[currentTheme]
	themes[useDarkMode ? 'dark' : 'light']?.forEach(([v, c]) => {
		root.style.setProperty(v, c)
	})
	Object.keys(states).forEach(id => {
		updateElementTheme(id, root, displayConfigs[id], useDarkMode)
	})
}

const themeNextMap = {
	light: 'dark',
	dark: 'system',
	system: 'light'
}

const themeSymbolMap = {
	light: 'light_mode',
	dark: 'dark_mode',
	system: 'contrast'
}

themeSwitch.addEventListener('click', async () => {
	currentTheme = themeNextMap[currentTheme]
	const useDarkMode = await electronAPI.ThemeChange(currentTheme)
	setTheme(useDarkMode)
})
/* #endregion */

/* #region  Startup */
/**
 * 
 * @param {config} modpackConfig 
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
 * @param {config} packConfig 
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
		const [status, data] = await electronAPI.AddPack('url', 'https://www.example.com')
		if(status) addModpack(data.id, data)
	})
}

electronAPI.onConfigRead(async (config) => {
	currentTheme = config.theme
	const useDarkMode = await electronAPI.ThemeChange(currentTheme)
	console.log(useDarkMode)
	console.log(currentTheme)
	setTheme(useDarkMode)
})

electronAPI.onPackConfigRead((packConfigs) => {
	console.log("Recieved PackConfigRead Event")
	
	setupModpackAdd()
	
	for (const [id, config] of Object.entries(packConfigs)) {
		addModpack(id, config)
	}
})
/* #endregion */

/* #region  Errors */
electronAPI.onVersionDownloadError((modpackId) => {
	console.error(`VersionReadError for modpack: ${modpackId}`)
	states[modpackId] = "failedsync"
	setSymbolByState(modpackId, true, true)
})

electronAPI.onVersionReadError((modpackId) => {
	console.error(`VersionReadError for modpack: ${modpackId}`)
	states[modpackId] = "failedsync"
	setSymbolByState(modpackId, true, true)
})
/* #endregion */

/* #region  Response Handlers */
electronAPI.onUpdateCheckedFor((modpackId, updateNeeded, versionData) => {
	console.log("Recieved UpdateCheck Response")
	dom[modpackId].status.innerText = updateNeeded ?
		`An update is needed from version ${versionData.local.str} to ${versionData.upstream.str}` :
		`No update is needed, version ${versionData.local.str} is up to date!`
	states[modpackId] = updateNeeded ? 'predownload' : 'postdownload'
	setSymbolByState(modpackId, true, true)
})

electronAPI.onUpdateProcessPercent((modpackId, percent) => {
	root.style.setProperty(`--loadValue-${modpackId}`, `${440 - (percent * 4.4)}px`)
})

electronAPI.onUpdateProcessComplete(async (modpackId, value) => {
	states[modpackId] = 'postdownload'
	const svg = dom[modpackId].svg
	svg.style.opacity = 0
	setSymbolByState(modpackId, true, true)
	svg.addEventListener(transitionEnd, async () => {
		await delay(600)
		root.style.setProperty(`--loadValue-${modpackId}`, '440px')
		await delay(1000)
		svg.style.opacity = 1
	}, { once: true })
})
/* #endregion */

//state = "syncing"
//setIconByState(false, false)
//electronAPI.checkForUpdate()