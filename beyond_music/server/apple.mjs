// A Mac's own music: iCloud Drive and the Music app. The folders are offered as places in Settings, songs still in
// iCloud are asked down to the Mac, and the Music app's playlists come across (from its shared Library.xml) each time
// the box looks for new music. One way only: the Music app is never written to.
//
// Songs from an Apple Music subscription are locked to Apple's own apps (FairPlay). They are never played or
// unlocked here, only counted, so the screen can say why they're missing.

import { readFile, stat } from "node:fs/promises"
import { spawn } from "node:child_process"
import { homedir, platform } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

export const isMac = () => platform() === "darwin"

export function iCloudDrive(home = homedir()) {
  return join(home, "Library", "Mobile Documents", "com~apple~CloudDocs")
}

// Where the Music app (and iTunes before it) keeps the songs it manages.
export function musicAppFolders(home = homedir()) {
  return [
    join(home, "Music", "Music", "Media.localized", "Music"),
    join(home, "Music", "Music", "Media", "Music"),
    join(home, "Music", "iTunes", "iTunes Media", "Music"),
  ]
}

// The file the Music app writes when Settings > Files > "Share Library XML with other applications" is on.
export function libraryXmlFiles(home = homedir()) {
  return [
    join(home, "Music", "Music", "Library.xml"),
    join(home, "Music", "iTunes", "iTunes Music Library.xml"),
    join(home, "Music", "iTunes", "iTunes Library.xml"),
  ]
}

// The friendly name a suggested folder gets.
export function placeName(path, home = homedir()) {
  if (path === iCloudDrive(home)) return "iCloud Drive"
  if (musicAppFolders(home).includes(path)) return "Music app"
  return null
}

// A song iCloud has kept in the cloud shows on the Mac as ".Song.mp3.icloud". Gives "Song.mp3", or null.
export function cloudName(name) {
  const m = /^\.(.+)\.icloud$/.exec(name)
  return m ? m[1] : null
}

// Asks iCloud to bring files down to the Mac. Doesn't wait: the next look picks them up.
export function bringDown(paths, run = spawn) {
  if (!isMac() || !paths.length) return 0
  const some = paths.slice(0, 500)
  for (let i = 0; i < some.length; i += 50) {
    try {
      const child = run("brctl", ["download", ...some.slice(i, i + 50)], { stdio: "ignore", detached: true })
      child.on?.("error", () => {})
      child.unref?.()
    } catch {}
  }
  return some.length
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }
const unescape = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (all, e) => (e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e] ?? all))

// A small reader for Apple's XML property lists: dict, array, key, string, integer, real, date, data, true, false.
export function readPlist(xml) {
  const re = /<(\/?)([a-z]+)\b[^>]*?(\/)?>|([^<]+)/gi
  const tokens = []
  let m
  while ((m = re.exec(xml))) {
    if (m[4] !== undefined) tokens.push({ text: m[4] })
    else tokens.push({ close: m[1] === "/", tag: m[2].toLowerCase(), empty: Boolean(m[3]) })
  }
  let i = tokens.findIndex((t) => t.tag === "plist" && !t.close)
  if (i < 0) throw new Error("Not a property list.")
  i++
  const skipText = () => {
    while (tokens[i]?.text !== undefined) i++
  }
  const textUntil = (tag) => {
    let s = ""
    while (tokens[i] && !(tokens[i].close && tokens[i].tag === tag)) s += tokens[i++].text ?? ""
    i++
    return unescape(s)
  }
  function value() {
    skipText()
    const t = tokens[i++]
    if (!t || t.close) throw new Error("Broken property list.")
    if (t.empty) return t.tag === "true" ? true : t.tag === "false" ? false : t.tag === "dict" ? {} : t.tag === "array" ? [] : ""
    switch (t.tag) {
      case "dict": {
        const out = {}
        for (;;) {
          skipText()
          if (tokens[i]?.close && tokens[i].tag === "dict") return i++, out
          const k = tokens[i++]
          if (k?.tag !== "key") throw new Error("Broken property list.")
          const key = textUntil("key")
          out[key] = value()
        }
      }
      case "array": {
        const out = []
        for (;;) {
          skipText()
          if (tokens[i]?.close && tokens[i].tag === "array") return i++, out
          out.push(value())
        }
      }
      case "integer":
      case "real":
        return Number(textUntil(t.tag))
      case "true":
      case "false":
        textUntil(t.tag)
        return t.tag === "true"
      default:
        return textUntil(t.tag)
    }
  }
  return value()
}

const LOCKED = /\.m4p$/i

// The Music app's library as plain playlists of file paths, leaving out its own built-in lists and folders.
export function readMusicLibrary(xml) {
  const plist = readPlist(xml)
  const tracks = plist.Tracks || {}
  const pathOf = {}
  const locked = new Set()
  for (const [id, t] of Object.entries(tracks)) {
    const loc = t.Location
    if (t.Protected || (loc && LOCKED.test(loc)) || (!loc && (t["Apple Music"] || t["Track Type"] === "Remote"))) locked.add(id)
    else if (loc && loc.startsWith("file:")) {
      try {
        pathOf[id] = fileURLToPath(loc.replace(/^file:\/\/localhost\//, "file:///")).normalize("NFC")
      } catch {}
    }
  }
  const playlists = []
  for (const p of plist.Playlists || []) {
    if (p.Master || p["Distinguished Kind"] !== undefined || p.Folder || p.Visible === false) continue
    const name = String(p.Name || "").trim()
    if (!name) continue
    const ids = (p["Playlist Items"] || []).map((x) => String(x["Track ID"]))
    playlists.push({
      key: String(p["Playlist Persistent ID"] || name),
      name,
      paths: ids.map((id) => pathOf[id]).filter(Boolean),
      locked: ids.filter((id) => locked.has(id)).length,
    })
  }
  return { playlists, locked: locked.size }
}

// Matches the Music app's playlists to songs the box has. `where` is the library's track id → path.
export function matchPlaylists(lib, where) {
  const idOf = new Map()
  for (const [id, path] of where) idOf.set(path.normalize("NFC"), id)
  let outside = 0
  const playlists = lib.playlists.map((p) => {
    const items = []
    for (const path of p.paths) {
      const id = idOf.get(path)
      if (id) items.push(id)
      else outside++
    }
    return { key: p.key, name: p.name, items }
  })
  return { playlists, outside, locked: lib.locked }
}

// Reads the first Library.xml there is. Null when the Music app isn't sharing one (or this isn't a Mac).
export async function musicAppLibrary(files = libraryXmlFiles()) {
  for (const f of files) {
    const st = await stat(f).catch(() => null)
    if (!st?.isFile()) continue
    return { file: f, mtime: st.mtimeMs, ...readMusicLibrary(await readFile(f, "utf8")) }
  }
  return null
}
