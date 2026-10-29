# 0005: A USB stick for Pioneer decks, written by us, behind a labs switch

29/10/2026. Kyle: "like rekordbox and allow sync to USB for pioneer usb djs".

## Decision

Beyond Music writes the stick itself: songs in `Contents/<artist>/<album>/`, and the library the players read in
`PIONEER/rekordbox/export.pdb`, written by `server/pdb.mjs` from Crate Digger's public description of the format (the
same one REX and rekordcrate use). No rekordbox, no Pioneer code, nothing unlocked.

- It sits behind a labs switch (`usb` in `store.LABS`), shown in Settings only with `?labs` on the address, until it
  has been tried on real decks and Kyle's lawyer has read the law notes.
- `PIONEER/beyond-music.json` lists what we put on the stick, so the next copy removes only those songs when they are
  no longer chosen and never touches anything else.
- A stick that already has a rekordbox library asks first, and keeps that library as `export.pdb.rekordbox-backup`.
- Tempos come from DJ mode (the browser sends what it has found). Waveforms, beat grids and cue points need the
  ANLZ files, which come next.

## Why

The other ways need rekordbox on a computer, which a household box doesn't have. Writing the file is a few hundred
lines with no packages, and a reader written separately from the description checks it in the tests.

## Not yet known

How every player reads it: REX's own notes say its files work "to varying degrees" on devices. The first real CDJ or
XDJ is the real test.
