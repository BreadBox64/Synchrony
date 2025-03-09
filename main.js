const { app, BrowserWindow, dialog, ipcMain } = require('electron/main');
const { log, debug, error } = require('node:console');
const { randomInt } = require('node:crypto');
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const { DownloaderHelper } = require('node-downloader-helper');
const { errorMonitor } = require('node:events');
const SynchronyVersion = '1.0.0'

const delay = millis => new Promise((resolve, reject) => {
  setTimeout(_ => resolve(), millis)
})
const configPath = path.join(app.getPath('userData'), 'synchronyConfig')
const sessionPath = app.getPath('sessionData')
let modpackPath = path.join(app.getPath('documents'), 'synchrony-modpack') // ============================================
let versionData = {
  current: {},
  upstream: {}
}
let config = {
  defaultPack: 0,
  packConfigs: ['/home/breadbox64/Documents/synchrony-modpack/modpackConfig'],
  maxWorkers: 5
}
let packConfig = {}
const versionRegex = /(\d+)\.(\d+)\.(\d+)(?:-([b|n])(\d+))?/;
let win;

try {
  if(require('electron-squirrel-startup')) app.quit();
} catch(e) {
  debug("electron-squirrel-startup not found, this is expected.")
}

async function loadPackConfig(path) {
  let newPackConfig = {}
  let configString
  try {
    configString = await fsp.readFile(path, 'utf-8')
  } catch(e) {
    error(e)
    return
  }

  configString.split('\n').forEach((line) => {
    const [param, value] = line.split(' => ')
    newPackConfig[param] = value
  })

  packConfig = newPackConfig
}

async function savePackConfig(path) {
  
}

async function loadConfig() {
  let newConfig = {}
  let configString
  try {
    configString = await fsp.readFile(configPath, 'utf-8')
  } catch(e) {
    error(e)
    return false
  }

  try {
    const getParser = (p) => {
      switch(p) {
        case 'defaultPack':
          return parseInt
        case 'packConfigs':
          return (v) => {
            return v.split(' ||| ')
          }
        default:
          return (v) => {return v}
      }
    }
    configString.split('\n').forEach((line) => {
      const [param, value] = line.split(' => ')
      newConfig[param] = (getParser(param))(value)
    })
    config = newConfig
    loadPackConfig(config.packConfigs[config.defaultPack])
    return true
  } catch(e) {
    error(e)
    return false
  }
}

function saveConfig() {
  const configString = [
    `synchronyVersion => ${SynchronyVersion}`,
    `defaultPack => ${config.defaultPack.toString()}`,
    `packConfigs => ${config.packConfigs.join(' ||| ')}`
  ].join('\n')

  fs.writeFileSync(configPath, configString, {override: true})
}

async function handleFileOpen() {
  const { canceled, filePaths } = await dialog.showOpenDialog({})
  if (!canceled) {
    return filePaths[0]
  }
}

function compileChanges() {

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

const updateDownloadErrorHandler = (e) => {win.webContents.send('Error:VersionDownload', e); error(e)}
function checkForUpdates() {
  log(config)
  log(packConfig)
  let updateNeeded = false

  try {
  let dl = new DownloaderHelper(packConfig.upstreamVersion, sessionPath, {
    fileName: 'upstreamVersion',
    override: true,
    retry: {maxRetries: 5, delay: 1000}
  });
  dl.on('end', () => {
    debug("Downloaded versioning file.")
    try {
      let upstreamVersionFile = fs.readFileSync(path.join(sessionPath, 'upstreamVersion'), 'utf8').split('\n');
      
      versionData.current = readVersionData(packConfig.localVersion)
      
      for(let i = 7; i < upstreamVersionFile.length; i++) {
        if(upstreamVersionFile[i] == packConfig.localVersion) {
          versionData.upstream = readVersionData(upstreamVersionFile[i])
          win.webContents.send('Update:Response', true, versionData)
          return true
        }
      }

      if(versionData.current.flag) {
        if(versionData.current.flag == 'n') {
          versionData.upstream = readVersionData(upstreamVersionFile[1])
        } else if(versionData.current.flag == 'b') {
          versionData.upstream = readVersionData(upstreamVersionFile[3])
        } else {
          win.webContents.send('Error:VersionRead', "Invalid Version Flag")
        }
      } else {
        versionData.upstream = readVersionData(upstreamVersionFile[5])
      }

      let cv = versionData.current
      let uv = versionData.upstream
      if(cv.major >= uv.major) {
        if(cv.minor >= uv.minor) {
          if(cv.patch >= uv.patch) {
            if(cv.flag && cv.flagv < uv.flagv) updateNeeded = true
          } else {updateNeeded = true}
        } else {updateNeeded = true}
      } else {updateNeeded = true}

      win.webContents.send('Update:Response', updateNeeded, versionData)
    } catch(e) {
      win.webContents.send('Error:VersionRead', e)
      error(e)
    }
  });
  dl.on('error', updateDownloadErrorHandler);
  dl.start().catch(updateDownloadErrorHandler);
  } catch(e) {updateDownloadErrorHandler(e)}
  return updateNeeded
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

  win.setMinimumSize(400, 300)
  win.loadFile('index.html')

  win.once('ready-to-show', () => {
    win.show()
  })
  return win
}

app.whenReady().then(() => {
  win = createWindow()
  ipcMain.handle('dialog:openFile', handleFileOpen)
  ipcMain.handle('update:check', checkForUpdates)
  ipcMain.handle('start', updateModpack)
  //ipcMain.on('msg', () => {debug("msg")})
  //ipcMain.handle('msg', () => {debug("msg")})

  loadConfig()
})

app.on('window-all-closed', () => {
  saveConfig()
  app.quit()
})