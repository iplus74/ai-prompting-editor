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
              let relativePath = path.relative(path.dirname(mappingFilePath), filePath);
              relativePath = relativePath.replace(/\\/g, '/');
              if (!relativePath.startsWith('.') && !relativePath.startsWith('/')) {
                relativePath = './' + relativePath;
              }
              current[cate]['prompt'] = [relativePath];
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

// IPC Handler for selecting orchestrator directory
ipcMain.handle('select-orch-dir', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select Orchestrator Directory',
    properties: ['openDirectory']
  });
  
  if (canceled || filePaths.length === 0) {
    return { success: false };
  }
  return { success: true, filePath: filePaths[0] };
});

// IPC Handler for running orch command
ipcMain.handle('run-orch-command', async (event, { orchPath, targetName, timeoutMs }) => {
  try {
    const timeout = timeoutMs || '300000';
    
    return new Promise((resolve) => {
      const { exec } = require('child_process');
      const isWin = process.platform === 'win32';
      const isMac = process.platform === 'darwin';
      
      if (isWin) {
        // Windows 환경: cmd 창을 열고 명령어 실행 후 유지(/K)
        const cmd = `start cmd.exe /K "npm --prefix \\"${orchPath}\\" run orch -- --target-name \\"${targetName}\\" --timeout-ms ${timeout}"`;
        exec(cmd, (error) => {
          if (error) {
            console.error('Error executing cmd:', error);
            resolve({ success: false, message: error.message });
          } else {
            resolve({ success: true });
          }
        });
      } else if (isMac) {
        // Mac 환경: AppleScript로 Terminal 앱 실행
        const script = `
          tell application "Terminal"
            activate
            do script "npm --prefix \\"${orchPath}\\" run orch -- --target-name \\"${targetName}\\" --timeout-ms ${timeout}"
          end tell
        `;
        exec(`osascript -e '${script}'`, (error) => {
          if (error) {
            console.error('Error executing osascript:', error);
            resolve({ success: false, message: error.message });
          } else {
            resolve({ success: true });
          }
        });
      } else {
        // Linux 환경 (Ubuntu/Termux): x-terminal-emulator 또는 기타 데스크톱 터미널 실행
        const cmd = `x-terminal-emulator -e "bash -c \\"npm --prefix \\\\"${orchPath}\\\\" run orch -- --target-name \\\\"${targetName}\\\\" --timeout-ms ${timeout}; exec bash\\""`;
        exec(cmd, (error) => {
          if (error) {
            console.error('Error executing x-terminal-emulator:', error);
            resolve({ success: false, message: '리눅스 터미널 실행 실패: ' + error.message });
          } else {
            resolve({ success: true });
          }
        });
      }
    });
  } catch (error) {
    console.error('Run orch error:', error);
    return { success: false, message: error.message };
  }
});

// IPC Handler for applying workflow (update mcp.args.category in workflow.default.json)
ipcMain.handle('apply-workflow', async (event, { orchPath, categoryPath }) => {
  try {
    if (!orchPath) {
      return { success: false, message: 'Orchestrator 경로가 설정되지 않았습니다.' };
    }
    if (!categoryPath) {
      return { success: false, message: '카테고리 경로가 입력되지 않았습니다.' };
    }

    const workflowFilePath = path.join(orchPath, 'workflow.default.json');

    if (!fs.existsSync(workflowFilePath)) {
      return { success: false, message: `workflow.default.json 파일을 찾을 수 없습니다: ${workflowFilePath}` };
    }

    const fileData = fs.readFileSync(workflowFilePath, 'utf8');
    let workflowJson = JSON.parse(fileData);

    if (!Array.isArray(workflowJson) || workflowJson.length === 0) {
      return { success: false, message: 'workflow.default.json 형식이 올바르지 않습니다 (배열이어야 합니다).' };
    }

    const firstStep = workflowJson[0];
    if (!firstStep.mcp || !firstStep.mcp.args || firstStep.mcp.args.category === undefined) {
      return { success: false, message: '첫 번째 요소에 mcp.args.category가 존재하지 않습니다.' };
    }

    firstStep.mcp.args.category = categoryPath;
    fs.writeFileSync(workflowFilePath, JSON.stringify(workflowJson, null, 2), 'utf8');

    return { success: true, message: 'workflow.default.json이 업데이트되었습니다.' };
  } catch (error) {
    console.error('Apply workflow error:', error);
    return { success: false, message: error.message };
  }
});
