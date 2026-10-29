// A DJ controller over MIDI: plug it into the computer, press Learn, pick what to set, then move the control. The
// mapping is kept on this computer. Chrome, Edge and Firefox can talk MIDI; Safari can't.

import { useSyncExternalStore } from "react"
import * as dj from "./dj"
import { controlKey, DJ_ACTIONS, jogStyle, jogSteps, readMidi, type Midi } from "./djpure.js"

type Binding = { action: string; jog?: "centred" | "twos" }
type State = {
  supported: boolean
  allowed: boolean | null
  devices: string[]
  learning: string | null // the action waiting for a control
  map: Record<string, Binding>
  last: string | null // the last control moved, for the Learn list
}

const KEY = "bm.dj.midi"
const saved = (): Record<string, Binding> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}")
  } catch {
    return {}
  }
}

let s: State = {
  supported: typeof navigator !== "undefined" && "requestMIDIAccess" in navigator,
  allowed: null,
  devices: [],
  learning: null,
  map: saved(),
  last: null,
}
const listeners = new Set<() => void>()
const set = (next: Partial<State>) => {
  s = { ...s, ...next }
  listeners.forEach((l) => l())
}
export const useMidi = () => useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => s)

let access: MIDIAccess | null = null

export async function connect() {
  if (!s.supported || access) return
  try {
    access = await navigator.requestMIDIAccess()
    const refresh = () => {
      const devices: string[] = []
      access!.inputs.forEach((input) => {
        devices.push(input.name || "A controller")
        input.onmidimessage = (e) => e.data && onMessage(e.data)
      })
      set({ devices, allowed: true })
    }
    access.onstatechange = refresh
    refresh()
  } catch {
    set({ allowed: false })
  }
}

export const learn = (action: string | null) => set({ learning: action })

export function forget(action: string) {
  const map = Object.fromEntries(Object.entries(s.map).filter(([, b]) => b.action !== action))
  store(map)
}

export const forgetAll = () => store({})

function store(map: Record<string, Binding>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch {
    /* kept until the page closes */
  }
  set({ map })
}

// Which control each action is set to, for the Learn list.
export const boundTo = (action: string) => Object.entries(s.map).find(([, b]) => b.action === action)?.[0] ?? null

// A control's name in words: "Knob 33 on channel 1".
export function nameOf(key: string) {
  const [type, channel, number] = key.split(":")
  const what = type === "note" ? "Button" : type === "bend" ? "Pitch fader" : "Knob or fader"
  return type === "bend" ? `${what}, channel ${channel}` : `${what} ${number}, channel ${channel}`
}

function onMessage(data: Uint8Array) {
  const m = readMidi(data)
  if (!m) return
  if (m.type === "note" && !m.down) return // only presses count, not letting go
  const key = controlKey(m)
  if (s.learning) {
    const action = DJ_ACTIONS.find((a) => a.id === s.learning)
    if (!action) return
    const map = Object.fromEntries(Object.entries(s.map).filter(([k, b]) => k !== key && b.action !== action.id))
    map[key] = { action: action.id, jog: action.kind === "jog" ? jogStyle(m.value) : undefined }
    store(map)
    set({ learning: null, last: key })
    return
  }
  const b = s.map[key]
  set({ last: key })
  if (b) run(b, m)
}

function run(b: Binding, m: Midi) {
  const v = m.type === "bend" ? m.value : m.value / 127
  if (b.action === "xfader") return dj.setXfader(v * 2 - 1)
  const [deck, what] = b.action.split(".") as [dj.DeckId, string]
  switch (what) {
    case "play":
      return dj.togglePlay(deck)
    case "cue":
      return dj.cue(deck)
    case "sync":
      return dj.sync(deck)
    case "loop":
      return dj.toggleLoop(deck)
    case "tempo":
      // Faders read slower at the top on most controllers: up is slower, like a club deck.
      return dj.setTempo(deck, 1 - v * 2)
    case "volume":
    case "high":
    case "mid":
    case "low":
      return dj.setLevel(deck, what, v)
    case "jog":
      // Each step of the wheel moves the song on or back a little: a scratch when stopped, a push when playing.
      return dj.nudge(deck, jogSteps(m.value, b.jog) * 0.008)
    default:
      if (what.startsWith("hot")) return dj.hotCue(deck, Number(what.slice(3)) - 1)
  }
}
