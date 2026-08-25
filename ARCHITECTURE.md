# AI Prompting Editor — 아키텍처 및 내부 동작 상세 문서

## 1. 프로젝트 개요

**Markdown Editor for AI Prompting** (`ai-prompt-editor`)은 AI에게 전달할 "작업 요청서" 마크다운 문서를 구조적으로 작성·관리하고, GitHub Copilot SDK를 통해 AI가 자동으로 요청서를 생성하도록 지원하는 **Electron 기반 데스크톱 애플리케이션**입니다.

---

## 2. 기술 스택

| 분류 | 기술 |
|---|---|
| 런타임 | Node.js (Electron 내장) |
| 프레임워크 | **Electron** v42+ |
| AI 통합 | **@github/copilot-sdk** v1.0+ |
| UI | Vanilla HTML + CSS + JavaScript |
| 빌드 도구 | **electron-builder** v26+ |
| 설정 저장 | 브라우저 `localStorage` |
| 패키징 형식 | macOS `.dmg`, Windows `.exe` (NSIS), Linux `.AppImage` |

---

## 3. Electron 3-레이어 아키텍처

Electron 앱은 **Main Process**, **Preload Script**, **Renderer Process** 세 계층으로 엄격하게 분리됩니다.

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Application                     │
│                                                             │
│  ┌──────────────┐   IPC Bridge   ┌──────────────────────┐   │
│  │ Main Process │◄──────────────►│  Renderer Process    │   │
│  │  (main.js)   │                │  (index.html +       │   │
│  │              │  contextBridge │   renderer.js)       │   │
│  │ - Node.js API│◄──────────────►│                      │   │
│  │ - File I/O   │  preload.js    │ - UI 렌더링          │   │
│  │ - Copilot SDK│                │ - 사용자 입력 처리    │   │
│  │ - OS 터미널  │                │ - window.api 호출     │   │
│  └──────────────┘                └──────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 Main Process — [main.js](main.js)

Node.js 전체 권한을 가지는 백엔드 역할입니다.

**담당 책임:**
- `BrowserWindow` 생성 및 앱 생명주기 관리
- 네이티브 메뉴 바 구성 (`File`, `Edit`, `View`, macOS `App` 메뉴)
- 모든 `ipcMain.handle()` 핸들러 등록 (파일 I/O, AI 생성, 터미널 실행)
- GitHub Copilot SDK 클라이언트 초기화 및 세션 관리
- 플랫폼별 Copilot 바이너리 경로 탐색

**보안 설정:**
```javascript
// nodeIntegration=false + contextIsolation=true 로 렌더러 격리
webPreferences: {
  preload: path.join(__dirname, 'preload.js'),
  nodeIntegration: false,
  contextIsolation: true
}
```

### 3.2 Preload Script — [preload.js](preload.js)

`contextBridge`로 **안전한 API 경계**를 형성합니다. 렌더러가 직접 Node.js에 접근하는 것을 차단하고, 허가된 채널만 노출합니다.

```
window.api = {
  saveMarkdown             → IPC: 'save-markdown'
  generateMarkdownWithAi   → IPC: 'generate-markdown-with-ai'
  cancelMarkdownGeneration → IPC: 'cancel-markdown-generation'
  selectAndCopyAttachment  → IPC: 'select-and-copy-attachment'
  selectSavePath           → IPC: 'select-save-path'
  selectMappingFile        → IPC: 'select-mapping-file'
  selectOrchDir            → IPC: 'select-orch-dir'
  runOrchCommand           → IPC: 'run-orch-command'
  applyWorkflow            → IPC: 'apply-workflow'
  onFileNew                → IPC listener: 'file-new'
  onFileOpen               → IPC listener: 'file-open'
  onOpenSettings           → IPC listener: 'open-settings'
}
```

### 3.3 Renderer Process — [renderer.js](renderer.js) + [index.html](index.html)

브라우저 환경에서 실행되는 UI 레이어입니다. DOM 조작, 상태 관리, 이벤트 처리를 담당합니다.

---

## 4. 핵심 데이터 모델

렌더러는 두 개의 인메모리 배열로 에디터 상태를 관리합니다.

### 첨부파일 (`attachments[]`)
```javascript
{
  id: "1724567890123abc12",  // Date.now() + random suffix (유니크 키)
  path: "/absolute/path/to/file.js",
  alt: "파일 설명 텍스트"
}
```

### 요구사항 (`requirements[]`)
```javascript
{
  id: "1724567890456def34",
  title: "요구사항 세부 제목",
  content: "## 3.1.1 세부 내용\n...",
  attachedFiles: [ /* attachments[] 참조 배열 */ ]
}
```

