// The pieces every music screen is made of: covers, album tiles, rows of songs, and a row that scrolls sideways.

import { cn } from "cn"
import { Disc3, Music2, Play, Radio as RadioIcon } from "lucide-react"
import { useState, type ReactNode } from "react"
import { coverUrl } from "@/api"
import { clock } from "@/lib/pure.js"
import { current, fromTrack, playList, usePlayer } from "@/lib/player"
import type { Album, Library, Track } from "@/lib/types"
import { index } from "@/lib/store"

export function Cover({ album, src, className, round, radio }: { album?: Album; src?: string; className?: string; round?: boolean; radio?: boolean }) {
  const [broken, setBroken] = useState(false)
  const url = src || (album?.hasCover ? coverUrl(album.id) : "")
  return (
    <div className={cn("relative aspect-square shrink-0 overflow-hidden bg-gradient-to-br from-chrome to-void", round ? "rounded-full" : "rounded-lg", className)}>
      {url && !broken ? (
        <img src={url} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} className="size-full object-cover" />
      ) : (
        <div className="grid size-full place-items-center text-lilac/70">
          {radio ? <RadioIcon className="size-1/3" /> : album ? <Disc3 className="size-1/3" /> : <Music2 className="size-1/3" />}
        </div>
      )}
    </div>
  )
}

export function AlbumCard({ album, lib }: { album: Album; lib: Library }) {
  return (
    <div className="group relative">
      <a href={`#album/${album.id}`} className="block rounded-xl p-2 transition-colors outline-none hover:bg-card focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-ring">
        <Cover album={album} className="w-full shadow-lg shadow-black/30" />
        <div className="mt-2 truncate font-medium">{album.title}</div>
        <div className="truncate text-sm text-muted-foreground">
          {album.artist}
          {album.year ? ` · ${album.year}` : ""}
        </div>
      </a>
      <button
        type="button"
        tabIndex={-1}
        aria-label={`Play ${album.title}`}
        onClick={() => playAlbum(album, lib)}
        className="absolute right-4 bottom-16 grid size-11 translate-y-1 place-items-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-lg transition-[opacity,transform] group-hover:translate-y-0 group-hover:opacity-100"
      >
        <Play className="size-5 fill-current" />
      </button>
    </div>
  )
}

export function playAlbum(album: Album, lib: Library, start = 0, shuffle?: boolean) {
  const { track } = index(lib)
  const items = album.trackIds.map((id) => track.get(id)).filter((t): t is Track => !!t).map((t) => fromTrack(t, album))
  playList(items, start, shuffle)
}

export function playTracks(tracks: Track[], lib: Library, start = 0, shuffle?: boolean) {
  const { album } = index(lib)
  playList(tracks.map((t) => fromTrack(t, album.get(t.albumId))), start, shuffle)
}

export function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">{children}</div>
}

// A row that scrolls sideways, like the shelves on a TV.
export function Shelf({ title, href, children }: { title: string; href?: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-2 flex items-baseline justify-between px-2">
        <h2 className="text-xl font-bold">{title}</h2>
        {href && (
          <a href={href} className="rounded text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
            See all
          </a>
        )}
      </div>
      <div className="-mx-2 flex snap-x gap-1 overflow-x-auto px-2 pb-2 [scrollbar-width:none] [&>*]:w-40 [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-44 [[data-tv]_&>*]:w-52">{children}</div>
    </section>
  )
}

// Songs, one to a row. Tap one to play the list from there.
export function TrackList({ tracks, lib, numbers, showAlbum, onPlay, actions }: { tracks: Track[]; lib: Library; numbers?: boolean; showAlbum?: boolean; onPlay?: (i: number) => void; actions?: (t: Track, i: number) => ReactNode }) {
  usePlayer()
  const now = current()
  const { album } = index(lib)
  return (
    <ol className="flex flex-col">
      {tracks.map((t, i) => {
        const on = now?.kind === "track" && now.id === t.id
        return (
          <li key={t.id + i} className="group flex items-center gap-1 rounded-lg hover:bg-card focus-within:bg-card">
            <button
              type="button"
              onClick={() => (onPlay ? onPlay(i) : playTracks(tracks, lib, i))}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring"
            >
              {numbers ? (
                <span className={cn("w-6 shrink-0 text-right text-sm tabular-nums text-muted-foreground", on && "text-primary")}>{on ? "♪" : t.track || i + 1}</span>
              ) : (
                <Cover album={album.get(t.albumId)} className="size-11 rounded-md" />
              )}
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate font-medium", on && "text-primary")}>{t.title}</span>
                <span className="block truncate text-sm text-muted-foreground">
                  {t.artist}
                  {showAlbum ? ` · ${t.album}` : ""}
                </span>
              </span>
              {t.duration ? <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{clock(t.duration)}</span> : null}
            </button>
            {actions?.(t, i)}
          </li>
        )
      })}
    </ol>
  )
}

export function Page({ title, kicker, children, actions }: { title?: ReactNode; kicker?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-7xl px-3 pt-4 pb-8 sm:px-6 sm:pt-8">
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3 px-2">
          <div className="min-w-0">
            {kicker && <div className="text-sm font-medium text-muted-foreground">{kicker}</div>}
            {title && <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </div>
  )
}
