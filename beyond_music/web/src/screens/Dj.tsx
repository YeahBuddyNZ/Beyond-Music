// DJ mode: two decks with platters, a mixer between them, and a controller over MIDI if there's one plugged in. Made
// for a computer; on a phone the decks sit one above the other. The sound is in lib/dj.ts.

import { cn } from "cn"
import { Cable, Disc3, ListMusic, Pause, Play, Repeat, Search as SearchIcon } from "lucide-react"
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { coverUrl } from "@/api"
import { Badge } from "@/components/reui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Slider } from "@/components/ui/slider"
import * as dj from "@/lib/dj"
import { beatAt, DJ_ACTIONS, platterAngle, scratchRate, turnBetween } from "@/lib/djpure.js"
import * as midi from "@/lib/midi"
import { pause as pausePlayer } from "@/lib/player"
import { clock, findIn } from "@/lib/pure.js"
import { useLibrary } from "@/lib/store"
import type { Track } from "@/lib/types"
import { Loading, NoBox } from "./Listen"

const COLOUR = { a: "#9E7BFF", b: "#378ADD" } as const
const first = (v: number | readonly number[]) => (Array.isArray(v) ? v[0] : v) as number

// One loop for every canvas and platter on the screen, so nothing redraws through React sixty times a second.
const frames = new Set<(t: number) => void>()
let running = false
function tick(t: number) {
  frames.forEach((f) => f(t))
  if (frames.size) requestAnimationFrame(tick)
  else running = false
}
function useFrame(f: (t: number) => void) {
  const ref = useRef(f)
  ref.current = f
  useEffect(() => {
    const call = (t: number) => ref.current(t)
    frames.add(call)
    if (!running) {
      running = true
      requestAnimationFrame(tick)
    }
    return () => void frames.delete(call)
  }, [])
}

export function Dj() {
  const { lib, error } = useLibrary()
  const { mixer } = dj.useDj()
  useEffect(() => {
    pausePlayer()
    return () => dj.stopAll()
  }, [])
  if (error && !lib) return <NoBox message={error} />
  if (!lib) return <Loading />
  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-4 p-3 md:p-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold md:text-3xl">DJ mode</h1>
        <Badge variant="primary-light">Two decks</Badge>
        <a href="#listen" className="ml-auto text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Back to Listen</a>
      </header>
      {!lib.tracks.length ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Disc3 /></EmptyMedia>
            <EmptyTitle>No songs to mix yet</EmptyTitle>
            <EmptyDescription>Add a music folder in Settings, or copy a CD, and they’ll be ready to load on a deck.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : !mixer.ready ? (
        <Card className="items-center py-10 text-center">
          <CardHeader className="w-full max-w-md justify-items-center">
            <Disc3 className="mb-2 size-12 text-lilac" />
            <CardTitle className="text-xl">Ready to mix?</CardTitle>
            <CardDescription>Load a song on each deck, line up the beats and bring one in with the crossfader. Headphones or speakers on first.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="lg" onClick={() => void dj.start()}>Open the decks</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <Deck id="a" tracks={lib.tracks} />
            <Mixer />
            <Deck id="b" tracks={lib.tracks} />
          </div>
          <Controller />
        </>
      )}
    </div>
  )
}

