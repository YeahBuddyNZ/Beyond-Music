// Talking to the box: only its own /api routes (beyond_music/server/main.mjs). Paths are relative so the app works
// at the box's address, behind Home Assistant's ingress, or opened by Beyond TV with ?box=http://address:8097.
// ?preview swaps the box for the stand-in in mock.js, so the app can be looked at in a browser.

import type { Apps, CdStatus, Folder, Library, Places, Playlist, Station } from "@/lib/types"

export const PREVIEW = import.meta.env.MODE !== "box" && /[?&]preview/.test(location.search)

// Beyond TV opens the app from its own files and says where the box is.
const boxParam = new URLSearchParams(location.search).get("box")
export const BOX = boxParam && /^https?:\/\/[^/]+$/.test(boxParam) ? boxParam + "/" : "./"

export const playUrl = (id: string, video = false) => (PREVIEW ? (video ? "./sample.mp4" : "./sample.mp3") : `${BOX}api/play/${id}`)
export const coverUrl = (albumId: string) => (PREVIEW ? sampleCover(albumId) : `${BOX}api/cover/${albumId}`)

// A made-up cover for the preview: two colours from the album's id.
function sampleCover(id: string) {
  const hue = parseInt(id.slice(0, 6), 16) % 360
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,55%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360},60%,25%)"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/><circle cx="70" cy="30" r="14" fill="rgba(255,255,255,.25)"/></svg>`
  return "data:image/svg+xml," + encodeURIComponent(svg)
}

async function answer(res: Response) {
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || "The music box didn’t answer.")
  return body
}

const get = (path: string) => fetch(BOX + path, { cache: "no-store" }).then(answer)
const post = (path: string, body: unknown = {}) =>
  fetch(BOX + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(answer)

const mock = () => import("./mock.js")

export const box = {
  async library(): Promise<Library> {
    return PREVIEW ? (await mock()).mockLibrary() : get("api/library")
  },
  async radio(): Promise<Station[]> {
    return PREVIEW ? (await mock()).mockRadio() : (await get("api/radio")).stations
  },
  async places(): Promise<Places> {
    return PREVIEW ? (await mock()).mockPlaces() : get("api/places")
  },
  async browse(path?: string): Promise<{ at: string | null; folders: Folder[] }> {
    if (PREVIEW) return (await mock()).mockBrowse(path)
    return get("api/places/browse" + (path ? `?path=${encodeURIComponent(path)}` : ""))
  },
  async addPlace(path: string, name?: string) {
    return PREVIEW ? (await mock()).mockAddPlace(path) : post("api/places", { path, name })
  },
  async removePlace(id: string) {
    return PREVIEW ? (await mock()).mockRemovePlace(id) : post("api/places/remove", { id })
  },
  async scan() {
    return PREVIEW ? undefined : post("api/scan")
  },
  async savePlaylist(p: { id?: string; name: string; items: string[] }): Promise<Playlist> {
    if (PREVIEW) return (await mock()).mockSavePlaylist(p)
    return post(p.id ? `api/playlists/${p.id}` : "api/playlists", { name: p.name, items: p.items })
  },
  async deletePlaylist(id: string) {
    return PREVIEW ? (await mock()).mockDeletePlaylist(id) : post(`api/playlists/${id}/delete`)
  },
  async played(id: string) {
    if (PREVIEW) return (await mock()).mockPlayed(id)
    return post("api/played", { id }).catch(() => {})
  },
  async sold(albumId: string): Promise<{ deleted: number; elsewhere: number }> {
    return PREVIEW ? (await mock()).mockSold(albumId) : post(`api/albums/${albumId}/sold`)
  },
  async cd(): Promise<CdStatus> {
    return PREVIEW ? (await mock()).mockCd() : get("api/cd")
  },
  async copyCd(): Promise<CdStatus> {
    return post("api/cd/copy")
  },
  async apps(): Promise<Apps> {
    return PREVIEW ? (await mock()).mockApps() : get("api/apps")
  },
  async setApps(on: boolean) {
    return PREVIEW ? (await mock()).mockSetApps(on) : post("api/apps", { on })
  },
  async setName(name: string) {
    return PREVIEW ? undefined : post("api/name", { name })
  },
}
