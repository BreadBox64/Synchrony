import './jsdoc.js'
import fs from 'node:fs'
import { app } from 'electron/main'
import path from 'node:path'

export const delay = millis => new Promise((resolve, reject) => {
	setTimeout(_ => resolve(), millis)
})

// TODO path evaluation with tildes etc
export const evaluatePath = basePath => {
	let pathSections = basePath.replaceAll('\\', '/').split('/')
	if(pathSections[0] === '~') {
		pathSections[0] = app.getPath('home')
	}
	return path.join(...pathSections)
}

export const stringToBool = inputString => {
	const lower = inputString.toLowerCase().trim()
	if(lower === 'true') return true;
	if(lower === 'false') return false;
	throw new TypeError('man what even happened here')
}

/**
 * 
 * @param {*} filePath 
 * @returns 
 */
export const readFile = filePath => {
	const lines = fs.readFileSync(filePath, 'utf-8').replace(/\r\n/g,'\n').trim().split('\n')
	return lines
}

export default { delay, readFile, evaluatePath, stringToBool }