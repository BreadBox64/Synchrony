const {DownloaderHelper} = require('node-downloader-helper');

function downloadFile(url, path, modId) {
	try {
		let dl = new DownloaderHelper(url, path, {fileName: modId});
		dl.on('end', () => {return true});
		dl.on('error', (err) => {throw err});
		dl.start().catch(err => {throw err});
	} catch(e) {
		postMessage(['error', e])
		return false
	}
}

function startExecute(change) {
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
		case '?':
			break
		case '/':
			break
		case '\\':
			break
		case '+':
			break
		case '-':
			break
		case '*':
			break
		case '^':
			break
	}
}

onmessage = (e) => {
  if(e.data[0] == 'start') startExecute(e.data[1])
};