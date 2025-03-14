const { contextBridge, ipcRenderer } = require('electron')
const {log} = require('node:console')

contextBridge.exposeInMainWorld('electronAPI', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,

  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  checkForUpdate: (modpackId) => ipcRenderer.invoke('Update:Check', modpackId),
  startProcess: (modpackId) => ipcRenderer.invoke('start', modpackId),

  onReady: (callback) => ipcRenderer.on('Ready', (_event) => callback()),
  onPackConfigRead: (callback) => ipcRenderer.on('Pack:ConfigsRead', (_event, configs) => callback(configs)),

  onVersionDownloadError: (callback) => ipcRenderer.on('Error:VersionDownload', (_event, modpackId, err) => callback(err)),
  onVersionReadError: (callback) => ipcRenderer.on('Error:VersionRead', (_event, modpackId, err) => callback(err)),

  onUpdateCheckedFor: (callback) => ipcRenderer.on('Update:Response', (_event, modpackId, updateNeeded, versionData) => callback(modpackId, updateNeeded, versionData)),
  onUpdateProcessPercent: (callback) => ipcRenderer.on('Update:Percent', (_event, modpackId, value) => callback(modpackId, value)),
  onUpdateProcessComplete: (callback) => ipcRenderer.on('Update:Complete', (_event, modpackId, value) => callback(modpackId, value)),
  onUpdateProcessFailed: (callback) => ipcRenderer.on('Update:Failed', (_event, modpackId, value) => callback(modpackId, value))
})