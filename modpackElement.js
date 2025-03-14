import "./jsdoc.js"

/**
 * Create a modpack HTML element
 * @param {config} config 
 * @param {displayConfig} displayConfig 
 * @returns {string} New element outerHTML
 */
export function createModpackElement(config, displayConfig) {
	const gradientColors = displayConfig.gradient
	const colorSet = displayConfig.colors
	const element = 
	`<div class="modpackContainer" id="modpack-${config.id}" style="background-color: ${colorSet[3]}">
		<div class="loadingElement">
			<div>
				<div class="loadingElement-static tooltip">
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
		<div class="content">
			<h1 class="nunito-sans content-title">Modpack Title</h1>
			<p class="nunito-sans content-status">Checking Online for Updates...</p>
		</div> 
	</div>`
	return element
}

/**
 * Switch modpack element to given theme
 * @param {dom} dom 
 * @param {displayConfig} displayConfig 
 * @param {string} theme Theme to switch to 
 */
export function updateElementTheme(dom, displayConfig, theme) {
}

//<circle class="loadingElement-circle" style="stroke: url(#gradient-${config.id}); stroke-dashoffset: var(--loadValue-${config.id})" cx="80" cy="80" r="70"/>