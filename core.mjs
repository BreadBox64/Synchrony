import './jsdoc.js'
import fs from 'node:fs'
import path from 'node:path'
import util from 'node:util'
import bent from 'bent'
const fetchString = bent('string')
import { app } from 'electron/main'

import { DownloaderHelper } from 'node-downloader-helper'
import { Version } from './Version.mjs'
import { InstallScriptParser } from './InstallScriptParser.mjs'
import { loadConfig, saveConfig, loadPackConfig, loadPackConfigs, savePackConfig, defaultPackConfig } from './Config.mjs'
import Utils from './UtilsServer.mjs'

const userDataPath = app.getPath('userData')
const configPath = path.join(userDataPath, 'synchronyConfig')

function safeMkDir(dirPath) {
	try {
		fs.mkdirSync(dirPath)
	} catch(e) {} 
}

const sessionPath = path.join(userDataPath, 'sessionData')
safeMkDir(sessionPath)
app.setPath('sessionData', sessionPath)

const logsPath = path.join(userDataPath, 'logs')
safeMkDir(logsPath)
app.setAppLogsPath(logsPath)

const crashesPath = path.join(userDataPath, 'crashes')
safeMkDir(crashesPath)
app.setPath('crashDumps', crashesPath)

const downloadsPath = path.join(userDataPath, 'downloads')
safeMkDir(downloadsPath)

const packDataPath = path.join(userDataPath, 'packData')
safeMkDir(packDataPath)

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
		callback('SET-CONFIG-FAIL', configData)
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

async function debugGetRawVersion(id) {
	return await fetchString(packConfigs[id].upstreamVersionURL)
}

async function latestSynchronyString() {
	await fetchString("https://raw.githubusercontent.com/BreadBox64/Synchrony/refs/heads/master/version")
}

// ===== BOOLEAN QUERIES ======

async function isPackUpdateNeeded(id) {
	const packConfig = packConfigs[id]
	if(packConfig.localDebug && packConfig.localDebug === 'true') return Utils.stringToBool(packConfig.upstreamVersionURL);
	const versioningFile = (await fetchString(packConfig.upstreamVersionURL)).trim().split('\n')
	const upstreamVersion = (() => {
		for(let i = 0; i < versioningFile.length; i++) {
			if(versioningFile[i].trim() === packConfig.localBranch) {
				return versioningFile[i+1]
			}
		}
		throw(`No version found upstream for branch "${packConfig.localBranch}", config may be malformed!`)
	})()
	packConfigs[id].upstreamVersion = upstreamVersion
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
		callback('LOAD-PACKCONFIG-FAIL', packData, errorData)
		app.quit()
	}
}

function saveAndExit() {
	saveConfig(configPath, config)
	app.quit()
}

/**
 * 
 * @param {string} id modpackId
 * @param {Function} callback 
 * @returns {null}
 */
async function updatePack(id, callback) {
	if(!await isPackUpdateNeeded(id)) return;
	const packConfig = packConfigs[id]
	if(packConfig.localDebug && packConfig.localDebug === 'true') {
		packConfig.localVersion = '0.0.0'
		packConfig.upstreamVersion = '1.0.0'
	}

	/** @type {string[]} */
	const changelist = await getChangelist(id, packConfig, callback)
	if(changelist.length == 1 && changelist[0] == '') {
		callback('SYS-ERROR', 'CHANGELISTGET-EMPTYCHANGELIST')
		return
	}
	callback('SYS-INFO', 'CHANGELISTGET-SUCCEED')

	const changes = compileChanges(id, changelist, packConfig.localVersion, packConfig.upstreamVersion, callback)
	callback('SYS-INFO', 'CHANGECOMPILE-SUCCEED')

	const packDownloadPath = path.join(downloadsPath, packConfig.id)
	fs.rmSync(packDownloadPath, {force: true, recursive: true})
	fs.mkdirSync(packDownloadPath)
	const parser = new InstallScriptParser(
		callback,
		new Map([
			['DOWNLOADS', packDownloadPath],
			['INSTANCE', 'IDK'],
			['INSTALL', 'IDK'],
			['APPDATA', path.join(packDataPath, packConfig.id)],
			['SYNCHRONY', 'IDK']
		]),
		changes,
		(oldVersion, newVersion) => {return compileChanges(id, changelist, oldVersion, newVersion, callback)}
	)
	await parser.parseAll()
	callback('SYS-INFO', 'PARSER-COMPLETE')
}

