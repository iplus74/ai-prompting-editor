#!/bin/bash
# 1. Termux:X11 서버가 꺼져 있다면 백그라운드로 실행
if ! pgrep -f "termux-x11" > /dev/null; then
   echo "Termux:X11 서버를 시작합니다..."
   termux-x11 :0 &
   sleep 2
fi

# 2. Termux:X11 뷰어 앱을 화면으로 자동으로 불러오기
am start -n com.termux.x11/com.termux.x11.MainActivity > /dev/null 2>&1

# 3. 디스플레이 설정 및 바로 앱 실행
echo "마크다운 에디터를 실행합니다..."
export DISPLAY=:0
cd /root/project/ai-prompting-editor
./dist/'Markdown Editor for AI Prompting-1.0.0-arm64.AppImage' --appimage-extract-and-run --no-sandbox --disable-gpu
