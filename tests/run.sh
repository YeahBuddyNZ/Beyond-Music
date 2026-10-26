#!/bin/sh
# Every test. Usage: sh tests/run.sh
set -e
cd "$(dirname "$0")/.."
for f in beyond_music/server/*.mjs; do node --check "$f"; done
node --test tests/*.test.mjs
