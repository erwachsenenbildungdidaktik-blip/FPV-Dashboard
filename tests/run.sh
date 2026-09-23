#!/usr/bin/env bash
# Startet die App lokal auf Port 8765 und führt alle Browser-Tests aus.
# Voraussetzung: Node und Playwright (global oder im Projekt) mit Chromium.
set -u
cd "$(dirname "$0")/.."
python3 -m http.server 8765 >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
sleep 1
fail=0
for t in tests/e2e/*.test.js; do
  res=$(node "$t" 2>&1 | tail -1)
  printf '%-32s %s\n' "$(basename "$t")" "$res"
  [ "$res" = "ALLES GRÜN" ] || fail=1
done
exit $fail
