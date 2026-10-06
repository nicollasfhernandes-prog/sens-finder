import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { autoUpdater } from 'electron-updater'

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready'; version: string }
  /** Versão portátil: não se substitui sozinha, só avisa e aponta pro download. */
  | { state: 'available-portable'; version: string }

const RELEASES_URL = 'https://github.com/nicollasfhernandes-prog/sens-finder/releases/latest'
const FIRST_CHECK_MS = 8_000
const CHECK_EVERY_MS = 4 * 60 * 60 * 1000

/**
 * Atualização automática pelas Releases do GitHub: procura ao abrir e a cada 4 horas, baixa em
 * segundo plano e instala quando a pessoa clicar em "Reiniciar" ou na próxima vez que fechar o app.
 */
export function setupUpdater(getWindow: () => BrowserWindow | null): void {
  let status: UpdateStatus = { state: 'idle' }
  const send = (s: UpdateStatus): void => {
    status = s
    getWindow()?.webContents.send('update-status', s)
  }

  ipcMain.handle('update-get', () => status)
  ipcMain.on('update-install', () => {
    if (status.state === 'ready') autoUpdater.quitAndInstall(true, true)
  })
  ipcMain.on('update-open-releases', () => void shell.openExternal(RELEASES_URL))

  // Em desenvolvimento não tem o que atualizar. SF_UPDATE_URL aponta pra um servidor local nos testes.
  const testFeed = process.env['SF_UPDATE_URL']
  if (!app.isPackaged && !testFeed) return
  if (testFeed) {
    autoUpdater.setFeedURL({ provider: 'generic', url: testFeed })
    autoUpdater.forceDevUpdateConfig = true
  }

  // O executável portátil roda de um arquivo temporário e não tem como se trocar.
  const portable = Boolean(process.env['PORTABLE_EXECUTABLE_DIR'])
  autoUpdater.autoDownload = !portable
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    if (portable) send({ state: 'available-portable', version: info.version })
    else send({ state: 'downloading', version: info.version, percent: 0 })
  })
  autoUpdater.on('download-progress', (p) => {
    if (status.state === 'downloading') send({ ...status, percent: Math.round(p.percent) })
  })
  autoUpdater.on('update-downloaded', (info) => send({ state: 'ready', version: info.version }))
  // Sem internet ou sem release nova: fica quieto e tenta de novo depois.
  autoUpdater.on('error', (err) => {
    console.warn('[atualização]', err?.message ?? err)
    if (status.state === 'downloading') send({ state: 'idle' })
  })

  const check = (): void => {
    autoUpdater.checkForUpdates().catch((err) => console.warn('[atualização]', err?.message ?? err))
  }
  setTimeout(check, FIRST_CHECK_MS)
  setInterval(check, CHECK_EVERY_MS)
}