> [!NOTE]
> 런타임 중 `attachedFiles`는 원본 `attachments` 배열 객체를 참조합니다. 파일을 다시 불러올 때는 요구사항 블록의 `- 첨부 파일 N:` 라인에서 path를 우선 읽고, path 정보가 없으면 alt 텍스트 기준으로 `attachments` 배열과 다시 매칭합니다.

---

## 5. 마크다운 생성 포맷

`generateMarkdown()` 함수가 UI 상태를 아래 고정 포맷의 마크다운 문자열로 직렬화합니다.

```markdown
---
title: [제목]
category: [카테고리 경로 (선택)]
attachments:
  - path: /절대/경로/파일.js
    alt: 파일 설명
---

# 작업 요청서
## 1. 개요
[개요 텍스트]

## 2. 역할
[역할 텍스트]

## 3. 요구사항
### 3.1 [요구사항 제목]
[내용]

- 첨부 파일 1: `alt 텍스트` (path: /절대/경로/파일.js)

## 4. 최종 결과물
아래 항목을 반드시 모두 포함해 주세요.
- **변경/생성한 파일 목록** (경로 포함)
- 컴파일/테스트 수행 여부 및 결과
- **요약문만 출력하지 마세요. 필수 항목 누락은 실패로 간주됩니다.**
```

---

## 6. 주요 기능별 동작 흐름

### 6.1 수동 마크다운 작성 & 저장

```
[사용자 입력] → renderer.js (UI 상태 업데이트)
     ↓ 저장 버튼 클릭
generateMarkdown()  → md 문자열 생성
     ↓
window.api.saveMarkdown({ filePath, content, categoryPath, mappingFilePath, files })
     ↓ IPC
main.js: 'save-markdown' 핸들러
  1. filePath 없으면 dialog.showSaveDialog() 표시
  2. fs.writeFileSync(filePath, content)
  3. categoryPath + mappingFilePath가 있고, mapping 파일이 이미 존재하면 mapping.json 업데이트
     - categoryPath를 '.'으로 분할 → 중첩 JSON 트리 탐색/생성
     - 마지막 노드에 { prompt: ["./relative/path.md"], files: [...] } 기록
  4. { success: true, filePath } 반환
```

### 6.2 AI 자동 요청서 생성

```
[사용자 입력: 개발 내용 텍스트]
     ↓ '자동 생성' 버튼 클릭
generationId = Date.now() + random  ← 취소 추적용 고유 ID
     ↓
window.api.generateMarkdownWithAi({ model, content, filePath, githubToken, generationId })
     ↓ IPC
main.js: 'generate-markdown-with-ai' 핸들러
  1. getCopilotBinaryPath()  ← 플랫폼별 바이너리 탐색
  2. new CopilotClient({ workingDirectory, connection, gitHubToken })
  3. activeAiGenerations.set(generationId, client)  ← 취소 지원
  4. await client.start()
  5. session = await client.createSession({ model })
  6. systemPrompt 구성 (포맷 규칙 + 사용자 입력 포함)
  7. finalEvent = await session.sendAndWait(messageOptions, 300000ms)
  8. output 후처리: ```markdown 코드블록 마커 제거
  9. { success: true, content: output } 반환
     ↓
renderer.js
  10. window.api.saveMarkdown({ filePath, content: generatedContent, categoryPath: '', files: [] })
      - AI 자동 생성 직후에는 mapping.json을 갱신하지 않음
      - 첨부파일 매핑도 비운 상태로 저장하고, 이후 수동 편집 가능
  11. loadMarkdownToEditor(saveResponse.filePath, generatedContent)  ← 편집기에 자동 로드
  12. closeAiGeneratorModal()
```

### 6.3 AI 생성 취소

```
closeAiGeneratorModal() 호출 시 (activeGenerationId 존재하면)
     ↓
window.api.cancelMarkdownGeneration({ generationId })
     ↓ IPC
main.js: 'cancel-markdown-generation' 핸들러
  1. activeAiGenerations.get(generationId)로 client 조회
  2. client.forceStop()  ← Copilot SDK 강제 종료
  3. activeAiGenerations.delete(generationId)
```

### 6.4 Orchestrator 작업 요청 흐름

```
[작업 요청 버튼 클릭]
     ↓ 조건 체크 (isSaved + categoryPath + targetName 모두 있어야 활성화)
window.api.runOrchCommand({ orchPath, targetName, timeoutMs })
     ↓ IPC
main.js: 'run-orch-command' 핸들러
  - Windows: start cmd.exe /K "npm --prefix <orchPath> run orch ..."
  - macOS:   osascript (AppleScript) → Terminal.app 실행
  - Linux:   x-terminal-emulator -e bash -c "npm run orch ..."
