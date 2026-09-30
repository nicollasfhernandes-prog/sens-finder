export {}

declare global {
  interface Window {
    api: {
      setFullscreen: (value: boolean) => void
    }
  }
}
