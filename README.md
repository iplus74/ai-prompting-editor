# Markdown Editor for AI Prompting (ai-prompt-editor)

AI 프롬프트 작성 및 관리에 최적화된 마크다운(Markdown) 에디터입니다. 이 애플리케이션은 Electron을 기반으로 구축되었습니다.

## 주요 기능
- 직관적이고 깔끔한 마크다운 편집 인터페이스
- 요구사항 및 계층형 헤더(Heading) 관리 기능
- OS에 맞는 단축키 지원 (새로 만들기, 열기 등)
- 독립 실행형 데스크톱 애플리케이션(Mac, Windows 등)으로 빌드 가능

## 설치 및 실행 방법

1. 저장소를 클론하거나 다운로드합니다.
2. 터미널을 열고 프로젝트 폴더로 이동한 후 의존성 패키지를 설치합니다:
   ```bash
   npm install
   ```
3. 개발 모드로 애플리케이션을 실행합니다:
   ```bash
   npm start
   ```

## 빌드(패키징) 방법

독립적으로 실행 가능한 파일(.app, .exe 등)로 만들기 위해서는 먼저 패키징 도구인 `electron-builder`를 설치해야 합니다.

### 1. electron-builder 설치 (최초 1회)
터미널에서 다음 명령어를 실행하여 개발용 의존성으로 설치합니다:
```bash
npm install electron-builder --save-dev
```

### 2. 패키징 실행
설치가 완료되면 다음 명령어를 사용하여 앱을 빌드합니다:

- **Mac용 빌드 (.dmg):**
  ```bash
  npm run build:mac
  ```
- **Windows용 빌드 (.exe):**
  ```bash
  npm run build:win
  ```
- **현재 OS 환경에 맞는 기본 빌드:**
  ```bash
  npm run build
  ```

빌드가 완료되면 프로젝트 내에 `dist` 폴더가 생성되며, 해당 폴더 안에서 설치 파일 또는 실행 파일을 확인할 수 있습니다.

## 라이선스
ISC
