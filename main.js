const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

function createMenu() {
  const isMac = process.platform === 'darwin';
  
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Preferences...',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send('open-settings');
          }
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send('file-new');
          }
        },
        {
          label: 'Open',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const win = BrowserWindow.getFocusedWindow();
            if (!win) return;
            const { canceled, filePaths } = await dialog.showOpenDialog({
              properties: ['openFile'],
              filters: [{ name: 'Markdown', extensions: ['md'] }]
            });
            if (!canceled && filePaths.length > 0) {
              const content = fs.readFileSync(filePaths[0], 'utf8');
              win.webContents.send('file-open', { filePath: filePaths[0], content });
            }
          }
        },
        ...(!isMac ? [
          { type: 'separator' },
          {
            label: 'Settings',
            accelerator: 'Ctrl+,',
            click: () => {
              const win = BrowserWindow.getFocusedWindow();
              if (win) win.webContents.send('open-settings');
            }
          }
        ] : [])
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createMenu();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handler for saving markdown
ipcMain.handle('save-markdown', async (event, { filePath, content, categoryPath, mappingFilePath, images }) => {
  try {
    // If user didn't specify a full path, prompt them to save
    if (!filePath || filePath.trim() === '') {
      const { canceled, filePath: dialogPath } = await dialog.showSaveDialog({
        title: 'Save Markdown File',
        defaultPath: 'prompt.md',
        filters: [{ name: 'Markdown', extensions: ['md'] }]
      });
      if (canceled) {
        return { success: false, message: '저장이 취소되었습니다.' };
      }
      filePath = dialogPath;
    } else {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    fs.writeFileSync(filePath, content, 'utf8');

    // Update mapping file if categoryPath and mappingFilePath are provided
    if (categoryPath && mappingFilePath) {
      if (fs.existsSync(mappingFilePath)) {
        try {
          const mappingData = fs.readFileSync(mappingFilePath, 'utf8');
          let mappingJson = JSON.parse(mappingData);
          
          const categories = categoryPath.split('.');
          let current = mappingJson;
          
          for (let i = 0; i < categories.length; i++) {
            const cate = categories[i];
            if (!current[cate]) {
              current[cate] = {};
            }
            if (i === categories.length - 1) {
              current[cate]['prompt'] = [filePath];
              if (images && images.length > 0) {
                current[cate]['images'] = images;
              }
            } else {
              current = current[cate];
            }
          }
          
          fs.writeFileSync(mappingFilePath, JSON.stringify(mappingJson, null, 2), 'utf8');
        } catch (err) {
          console.error('Error updating mapping file:', err);
        }
      }
    }

    return { success: true, message: '성공적으로 저장되었습니다.', filePath };
  } catch (error) {
    console.error('Save error:', error);
    return { success: false, message: error.message };
  }
});

// IPC Handler for selecting and copying a file
ipcMain.handle('select-and-copy-attachment', async () => {
  const { canceled: openCanceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select Attachment',
    properties: ['openFile']
  });
  
  if (openCanceled || filePaths.length === 0) {
    return { success: false };
  }
  
  const sourcePath = filePaths[0];
  const defaultName = path.basename(sourcePath);
  
  const { canceled: saveCanceled, filePath: destPath } = await dialog.showSaveDialog({
    title: 'Select Destination to Copy File',
    defaultPath: defaultName
  });
  
  if (saveCanceled || !destPath) {
    return { success: false };
  }
  
  try {
    fs.copyFileSync(sourcePath, destPath);
    return { success: true, filePath: destPath };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// IPC Handler for selecting save path
ipcMain.handle('select-save-path', async () => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Select Save Path',
    defaultPath: 'prompt.md',
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  });
  
  if (canceled || !filePath) {
    return { success: false };
  }
  return { success: true, filePath };
});

// IPC Handler for selecting mapping file
ipcMain.handle('select-mapping-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select Mapping JSON File',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  
  if (canceled || filePaths.length === 0) {
    return { success: false };
  }
  return { success: true, filePath: filePaths[0] };
});
