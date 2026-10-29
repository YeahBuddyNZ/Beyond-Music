// The Pioneer stick's library file (beyond_music/server/pdb.mjs), read back the way a player reads it: a reader
// written from Crate Digger's description of the format, not from our writer.
import test from "node:test"
import assert from "node:assert/strict"
import { pdbString, TABLES, writePdb } from "../beyond_music/server/pdb.mjs"

function readString(buf, at) {
  const kind = buf[at]
  if (kind & 1) return buf.toString("latin1", at + 1, at + (kind >> 1))
  const len = buf.readUInt16LE(at + 1)
  if (kind === 0x40) return buf.toString("latin1", at + 4, at + len)
  if (kind === 0x90) return buf.toString("utf16le", at + 4, at + len)
  throw new Error(`string kind ${kind}`)
}

function read(file) {
  const len = file.readUInt32LE(4)
  const count = file.readUInt32LE(8)
  const tables = []
  for (let i = 0; i < count; i++) {
    const at = 0x1c + i * 16
    tables.push({ type: file.readUInt32LE(at), candidate: file.readUInt32LE(at + 4), first: file.readUInt32LE(at + 8), last: file.readUInt32LE(at + 12) })
  }
  const rows = {}
  const pagesSeen = []
  for (const t of tables) {
    rows[t.type] = []
    let index = t.first
    for (let guard = 0; guard < 10000; guard++) {
      const p = file.subarray(index * len, index * len + len)
      assert.equal(p.length, len, `page ${index} is in the file`)
      assert.equal(p.readUInt32LE(4), index, "a page knows its own number")
      assert.equal(p.readUInt32LE(8), t.type, "a page is its table's type")
      pagesSeen.push(index)
      const flags = p[0x1b]
      if ((flags & 0x40) === 0) {
        const bits = p[0x18] | (p[0x19] << 8) | (p[0x1a] << 16)
        const offsets = bits & 0x1fff
        const present = bits >> 13
        assert.equal(offsets, present)
        const groups = Math.floor((offsets - 1) / 16) + 1
        assert.equal(p.readUInt16LE(0x1c) + p.readUInt16LE(0x1e) + groups * 0x24, len - 0x28, "free and used add up")
        for (let g = 0; g < groups; g++) {
          const base = len - g * 0x24
          const flagsHere = p.readUInt16LE(base - 4)
          for (let i = 0; i < 16; i++) {
            if (!((flagsHere >> i) & 1)) continue
            const ofs = p.readUInt16LE(base - (6 + 2 * i))
            rows[t.type].push({ page: p, at: 0x28 + ofs })
          }
        }
      } else assert.equal(flags, 0x64, "the first page is an index page")
      if (index === t.last) break
      index = p.readUInt32LE(0x0c)
    }
  }
  return { len, tables, rows, pagesSeen, nextUnused: file.readUInt32LE(0x0c) }
}

const track = (r) => {
  const { page: p, at } = r
  const s = (i) => readString(p, at + p.readUInt16LE(at + 0x5e + i * 2))
  return {
    subtype: p.readUInt16LE(at),
    fileSize: p.readUInt32LE(at + 16),
    tempo: p.readUInt32LE(at + 56),
    genreId: p.readUInt32LE(at + 60),
    albumId: p.readUInt32LE(at + 64),
    artistId: p.readUInt32LE(at + 68),
    id: p.readUInt32LE(at + 72),
    year: p.readUInt16LE(at + 80),
    duration: p.readUInt16LE(at + 84),
    fileType: p.readUInt16LE(at + 90),
    title: s(17),
    fileName: s(19),
    filePath: s(20),
    dateAdded: s(10),
    autoload: s(7),
  }
}
const artist = ({ page: p, at }) => ({ subtype: p.readUInt16LE(at), id: p.readUInt32LE(at + 4), name: readString(p, at + p[at + 9]) })
const album = ({ page: p, at }) => ({ subtype: p.readUInt16LE(at), artistId: p.readUInt32LE(at + 8), id: p.readUInt32LE(at + 12), name: readString(p, at + p[at + 21]) })
const playlist = ({ page: p, at }) => ({ parent: p.readUInt32LE(at), sort: p.readUInt32LE(at + 8), id: p.readUInt32LE(at + 12), folder: p.readUInt32LE(at + 16), name: readString(p, at + 20) })
const entry = ({ page: p, at }) => ({ index: p.readUInt32LE(at), trackId: p.readUInt32LE(at + 4), playlistId: p.readUInt32LE(at + 8) })

