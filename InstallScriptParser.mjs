import { DownloaderHelper } from 'node-downloader-helper'
import path from 'node:path'

const nullExecute = () => {}

class InstallScriptParser {
	/**
	 * @param {Function} callback 
	 * @param {Map<string, string>} paths
	 * @param {string[]} script 
	 * @param {Object<string,any>} initialVariables 
	 */
	constructor(callback, paths, script, initialVariables = {}) {
		this.callback = callback
		this.paths = paths
		this.currentLine = 0
		this.script = script
		this.scriptLength = script.length
		this.enviroment = initialVariables
		this.downloadQueue = []
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

	evaluateAndSanitizePath(filePath) {
		/**
		 * @type {string[]}
		 */
		let pathSections = filePath.replaceAll('\\', '/').split('/')
		const finalPath = path.join(
			pathSections.filter(section => {
				return section != '..'
			}).map(section => {
				switch(section) {
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
					default:
						return section
				}
			})
		)
		return finalPath
	}

	static getFileNameFromURL(url) {

	}

	/**
	 * @type {Map<string,Function>}
	 */
	executors = new Map([
		['import', nullExecute],
		['config', nullExecute],
		['set', nullExecute],
		['read', nullExecute],
		['write', nullExecute],
		['jump', nullExecute],
		['prompt', nullExecute],
		['comment', (args) => {}],
		['log', (args) => {this.callback('LOG', ...args)}],
		['debug', (args) => {this.callback('DEBUG', ...args)}],
		['warn', (args) => {this.callback('WARN', ...args)}],
		['error', (args) => {this.callback('ERROR', ...args)}],
		['download', (args) => {
			const [filePath, urlString] = args
			const urls = urlString.split(' ')
			const download = new DownloaderHelper(urls[0], this.evaluateAndSanitizePath(`$D/${this.currentLine}`))
			this.downloadQueue.push(this.currentLine)
			
			download.on('end', () => {
				fs.copyFileSync(this.evaluateAndSanitizePath(`$D/${this.currentLine}/${getFileNameFromURL(urls[0])}`), this.evaluateAndSanitizePath(filePath))
				const i = this.downloadQueue.indexOf(this.currentLine)
				this.downloadQueue.splice(i, 1)
			});
			download.on('error', (e) => this.callback('DownloadError', e));
			download.start().catch(e => this.callback('DownloadError', e));
		}],
		['decompress', nullExecute],
		['delete', nullExecute],
		['move', nullExecute],
		['splice', nullExecute],
		['regex', nullExecute]
	]);

	parseAll() {
		for(const line of this.script) {
			this.callback('SYS-INFO', 'INSTALLSCRIPTPARSER', `Parsing line number ${this.currentLine}`)
			try {
				this.parseLine(line)
			} catch(e) {
				this.callback('SYS-ERROR', 'INSTALLSCRIPTPARSER', `Runtime error while parsing line number ${this.currentLine}: ${this.line}. This is unrecoverable and execution will cease.`, e, this.script)
				break
			}
			this.currentLine++
		}
	 }

	/**
	 * @returns {boolean}
	 */
	isNext() {
		return this.currentLine < this.scriptLength
	}

	parseNext() {
		const line = this.script[this.currentLine]
		this.parseLine(line)
		this.currentLine++
	}

	parseLine(line) {
		const splitLine = InstallScriptParser.argify(line)
		const cmd = splitLine[0]
		if(!this.executors.has(cmd)) throw new TypeError(`${cmd} is not a valid InstallScript command`);
		const args = splitLine.slice(1)
		this.executors.get(cmd)(args)
	}
}

export { InstallScriptParser }