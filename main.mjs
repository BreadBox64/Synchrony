import { log } from 'node:console'
import { ChildProcess } from 'node:child_process'
import path from 'node:path'

process.noDeprecation = true
log(process.argv)

global.squirrelFirstRun = false
function handleSquirrelEvent() {
  if(process.argv.includes(' --squirrel-firstrun')) {
    global.squirrelFirstRun = true
    return false
  }
  if(!process.argv.includes('--squirrel-install') &&
    !process.argv.includes('--squirrel-updated') &&
    !process.argv.includes('--squirrel-uninstall') &&
    !process.argv.includes('--squirrel-obsolete')) {
    return false
  }

  const appFolder = path.resolve(process.execPath, '..')
  const rootAtomFolder = path.resolve(appFolder, '..')
  const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'))
  const exeName = path.basename(process.execPath)

  const spawn = function(command, args) {
    let spawnedProcess;

    try {
      spawnedProcess = ChildProcess.spawn(command, args, {detached: true})
    } catch (e) {}

    return spawnedProcess;
  }

  const spawnUpdate = function(args) {
    return spawn(updateDotExe, args)
  }

  const squirrelEvent = process.argv[1]
  switch (squirrelEvent) {
    case '--squirrel-install':
    case '--squirrel-updated':
      // Optionally do things such as:
      // - Add your .exe to the PATH
      // - Write to the registry for things like file associations and
      //   explorer context menus

      // Install desktop and start menu shortcuts
      spawnUpdate(['--createShortcut', exeName])

      setTimeout(app.quit, 1000)
      return true

    case '--squirrel-uninstall':
      // Undo anything you did in the --squirrel-install and
      // --squirrel-updated handlers

      // Remove desktop and start menu shortcuts
      spawnUpdate(['--removeShortcut', exeName])

      setTimeout(app.quit, 1000)
      return true

    case '--squirrel-obsolete':
      // This is called on the outgoing version of your app before
      // we update to the new version - it's the opposite of
      // --squirrel-updated

      app.quit()
      return true
  }
}

if(!handleSquirrelEvent()) {
  const headless = process.argv.includes('headless') || process.argv.includes('H')
  let InterfacePromise
  
  if(headless) {
    InterfacePromise = import("./headlessInterface.mjs")
  } else {
    InterfacePromise = import("./graphicalInterface.mjs")
  }
  
  await InterfacePromise
}
