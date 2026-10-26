// What the household has told the box: the places it keeps music and videos, its playlists, what was played
// lately (for Keep going) and albums taken out. One JSON file in the box's data folder, never sent anywhere.

import { readFile, writeFile, rename, mkdir, stat, readdir } from "node:fs/promises"
import { join, resolve, basename, sep } from "node:path"
import { homedir, platform } from "node:os"
import { randomBytes } from "node:crypto"

const MAX_PLAYLISTS = 200
const MAX_ITEMS = 2000
const RECENT = 50
const WORDS = ["kiwi", "tui", "kea", "fern", "tide", "moana", "river", "harbour", "pohutukawa", "kauri", "korimako", "waka", "sun", "rain", "hill", "beach", "surf", "maunga", "nikau", "rimu", "totara", "weka", "pukeko", "kereru"]

export async function createStore(dataDir) {
  await mkdir(dataDir, { recursive: true })
  const file = join(dataDir, "beyond-music.json")
  let state = { places: [], playlists: [], recent: [], hidden: [], name: "" }
  try {
    state = { ...state, ...JSON.parse(await readFile(file, "utf8")) }
  } catch {}
  let timer
  const save = () => {
    clearTimeout(timer)
    timer = setTimeout(async () => {
      const tmp = file + ".tmp"
      await writeFile(tmp, JSON.stringify(state, null, 1))
      await rename(tmp, file)
    }, 200)
  }
  const id = () => randomBytes(6).toString("hex")
  return {
    get state() {
      return state
    },
    async addPlace(path, name) {
      const full = resolve(String(path || ""))
      const st = await stat(full).catch(() => null)
      if (!st?.isDirectory()) throw new Error("That folder isn't there.")
      if (state.places.some((p) => p.path === full)) return state.places
      if (state.places.some((p) => full.startsWith(p.path + sep) || p.path.startsWith(full + sep)))
        throw new Error("That folder is inside one already added, or holds one.")
      state.places.push({ id: id(), path: full, name: String(name || basename(full) || full).slice(0, 60) })
      save()
      return state.places
    },
    removePlace(placeId) {
      state.places = state.places.filter((p) => p.id !== placeId)
      save()
      return state.places
    },
    savePlaylist(input, existing) {
      const name = String(input.name || "").trim().slice(0, 80)
      if (!name) throw new Error("Give the playlist a name.")
      const items = (Array.isArray(input.items) ? input.items : []).filter((x) => typeof x === "string" && /^[a-f0-9]{12}$/.test(x)).slice(0, MAX_ITEMS)
      if (existing) {
        const p = state.playlists.find((x) => x.id === existing)
        if (!p) throw new Error("That playlist has gone.")
        Object.assign(p, { name, items, updated: Date.now() })
        save()
        return p
      }
      if (state.playlists.length >= MAX_PLAYLISTS) throw new Error("That's a lot of playlists. Take one away first.")
      const p = { id: id(), name, items, created: Date.now(), updated: Date.now() }
      state.playlists.push(p)
      save()
      return p
    },
    deletePlaylist(pid) {
      state.playlists = state.playlists.filter((p) => p.id !== pid)
      save()
    },
    played(trackId) {
      if (!/^[a-f0-9]{12}$/.test(trackId)) return
      state.recent = [{ id: trackId, at: Date.now() }, ...state.recent.filter((r) => r.id !== trackId)].slice(0, RECENT)
      save()
    },
    hide(albumId) {
      if (!state.hidden.includes(albumId)) state.hidden.push(albumId)
      save()
    },
    // Other music apps (Subsonic): a password of easy words, read out once and typed into the app.
    setApps(on) {
      if (!on) state.appsPassword = ""
      else if (!state.appsPassword) state.appsPassword = [...randomBytes(3)].map((n) => WORDS[n % WORDS.length]).join("-") + "-" + (randomBytes(1)[0] % 90 + 10)
      save()
      return state.appsPassword
    },
    setName(name) {
      state.name = String(name || "").trim().slice(0, 40)
      save()
    },
  }
}

// Where music and videos usually are on this kind of box, so nobody has to type a folder.
export function usualPlaces() {
  const home = homedir()
  const list = [join(home, "Music"), join(home, "Videos"), join(home, "Movies"), join(home, "Music", "iTunes", "iTunes Media", "Music")]
  if (platform() === "darwin") list.push("/Volumes")
  else if (platform() === "win32") for (const d of "DEFGHIJ") list.push(`${d}:\\`)
  else list.push("/media", "/mnt", "/run/media", "/srv", "/share", "/data/music", "/media/music")
  return list
}

// Folders a person may look through when adding a place: under the usual roots only, never the whole disk.
export function browseRoots() {
  const home = homedir()
  if (platform() === "darwin") return [home, "/Volumes"]
  if (platform() === "win32") return [home, ..."DEFGHIJ".split("").map((d) => `${d}:\\`)]
  return [home, "/media", "/mnt", "/run/media", "/srv", "/share"]
}

export function insideRoots(path, roots = browseRoots()) {
  const full = resolve(path)
  return roots.some((r) => full === resolve(r) || full.startsWith(resolve(r) + (r.endsWith("\\") ? "" : "/")))
}

export async function listFolders(path) {
  const entries = await readdir(path, { withFileTypes: true }).catch(() => [])
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !/^(\$RECYCLE\.BIN|System Volume Information|lost\+found)$/i.test(e.name))
    .map((e) => ({ name: e.name, path: join(path, e.name) }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 300)
}

// Whether a folder has any music or video in its first few levels: suggestions only show folders worth adding.
export async function hasMedia(path, kindOf, depth = 0, budget = { left: 3000 }) {
  if (depth > 3 || budget.left <= 0) return false
  const entries = await readdir(path, { withFileTypes: true }).catch(() => [])
  for (const e of entries) {
    if (--budget.left <= 0) return false
    if (e.isFile() && (kindOf(e.name) === "audio" || kindOf(e.name) === "video")) return true
  }
  for (const e of entries) if (e.isDirectory() && !e.name.startsWith(".") && (await hasMedia(join(path, e.name), kindOf, depth + 1, budget))) return true
  return false
}
