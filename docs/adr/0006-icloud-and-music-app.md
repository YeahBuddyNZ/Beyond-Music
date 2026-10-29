# 0006: iCloud Drive and the Music app on a Mac, one way; the USB stick for everyone

29/10/2026. Kyle: "We should allow for iCloud and music sync", and on the USB stick, "Don't wait for a lawyer."

## Decision

- On a Mac, Settings offers iCloud Drive and the Music app's own folder as places with one tap. Nothing new to sign
  in to: the Mac is already signed in to iCloud.
- Songs iCloud is still holding (the `.Song.mp3.icloud` stand-ins) are counted and asked down with `brctl download`,
  the Mac's own tool, and the box looks again three minutes later.
- The Music app's playlists come across from the Library.xml it shares (its Settings, Files, *Share Library XML with
  other applications*) after every look for new music. One way only: the Music app is never written to, and those
  playlists are read only on the box, so the two never disagree.
- Songs from an Apple Music subscription are locked to Apple's apps (FairPlay). They are counted and the screen says
  so; they are never played or unlocked.
- The USB stick for DJ decks (ADR 0005) leaves the labs switch and shows in Settings for everyone. The switch is gone.

## Why

The Library.xml is the Music app's own way of sharing its library with other programs, so no AppleScript permission
prompts and nothing that breaks when Apple changes the app. Two-way sync would mean writing to the Music app, which
it has no supported way in for.

## Not yet known

Newer macOS keeps some iCloud files as full-size files that fetch when opened rather than as `.icloud` stand-ins:
those are read like any other file, and reading them brings them down. Not yet run on a real Mac.
