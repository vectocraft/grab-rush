#!/bin/sh
# Renders one art scene: scripts/art/render.sh <scene> <out.png> <width> <height>
# The window is larger than the scene; the caller crops the top-left width x height.
ROOT="$(cd "$(dirname "$0")/../.." && pwd -W 2>/dev/null || pwd)"
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars --allow-file-access-from-files \
  --default-background-color=00000000 --window-size="$(($3 + 40)),$(($4 + 200))" --force-device-scale-factor=1 --virtual-time-budget=8000 \
  --screenshot="$2" "file:///$ROOT/scripts/art/art.html#$1:$3:$4" 2>/dev/null
