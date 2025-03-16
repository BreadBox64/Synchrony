const {log, debug, error, warn} = require('node:console'); 
const { randomInt } = require('node:crypto');
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const util = require('node:util')
const {Worker, MessageChannel, MessagePort, isMainThread, parentPort} = require('node:worker_threads');
require('./jsdoc.js')

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
/** @type {config} */
let config = {}
/** @type {Object.<string, packConfig>} */
let packConfigs = {}
const versionRegex = /(\d+)\.(\d+)\.(\d+)(?:-([b|n])(\d+))?/;
let win;

/**
 * 
 * @param {string} id 
 * @param {packConfig} packConfig 
 * @returns 
 */

async function getChangelist(id, packConfig) {
  const promise = new Promise(resolve => {
    win.webContents.send('Update:Percent', id, 5)
    const changelistDownloadErrorHandler = (e) => {
      warn(e)
      win.webContents.send('Error:ChangelistDownload', id, e)
      resolve(null)
    }
    
    try {
      const dl = new DownloaderHelper(packConfig.upstreamChangelist, sessionPath, {
        fileName: `upstreamChangelist:${id}`,
        override: true,
        retry: {maxRetries: 5, delay: 1000}
      });
      
      dl.on('end', () => {
        debug("Downloaded changelist file.")
        let changelist
        changelist = fs.readFileSync(path.join(sessionPath, `upstreamChangelist:${id}`), 'utf8').trim().split('\n');
        win.webContents.send('Update:Percent', id, 15)
        resolve(changelist)
      });
      dl.on('error', changelistDownloadErrorHandler)
      dl.start().catch(changelistDownloadErrorHandler)
      win.webContents.send('Update:Percent', id, 10)
    } catch(e) {
      changelistDownloadErrorHandler(e)
    }
  })
  return promise
}

function findVersionRoute(versionPairs, startingVersion, targetVersion, route) {
  const layer = versionPairs.filter(key => (key[0] == startingVersion))
  let set = []
  for(const pair of layer) {
    if(pair[1] == targetVersion) return [...route, startingVersion] 
    set.push(findVersionRoute(versionPairs, pair[1], targetVersion, [...route, startingVersion]))
  }
  if(set.length == 0) return null
  let shortest = set[0]
  for(const route of set) {
    if(route.length < shortest.length) shortest = route
  }
  return shortest
}

/**
 * 
 * @param {string[]} changelist 
 * @param {string} oldVersion 
 * @param {string} newVersion 
 */
function compileChanges(id, changelist, oldVersion, newVersion) {
  try {
    let currentHeader = ''
    let changeStructure = {}
    changelist.forEach(line => {
      if(/^\d+$/.test(line[0])) { // Is the first char of current line numberic?
        currentHeader = line
        changeStructure[line] = []
      } else {
        changeStructure[currentHeader].push(line)
      }
    })
    win.webContents.send('Update:Percent', id, 20)


    // TODO Can have dependent version changes i.e. pack-client automatically includes all changes in pack-server
    // 1.0.0-c -> 1.1.0-c
    // > 1.0.0-s -> 1.1.0-s
    // + extra changes
    let changes = []
    if(changeStructure[`${oldVersion} -> ${newVersion}`] != undefined) {
      changes = changeStructure[`${oldVersion} -> ${newVersion}`] 
    } else {
      const versionPairs = Object.keys(changeStructure).map(key => key.split(' -> '))
      win.webContents.send('Update:Percent', id, 25)
      const versionRoute = [...findVersionRoute(versionPairs, oldVersion, newVersion, []), newVersion]
      win.webContents.send('Update:Percent', id, 30)
      //log(util.inspect(versionRoute, false, null, true /* enable colors */))
      
      for(let i = 0; i < versionRoute.length - 1; i++) {
        //log(`${i} : ${versionRoute[i]}`)
        changes = [...changes, ...changeStructure[`${versionRoute[i]} -> ${versionRoute[i+1]}`]]
      }
    }
    win.webContents.send('Update:Percent', id, 35)

    return changes
  } catch(e) {
    win.webContents.send('Error:ChangelistCompile', id, e)
    error(e)
    return null
  }
}

/**
 * 
 * @param {string} id 
 * @param {string[]} changes 
 * @returns {changeObject}
 */
function parseChanges(id, changes) {
  win.webContents.send('Update:Percent', id, 40)
  let parsedDownloads = []
  let j = 0
  let errorCond = false
  let parsedChanges = changes.map((change) => {
    try {
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
          args[2] = args[2].split(';')
          break
        case '+':
          parsedDownloads.push([`cache:${id}:${args[1]}`, args.splice(4, args.length - 5, `cache:${id}:${args[1]}`)])
          break
        case '*':
          args[3] = args[3].split(';').map(lineNum => {return parseInt(lineNum)})
        case '^':
          const replacements = args.splice(4, args.length - 6)
          args.splice(4, 0, replacements)
          break
      }

      win.webContents.send('Update:Percent', id, 10 * (j/changes.length) + 40)
      j++
      return args
    } catch(e) {
      error(e)
      errorCond = true
    }
  })

  if(errorCond) {
    win.webContents.send('Error:ChangelistParse', id, e)
    return null
  } else {
    return {
      downloads: parsedDownloads,
      changes: parsedChanges
    }
  }
}

