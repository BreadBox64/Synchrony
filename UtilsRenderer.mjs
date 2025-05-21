import './jsdoc.js'

export const delay = millis => new Promise((resolve, reject) => {
	setTimeout(_ => resolve(), millis)
})

export default { delay }