const root = document.querySelector(':root')
const dom = {
	checkForUpdatesButton: document.getElementById('button-checkforupdates'),
	resp: document.getElementById('resp'),
	updateMaterialSymbol: document.getElementById('materialsymbol-update'),
	updateLoadingCircle: document.getElementById('loadingicon-update'),
	updateTooltip: document.getElementById('tooltip-update')
}
const delay = millis => new Promise((resolve, reject) => {
  setTimeout(_ => resolve(), millis)
})
let state = 'presync'

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

async function setIconByState(pret, postt) {
	if(pret) {
		dom.updateMaterialSymbol.style.opacity = 0
		await delay(600)
	}
	dom.updateMaterialSymbol.className = "material-symbols-outlined size-80 wght-7 "
	switch(state) {
		case 'syncing':
			dom.updateMaterialSymbol.className = "material-symbols-outlined size-80 wght-7 spin"
			dom.updateTooltip.innerText = "Checking for updates..."
		case 'postsync':
		case 'presync':
			dom.updateMaterialSymbol.innerText = "sync"
			dom.updateTooltip.innerText = "Click to check for updates."
			break;
		case 'downloading':
			dom.updateMaterialSymbol.innerText = ""
			dom.updateTooltip.innerText = "Downloading..."
			break;
		case 'predownload':
			dom.updateMaterialSymbol.innerText = "download"
			dom.updateTooltip.innerText = "Click to download update."
			break;
		case 'postdownload':
			dom.updateMaterialSymbol.innerText = "download_done"
			dom.updateTooltip.innerText = "Update complete!"
			break;
		case 'failedsync':
			dom.updateMaterialSymbol.innerText = "sync_problem"
			dom.updateTooltip.innerText = "Sync error: check network connection."
			break;
		case 'faileddownload':
			dom.updateMaterialSymbol.innerText = "error"
			dom.updateTooltip.innerText = "Update error: check network connection."
			break;
	}
	dom.updateMaterialSymbol.style.opacity = 1
	if(postt) {
		await delay(600)
	}
}

dom.updateMaterialSymbol.addEventListener('click', async () => {
	switch(state) {
		case 'postdownload':
		case 'failedsync':
			state = 'syncing'	
			setIconByState(true, true)
			window.electronAPI.checkForUpdate()
			break;
		case 'postsync':
		case 'presync':
			state = 'syncing'	
			setIconByState(false, true)
			window.electronAPI.checkForUpdate()
			break;
		case 'faileddownload':
		case 'predownload':
			if(pressedKeys[16]) { // resync
				state = 'syncing'
				setIconByState(true, true)
				window.electronAPI.checkForUpdate()
			} else { // download
				window.electronAPI.startProcess()
				state = 'downloading'
				setIconByState(true, false)
			}
			break;
	}
})

window.electronAPI.onVersionDownloadError(() => {
	state = "failedsync"
	setIconByState(true, true)
})

window.electronAPI.onVersionReadError(() => {
	state = "failedsync"
	setIconByState(true, true)
})

window.electronAPI.onUpdateCheckedFor(async (updateNeeded, versionData) => {
	dom.resp.innerText = updateNeeded ?
		`An update is needed from version ${versionData.current.str} to ${versionData.upstream.str}` :
		`No update is needed, version ${versionData.current.str} is up to date!`
	state = updateNeeded ? 'predownload' : 'postdownload'
	setIconByState(true, true)
})

window.electronAPI.onUpdateProcessPercent((percent) => {
	root.style.setProperty('--loadValue', `${440 - (percent*4.4)}px`)
})

window.electronAPI.onUpdateProcessComplete(async (value) => {
	state = 'postdownload'
	dom.updateLoadingCircle.style.opacity = 0
	setIconByState(true, true)
	dom.updateLoadingCircle.addEventListener(transitionEnd, async () => {
		await delay(350)
		root.style.setProperty('--loadValue', '440px')
		await delay(150)
		dom.updateLoadingCircle.style.opacity = 1
	}, {once: true})
})

//state = "syncing"
setIconByState(false, false)
//window.electronAPI.checkForUpdate()