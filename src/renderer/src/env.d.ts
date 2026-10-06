export {}

declare global {
  interface Window {
    api: {
      setFullscreen: (value: boolean) => void
      windowControl: (action: 'minimize' | 'maximize' | 'close') => void
      onMaximized: (cb: (maximized: boolean) => void) => () => void
    }
  }
}
