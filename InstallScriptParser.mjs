import { DownloaderHelper } from 'node-downloader-helper'

class InstallScriptParser {
	/**
	 * @param {Function} callback 
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

	/**
	 * @type {Map<string,Function>}
	 */
	executionMap = {
		import: nullExecute,
		config: nullExecute,
		set: nullExecute,
		read: nullExecute,
		write: nullExecute,
		jump: nullExecute,
		prompt: nullExecute,
		comment: (args) => {},
		log: (args) => {args.forEach(arg => {callback('log', arg)});},
		warn: (args) => {args.forEach(arg => {callback('warn', arg)});},
		error: (args) => {args.forEach(arg => {callback('error', arg)});},
		download: nullExecute,
		decompress: nullExecute,
		delete: nullExecute,
		move: nullExecute,
		splice: nullExecute,
		regex: nullExecute
	};

	parseAll() {
		for(const line of this.script) {
			this.parseLine(line)
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
		const splitLine = argify(line)
		const cmd = splitLine[0]
		const args = splitLine.slice(1)
		
		this.executionMap[cmd](args)
	}

	static argify(line) {
		let args = []
		let currentArg = ''
		let insideString = false

		for(const i = 0; i < change.length; i++) {
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
	}

	evaluateAndSanitizePath(filePath) {
		let pathSections = filePath.split('/')
		pathSections = pathSections.filter((section => {

		}))
	}

	static getFileNameFromURL(url) {

	}

	//

	nullExecute() {}

	downloadExecute(args) {
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
	}
}

export { InstallScriptParser }