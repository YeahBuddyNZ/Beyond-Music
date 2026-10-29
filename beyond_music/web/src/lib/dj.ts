// DJ mode's sound: two decks and a mixer in the browser's own audio engine. Each deck holds its whole song, so it can
// play at any speed, backwards under a hand on the platter, and loop on the beat. The maths is in djpure.js.

import { useSyncExternalStore } from "react"
import { box } from "@/api"
import { crossfade, eqDb, findTempo, loopFrom, onsets, peaks, phaseShift, syncTo, tempoRate } from "./djpure.js"
import type { Track } from "./types"

export type DeckId = "a" | "b"

export type DeckState = {
  track: Track | null
  loading: boolean
  error: string | null
  duration: number
  bpm: number | null
  first: number
  playing: boolean
  cue: number
  hot: (number | null)[]
  loop: [number, number] | null
  fader: number // tempo fader, -1 to 1
  range: number // 0.08, 0.16 or 0.5
  volume: number
  high: number
  mid: number
  low: number
  overview: Float32Array | null // the whole song, 600 slices
  detail: Float32Array | null // 100 slices a second
}

export type MixerState = { xfader: number; curve: "smooth" | "sharp"; master: number; ready: boolean }

const fresh = (): DeckState => ({
  track: null, loading: false, error: null, duration: 0, bpm: null, first: 0, playing: false, cue: 0,
  hot: [null, null, null, null], loop: null, fader: 0, range: 0.08, volume: 0.8, high: 0.5, mid: 0.5, low: 0.5,
  overview: null, detail: null,
})

// The deck itself, running in the audio thread: reads the song at its own speed, eases into a new speed like a
// platter's motor, and goes round a loop.
const WORKLET = `
class BeyondDeck extends AudioWorkletProcessor {
  constructor() {
    super(); this.l = null; this.r = null; this.pos = 0; this.speed = 0; this.base = 1; this.playing = false
    this.hand = null; this.loop = null; this.n = 0
    this.port.onmessage = (e) => {
      const m = e.data
      if (m.l) { this.l = m.l; this.r = m.r || m.l; this.pos = 0; this.speed = 0; this.loop = null }
      if ('base' in m) this.base = m.base
      if ('playing' in m) this.playing = m.playing
      if ('seek' in m) this.pos = Math.max(0, m.seek * sampleRate)
      if ('nudge' in m) this.pos = Math.max(0, this.pos + m.nudge * sampleRate)
      if ('hand' in m) this.hand = m.hand
      if ('loop' in m) this.loop = m.loop ? [m.loop[0] * sampleRate, m.loop[1] * sampleRate] : null
    }
  }
  process(inputs, outputs) {
    const L = outputs[0][0], R = outputs[0][1] || L
    if (!this.l) { L.fill(0); R.fill(0); return true }
    const want = this.hand !== null ? this.hand : this.playing ? this.base : 0
    const ease = this.hand !== null ? 0.02 : this.playing ? 0.004 : 0.002
    const end = this.l.length - 2
    for (let i = 0; i < L.length; i++) {
      this.speed += (want - this.speed) * ease
      const p = this.pos, j = p | 0, f = p - j
      if (j >= 0 && j < end) {
        L[i] = this.l[j] + (this.l[j + 1] - this.l[j]) * f
        R[i] = this.r[j] + (this.r[j + 1] - this.r[j]) * f
      } else { L[i] = 0; R[i] = 0 }
      this.pos += this.speed
      if (this.loop && this.speed > 0 && this.pos >= this.loop[1]) this.pos -= this.loop[1] - this.loop[0]
      if (this.pos < 0) this.pos = 0
      if (this.pos > end) { this.pos = end; if (this.playing) { this.playing = false; this.port.postMessage({ ended: true }) } }
    }
    if ((this.n++ & 3) === 0) this.port.postMessage({ pos: this.pos / sampleRate, speed: this.speed })
    return true
  }
}
registerProcessor('beyond-deck', BeyondDeck)
`

