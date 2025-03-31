const {log, debug, error, fs, fsp, path, app, dialog} = global.moduleExport
import './jsdoc.js'

async function handleFileOpen(options) {
	const { canceled, filePaths } = await dialog.showOpenDialog(options)
	if (!canceled) {
		return filePaths[0]
	}
}

/**
 * 
 * @param {string} path 
 * @returns {[boolean, packConfig|Error]}
 */
function loadPackConfig(path) {
  let newPackConfig = {}
  let configString
  try {
    configString = fs.readFileSync(path, 'utf-8').replace(/\r\n/g,'\n').trim()
  } catch(e) {
    error(e)
    return [false, e]
  }

  configString.split('\n').forEach((line) => {
    if(line === "") {} else {
      const [param, value] = line.split(' => ')
      newPackConfig[param] = value
    }
  })

  newPackConfig.upstreamVersion = "..."

  return [true, newPackConfig]
}

/**
 * 
 * @param {string[]} packList 
 * @returns {Object.<string, packConfig>}
 */
function loadPackConfigs(packList) {
  let configs = {}
  try {
    packList.forEach(pack => {
      const [s, v] = loadPackConfig(pack)
      if(s) configs[v.id] = v;
    })
    return [true, configs]
  } catch(e) {return [false, e]}
}

function savePackConfig(path, config) {
  
}

async function newPackConfig() {
  let path = ""
  

  return path
}

const defaultConfig = {
  defaultPack: 0,
  packConfigs: [],
  maxWorkers: 5,
  synchronyVersion: app.getVersion(),
  theme: 'system'
}

/**
 * 
 * @param {string} path 
 * @returns {[boolean, config|Error]}
 */
function loadConfig(path) {
  let newConfig = {}
  let configArray
  try {
    configArray = fs.readFileSync(path, 'utf-8').toString().replace(/\r\n/g,'\n').split('\n')
  } catch(e) {
    if(e.message.includes("no such file or directory")) {
      saveConfig(path, defaultConfig)
      return [true, defaultConfig]
    } else {
      error(e)
      return [false, e]
    }
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
    configArray.forEach((line) => {
      const [param, value] = line.split(' => ')
      newConfig[param] = (getParser(param))(value)
    })
    return [true, newConfig]
  } catch(e) {
    error(e)
    return [false, e]
  }
}

function saveConfig(path, config) {
  try {
    const configString = [
      `synchronyVersion => ${config.synchronyVersion}`,
      `defaultPack => ${config.defaultPack.toString()}`,
      `packConfigs => ${config.packConfigs.join(' ||| ')}`,
      `maxWorkers => ${config.maxWorkers}`,
      `theme => ${config.theme}`
    ].join('\n')

    fs.writeFileSync(path, configString, {override: true})
    return [true, path]
  } catch(e) {
    return [false, e]
  }
}

export {loadConfig, saveConfig, loadPackConfig, loadPackConfigs, savePackConfig, newPackConfig}