function Deck({ id, tracks }: { id: dj.DeckId; tracks: Track[] }) {
  const all = dj.useDj()
  const s = all[id]
  const [picking, setPicking] = useState(false)
  const bpm = dj.liveBpm(s)
  const other = all[id === "a" ? "b" : "a"]
  const label = id.toUpperCase()
  return (
    <Card className="min-w-0">
      <CardHeader className="grid-cols-[auto_1fr_auto] items-center gap-3">
        <span className="grid size-9 place-items-center rounded-full font-display font-bold text-void" style={{ background: COLOUR[id] }}>{label}</span>
        <div className="min-w-0">
          <CardTitle className="truncate text-base">{s.track ? s.track.title : s.loading ? "Loading…" : "Nothing loaded"}</CardTitle>
          <CardDescription className="truncate">{s.error ? <span className="text-destructive">{s.error}</span> : s.track ? s.track.artist : "Pick a song to start"}</CardDescription>
        </div>
        <Button variant="outline" onClick={() => setPicking(true)}><ListMusic />Load</Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Waveform id={id} s={s} />
        <div className="flex items-center gap-4">
          <Platter id={id} s={s} />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex items-baseline gap-3 tabular-nums">
              <span className="font-display text-3xl font-bold">{bpm ? bpm.toFixed(1) : "--.-"}</span>
              <span className="text-sm text-muted-foreground">BPM</span>
            </div>
            <Clock id={id} s={s} />
            <div className="flex flex-wrap gap-2">
              <Button size="lg" variant="secondary" onClick={() => dj.cue(id)} disabled={!s.track} className="w-16">Cue</Button>
              <Button size="lg" onClick={() => dj.togglePlay(id)} disabled={!s.track || s.loading} aria-label={s.playing ? "Pause" : "Play"} className="w-16">
                {s.playing ? <Pause className="fill-current" /> : <Play className="fill-current" />}
              </Button>
              <Button size="lg" variant="outline" onClick={() => dj.sync(id)} disabled={!s.bpm || !other.bpm} title="Match the other deck’s tempo and beats">Sync</Button>
              <Button size="lg" variant={s.loop ? "default" : "outline"} onClick={() => dj.toggleLoop(id)} disabled={!s.bpm} aria-pressed={!!s.loop} title="Loop 4 beats">
                <Repeat />4
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {s.hot.map((h, n) => (
                <Button
                  key={n}
                  variant={h == null ? "outline" : "secondary"}
                  disabled={!s.track}
                  onClick={(e) => dj.hotCue(id, n, e.shiftKey)}
                  onContextMenu={(e) => (e.preventDefault(), dj.hotCue(id, n, true))}
                  title={h == null ? "Mark this spot" : "Jump here (right click to clear)"}
                  style={h == null ? undefined : { borderColor: COLOUR[id], color: COLOUR[id] }}
                >
                  {n + 1}
                </Button>
              ))}
            </div>
          </div>
          <Tempo id={id} s={s} />
        </div>
      </CardContent>
      <Picker open={picking} onClose={() => setPicking(false)} tracks={tracks} deck={label} onPick={(t) => (setPicking(false), void dj.load(id, t))} />
    </Card>
  )
}

function Clock({ id, s }: { id: dj.DeckId; s: dj.DeckState }) {
  const ref = useRef<HTMLSpanElement>(null)
  useFrame(() => {
    if (!ref.current) return
    const pos = dj.position(id)
    const left = Math.max(0, s.duration - pos)
    const beat = s.bpm ? beatAt(pos, s.first, s.bpm) : null
    ref.current.textContent = `-${clock(left)}${beat != null && beat >= 0 ? `  ·  bar ${Math.floor(beat / 4) + 1}.${(beat % 4) + 1}` : ""}`
  })
  return <span ref={ref} className="-mt-2 truncate text-sm tabular-nums text-muted-foreground" />
}

