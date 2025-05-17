const {
	log,
	debug,
	error,
	warn,
	fs,
	fsp,
	path,
	util,
	fetchString
} = global.moduleExport
const app = global.app
import { DownloaderHelper } from 'node-downloader-helper'
import { Version } from './version.mjs'
import { loadConfig, saveConfig, loadPackConfig, loadPackConfigs, savePackConfig, newPackConfig } from "./config.mjs"

const configPath = path.join(app.getPath('userData'), 'synchronyConfig')
const sessionPath = app.getPath('sessionData')
log(sessionPath)
/** @type {config} */
let config = {}
/** @type {Object.<string, packConfig>} */
let packConfigs = {}

// ===== GETTERS & SETTERS ======

function getConfig() {
	return config
}

function setConfig(callback = () => {}) {
	const [configSuccess, configData] = loadConfig(configPath)
	if(configSuccess) {
		config = configData
	} else {
		callback('SET-CONFIG-FAIL')
	}
}

function getPackConfigs() {
	return packConfigs
}

function setPackConfig(id, path, callback = () => {}) {
	packConfigs[id] = undefined
	const [s, v] = loadPackConfig(path)
	if(s) {
		packConfigs[v.id] = v;
	} else {
		callback('SET-PACKCONFIG-FAIL')
	}
}

async function getRawVersion(id) {
	return await fetchString(packConfigs[id].upstreamVersionURL)
}

async function latestSynchronyString() {
	await fetchString("https://raw.githubusercontent.com/BreadBox64/Synchrony/refs/heads/master/version")
}

// ===== BOOLEAN QUERIES ======

async function isPackUpdateNeeded(id) {
	const packConfig = packConfigs[id]
	const versioningFile = (await fetchString(packConfig.upstreamVersionURL)).trim().split('\n')
	const upstreamVersion = (() => {
		for(let i = 0; i < versioningFile.length; i++) {
			if(versioningFile[i].trim() === packConfig.localBranch) {
				return versioningFile[i+1]
			}
		}
		throw(`No version found upstream for branch "${packConfig.localBranch}", config may be malformed!`)
	})()
	packConfig.upstreamVersion = upstreamVersion
	return new Version(upstreamVersion).gt(new Version(packConfig.localVersion)) 
}

async function isSynchronyUpdateNeeded(params) {
	const currentVersion = new Version(config.synchronyVersion)
	const latestVersionString = await fetchString("https://raw.githubusercontent.com/BreadBox64/Synchrony/refs/heads/master/version")
	const latestVersion = new Version(latestVersionString)
	return latestVersion.gt(currentVersion)
}

// ===== ACTIONS ======

function initialize(callback = () => {}) {
	const [configSuccess, configData] = loadConfig(configPath)
	if(configSuccess) {
		config = configData
		callback('LOAD-CONFIG-SUCCEED');
	} else {
		callback('LOAD-CONFIG-FAIL', configData)
		app.quit()
	}

	const [packSuccess, packData, errorData] = loadPackConfigs(config.packConfigs)
	if(packSuccess) {
		packConfigs = packData
		callback('LOAD-PACKCONFIG-SUCCEED');
	} else {
		callback('LOAD-PACKCONFIG-FAIL', packData)
		app.quit()
	}
}

/**
 * 
 * @param {string} id modpackId
 * @returns {null}
 */
async function updateModpack(id, callback = () => {}) {
	const packConfig = packConfigs[id]

	/** @type {string[]} */
	const changelist = await getChangelist(id, packConfig, callback)
	if(changelist.length == 1 && changelist[0] == '') {
		callback('UPDATE-CHANGELISTGET-EMPTYCHANGELIST')
		return
	}
	callback('UPDATE-CHANGELISTGET-SUCCEED')
	const changes = compileChanges(id, changelist, packConfig.localVersion, packConfig.upstreamVersion, callback)
	callback('UPDATE-CHANGECOMPILE-SUCCEED')
	const parsedChanges = parseChanges(id, changes, callback)

	callback('UPDATE-CHANGEPARSE-SUCCEED')
	const result = await singleThreadProcessChanges(id, parsedChanges, callback)
	callback('UPDATE-CHANGEPROCESS-SUCCEED')
}

