// The Subsonic language (/rest/*), which dozens of existing music apps speak: Symfonium and Ultrasonic on
// Android, Amperfy and play:Sub on iPhone, Feishin on computers. Many of them do CarPlay and Android Auto, so
// the family's music is in the car with nothing more to build. Turned on with a password in Settings.
// Read-mostly: browse, search, play, covers, playlists and "played".

import { createHash } from "node:crypto"
import { matches } from "./names.mjs"

const API = "1.16.1"
const md5 = (s) => createHash("md5").update(s).digest("hex")

export function checkAuth(params, password) {
  if (!password) return false
  const p = params.get("p")
  const t = params.get("t")
  const s = params.get("s")
  if (t && s) return md5(password + s) === t.toLowerCase()
  if (p) return (p.startsWith("enc:") ? Buffer.from(p.slice(4), "hex").toString("utf8") : p) === password
  return false
}

// Subsonic's XML: plain values become attributes, lists and objects become elements.
export function toXml(name, obj) {
  const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;")
  const attrs = []
  const kids = []
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null) continue
    if (Array.isArray(v)) for (const item of v) kids.push(toXml(k, item))
    else if (typeof v === "object") kids.push(toXml(k, v))
    else attrs.push(`${k}="${esc(v)}"`)
  }
  const open = `<${name}${attrs.length ? " " + attrs.join(" ") : ""}`
  return kids.length ? `${open}>${kids.join("")}</${name}>` : `${open}/>`
}

const song = (t) => ({
  id: t.id,
  parent: "al-" + t.albumId,
  isDir: false,
  title: t.title,
  album: t.album,
  artist: t.artist,
  track: t.track,
  discNumber: t.disc,
  year: t.year,
  genre: t.genre,
  coverArt: t.albumId,
  duration: t.duration,
  suffix: t.ext,
  albumId: "al-" + t.albumId,
  artistId: "ar-" + t.artistId,
  type: "music",
})

const album = (a) => ({
  id: "al-" + a.id,
  name: a.title,
  title: a.title,
  album: a.title,
  artist: a.artist,
  artistId: "ar-" + a.artistId,
  coverArt: a.hasCover ? a.id : undefined,
  songCount: a.trackIds.length,
  duration: a.duration,
  year: a.year,
  created: new Date(a.added || 0).toISOString(),
  isDir: true,
})

