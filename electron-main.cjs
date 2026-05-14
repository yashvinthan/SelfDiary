const { app, BrowserWindow, session, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Configure Default Directory: Documents/DiaryAssistant
const userDocuments = app.getPath('documents');
const configFolder = app.getPath('userData');
const configFile = path.join(configFolder, 'storage-config.json');

let defaultDir = path.join(userDocuments, 'DiaryAssistant');

// Load persisted custom directory
if (fs.existsSync(configFile)) {
  try {
    const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    if (config.storagePath) defaultDir = config.storagePath;
  } catch (e) {
    console.error("Failed to load config", e);
  }
}

let dbFile = path.join(defaultDir, 'DiaryAssistant.xlsx');

function updateStoragePaths(newPath) {
  defaultDir = newPath;
  dbFile = path.join(defaultDir, 'DiaryAssistant.xlsx');
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true });
  }
  // Persist
  fs.writeFileSync(configFile, JSON.stringify({ storagePath: defaultDir }));
}

if (!fs.existsSync(defaultDir)) {
  fs.mkdirSync(defaultDir, { recursive: true });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    icon: path.join(__dirname, 'dist', 'favicon.ico'),
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    // Automatically grant media (microphone) and other permissions
    if (permission === 'media' || permission === 'mediaKeySystem') {
      return callback(true);
    }
    callback(true);
  });

  // Setup IPC Handlers
  ipcMain.handle('read-excel', () => {
    try {
      if (fs.existsSync(dbFile)) {
        return fs.readFileSync(dbFile);
      }
      return null;
    } catch (e) {
      console.error("Failed to read excel natively", e);
      return null;
    }
  });

  ipcMain.handle('write-excel', (event, arrayBuffer) => {
    try {
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(dbFile, buffer);
      return true;
    } catch (e) {
      console.error("Failed to write excel natively", e);
      return false;
    }
  });

  ipcMain.handle('select-storage-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Diary Storage Folder'
    });
    if (!canceled && filePaths[0]) {
      updateStoragePaths(filePaths[0]);
      return {
        folder: defaultDir,
        file: dbFile,
        filename: 'DiaryAssistant.xlsx'
      };
    }
    return null;
  });

  ipcMain.handle('get-storage-info', () => {
    return {
      folder: defaultDir,
      file: dbFile,
      filename: path.basename(dbFile)
    };
  });

  ipcMain.handle('export-excel', async (event, arrayBuffer, suggestedName) => {
    try {
      const { canceled, filePath } = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow(), {
        title: "Export Master Data",
        defaultPath: suggestedName || 'DiaryAssistant_Export.xlsx',
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
      });

      if (!canceled && filePath) {
        fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
        return true;
      }
      return false;
    } catch (e) {
      console.error("Export failed", e);
      return false;
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
