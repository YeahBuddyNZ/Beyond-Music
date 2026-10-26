// One player for the whole app: the queue, Shuffle and Repeat, the lock screen and the TV remote's media keys.

import { useSyncExternalStore } from "react"
import { box, coverUrl, playUrl } from "@/api"
import { counts, nextPosition, previousPosition, shuffleOrder } from "./pure.js"
import type { Album, Playable, Station, Track } from "./types"

export type Repeat = "off" | "all" | "one"
export type PlayerState = {
  queue: Playable[]
  order: number[] // play order: indexes into queue
  pos: number // where we are in order
  playing: boolean
  time: number
  duration: number
  shuffle: boolean
  repeat: Repeat
  volume: number
  loading: boolean
  error: string | null
}

const audio = typeof Audio !== "undefined" ? new Audio() : (null as unknown as HTMLAudioElement)
audio.preload = "auto"

let s: PlayerState = { queue: [], order: [], pos: 0, playing: false, time: 0, duration: 0, shuffle: false, repeat: "off", volume: 1, loading: false, error: null }
const listeners = new Set<() => void>()
const set = (next: Partial<PlayerState>) => {
  s = { ...s, ...next }
  listeners.forEach((l) => l())
}

export const current = () => (s.order.length ? s.queue[s.order[s.pos]] : undefined)

export function usePlayer() {
  return useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => s)
}

export const fromTrack = (t: Track, album?: Album): Playable => ({
  kind: "track",
  id: t.id,
  title: t.title,
  artist: t.artist,
  albumId: t.albumId,
  hasCover: album ? album.hasCover : true,
  duration: t.duration,
})

export const fromStation = (r: Station): Playable => ({ kind: "radio", id: r.id, title: r.name, artist: r.town || "Radio", url: r.url, logo: r.logo })

export const artOf = (p?: Playable) => (!p ? "" : p.kind === "radio" ? p.logo : p.hasCover ? coverUrl(p.albumId) : "")

// How long this song has really been listened to, for "Played recently".
let listened = 0
let reported = false
let lastTick = 0

function load(autoplay = true) {
  const p = current()
  listened = 0
  reported = false
  if (!p) {
    audio.pause()
    audio.removeAttribute("src")
    audio.load()
    return set({ playing: false, time: 0, duration: 0 })
  }
  audio.src = p.kind === "radio" ? p.url : playUrl(p.id)
  set({ time: 0, duration: p.kind === "track" ? p.duration || 0 : 0, loading: true, error: null })
  media(p)
  if (autoplay) play()
}

export function play() {
  if (!current()) return
  audio.play().catch((e: Error) => {
    if (e.name === "NotAllowedError") set({ playing: false })
    else set({ error: "That one won’t play. It may have moved, or the box can’t read it.", playing: false, loading: false })
  })
}
export const pause = () => audio.pause()
export const toggle = () => (audio.paused ? play() : pause())

// Play a list from one song in it. Shuffle on starts from that song and shuffles the rest.
export function playList(items: Playable[], start = 0, shuffle = s.shuffle) {
  if (!items.length) return
  const order = shuffle ? shuffleOrder(items.length, start) : items.map((_, i) => i)
  set({ queue: items, order, pos: shuffle ? 0 : start, shuffle })
  load()
}

export function playNext(items: Playable[]) {
  if (!s.queue.length) return playList(items)
  const queue = [...s.queue, ...items]
  const added = items.map((_, i) => s.queue.length + i)
  const order = [...s.order.slice(0, s.pos + 1), ...added, ...s.order.slice(s.pos + 1)]
  set({ queue, order })
}

export function addToQueue(items: Playable[]) {
  if (!s.queue.length) return playList(items)
  const queue = [...s.queue, ...items]
  set({ queue, order: [...s.order, ...items.map((_, i) => s.queue.length + i)] })
}

export function jump(pos: number) {
  if (pos < 0 || pos >= s.order.length) return
  set({ pos })
  load()
}

export function next(ended = false) {
  const to = nextPosition(s.pos, s.order.length, s.repeat, ended)
  if (to < 0) {
    audio.pause()
    audio.currentTime = 0
    return set({ playing: false })
  }
  if (to === s.pos && ended) {
    audio.currentTime = 0
    return play()
  }
  set({ pos: to })
  load()
}

export function previous() {
  const p = previousPosition(s.pos, audio.currentTime, s.order.length)
  if (p.restart) {
    audio.currentTime = 0
    return
  }
  set({ pos: p.pos })
  load()
}

export function seek(seconds: number) {
  if (current()?.kind !== "track") return
  audio.currentTime = Math.max(0, Math.min(seconds, s.duration || seconds))
  set({ time: audio.currentTime })
}

export function setShuffle(on: boolean) {
  const here = s.order[s.pos] ?? 0
  const order = on ? shuffleOrder(s.queue.length, here) : s.queue.map((_, i) => i)
  set({ shuffle: on, order, pos: on ? 0 : here })
}

export const cycleRepeat = () => set({ repeat: s.repeat === "off" ? "all" : s.repeat === "all" ? "one" : "off" })

export function setVolume(v: number) {
  audio.volume = Math.max(0, Math.min(1, v))
  set({ volume: audio.volume })
}

// Stop the music when a video starts, so the two never play over each other.
export const stopForVideo = () => audio.pause()

audio.addEventListener("playing", () => set({ playing: true, loading: false }))
audio.addEventListener("pause", () => set({ playing: false }))
audio.addEventListener("waiting", () => set({ loading: true }))
audio.addEventListener("loadedmetadata", () => {
  if (Number.isFinite(audio.duration)) set({ duration: audio.duration })
})
audio.addEventListener("timeupdate", () => {
  const now = audio.currentTime
  const p = current()
  if (!audio.paused && now > lastTick && now - lastTick < 2) listened += now - lastTick
  lastTick = now
  if (p?.kind === "track" && !reported && counts(listened, s.duration)) {
    reported = true
    box.played(p.id)
  }
  if (Math.abs(now - s.time) >= 0.25) set({ time: now })
  if ("mediaSession" in navigator && p?.kind === "track" && Number.isFinite(audio.duration)) {
    try {
      navigator.mediaSession.setPositionState({ duration: audio.duration, position: Math.min(now, audio.duration), playbackRate: 1 })
    } catch {}
  }
})
audio.addEventListener("ended", () => next(true))
audio.addEventListener("error", () => {
  if (!audio.getAttribute("src")) return
  set({ error: current()?.kind === "radio" ? "That station isn’t answering right now." : "That one won’t play. It may have moved, or the box can’t read it.", playing: false, loading: false })
})

// The phone's lock screen, the car's screen over Bluetooth, and headphone buttons.
function media(p: Playable) {
  if (!("mediaSession" in navigator)) return
  const art = artOf(p)
  navigator.mediaSession.metadata = new MediaMetadata({
    title: p.title,
    artist: p.artist,
    album: p.kind === "radio" ? "Radio" : "",
    artwork: art ? [{ src: new URL(art, location.href).href, sizes: "600x600" }] : [],
  })
}
if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
  const ms = navigator.mediaSession
  const on = (a: MediaSessionAction, f: MediaSessionActionHandler) => {
    try { ms.setActionHandler(a, f) } catch {}
  }
  on("play", play)
  on("pause", pause)
  on("nexttrack", () => next())
  on("previoustrack", previous)
  on("seekto", (d) => d.seekTime != null && seek(d.seekTime))
}
