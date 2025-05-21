import { DownloaderHelper } from 'node-downloader-helper'
import path from 'node:path'
import fs from 'node:fs'
import { readFile } from './Utils.mjs'
import decompress from 'decompress'

const nullExecute = () => {}

/**
 * 
 * @param {string} arg 
 */
function stringArgEvaluate(env) {
	return (arg) => {
		return arg.replaceAll(/\${(\w+)}/g, (_, match) => {
			if(env.has(match)) return env.get(match);
			return `[Invalid Parser Enviroment Variable '${match}']`
		})
	}
}

class InstallScriptParser {
	/**
	 * @param {Function} callback 
	 * @param {Map<string, string>} paths
	 * @param {string[]} script 
	 * @param {Function} changeCompiler 
	 * @param {Map<string, any>} initialVariables 
	 */
	constructor(callback, paths, script, changeCompiler, initialVariables = new Map()) {
		this.callback = callback
		this.paths = paths
		this.currentLine = 0
		this.script = script
		this.scriptLength = script.length
		this.changeCompiler = changeCompiler
		this.enviroment = initialVariables
		this.labels = new Map()
	}

	static argify(line) {
		let args = []
		let currentArg = ''
		let insideString = false

		for(let i = 0; i < line.length; i++) {
			const c = line[i]
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

		return args
	}

	getVar(varName) {
		return this.enviroment.get(varName)
	}

	evaluateAndSanitizePath(filePath) {
		/**
		 * @type {string[]}
		 */
		let pathSections = filePath.replaceAll('\\', '/').split('/')
		pathSections[0] = (() => {
			switch(pathSections[0]) {
				case '$D':
					return this.paths.get('DOWNLOADS')
				case '$I':
					return this.paths.get('INSTANCE')
				case '$G':
					return this.paths.get('INSTALL')
				case '$A':
					return this.paths.get('APPDATA')
				case '$S':
					return this.paths.get('SYNCHRONY')
				case '$':
					return this.getVar(pathSections.splice(1, 1)[0])
			}
		})()
		const finalPath = path.join(...pathSections)
		const valid = (
			finalPath.includes(this.paths.get('DOWNLOADS')) ||
			finalPath.includes(this.paths.get('INSTANCE')) ||
			finalPath.includes(this.paths.get('INSTALL')) ||
			finalPath.includes(this.paths.get('APPDATA')) ||
			finalPath.includes(this.paths.get('SYNCHRONY'))
		);
		if(!valid) throw new Error(`Path ${finalPath} is outside of allowed pack-space, access is denied.`)
		return finalPath
	}

	static getFileNameFromURL(url) {

	}

	/**
	 * @type {Map<string,Function>}
	 */
	executors = new Map([
		['//', nullExecute],
		['import', async (args) => {
			const [oldVersion, newVersion] = args
			const importedChanges = this.changeCompiler(oldVersion, newVersion)
			const subParser = new InstallScriptParser(
				(msgType, ...data) => {
					this.callback(msgType, ...data)
					if(msgType === 'SYS-ERROR') {
						throw new Error('Imported changes caused an error to be thrown.')
					}},
				this.paths, importedChanges, this.changeCompiler, this.enviroment)
			this.callback('SYS-INFO', 'PARSER-CONTEXTSWITCH', `Entering subparser for changes imported from the '${oldVersion} -> ${newVersion}' changeset.`)
			await subParser.parseAll()
			this.callback('SYS-INFO', 'PARSER-CONTEXTSWITCH', `Exiting subparser for imported changes.`)
		}],
		['config', nullExecute],
		['set', (args) => {this.enviroment.set(args.splice(0, 1)[0], JSON.parse(args.join(' ')))}],
		['read', (args) => {
			let fileContents = fs.readFileSync(this.evaluateAndSanitizePath(args[1]), 'utf-8')
			const flags = args[2]?.split('')
			while(flags != undefined || flags != null || flags.length > 0) {
				switch(flags.pop()) {
					case 'l':
						fileContents = fileContents.replaceAll('\r\n', '\n')
						break	
					case 'L':
						fileContents = fileContents.replaceAll('\r\n', '\n').split('\n')
						break
					case 's':
						fileContents = fileContents.replaceAll('\\', '/')
					case 'J':
						fileContents = JSON.parse(fileContents)
						break					
				}
			}
			this.enviroment.set(args[0], fileContents)
			return
		}],
		['write', nullExecute],
		['jump', (args) => {
			const [label, condition] = args
			if(true) this.currentLine = this.labels.get(label)
		}],
		['label', (args) => {
			this.labels.set(args[0], this.currentLine + 1)
		}],
		['prompt', (args) => this.callback('PROMPT', ...(args.map(stringArgEvaluate(this.enviroment))))],
		['comment', (args) => this.callback('COMMENT', ...(args.map(stringArgEvaluate(this.enviroment))))],
		['log', (args) => this.callback('LOG', ...(args.map(stringArgEvaluate(this.enviroment))))],
		['debug', (args) => this.callback('DEBUG', ...(args.map(stringArgEvaluate(this.enviroment))))],
		['warn', (args) => this.callback('WARN', ...(args.map(stringArgEvaluate(this.enviroment))))],
		['error', (args) => this.callback('ERROR', ...(args.map(stringArgEvaluate(this.enviroment))))],
		['download', async (args) => {
			const noPath = (args[0] === '$')
			let _, filePath, finalPath, urlString, varName
			if(noPath) {
				[_, varName, urlString] = args
			} else {
				[filePath, urlString] = args
				finalPath = this.evaluateAndSanitizePath(filePath)
			}
			const urls = urlString.split(' ')
			const downloadPath = this.evaluateAndSanitizePath(`$D/${this.currentLine}`)
			const downloadPromise = new Promise((resolve, reject) => {
				const download = new DownloaderHelper(urls[0], this.paths.get('DOWNLOADS'), {
					fileName: `${this.currentLine}`
				})
				download.on('end', () => {
					if(noPath) {
						this.enviroment.set(varName, downloadPath)
					} else {
						fs.renameSync(downloadPath, finalPath)
					}
					resolve()
				});
				download.on('error', (e) => {this.callback('DownloadError', e); reject()});
				download.start();
			})
			await downloadPromise
		}],
		['decompress', async (args) => {
			const [mode, archiveLocation, destination] = args
			let archivePath, destinationPath
			destinationPath = this.evaluateAndSanitizePath(destination)
			if(mode === 'v') {
				archivePath = this.enviroment.get(archiveLocation)
			} else if(mode === 'f') {
				archivePath = this.evaluateAndSanitizePath(archiveLocation)
			} else {
				throw new EvalError(`Invalid decompression mode ${mode}`)
			}
			await decompress(archivePath, destinationPath)
		}],
		['delete', (args) => {
			const filePath = this.evaluateAndSanitizePath(args[0])
			fs.rmSync(filePath)
		}],
		['move', (args) => {
			const [source, destination] = args
			const sourcePath = this.evaluateAndSanitizePath(source)
			const destinationPath = this.evaluateAndSanitizePath(destination)
			fs.renameSync(sourcePath, destinationPath)
		}],
		['splice', nullExecute], // TODO splice and regex operations
		['regex', nullExecute]
	]);

	async parseAll() {
		for(this.currentLine = 0; this.currentLine < this.scriptLength; this.currentLine++) {
			this.callback('SYS-INFO', 'PARSER-STATUS', `Parsing line number ${this.currentLine}`)
			const line = this.script[this.currentLine]
			try {
				await this.parseLine(line)
			} catch(e) {
				this.callback('SYS-ERROR', 'PARSER-ERROR', `Runtime error while parsing line number ${this.currentLine}: '${this.script[this.currentLine]}'. This is unrecoverable and execution will cease.`, e, this.script)
				break
			}
		}
		this.callback('SYS-INFO', 'PARSER-INFO', `Completed parsing ${this.currentLine}/${this.scriptLength} lines of script.`)
	 }

	/**
	 * @returns {boolean}
	 */
	isNext() {
		return this.currentLine < this.scriptLength
	}

	async parseNext() {
		const line = this.script[this.currentLine]
		await this.parseLine(line)
		this.currentLine++
	}

	async parseLine(line) {
		const splitLine = InstallScriptParser.argify(line)
		const cmd = splitLine[0]
		if(!this.executors.has(cmd)) throw new Error(`'${cmd}' is not a valid InstallScript command.`);
		const args = splitLine.slice(1)
		await this.executors.get(cmd)(args)
	}
}

export { InstallScriptParser }