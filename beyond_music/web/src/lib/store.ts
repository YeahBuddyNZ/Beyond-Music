// The library, kept once for every screen. Asked again while the box is still looking through the folders.

import { useEffect, useSyncExternalStore } from "react"
import { box } from "@/api"
import type { Album, Artist, Library, Station, Track } from "./types"

type State = { lib: Library | null; error: string | null; radio: Station[] | null }

let state: State = { lib: null, error: null, radio: null }
const listeners = new Set<() => void>()
const set = (next: Partial<State>) => {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

let loading: Promise<void> | null = null
let poll: number | undefined

export function reload() {
  loading = box
    .library()
    .then((lib) => {
      set({ lib, error: null })
      clearTimeout(poll)
      if (lib.scanning) poll = window.setTimeout(reload, 3000)
    })
    .catch((e: Error) => set({ error: e.message }))
    .finally(() => (loading = null))
  return loading
}

export async function loadRadio() {
  if (state.radio) return
  try {
    set({ radio: await box.radio() })
  } catch {
    set({ radio: [] })
  }
}

export function useLibrary() {
  const s = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
  )
  useEffect(() => {
    if (!s.lib && !loading) reload()
  }, [s.lib])
  return s
}

// Lookups the screens need, worked out once per library.
const cache = new WeakMap<Library, { album: Map<string, Album>; artist: Map<string, Artist>; track: Map<string, Track> }>()
export function index(lib: Library) {
  let i = cache.get(lib)
  if (!i) {
    i = {
      album: new Map(lib.albums.map((a) => [a.id, a])),
      artist: new Map(lib.artists.map((a) => [a.id, a])),
      track: new Map(lib.tracks.map((t) => [t.id, t])),
    }
    cache.set(lib, i)
  }
  return i
}
