# 0003: A Mac first, started by a launch agent; CDs copied with what macOS already has

27/10/2026, Kyle: "run it on my mac first like Plex does, point it to my music directory", with CDs from any USB drive.

## Decision

- `mac/Beyond Music.command` is the Mac's way in: double-click, and it adds Node (Homebrew, or the nodejs.org
  installer), builds the app once, asks where the music is with the Mac's own folder picker, and writes a launch agent
  (`~/Library/LaunchAgents/nz.gobeyond.music.plist`, RunAtLoad and KeepAlive) so it starts with the Mac, the same
  way Plex Media Server does. The folder goes into Settings through `POST /api/places`, so it can be changed there.
  `--stop` takes the agent away and touches nothing else.
- CDs on a Mac use nothing extra: macOS mounts an audio CD as AIFF tracks with a `.TOC.plist`; `afconvert` writes
  FLAC (or the `flac` tool does, or Apple Lossless as the last resort, which Chrome and Google TV can't play, so the
  screen says so). MusicBrainz is asked by the table of contents only (`toc=`), never a disc id worked out here, and
  the cover comes from the Cover Art Archive. Pure parts in `server/disc.mjs`, tested.
- Linux boxes (the Pi) keep abcde.

## Why

A launch agent is the Mac's own, needs no signing and no menu bar app, and is gone with one command. A signed `.app`
needs an Apple Developer ID and notarising, which can come later.

## Not yet

Neither the script nor the Mac copy has run on a real Mac: the script was run against stand-ins for `launchctl`,
`osascript` and `open` on Linux. macOS may ask once to let Node read a CD or an external drive.
