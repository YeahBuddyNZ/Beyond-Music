// The library file Pioneer's DJ players read off a USB stick: PIONEER/rekordbox/export.pdb. Pioneer never
// published the format; it was worked out by the Deep Symmetry project (Crate Digger) so other software can talk
// to the players, and REX showed which of the unknown values the players and rekordbox expect. Pure: give it the
// songs and playlists, it hands back the bytes. tests/pdb.test.mjs reads them back the way a player would.
//
// The file is 4096-byte pages. Page 0 lists the tables. Each table starts with an index page, then data pages
// holding rows in a heap from the front and a row index growing back from the end, sixteen rows to a group.

const PAGE = 4096
const HEAD = 0x28 // a data page's header; row offsets count from here
const GROUP = 0x24 // sixteen row offsets, the rows-present flags and the last-written flags
const EMPTY = 0x03ffffff

// Every table rekordbox writes, in its order. The player expects all twenty, empty or not.
export const TABLES = { tracks: 0, genres: 1, artists: 2, albums: 3, labels: 4, keys: 5, colors: 6, playlistTree: 7, playlistEntries: 8, unknown9: 9, unknown10: 10, historyPlaylists: 11, historyEntries: 12, artwork: 13, unknown14: 14, unknown15: 15, columns: 16, unknown17: 17, unknown18: 18, history: 19 }

// The kinds of file the players can play, and the number each one is known by.
export const FILE_TYPES = { mp3: 0x1, m4a: 0x4, aac: 0x4, flac: 0x5, wav: 0xb, aif: 0xc, aiff: 0xc }

// A string the DeviceSQL way: short plain text with its length folded into one byte, anything longer or not
// plain ASCII with a four-byte header (UTF-16 for anything with a macron or an accent).
export function pdbString(s) {
  s = String(s ?? "")
  if (/^[\x00-\x7f]*$/.test(s)) {
    const text = Buffer.from(s, "latin1")
    if (text.length <= 126) return Buffer.concat([Buffer.from([((text.length + 1) << 1) | 1]), text])
    const head = Buffer.alloc(4)
    head.writeUInt8(0x40, 0)
    head.writeUInt16LE(text.length + 4, 1)
    return Buffer.concat([head, text])
  }
  const text = Buffer.from(s, "utf16le")
  const head = Buffer.alloc(4)
  head.writeUInt8(0x90, 0)
  head.writeUInt16LE(text.length + 4, 1)
  return Buffer.concat([head, text])
}

// A fixed part made of little-endian numbers: [[bytes, value], ...].
function fixed(fields) {
  const out = Buffer.alloc(fields.reduce((n, [size]) => n + size, 0))
  let at = 0
  for (const [size, value] of fields) {
    const v = Number(value) || 0
    if (size === 1) out.writeUInt8(v & 0xff, at)
    else if (size === 2) out.writeUInt16LE(v & 0xffff, at)
    else out.writeUInt32LE(v >>> 0, at)
    at += size
  }
  return out
}

const u16 = (v) => [2, v]
const u32 = (v) => [4, v]
const clampU16 = (v) => Math.max(0, Math.min(0xffff, Math.round(Number(v) || 0)))

// The strings a track row points at, in the row's order. The ones we don't know stay empty.
const TRACK_STRINGS = ["isrc", "texter", "keyAnalysed", "phraseAnalysed", "u4", "message", "kuvoPublic", "autoloadHotCues", "u5", "u6", "dateAdded", "releaseDate", "mixName", "u7", "analysePath", "analyseDate", "comment", "title", "u8", "fileName", "filePath"]