```

### 6.5 Markdown 파일 불러오기 (파싱)

`loadMarkdownToEditor(filePath, content)` 함수가 정규식 기반으로 마크다운을 역직렬화합니다.

```
content
  ├── Frontmatter 파싱 (/^---\n([\s\S]*?)\n---/)
  │     ├── title
  │     ├── category
  │     └── attachments (path + alt 반복 추출)
  ├── ## 1. 개요  → doc-overview textarea
  ├── ## 2. 역할  → doc-role textarea
  └── ## 3. 요구사항
        └── ### 3.N ... 블록들을 split으로 분리
              ├── 첫 줄 → req.title
              ├── "- 첨부 파일 N:" 라인 → path 우선, 없으면 alt 기준으로 attachedFiles 복원
              └── 나머지 → req.content
```

---

## 7. IPC 채널 전체 목록

| IPC 채널 | 방향 | 설명 |
|---|---|---|
| `generate-markdown-with-ai` | renderer → main | Copilot SDK로 AI 요청서 생성 |
| `cancel-markdown-generation` | renderer → main | 진행 중인 AI 생성 강제 취소 |
| `save-markdown` | renderer → main | md 파일 저장, 필요 시 mapping.json 조건부 업데이트 |
| `select-and-copy-attachment` | renderer → main | 파일 선택 → 복사 대화상자 |
| `select-save-path` | renderer → main | 저장 경로 선택 대화상자 |
| `select-mapping-file` | renderer → main | mapping JSON 파일 선택 |
| `select-orch-dir` | renderer → main | Orchestrator 폴더 선택 |
| `run-orch-command` | renderer → main | 외부 터미널에서 orch npm 스크립트 실행 |
| `apply-workflow` | renderer → main | workflow.default.json의 category 업데이트 |
| `file-new` | main → renderer | 새 문서 (메뉴 또는 단축키) |
| `file-open` | main → renderer | 파일 열기 (메뉴 또는 단축키) |
| `open-settings` | main → renderer | 환경설정 모달 열기 |

---

## 8. GitHub Copilot SDK 통합

### Copilot 바이너리 탐색 (`getCopilotBinaryPath`)

플랫폼/아키텍처 조합으로 네이티브 바이너리를 자동 탐색합니다.

```
패키지명: @github/copilot-{platform}-{arch}
예: @github/copilot-win32-x64
    @github/copilot-darwin-arm64
    @github/copilot-linux-x64
    @github/copilot-linuxmusl-x64  (musl fallback)

asar 패키징 시: app.asar → app.asar.unpacked 경로 변환
(package.json의 asarUnpack: ["**/node_modules/@github/**/*"] 설정과 연동)
```

### 세션 생명주기

```
CopilotClient 생성
  → client.start()          // 바이너리 프로세스 시작
  → client.createSession()  // 모델 세션 생성
  → session.sendAndWait()   // 프롬프트 전송 및 응답 대기 (최대 5분)
  → session.disconnect()    // 세션 종료
  → client.stop()           // 바이너리 프로세스 종료 (finally 블록)
