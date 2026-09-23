#!/usr/bin/env bash
# Baut das Windows-Programm lokal und teilt es in Stücke unter 30 MB, weil der
# Chat keine grösseren Dateien überträgt. Dazu eine .bat, die unter Windows
# zusammensetzt und die Prüfsumme zeigt. Die .exe gehört nie ins Repo.
# Aufruf: tools/split-exe.sh   → Dateien in apps/desktop/release/
set -eu
cd "$(dirname "$0")/../apps/desktop"
[ -d node_modules ] || npm ci
rm -rf release
npm run web
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --win portable --x64 --publish never -c.win.signAndEditExecutable=false
cd release
N="FPV-OPS-v$(date +%m%d-%H%M)"
split -b 25M -d -a 3 --numeric-suffixes=1 FPV-OPS-*-portable.exe "$N.exe."
H=$(sha256sum FPV-OPS-*-portable.exe | cut -d' ' -f1)
LIST=$(ls "$N".exe.0* | sed 's/.*/"&"/' | paste -sd' ')
PARTS=$(ls "$N".exe.0* | sed 's/.*/"&"/' | paste -sd+)
printf '@echo off\r\ncd /d "%%~dp0"\r\nfor %%%%f in (%s) do if not exist %%%%f (echo Es fehlt: %%%%f & pause & exit /b 1)\r\ncopy /b %s "%s.exe" >nul\r\necho %s.exe erstellt. Pruefsumme:\r\ncertutil -hashfile "%s.exe" SHA256 | findstr /v /i "hash"\r\necho Erwartet:\r\necho %s\r\npause\r\n' \
  "$LIST" "$PARTS" "$N" "$N" "$N" "$H" > "$N-zusammensetzen.bat"
ls -1 "$N"*
echo "SHA256 $H"
