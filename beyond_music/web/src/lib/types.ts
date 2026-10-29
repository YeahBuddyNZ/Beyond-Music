// The shapes the box sends (beyond_music/server/main.mjs payload()).

export type Track = {
  id: string
  title: string
  artist: string
  albumArtist: string
  album: string
  albumId: string
  artistId: string
  track?: number
  disc?: number
  year?: number
  genre?: string
  duration?: number
  ext: string
  added: number
}

export type Album = {
  id: string
  title: string
  artist: string
  artistId: string
  year?: number
  added: number
  hasCover: boolean
  duration: number
  trackIds: string[]
}

export type Artist = { id: string; name: string; albumIds: string[]; trackCount: number }

export type Video = {
  id: string
  kind: "film" | "episode" | "home"
  title: string
  show?: string
  season?: number
  episode?: number
  year?: number
  folder?: string
  ext: string
  size: number
  added: number
}

export type Playlist = { id: string; name: string; items: string[]; created: number; updated: number }

export type Library = {
  name: string
  version: string
  scannedAt: number | null
  scanning: boolean
  albums: Album[]
  artists: Artist[]
  tracks: Track[]
  videos: Video[]
  playlists: Playlist[]
  recent: { id: string; at: number }[]
}

export type Station = { id: string; name: string; url: string; logo: string; town: string; tags: string[]; rnz: boolean }

export type Place = { id: string; name: string; path: string; files: number; fixed: boolean }
export type Places = { places: Place[]; suggestions: string[] }
export type Folder = { name: string; path: string }

export type CdStatus = {
  canCopy: boolean
  hasTools: boolean
  hasDrive: boolean
  // A Mac shows no drive until a disc is in it: then this is true and the words say put a CD in.
  needsDisc?: boolean
  disc?: string | null
  copying: boolean
  last: { started: number; done: boolean; ok: boolean; line: string } | null
}

// A USB stick plugged into the box, for Pioneer DJ players. `rekordbox`: rekordbox made the library on it.
export type Stick = { name: string; path: string; free: number | null; size: number | null; ours: boolean; rekordbox: boolean }
export type UsbJob = { state: "idle" | "copying" | "done" | "failed"; stick?: string; done?: number; total?: number; skipped?: number; current?: string | null; error?: string }
export type Labs = { usb?: boolean }

export type Apps = { on: boolean; password: string; user: string; addresses: string[] }

// What plays: a song from the box, or a radio station's own stream.
export type Playable =
  | { kind: "track"; id: string; title: string; artist: string; albumId: string; hasCover: boolean; duration?: number }
  | { kind: "radio"; id: string; title: string; artist: string; url: string; logo: string }