function trackRow(t, shift) {
  const head = fixed([
    u16(0x24), u16(shift), u32(0xc0700), u32(t.sampleRate || 44100), u32(0), u32(t.fileSize),
    u32(0), u16(0x758a), u16(0x57a2), // values rekordbox writes, purpose unknown
    u32(0), u32(0), u32(0), u32(0), u32(0), // artwork, key, original artist, label, remixer
    u32(t.bitrate), u32(t.trackNumber), u32(Math.round((t.bpm || 0) * 100)), u32(t.genreId), u32(t.albumId), u32(t.artistId), u32(t.id),
    u16(t.disc), u16(0), u16(t.year), u16(t.sampleDepth || 16), u16(clampU16(t.duration)), u16(0x29),
    [1, 0], [1, 0], // colour, rating
    u16(FILE_TYPES[t.ext] || 0), u16(3),
  ])
  const values = {
    keyAnalysed: "1",
    phraseAnalysed: "1",
    autoloadHotCues: "ON",
    dateAdded: t.dateAdded || "",
    title: t.title,
    fileName: t.filePath.split("/").pop(),
    filePath: t.filePath,
  }
  const strings = []
  const offsets = Buffer.alloc(TRACK_STRINGS.length * 2)
  let at = head.length + offsets.length
  TRACK_STRINGS.forEach((name, i) => {
    const s = pdbString(values[name] || "")
    offsets.writeUInt16LE(at, i * 2)
    strings.push(s)
    at += s.length
  })
  return Buffer.concat([head, offsets, ...strings])
}

const artistRow = (a, shift) => Buffer.concat([fixed([u16(0x60), u16(shift), u32(a.id), [1, 3], [1, 0x0a]]), pdbString(a.name)])
const albumRow = (a, shift) => Buffer.concat([fixed([u16(0x80), u16(shift), u32(0), u32(a.artistId), u32(a.id), u32(0), [1, 3], [1, 0x16]]), pdbString(a.name)])
const genreRow = (g) => Buffer.concat([fixed([u32(g.id)]), pdbString(g.name)])
const playlistRow = (p) => Buffer.concat([fixed([u32(0), u32(0), u32(p.sort), u32(p.id), u32(0)]), pdbString(p.name)])
const entryRow = (e) => fixed([u32(e.index), u32(e.trackId), u32(e.playlistId)])

// Tables rekordbox always fills the same way: the colour labels, the players' browse menu and two tables that
// go with it. Values as rekordbox writes them (read by REX from fresh exports).
const COLOURS = ["Pink", "Red", "Orange", "Yellow", "Green", "Aqua", "Blue", "Purple"]
const COLUMNS = [[1, 0x80, "GENRE"], [2, 0x81, "ARTIST"], [3, 0x82, "ALBUM"], [4, 0x83, "TRACK"], [5, 0x85, "BPM"], [6, 0x86, "RATING"], [7, 0x87, "YEAR"], [8, 0x88, "REMIXER"], [9, 0x89, "LABEL"], [10, 0x8a, "ORIGINAL ARTIST"], [11, 0x8b, "KEY"], [12, 0x8d, "CUE"], [13, 0x8e, "COLOR"], [14, 0x92, "TIME"], [15, 0x93, "BITRATE"], [16, 0x94, "FILE NAME"], [17, 0x84, "PLAYLIST"], [18, 0x98, "HOT CUE BANK"], [19, 0x95, "HISTORY"], [20, 0x91, "SEARCH"], [21, 0x96, "COMMENTS"], [22, 0x8c, "DATE ADDED"], [23, 0x97, "DJ PLAY COUNT"], [24, 0x90, "FOLDER"], [25, 0xa1, "DEFAULT"], [26, 0xa2, "ALPHABET"], [27, 0xaa, "MATCHING"]]
const UNKNOWN17 = [[1, 1, 0x163, 0], [5, 6, 0x105, 0], [6, 7, 0x163, 0], [7, 8, 0x163, 0], [8, 9, 0x163, 0], [9, 10, 0x163, 0], [10, 11, 0x163, 0], [13, 15, 0x163, 0], [14, 19, 0x104, 0], [15, 20, 0x106, 0], [16, 21, 0x163, 0], [18, 23, 0x163, 0], [2, 2, 2, 1], [3, 3, 3, 2], [4, 4, 1, 3], [11, 12, 0x63, 4], [17, 5, 0x63, 5], [19, 22, 0x63, 6], [20, 18, 0x63, 7], [27, 26, 0x263, 8], [24, 17, 0x63, 9], [22, 27, 0x63, 10]]
const UNKNOWN18 = [[1, 6, 1, 0], [21, 7, 1, 0], [14, 8, 1, 0], [8, 9, 1, 0], [9, 10, 1, 0], [10, 11, 1, 0], [15, 13, 1, 0], [13, 15, 1, 0], [23, 16, 1, 0], [22, 17, 1, 0], [25, 0, 0x100, 0], [26, 1, 0x200, 0], [2, 2, 0x302, 0], [3, 3, 0x400, 0], [5, 4, 0x500, 0], [6, 5, 0x600, 0], [11, 12, 0x700, 0]]

