import './jsdoc.js'
import { log, error } from 'node:console';
import { spawnSync } from 'node:child_process';
import Xvfb from 'xvfb';
import { createInterface } from 'node:readline';
log('we made it to A')
import Core from './core.mjs'

let wrapup = () => {}

switch(process.platform) {
	case 'win32': // If somebody has experience with virtual displays on windows, please comment / contribute, idk what to do for text-only (i.e. ssh) connections into windows machines
		log('womp womp')
		break
	case 'linux':
	default: // Made for Linux to enable use over ssh, might still work on BSD or other unix based, but not supported
		const xvfb = new Xvfb()
		xvfb.startSync()
		wrapup = () => {xvfb.stopSync()}
}

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

Core.initialize(log)

const helpText = `All Commands:
	$Minstall $y<mode> <data> <flags...>
		<mode> | 'dir', 'file', or 'url'
		<data> | path / url to relevant data
	-- $mi
	-- $madd-pack

	$Mremove $y<pack id> <flags...>
	-- $mr
	-- $mremove-pack

	$Mupdate $y<pack id>
	-- $mu

	$Mupdate-all
	-- $mua

	$Mquery $y<pack id>
	-- $mq
	-- $mcheck

	$Mquery-all 
	-- $mqa
	-- $mcheck-all

	$Medit-config
	-- $mc
	-- $mconfigure

	$Medit-pack $y<pack id>
	-- $me
	-- $medit

	$Mpacks
	-- $mlist
	-- $mls

	$Mread $y<pack id>

	$Mout-version $y<pack id>

	$Mout-changelist $y<pack id>

	$Mecho $y<text...>

	$Mhelp

	$Mexit
	-- $mstop
	-- $mquit`.replaceAll('$M', '\x1b[0;95;1m').replaceAll('$m', '\x1b[0;35m').replaceAll('$y', '\x1b[0;33m').replaceAll('\n', '\x1b[0m\n')

function updateResponseHandler(msgType, content) {

}

function recursivePrompt() {
  rl.question('\x1b[36;1mSynchronyCLI > \x1b[0m', async input => {
		const splitInput = input.split(' ')
		try {
			switch(splitInput[0].toLowerCase()) {
				case 'install':
				case 'i':
				case 'add-pack': {
					const method = splitInput[1]
					if(method === 'dir') {

					} else if(method === 'file') {

					} else if(method === 'url') {

					} else if(method === 'debug') {
						const newId = splitInput[2]
						let idTaken = false
						for(const id of Object.keys(Core.getPackConfigs())) {
							idTaken = idTaken || (id == newId)
						}

						if(idTaken) {
							log(`\x1b[31mModpack id ${newId} is already taken.\x1b[0m`)
						} else {
							Core.createPackConfig({id: newId}, splitInput[3])
							log(`New modpack created, edit using 'e ${newId}`)
						}
					} else {
						log(`\x1b[31mNot a valid pack addition method.\x1b[0m`)
						break
					}
					const packPath = ''
					Core.getConfig.packConfigs += packPath
					break
				}
				case 'remove':
				case 'r':
				case 'remove-pack': {
					break
				}
				case 'update':
				case 'u': {
					await Core.updateModpack(splitInput[1], updateResponseHandler)
					break
				}
				case 'update-all':
				case 'ua': {
					for(const id of Object.keys(Core.getPackConfigs())) {
						try {
							const response = await Core.isPackUpdateNeeded(id)
							if(!response) continue
							await Core.updateModpack(id, updateResponseHandler)
						} catch(e) {
							log(`\x1b[31mFailed to fetch version info for ${id}, skipping...\x1b[0m`)
						}
					}
					break
				}
				case 'query':
				case 'q':
				case 'check': {
					const response = await Core.isPackUpdateNeeded(splitInput[1])
					log(`${splitInput[1]} : \x1b[${(response)? 32 : 31}m${response}\x1b[0m`)
					break
				}
				case 'query-all':
				case 'qa':
				case 'check-all': {
					for(const id of Object.keys(Core.getPackConfigs())) {
						let response
						try {
							response = await Core.isPackUpdateNeeded(id)
						} catch(e) {

						}
						log(`${id} : \x1b[${(response)? 32 : 31}m${response}\x1b[0m`)
					}
					break
				}
				case 'edit-config':
				case 'c':
				case 'configure': {
					spawnSync('editor', [Core.configPath], {
						stdio: 'inherit' // Attach stdio so the editor works interactively
					})
					Core.setConfig(error)
					break
				}
				case 'edit-pack':
				case 'e':
				case 'edit': {
					const packPath = Core.getPackConfigs()[splitInput[1]].path
					spawnSync('editor', [packPath], {
						stdio: 'inherit' // Attach stdio so the editor works interactively
					})
					Core.setPackConfig(splitInput[1], packPath, error)
					break
				}
				case 'packs':
				case 'list':
				case 'ls': {
					if(splitInput.includes('v')) {
						log(Core.getPackConfigs())
					} else {
						log(Object.keys(Core.getPackConfigs()))
					}
					break
				}
				case 'read': {
					log(Core.getPackConfigs()[splitInput[1]])
					break
				}
				case 'out-version': {
					log(await Core.getRawVersion(splitInput[1]))
					break
				}
				case 'out-changelist': {
					log('\x1b[31;1mNotImplemented\x1b[0m')
					break
				}
				case 'echo': {
					log(splitInput[1])
					break
				}
				case 'help': {
					log(helpText)
					break
				}
				case 'exit':
				case 'stop':
				case 'quit': {
					rl.close()
					Core.saveAndExit()
					wrapup()
					return
				}
				default: {
					log("Not a recognized command.")
				}
			}
		} catch(e) {
			error(e)
		}
    recursivePrompt()
  })
}

log('headlessIntercace.cjs completed initalization, prompt timeout set at 100ms...')
setTimeout(() => {recursivePrompt()}, 100)
//for(const [_id, packConfig] of Object.entries(packConfigs)) await checkForUpdates(packConfig);