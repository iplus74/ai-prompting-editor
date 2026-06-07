const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  saveMarkdown: (data) => ipcRenderer.invoke('save-markdown', data),
  selectAndCopyAttachment: () => ipcRenderer.invoke('select-and-copy-attachment'),
  selectSavePath: () => ipcRenderer.invoke('select-save-path'),
  selectMappingFile: () => ipcRenderer.invoke('select-mapping-file'),
  onFileNew: (callback) => ipcRenderer.on('file-new', callback),
  onFileOpen: (callback) => ipcRenderer.on('file-open', (event, data) => callback(data)),
  onOpenSettings: (callback) => ipcRenderer.on('open-settings', callback)
});
