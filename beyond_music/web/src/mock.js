// A stand-in box for ?preview, with made-up music (never real family names). Left out of the box's own build.

const id = (s) => {
  let h = 2166136261
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return ((h >>> 0).toString(16) + "0000000000000").slice(0, 12)
}

const ALBUMS = [
  ["Aroha Band", "First Light", 2021, ["Tūī Song", "Morning", "Harbour Lights", "Long Way Home", "Pōhutukawa", "Golden Hour"]],
  ["Aroha Band", "Night Swim", 2023, ["Night Swim", "Phosphor", "Tide Pools", "Slow Wave"]],
  ["Nikau", "Spring", 2019, ["Kōwhai", "New Leaves", "Rain on the Roof", "Garden"]],
  ["Moana", "Tides", 2018, ["Harbour", "Undertow", "Shells", "Lighthouse", "Drift"]],
  ["The Kererū", "Up the Hill", 2016, ["Up the Hill", "Wood Pigeon", "Bush Walk"]],
  ["Weka", "Weather", 2022, ["Rain", "Sun", "Southerly", "Fog"]],
  ["Pukeko Club", "Swamp Disco", 2020, ["Swamp Disco", "Blue Feathers", "Dance All Night", "Red Beak"]],
  ["Kiwi Kids Choir", "Songs for School", 2024, ["Wake Up", "Brush Your Teeth", "Lunchbox", "Home Time", "Bedtime"]],
  ["Rimu", "Old Growth", 2015, ["Old Growth", "Heartwood", "Canopy"]],
  ["Surf Club", "Summer Days", 2017, ["Summer Days", "Jandals", "Sandy Feet", "Last Wave"]],
]

let lib = null

export function mockLibrary() {
  if (lib) return Promise.resolve(structuredClone(lib))
  const albums = []
  const tracks = []
  const artists = new Map()
  const day = 86400000
  ALBUMS.forEach(([artist, title, year, songs], i) => {
    const albumId = id("al" + title)
    const artistId = id("ar" + artist)
    const trackIds = songs.map((s, n) => {
      const tid = id("tr" + title + s)
      tracks.push({ id: tid, title: s, artist, albumArtist: artist, album: title, albumId, artistId, track: n + 1, year, duration: 150 + ((n * 37 + i * 11) % 120), ext: "flac", added: Date.now() - i * day })
      return tid
    })
    albums.push({ id: albumId, title, artist, artistId, year, added: Date.now() - i * day, hasCover: i !== 8, duration: trackIds.length * 200, trackIds })
    const a = artists.get(artistId) || { id: artistId, name: artist, albumIds: [], trackCount: 0 }
    a.albumIds.push(albumId)
    a.trackCount += trackIds.length
    artists.set(artistId, a)
  })
  const videos = [
    { kind: "episode", show: "Kiwi Kids", season: 1, episode: 1, title: "The Beach" },
    { kind: "episode", show: "Kiwi Kids", season: 1, episode: 2, title: "The Bush" },
    { kind: "episode", show: "Kiwi Kids", season: 2, episode: 1, title: "The Mountain" },
    { kind: "film", title: "Big Day Out", year: 2019 },
    { kind: "film", title: "The Long Summer", year: 2021 },
    { kind: "home", title: "01/01/2024, 12:00", folder: "Christmas at the beach" },
    { kind: "home", title: "14/03/2025, 09:30", folder: "First day of school" },
  ].map((v, i) => ({ id: id("v" + i + v.title), ext: "mp4", size: 1e8, added: Date.now() - i * day, ...v }))
  lib = {
    name: "Beyond Music",
    version: "preview",
    scannedAt: Date.now(),
    scanning: false,
    albums,
    artists: [...artists.values()],
    tracks,
    videos,
    playlists: [
      { id: id("pl1"), name: "Saturday morning", items: tracks.filter((_, i) => i % 3 === 0).map((t) => t.id), created: Date.now(), updated: Date.now() },
      { id: id("pl2"), name: "Kids' car songs", items: tracks.filter((t) => t.artist === "Kiwi Kids Choir").map((t) => t.id), created: Date.now(), updated: Date.now() },
    ],
    recent: tracks.slice(4, 10).map((t, i) => ({ id: t.id, at: Date.now() - i * 60000 })),
  }
  return Promise.resolve(structuredClone(lib))
}

