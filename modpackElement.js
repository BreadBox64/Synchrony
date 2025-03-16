import "./jsdoc.js"
import {delay} from './utils.js'

/**
 * Create a modpack HTML element
 * @param {packConfig} config 
 * @param {displayConfig} displayConfig 
 * @returns {string} New element outerHTML
 */
export function createModpackElement(config, displayConfig) {
	const gradientColors = displayConfig.gradient
	const element = 
	`<div class="modpackContainer" id="modpack-${config.id}" style="background-color: var(--color0-${config.id})">
		<div class="loadingElement">
			<div>
				<div class="loadingElement-static">
					<div class="outer">
						<div class="inner">
							<span class="loadingElement-symbol material-symbols-outlined size-80 wght-7" style="opacity: 1;">sync</span>
						</div>
					</div>
				</div>
				<svg xmlns="http://www.w3.org/2000/svg" style="top: -160px;" version="1.1" width="160px", height="160px">
					<circle class="loadingElement-bg" style="stroke: var(--secColor)" cx="80" cy="80" r="70"/>
				</svg>
				<svg xmlns="http://www.w3.org/2000/svg" style="top: -324px;" class="loadingElement-svg" version="1.1" width="160px", height="160px" z-index="1">
					<defs>
						<linearGradient id="gradient-${config.id}" x1="0%" y1="100%" x2="100%" y2="0%">
							<stop offset="0%" stop-color="${gradientColors[0]}"/>
							<stop offset="100%" stop-color="${gradientColors[1]}"/>
						</linearGradient>
					</defs>
					<circle class="loadingElement-circle" style="stroke: url(#gradient-${config.id}); stroke-dashoffset: var(--loadValue-${config.id})" cx="80" cy="80" r="70"/>
				</svg>
			</div>
		</div>
		<div class="textElement content">
			<h1 class="nunito-sans content-title">Modpack Title</h1>
			<p class="nunito-sans content-status">Checking Online for Updates...</p>
		</div>
		<div class="textElement details">
			<h1 class="nunito-sans">Modpack Branch:</h1>
			<p  class="nunito-sans">${config.localBranch}</p>
			<h1 class="nunito-sans">Local Version:</h1>
			<p  class="nunito-sans">${config.localVersion}</p>
			<h1 class="nunito-sans">Upstream Version:</h1>
			<p  class="nunito-sans">${config.upstreamVersion}</p>
		</div>
	</div>`
	return element
}

/**
 * Switch modpack element to given theme
 * @param {string} id Element modpackId
 * @param {root} Element Document root 
 * @param {displayConfig} displayConfig 
 * @param {string} theme Theme to switch to 
 */
export function updateElementTheme(id, root, displayConfig, useDarkMode) {
	root.style.setProperty(`--color0-${id}`, displayConfig.colors[useDarkMode ? 2 : 0])
	root.style.setProperty(`--color1-${id}`, displayConfig.colors[useDarkMode ? 3 : 1])
}

/**
 * 
 * @param {dom} dom 
 * @param {packConfig} config 
 */
export async function updateElementDetails(dom, config, statusText) {
	const elements = dom.details.getElementsByTagName('p')
	let dataArray
	let delta = [false, false, false]

	if(config != null) {
		dataArray = [config.localBranch, config.localVersion, config.upstreamVersion]
		for(let i = 0; i < 3; i++) {
			delta[i] = elements.item(i).innerText != dataArray[i]
		}
	}

	for(let i = 0; i < 3; i++) {
		if(delta[i]) elements.item(i).style.opacity = 0
	}
	dom.status.style.opacity = 0

	await delay(200)

	for(let i = 0; i < 3; i++) {
		if(delta[i]) elements.item(i).innerText = dataArray[i]
	}
	dom.status.innerText = statusText

	await delay(200)

	for(let i = 0; i < 3; i++) {
		if(delta[i]) elements.item(i).style.opacity = 1
	}
	dom.status.style.opacity = 1
	return true
}
//<circle class="loadingElement-circle" style="stroke: url(#gradient-${config.id}); stroke-dashoffset: var(--loadValue-${config.id})" cx="80" cy="80" r="70"/>