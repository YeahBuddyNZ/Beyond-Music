// Playlists onto a USB stick for Pioneer DJ players (CDJs, XDJs and the all-in-ones): the songs go in Contents/,
// the library the players read goes in PIONEER/rekordbox/export.pdb (pdb.mjs). Only songs the household has, only
// the kinds of file the players play, never sent anywhere but the stick in the box's own port.
//
// What we put on a stick is listed in PIONEER/beyond-music.json, so the next copy can take away what's no longer
// chosen (an album given away, say) without touching anything else on the stick.

import { copyFile, mkdir, readdir, readFile, rename, rmdir, stat, statfs, unlink, writeFile, realpath } from "node:fs/promises"
import { join, dirname, basename, extname } from "node:path"
import { platform } from "node:os"
import { FILE_TYPES, writePdb } from "./pdb.mjs"

const MANIFEST = "PIONEER/beyond-music.json"
const LIBRARY = "PIONEER/rekordbox/export.pdb"

// A name a FAT32 or exFAT stick takes: none of the characters it refuses, no trailing dots or spaces, not too long.
export function safeName(s, fallback = "Unknown") {
  const clean = String(s || "")
    .replace(/[\x00-\x1f<>:"/\\|?*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "")
    .slice(0, 80)
    .trim()
  return clean || fallback
}

const dateOf = (ms) => (ms ? new Date(ms).toISOString().slice(0, 10) : "")

// Works out what goes where: pure, so tests/usb.test.mjs can check it without a stick.
// tracks: the library's tracks (with `path`, where the file is on the box), playlists: [{ name, items }],
// tempo: { trackId: bpm } from DJ mode, for the songs it has looked at.
export function planExport({ tracks, playlists, tempo = {} }) {
  const byId = new Map(tracks.map((t) => [t.id, t]))
  const chosen = []
  const seen = new Map()
  const skipped = []
  const used = new Set()
  for (const p of playlists) {
    for (const id of p.items) {
      const t = byId.get(id)
      if (!t || seen.has(id)) continue
      if (!FILE_TYPES[t.ext]) {
        if (!skipped.some((s) => s.id === id)) skipped.push({ id, title: t.title, ext: t.ext })
        continue
      }
      // Two songs with one file name in one album folder get a number so neither is lost.
      const folder = `Contents/${safeName(t.albumArtist || t.artist, "Unknown artist")}/${safeName(t.album, "Singles")}`
      const stem = safeName(basename(t.path, extname(t.path)), "Song")
      let rel = `${folder}/${stem}.${t.ext}`
      for (let n = 2; used.has(rel.toLowerCase()); n++) rel = `${folder}/${stem} ${n}.${t.ext}`
      used.add(rel.toLowerCase())
      seen.set(id, chosen.length)
      chosen.push({ track: t, rel })
    }
  }
  const artists = new Map()
  const albums = new Map()
  const genres = new Map()
  const idFor = (map, key, make) => {
    if (!map.has(key)) map.set(key, make(map.size + 1))
    return map.get(key).id
  }
  const songs = chosen.map(({ track: t, rel }, i) => ({
    id: i + 1,
    from: t.path,
    rel,
    title: t.title,
    artistId: idFor(artists, t.artist, (id) => ({ id, name: t.artist })),
    albumId: idFor(albums, `${t.albumArtist}\u0000${t.album}`, (id) => ({ id, name: t.album, artistId: 0 })),
    genreId: t.genre ? idFor(genres, t.genre, (id) => ({ id, name: t.genre })) : 0,
    trackNumber: t.track || 0,
    disc: t.disc || 0,
    year: t.year || 0,
    duration: t.duration || 0,
    bpm: Number(tempo[t.id]) > 0 && Number(tempo[t.id]) < 400 ? Number(tempo[t.id]) : 0,
    ext: t.ext,
    filePath: "/" + rel,
    dateAdded: dateOf(t.added),
  }))
  for (const s of songs) {
    const a = [...albums.values()].find((x) => x.id === s.albumId)
    if (a && !a.artistId) a.artistId = s.artistId
  }
  const lists = playlists
    .map((p, i) => ({ id: i + 1, name: safeName(p.name, "Playlist"), trackIds: p.items.filter((id) => seen.has(id)).map((id) => seen.get(id) + 1) }))
    .filter((p) => p.trackIds.length)
  return { songs, artists: [...artists.values()], albums: [...albums.values()], genres: [...genres.values()], playlists: lists, skipped }
}

// Plugged-in drives: on a Mac what's in /Volumes but the start-up disk, on Linux what's mounted under /media.
export async function listSticks() {
  const roots = platform() === "darwin" ? ["/Volumes"] : ["/media", "/run/media"]
  const found = []
  const look = async (dir, depth) => {
    for (const name of await readdir(dir).catch(() => [])) {
      if (name.startsWith(".")) continue
      const path = join(dir, name)
      const st = await stat(path).catch(() => null)
      if (!st?.isDirectory()) continue
      const parent = await stat(dir).catch(() => null)
      const real = await realpath(path).catch(() => path)
      if (real === "/") continue
      if (parent && st.dev !== parent.dev) found.push(await describe(path, name))
      else if (depth < 1) await look(path, depth + 1) // /media/<user>/<stick>
    }
  }
  for (const r of roots) await look(r, 0)
  return found
}

export async function describe(path, name) {
  const fs = await statfs(path).catch(() => null)
  const exists = async (rel) => Boolean(await stat(join(path, rel)).catch(() => null))
  return {
    name,
    path,
    free: fs ? fs.bavail * fs.bsize : null,
    size: fs ? fs.blocks * fs.bsize : null,
    ours: await exists(MANIFEST),
    rekordbox: (await exists(LIBRARY)) && !(await exists(MANIFEST)),
  }
}

// One copy at a time, with how far it has got for the screen.
// `list` is only swapped in tests, where a folder stands in for a stick.
export function createUsb({ log = () => {}, list = listSticks } = {}) {
  let job = { state: "idle" }
  const status = () => job

  async function run(stick, plan, { replace = false } = {}) {
    if (job.state === "copying") throw Object.assign(new Error("A copy is already going."), { code: 409 })
    const sticks = await list()
    const target = sticks.find((s) => s.path === stick)
    if (!target) throw Object.assign(new Error("That stick isn't plugged in any more."), { code: 404 })
    if (target.rekordbox && !replace) throw Object.assign(new Error("This stick already has a rekordbox library on it."), { code: 409, rekordbox: true })
    if (!plan.songs.length) throw Object.assign(new Error("None of those songs can go on the stick."), { code: 400 })
    job = { state: "copying", stick: target.name, done: 0, total: plan.songs.length, skipped: plan.skipped.length, started: Date.now() }
    copy(target, plan).catch((e) => {
      log(`USB copy stopped: ${e.message}`)
      job = { ...job, state: "failed", error: e.code === "ENOSPC" ? "The stick is full." : "The copy stopped. Check the stick is still in and try again." }
    })
    return job
  }

  async function copy(target, plan) {
    const root = target.path
    const before = JSON.parse(await readFile(join(root, MANIFEST), "utf8").catch(() => "{}"))
    let need = 0
    const sizes = []
    for (const s of plan.songs) {
      const st = await stat(s.from)
      const there = await stat(join(root, s.rel)).catch(() => null)
      sizes.push(st.size)
      if (!there || there.size !== st.size) need += st.size
    }
    if (target.free != null && need > target.free) throw Object.assign(new Error("full"), { code: "ENOSPC" })
    for (const [i, s] of plan.songs.entries()) {
      const to = join(root, s.rel)
      const there = await stat(to).catch(() => null)
      if (!there || there.size !== sizes[i]) {
        await mkdir(dirname(to), { recursive: true })
        await copyFile(s.from, to + ".part")
        await rename(to + ".part", to)
      }
      job = { ...job, done: i + 1, current: s.title }
    }
    // Take away what we put there last time and nobody chose this time.
    const keep = new Set(plan.songs.map((s) => s.rel))
    for (const rel of before.files || []) {
      if (keep.has(rel) || !rel.startsWith("Contents/") || rel.includes("..")) continue
      await unlink(join(root, rel)).catch(() => {})
      await rmdir(dirname(join(root, rel))).catch(() => {})
      await rmdir(dirname(dirname(join(root, rel)))).catch(() => {})
    }
    const db = writePdb({ tracks: plan.songs.map((s, i) => ({ ...s, fileSize: sizes[i] })), artists: plan.artists, albums: plan.albums, genres: plan.genres, playlists: plan.playlists })
    const file = join(root, LIBRARY)
    await mkdir(dirname(file), { recursive: true })
    // A library rekordbox made is kept beside ours, never thrown away.
    if (target.rekordbox) await rename(file, file + ".rekordbox-backup").catch(() => {})
    await writeFile(file + ".part", db)
    await rename(file + ".part", file)
    await writeFile(join(root, MANIFEST), JSON.stringify({ app: "beyond-music", at: new Date().toISOString(), files: [...keep] }, null, 1))
    job = { ...job, state: "done", current: null, finished: Date.now() }
    log(`USB: ${plan.songs.length} songs on ${target.name}`)
  }

  return { status, run, list }
}