export async function subsonic(req, res, { url, library, store, payload, sendFile, sendCover, VERSION }) {
  const q = url.searchParams
  const json = q.get("f") === "json"
  const reply = (body, status = "ok") => {
    const out = { status, version: API, type: "beyond-music", serverVersion: VERSION, openSubsonic: true, ...body }
    if (json) {
      res.writeHead(200, { "Content-Type": "application/json" })
      return res.end(JSON.stringify({ "subsonic-response": out }))
    }
    res.writeHead(200, { "Content-Type": "text/xml; charset=utf-8" })
    res.end('<?xml version="1.0" encoding="UTF-8"?>' + toXml("subsonic-response", { xmlns: "http://subsonic.org/restapi", ...out }))
  }
  const fail = (code, message) => reply({ error: { code, message } }, "failed")

  if (!store.state.appsPassword) return fail(40, "Turn on Other music apps in Beyond Music's settings first.")
  if (!checkAuth(q, store.state.appsPassword)) return fail(40, "Wrong password.")

  const v = payload()
  const view = url.pathname.replace(/^\/rest\//, "").replace(/\.view$/, "")
  const albumOf = new Map(v.albums.map((a) => [a.id, a]))
  const trackOf = new Map(v.tracks.map((t) => [t.id, t]))
  const id = (q.get("id") || "").replace(/^(al|ar)-/, "")
  const limit = (name, dflt, max) => Math.min(max, Math.max(0, Number(q.get(name) || dflt)))

  switch (view) {
    case "ping":
    case "getLicense":
      return reply(view === "getLicense" ? { license: { valid: true } } : {})
    case "getOpenSubsonicExtensions":
      return reply({ openSubsonicExtensions: [] })
    case "getMusicFolders":
      return reply({ musicFolders: { musicFolder: [{ id: 1, name: v.name }] } })
    case "getArtists":
    case "getIndexes": {
      const groups = new Map()
      for (const a of v.artists) {
        const letter = /[a-z]/i.test(a.name[0]) ? a.name[0].toUpperCase() : "#"
        if (!groups.has(letter)) groups.set(letter, [])
        groups.get(letter).push({ id: "ar-" + a.id, name: a.name, albumCount: a.albumIds.length, coverArt: a.albumIds.find((x) => albumOf.get(x)?.hasCover) })
      }
      const index = [...groups].map(([name, artist]) => ({ name, artist }))
      return reply(view === "getArtists" ? { artists: { ignoredArticles: "The A An", index } } : { indexes: { ignoredArticles: "The A An", index } })
    }
    case "getArtist": {
      const a = v.artists.find((x) => x.id === id)
      if (!a) return fail(70, "Not found.")
      return reply({ artist: { id: "ar-" + a.id, name: a.name, albumCount: a.albumIds.length, album: a.albumIds.map((x) => albumOf.get(x)).filter(Boolean).map(album) } })
    }
    case "getAlbum":
    case "getMusicDirectory": {
      const a = albumOf.get(id)
      if (!a) return fail(70, "Not found.")
      const songs = a.trackIds.map((t) => trackOf.get(t)).filter(Boolean).map(song)
      return reply(view === "getAlbum" ? { album: { ...album(a), song: songs } } : { directory: { id: "al-" + a.id, name: a.title, child: songs } })
    }
    case "getSong": {
      const t = trackOf.get(id)
      return t ? reply({ song: song(t) }) : fail(70, "Not found.")
    }
    case "getAlbumList":
    case "getAlbumList2": {
      const type = q.get("type") || "newest"
      let list = [...v.albums]
      if (type === "newest") list.sort((x, y) => (y.added || 0) - (x.added || 0))
      else if (type === "alphabeticalByName") list.sort((x, y) => x.title.localeCompare(y.title))
      else if (type === "random") list.sort(() => Math.random() - 0.5)
      else if (type === "recent" || type === "frequent") {
        const order = [...new Set(v.recent.map((r) => trackOf.get(r.id)?.albumId).filter(Boolean))]
        list = order.map((x) => albumOf.get(x)).filter(Boolean)
      } else if (type === "byYear") {
        const from = Number(q.get("fromYear") || 0)
        const to = Number(q.get("toYear") || 9999)
        list = list.filter((a) => a.year && a.year >= Math.min(from, to) && a.year <= Math.max(from, to))
      } else if (type === "byGenre") {
        const genre = (q.get("genre") || "").toLowerCase()
        const ids = new Set(v.tracks.filter((t) => (t.genre || "").toLowerCase() === genre).map((t) => t.albumId))
        list = list.filter((a) => ids.has(a.id))
      } else if (type === "starred") list = []
      const off = limit("offset", 0, 1e6)
      const page = list.slice(off, off + limit("size", 10, 500)).map(album)
      return reply(view === "getAlbumList2" ? { albumList2: { album: page } } : { albumList: { album: page } })
    }
    case "getRandomSongs": {
      const list = [...v.tracks].sort(() => Math.random() - 0.5).slice(0, limit("size", 10, 500))
      return reply({ randomSongs: { song: list.map(song) } })
    }
    case "getGenres": {
      const counts = new Map()
      for (const t of v.tracks) if (t.genre) counts.set(t.genre, (counts.get(t.genre) || 0) + 1)
      return reply({ genres: { genre: [...counts].map(([value, songCount]) => ({ value, songCount, albumCount: 0 })) } })
    }
    case "search2":
    case "search3": {
      const text = (q.get("query") || "").replace(/^"|"$/g, "")
      const all = !text.trim()
      const found = {
        artist: v.artists.filter((a) => all || matches(text, a.name)).slice(0, limit("artistCount", 20, 500)).map((a) => ({ id: "ar-" + a.id, name: a.name, albumCount: a.albumIds.length })),
        album: v.albums.filter((a) => all || matches(text, a.title, a.artist)).slice(limit("albumOffset", 0, 1e6)).slice(0, limit("albumCount", 20, 500)).map(album),
        song: v.tracks.filter((t) => all || matches(text, t.title, t.artist, t.album)).slice(limit("songOffset", 0, 1e6)).slice(0, limit("songCount", 20, 500)).map(song),
      }
      return reply(view === "search3" ? { searchResult3: found } : { searchResult2: found })
    }
    case "getPlaylists":
      return reply({ playlists: { playlist: v.playlists.map((p) => ({ id: p.id, name: p.name, songCount: p.items.length, owner: "household", public: true, created: new Date(p.created).toISOString(), changed: new Date(p.updated).toISOString() })) } })
    case "getPlaylist": {
      const p = v.playlists.find((x) => x.id === id)
      if (!p) return fail(70, "Not found.")
      const entry = p.items.map((x) => trackOf.get(x)).filter(Boolean).map(song)
      return reply({ playlist: { id: p.id, name: p.name, songCount: entry.length, owner: "household", public: true, entry } })
    }
    case "createPlaylist": {
      const songs = q.getAll("songId")
      const existing = q.get("playlistId")
      const prev = existing ? v.playlists.find((x) => x.id === existing) : null
      const saved = store.savePlaylist({ name: q.get("name") || prev?.name || "New playlist", items: songs.length || !prev ? songs : prev.items }, prev?.id)
      return reply({ playlist: { id: saved.id, name: saved.name, songCount: saved.items.length } })
    }
    case "updatePlaylist": {
      const p = v.playlists.find((x) => x.id === q.get("playlistId"))
      if (!p) return fail(70, "Not found.")
      const drop = new Set(q.getAll("songIndexToRemove").map(Number))
      const items = p.items.filter((_, i) => !drop.has(i)).concat(q.getAll("songIdToAdd"))
      store.savePlaylist({ name: q.get("name") || p.name, items }, p.id)
      return reply({})
    }
    case "deletePlaylist":
      store.deletePlaylist(id)
      return reply({})
    case "scrobble":
      if (q.get("submission") !== "false") for (const t of q.getAll("id")) store.played(t)
      return reply({})
    case "getStarred":
    case "getStarred2":
      return reply({ [view === "getStarred2" ? "starred2" : "starred"]: {} })
    case "star":
    case "unstar":
      return reply({})
    case "getUser":
      return reply({ user: { username: q.get("u") || "household", streamRole: true, downloadRole: true, playlistRole: true, coverArtRole: true, scrobblingEnabled: true } })
    case "stream":
    case "download": {
      const path = trackOf.has(id) ? library.view.where.get(id) : null
      return path ? sendFile(req, res, path) : fail(70, "Not found.")
    }
    case "getCoverArt":
      return sendCover(req, res, (q.get("id") || "").replace(/^(al|ar)-/, ""))
    default:
      return fail(0, `Beyond Music doesn't do ${view} yet.`)
  }
}
