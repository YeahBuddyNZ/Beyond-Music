// Pure decisions about names and kinds of file, kept apart from the disk so the tests can run them.

import { createHash } from "node:crypto"
import { basename, dirname, extname, sep } from "node:path"

export const AUDIO = new Set([".mp3", ".flac", ".m4a", ".aac", ".ogg", ".oga", ".opus", ".wav", ".alac", ".aiff", ".aif"])
export const VIDEO = new Set([".mp4", ".m4v", ".mkv", ".webm", ".mov", ".avi", ".ts"])
export const COVERS = ["cover", "folder", "front", "album", "albumart", "albumartsmall"]
export const IMAGE = new Set([".jpg", ".jpeg", ".png", ".webp"])

export const idOf = (...parts) => createHash("sha1").update(parts.join("\u0001")).digest("hex").slice(0, 12)

const key = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim()

export function kindOf(file) {
  const ext = extname(file).toLowerCase()
  if (AUDIO.has(ext)) return "audio"
  if (VIDEO.has(ext)) return "video"
  if (IMAGE.has(ext)) return "image"
}

// "01 - Song.flac", "1-03 Song.mp3", "03. Song" → { track, disc, title }.
export function fromFileName(file) {
  const name = basename(file, extname(file))
  let m = /^(\d)[-.](\d{1,2})[\s._-]+(.+)$/.exec(name)
  if (m) return { disc: Number(m[1]), track: Number(m[2]), title: tidy(m[3]) }
  m = /^(\d{1,3})[\s._-]+(?:-\s*)?(.+)$/.exec(name)
  if (m) return { track: Number(m[1]), title: tidy(m[2]) }
  return { title: tidy(name) }
}

const tidy = (s) => s.replace(/_/g, " ").replace(/\s+/g, " ").trim()

// Music from a file's tags, falling back to its folders: <...>/Artist/Album/01 Title.flac.
export function trackFrom(rel, tags = {}) {
  const parts = rel.split(/[\\/]/)
  const fromName = fromFileName(rel)
  const folderAlbum = parts.length >= 2 ? parts[parts.length - 2] : ""
  const folderArtist = parts.length >= 3 ? parts[parts.length - 3] : ""
  const albumDisc = /^(?:cd|disc|disk)\s*(\d+)$/i.exec(folderAlbum)
  const album = tags.album || (albumDisc ? folderArtist : folderAlbum.replace(/^\d{4}\s*[-.]\s*/, "")) || "Singles"
  const artist = tags.artist || tags.albumArtist || (albumDisc ? parts[parts.length - 4] : folderArtist) || "Unknown artist"
  const albumArtist = tags.albumArtist || artist
  return {
    title: tags.title || fromName.title,
    artist,
    albumArtist,
    album,
    track: tags.track || fromName.track,
    disc: tags.disc || fromName.disc || (albumDisc ? Number(albumDisc[1]) : undefined),
    year: tags.year || yearFromFolder(folderAlbum),
    genre: tags.genre || undefined,
    duration: tags.duration || undefined,
  }
}

const yearFromFolder = (s) => {
  const m = /(?:^|[\s(\[])((?:19|20)\d{2})(?:[\s)\]]|$)/.exec(s)
  return m ? Number(m[1]) : undefined
}

// "Various Artists" albums: tracks with different artists but one album name in one folder stay one album.
export const albumIdOf = (albumArtist, album) => idOf("album", key(albumArtist), key(album))
export const artistIdOf = (name) => idOf("artist", key(name))

// Videos: "Show S01E02", "Show 1x02", "Show/Season 1/02 Title", "Film (2010)", and phone and camera clips.
const CAMERA = /^(VID|IMG|PXL|MOV|DSC|DJI|GOPR|GH\d|MVI|CIMG|DCIM)[_-]?\d|^\d{8}[_-]\d{6}|^video[_-]?\d/i
const HOME_FOLDER = /home ?video|family|camera|phone|holiday|birthday|wedding|dcim/i

export function videoFrom(rel) {
  const parts = rel.split(/[\\/]/)
  const name = basename(rel, extname(rel))
  const folders = parts.slice(0, -1)
  const pretty = (s) => tidy(s.replace(/[._]/g, " ")).replace(/\s*[\[(](?:1080p|720p|2160p|4k|web.*|bluray.*|x26[45].*)[\])]?.*$/i, "")
  let m = /^(.*?)[\s._-]*[Ss](\d{1,2})[\s._-]*[Ee](\d{1,3})(?:[\s._-]+(.*))?$/.exec(name) || /^(.*?)[\s._-]+(\d{1,2})x(\d{2,3})(?:[\s._-]+(.*))?$/.exec(name)
  if (m) {
    const show = pretty(m[1]) || showFromFolders(folders)
    return { kind: "episode", show: show || "Shows", season: Number(m[2]), episode: Number(m[3]), title: m[4] ? pretty(m[4]) : `Episode ${Number(m[3])}` }
  }
  const seasonFolder = folders.length ? /^(?:season|series)\s*(\d+)$/i.exec(folders[folders.length - 1]) : null
  if (seasonFolder) {
    const ep = /^(\d{1,3})[\s._-]+(.*)$/.exec(name)
    return {
      kind: "episode",
      show: showFromFolders(folders) || "Shows",
      season: Number(seasonFolder[1]),
      episode: ep ? Number(ep[1]) : undefined,
      title: ep ? pretty(ep[2]) : pretty(name),
    }
  }
  if (CAMERA.test(name) || folders.some((f) => HOME_FOLDER.test(f))) {
    return { kind: "home", title: cameraDate(name) || pretty(name), folder: folders[folders.length - 1] || "" }
  }
  m = /^(.*?)[\s._]*[([]?((?:19|20)\d{2})[)\]]?(?:[\s._].*)?$/.exec(name)
  if (m && m[1]) return { kind: "film", title: pretty(m[1]), year: Number(m[2]) }
  return { kind: "film", title: pretty(name) }
}

// VID_20240101_120000 → "01/01/2024, 12:00", the way a person would say when it was filmed.
export function cameraDate(name) {
  const m = /((?:19|20)\d{2})(\d{2})(\d{2})[_-]?(\d{2})?(\d{2})?/.exec(name)
  if (!m || Number(m[2]) > 12 || Number(m[3]) > 31 || Number(m[2]) < 1) return ""
  return `${m[3]}/${m[2]}/${m[1]}${m[4] && Number(m[4]) < 24 ? `, ${m[4]}:${m[5] || "00"}` : ""}`
}

function showFromFolders(folders) {
  for (let i = folders.length - 1; i >= 0; i--) {
    if (/^(?:season|series)\s*\d+$/i.test(folders[i])) continue
    return tidy(folders[i].replace(/[._]/g, " ").replace(/\s*\((?:19|20)\d{2}\)$/, ""))
  }
}

// A picture in an album's folder that is its cover.
export function isCoverFile(file) {
  const ext = extname(file).toLowerCase()
  if (!IMAGE.has(ext)) return false
  const name = basename(file, ext).toLowerCase().replace(/[\s_-]/g, "")
  return COVERS.some((c) => name === c || name.startsWith(c))
}

export const folderOf = (rel) => dirname(rel).split(sep).join("/")

// Sort "The Beatles" under B, the way record shops do.
export const sortName = (s) => key(s).replace(/^(the|a|an|te|nga) /, "")

// What a search finds: every word has to appear somewhere.
export function matches(query, ...fields) {
  const words = key(query).split(" ").filter(Boolean)
  if (!words.length) return false
  const hay = key(fields.filter(Boolean).join(" "))
  return words.every((w) => hay.includes(w))
}
