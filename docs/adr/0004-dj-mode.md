# 0004: DJ mode in the browser, and a controller learnt one control at a time

28/10/2026, Kyle: "like rekordbox ... dj mode with platters and midi control".

## Decision

- DJ mode is a screen of the app (`#dj`), loaded only when opened, for a computer. Two decks and a mixer run in the
  browser's own audio engine: each deck is an AudioWorklet holding the whole song, so it plays at any speed, backwards
  under a hand on the platter, eases up and down like a turntable's motor, and loops on the beat. EQ is three filters
  per deck; the crossfader is smooth (even loudness) or sharp.
- The tempo and the first beat are found in the browser as a song loads (onsets, then the tempo whose beats land on
  the most onsets), kept to 78 to 156 BPM. Nothing about the song is sent anywhere.
- A controller is learnt, not listed: press Learn, move the control. Any USB MIDI controller works without us keeping a
  list of models, and the mapping stays in that browser. Web MIDI is in Chrome, Edge and Firefox, not Safari, and the
  screen says so.
- Cues and hot cues are kept in the browser per song for now. They move to the box with the USB export, which needs them.

## Why

A mix has to answer a hand on the platter within a few milliseconds; holding the song in the audio thread is the only
way a browser does that. Learning controls keeps the code free of anybody's mapping files.

## Next

Copying to a USB stick for Pioneer DJ players (a rekordbox style library: `PIONEER/rekordbox/export.pdb` and the
analysis files). That writes a file format Pioneer never published, worked out by others for interoperability; Kyle
runs that past the lawyer with docs/law.md before it ships. The names Pioneer DJ and rekordbox are AlphaTheta's and
only describe what a stick works with.