// The record: turns with the song, and a hand on it scratches. Let go and it comes back up to speed.
function Platter({ id, s }: { id: dj.DeckId; s: dj.DeckState }) {
  const disc = useRef<HTMLDivElement>(null)
  const grab = useRef<{ angle: number; t: number; moved: number } | null>(null)
  useFrame((t) => {
    if (disc.current) disc.current.style.transform = `rotate(${platterAngle(dj.position(id)) % 360}deg)`
    // A hand held still stops the record.
    const g = grab.current
    if (g && t - g.moved > 40) dj.hand(id, 0)
  })
  const angleOf = (e: ReactPointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2))
  }
  return (
    <div
      role="slider"
      aria-label={`Deck ${id.toUpperCase()} platter: drag round to scratch`}
      aria-valuenow={0}
      tabIndex={-1}
      className={cn("relative aspect-square w-28 shrink-0 cursor-grab touch-none rounded-full bg-gradient-to-br from-zinc-800 to-black p-1.5 shadow-xl shadow-black/50 ring-1 ring-white/10 select-none active:cursor-grabbing sm:w-36", !s.track && "opacity-60")}
      onPointerDown={(e) => {
        if (!s.track) return
        e.currentTarget.setPointerCapture(e.pointerId)
        grab.current = { angle: angleOf(e), t: e.timeStamp, moved: performance.now() }
        dj.hand(id, 0)
      }}
      onPointerMove={(e) => {
        const g = grab.current
        if (!g) return
        const a = angleOf(e)
        const rate = scratchRate(turnBetween(g.angle, a), (e.timeStamp - g.t) / 1000)
        if (e.timeStamp - g.t > 4) {
          dj.hand(id, Math.max(-4, Math.min(4, rate)))
          grab.current = { angle: a, t: e.timeStamp, moved: performance.now() }
        }
      }}
      onPointerUp={() => ((grab.current = null), dj.hand(id, null))}
      onPointerCancel={() => ((grab.current = null), dj.hand(id, null))}
    >
      <div ref={disc} className="relative size-full rounded-full bg-[repeating-radial-gradient(circle,#111_0_2px,#1b1b1b_2px_4px)]">
        <div className="absolute inset-[28%] overflow-hidden rounded-full ring-2 ring-black">
          {s.track && <img src={coverUrl(s.track.albumId)} alt="" className="size-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />}
        </div>
        <div className="absolute top-1 left-1/2 h-[22%] w-1 -translate-x-1/2 rounded-full" style={{ background: COLOUR[id] }} />
      </div>
    </div>
  )
}

