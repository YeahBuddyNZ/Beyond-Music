# Beyond Music: notes for Claude

The house's media centre on hardware people already own: your music, videos and radio on every phone, computer and TV.
Part of the Beyond tools with Beyond TV (YeahBuddyNZ/Beyond.TV), Beyond Home (YeahBuddyNZ/Beyond-Home), Beyond Gateway
and Beyond Family. Tagline "Free your world".

## Ours

- **Writing:** New Zealand English everywhere (copy, comments, commits). No em dashes. Dates DD/MM/YYYY. Brand is "Beyond™".
- **Brand:** the same purple as Beyond Home and gobeyond.nz, dark by default (`class="dark"` on `<html>`): void
  `#0D0C18`, chrome `#2C2458`, lilac `#9E7BFF` for the one thing to press. Four dots as the mark. Sora for display type.
  Tokens live once, in `beyond_music/web/src/index.css`.
- **People aren't technical.** Albums, songs and shows, never file paths, codecs or ports on a screen (Settings' folder
  list is the one place a path shows).
- **The TV remote comes first:** everything must work with arrows, OK and Back (`lib/tv.ts`). Something always has focus.
- **The law (docs/law.md) is code, not copy.** Never add: DVD or Blu-ray ripping or anything that breaks copy
  protection, torrents, indexers or downloads from sharing sites, sharing outside the house network, lyrics, or sending
  what anybody plays off the box. Kyle runs the law past a lawyer; anything new near those lines goes to him first.
- **No made-up music in real data**, and never real family names: `web/src/mock.js` uses made-up artists only.

## The code

- `beyond_music/server/` is plain Node 22 with no packages. `main.mjs` serves the app and `/api/*`, only to private
  addresses with a house-network Host (DNS rebinding) and a house-network Origin or `null` (Beyond TV's file:// pages);
  writes need `Content-Type: application/json`. `tags.mjs` reads tags by hand (ID3, FLAC, Vorbis, MP4), `names.mjs`
  holds the pure naming rules, `library.mjs` scans (incremental by mtime and size), `store.mjs` keeps places,
  playlists and the apps password, `subsonic.mjs` is the `/rest` door for other apps, `mdns.mjs` answers
  `beyond-music.local`, `cd.mjs` copies CDs (on a Mac with `afconvert` and MusicBrainz by table of contents, pure parts in `disc.mjs`; elsewhere abcde), `mac/Beyond Music.command` starts it on a Mac as a launch agent (ADR 0003), `radio.mjs` asks Radio Browser.
- File paths never leave the box: tracks and videos go out by id (`library.view.where`).
- `beyond_music/web/` is React 19, Vite and Tailwind v4 with ReUI (`base-nova` on Base UI), copied from Beyond Home.
  Every visible part comes from `components/ui` or `components/reui` (installed output: compose, never edit).
- Only `web/src/api.ts` talks to the box (a test checks). Pure decisions are in `web/src/lib/pure.js`, plain JavaScript
  so `node --test` runs it. `lib/player.ts` is the one player, `lib/store.ts` the library, `lib/tv.ts` the remote.
- DJ mode (`#dj`, ADR 0004, lazy): `lib/dj.ts` is two decks in an AudioWorklet (the whole song held in memory, any
  speed, backwards, loops), the EQ and crossfader in Web Audio; `lib/djpure.js` holds the maths (tempo, sync,
  crossfader, platter, MIDI), tested in `tests/dj.test.mjs`; `lib/midi.ts` learns a controller over Web MIDI (Safari
  has none). Cues and the MIDI mapping stay in this browser's storage. Never record or stream a mix off the box.
  `?preview` runs against `mock.js`; `npm run build:box` leaves it out. `?box=http://ip:8097` lets Beyond TV open the
  app from its own files.
- Checks: `sh tests/run.sh`; `cd beyond_music/web && npm run build:box`. GitHub Actions minutes may be out: run both
  locally before merging.
- Not yet run on a real Home Assistant box, a real CD drive, or a TV: say so when reporting.
