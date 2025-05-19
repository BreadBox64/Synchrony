import './jsdoc.js'
import fs from 'node:fs'

export const delay = millis => new Promise((resolve, reject) => {
	setTimeout(_ => resolve(), millis)
})

// TODO path evaluation with tildes etc

/**
 * 
 * @param {*} filePath 
 * @returns 
 */
export const readFile = filePath => {
	const lines = fs.readFileSync(filePath, 'utf-8').replace(/\r\n/g,'\n').trim().split('\n')
	return lines
}

export default { delay, readFile }