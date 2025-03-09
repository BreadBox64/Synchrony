const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  //genUI: (msgContents) => ipcRenderer.invoke('genUI', msgContents),
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  checkForUpdate: () => ipcRenderer.invoke('update:check'),
  startProcess: () => ipcRenderer.invoke('start'),
  onReady: (callback) => ipcRenderer.on('Ready', (_event) => callback()),

  onVersionDownloadError: (callback) => ipcRenderer.on('Error:VersionDownload', (_event, err) => callback(err)),
  onVersionReadError: (callback) => ipcRenderer.on('Error:VersionRead', (_event, err) => callback(err)),

  onUpdateCheckedFor: (callback) => ipcRenderer.on('Update:Response', (_event, updateNeeded, versionData) => callback(updateNeeded, versionData)),
  onUpdateProcessPercent: (callback) => ipcRenderer.on('Update:Percent', (_event, value) => callback(value)),
  onUpdateProcessComplete: (callback) => ipcRenderer.on('Update:Complete', (_event, value) => callback(value)),
  onUpdateProcessFailed: (callback) => ipcRenderer.on('Update:Failed', (_event, value) => callback(value))
})