const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  readExcel: () => ipcRenderer.invoke('read-excel'),
  writeExcel: (arrayBuffer) => ipcRenderer.invoke('write-excel', arrayBuffer),
  exportExcel: (arrayBuffer, suggestedName) => ipcRenderer.invoke('export-excel', arrayBuffer, suggestedName),
  getStorageInfo: () => ipcRenderer.invoke('get-storage-info'),
  selectStorageFolder: () => ipcRenderer.invoke('select-storage-folder'),
  isElectron: true
});
