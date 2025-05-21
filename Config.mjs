import './jsdoc.js'
import fs from 'node:fs'
import { dialog } from 'electron'
import { readFile } from './UtilsServer.mjs'
import { app } from 'electron/main'

async function handleFileOpen(options) {
	const { canceled, filePaths } = await dialog.showOpenDialog(options)
	if (!canceled) {
		return filePaths[0]
	}
}

const defaultPackConfig = {
  id: null,
	name: 'Default Pack - Placeholder Name',
	description: 'This is a placeholder description',
	localBranch: 'Main',
	localVersion: '0.0.0',
	upstreamVersion: '1.0.0',
	upstreamVersionURL: null,
	upstreamChangelist: null,
}

/**
 * 
 * @param {string} path 
 * @returns {[boolean, packConfig|Error]}
 */
function loadPackConfig(path) {
  let newPackConfig = {}
  let packConfigFile
  try {
    packConfigFile = readFile(path)
  } catch(e) {
    return [false, e]
  }

  packConfigFile.forEach((line) => {
    if(line === "") {} else {
      const [param, value] = line.split(' => ')
      newPackConfig[param] = value
    }
  })

  newPackConfig.upstreamVersion = "..."
  newPackConfig.path = path

  return [true, newPackConfig]
}

/**
 * 
 * @param {string[]} packList 
 * @returns {Object.<string, packConfig>}
 */
function loadPackConfigs(packList) {
  let configs = {}
  let errors = {}
  try {
    packList.forEach(pack => {
      const [s, v] = loadPackConfig(pack)
      if(s) configs[v.id] = v; else errors[pack] = v;
    })
    return [true, configs, errors]
  } catch(e) {return [false, e]}
}

function savePackConfig(path, config) {
  let outString = ""
  for(const [key, value] of Object.entries(config)) {
    outString += `${key} => ${value}\n`
  }
  fs.writeFileSync(path, outString)
}

const defaultConfig = {
  defaultPack: 0,
  packConfigs: [],
  maxWorkers: 5,
  synchronyVersion: app.getVersion(),
  themeBrightness: 'system',
  themeColor: 'purple'
}

/**
 * 
 * @param {string} path 
 * @returns {[boolean, config|Error]}
 */
function loadConfig(path) {
  let newConfig = structuredClone(defaultConfig)
  let configArray
  try {
    configArray = readFile(path)
  } catch(e) {
    if(e.message.includes("no such file or directory")) {
      saveConfig(path, defaultConfig)
      return [true, defaultConfig]
    } else {
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
    return [false, e]
  }
}

async function loadDescriptor(url) {
  const lines = await fetchString(url).trim().replace(/\r\n/g,'\n').split('\n')
  let describe = {}
  lines.forEach((line) => {
    const [param, value] = line.split(' => ')
    describe[param] = value
  })
}

function saveConfig(path, config) {
  try {
    const configString = [
      `synchronyVersion => ${config.synchronyVersion}`,
      `defaultPack => ${config.defaultPack.toString()}`,
      `packConfigs => ${config.packConfigs.join(' ||| ')}`,
      `maxWorkers => ${config.maxWorkers}`,
      `themeBrightness => ${config.themeBrightness}`,
      `themeColor => ${config.themeColor}`
    ].join('\n')

    fs.writeFileSync(path, configString, {override: true})
    return [true, path]
  } catch(e) {
    return [false, e]
  }
}

export { loadConfig, saveConfig, loadPackConfig, loadPackConfigs, savePackConfig, defaultPackConfig }