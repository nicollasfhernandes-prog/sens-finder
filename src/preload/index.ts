import { contextBridge, ipcRenderer } from 'electron'

const api = {
  setFullscreen: (value: boolean) => ipcRenderer.send('set-fullscreen', value),
  windowControl: (action: 'minimize' | 'maximize' | 'close') => ipcRenderer.send('window-control', action),
  onMaximized: (cb: (maximized: boolean) => void) => {
    const listener = (_e: unknown, value: boolean): void => cb(value)
    ipcRenderer.on('window-maximized', listener)
    return () => ipcRenderer.removeListener('window-maximized', listener)
  },
  getUpdateStatus: () => ipcRenderer.invoke('update-get'),
  onUpdateStatus: (cb: (status: unknown) => void) => {
    const listener = (_e: unknown, value: unknown): void => cb(value)
    ipcRenderer.on('update-status', listener)
    return () => ipcRenderer.removeListener('update-status', listener)
  },
  installUpdate: () => ipcRenderer.send('update-install'),
  openReleases: () => ipcRenderer.send('update-open-releases')
}

contextBridge.exposeInMainWorld('api', api)