const sample = (n = 3) => ({
  artists: [{ id: 1, name: "The Made-Up Band" }, { id: 2, name: "Tūī Sound System" }],
  albums: [{ id: 1, name: "Pretend Summer", artistId: 1 }],
  genres: [{ id: 1, name: "House" }],
  tracks: Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    title: `Song number ${i + 1}`,
    artistId: (i % 2) + 1,
    albumId: 1,
    genreId: 1,
    trackNumber: i + 1,
    year: 2024,
    duration: 200 + i,
    bpm: 124.5,
    fileSize: 5_000_000 + i,
    ext: i % 3 === 0 ? "flac" : "mp3",
    filePath: `/Contents/The Made-Up Band/Pretend Summer/${String(i + 1).padStart(2, "0")} Song number ${i + 1}.${i % 3 === 0 ? "flac" : "mp3"}`,
    dateAdded: "2026-10-29",
  })),
  playlists: [{ id: 1, name: "Saturday warm up", trackIds: [3, 1, 2] }],
})

test("strings: short, long and with macrons", () => {
  for (const s of ["", "House", "x".repeat(126), "y".repeat(300), "Tūī Sound System", "￺GENRE￻"]) {
    assert.equal(readString(pdbString(s), 0), s)
  }
  assert.equal(pdbString("")[0], 3, "an empty string is the one byte 03")
  assert.equal(pdbString("x".repeat(127))[0], 0x40, "past 126 plain letters it takes the long form")
})

test("every table is there, in rekordbox's order, and the pages link up", () => {
  const db = read(writePdb(sample()))
  assert.equal(db.len, 4096)
  assert.deepEqual(db.tables.map((t) => t.type), Object.values(TABLES))
  assert.equal(new Set(db.pagesSeen).size, db.pagesSeen.length, "no page belongs to two tables")
  for (const t of db.tables) assert.ok(t.candidate >= 1 && t.first >= 1 && t.last >= t.first)
  assert.ok(db.nextUnused > Math.max(...db.pagesSeen))
})

test("songs, artists, albums and playlists read back", () => {
  const db = read(writePdb(sample()))
  const tracks = db.rows[TABLES.tracks].map(track)
  assert.equal(tracks.length, 3)
  const t1 = tracks.find((t) => t.id === 1)
  assert.equal(t1.subtype, 0x24)
  assert.equal(t1.title, "Song number 1")
  assert.equal(t1.tempo, 12450, "the tempo is beats a minute times 100")
  assert.equal(t1.fileType, 5, "FLAC")
  assert.equal(tracks.find((t) => t.id === 2).fileType, 1, "MP3")
  assert.equal(t1.filePath, "/Contents/The Made-Up Band/Pretend Summer/01 Song number 1.flac")
  assert.equal(t1.fileName, "01 Song number 1.flac")
  assert.equal(t1.dateAdded, "2026-10-29")
  assert.equal(t1.autoload, "ON")
  assert.equal(t1.duration, 200)
  assert.deepEqual(db.rows[TABLES.artists].map(artist).map((a) => [a.subtype, a.id, a.name]), [[0x60, 1, "The Made-Up Band"], [0x60, 2, "Tūī Sound System"]])
  assert.deepEqual(db.rows[TABLES.albums].map(album), [{ subtype: 0x80, artistId: 1, id: 1, name: "Pretend Summer" }])
  assert.deepEqual(db.rows[TABLES.playlistTree].map(playlist), [{ parent: 0, sort: 0, id: 1, folder: 0, name: "Saturday warm up" }])
  assert.deepEqual(db.rows[TABLES.playlistEntries].map(entry), [{ index: 1, trackId: 3, playlistId: 1 }, { index: 2, trackId: 1, playlistId: 1 }, { index: 3, trackId: 2, playlistId: 1 }])
})

test("the players' own tables are filled as rekordbox fills them", () => {
  const db = read(writePdb(sample(0)))
  assert.equal(db.rows[TABLES.tracks].length, 0)
  assert.equal(db.rows[TABLES.colors].length, 8)
  const cols = db.rows[TABLES.columns].map(({ page, at }) => readString(page, at + 4))
  assert.equal(cols.length, 27)
  assert.equal(cols[0], "￺GENRE￻")
  assert.equal(db.rows[TABLES.unknown17].length, 22)
  assert.equal(db.rows[TABLES.unknown18].length, 17)
})

test("a big library spreads over many pages and every song comes back once", () => {
  const db = read(writePdb(sample(1500)))
  const ids = db.rows[TABLES.tracks].map(track).map((t) => t.id).sort((a, b) => a - b)
  assert.equal(ids.length, 1500)
  assert.deepEqual(ids, Array.from({ length: 1500 }, (_, i) => i + 1))
  const trackPages = new Set(db.rows[TABLES.tracks].map((r) => r.page.readUInt32LE(4)))
  assert.ok(trackPages.size > 20, `${trackPages.size} pages`)
  assert.equal(db.rows[TABLES.playlistEntries].length, 3)
})
