// Copying a CD on a Mac: the disc's contents, the album's name, and where the copies go.
import test from "node:test"
import assert from "node:assert/strict"
import { albumFrom, copyPlan, lookupUrl, safe, tocFromPlist, trackFiles } from "../beyond_music/server/disc.mjs"
import { trackFrom } from "../beyond_music/server/names.mjs"

// The shape `plutil -convert json` gives a Mac's .TOC.plist, with a data track on the end (an enhanced CD).
const plist = {
  Sessions: [
    {
      "First Track": 1,
      "Last Track": 4,
      "Leadout Block": 120000,
      "Track Array": [
        { Point: 2, "Start Block": 30000, Data: false },
        { Point: 1, "Start Block": 0, Data: false },
        { Point: 3, "Start Block": 61000, Data: false },
        { Point: 4, "Start Block": 100000, Data: true },
      ],
    },
  ],
}

test("the table of contents counts from the lead-in, music tracks only, in order", () => {
  assert.deepEqual(tocFromPlist(plist), { first: 1, last: 3, leadout: 120150, offsets: [150, 30150, 61150] })
  assert.equal(tocFromPlist({}), null)
  assert.equal(tocFromPlist({ Sessions: [{ "Track Array": [] }] }), null)
})

test("MusicBrainz is asked by the disc's contents, never by anything about the household", () => {
  const url = lookupUrl({ first: 1, last: 3, leadout: 120150, offsets: [150, 30150, 61150] })
  assert.match(url, /^https:\/\/musicbrainz\.org\/ws\/2\/discid\/-\?toc=1\+3\+120150\+150\+30150\+61150&/)
  assert.match(url, /fmt=json/)
})

const answer = {
  releases: [
    { id: "a", title: "Wrong one", "artist-credit": [{ name: "X" }], media: [{ position: 1, format: "CD", tracks: [{ title: "Only" }] }] },
    {
      id: "b",
      title: "Tides",
      date: "2018-03-01",
      "artist-credit": [{ name: "Moana", joinphrase: " & " }, { name: "The Waves" }],
      media: [
        { position: 1, format: "CD", tracks: [{ title: "One" }, { title: "Two" }] },
        { position: 2, format: "CD", tracks: [{ title: "Harbour" }, { title: "Reef/Rocks" }, { title: "Shore", "artist-credit": [{ name: "Moana" }] }] },
      ],
    },
  ],
}

test("the album is the release with a disc of exactly that many tracks", () => {
  const a = albumFrom(answer, 3)
  assert.equal(a.id, "b")
  assert.equal(a.artist, "Moana & The Waves")
  assert.equal(a.album, "Tides")
  assert.equal(a.year, 2018)
  assert.equal(a.disc, 2)
  assert.deepEqual(a.tracks.map((t) => t.title), ["Harbour", "Reef/Rocks", "Shore"])
  assert.equal(albumFrom(answer, 9), null)
  assert.equal(albumFrom(null, 3), null)
})

test("copies are named so the library reads them back as the same album", () => {
  const album = { artist: "Moana", album: "Tides", tracks: [{ title: "Harbour", artist: "Moana" }, { title: "Reef/Rocks", artist: "Moana" }] }
  const plan = copyPlan(album, 2)
  assert.deepEqual(plan, [
    { dir: "Moana/Tides", file: "01 Harbour.flac" },
    { dir: "Moana/Tides", file: "02 Reef Rocks.flac" },
  ])
  const back = trackFrom(`${plan[1].dir}/${plan[1].file}`)
  assert.deepEqual([back.artist, back.album, back.track, back.title], ["Moana", "Tides", 2, "Reef Rocks"])
})

test("a disc MusicBrainz doesn't know is still copied, under the day it went in", () => {
  const plan = copyPlan(null, 2, new Date(2026, 9, 27))
  assert.deepEqual(plan[0], { dir: "Unknown artist/Audio CD 27-10-2026", file: "01 Track 1.flac" })
})

test("a compilation goes under Various artists with each artist in the name", () => {
  const album = { artist: "Various Artists", album: "Summer", tracks: [{ title: "A", artist: "Tui" }, { title: "B", artist: "Kea" }] }
  assert.deepEqual(copyPlan(album, 2)[1], { dir: "Various artists/Summer", file: "02 Kea - B.flac" })
})

test("names a folder can hold anywhere", () => {
  assert.equal(safe('AC/DC: "Live"?'), "AC DC Live")
  assert.equal(safe("...hidden"), "hidden")
  assert.equal(safe(""), "Untitled")
})

test("the Mac's track files come in track order", () => {
  assert.deepEqual(trackFiles(["10 Audio Track.aiff", ".TOC.plist", "2 Audio Track.aiff", "1 Audio Track.aiff", "notes.txt"]), [
    "1 Audio Track.aiff",
    "2 Audio Track.aiff",
    "10 Audio Track.aiff",
  ])
})
