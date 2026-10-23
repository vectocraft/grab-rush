#!/bin/sh
# Usage: scripts/shot.sh <page-relative-path[#hash]> <out.png> [ms]
ROOT="$(cd "$(dirname "$0")/.." && pwd -W 2>/dev/null || pwd)"
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars --allow-file-access-from-files \
  --window-size=${W:-540},${H:-1170} --force-device-scale-factor=${4:-1} --virtual-time-budget="${3:-3000}" --screenshot="$2" "file:///$ROOT/$1" 2>/dev/null
