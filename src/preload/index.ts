import { contextBridge, ipcRenderer } from 'electron'

const api = {
  setFullscreen: (value: boolean) => ipcRenderer.send('set-fullscreen', value)
}

contextBridge.exposeInMainWorld('api', api)