let ctx: AudioContext | null = null
let master: GainNode | null = null

type Deck = {
  id: DeckId
  s: DeckState
  node: AudioWorkletNode | null
  high: BiquadFilterNode | null
  mid: BiquadFilterNode | null
  low: BiquadFilterNode | null
  vol: GainNode | null
  side: GainNode | null
  pos: number // seconds, from the audio thread
  speed: number
}

const decks: Record<DeckId, Deck> = {
  a: { id: "a", s: fresh(), node: null, high: null, mid: null, low: null, vol: null, side: null, pos: 0, speed: 0 },
  b: { id: "b", s: fresh(), node: null, high: null, mid: null, low: null, vol: null, side: null, pos: 0, speed: 0 },
}
let mixer: MixerState = { xfader: 0, curve: "smooth", master: 0.9, ready: false }

const listeners = new Set<() => void>()
const tell = () => listeners.forEach((l) => l())
const setDeck = (id: DeckId, next: Partial<DeckState>) => {
  decks[id].s = { ...decks[id].s, ...next }
  tell()
}
const setMixer = (next: Partial<MixerState>) => {
  mixer = { ...mixer, ...next }
  tell()
}

let snapshot = { a: decks.a.s, b: decks.b.s, mixer }
export function useDj() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => {
      if (snapshot.a !== decks.a.s || snapshot.b !== decks.b.s || snapshot.mixer !== mixer) snapshot = { a: decks.a.s, b: decks.b.s, mixer }
      return snapshot
    },
  )
}

// Where a deck is right now, for the platter and the waveform, which draw every frame without React.
export const position = (id: DeckId) => decks[id].pos
export const speed = (id: DeckId) => decks[id].speed

// The audio engine can only start after a tap, so the first press anywhere on the DJ screen calls this.
export async function start() {
  if (ctx) {
    if (ctx.state === "suspended") await ctx.resume()
    return
  }
  ctx = new AudioContext({ latencyHint: "interactive" })
  const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }))
  await ctx.audioWorklet.addModule(url)
  URL.revokeObjectURL(url)
  master = ctx.createGain()
  master.gain.value = mixer.master
  master.connect(ctx.destination)
  for (const d of Object.values(decks)) {
    d.node = new AudioWorkletNode(ctx, "beyond-deck", { numberOfInputs: 0, outputChannelCount: [2] })
    d.low = ctx.createBiquadFilter()
    d.low.type = "lowshelf"
    d.low.frequency.value = 250
    d.mid = ctx.createBiquadFilter()
    d.mid.type = "peaking"
    d.mid.frequency.value = 1000
    d.mid.Q.value = 0.7
    d.high = ctx.createBiquadFilter()
    d.high.type = "highshelf"
    d.high.frequency.value = 4000
    d.vol = ctx.createGain()
    d.side = ctx.createGain()
    d.node.connect(d.low).connect(d.mid).connect(d.high).connect(d.vol).connect(d.side).connect(master)
    d.node.port.onmessage = (e) => {
      if (e.data.ended) setDeck(d.id, { playing: false })
      else {
        d.pos = e.data.pos
        d.speed = e.data.speed
      }
    }
    applyDeck(d.id)
  }
  applyMixer()
  setMixer({ ready: true })
}

function applyDeck(id: DeckId) {
  const d = decks[id]
  if (!d.node || !ctx) return
  const t = ctx.currentTime
  d.vol!.gain.setTargetAtTime(d.s.volume, t, 0.01)
  d.high!.gain.setTargetAtTime(eqDb(d.s.high), t, 0.01)
  d.mid!.gain.setTargetAtTime(eqDb(d.s.mid), t, 0.01)
  d.low!.gain.setTargetAtTime(eqDb(d.s.low), t, 0.01)
  d.node.port.postMessage({ base: tempoRate(d.s.fader, d.s.range) })
}