function Tempo({ id, s }: { id: dj.DeckId; s: dj.DeckState }) {
  const pct = s.fader * s.range * 100
  return (
    <div className="flex flex-col items-center gap-3">
      <button type="button" onClick={() => dj.setRange(id, s.range === 0.08 ? 0.16 : s.range === 0.16 ? 0.5 : 0.08)} className="rounded-md px-1.5 text-xs font-medium text-muted-foreground ring-1 ring-border hover:text-foreground" title="How far the tempo fader goes">
        ±{Math.round(s.range * 100)}%
      </button>
      <div className="h-36">
        {/* Up is slower, like a club deck. */}
        <Slider orientation="vertical" aria-label={`Deck ${id.toUpperCase()} tempo`} min={-1} max={1} step={0.001} value={[-s.fader]} onValueChange={(v) => dj.setTempo(id, -first(v))} />
      </div>
      <button type="button" onClick={() => dj.setTempo(id, 0)} className="text-xs tabular-nums text-muted-foreground hover:text-foreground" title="Back to normal speed">
        {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
      </button>
    </div>
  )
}

// The song close up, scrolling past the line in the middle, with the beats marked; and the whole song underneath,
// where a tap goes to that spot.
function Waveform({ id, s }: { id: dj.DeckId; s: dj.DeckState }) {
  const near = useRef<HTMLCanvasElement>(null)
  const whole = useRef<HTMLCanvasElement>(null)
  useFrame(() => {
    const pos = dj.position(id)
    for (const c of [near.current, whole.current]) {
      if (!c) continue
      const w = c.clientWidth * devicePixelRatio
      const h = c.clientHeight * devicePixelRatio
      if (c.width !== w || c.height !== h) {
        c.width = w
        c.height = h
      }
    }
    const colour = COLOUR[id]
    const n = near.current?.getContext("2d")
    if (n && near.current) {
      const { width: w, height: h } = near.current
      n.clearRect(0, 0, w, h)
      if (s.detail) {
        const span = 6 // seconds across
        const pxPerSlice = w / (span * 100)
        const start = pos * 100 - (span * 100) / 2
        n.fillStyle = colour
        for (let x = 0; x < w; x += Math.max(1, pxPerSlice)) {
          const v = s.detail[Math.floor(start + x / pxPerSlice)] || 0
          const bar = v * h * 0.9
          n.globalAlpha = x < w / 2 ? 0.45 : 0.95
          n.fillRect(x, (h - bar) / 2, Math.max(1, pxPerSlice - 0.5), bar)
        }
        n.globalAlpha = 1
        if (s.bpm) {
          const period = 60 / s.bpm
          const firstBeat = Math.ceil((pos - span / 2 - s.first) / period)
          for (let b = firstBeat; ; b++) {
            const at = s.first + b * period
            const x = ((at - pos) / span + 0.5) * w
            if (x > w) break
            n.fillStyle = b % 4 === 0 ? "rgba(255,255,255,.7)" : "rgba(255,255,255,.22)"
            n.fillRect(x, 0, b % 4 === 0 ? 2 : 1, h)
          }
        }
        if (s.loop) {
          const x0 = ((s.loop[0] - pos) / span + 0.5) * w
          const x1 = ((s.loop[1] - pos) / span + 0.5) * w
          n.fillStyle = "rgba(255,255,255,.12)"
          n.fillRect(x0, 0, x1 - x0, h)
        }
      }
      n.fillStyle = "#fff"
      n.fillRect(w / 2 - 1, 0, 2, h)
    }
    const o = whole.current?.getContext("2d")
    if (o && whole.current) {
      const { width: w, height: h } = whole.current
      o.clearRect(0, 0, w, h)
      if (s.overview && s.duration) {
        const played = (pos / s.duration) * w
        const step = w / s.overview.length
        for (let i = 0; i < s.overview.length; i++) {
          const x = i * step
          const bar = s.overview[i] * h
          o.fillStyle = x < played ? "rgba(255,255,255,.35)" : colour
          o.fillRect(x, h - bar, Math.max(1, step - 0.5), bar)
        }
        const mark = (t: number, c: string) => {
          o.fillStyle = c
          o.fillRect((t / s.duration) * w - 1, 0, 2, h)
        }
        mark(s.cue, "#E8A33D")
        s.hot.forEach((t) => t != null && mark(t, "rgba(255,255,255,.8)"))
        mark(pos, "#fff")
      }
    }
  })
  return (
    <div className="flex flex-col gap-1.5">
      <canvas ref={near} className="h-20 w-full rounded-md bg-black/40" aria-hidden />
      <canvas
        ref={whole}
        className="h-8 w-full cursor-pointer rounded-sm bg-black/20"
        aria-label={`Deck ${id.toUpperCase()}: tap to go to that part of the song`}
        onPointerDown={(e) => {
          if (!s.duration) return
          const r = e.currentTarget.getBoundingClientRect()
          dj.seek(id, ((e.clientX - r.left) / r.width) * s.duration)
        }}
      />
    </div>
  )
}

function Mixer() {
  const { a, b, mixer } = dj.useDj()
  return (
    <Card className="lg:w-72">
      <CardHeader>
        <CardTitle className="text-base">Mixer</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          {(["a", "b"] as const).map((id) => {
            const s = id === "a" ? a : b
            return (
              <div key={id} className="flex flex-col items-center gap-3">
                <span className="text-xs font-semibold" style={{ color: COLOUR[id] }}>Deck {id.toUpperCase()}</span>
                {(["high", "mid", "low"] as const).map((part) => (
                  <label key={part} className="flex w-full flex-col gap-1 text-xs text-muted-foreground">
                    <span className="flex justify-between"><span className="capitalize">{part}</span><button type="button" className="hover:text-foreground" onClick={() => dj.setLevel(id, part, s[part] <= 0.02 ? 0.5 : 0)} title="Cut it out, or back to flat">{s[part] <= 0.02 ? "Off" : "Cut"}</button></span>
                    <Slider aria-label={`Deck ${id.toUpperCase()} ${part}`} min={0} max={1} step={0.01} value={[s[part]]} onValueChange={(v) => dj.setLevel(id, part, first(v))} />
                  </label>
                ))}
                <div className="h-40">
                  <Slider orientation="vertical" aria-label={`Deck ${id.toUpperCase()} volume`} min={0} max={1} step={0.01} value={[s.volume]} onValueChange={(v) => dj.setLevel(id, "volume", first(v))} />
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-xs font-semibold">
            <span style={{ color: COLOUR.a }}>A</span>
            <span className="text-muted-foreground">Crossfader</span>
            <span style={{ color: COLOUR.b }}>B</span>
          </div>
          <Slider aria-label="Crossfader" min={-1} max={1} step={0.01} value={[mixer.xfader]} onValueChange={(v) => dj.setXfader(first(v))} />
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1">
              {(["smooth", "sharp"] as const).map((c) => (
                <Button key={c} size="xs" variant={mixer.curve === c ? "secondary" : "ghost"} onClick={() => dj.setCurve(c)} className="capitalize">{c}</Button>
              ))}
            </div>
            <Button size="xs" variant="ghost" onClick={() => dj.setXfader(0)}>Middle</Button>
          </div>
        </div>
        <label className="flex flex-col gap-2 text-xs text-muted-foreground">
          Main volume
          <Slider aria-label="Main volume" min={0} max={1} step={0.01} value={[mixer.master]} onValueChange={(v) => dj.setMaster(first(v))} />
        </label>
      </CardContent>
    </Card>
  )
}

function Picker({ open, onClose, tracks, deck, onPick }: { open: boolean; onClose: () => void; tracks: Track[]; deck: string; onPick: (t: Track) => void }) {
  const [q, setQ] = useState("")
  const list = (q ? tracks.filter((t) => findIn(q, [t.title, t.artist, t.album, t.genre])) : tracks).slice(0, 200)
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Load on deck {deck}</DialogTitle>
          <DialogDescription>Pick a song from the box.</DialogDescription>
        </DialogHeader>
        <label className="relative block">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Song, artist or album" className="h-10 pl-9" aria-label="Find a song" />
        </label>
        <ScrollArea className="h-80">
          <div className="flex flex-col gap-0.5 pr-3">
            {list.map((t) => (
              <button key={t.id} type="button" onClick={() => onPick(t)} className="flex items-center gap-3 rounded-lg px-2 py-2 text-left outline-none transition-colors hover:bg-muted focus-visible:bg-muted">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{t.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{t.artist}{t.album ? ` · ${t.album}` : ""}</span>
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">{clock(t.duration || 0)}</span>
              </button>
            ))}
            {!list.length && <p className="p-4 text-sm text-muted-foreground">Nothing called “{q}” on the box.</p>}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

// A DJ controller over MIDI, learnt one control at a time.
function Controller() {
  const m = midi.useMidi()
  const [open, setOpen] = useState(false)
  const learning = DJ_ACTIONS.find((a) => a.id === m.learning)
  return (
    <Card>
      <CardHeader className="grid-cols-[auto_1fr_auto] items-center gap-3">
        <Cable className="size-5 text-lilac" />
        <div>
          <CardTitle className="text-base">Your DJ controller</CardTitle>
          <CardDescription>
            {!m.supported
              ? "This browser can’t talk to a controller. Open DJ mode in Chrome or Edge to use one."
              : m.allowed === false
                ? "The browser said no to the controller. Allow MIDI for this page in the browser’s settings, then try again."
                : m.devices.length
                  ? `Connected: ${m.devices.join(", ")}`
                  : m.allowed
                    ? "Plug a controller in with its USB cable. It shows here as soon as it’s on."
                    : "Plug in a controller with a USB cable to use its jog wheels, faders and buttons."}
          </CardDescription>
        </div>
        {m.supported && (m.allowed ? <Button variant="outline" onClick={() => setOpen(!open)}>{open ? "Done" : "Set up controls"}</Button> : <Button onClick={() => void midi.connect()}>Connect</Button>)}
      </CardHeader>
      {open && m.allowed && (
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {learning ? <>Now move or press the control for <b className="text-foreground">{learning.label}</b>.</> : "Press Learn beside something, then move that control on your controller."}
          </p>
          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {DJ_ACTIONS.map((a) => {
              const key = midi.boundTo(a.id)
              return (
                <div key={a.id} className="flex items-center gap-2 border-b border-border/50 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">{a.label}</span>
                  {key && <span className="truncate text-xs text-muted-foreground">{midi.nameOf(key)}</span>}
                  <Button size="xs" variant={m.learning === a.id ? "default" : "outline"} onClick={() => midi.learn(m.learning === a.id ? null : a.id)}>
                    {m.learning === a.id ? "Waiting…" : key ? "Change" : "Learn"}
                  </Button>
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{m.last ? `Last moved: ${midi.nameOf(m.last)}` : ""}</span>
            {Object.keys(m.map).length > 0 && <Button size="xs" variant="ghost" onClick={midi.forgetAll}>Clear every control</Button>}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