/*
export function addModpack(addMethod, arguments) {
	
}
*/

function saveAndExit() {
	saveConfig(configPath, config)
	app.quit()
}

// ===== EXPORT =====

const Core = {
	configPath,
	sessionPath,

	getConfig,
	setConfig,
	getPackConfigs,
	setPackConfig,
	getRawVersion,
	latestSynchronyString,

	initialize,
	saveAndExit,
	updateModpack,

	isPackUpdateNeeded,
	isSynchronyUpdateNeeded
}
export { Core }

// ===== PRIVATE METHODS ======

/**
 * 
 * @param {string} id 
 * @param {packConfig} packConfig 
 * @returns 
*/
async function getChangelist(id, packConfig, callback) {
	const promise = new Promise((resolve, reject) => {
		const changelistDownloadErrorHandler = (e) => {
			callback('UPDATE-CHANGELISTGET-FAIL', e)
			reject()
		}
		
		try {
			const dl = new DownloaderHelper(packConfig.upstreamChangelist, sessionPath, {
				fileName: `upstreamChangelist:${id}`,
				override: true,
				retry: {maxRetries: 5, delay: 1000}
			});
			callback('UPDATE-CHANGELISTGET-START')
			
			dl.on('end', () => {
				debug("Downloaded changelist file.")
				let changelist
				changelist = fs.readFileSync(path.join(sessionPath, `upstreamChangelist:${id}`), 'utf8').trim().split('\n');
				resolve(changelist)
			});
			dl.on('error', changelistDownloadErrorHandler)
			dl.start().catch(changelistDownloadErrorHandler)
		} catch(e) {
			changelistDownloadErrorHandler(e)
		}
	})
	return promise
}

function findVersionRoute(versionPairs, startingVersion, targetVersion, route) {
	const layer = versionPairs.filter(key => (key[0] == startingVersion))
	let set = []
	for(const pair of layer) {
		if(pair[1] == targetVersion) return [...route, startingVersion] 
		set.push(findVersionRoute(versionPairs, pair[1], targetVersion, [...route, startingVersion]))
	}
	if(set.length == 0) return null
	let shortest = set[0]
	for(const route of set) {
		if(route.length < shortest.length) shortest = route
	}
	return shortest
}

/**
 * 
 * @param {string[]} changelist 
 * @param {string} oldVersion 
 * @param {string} newVersion 
 */
function compileChanges(id, changelist, oldVersion, newVersion, callback) {
	try {
		let currentHeader = ''
		let changeStructure = {}
		changelist.forEach(line => {
			if(/^\d+$/.test(line[0])) { // Is the first char of current line numeric?
				currentHeader = line
				changeStructure[line] = []
			} else {
				changeStructure[currentHeader].push(line)
			}
		})

		// TODO handle empty changesets


		// TODO Can have dependent version changes i.e. pack-client automatically includes all changes in pack-server
		// 1.0.0-c -> 1.1.0-c
		// > 1.0.0-s -> 1.1.0-s
		// + extra changes
		let changes = []
		if(changeStructure[`${oldVersion} -> ${newVersion}`] != undefined) {
			changes = changeStructure[`${oldVersion} -> ${newVersion}`] 
		} else {
			const versionPairs = Object.keys(changeStructure).map(key => key.split(' -> '))
			const versionRoute = [...findVersionRoute(versionPairs, oldVersion, newVersion, []), newVersion]
			//log(util.inspect(versionRoute, false, null, true /* enable colors */))
			
			for(let i = 0; i < versionRoute.length - 1; i++) {
				//log(`${i} : ${versionRoute[i]}`)
				changes = [...changes, ...changeStructure[`${versionRoute[i]} -> ${versionRoute[i+1]}`]]
			}
		}

		return changes
	} catch(e) {
		callback('UPDATE-CHANGECOMPILE-FAIL', e)
	}
}

