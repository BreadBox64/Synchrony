const {log, debug, error} = require('node:console'); 
const { randomInt } = require('node:crypto');
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')

const { app, BrowserWindow, dialog, ipcMain, nativeTheme } = require('electron/main');
const { DownloaderHelper } = require('node-downloader-helper');

global.moduleExport = {
  log,
  debug,
  error,
  fs,
  fsp,
  path,
  app,
  dialog
}

const {loadConfig, saveConfig, loadPackConfig, loadPackConfigs, savePackConfig, newPackConfig} = require("./config.js")
const {delay} = require("./utils.js");
const { pid } = require('node:process');

function handleSquirrelEvent() {
  if (process.platform !== 'win32') {
    return false;
  }
  if (process.argv.length === 1) {
    return false;
  }

  const ChildProcess = require('child_process');

  const appFolder = path.resolve(process.execPath, '..');
  const rootAtomFolder = path.resolve(appFolder, '..');
  const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'));
  const exeName = path.basename(process.execPath);

  const spawn = function(command, args) {
    let spawnedProcess, error;

    try {
      spawnedProcess = ChildProcess.spawn(command, args, {detached: true});
    } catch (error) {}

    return spawnedProcess;
  };

  const spawnUpdate = function(args) {
    return spawn(updateDotExe, args);
  };

  const squirrelEvent = process.argv[1];
  switch (squirrelEvent) {
    case '--squirrel-install':
    case '--squirrel-updated':
      // Optionally do things such as:
      // - Add your .exe to the PATH
      // - Write to the registry for things like file associations and
      //   explorer context menus

      // TODO - Actually handle config setup etc. with installer
      // Install desktop and start menu shortcuts
      spawnUpdate(['--createShortcut', exeName]);

      setTimeout(app.quit, 1000);
      return true;

    case '--squirrel-uninstall':
      // Undo anything you did in the --squirrel-install and
      // --squirrel-updated handlers

      // Remove desktop and start menu shortcuts
      spawnUpdate(['--removeShortcut', exeName]);

      setTimeout(app.quit, 1000);
      return true;

    case '--squirrel-obsolete':
      // This is called on the outgoing version of your app before
      // we update to the new version - it's the opposite of
      // --squirrel-updated

      app.quit();
      return true;
  }
};

if (handleSquirrelEvent()) {
  // squirrel event handled and app will exit in 1000ms, so don't do anything else
  return;
}

const configPath = path.join(app.getPath('userData'), 'synchronyConfig')
const sessionPath = app.getPath('sessionData')
let modpackPath = path.join(app.getPath('documents'), 'synchrony-modpack') // ============================================
let config = {}
let packConfigs = {}
const versionRegex = /(\d+)\.(\d+)\.(\d+)(?:-([b|n])(\d+))?/;
let win;

function compileChanges() {
  // TODO
}

async function updateModpack() {
  let errorCond = false
  let upstreamChangelistFile
  let changeDesc, changes

  try {
    let dl = new DownloaderHelper(packConfig.upstreamVersion, sessionPath, {
      fileName: 'upstreamChangelist',
      override: true,
      retry: {maxRetries: 5, delay: 1000}
    });
    dl.on('end', () => {
      debug("Downloaded changelist file.")
      try {
        upstreamChangelistFile = fs.readFileSync(path.join(sessionPath, 'upstreamChangelist'), 'utf8').split('\n');
      } catch(e) {error(e); errorCond = true}
    });
    dl.on('error', (e) => {error(e); errorCond = true});
    dl.start().catch(() => {error(e); errorCond = true});
  } catch(e) {error(e); errorCond = true}
  if(errorCond) {
    win.webContents.send('Error:ChangelistDownload', e)
    return
  }

  try {
    [changeDesc, changes] = compileChanges(upstreamChangelistFile)
  } catch(e) {error(e); errorCond = true; win.webContents.send('Error:ChangelistCompile', e)}

  let workers = []
  let activeWorkers = 0
  for(let i = min(config.maxWorkers, changes.length); i > 0; i--) {
    let worker = new Worker('changeWorker.js', {name: `ChangeWorker${i}`})
    activeWorkers += 1
    worker.onmessage = (msg) => {
      switch(msg[0]) {
        case 'log':
          log(msg[2])
          break
        case 'fatal':
          errorCond = true
        case 'error':
          error(msg[2])
          break
        case 'term':
          worker.terminate()
          break
        case 'complete':
          if(changes.length <= 0) {
            worker.terminate()
            activeWorkers -= 1
          } else {
            worker.postMessage(['start', changes.pop()])
          }
      }
    }
    worker.postMessage(['start', changes.pop()])
    workers.push(worker)
  }

  await new Promise(resolve => {if((activeWorkers === 0 && changes.length === 0) || errorCond) {resolve()}})
  
  if(errorCond) {
    workers.forEach(worker => worker.terminate())
    win.webContents.send('Update:Failed', true)
  } else {
    win.webContents.send('Update:Complete', true)
  }
}

