const {log, debug, error, warn} = require('node:console'); 
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const util = require('node:util')
const bent = require('bent')
const fetchString = bent('string')

global.moduleExport = {
  log,
  debug,
  error,
  warn,
  fs,
  fsp,
  path,
  util,
  fetchString
}

const { app } = require('electron/main')
global.app = app

process.noDeprecation = true
log(process.argv)

const headless = process.argv.includes('headless') || process.argv.includes('H');

if(headless) {
  require("./headlessInterface.cjs")
} else {
  require("./graphicalInterface.cjs")
}