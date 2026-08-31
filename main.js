const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { CopilotClient, RuntimeConnection } = require('@github/copilot-sdk');

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
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(path.join(__dirname, 'assets', 'icon.png'));
  }
  createMenu();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Load .env
try {
  process.loadEnvFile(path.resolve('.env'));
} catch (e) {
  // ignore
}

const activeAiGenerations = new Map();

function getCopilotBinaryPath() {
  const arch = process.arch;
  const platform = process.platform;
  const packageName = `@github/copilot-${platform}-${arch}`;

  try {
    let binaryPath = require.resolve(packageName);
    if (binaryPath.includes('app.asar') && !binaryPath.includes('app.asar.unpacked')) {
      binaryPath = binaryPath.replace('app.asar', 'app.asar.unpacked');
    }
    if (fs.existsSync(binaryPath)) {
      return binaryPath;
    }
  } catch (err) {
    console.error(`Failed to resolve package ${packageName}:`, err);
  }

  if (platform === 'linux') {
    const muslPackageName = `@github/copilot-linuxmusl-${arch}`;
    try {
      let binaryPath = require.resolve(muslPackageName);
      if (binaryPath.includes('app.asar') && !binaryPath.includes('app.asar.unpacked')) {
        binaryPath = binaryPath.replace('app.asar', 'app.asar.unpacked');
      }
      if (fs.existsSync(binaryPath)) {
        return binaryPath;
      }
    } catch (err) {
      // ignore
    }
  }

  return null;
}

// IPC Handler for generating markdown using Copilot SDK
ipcMain.handle('generate-markdown-with-ai', async (event, { model, content, filePath, githubToken, generationId }) => {
  let client = null;
  let session = null;
  try {
    if (!model) {
      throw new Error('모델이 선택되지 않았습니다.');
    }
    if (!content || content.trim() === '') {
      throw new Error('개발 내용이 비어 있습니다.');
    }

    const targetAbs = filePath ? path.dirname(filePath) : process.cwd();
    const clientOptions = {
      workingDirectory: targetAbs,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1'
      }
    };

    const binaryPath = getCopilotBinaryPath();
    if (binaryPath) {
      clientOptions.connection = RuntimeConnection.forStdio({ path: binaryPath });
    }

    const token = githubToken || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    if (token) {
      clientOptions.gitHubToken = token;
    } else {
      // 토큰이 없는 경우 GitHub CLI의 기존 로그인 상태를 사용
      // (useLoggedInUser가 없으면 --no-auto-login 플래그가 붙어 인증 실패)
      clientOptions.useLoggedInUser = true;
    }

    client = new CopilotClient(clientOptions);
    if (generationId) {
      activeAiGenerations.set(generationId, client);
    }

    await client.start();

    session = await client.createSession({ model });

    const systemPrompt = `당신은 전문 소프트웨어 엔지니어이자 기획자입니다.
사용자가 입력한 아래 개발 내용을 분석하여, 규칙에 맞는 "작업 요청서" 마크다운 문서를 생성해 주세요.

사용자 입력 내용:
"""
${content}
"""

반드시 아래 포맷 규칙을 준수하여 마크다운 문서 내용만 반환해 주세요. 추가 설명이나 코드 블록 기호(\`\`\`markdown 등)를 포함하지 말고 마크다운 텍스트 원본만 반환해야 합니다.

[포맷 규칙]
---
title: [개발 내용의 핵심 요약 제목]
category: [카테고리 경로가 유추된다면 명시, 예: auth.login. UI 화면이나 디렉토리 구조에서 유추 불가능하면 그냥 생략하거나 빈값]
attachments:
  - path: [개발 내용 분석 시, 수정/참조 대상이 될 법한 소스코드 파일의 전체 경로를 유추하여 입력해 주세요. 예: /Users/yangsukim/data/work/house_sara/ai-prompting-editor/renderer.js. 반드시 절대 경로 형식으로 유추해서 입력하고, alt 정보도 꼭 넣으세요. 만약 유추 불가능하다면 attachments를 비워두세요.]
    alt: [첨부파일 설명, 예: renderer.js 소스코드]
---

# 작업 요청서
## 1. 개요
[분석된 개발 내용의 전반적인 개요 및 배경]

## 2. 역할
[AI가 수행해야 할 상세 역할 기술]

## 3. 요구사항
### 3.1 [요구사항 세부 제목 1]
[요구사항 상세 내용 1]

### 3.2 [요구사항 세부 제목 2]
[요구사항 상세 내용 2]

## 4. 최종 결과물
아래 항목을 반드시 모두 포함해 주세요.
- **변경/생성한 파일 목록** (경로 포함)
- 컴파일/테스트 수행 여부 및 결과
- **요약문만 출력하지 마세요. 필수 항목 누락은 실패로 간주됩니다.**
`;

    const messageOptions = {
      prompt: systemPrompt,
      mode: 'immediate',
    };

    const finalEvent = await session.sendAndWait(messageOptions, 300000);
    let output = finalEvent?.data?.content || '';

    await session.disconnect();
    session = null;

    output = output.replace(/^```markdown\n/, '');
    output = output.replace(/^```\n/, '');
    output = output.replace(/\n```$/, '');
    output = output.trim();

    return { success: true, content: output };
  } catch (error) {
    console.error('AI Generation error:', error);
    return { success: false, message: error.message };
  } finally {
    if (generationId) {
      activeAiGenerations.delete(generationId);
    }
    if (session) {
      try {
        await session.disconnect();
      } catch (e) {
        // ignore
      }
    }
    if (client) {
      try {
        await client.stop();
      } catch (e) {
        // ignore
      }
    }
  }
});

// IPC Handler for cancelling markdown generation
ipcMain.handle('cancel-markdown-generation', async (event, { generationId }) => {
  if (generationId && activeAiGenerations.has(generationId)) {
    const client = activeAiGenerations.get(generationId);
    if (client) {
      try {
        await client.forceStop();
      } catch (err) {
        console.error('Error force stopping client:', err);
      }
    }
    activeAiGenerations.delete(generationId);
    return { success: true };
  }
  return { success: false, message: 'No active generation found with this ID' };
});

// IPC Handler for saving markdown
ipcMain.handle('save-markdown', async (event, { filePath, content, categoryPath, mappingFilePath, files }) => {
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
              if (files && files.length > 0) {
                current[cate]['files'] = files;
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
        // Windows 환경: 임시 .bat 파일을 생성 후 실행 (경로 따옴표 중첩 문제 완전 해결)
        const os = require('os');
        const batContent = `@echo off\r\ncd /d "${orchPath}"\r\nnpm run orch -- --target-name "${targetName}" --timeout-ms ${timeout}\r\npause\r\n`;
        const batPath = path.join(os.tmpdir(), `run-orch-${Date.now()}.bat`);
        fs.writeFileSync(batPath, batContent, 'utf8');
        const cmd = `start cmd.exe /K "${batPath}"`;
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
        const cmd = `x-terminal-emulator -e bash -c "npm --prefix \\"${orchPath}\\" run orch -- --target-name \\"${targetName}\\" --timeout-ms ${timeout}; exec bash"`;
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
