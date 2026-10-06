import { app, shell, BrowserWindow, ipcMain, Menu } from 'electron'
import { join } from 'path'

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    // Barra de título própria (desenhada no app), mantendo a moldura nativa: bordas
    // arredondadas, sombra e encaixe nas laterais do Windows 11.
    titleBarStyle: 'hidden',
    // Fundo translúcido do Windows 11. Em versões sem suporte, o app fica com fundo escuro sólido.
    backgroundMaterial: 'acrylic',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  const sendMaximized = (): void => {
    mainWindow?.webContents.send('window-maximized', mainWindow.isMaximized())
  }
  mainWindow.on('maximize', sendMaximized)
  mainWindow.on('unmaximize', sendMaximized)

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.on('set-fullscreen', (_event, value: boolean) => {
  mainWindow?.setFullScreen(Boolean(value))
})

ipcMain.on('window-control', (_event, action: 'minimize' | 'maximize' | 'close') => {
  if (!mainWindow) return
  if (action === 'minimize') mainWindow.minimize()
  else if (action === 'maximize') {
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  } else if (action === 'close') mainWindow.close()
})

// O menu padrão do Electron fica escondido mas mantém os atalhos ativos: Ctrl+R recarrega e
// Ctrl+W fecha a janela — agachar (Ctrl) + recarregar (R) ou andar (W) no meio de um treino.
Menu.setApplicationMenu(null)

app.whenReady().then(() => {
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
