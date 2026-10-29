// The library: walks every place the household keeps music and videos, reads each new or changed file once,
// and keeps the result in library.json on the box. Nothing about the library leaves the box.

import { mkdir, readdir, stat, readFile, writeFile, rename } from "node:fs/promises"
import { join, relative, extname, dirname } from "node:path"
import { readTags } from "./tags.mjs"
import { bringDown, cloudName } from "./apple.mjs"
import { albumIdOf, artistIdOf, idOf, isCoverFile, kindOf, sortName, trackFrom, videoFrom } from "./names.mjs"

const SKIP = /^(\.|@eaDir$|#recycle$|\$RECYCLE\.BIN$|System Volume Information$|lost\+found$|node_modules$)/

export function createLibrary({ dataDir, sources, log = () => {}, onScanned = async () => {} }) {
  const file = join(dataDir, "library.json")
  let index = { files: {}, scannedAt: null } // path → what was read, so a rescan only reads what changed
  let view = build(index)
  let scanning = null
  let later = null

  async function load() {
    try {
      index = JSON.parse(await readFile(file, "utf8"))
      view = build(index)
    } catch {}
  }

  async function save() {
    await mkdir(dataDir, { recursive: true })
    const tmp = file + ".tmp"
    await writeFile(tmp, JSON.stringify(index))
    await rename(tmp, file)
  }

  async function scan() {
    if (scanning) return scanning
    scanning = (async () => {
      const started = Date.now()
      const seen = {}
      let read = 0
      const cloud = {} // source id → songs iCloud still holds
      const toBringDown = []
      for (const src of sources()) {
        let found = 0
        for await (const { path, st, inCloud } of walk(src.path)) {
          if (inCloud) {
            cloud[src.id] = (cloud[src.id] || 0) + 1
            toBringDown.push(path)
            continue
          }
          const kind = kindOf(path)
          if (!kind) continue
          const rel = relative(src.path, path)
          const old = index.files[path]
          if (old && old.mtime === st.mtimeMs && old.size === st.size) {
            seen[path] = { ...old, source: src.id }
            found++
            continue
          }
          const entry = { kind, rel, source: src.id, size: st.size, mtime: st.mtimeMs, added: old?.added || Date.now() }
          if (kind === "audio") {
            let tags = {}
            try {
              tags = await readTags(path, st.size)
            } catch (e) {
              log(`Couldn't read ${rel}: ${e.message}`)
            }
            entry.hasPicture = Boolean(tags.picture?.data?.length)
            delete tags.picture
            entry.tags = tags
            read++
          }
          seen[path] = entry
          found++
        }
        log(`${src.name}: ${found} files`)
      }
      index = { files: seen, scannedAt: Date.now(), cloud }
      view = build(index)
      await save()
      // Ask iCloud for what it still holds, and look again once it has had time to bring them down.
      if (bringDown(toBringDown) && !later) later = setTimeout(() => ((later = null), scan()), 180_000).unref()
      try {
        await onScanned(view)
      } catch (e) {
        log(`After the scan: ${e.message}`)
      }
      log(`Scan done in ${Math.round((Date.now() - started) / 1000)}s, ${read} read`)
      return view
    })().finally(() => (scanning = null))
    return scanning
  }

  return {
    load,
    scan,
    get view() {
      return view
    },
    get scanning() {
      return Boolean(scanning)
    },
    get cloud() {
      return index.cloud || {}
    },
    get scannedAt() {
      return index.scannedAt
    },
  }
}

async function* walk(root, depth = 0) {
  if (depth > 12) return
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const real = e.isFile() && cloudName(e.name)
    if (real) {
      if (kindOf(real)) yield { path: join(root, e.name), inCloud: true }
      continue
    }
    if (SKIP.test(e.name)) continue
    const path = join(root, e.name)
    if (e.isDirectory()) yield* walk(path, depth + 1)
    else if (e.isFile()) {
      try {
        yield { path, st: await stat(path) }
      } catch {}
    }
  }
}

// Turns the raw index into what the app shows: albums, artists, tracks and videos. Pure, so the tests use it.
export function build(index) {
  const tracks = []
  const albums = new Map()
  const videos = []
  const pictures = new Map() // folder → cover file in it
  const where = new Map() // track id → absolute path
  for (const [path, f] of Object.entries(index.files || {})) {
    if (f.kind === "image" && isCoverFile(path)) {
      const folder = dirname(path)
      if (!pictures.has(folder)) pictures.set(folder, path)
    }
  }
  for (const [path, f] of Object.entries(index.files || {})) {
    if (f.kind === "audio") {
      const t = trackFrom(f.rel, f.tags)
      const id = idOf("track", path)
      const albumId = albumIdOf(t.albumArtist, t.album)
      where.set(id, path)
      const track = { id, ...t, albumId, artistId: artistIdOf(t.artist), ext: extname(path).slice(1).toLowerCase(), added: f.added }
      tracks.push(track)
      let a = albums.get(albumId)
      if (!a) {
        a = { id: albumId, title: t.album, artist: t.albumArtist, artistId: artistIdOf(t.albumArtist), year: t.year, added: f.added, tracks: [], cover: null, artists: new Set() }
        albums.set(albumId, a)
      }
      a.tracks.push(track)
      a.artists.add(t.artist)
      if (!a.year && t.year) a.year = t.year
      if (f.added < a.added) a.added = f.added
      if (!a.cover) {
        const pic = pictures.get(dirname(path))
        if (pic) a.cover = { file: pic }
        else if (f.hasPicture) a.cover = { track: path }
      }
    } else if (f.kind === "video") {
      const id = idOf("video", path)
      where.set(id, path)
      videos.push({ id, ...videoFrom(f.rel), ext: extname(path).slice(1).toLowerCase(), size: f.size, added: f.added })
    }
  }
  const order = (x, y) => (x.disc || 1) - (y.disc || 1) || (x.track || 999) - (y.track || 999) || x.title.localeCompare(y.title)
  const albumList = [...albums.values()].map((a) => {
    a.tracks.sort(order)
    // An album whose songs are by many people (a compilation) is listed under Various artists.
    const various = a.artists.size > 3 && a.tracks.every((t) => t.albumArtist === t.artist)
    return {
      id: a.id,
      title: a.title,
      artist: various ? "Various artists" : a.artist,
      artistId: a.artistId,
      year: a.year,
      added: a.added,
      hasCover: Boolean(a.cover),
      duration: a.tracks.reduce((s, t) => s + (t.duration || 0), 0),
      trackIds: a.tracks.map((t) => t.id),
    }
  })
  albumList.sort((x, y) => sortName(x.artist).localeCompare(sortName(y.artist)) || (x.year || 0) - (y.year || 0) || x.title.localeCompare(y.title))
  const artists = new Map()
  for (const t of tracks) {
    const a = artists.get(t.artistId) || { id: t.artistId, name: t.artist, albumIds: new Set(), trackCount: 0 }
    a.albumIds.add(t.albumId)
    a.trackCount++
    artists.set(t.artistId, a)
  }
  const artistList = [...artists.values()]
    .map((a) => ({ id: a.id, name: a.name, albumIds: [...a.albumIds], trackCount: a.trackCount }))
    .sort((x, y) => sortName(x.name).localeCompare(sortName(y.name)))
  videos.sort((x, y) => (x.show || x.title).localeCompare(y.show || y.title) || (x.season || 0) - (y.season || 0) || (x.episode || 0) - (y.episode || 0))
  const covers = new Map([...albums.values()].filter((a) => a.cover).map((a) => [a.id, a.cover]))
  return { tracks, albums: albumList, artists: artistList, videos, where, covers }
}
