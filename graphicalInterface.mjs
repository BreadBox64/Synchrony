import Core from './core.mjs'
import { log, debug, warn, error} from 'console'
import path from 'path'
import { BrowserWindow, dialog, ipcMain, nativeTheme, app } from 'electron/main'
import Utils from './UtilsServer.mjs'
import { updateElectronApp } from 'update-electron-app'
import './jsdoc.js'
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let win;

async function checkForUpdates(id) {
	let response
	try {
		response = await Core.isPackUpdateNeeded(id)
		win.webContents.send('Update:Response', id, response, Core.getPackConfigs()[id])
	} catch(e) {
		win.webContents.send('Error:VersionDownload', id, e)
		error(`\x1b[31;1mSYS-ERROR\x1b[0;90m : CHECKFORUPDATES\x1b[0m`)
	}
	log(`${id} : \x1b[${(response)? 32 : 31}m${response}\x1b[0m`)
}

const createWindow = () => {
	const preloadPath = path.join(__dirname, 'preload.mjs')
	log(preloadPath)
  const win = new BrowserWindow({
    width: 1080,
    height: 720,
		webPreferences: {
      preload: preloadPath,
      nodeIntegrationInWorker: true
    },
    show: false,
    autoHideMenuBar: true,
    title: "Synchrony",
    icon: './resources/icon/icon64.png'
  })

  win.setMinimumSize(928, 600)
  win.loadFile('index.html')

  win.once('ready-to-show', async () => {
    Core.initialize((msg, ...data) => {
			log(msg)
			switch(msg) {
				case 'LOAD-CONFIG-SUCCEED':
					win.webContents.send('App:ConfigRead', Core.getConfig())
					break
				case 'LOAD-PACKCONFIG-SUCCEED':
					win.webContents.send('App:PackConfigsRead', Core.getPackConfigs())
					break
				case 'LOAD-CONFIG-FAIL':
				case 'LOAD-PACKCONFIG-FAIL':
					win.webContents.send('Error:ConfigRead', data)
					error(`\x1b[31;1mSYS-ERROR\x1b[0;90m : ${msg}\x1b[0m`, data)
					break
			}
		})

    for(const id of Object.keys(Core.getPackConfigs())) {
			checkForUpdates(id)
		}

    setTimeout(() => {win.show()}, 10)
		
		Core.isSynchronyUpdateNeeded().then(async result => {
			if(!result) return
			const updateInfo = (process.platform === 'win32') ? `
				<br>
				Since you are running a Windows build of Synchrony, automatic updates are included. 
				<br>
				<br>
				Once this notice is closed, Synchrony will automatically download the update and then prompt you to restart the application.
				<br>
				<a target="_blank" href="https://github.com/BreadBox64/Synchrony/blob/master/readme.md#Updates">This link also has more info on Synchrony updates.</a>
				<br>
				` : `
				<br>
				Since you are running a [${process.platform.toUpperCase()}] build of Synchrony, automatic updates are unavailable. If you are using Debian-based Linux, you can directly install from the packaged binary on the Github Release.
				<br>
				<br>
				<a target="_blank" href="https://github.com/BreadBox64/Synchrony/blob/master/readme.md#Updates">Please follow this link for more info on updating to the latest version.</a>
				<br>
				<br>
				<a target="_blank" href="https://github.com/BreadBox64/Synchrony/releases/latest">Here is a direct link to the latest release.</a></h2>
				`
			const respond = (process.platform === 'win32') ? () => {updateElectronApp({
				updateInterval: '1 hour',
				logger: (...data) => log(`\x1b[1mSYS-INFO\x1b[0;90m : UPDATEELECTRONAPP\x1b[0m`, ...data)
			})} : null
			win.webContents.send('Prompt:Display', respond, [`
				<div class="vflex hcenter">
					<h1 class="josefin-sans hcenter">Synchrony Update Available</h1>
					<br>
					<h2 class="josefin-sans hcenter">Synchrony ${Core.getConfig().synchronyVersion} is out of date; the latest version is now ${await Core.latestSynchronyString()}.
					<br>
					${updateInfo}
					<div class="hflex hcenter" style="height:96px;width: min-content;">
						<button id="promptSubmit" class="" style="width:192px;">
							<h2 class="josefin-sans">Ok</h2>
						</button>
					</div>
					<p id=promptCancel></p>
				</div>
			`])
		})
  })
  return win
}

