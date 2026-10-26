import { ArrowLeft, Clapperboard, Film, Play } from "lucide-react"
import { useEffect, useRef } from "react"
import { playUrl } from "@/api"
import { Grid, Page } from "@/components/media"
import { buttonVariants } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { stopForVideo } from "@/lib/player"
import { groupVideos, plural } from "@/lib/pure.js"
import { useLibrary } from "@/lib/store"
import type { Video } from "@/lib/types"
import { Gone } from "./Library"
import { Loading, NoBox } from "./Listen"

function Tile({ href, title, line, autofocus }: { href: string; title: string; line: string; autofocus?: boolean }) {
  return (
    <a href={href} data-autofocus={autofocus ? "" : undefined} className="group rounded-xl p-2 outline-none transition-colors hover:bg-card focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-ring">
      <div className="grid aspect-video place-items-center rounded-lg bg-gradient-to-br from-chrome to-void">
        <Play className="size-9 text-lilac transition-transform group-hover:scale-110 group-focus-visible:scale-110" />
      </div>
      <div className="mt-2 truncate font-medium">{title}</div>
      <div className="truncate text-sm text-muted-foreground">{line}</div>
    </a>
  )
}

export function Videos() {
  const { lib, error } = useLibrary()
  if (error && !lib) return <NoBox message={error} />
  if (!lib) return <Loading />
  const { shows, films, home } = groupVideos(lib.videos)
  let first = true
  const af = () => (first ? ((first = false), true) : false)
  return (
    <Page title="Videos">
      {!lib.videos.length && (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Clapperboard /></EmptyMedia>
            <EmptyTitle>No videos yet</EmptyTitle>
            <EmptyDescription>Add a folder with your own home videos, or films and shows you’ve copied yourself, in Settings. Beyond Music doesn’t copy DVDs or Blu-rays: the law doesn’t allow breaking their locks.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {shows.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 px-2 text-xl font-bold">Shows</h2>
          <Grid>{shows.map((s) => <Tile key={s.name} href={`#show/${encodeURIComponent(s.name)}`} title={s.name} line={plural(s.episodes.length, "episode")} autofocus={af()} />)}</Grid>
        </section>
      )}
      {films.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 px-2 text-xl font-bold">Films</h2>
          <Grid>{films.map((v) => <Tile key={v.id} href={`#watch/${v.id}`} title={v.title} line={v.year ? String(v.year) : "Film"} autofocus={af()} />)}</Grid>
        </section>
      )}
      {home.length > 0 && (
        <section>
          <h2 className="mb-2 px-2 text-xl font-bold">Home videos</h2>
          <Grid>{home.map((v) => <Tile key={v.id} href={`#watch/${v.id}`} title={v.folder || v.title} line={v.title} autofocus={af()} />)}</Grid>
        </section>
      )}
    </Page>
  )
}

export function Show({ name }: { name: string }) {
  const { lib } = useLibrary()
  if (!lib) return <Loading />
  const show = groupVideos(lib.videos).shows.find((s) => s.name === name)
  if (!show) return <Gone />
  const seasons = [...new Set(show.episodes.map((e) => e.season || 1))]
  return (
    <Page kicker="Show" title={show.name} actions={<a href={`#watch/${show.episodes[0].id}`} data-autofocus className={buttonVariants({ size: "lg" })}><Play className="fill-current" /> Play from the start</a>}>
      {seasons.map((n) => (
        <section key={n} className="mb-6">
          <h2 className="mb-2 px-2 text-xl font-bold">Season {n}</h2>
          <ol className="flex flex-col">
            {show.episodes.filter((e) => (e.season || 1) === n).map((e) => (
              <li key={e.id}>
                <a href={`#watch/${e.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 outline-none hover:bg-card focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-ring">
                  <span className="w-8 text-right text-sm tabular-nums text-muted-foreground">{e.episode ?? "·"}</span>
                  <span className="font-medium">{e.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </Page>
  )
}

// Watching: the whole screen, the TV's own player controls, and the next episode when one finishes.
export function Watch({ id }: { id: string }) {
  const { lib } = useLibrary()
  const ref = useRef<HTMLVideoElement>(null)
  const v = lib?.videos.find((x) => x.id === id)
  const after = v && lib ? nextOf(v, lib.videos) : undefined
  useEffect(() => {
    stopForVideo()
    ref.current?.focus()
  }, [id])
  if (!lib) return <Loading />
  if (!v) return <Gone />
  return (
    <div className="fixed inset-0 z-50 bg-black">
      <video
        ref={ref}
        key={v.id}
        src={playUrl(v.id, true)}
        controls
        autoPlay
        playsInline
        tabIndex={0}
        className="size-full outline-none"
        onEnded={() => after && location.replace(`#watch/${after.id}`)}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-black/70 to-transparent p-4">
        <button type="button" aria-label="Back" onClick={() => history.back()} className="pointer-events-auto grid size-11 place-items-center rounded-full bg-black/50 text-white outline-none focus-visible:ring-3 focus-visible:ring-ring">
          <ArrowLeft />
        </button>
        <div className="min-w-0 text-white">
          <div className="truncate font-semibold">{v.kind === "episode" ? `${v.show}: ${v.title}` : v.title}</div>
          <div className="truncate text-sm text-white/70">
            {v.kind === "episode" ? `Season ${v.season}, episode ${v.episode}` : v.kind === "home" ? v.folder : v.year || <Film className="inline size-4" />}
          </div>
        </div>
      </div>
    </div>
  )
}

function nextOf(v: Video, all: Video[]) {
  if (v.kind !== "episode") return undefined
  const show = groupVideos(all).shows.find((s) => s.name === v.show)
  if (!show) return undefined
  const i = show.episodes.findIndex((e) => e.id === v.id)
  return show.episodes[i + 1]
}
