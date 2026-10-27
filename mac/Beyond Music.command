#!/bin/bash
# Beyond Music on a Mac. Double-click this file (the first time: right-click it, then Open).
#
# It checks the Mac has Node, builds the app once, asks where your music is, and sets Beyond Music to start
# whenever you log in, the way Plex's media server does. Then it opens it in your browser. Running it again just
# opens it. To stop it and stop it starting with the Mac:  "mac/Beyond Music.command" --stop
#
# Not yet run on a real Mac: the first run is its first test.

set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
LABEL="nz.gobeyond.music"
AGENT="$HOME/Library/LaunchAgents/$LABEL.plist"
DATA="$HOME/.beyond-music"
PORT=8097
URL="http://localhost:$PORT"

say() { printf '\n  %s\n' "$*"; }
stop() {
  launchctl bootout "gui/$(id -u)" "$AGENT" 2>/dev/null || true
  rm -f "$AGENT"
}

if [ "${1:-}" = "--stop" ]; then
  stop
  say "Beyond Music is stopped and won't start with the Mac any more. Your music hasn't been touched."
  exit 0
fi

# Node 22 or newer: whatever the Mac has, else Homebrew's, else ask for it.
NODE="$(command -v node || true)"
for n in /opt/homebrew/bin/node /usr/local/bin/node; do [ -z "$NODE" ] && [ -x "$n" ] && NODE="$n"; done
major() { "$1" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }
if [ -z "$NODE" ] || [ "$(major "$NODE")" -lt 22 ]; then
  BREW="$(command -v brew || ls /opt/homebrew/bin/brew /usr/local/bin/brew 2>/dev/null | head -1 || true)"
  if [ -n "$BREW" ]; then
    say "Adding Node, which Beyond Music runs on. This takes a minute."
    "$BREW" install node
    NODE="$("$BREW" --prefix)/bin/node"
  else
    say "Beyond Music needs Node, a free program. Your browser is opening its download page:"
    say "pick the macOS Installer, run it, then double-click Beyond Music again."
    open "https://nodejs.org/en/download"
    exit 1
  fi
fi
export PATH="$(dirname "$NODE"):$PATH"

# The app, built once (and again after an update brings new screens).
WEB="$ROOT/beyond_music/web"
if [ ! -f "$WEB/dist/index.html" ] || [ -n "$(find "$WEB/src" "$WEB/index.html" -newer "$WEB/dist/index.html" -print -quit)" ]; then
  say "Getting the app ready. Only the first time, about a minute."
  (cd "$WEB" && npm ci --no-audit --no-fund --loglevel=error && npm run build:box >/dev/null)
fi

# Start with the Mac: a launch agent, the Mac's own way, kept running if it ever stops.
mkdir -p "$DATA" "$(dirname "$AGENT")"
x() { printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }
cat >"$AGENT" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$(x "$NODE")</string><string>$(x "$ROOT/beyond_music/server/main.mjs")</string></array>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>$(x "$(dirname "$NODE")"):/usr/bin:/bin:/usr/sbin:/sbin</string><key>PORT</key><string>$PORT</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$(x "$DATA/log.txt")</string>
  <key>StandardErrorPath</key><string>$(x "$DATA/log.txt")</string>
</dict>
</plist>
PLIST
stop_quietly() { launchctl bootout "gui/$(id -u)" "$AGENT" 2>/dev/null || true; }
stop_quietly
launchctl bootstrap "gui/$(id -u)" "$AGENT"

for _ in $(seq 1 40); do curl -fs "$URL/api/hello" >/dev/null 2>&1 && break; sleep 0.5; done
if ! curl -fs "$URL/api/hello" >/dev/null 2>&1; then
  say "Beyond Music didn't start. What it said is in $DATA/log.txt"
  exit 1
fi

# Where the music is, asked once. The folder goes into Settings, where it can be changed or more added.
if [ ! -f "$DATA/asked-for-music" ]; then
  FOLDER="$(osascript -e 'POSIX path of (choose folder with prompt "Where is your music? Pick the folder Beyond Music plays from. You can add more later in Settings." default location (path to music folder))' 2>/dev/null || true)"
  if [ -n "$FOLDER" ]; then
    BODY="$("$NODE" -e 'process.stdout.write(JSON.stringify({ path: process.argv[1].replace(/\/$/, "") }))' "$FOLDER")"
    curl -fs -X POST -H 'content-type: application/json' --data "$BODY" "$URL/api/places" >/dev/null ||
      say "That folder couldn't be added. Add it in Beyond Music's Settings instead."
  fi
  touch "$DATA/asked-for-music"
fi

ADDRESS="$(curl -fs "$URL/api/hello" | "$NODE" -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s).addresses||[];process.stdout.write(a[0]||"")})')"
say "Beyond Music is running, and starts by itself whenever this Mac does."
say "On this Mac: $URL"
[ -n "$ADDRESS" ] && say "On your phone or TV, on the same Wi-Fi: http://beyond-music.local:$PORT  (or $ADDRESS)"
open "$URL"
