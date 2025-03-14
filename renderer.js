import "./jsdoc.js"
const root = document.querySelector(':root')
const modpackList = document.getElementById('modpackList')
const add = document.getElementById('modpackAdd')
import {delay} from './utils.js'
import {createModpackElement} from './modpackElement.js'

const pressedKeys = {};
window.onkeyup = (e) => {pressedKeys[e.keyCode] = false;}
window.onkeydown = (e) => {pressedKeys[e.keyCode] = true;} 

const transitionEnd = (() => {
	let t;
	const el = document.createElement('fakeelement');
	const transitions = {
		'transition':'transitionend',
		'OTransition':'oTransitionEnd',
		'MozTransition':'transitionend',
		'WebkitTransition':'webkitTransitionEnd'
	}

	for(t in transitions){
		if( el.style[t] !== undefined ){
			return transitions[t];
		}
	}
})()

/** @type {Object.<modpackId, config>} */
let configs = {}
/** @type {Object.<modpackId, dom>} */
let dom = {}
/** @type {Object.<modpackId, string>} */
let states = {}
/** @type {Object.<modpackId, displayConfig>} */
let displayConfigs = {}

/**
 * 
 * @async
 * @param {modpackId} modpackId 
 * @param {boolean} pret Fade out previous symbol
 * @param {boolean} postt Fade in new symbol
 */
async function setSymbolByState(modpackId, pret, postt) {
	const {symbol, staticE} = dom[modpackId]
	if(pret) {
		symbol.style.opacity = 0
		await delay(600)
	}
	symbol.className = "loadingElement-symbol material-symbols-outlined size-80 wght-7 "
	switch(states[modpackId]) {
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
	if(postt) {
		await delay(600)
	}
}
/**
 * 
 * @param {modpackId} modpackId 
 * @returns {}
 */
function symbolClickHandlerFactory(modpackId) {
	return () => {
		console.log(`state: ${states[modpackId]}, modpackId: ${modpackId}`)
		switch(states[modpackId]) {
			case 'postdownload':
			case 'failedsync':
				states[modpackId] = 'syncing'	
				setSymbolByState(modpackId, true, true)
				window.electronAPI.checkForUpdate(modpackId)
				break;
			case 'postsync':
			case 'presync':
				states[modpackId] = 'syncing'	
				setSymbolByState(modpackId, false, true)
				window.electronAPI.checkForUpdate(modpackId)
				break;
			case 'faileddownload':
				if(pressedKeys[16]) { // resync
					states[modpackId] = 'syncing'
					setSymbolByState(modpackId, true, true)
					window.electronAPI.checkForUpdate(modpackId)
				} else { // download
					window.electronAPI.startProcess(modpackId)
					states[modpackId] = 'downloading'
					setSymbolByState(modpackId, true, false)
				}
				break;
			case 'predownload':
				window.electronAPI.startProcess(modpackId)
				states[modpackId] = 'downloading'
				setSymbolByState(modpackId, true, false)
				break
		}
	}
}

/**
 * 
 * @param {*} modpackId 
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

// ===== Startup =====
function generateDisplayConfig(modpackConfig) {
	const gradientColors = modpackConfig.customGradient?.split(' ') ?? ['#db59ff', '#4980f7']
	const colorSet = ['f0f0f0', '2c2c2c', ...(modpackConfig.customColorSet?.split(' ') ?? ['#f5f2ff', '#ebe6ff', '#dcd3ff'])]

	displayConfigs[modpackConfig.id] = {
		gradient: gradientColors,
		colors: colorSet
	}
}

window.electronAPI.onPackConfigRead((packConfigs) => {
	console.log("Recieved PackConfigRead Event")
	console.log(packConfigs)

	
	
	for(const [id, config] of Object.entries(packConfigs)) {
		console.log(id)
		configs[id] = config
		states[id] = 'presync'

		const container = document.createElement('div')
		modpackList.insertBefore(container, add)
		
		root.style.setProperty(`--loadValue-${id}`, `440px`)
		generateDisplayConfig(config)
		const displayConfig = displayConfigs[id]
		container.outerHTML = createModpackElement(config, displayConfig)

		const elements = getModpackElements(id)
		elements.loading.addEventListener('click', symbolClickHandlerFactory(id))
		elements.container.addEventListener('mouseover', () => {
			elements.container.style.backgroundColor = displayConfig.colors[4]
		})
		elements.container.addEventListener('mouseout', () => {
			elements.container.style.backgroundColor = displayConfig.colors[3]
		})
		elements.title.innerText = config.name

		dom[id] = elements
		setSymbolByState(id, false, false)
	}
})

// ===== Errors =====
window.electronAPI.onVersionDownloadError((modpackId) => {
	console.error(`VersionReadError for modpack: ${modpackId}`)
	states[modpackId] = "failedsync"
	setSymbolByState(modpackId, true, true)
})

window.electronAPI.onVersionReadError((modpackId) => {
	console.error(`VersionReadError for modpack: ${modpackId}`)
	states[modpackId] = "failedsync"
	setSymbolByState(modpackId, true, true)
})


// ===== Response Handlers =====
window.electronAPI.onUpdateCheckedFor((modpackId, updateNeeded, versionData) => {
	console.log("Recieved UpdateCheck Response")
	dom[modpackId].status.innerText = updateNeeded ?
		`An update is needed from version ${versionData.local.str} to ${versionData.upstream.str}` :
		`No update is needed, version ${versionData.local.str} is up to date!`
	states[modpackId] = updateNeeded ? 'predownload' : 'postdownload'
	setSymbolByState(modpackId, true, true)
})

window.electronAPI.onUpdateProcessPercent((modpackId, percent) => {
	root.style.setProperty(`--loadValue-${modpackId}`, `${440 - (percent*4.4)}px`)
})

window.electronAPI.onUpdateProcessComplete(async (modpackId, value) => {
	states[modpackId] = 'postdownload'
	const svg = dom[modpackId].svg
	svg.style.opacity = 0
	setSymbolByState(modpackId, true, true)
	svg.addEventListener(transitionEnd, async () => {
		await delay(600)
		root.style.setProperty(`--loadValue-${modpackId}`, '440px')
		await delay(1000)
		svg.style.opacity = 1
	}, {once: true})
})

const themes = {
	light: [
		['--mainColor', '#ffffff'],
		['--secColor', '#2c2c2c'],
		['--terColor', '#f5f2ff'],
		['--quatColor', '#ebe6ff'],
		['--pentColor', '#dcd3ff']
	],
	dark: [
		['--mainColor', '#2c2c2c'],
		['--secColor', '#ffffff'],
		['--terColor', '#4d4763'],
		['--quatColor', '#49445b'],
		['--pentColor', '#413d4f']
	]
}

function setTheme(theme) {
	themes[theme]?.forEach(([v, c]) => {
		root.style.setProperty(v, c)
	})
}

let currentTheme = false
document.getElementsByTagName('h1')[0].addEventListener('click', () => {
	setTheme(currentTheme ? 'light' : 'dark')
	currentTheme = !currentTheme
})

//state = "syncing"
//setIconByState(false, false)
//window.electronAPI.checkForUpdate()