function applyMixer() {
  if (!ctx || !master) return
  const [a, b] = crossfade(mixer.xfader, mixer.curve)
  const t = ctx.currentTime
  decks.a.side?.gain.setTargetAtTime(a, t, 0.005)
  decks.b.side?.gain.setTargetAtTime(b, t, 0.005)
  master.gain.setTargetAtTime(mixer.master, t, 0.01)
}

const send = (id: DeckId, m: Record<string, unknown>, transfer: Transferable[] = []) => decks[id].node?.port.postMessage(m, transfer)

// Cues and hot cues are a convenience kept on this computer, per song.
const CUES = "bm.dj.cues"
function savedCues(trackId: string): { cue: number; hot: (number | null)[] } | null {
  try {
    return JSON.parse(localStorage.getItem(CUES) || "{}")[trackId] || null
  } catch {
    return null
  }
}
function saveCues(id: DeckId) {
  const s = decks[id].s
  if (!s.track) return
  try {
    const all = JSON.parse(localStorage.getItem(CUES) || "{}")
<<<<<<< HEAD
    all[s.track.id] = { cue: s.cue, hot: s.hot, bpm: s.bpm }
=======
    all[s.track.id] = { cue: s.cue, hot: s.hot }
>>>>>>> cc35e9c
    localStorage.setItem(CUES, JSON.stringify(all))
  } catch {
    /* private window: cues last until the page closes */
  }
}

export async function load(id: DeckId, track: Track) {
  await start()
  send(id, { playing: false, loop: null })
  decks[id].pos = 0
  setDeck(id, { ...fresh(), fader: decks[id].s.fader, range: decks[id].s.range, volume: decks[id].s.volume, high: decks[id].s.high, mid: decks[id].s.mid, low: decks[id].s.low, track, loading: true })
  try {
    const bytes = await box.audio(track.id)
    const buf = await ctx!.decodeAudioData(bytes)
    if (decks[id].s.track?.id !== track.id) return // another song was loaded meanwhile
    const l = buf.getChannelData(0).slice()
    const r = buf.numberOfChannels > 1 ? buf.getChannelData(1).slice() : null
    // Beats from the left and right together; the analysis is done once, as the song loads.
    const mono = new Float32Array(l.length)
    for (let i = 0; i < l.length; i++) mono[i] = r ? (l[i] + r[i]) / 2 : l[i]
    const hop = 512
    const tempo = findTempo(onsets(mono, hop), buf.sampleRate / hop)
    const overview = peaks(mono, 600)
    const detail = peaks(mono, Math.max(1, Math.round(buf.duration * 100)))
    const kept = savedCues(track.id)
    send(id, r ? { l, r } : { l }, r ? [l.buffer, r.buffer] : [l.buffer])
    if (kept?.cue) send(id, { seek: kept.cue })
    setDeck(id, {
      loading: false, duration: buf.duration, bpm: tempo?.bpm ?? null, first: tempo?.first ?? 0, overview, detail,
      cue: kept?.cue ?? tempo?.first ?? 0, hot: kept?.hot ?? [null, null, null, null],
    })
    applyDeck(id)
<<<<<<< HEAD
    if (tempo) saveCues(id) // the tempo goes with the song onto a DJ stick
=======
>>>>>>> cc35e9c
  } catch (e) {
    setDeck(id, { loading: false, track: null, error: (e as Error).message.includes("box") ? (e as Error).message : "That song wouldn’t open for DJ mode." })
  }
}

export function togglePlay(id: DeckId) {
  const s = decks[id].s
  if (!s.track || s.loading) return
  send(id, { playing: !s.playing })
  setDeck(id, { playing: !s.playing })
}

