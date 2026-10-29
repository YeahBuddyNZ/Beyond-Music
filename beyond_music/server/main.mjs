// Beyond Music: turns a box the family already has (an old laptop, a Raspberry Pi, the Home Assistant box, a NAS)
// into the house's music and video centre. Plain Node, no packages. It plays to Beyond TV, phones and computers
// on the house network, and nothing about what anybody plays leaves the box.
//
//   node beyond_music/server/main.mjs            then open http://beyond-music.local:8097
//
// Settings by environment: PORT (8097), BEYOND_MUSIC_DATA (the box's own folder, default ~/.beyond-music),
// BEYOND_MUSIC_FOLDERS (extra folders, comma separated), BEYOND_MUSIC_WWW (the built app).

import { createServer } from "node:http"
import { createReadStream, existsSync } from "node:fs"
import { stat, readFile, writeFile, mkdir, unlink, readdir, rmdir } from "node:fs/promises"
import { join, extname, resolve, dirname, sep } from "node:path"
import { homedir } from "node:os"
import { fileURLToPath } from "node:url"
import { createLibrary } from "./library.mjs"
import { createStore, usualPlaces, browseRoots, insideRoots, listFolders, hasMedia } from "./store.mjs"
import { readTags } from "./tags.mjs"
import { stations } from "./radio.mjs"
import { createCd } from "./cd.mjs"
import { advertise, isPrivate, lanAddresses } from "./mdns.mjs"
import { matches, kindOf } from "./names.mjs"
import { subsonic } from "./subsonic.mjs"
import { createUsb, planExport } from "./usb.mjs"
import { isMac, matchPlaylists, musicAppLibrary, placeName } from "./apple.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const VERSION = "0.1.0"
const PORT = Number(process.env.PORT || 8097)
const HA = existsSync("/data/options.json")
const DATA = resolve(process.env.BEYOND_MUSIC_DATA || (HA ? "/data" : join(homedir(), ".beyond-music")))
const RIPS = join(DATA, "Copied CDs")
const WWW = resolve(process.env.BEYOND_MUSIC_WWW || (existsSync(join(here, "../www")) ? join(here, "../www") : join(here, "../web/dist")))

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)

await mkdir(RIPS, { recursive: true })
const store = await createStore(DATA)

// Folders from the environment or the Home Assistant app's options, besides those added in the app.
const fixed = []
for (const p of String(process.env.BEYOND_MUSIC_FOLDERS || "").split(",").map((s) => s.trim()).filter(Boolean)) fixed.push(p)
if (HA) {
  try {
    const opts = JSON.parse(await readFile("/data/options.json", "utf8"))
    for (const p of opts.folders || []) fixed.push(p)
  } catch {}
  for (const p of ["/media", "/share"]) if (existsSync(p)) fixed.push(p)
}

const sources = () => [
  { id: "cds", name: "Copied CDs", path: RIPS },
  ...fixed.filter(existsSync).map((p, i) => ({ id: `fixed${i}`, name: p.split(/[\\/]/).filter(Boolean).pop() || p, path: resolve(p) })),
  ...store.state.places,
]

// After every look for new music, the Music app's playlists come across (on a Mac that shares its Library.xml).
let musicApp = { found: false }
async function syncMusicApp(view) {
  if (!isMac() && !process.env.BEYOND_MUSIC_LIBRARY_XML) return
  const lib = await musicAppLibrary(process.env.BEYOND_MUSIC_LIBRARY_XML ? [process.env.BEYOND_MUSIC_LIBRARY_XML] : undefined)
  if (!lib) return void (musicApp = { found: false })
  const m = matchPlaylists(lib, view.where)
  const playlists = store.syncAppPlaylists(m.playlists)
  musicApp = { found: true, playlists, outside: m.outside, locked: m.locked, at: Date.now() }
}

const library = createLibrary({ dataDir: DATA, sources, log, onScanned: syncMusicApp })
await library.load()
const usb = createUsb({ log })
const cd = createCd({ dataDir: DATA, ripsDir: RIPS, onDone: () => library.scan(), log })

// What the app sees: the library without the hidden albums and without any paths on the box.
function payload() {
  const v = library.view
  const hidden = new Set(store.state.hidden)
  const albums = v.albums.filter((a) => !hidden.has(a.id))
  const tracks = v.tracks.filter((t) => !hidden.has(t.albumId))
  const albumIds = new Set(albums.map((a) => a.id))
  const artists = v.artists
    .map((a) => ({ ...a, albumIds: a.albumIds.filter((id) => albumIds.has(id)) }))
    .filter((a) => a.albumIds.length)
  return {
    name: store.state.name || "Beyond Music",
    version: VERSION,
    scannedAt: library.scannedAt,
    scanning: library.scanning,
    albums,
    artists,
    tracks,
    videos: v.videos,
    playlists: store.state.playlists,
    recent: store.state.recent,
  }
}

