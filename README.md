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
   > **팁 (Linux / 안드로이드 Termux + Ubuntu 환경):**
   > 컨테이너나 PRoot 환경에서는 샌드박스 관련 에러가 발생할 수 있습니다. 리눅스 환경에서는 `--no-sandbox` 플래그를 추가하여 실행해 주세요:
   > ```bash
   > npm start -- --no-sandbox
   > ```
   > *(참고: GUI 화면 출력을 위해 X11 또는 VNC와 같은 디스플레이 서버 설정과 Chrome 구동을 위한 리눅스 시스템 패키지 설치가 필요합니다.)*

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
- **Linux용 빌드 (.AppImage):**
  ```bash
  npm run build:linux
  ```
- **현재 OS 환경에 맞는 기본 빌드:**
  ```bash
  npm run build
  ```

빌드가 완료되면 프로젝트 내에 `dist` 폴더가 생성되며, 해당 폴더 안에서 설치 파일 또는 실행 파일을 확인할 수 있습니다.

> **팁 (Linux 빌드 결과물 실행 시):**
> 리눅스 빌드 결과물인 `.AppImage` 파일을 실행할 때에도, Termux + Ubuntu와 같은 환경에서는 샌드박스 비활성화가 필요합니다. 빌드된 파일이 위치한 경로에서 다음과 같이 실행해 주세요:
> ```bash
> ./dist/"Markdown Editor for AI Prompting-1.0.0-arm64.AppImage" --appimage-extract-and-run --no-sandbox
> ```

> Termux:X11 + Termux + Ubuntu 환경에서 앱 자동 실행 스크립트
> ```bash
> ./run-editor.sh
> ```

## 라이선스
ISC