const colourRows = () => COLOURS.map((name, i) => Buffer.concat([fixed([u32(0), [1, i + 1], u16(i + 1), [1, 0]]), pdbString(name)]))
const columnRows = () => COLUMNS.map(([id, kind, name]) => Buffer.concat([fixed([u16(id), u16(kind)]), pdbString(`￺${name}￻`)]))
const fourRows = (list) => list.map((v) => fixed(v.map(u16)))

// Lays rows into data pages. Each row is padded to four bytes; a page is full when the next row and its
// share of the row index would meet.
function pack(rows) {
  const pad = (n) => (n + 3) & ~3
  const fits = (page, n) => page.used + n + Math.ceil((page.rows.length + 1) / 16) * GROUP <= PAGE - HEAD
  const pages = []
  let page = { rows: [], used: 0 }
  for (const make of rows) {
    let row = make(page.rows.length * 0x20)
    if (!fits(page, pad(row.length)) && page.rows.length) {
      pages.push(page)
      page = { rows: [], used: 0 }
      row = make(0)
    }
    if (!fits(page, pad(row.length))) throw new Error("A song's details are too long for the stick's library.")
    page.rows.push({ at: page.used, row })
    page.used += pad(row.length)
  }
  if (page.rows.length) pages.push(page)
  return pages
}

function dataPage(index, type, next, sequence, page) {
  const buf = Buffer.alloc(PAGE)
  buf.writeUInt32LE(index, 0x04)
  buf.writeUInt32LE(type, 0x08)
  buf.writeUInt32LE(next, 0x0c)
  buf.writeUInt32LE(sequence, 0x10)
  const n = page.rows.length
  const bits = (n & 0x1fff) | ((n & 0x7ff) << 13)
  buf.writeUInt8(bits & 0xff, 0x18)
  buf.writeUInt8((bits >> 8) & 0xff, 0x19)
  buf.writeUInt8((bits >> 16) & 0xff, 0x1a)
  buf.writeUInt8(0x34, 0x1b)
  const groups = Math.ceil(n / 16)
  buf.writeUInt16LE(PAGE - HEAD - page.used - groups * GROUP, 0x1c)
  buf.writeUInt16LE(page.used, 0x1e)
  buf.writeUInt16LE(1, 0x20)
  for (const { at, row } of page.rows) row.copy(buf, HEAD + at)
  for (let g = 0; g < groups; g++) {
    const base = PAGE - g * GROUP
    const inGroup = Math.min(16, n - g * 16)
    for (let i = 0; i < inGroup; i++) buf.writeUInt16LE(page.rows[g * 16 + i].at, base - 6 - 2 * i)
    buf.writeUInt16LE(inGroup === 16 ? 0xffff : (1 << inGroup) - 1, base - 4)
    buf.writeUInt16LE(1 << (inGroup - 1), base - 2)
  }
  return buf
}