/**
 * 
 * @param {string} id 
 * @param {string[]} changes 
 * @returns {changeObject}
 */
function parseChanges(id, changes) {
	let parsedDownloads = []
	let j = 0
	let errorCond = false
	let errors = []
	let parsedChanges = changes.map((change) => {
		try {
			let args = []

			let currentArg = ''
			let insideString = false
			for(let i = 0; i < change.length; i++) {
				const c = change[i]
				if(c === '`') {
					insideString = !insideString
				} else if(c === ' ' && !insideString) {
					args.push(currentArg)
					currentArg = ''
				} else {
					currentArg += c
				}
			}
			args.push(currentArg)

			switch(args[0]) {
				case '+':
					parsedDownloads.push([`cache:${id}:${args[1]}`, args.splice(4, args.length - 5, `cache:${id}:${args[1]}`)])
					break
				case '*':
					args[3] = args[3].split(';').map(lineNum => {return parseInt(lineNum)})
				case '^':
					const replacements = args.splice(4, args.length - 6)
					args.splice(4, 0, replacements)
					break
			}

			j++
			return args
		} catch(e) {
			errors.push(e)
			errorCond = true
		}
	})

	if(errorCond) {
		return {
			error: true,
			list: errors
		}
	} else {
		return {
			error: false,
			downloads: parsedDownloads,
			changes: parsedChanges
		}
	}
}

/**
 * 
 * @param {changeObject} changes 
 */
async function multiThreadProcessChanges(id, changes) {
	/*
	let errorCond = false
	let workers = []
	let activeWorkers = 0
	for(let i = Math.min(config.maxWorkers, changes.length); i > 0; i--) {
		let worker = new Worker('./changeWorker.js', {name: `ChangeWorker${i}`})
		activeWorkers += 1
		worker.onmessage = (msg) => {
			switch(msg[0]) {
				case 'log':
					log(msg[2])
					break
				case 'fatal':
					errorCond = true
				case 'error':
					warn(msg[2])
					break
				case 'term':
					worker.terminate()
					break
				case 'complete':
					if(changes.length <= 0) {
						worker.terminate()
						activeWorkers -= 1
					} else {
						worker.postMessage(['start', changes.pop()])
					}
			}
		}
		worker.postMessage(['start', changes.pop()])
		workers.push(worker)
	}

	while(!(activeWorkers === 0 && changes.length === 0) || !errorCond) {
		win.webContents.send('Update:Percent', id, 80 * (changes.length / changeNum) + 20)
		await delay(100)
	}
	
	if(errorCond) {
		workers.forEach(worker => worker.terminate())
		win.webContents.send('Update:Failed', true)
	} else {
		win.webContents.send('Update:Complete', true)
	}
	*/
}

/**
 * 
 * @param {changeObject} changes 
 */
async function singleThreadProcessChanges(id, changes) {
	const numChanges = changes.changes.length
	for(let i = 0; i < numChanges; i++) {
		const change = changes.changes[i]
		switch(change[0]) {
			case '>': { // Import changes from another diff
				const [_arg, id, version] = change
				break
				}
			case '$': { // Config operation
				const [_arg, id, key, value] = change
			}
			case '?+': { // Prompt conditional download
				const [_arg, id, path, decompress, cache, prompt, options] = change
				break
				}
			case '?~': { // Prompt user to select a folder

			}
			case '/': { // Comment to user
				const [_arg, id, comment] = change
				break
				}
			case '\\': { // Log to stdout
				const [_arg, id, comment] = change
				log('\\ found')
				break
				}
			case '+': { // Download and install file or compressed directory
				const [_arg, id, path, decompress, cache, comment] = change
				break
				}
			case '-': { // Delete installed file
				const [_arg, id, path, comment] = change
				break
				}
			case '*': {  // Execute line replacements on installed file
				const [_arg, id, path, lineNums, replacements, comment] = change
				break
				}
			case '^': { // Execute regex on installed file
				const [_arg, id, path, regexPattern, replacements, comment] = change
				break
				}
		}
	}
}