```

### 시스템 프롬프트 구조

AI 생성 시 주입되는 프롬프트는 다음 요소로 구성됩니다:
1. 역할 정의: "전문 소프트웨어 엔지니어이자 기획자"
2. 사용자 입력 내용 (content 변수 삽입)
3. 포맷 규칙: Frontmatter + 4개 섹션 (개요/역할/요구사항/최종 결과물) 강제
4. 출력 형식 제한: 코드블록 마커 없이 마크다운 원본만 반환

---

## 9. 설정(Settings) 저장소

모든 사용자 환경설정은 Electron의 `localStorage`에 키-값으로 저장됩니다 (앱 재시작 후에도 유지).

| localStorage 키 | 설명 | 형식 |
|---|---|---|
| `mappingFilePath` | mapping.json 절대 경로 | 문자열 |
| `taskTargetList` | 작업 대상 이름 목록 | 콤마 구분 문자열 |
| `aiModelsList` | Copilot 모델 이름 목록 | 콤마 구분 문자열 |
| `githubToken` | GitHub Copilot 인증 토큰 | `gho_...` 또는 `ghu_...` |
| `orchPath` | Orchestrator 프로젝트 절대 경로 | 문자열 |

> [!IMPORTANT]
> `githubToken`은 `localStorage`에 평문으로 저장됩니다. 보안이 중요한 환경에서는 `.env` 파일(`GITHUB_TOKEN` 또는 `GH_TOKEN`)을 통해 환경변수로 주입하는 방식을 권장합니다. Main Process는 `.env`를 `process.loadEnvFile()`로 자동 로드합니다.

---

## 10. Mapping JSON 연동

저장 시 `categoryPath`와 `mappingFilePath`가 모두 제공되고, `mappingFilePath`가 실제로 존재하는 파일이면 `mapping.json`을 **중첩 JSON 트리** 형태로 업데이트합니다.

존재하지 않는 mapping 파일은 자동 생성하지 않으며, 이 경우 본문 마크다운 저장만 수행됩니다.

**예시:**
- `categoryPath = "auth.login"`
- 저장 결과물 경로: `prompts/auth/login.md`

```json
{
  "auth": {
    "login": {
      "prompt": ["./prompts/auth/login.md"],
      "files": [
        { "path": "/src/login.js", "alt": "로그인 로직" }
      ]
    }
  }
}
```

카테고리 깊이는 `.`으로 무한히 중첩 가능하며, 존재하지 않는 중간 노드는 자동 생성됩니다.

---

## 11. Workflow 연동 (`workflow.default.json`)

`applyWorkflow` IPC 핸들러는 Orchestrator의 `workflow.default.json` 파일 내 **첫 번째 스텝**의 `mcp.args.category` 값을 현재 `categoryPath`로 덮어씁니다.

```
orchPath/workflow.default.json (배열 형식)
[
  {
    "mcp": {
      "args": {
        "category": "→ 여기를 categoryPath로 업데이트"
      }
    }
  },
  ...
]
```

---

## 12. UI 컴포넌트 구조

```
index.html
├── .container
│   ├── [settings-btn] ⚙️ 환경설정 버튼
│   ├── #doc-title          제목 입력
│   ├── #doc-overview       개요 textarea
│   ├── #doc-role           역할 textarea
│   ├── .list-container     첨부파일 목록
│   │   └── #attachments-list (동적 렌더링)
│   ├── .list-container     요구사항 목록
│   │   └── #requirements-list (동적 렌더링)
│   │       └── .req-item
│   │           ├── .req-item-header (### 3.N 번호 + 제목 + 삭제)
│   │           └── .req-item-body
│   │               ├── [헤더 추가 버튼] → #### 3.N.M 삽입
│   │               ├── #req-content-{id} textarea
│   │               ├── .toolbar (첨부파일 빠른 삽입 버튼들)
│   │               └── 선택된 첨부파일 목록
│   ├── #file-path          저장 경로 (클릭 → dialog)
│   ├── #category-path      카테고리 경로
│   ├── [apply-workflow-btn] workflow 적용
│   ├── [job-request-btn]   작업 요청 (조건부 활성화)
│   ├── #task-target        작업 대상 select
│   ├── #task-timeout       타임아웃(ms) 입력
│   └── [save-btn]          저장
│
├── #settings-modal (flex/none 토글)
│   ├── #mapping-file-path
│   ├── #task-target-list
│   ├── #ai-models-list
│   ├── #github-token
│   └── #orch-path
│
└── #ai-generator-modal (flex/none 토글)
    ├── #ai-gen-input-content  개발 내용 textarea
    ├── #ai-gen-model-select   모델 선택
    ├── #ai-gen-file-path      저장 경로
    └── [run-ai-gen-btn]       자동 생성
```

---

## 13. 단축키

| 단축키 | 동작 |
|---|---|
| `Cmd+N` / `Ctrl+N` | 새 문서 (메뉴 가속기) |
| `Cmd+O` / `Ctrl+O` | 파일 열기 (메뉴) |
| `Cmd+,` / `Ctrl+,` | 환경설정 모달 열기 (메뉴) |
| `Cmd+M` / `Ctrl+M` | AI 자동 생성 모달 열기 (렌더러 keydown, `KeyboardEvent.code` 기준) |

---

## 14. 빌드 및 패키징

```
electron-builder 설정 (package.json)
  appId: com.iplus74.ai-prompt-editor
  asar: true
  asarUnpack: ["**/node_modules/@github/**/*"]
    ↑ Copilot 네이티브 바이너리는 ASAR 압축에서 제외
      (바이너리 실행을 위해 app.asar.unpacked에 배치)

플랫폼별 출력:
  macOS  → dist/*.dmg
  Windows → dist/*.exe (NSIS 설치관리자)
  Linux  → dist/*.AppImage
```

---

## 15. 파일 구조 요약

```
ai-prompting-editor/
├── main.js          # Electron Main Process (Node.js, IPC 핸들러, Copilot SDK)
├── preload.js       # Context Bridge (보안 API 경계)
├── renderer.js      # Renderer Process (UI 로직, 상태 관리)
├── index.html       # UI 구조 (HTML 템플릿)
├── style.css        # 스타일 (Inter 폰트, 컴포넌트 스타일)
├── package.json     # 의존성 및 electron-builder 설정
├── run-editor.sh    # Linux/Termux 환경 자동 실행 스크립트
├── .env             # (선택) GITHUB_TOKEN 환경변수
├── dist/            # 빌드 결과물 디렉토리
└── node_modules/
  └── @github/
    ├── copilot-sdk/         # Copilot SDK (JS)
    ├── copilot-win32-x64/   # 현재 Windows 환경에서 설치된 바이너리
    └── ...                  # 플랫폼에 따라 추가 Copilot 바이너리 패키지가 설치될 수 있음
```