// ---------- the network rules ----------

// Only the house network, and only by a house-network name, so a website can't reach the box by tricking DNS.
function hostOk(host = "") {
  const h = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "").toLowerCase()
  return h === "localhost" || isPrivate(h) || h.endsWith(".local") || h.endsWith(".lan") || h.endsWith(".home.arpa") || !h.includes(".")
}

// file:// pages (Beyond TV on LG, Samsung and Google TV) send Origin "null"; the box's own app sends its own.
function originOk(req) {
  const o = req.headers.origin
  if (!o || o === "null") return true
  try {
    return hostOk(new URL(o).host)
  } catch {
    return false
  }
}

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json",
  ".ttf": "font/ttf", ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon",
  ".mp3": "audio/mpeg", ".flac": "audio/flac", ".m4a": "audio/mp4", ".aac": "audio/aac", ".ogg": "audio/ogg", ".oga": "audio/ogg", ".opus": "audio/ogg",
  ".wav": "audio/wav", ".aiff": "audio/aiff", ".aif": "audio/aiff", ".alac": "audio/mp4",
  ".mp4": "video/mp4", ".m4v": "video/mp4", ".mkv": "video/x-matroska", ".webm": "video/webm", ".mov": "video/quicktime", ".avi": "video/x-msvideo", ".ts": "video/mp2t",
}

function send(res, code, body, headers = {}) {
  const json = typeof body !== "string" && !Buffer.isBuffer(body)
  res.writeHead(code, { "Content-Type": json ? "application/json" : "text/plain; charset=utf-8", "Cache-Control": "no-store", ...headers })
  res.end(json ? JSON.stringify(body) : body)
}