export const mockRadio = async () => [
  { id: "r1", name: "Kiwi Radio National", url: "./sample.mp3", logo: "", town: "Wellington", tags: ["news", "talk"], rnz: true },
  { id: "r2", name: "Harbour FM", url: "./sample.mp3", logo: "", town: "Auckland", tags: ["pop"], rnz: false },
  { id: "r3", name: "Southern Sounds", url: "./sample.mp3", logo: "", town: "Dunedin", tags: ["rock", "indie"], rnz: false },
  { id: "r4", name: "Mountain Country", url: "./sample.mp3", logo: "", town: "Queenstown", tags: ["country"], rnz: false },
]

let places = [
  { id: "cds", name: "Copied CDs", path: "/data/Copied CDs", files: 12, fixed: true },
  { id: "p1", name: "Music", path: "/media/usb/Music", files: 1840, fixed: false },
]
export const mockPlaces = async () => ({ places: structuredClone(places), suggestions: ["/home/family/Music", "/media/usb2"] })
export const mockBrowse = async (path) =>
  path ? { at: path, folders: ["Music", "Videos", "Backup"].map((n) => ({ name: n, path: path + "/" + n })) } : { at: null, folders: [{ name: "/home/family", path: "/home/family" }, { name: "/media", path: "/media" }] }
export const mockAddPlace = async (path) => {
  places.push({ id: id(path), name: path.split("/").pop(), path, files: 0, fixed: false })
}
export const mockRemovePlace = async (pid) => {
  places = places.filter((p) => p.id !== pid)
}
export const mockSavePlaylist = async (p) => {
  await mockLibrary()
  const existing = lib.playlists.find((x) => x.id === p.id)
  if (existing) Object.assign(existing, { name: p.name, items: p.items, updated: Date.now() })
  else lib.playlists.push({ id: id("pl" + Date.now()), name: p.name, items: p.items, created: Date.now(), updated: Date.now() })
  return structuredClone(existing || lib.playlists[lib.playlists.length - 1])
}
export const mockDeletePlaylist = async (pid) => {
  lib.playlists = lib.playlists.filter((p) => p.id !== pid)
}
export const mockPlayed = async (tid) => {
  if (lib) lib.recent = [{ id: tid, at: Date.now() }, ...lib.recent.filter((r) => r.id !== tid)].slice(0, 50)
}
export const mockSold = async (albumId) => {
  lib.albums = lib.albums.filter((a) => a.id !== albumId)
  lib.tracks = lib.tracks.filter((t) => t.albumId !== albumId)
  return { deleted: 4, elsewhere: 0 }
}
export const mockCd = async () => ({ canCopy: false, hasTools: false, hasDrive: false, copying: false, last: null })
let apps = false
export const mockApps = async () => ({ on: apps, password: apps ? "kiwi-tide-fern-42" : "", user: "household", addresses: ["http://192.168.1.20:8097"] })
export const mockSetApps = async (on) => {
  apps = on
}

// DJ sticks: one made-up stick that pretends to copy.
let labs = {}
let job = { state: "idle" }
export const mockLabs = async () => labs
export const mockSetLab = async (name, on) => (labs = { ...labs, [name]: on })
export const mockUsb = async () => {
  if (job.state === "copying") job = job.done + 1 >= job.total ? { ...job, done: job.total, state: "done", current: null } : { ...job, done: job.done + 1, current: "A made-up song" }
  return { sticks: [{ name: "DJ STICK", path: "/Volumes/DJ STICK", free: 12e9, size: 16e9, ours: false, rekordbox: false }], job }
}
export const mockCopyToUsb = async () => {
  job = { state: "copying", stick: "DJ STICK", done: 0, total: 4, skipped: 1 }
  return { job, skipped: [{ title: "A made-up Ogg file" }] }
}