function readVersionData(inputStr) {
  let versionIter = inputStr.match(versionRegex)
  let out = {}

  if(versionIter[5] != null) {
    out = {
      str: inputStr,
      major: parseInt(versionIter[1]),
      minor: parseInt(versionIter[2]),
      patch: parseInt(versionIter[3]),
      flag:  versionIter[4],
      flagv: parseInt(versionIter[5]),
    }
  } else {
    out = {
      str: inputStr,
      major: parseInt(versionIter[1]),
      minor: parseInt(versionIter[2]),
      patch: parseInt(versionIter[3]),
    }
  }

  return out
}

const updateDownloadErrorHandler = (p, e) => {return () => {win.webContents.send('Error:VersionDownload', p, e); error(e)}}
function checkForUpdates(packConfig) {
  let updateNeeded = false
  let versionData = {}

  try {
  let dl = new DownloaderHelper(packConfig.upstreamVersionURL, sessionPath, {
    fileName: `${packConfig.id}:upstreamVersion`,
    override: true,
    retry: {maxRetries: 5, delay: 1000}
  });
  dl.on('end', () => {
    debug("Downloaded versioning file.")
    try {
      let upstreamVersionFile = fs.readFileSync(path.join(sessionPath, `${packConfig.id}:upstreamVersion`), 'utf8').split('\n');

      for(let i = 0; i < upstreamVersionFile.length; i++) {
        if(upstreamVersionFile[i] === packConfig.localBranch) {
          packConfig.upstreamVersion = upstreamVersionFile[i+1]
        }
      }

      let lv = readVersionData(packConfig.localVersion)
      let uv = readVersionData(packConfig.upstreamVersion)
      if(lv.major >= uv.major) {
        if(lv.minor >= uv.minor) {
          if(lv.patch >= uv.patch) {
            if(lv.flag && lv.flagv < uv.flagv) updateNeeded = true
          } else {updateNeeded = true}
        } else {updateNeeded = true}
      } else {updateNeeded = true}

      win.webContents.send('Update:Response', packConfig.id, updateNeeded, {upstream: uv, local: lv})
    } catch(e) {
      win.webContents.send('Error:VersionRead', packConfig.id, e)
      error(e)
    }
  });
  dl.on('error', updateDownloadErrorHandler(packConfig.id, "Internal Error"));
  dl.start().catch(updateDownloadErrorHandler(packConfig.id, "Internal Error"));
  } catch(e) {updateDownloadErrorHandler(packConfig.id, e)}
  return updateNeeded
}

function addModpack(addMethod, arguments) {
  dialog.showOpenDialogSync({
    title: "Select the existing modpack folder",
    properties: ['openDirectory']
  })

  return [false, null]
}

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1080,
    height: 720,
		webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegrationInWorker: true
    },
    show: false,
    autoHideMenuBar: true,
    title: "Synchrony",
  })

  win.setMinimumSize(800, 600)
  win.loadFile('index.html')

  win.once('ready-to-show', () => {
    const [configSuccess, configData] = loadConfig(configPath, config)
    if(configSuccess) config = configData; else return
    win.webContents.send('App:ConfigRead', config)

    const [packSuccess, packData] = loadPackConfigs(config.packConfigs)
    if(packSuccess) packConfigs = packData; else return
    win.webContents.send('Pack:ConfigsRead', packConfigs)
  
    setTimeout(() => {win.show()}, 10)
  })
  return win
}

app.setAppLogsPath()
app.whenReady().then(() => {
  win = createWindow()
  ipcMain.handle('App:ThemeChange', (_event, newTheme) => {
    nativeTheme.themeSource = newTheme
    config.theme = newTheme
    return nativeTheme.shouldUseDarkColors
  })
  ipcMain.handle('App:AddPack', (_event, addMethod, arguments) => addModpack(addMethod, arguments))
  ipcMain.handle('Update:CheckAll', () => {
    
  })
  ipcMain.handle('Update:Check', (_event, modpackId) => checkForUpdates(packConfigs[modpackId]))

  ipcMain.handle('Update:Start', async (_event, modpackId) => {
    log(`modpackId: ${modpackId}`)
    for(let i = 0; i <= 100; i++) {
      win.webContents.send('Update:Percent', modpackId, i)
      await delay(50)
    }
    win.webContents.send('Update:Complete', modpackId, true)
  })
})

app.on('window-all-closed', () => {
  saveConfig(configPath, config)
  
  app.quit()
})