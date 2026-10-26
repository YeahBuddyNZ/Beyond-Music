# 0001: Our own small server, not Navidrome, Jellyfin or Plex

Accepted, 26/10/2026. Asked for by Kyle: "an app like Plex to turn any box, or anything, into this centre ... less
hardware, using hardware that already exists ... an app like Spotify to play it, or scroll using the TV."

## Decision

Beyond Music is a plain Node 22 server with no packages, plus a React app it serves. It runs anywhere Node runs: the
Home Assistant box (as an app, like Beyond Home), Docker on a NAS, or any computer.

## Why

- **Any box:** Navidrome is a Go binary and Jellyfin is .NET with ffmpeg; both are fine on a NAS and heavy or awkward
  on a Home Assistant box or a Pi, and their screens aren't ours. Plex needs an account with Plex and sends usage to it.
- **Ours to shape:** the TV remote, the brand, plain words, Beyond TV opening it from a button, and the law's lines
  built in (ADR 0002) all need the screens and the server to be ours.
- **Not cut off from the rest:** the server speaks Subsonic at `/rest`, the same language as Navidrome, so dozens of
  existing apps (and the car through them) work with it already.

## What it costs

We read tags ourselves (ID3, FLAC, Vorbis, MP4; tested against real files) and there's no transcoding: a file a TV
can't play natively won't play until we add an ffmpeg step on boxes that have it.