function createPack(basePackConfig, packPath, callback = () => {}) {
	const evaluatedPackPath = Utils.evaluatePath(packPath)

	/**
	 * @type {packConfig}
	 */
	let packConfig = defaultPackConfig
	for(const [key, value] of Object.entries(basePackConfig)) {
		packConfig[key] = value
	}

	packConfig.path = evaluatedPackPath
	packConfigs[packConfig.id] = packConfig
	savePackConfig(evaluatedPackPath, packConfig)
	config.packConfigs.push(evaluatedPackPath)
	saveConfig(configPath, config)
}

function downloadPack(packURL, packPath, callback = () => {}) {
	const evaluatedPackPath = Utils.evaluatePath(packPath)

	const dl = new DownloaderHelper(packURL, evaluatedPackPath, {
		fileName: 'synchronyModpackConfig',
		override: true,
		retry: {maxRetries: 5, delay: 1000}
	});
	
	dl.on('end', () => {
		config.packConfigs.push(evaluatedPackPath)
		saveConfig(configPath, config)
		let [_, packConfig] = loadPackConfig(evaluatedPackPath)
		packConfigs[packConfig.id] = packConfig
	});
	dl.on('error', () => {})
	dl.start().catch(() => {})
}

function addPack(packPath, callback = () => {}) {
	const evaluatedPackPath = Utils.evaluatePath(packPath)
	let [success, packConfig] = loadPackConfig(evaluatedPackPath)
	if(success) {	
		config.packConfigs.push(evaluatedPackPath)
		saveConfig(configPath, config)
		packConfigs[packConfig.id] = packConfig
	}
}

function movePack(packId, newPath) {
	const evaluatedNewPath = Utils.evaluatePath(newPath)
	config.packConfigs.splice(config.packConfigs.indexOf(packConfigs[packId].path), 1, evaluatedNewPath)
}

function removePack(packId, purge) {
	config.packConfigs.splice(config.packConfigs.indexOf(packConfigs[packId].path), 1)
	delete packConfigs[packId]
}

// ===== EXPORT =====

export default {
	userDataPath,
	configPath,
	sessionPath,
	logsPath,
	crashesPath,
	downloadsPath,
	packDataPath,

	getConfig,
	setConfig,
	getPackConfigs,
	setPackConfig,
	latestSynchronyString,
	
	initialize,
	saveAndExit,

	updatePack,
	createPack,
	addPack,
	downloadPack,
	removePack,

	isPackUpdateNeeded,
	isSynchronyUpdateNeeded,

	debugGetRawVersion,
	debugGetRawChangelist: () => {},
	debugEvaluatePath: Utils.evaluatePath,
}

// ===== PRIVATE METHODS ======

/**
 * 
 * @param {string} id 
 * @param {packConfig} packConfig 
 * @returns 
*/
async function getChangelist(id, packConfig, callback) {
	if(packConfig.localDebug && packConfig.localDebug === 'true') {
		return Utils.readFile(packConfig.upstreamChangelist)
	}
	const promise = new Promise((resolve, reject) => {
		const changelistDownloadErrorHandler = (e) => {
			callback('SYS-ERROR', 'UPDATE-CHANGELISTGET-FAIL', e)
			reject()
		}
		
		try {
			const dl = new DownloaderHelper(packConfig.upstreamChangelist, packDataPath, {
				fileName: `upstreamChangelist:${id}`,
				override: true,
				retry: {maxRetries: 5, delay: 1000}
			});
			callback('SYS-INFO', 'UPDATE-CHANGELISTGET-START')
			
			dl.on('end', () => {
				let changelist
				changelist = Utils.readFile(path.join(packDataPath, `upstreamChangelist:${id}`))
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
		callback('SYS-ERROR', 'UPDATE-CHANGECOMPILE-FAIL', e)
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
async function singleThreadProcessChanges(id, changes, callback) {
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
			case '?-': { // Query for conditional jump
				const [_arg, id, condition, jump] = change
				break
			}
			case '?+': { // Prompt user for conditional jump
				const [_arg, id, prompt, options] = change
				break
				}
			case '?~': { // Prompt user to select a folder

			}
			case '/': { // Comment to user
				const [_arg, id, comment] = change
				callback('userComment', comment)
				break
				}
			case '\\': { // Log to stdout
				const [_arg, id, comment] = change
				callback('stdout', comment)
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