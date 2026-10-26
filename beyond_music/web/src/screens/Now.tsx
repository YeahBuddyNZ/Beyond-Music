import { ChevronDown, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from "lucide-react"
import { cn } from "cn"
import { Cover } from "@/components/media"
import { Slider } from "@/components/ui/slider"
import { artOf, current, cycleRepeat, jump, next, previous, seek, setShuffle, toggle, usePlayer } from "@/lib/player"
import { clock } from "@/lib/pure.js"

// Now playing: big enough to read from the couch, with what's coming up next.
export function Now() {
  const s = usePlayer()
  const p = current()
  if (!p)
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <p className="text-lg text-muted-foreground">Nothing’s playing.</p>
          <a href="#listen" data-autofocus className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground">Find something</a>
        </div>
      </div>
    )
  const live = p.kind === "radio"
  const coming = s.order.slice(s.pos + 1, s.pos + 21).map((qi, k) => ({ item: s.queue[qi], pos: s.pos + 1 + k }))
  const art = artOf(p)
  return (
    <div className="relative min-h-dvh overflow-hidden">
      {art && <img src={art} alt="" aria-hidden className="absolute inset-0 size-full scale-125 object-cover opacity-30 blur-3xl" />}
      <div className="relative mx-auto grid min-h-dvh max-w-6xl gap-8 p-4 pb-10 sm:p-8 lg:grid-cols-[1fr_22rem] lg:items-center">
        <div className="flex flex-col items-center">
          <button type="button" onClick={() => history.back()} aria-label="Close" className="mb-4 self-start rounded-full p-2 outline-none hover:bg-white/10 focus-visible:ring-3 focus-visible:ring-ring">
            <ChevronDown className="size-6" />
          </button>
          <Cover src={art} radio={live} className="w-full max-w-sm rounded-2xl shadow-2xl shadow-black/60 lg:max-w-md" />
          <div className="mt-6 w-full max-w-md">
            <h1 className="truncate text-2xl font-bold sm:text-3xl">{p.title}</h1>
            <p className="truncate text-lg text-muted-foreground">{p.artist}</p>
            {s.error && <p className="mt-2 text-sm text-destructive-foreground">{s.error}</p>}
            {live ? (
              <p className="mt-6 font-semibold text-primary">Live radio</p>
            ) : (
              <div className="mt-6">
                <Slider aria-label="Where in the song" value={[s.time]} max={s.duration || 1} step={1} onValueChange={(v) => seek((Array.isArray(v) ? v[0] : v) as number)} />
                <div className="mt-2 flex justify-between text-xs tabular-nums text-muted-foreground">
                  <span>{clock(s.time)}</span>
                  <span>{clock(s.duration)}</span>
                </div>
              </div>
            )}
            <div className="mt-4 flex items-center justify-between">
              <button type="button" aria-label="Shuffle" aria-pressed={s.shuffle} disabled={live} onClick={() => setShuffle(!s.shuffle)} className={cn(big, s.shuffle && "text-primary")}><Shuffle className="size-5" /></button>
              <button type="button" aria-label="Previous" disabled={live} onClick={previous} className={big}><SkipBack className="size-7 fill-current" /></button>
              <button type="button" data-autofocus aria-label={s.playing ? "Pause" : "Play"} onClick={toggle} className="grid size-16 place-items-center rounded-full bg-foreground text-background outline-none focus-visible:ring-4 focus-visible:ring-ring">
                {s.playing ? <Pause className="size-7 fill-current" /> : <Play className="size-7 translate-x-0.5 fill-current" />}
              </button>
              <button type="button" aria-label="Next" disabled={live} onClick={() => next()} className={big}><SkipForward className="size-7 fill-current" /></button>
              <button type="button" aria-label="Repeat" aria-pressed={s.repeat !== "off"} disabled={live} onClick={cycleRepeat} className={cn(big, s.repeat !== "off" && "text-primary")}>
                {s.repeat === "one" ? <Repeat1 className="size-5" /> : <Repeat className="size-5" />}
              </button>
            </div>
          </div>
        </div>
        {!live && (
          <aside className="rounded-2xl bg-black/30 p-3 backdrop-blur">
            <h2 className="mb-2 px-2 font-bold">Up next</h2>
            {coming.length ? (
              <ol className="flex max-h-[60dvh] flex-col overflow-y-auto">
                {coming.map(({ item, pos }) => (
                  <li key={pos}>
                    <button type="button" onClick={() => jump(pos)} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left outline-none hover:bg-white/10 focus-visible:bg-white/10 focus-visible:ring-2 focus-visible:ring-ring">
                      <Cover src={artOf(item)} className="size-10 rounded" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{item.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{item.artist}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="px-2 text-sm text-muted-foreground">That’s the last one{s.repeat === "all" ? ", then it starts again" : ""}.</p>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}

const big = "grid size-12 place-items-center rounded-full outline-none hover:bg-white/10 focus-visible:ring-3 focus-visible:ring-ring disabled:opacity-30"