function indexPage(index, type, firstData) {
  const buf = Buffer.alloc(PAGE)
  buf.writeUInt32LE(index, 0x04)
  buf.writeUInt32LE(type, 0x08)
  buf.writeUInt32LE(index + 1, 0x0c)
  buf.writeUInt32LE(1, 0x10)
  buf.writeUInt8(0x64, 0x1b)
  buf.writeUInt16LE(0x1fff, 0x20)
  buf.writeUInt16LE(0x1fff, 0x22)
  buf.writeUInt16LE(0x03ec, 0x24)
  buf.writeUInt32LE(index, 0x28)
  buf.writeUInt32LE(firstData ?? EMPTY, 0x2c)
  buf.writeUInt32LE(EMPTY, 0x30)
  buf.writeUInt16LE(0x1fff, 0x3a)
  for (let at = 0x3c; at < PAGE - 20; at += 4) buf.writeUInt32LE(0x1ffffff8, at)
  return buf
}

// tracks: [{ id, title, artistId, albumId, genreId, trackNumber, disc, year, duration, bpm, fileSize, sampleRate,
//            bitrate, ext, filePath ("/Contents/..."), dateAdded ("YYYY-MM-DD") }]
// artists: [{ id, name }], albums: [{ id, name, artistId }], genres: [{ id, name }],
// playlists: [{ id, name, trackIds }]
export function writePdb({ tracks = [], artists = [], albums = [], genres = [], playlists = [] }) {
  const rows = {
    [TABLES.tracks]: tracks.map((t) => (shift) => trackRow(t, shift)),
    [TABLES.genres]: genres.map((g) => () => genreRow(g)),
    [TABLES.artists]: artists.map((a) => (shift) => artistRow(a, shift)),
    [TABLES.albums]: albums.map((a) => (shift) => albumRow(a, shift)),
    [TABLES.colors]: colourRows().map((r) => () => r),
    [TABLES.playlistTree]: playlists.map((p, i) => () => playlistRow({ ...p, sort: i })),
    [TABLES.playlistEntries]: playlists.flatMap((p) => p.trackIds.map((trackId, i) => () => entryRow({ index: i + 1, trackId, playlistId: p.id }))),
    [TABLES.columns]: columnRows().map((r) => () => r),
    [TABLES.unknown17]: fourRows(UNKNOWN17).map((r) => () => r),
    [TABLES.unknown18]: fourRows(UNKNOWN18).map((r) => () => r),
  }
  const types = Object.values(TABLES)
  const pages = new Map()
  let nextUnused = 1 + types.length * 2
  let sequence = 2
  const pointers = types.map((type, k) => {
    const first = 1 + 2 * k
    let candidate = first + 1
    let last = first
    const data = pack(rows[type] || [])
    for (const page of data) {
      const at = candidate
      const next = nextUnused++
      pages.set(at, dataPage(at, type, next, sequence++, page))
      last = at
      candidate = next
    }
    pages.set(first, indexPage(first, type, data.length ? first + 1 : null))
    return { type, candidate, first, last }
  })
  const header = Buffer.alloc(PAGE)
  header.writeUInt32LE(PAGE, 0x04)
  header.writeUInt32LE(types.length, 0x08)
  header.writeUInt32LE(nextUnused, 0x0c)
  header.writeUInt32LE(5, 0x10)
  header.writeUInt32LE(sequence, 0x14)
  pointers.forEach((p, i) => {
    const at = 0x1c + i * 16
    header.writeUInt32LE(p.type, at)
    header.writeUInt32LE(p.candidate, at + 4)
    header.writeUInt32LE(p.first, at + 8)
    header.writeUInt32LE(p.last, at + 12)
  })
  const count = Math.max(...pages.keys()) + 1
  const out = Buffer.alloc(count * PAGE)
  header.copy(out, 0)
  for (const [i, buf] of pages) buf.copy(out, i * PAGE)
  return out
}
