export {}

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'available-portable'; version: string }

declare global {
  interface Window {
    api: {
      setFullscreen: (value: boolean) => void
      windowControl: (action: 'minimize' | 'maximize' | 'close') => void
      onMaximized: (cb: (maximized: boolean) => void) => () => void
      getUpdateStatus: () => Promise<UpdateStatus>
      onUpdateStatus: (cb: (status: UpdateStatus) => void) => () => void
      installUpdate: () => void
      openReleases: () => void
    }
  }
}
