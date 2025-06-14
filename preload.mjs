import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  testValue: 'hello bagel',
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,

  checkForUpdate: (modpackId) => ipcRenderer.invoke('Update:Check', modpackId),
  startProcess: (modpackId) => ipcRenderer.invoke('Update:Start', modpackId),

  ThemeChange: (newTheme) => ipcRenderer.invoke('App:ThemeChange', newTheme),
  DialogOpen: (options) => ipcRenderer.invoke('Dialog:Open', options),
  
  onNativeThemeChange: (callback) => ipcRenderer.on('App:NativeThemeChange', (_event, useDarkMode) => callback(useDarkMode)),
  onReady: (callback) => ipcRenderer.on('Ready', (_event) => callback()),
  onConfigRead: (callback) => ipcRenderer.on('App:ConfigRead', (_event, config) => callback(config)),
  onPackConfigRead: (callback) => ipcRenderer.on('App:PackConfigsRead', (_event, configs) => callback(configs)),

  onDisplayPrompt: (callback) => ipcRenderer.on('Prompt:Display', (_event, respond, options) => callback((respond) ? (data) => ipcRenderer.invoke(respond, data) : () => {}, options)),

  onConfigReadError: (callback) => ipcRenderer.on('Error:ConfigRead', (_event, err) => callback(modpackId, err)),
  onVersionDownloadError: (callback) => ipcRenderer.on('Error:VersionDownload', (_event, modpackId, err) => callback(modpackId, err)),
  onVersionReadError: (callback) => ipcRenderer.on('Error:VersionRead', (_event, modpackId, err) => callback(modpackId, err)),
  onChangelistDownloadError: (callback) => ipcRenderer.on('Error:ChangelistDownload', (_event, modpackId, err) => callback(modpackId, err)),
  onChangelistCompileError: (callback) => ipcRenderer.on('Error:ChangelistCompile', (_event, modpackId, err) => callback(modpackId, err)),
  onChangelistParseError: (callback) => ipcRenderer.on('Error:ChangelistParse', (_event, modpackId, err) => callback(modpackId, err)),

  onUpdateCheckedFor: (callback) => ipcRenderer.on('Update:Response', (_event, modpackId, updateNeeded, versionData) => callback(modpackId, updateNeeded, versionData)),
  onUpdateProcessPercent: (callback) => ipcRenderer.on('Update:Percent', (_event, modpackId, value) => callback(modpackId, value)),
  onUpdateProcessComplete: (callback) => ipcRenderer.on('Update:Complete', (_event, modpackId, value) => callback(modpackId, value)),
  onUpdateProcessFailed: (callback) => ipcRenderer.on('Update:Failed', (_event, modpackId, value) => callback(modpackId, value))
})