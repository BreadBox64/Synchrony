const {log, debug, error, warn, path} = global.moduleExport; 
const { Core } = require('./core.mjs')
const { BrowserWindow, dialog, ipcMain, nativeTheme } = require('electron/main');
const { delay } = require('./Utils.mjs')
require('./jsdoc.js')

const app = global.app
let win;

async function checkForUpdates(id) {
	try {
		const updateNeeded = await Core.isPackUpdateNeeded(id)
		win.webContents.send('Update:Response', id, updateNeeded, Core.getPackConfigs()[id])
	} catch(e) {
		win.webContents.send('Error:VersionDownload', id, e)
		error(e)
	}
}

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1080,
    height: 720,
		webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegrationInWorker: true
    },
    show: false,
    autoHideMenuBar: true,
    title: "Synchrony",
    icon: './resources/icon/icon64.png'
  })

  win.setMinimumSize(800, 600)
  win.loadFile('index.html')

  win.once('ready-to-show', async () => {
    Core.initialize((msg, data) => {
			log(msg)
			switch(msg) {
				case 'LOAD-CONFIG-SUCCEED':
					win.webContents.send('App:ConfigRead', Core.getConfig())
					break
				case 'LOAD-PACKCONFIG-SUCCEED':
					win.webContents.send('Pack:ConfigsRead', Core.getPackConfigs())
					break
				case 'LOAD-CONFIG-FAIL':
				case 'LOAD-PACKCONFIG-FAIL':
					error('Unrecoverable error encountered, application stopping...')
					error(data)
			}
		})

    for(const id of Object.keys(Core.getPackConfigs())) {
			checkForUpdates(id)
		}

    setTimeout(() => {win.show()}, 10)
    
		if(Core.isSynchronyUpdateNeeded()) {
			const updateInfo = (process.platform === 'win32') ? `
				<br>
				Since you are running a Windows build of Synchrony, automatic updates are included. 
				<br>
				<br>
				Synchrony is currently downloading the update and will restart once complete. Please wait.
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
			win.webContents.send('Prompt:Display', null, [`
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
		}
  })
  return win
}

app.setAppLogsPath()
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

  ipcMain.handle('Update:Start', async (_event, modpackId) => Core.updateModpack(modpackId, (msg, data) => {
		console.log(msg)
		switch(msg) {
			case 'UPDATE-CHANGELISTGET-EMPTYCHANGELIST':
				win.webContents.send('Error:ChangelistDownload', modpackId, msg)
		}
	}))
})

app.on('window-all-closed', () => {Core.saveAndExit()})