// Cue, the way a club deck does it: stopped, it marks this spot; playing, it goes back to the mark and stops there.
export function cue(id: DeckId) {
  const s = decks[id].s
  if (!s.track) return
  if (s.playing) {
    send(id, { playing: false, seek: s.cue })
    decks[id].pos = s.cue
    setDeck(id, { playing: false })
  } else {
    setDeck(id, { cue: decks[id].pos })
    saveCues(id)
  }
}

// A hot cue: empty, it remembers this spot; set, it jumps there and keeps playing.
export function hotCue(id: DeckId, n: number, clear = false) {
  const s = decks[id].s
  if (!s.track) return
  const hot = [...s.hot]
  if (clear) hot[n] = null
  else if (hot[n] == null) hot[n] = decks[id].pos
  else {
    send(id, { seek: hot[n] })
    decks[id].pos = hot[n]!
  }
  setDeck(id, { hot })
  saveCues(id)
}

export function seek(id: DeckId, seconds: number) {
  send(id, { seek: seconds })
  decks[id].pos = seconds
}

// A hand on the platter: null lets go and the motor brings it back to speed.
export const hand = (id: DeckId, speed: number | null) => send(id, { hand: speed })

// The jog wheel's edge: a small push faster or slower to line the beats up by ear.
export const nudge = (id: DeckId, seconds: number) => send(id, { nudge: seconds })

export function setTempo(id: DeckId, fader: number) {
  setDeck(id, { fader: Math.max(-1, Math.min(1, fader)) })
  applyDeck(id)
}

export function setRange(id: DeckId, range: number) {
  const s = decks[id].s
  // Keep the speed it's playing at when the range changes.
  const rate = tempoRate(s.fader, s.range)
  setDeck(id, { range, fader: Math.max(-1, Math.min(1, (rate - 1) / range)) })
  applyDeck(id)
}

export function setLevel(id: DeckId, part: "volume" | "high" | "mid" | "low", v: number) {
  setDeck(id, { [part]: Math.max(0, Math.min(1, v)) })
  applyDeck(id)
}

export function setXfader(x: number) {
  setMixer({ xfader: Math.max(-1, Math.min(1, x)) })
  applyMixer()
}

export function setCurve(curve: "smooth" | "sharp") {
  setMixer({ curve })
  applyMixer()
}

export function setMaster(v: number) {
  setMixer({ master: Math.max(0, Math.min(1, v)) })
  applyMixer()
}

// Sync: this deck's tempo to the other's, and its beats onto the other's beats when both are playing.
export function sync(id: DeckId) {
  const me = decks[id]
  const them = decks[id === "a" ? "b" : "a"]
  if (!me.s.bpm || !them.s.bpm) return false
  const theirRate = tempoRate(them.s.fader, them.s.range)
  const r = syncTo(me.s.bpm, them.s.bpm, theirRate, me.s.range)
  setDeck(id, { fader: r.fader, range: r.range })
  applyDeck(id)
  if (them.s.playing) {
    const shift = phaseShift(me.pos, me.s.first, me.s.bpm, them.pos, them.s.first, them.s.bpm)
    send(id, { nudge: shift })
  }
  return true
}

// A 4 beat loop from the beat playing now; pressed again, the song carries on.
export function toggleLoop(id: DeckId, beats = 4) {
  const s = decks[id].s
  if (!s.track) return
  if (s.loop) {
    send(id, { loop: null })
    return setDeck(id, { loop: null })
  }
  if (!s.bpm) return
  const loop = loopFrom(decks[id].pos, s.first, s.bpm, beats)
  send(id, { loop })
  setDeck(id, { loop })
}

// The tempo each deck is playing at now, fader and all.
export const liveBpm = (s: DeckState) => (s.bpm ? Math.round(s.bpm * tempoRate(s.fader, s.range) * 10) / 10 : null)

export function stopAll() {
  for (const id of ["a", "b"] as DeckId[]) {
    send(id, { playing: false, hand: null })
    if (decks[id].s.playing) setDeck(id, { playing: false })
  }
}
