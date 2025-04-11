const {log, debug, error, warn} = require('node:console'); 
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const util = require('node:util')
const bent = require('bent')
const fetchString = bent('string')
require('./jsdoc.js')

const { app, BrowserWindow, dialog, ipcMain, nativeTheme } = require('electron/main');
const { updateElectronApp } = require('update-electron-app');
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
const { Version } = require("./version.js")

process.noDeprecation = true
log(process.argv)

const configPath = path.join(app.getPath('userData'), 'synchronyConfig')
const sessionPath = app.getPath('sessionData')
/** @type {config} */
let config = {}
/** @type {Object.<string, packConfig>} */
let packConfigs = {}
let win;

async function checkForUpdates(packConfig) {
  try {
    const versioningFile = (await fetchString(packConfig.upstreamVersionURL)).trim().split('\n')
    const upstreamVersion = (() => {
      for(let i = 0; i < versioningFile.length; i++) {
        if(versioningFile[i] === packConfig.localBranch) {
          return versioningFile[i+1]
        }
      }
      throw(`No version found upstream for branch "${packConfig.localBranch}", config may be malformed!`)
    })()
    const updateNeeded = new Version(upstreamVersion).gt(new Version(packConfig.localVersion)) 
    win.webContents.send('Update:Response', packConfig.id, updateNeeded, packConfig)
    return updateNeeded
  } catch (e) {
    win.webContents.send('Error:VersionDownload', packConfig.id, e)
    error(e)
    return false
  }
}

async function synchronyUpdate() {
  const currentVersion = new Version(config.synchronyVersion)
  const latestVersionString = await fetchString("https://raw.githubusercontent.com/BreadBox64/Synchrony/refs/heads/master/version")
  const latestVersion = new Version(latestVersionString)
  if(latestVersion.lte(currentVersion)) {
    log("Upto-date Synchrony version detected.")
    return
  }
  log("Outdated Synchrony version detected.")
  if(process.platform === 'linux') {
    win.webContents.send('Prompt:Display', null, [`
      <div class="vflex hcenter">
        <h1 class="josefin-sans hcenter">Synchrony Update Available</h1>
        <br>
        <h2 class="josefin-sans hcenter">Synchrony ${config.synchronyVersion} is out of date; the latest version is now ${latestVersionString}.
        <br>
        <br>
        Since you are running a Linux build of Synchrony, automatic updates are unavailable. 
        <br>
        <br>
        <a target="_blank" href="https://github.com/BreadBox64/Synchrony/blob/master/readme.md#Updates">Please follow this link to instructions on updating to the latest version.</a>
        <br>
        <br>
        <a target="_blank" href="https://github.com/BreadBox64/Synchrony/releases/latest">Alternatively, here is a direct link to the latest release.</a></h2>
        <div class="hflex hcenter" style="height:96px;width: min-content;">
          <button id="promptSubmit" class="" style="width:192px;">
            <h2 class="josefin-sans">Ok</h2>
          </button>
        </div>
        <p id=promptCancel></p>
      </div>
    `])
  } else {
    updateElectronApp({updateInterval: '1 day'})
  }
}

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
        case '>': { // Import changes from another diff
          const [_arg, id, version] = change
          break
          }
        case '$': { // Config operation
          const [_arg, id, key, value] = change
        }
        case '?+': { // Prompt conditional download
          const [_arg, id, path, decompress, cache, prompt, options] = change
          break
          }
        case '?~': { // Prompt user to select a folder

        }
        case '/': { // Comment to user
          const [_arg, id, comment] = change
          break
          }
        case '\\': { // Log to stdout
          const [_arg, id, comment] = change
          log('\\ found')
          break
          }
        case '+': { // Download and install file or compressed directory
          const [_arg, id, path, decompress, cache, comment] = change
          break
          }
        case '-': { // Delete installed file
          const [_arg, id, path, comment] = change
          break
          }
        case '*': {  // Execute line replacements on installed file
          const [_arg, id, path, lineNums, replacements, comment] = change
          break
          }
        case '^': { // Execute regex on installed file
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
    icon: './resources/icon/icon64.png'
  })

  win.setMinimumSize(800, 600)
  win.loadFile('index.html')

  win.once('ready-to-show', async () => {
    const [configSuccess, configData] = loadConfig(configPath)
    if(configSuccess) config = configData; else return
    win.webContents.send('App:ConfigRead', config)

    const [packSuccess, packData] = loadPackConfigs(config.packConfigs)
    if(packSuccess) packConfigs = packData; else return
    win.webContents.send('Pack:ConfigsRead', packConfigs)
    for(const [_id, packConfig] of Object.entries(packConfigs)) await checkForUpdates(packConfig);
  
    setTimeout(() => {win.show()}, 10)
    synchronyUpdate()
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