app.whenReady().then(() => {
  win = createWindow()
  nativeTheme.addListener('updated', () => {
    win.webContents.send('App:NativeThemeChange', nativeTheme.shouldUseDarkColors)
  })
  ipcMain.handle('App:ThemeChange', (_event, newTheme) => {
    nativeTheme.themeSource = newTheme
    Core.getConfig().themeBrightness = newTheme
    return nativeTheme.shouldUseDarkColors
  })
  ipcMain.handle('App:AddPack', (_event, addMethod, packArguments) => addModpack(addMethod, packArguments))
  ipcMain.handle('Update:CheckAll', async () => {
		for(const id of Object.keys(Core.getPackConfigs)) {
			await checkForUpdates(id)
		} 
  })
  ipcMain.handle('Update:Check', (_event, modpackId) => checkForUpdates(modpackId))

  ipcMain.handle('Update:Start', async (_event, modpackId) => {
		try {
			let parseContextLevel = 0
			Core.updatePack(modpackId, (msgType, ...data) => {
				switch(msgType) {
					case 'SYS-INFO': {
						const infoType = data.splice(0, 1)[0]
						log(`\x1b[1mSYS-INFO\x1b[0;90m : ${infoType}\x1b[0m`, data)
						switch(infoType) {
							case 'PARSER-STATUS': {
								if(parseContextLevel == 0) {
									const percent = (data[0] / data[1]) * 90 + 10
									win.webContents.send('Update:Percent', modpackId, percent)
								}
								break
							}
							case 'PARSER-CONTEXTENTER': {
								parseContextLevel++
								break
							}
							case 'PARSER-CONTEXTEXIT': {
								parseContextLevel--
								break
							}
							case 'PARSER-COMPLETE': {
								win.webContents.send('Update:Percent', modpackId, 100)
								setTimeout(() => {
									win.webContents.send('Update:Complete', modpackId, Core.getPackConfigs()[modpackId])
								}, 100)
								break
							}
							case 'CHANGELISTGET-SUCCEED' : {
								win.webContents.send('Update:Percent', modpackId, 5)
								break
							}
							case 'CHANGECOMPILE-SUCCEED' : {
								win.webContents.send('Update:Percent', modpackId, 10)
								break
							}
						}
						break
					}
					case 'SYS-ERROR': {
						const errorType = data.splice(0, 1)[0]
						warn(`\x1b[31;1mSYS-ERROR\x1b[0;90m : ${errorType}\x1b[0m`, data)
						switch(errorType) {
							case 'CHANGELISTGET-EMPTYCHANGELIST': {
								win.webContents.send('Error:ChangelistDownload', modpackId, data)
							}
						}
						break
					}
					case 'LOG' : {
						data.forEach(d => log(`\x1b[1;34mLOG\x1b[0m ${d}`))
						break
					}
					case 'DEBUG' : {
						data.forEach(d => debug(`\x1b[1;35mDEBUG\x1b[0m ${d}`))
						break
					}
					case 'WARN' : {
						data.forEach(d => warn(`\x1b[1;33mWARN\x1b[0m ${d}`))
						break
					}
					case 'ERROR' : {
						data.forEach(d => error(`\x1b[1;31mERROR\x1b[0m ${d}`))
						break
					}
					default : {
						warn(`Unknown msgType ${msgType}, data follows:`)
						log(data)
					}
				}
			})
		} catch (e) {
			win.webContents.send('Update:Failed', modpackId, e)
		}
	})
})

app.on('window-all-closed', () => {Core.saveAndExit()})