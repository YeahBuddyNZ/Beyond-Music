// The frame round every screen: the list of places on the left of a computer or TV, tabs along the bottom of a
// phone, and the player along the bottom of both.

import { cn } from "cn"
import { Clapperboard, Disc3, Home, Library as LibraryIcon, Loader2, Pause, Play, Radio, Repeat, Repeat1, Search, Settings, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react"
import type { ReactNode } from "react"
import { Wordmark } from "@/components/brand"
import { Cover } from "@/components/media"
import { Slider } from "@/components/ui/slider"
import { artOf, current, cycleRepeat, next, previous, seek, setShuffle, setVolume, toggle, usePlayer } from "@/lib/player"
import { clock } from "@/lib/pure.js"

const PLACES = [
  { href: "#listen", label: "Listen", icon: Home, match: ["listen", ""] },
  { href: "#search", label: "Search", icon: Search, match: ["search"] },
  { href: "#library/albums", label: "Your music", short: "Music", icon: LibraryIcon, match: ["library", "album", "artist", "playlist"] },
  { href: "#videos", label: "Videos", icon: Clapperboard, match: ["videos", "show", "watch"] },
  { href: "#radio", label: "Radio", icon: Radio, match: ["radio"] },
]
// DJ mode needs a computer's screen, so it sits in the side list and not in a phone's tabs.
const WIDE = [{ href: "#dj", label: "DJ mode", icon: Disc3, match: ["dj"] }]

export function Shell({ screen, children, bare }: { screen: string; children: ReactNode; bare?: boolean }) {
  const on = (m: string[]) => m.includes(screen)
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-r bg-black/20 p-3 md:flex [[data-tv]_&]:w-72">
        <a href="#listen" className="mb-4 rounded-lg px-3 py-3 outline-none focus-visible:ring-3 focus-visible:ring-ring">
          <Wordmark />
        </a>
        <nav className="flex flex-col gap-1">
          {[...PLACES, ...WIDE].map((p) => (
            <a
              key={p.href}
              href={p.href}
              aria-current={on(p.match) ? "page" : undefined}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium text-muted-foreground transition-colors outline-none hover:bg-card hover:text-foreground focus-visible:bg-card focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-ring aria-[current=page]:bg-card aria-[current=page]:text-foreground [[data-tv]_&]:py-3.5 [[data-tv]_&]:text-lg"
            >
              <p.icon className="size-5" />
              {p.label}
            </a>
          ))}
        </nav>
        <a
          href="#settings"
          aria-current={screen === "settings" ? "page" : undefined}
          className="mt-auto flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium text-muted-foreground transition-colors outline-none hover:bg-card hover:text-foreground focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-ring aria-[current=page]:bg-card aria-[current=page]:text-foreground"
        >
          <Settings className="size-5" />
          Settings
        </a>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <main className={cn("flex-1", !bare && "pb-40 md:pb-28")}>{children}</main>
      </div>
      {!bare && <PlayerBar />}
      {!bare && (
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-void/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          {PLACES.map((p) => (
            <a key={p.href} href={p.href} aria-current={on(p.match) ? "page" : undefined} className="flex flex-col items-center gap-1 py-2 text-xs font-medium text-muted-foreground aria-[current=page]:text-foreground">
              <p.icon className="size-5" />
              {p.short || p.label}
            </a>
          ))}
        </nav>
      )}
    </div>
  )
}

function PlayerBar() {
  const s = usePlayer()
  const p = current()
  if (!p) return null
  const live = p.kind === "radio"
  return (
    <div className="fixed inset-x-0 bottom-[calc(57px+env(safe-area-inset-bottom))] z-30 px-2 md:bottom-0 md:left-60 md:px-0 [[data-tv]_&]:md:left-72">
      <div className="relative flex items-center gap-3 overflow-hidden rounded-xl bg-chrome/95 p-2 shadow-2xl backdrop-blur md:rounded-none md:border-t md:bg-void/95 md:px-4 md:py-3">
        <a href="#now" className="flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring md:max-w-xs">
          <Cover src={artOf(p)} radio={live} className="size-11 rounded-md md:size-14" />
          <span className="min-w-0">
            <span className="block truncate font-medium">{p.title}</span>
            <span className="block truncate text-sm text-muted-foreground">{s.error ? <span className="text-destructive-foreground">{s.error}</span> : p.artist}</span>
          </span>
        </a>
        <div className="flex flex-col items-center gap-1 md:flex-1">
          <div className="flex items-center gap-1 md:gap-2">
            <button type="button" aria-label={s.shuffle ? "Shuffle is on" : "Shuffle"} aria-pressed={s.shuffle} onClick={() => setShuffle(!s.shuffle)} className={cn(icon, "hidden md:grid", s.shuffle && "text-primary")} disabled={live}>
              <Shuffle className="size-4" />
            </button>
            <button type="button" aria-label="Previous" onClick={previous} className={cn(icon, "hidden md:grid")} disabled={live}>
              <SkipBack className="size-5 fill-current" />
            </button>
            <button type="button" aria-label={s.playing ? "Pause" : "Play"} onClick={toggle} className="grid size-11 place-items-center rounded-full bg-foreground text-background outline-none focus-visible:ring-3 focus-visible:ring-ring">
              {s.loading && s.playing ? <Loader2 className="size-5 animate-spin" /> : s.playing ? <Pause className="size-5 fill-current" /> : <Play className="size-5 translate-x-px fill-current" />}
            </button>
            <button type="button" aria-label="Next" onClick={() => next()} className={icon} disabled={live}>
              <SkipForward className="size-5 fill-current" />
            </button>
            <button type="button" aria-label={s.repeat === "off" ? "Repeat" : s.repeat === "all" ? "Repeating all" : "Repeating this song"} aria-pressed={s.repeat !== "off"} onClick={cycleRepeat} className={cn(icon, "hidden md:grid", s.repeat !== "off" && "text-primary")} disabled={live}>
              {s.repeat === "one" ? <Repeat1 className="size-4" /> : <Repeat className="size-4" />}
            </button>
          </div>
          <div className="hidden w-full max-w-xl items-center gap-2 text-xs tabular-nums text-muted-foreground md:flex">
            {live ? (
              <span className="mx-auto font-medium text-primary">Live</span>
            ) : (
              <>
                <span className="w-10 text-right">{clock(s.time)}</span>
                <Slider aria-label="Where in the song" value={[s.time]} max={s.duration || 1} step={1} onValueChange={(v) => seek((Array.isArray(v) ? v[0] : v) as number)} />
                <span className="w-10">{clock(s.duration)}</span>
              </>
            )}
          </div>
        </div>
        <div className="hidden w-40 items-center gap-2 lg:flex">
          <button type="button" aria-label={s.volume ? "Mute" : "Unmute"} onClick={() => setVolume(s.volume ? 0 : 1)} className={icon}>
            {s.volume ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </button>
          <Slider aria-label="Volume" value={[s.volume]} max={1} step={0.05} onValueChange={(v) => setVolume((Array.isArray(v) ? v[0] : v) as number)} />
        </div>
        {!live && <div className="absolute inset-x-2 bottom-0 h-0.5 bg-white/10 md:hidden"><div className="h-full bg-foreground" style={{ width: `${s.duration ? (s.time / s.duration) * 100 : 0}%` }} /></div>}
      </div>
    </div>
  )
}

const icon = "grid size-9 place-items-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-ring disabled:opacity-30"