async function body(req) {
  if (!/application\/json/.test(req.headers["content-type"] || "")) throw Object.assign(new Error("Send JSON."), { code: 415 })
  let size = 0
  const chunks = []
  for await (const c of req) {
    size += c.length
    if (size > 1e6) throw Object.assign(new Error("Too much."), { code: 413 })
    chunks.push(c)
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")
}

// A file, with Range so the TV and phones can skip about in a song or film.
async function sendFile(req, res, path, type, cache = "private, max-age=3600") {
  const st = await stat(path).catch(() => null)
  if (!st?.isFile()) return send(res, 404, { error: "That's not on the box any more." })
  const headers = { "Content-Type": type || TYPES[extname(path).toLowerCase()] || "application/octet-stream", "Accept-Ranges": "bytes", "Cache-Control": cache }
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "")
  if (range) {
    let start = range[1] ? Number(range[1]) : st.size - Number(range[2])
    let end = range[1] && range[2] ? Number(range[2]) : st.size - 1
    if (!range[1]) end = st.size - 1
    if (start < 0) start = 0
    if (start >= st.size || end < start) {
      res.writeHead(416, { "Content-Range": `bytes */${st.size}` })
      return res.end()
    }
    end = Math.min(end, st.size - 1)
    res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${st.size}`, "Content-Length": end - start + 1 })
    if (req.method === "HEAD") return res.end()
    return createReadStream(path, { start, end }).pipe(res)
  }
  res.writeHead(200, { ...headers, "Content-Length": st.size })
  if (req.method === "HEAD") return res.end()
  createReadStream(path).pipe(res)
}

const coverDir = join(DATA, "covers")
async function sendCover(req, res, albumId) {
  const c = library.view.covers.get(albumId)
  if (!c) return send(res, 404, { error: "No cover." })
  if (c.file) return sendFile(req, res, c.file, undefined, "public, max-age=86400")
  const cached = join(coverDir, albumId)
  if (!existsSync(cached)) {
    const st = await stat(c.track).catch(() => null)
    if (!st) return send(res, 404, { error: "No cover." })
    const pic = (await readTags(c.track, st.size).catch(() => ({}))).picture
    if (!pic?.data?.length) return send(res, 404, { error: "No cover." })
    await mkdir(coverDir, { recursive: true })
    await writeFile(cached, Buffer.concat([Buffer.from((pic.mime === "image/png" ? "P" : "J")), pic.data]))
  }
  const buf = await readFile(cached)
  res.writeHead(200, { "Content-Type": buf[0] === 80 ? "image/png" : "image/jpeg", "Cache-Control": "public, max-age=86400" })
  res.end(buf.subarray(1))
}

async function sendStatic(req, res, path) {
  const rel = decodeURIComponent(path).replace(/^\/+/, "") || "index.html"
  const full = resolve(WWW, rel)
  if (!full.startsWith(WWW)) return send(res, 404, "Not here.")
  if (existsSync(full) && (await stat(full)).isFile()) {
    const cache = rel === "index.html" ? "no-cache" : rel.startsWith("assets/") ? "public, max-age=31536000, immutable" : "no-cache"
    return sendFile(req, res, full, undefined, cache)
  }
  if (existsSync(join(WWW, "index.html"))) return sendFile(req, res, join(WWW, "index.html"), undefined, "no-cache")
  send(res, 200, "Beyond Music is running. Build the app (cd beyond_music/web && npm run build:box) to see it here.")
}

// Taking out an album whose CD was sold or given away: its copy has to go too (section 81A, docs/law.md).
// Copies the box made are deleted; files somebody else put in their own folders are hidden, and we say so.
async function soldAlbum(albumId) {
  const album = library.view.albums.find((a) => a.id === albumId)
  if (!album) throw Object.assign(new Error("That album isn't here."), { code: 404 })
  let deleted = 0
  let elsewhere = 0
  const folders = new Set()
  for (const id of album.trackIds) {
    const path = library.view.where.get(id)
    if (!path) continue
    if (path.startsWith(RIPS + sep)) {
      await unlink(path).catch(() => {})
      folders.add(dirname(path))
      deleted++
    } else elsewhere++
  }
  for (const f of folders) {
    for (const name of await readdir(f).catch(() => [])) if (/\.(jpe?g|png|log|cue|m3u)$/i.test(name)) await unlink(join(f, name)).catch(() => {})
    await rmdir(f).catch(() => {})
    await rmdir(dirname(f)).catch(() => {})
  }
  if (elsewhere) store.hide(albumId)
  library.scan()
  return { deleted, elsewhere }
}

// ---------- routes ----------

const server = createServer(async (req, res) => {
  try {
    if (!isPrivate(req.socket.remoteAddress) || !hostOk(req.headers.host)) return send(res, 403, { error: "Beyond Music only answers the house network." })
    if (!originOk(req)) return send(res, 403, { error: "Not from here." })
    if (req.headers.origin) {
      res.setHeader("Access-Control-Allow-Origin", req.headers.origin)
      res.setHeader("Vary", "Origin")
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204, { "Access-Control-Allow-Methods": "GET, POST, PUT", "Access-Control-Allow-Headers": "Content-Type, Range", "Access-Control-Max-Age": "600" })
      return res.end()
    }
    const url = new URL(req.url, "http://box")
    const p = url.pathname
    const m = (re) => re.exec(p)
    let g

    if (p.startsWith("/rest/")) return subsonic(req, res, { url, library, store, payload, sendFile, sendCover, VERSION })

    if (req.method === "GET" || req.method === "HEAD") {
      if (p === "/api/hello") return send(res, 200, { app: "beyond-music", name: store.state.name || "Beyond Music", version: VERSION, addresses: lanAddresses().map((a) => `http://${a}:${PORT}`) })
      if (p === "/api/library") return send(res, 200, payload())
      if ((g = m(/^\/api\/play\/([a-f0-9]{12})$/))) {
        const path = library.view.where.get(g[1])
        if (!path) return send(res, 404, { error: "That's not on the box any more." })
        return sendFile(req, res, path)
      }
      if ((g = m(/^\/api\/cover\/([a-f0-9]{12})$/))) return sendCover(req, res, g[1])
      if (p === "/api/radio") return send(res, 200, { stations: await stations() })
      if (p === "/api/search") {
        const q = url.searchParams.get("q") || ""
        const v = payload()
        return send(res, 200, {
          albums: v.albums.filter((a) => matches(q, a.title, a.artist)).slice(0, 30),
          artists: v.artists.filter((a) => matches(q, a.name)).slice(0, 20),
          tracks: v.tracks.filter((t) => matches(q, t.title, t.artist, t.album)).slice(0, 60),
          videos: v.videos.filter((x) => matches(q, x.title, x.show)).slice(0, 30),
        })
      }
      if (p === "/api/places") {
        const counts = {}
        for (const path of library.view.where.values()) {
          const s = sources().find((x) => path.startsWith(x.path))
          if (s) counts[s.id] = (counts[s.id] || 0) + 1
        }
        return send(res, 200, {
          places: sources().map((s) => ({ id: s.id, name: s.name, path: s.path, files: counts[s.id] || 0, inCloud: library.cloud[s.id] || 0, fixed: !store.state.places.some((x) => x.id === s.id) })),
          suggestions: (await Promise.all(usualPlaces().map(async (path) => ((await hasMedia(path, kindOf)) ? path : null))))
            .filter((path) => path && !sources().some((s) => path === s.path || path.startsWith(s.path + sep) || s.path.startsWith(path + sep)))
            .map((path) => ({ path, name: placeName(path) || path })),
          mac: isMac(),
          musicApp,
        })
      }
      if (p === "/api/places/browse") {
        const at = url.searchParams.get("path")
        if (!at) return send(res, 200, { at: null, folders: browseRoots().filter(existsSync).map((path) => ({ name: path, path })) })
        if (!insideRoots(at)) return send(res, 403, { error: "Pick a folder under your home folder or a plugged-in drive." })
        return send(res, 200, { at: resolve(at), folders: await listFolders(resolve(at)) })
      }
      if (p === "/api/cd") return send(res, 200, await cd.status())
      if (p === "/api/usb") return send(res, 200, { sticks: await usb.list(), job: usb.status() })
      if (p === "/api/apps") return send(res, 200, { on: Boolean(store.state.appsPassword), password: store.state.appsPassword || "", user: "household", addresses: lanAddresses().map((a) => `http://${a}:${PORT}`) })
      if (p.startsWith("/api/")) return send(res, 404, { error: "Not here." })
      return sendStatic(req, res, p)
    }

    if (req.method === "POST" || req.method === "PUT") {
      const b = await body(req)
      if (p === "/api/scan") {
        library.scan()
        return send(res, 202, { scanning: true })
      }
      if (p === "/api/places") {
        if (!insideRoots(b.path)) return send(res, 403, { error: "Pick a folder under your home folder or a plugged-in drive." })
        await store.addPlace(b.path, b.name)
        library.scan()
        return send(res, 200, { ok: true })
      }
      if (p === "/api/places/remove") {
        store.removePlace(String(b.id || ""))
        library.scan()
        return send(res, 200, { ok: true })
      }
      if (p === "/api/playlists") return send(res, 200, store.savePlaylist(b))
      if ((g = m(/^\/api\/playlists\/([a-f0-9]{12})$/))) return send(res, 200, store.savePlaylist(b, g[1]))
      if ((g = m(/^\/api\/playlists\/([a-f0-9]{12})\/delete$/))) {
        store.deletePlaylist(g[1])
        return send(res, 200, { ok: true })
      }
      if (p === "/api/played") {
        store.played(String(b.id || ""))
        return send(res, 200, { ok: true })
      }
      if ((g = m(/^\/api\/albums\/([a-f0-9]{12})\/sold$/))) return send(res, 200, await soldAlbum(g[1]))
      if (p === "/api/name") {
        store.setName(b.name)
        return send(res, 200, { ok: true })
      }
      if (p === "/api/apps") return send(res, 200, { on: Boolean(store.setApps(Boolean(b.on))) })
      if (p === "/api/cd/copy") return send(res, 200, await cd.copy())
      if (p === "/api/usb/copy") {
        const ids = new Set((Array.isArray(b.playlists) ? b.playlists : []).map(String))
        const playlists = store.state.playlists.filter((x) => ids.has(x.id))
        const tracks = payload().tracks.map((t) => ({ ...t, path: library.view.where.get(t.id) })).filter((t) => t.path)
        const plan = planExport({ tracks, playlists, tempo: b.tempo && typeof b.tempo === "object" ? b.tempo : {} })
        try {
          return send(res, 202, { job: await usb.run(String(b.stick || ""), plan, { replace: b.replace === true }), skipped: plan.skipped })
        } catch (e) {
          return send(res, e.code >= 400 && e.code < 600 ? e.code : 400, { error: e.message, rekordbox: Boolean(e.rekordbox) })
        }
      }
    }
    send(res, 404, { error: "Not here." })
  } catch (e) {
    if (!res.headersSent) send(res, e.code >= 400 && e.code < 600 ? e.code : 400, { error: e.message || "Something went wrong." })
    else res.end()
  }
})

server.listen(PORT, "0.0.0.0", () => {
  log(`Beyond Music ${VERSION} on port ${PORT}, data in ${DATA}`)
  for (const a of lanAddresses()) log(`Open http://${a}:${PORT} on the house network`)
})
if (process.env.BEYOND_MUSIC_MDNS !== "0") advertise("beyond-music.local", log)

library.scan()
// Look again every hour for music added straight onto a drive.
setInterval(() => library.scan(), 3600 * 1000).unref()