/**
 * 
 * @param {changeObject} changes 
 */
async function multiThreadProcessChanges(id, changes) {
  /*
  let errorCond = false
  let workers = []
  let activeWorkers = 0
  for(let i = Math.min(config.maxWorkers, changes.length); i > 0; i--) {
    let worker = new Worker('./changeWorker.js', {name: `ChangeWorker${i}`})
    activeWorkers += 1
    worker.onmessage = (msg) => {
      switch(msg[0]) {
        case 'log':
          log(msg[2])
          break
        case 'fatal':
          errorCond = true
        case 'error':
          warn(msg[2])
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

  while(!(activeWorkers === 0 && changes.length === 0) || !errorCond) {
    win.webContents.send('Update:Percent', id, 80 * (changes.length / changeNum) + 20)
    await delay(100)
  }
  
  if(errorCond) {
    workers.forEach(worker => worker.terminate())
    win.webContents.send('Update:Failed', true)
  } else {
    win.webContents.send('Update:Complete', true)
  }
  */
}

/**
 * 
 * @param {changeObject} changes 
 */
async function processChanges(id, changes) {
  try {
    const numChanges = changes.changes.length
    for(let i = 0; i < numChanges; i++) {
      const change = changes.changes[i]
      switch(change[0]) {
        case '>': {
          const [_arg, version] = change
          break
          }
        case '?': {
          const [_arg, prompt, ids] = change
          break
          }
        case '/': {
          const [_arg, comment] = change
          break
          }
        case '\\': {
          const [_arg, comment] = change
          log('\\ found')
          break
          }
        case '+': {
          const [_arg, id, path, decompress, cache, comment] = change
          break
          }
        case '-': {
          const [_arg, id, path, comment] = change
          break
          }
        case '*': {
          const [_arg, id, path, lineNums, replacements, comment] = change
          break
          }
        case '^': {
          const [_arg, id, path, regexPattern, replacements, comment] = change
          break
          }
      }
      await delay(100)
      win.webContents.send('Update:Percent', id, 50 * (i/numChanges) + 50)
    }
    return true
  } catch(e) {
    error(e)
    return false
  }
}

/**
 * 
 * @param {string} id modpackId
 * @returns {null}
 */
async function updateModpack(id) {
  const packConfig = packConfigs[id]

  /** @type {string[]} */
  const changelist = await getChangelist(id, packConfig)
  if(changelist == null) {log('changelist is null'); return}
  await delay(500)

  const changes = compileChanges(id, changelist, packConfig.localVersion, packConfig.upstreamVersion)
  if(changes == null) {log('changes is null'); return}
  await delay(500)

  const parsedChanges = parseChanges(id, changes)
  if(parsedChanges == null) {log('parsedChanges is null'); return}
  await delay(500)

  const result = await processChanges(id, parsedChanges)
  win.webContents.send('Update:Percent', id, 100)
  await delay(10)
  if(result) {
    win.webContents.send('Update:Complete', id)
  } else {
    win.webContents.send('Update:Failed', id, 'idk why')
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
  let timedOut = false

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

      win.webContents.send('Update:Response', packConfig.id, updateNeeded, packConfig)
    } catch(e) {
      win.webContents.send('Error:VersionRead', packConfig.id, e)
      error(e)
    }
  });
  dl.on('retry', (attempt, retryOptions) => {
    log(`attempt ${attempt}`)
    if(attempt == retryOptions.maxRetries) {
      timedOut = true
      updateDownloadErrorHandler(packConfig.id, "Timed Out")()
    }
  })
  dl.on('error', () => {if(!timedOut) updateDownloadErrorHandler(packConfig.id, "Internal Error")});
  dl.start().catch(() => {if(!timedOut) updateDownloadErrorHandler(packConfig.id, "Internal Error")});
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
    Object.entries(packConfigs).forEach(([_id, packConfig]) => {checkForUpdates(packConfig)})
  
    setTimeout(() => {win.show()}, 10)
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
    config.theme = newTheme
    return nativeTheme.shouldUseDarkColors
  })
  ipcMain.handle('App:AddPack', (_event, addMethod, arguments) => addModpack(addMethod, arguments))
  ipcMain.handle('Update:CheckAll', () => {
    
  })
  ipcMain.handle('Update:Check', (_event, modpackId) => checkForUpdates(packConfigs[modpackId]))

  ipcMain.handle('Update:Start', async (_event, modpackId) => {
    updateModpack(modpackId)
  })
})

app.on('window-all-closed', () => {
  saveConfig(configPath, config)
  
  app.quit()
})