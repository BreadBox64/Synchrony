const {log, debug, error, warn} = global.moduleExport; 
const { spawnSync } = require('node:child_process');
const { Core } = require('./core.mjs');
require('./jsdoc.js');

const { createInterface } = require('node:readline');
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

Core.initialize(log)

function recursivePrompt() {
  rl.question('SynchronyCLI > ', async input => {
		const splitInput = input.split(' ')
		try {
			switch(splitInput[0].toLowerCase()) {
				case 'echo':
					log(splitInput[1])
					break
				case 'help':
					log(`All Commands:
	edit-config
	edit-pack <pack id>
	packs
	-- list
	-- ls
	out-version
	out-changelist
	update <pack id>
	-- u
	update-all
	-- ua
	query <pack id>
	-- check
	-- cfu
	query-all 
	-- check-all
	-- cfau`)
					break
				case 'out-version':
					log(await Core.getRawVersion(splitInput[1]))
					break
				case 'edit-config':
					spawnSync('editor', [Core.configPath], {
						stdio: 'inherit' // Attach stdio so the editor works interactively
					})
					Core.setConfig(error)
					break
				case 'edit-pack':
					const packPath = Core.getPackConfigs()[splitInput[1]].path
					spawnSync('editor', [packPath], {
						stdio: 'inherit' // Attach stdio so the editor works interactively
					})
					Core.setPackConfig(splitInput[1], packPath, error)
					break
				case 'read':
					log(Core.getPackConfigs()[splitInput[1]])
					break
				case 'packs':
				case 'list':
				case 'ls':
					log(Core.getPackConfigs())
					break
				case 'update':
				case 'u':
					
					break
				case 'update-all':
				case 'ua':
					for(const id of Object.keys(Core.getPackConfigs())) {
						try {
							const response = await Core.isPackUpdateNeeded(id)
							if(!response) continue
							log(id)
						} catch(e) {
							error(`\x1b[31mFailed to fetch version info for ${id}\x1b[0m`)
						}
					}
					break
				case 'query':
				case 'check':
				case 'cfu':
					const response = await Core.isPackUpdateNeeded(splitInput[1])
					log(`${splitInput[1]} : \x1b[${(response)? 32 : 31}m${response}\x1b[0m`)
					break
				case 'query-all':
				case 'check-all':
				case 'cfau':
					for(const id of Object.keys(Core.getPackConfigs())) {
						let response
						try {
							response = await Core.isPackUpdateNeeded(id)
						} catch(e) {

						}
						log(`${id} : \x1b[${(response)? 32 : 31}m${response}\x1b[0m`)
					}
					break
				case 'exit':
				case 'stop':
				case 'quit':
					rl.close()
					Core.saveAndExit()
					return
				default:
					log("Not a recognized command.")
			}
		} catch(e) {
			error(e)
		}
    recursivePrompt()
  })
}

recursivePrompt()
//for(const [_id, packConfig] of Object.entries(packConfigs)) await checkForUpdates(packConfig);