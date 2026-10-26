import { FolderPlus, Loader2, Play, Shuffle } from "lucide-react"
import { useEffect } from "react"
import { AlbumCard, Cover, Page, Shelf, playTracks } from "@/components/media"
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert"
import { buttonVariants } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { fromStation, playList } from "@/lib/player"
import { plural } from "@/lib/pure.js"
import { index, loadRadio, useLibrary } from "@/lib/store"
import type { Album, Library } from "@/lib/types"

const greeting = () => {
  const h = new Date().getHours()
  return h >= 5 && h < 12 ? "Mōrena" : "Kia ora"
}

export function Listen() {
  const { lib, error, radio } = useLibrary()
  useEffect(() => void loadRadio(), [])
  if (error && !lib) return <NoBox message={error} />
  if (!lib) return <Loading />
  const { album, track } = index(lib)
  const recentAlbums = [...new Set(lib.recent.map((r) => track.get(r.id)?.albumId).filter(Boolean))].map((id) => album.get(id!)).filter((a): a is Album => !!a)
  const newest = [...lib.albums].sort((a, b) => b.added - a.added).slice(0, 12)
  const quick = (recentAlbums.length ? recentAlbums : newest).slice(0, 6)
  const empty = !lib.tracks.length && !lib.videos.length

  return (
    <Page title={greeting()}>
      {lib.scanning && (
        <Alert variant="info" className="mb-4">
          <Loader2 className="animate-spin" />
          <AlertTitle>Looking through your music</AlertTitle>
          <AlertDescription>{plural(lib.tracks.length, "song")} found so far. Everything works while it looks.</AlertDescription>
        </Alert>
      )}
      {empty && !lib.scanning ? (
        <Empty className="mt-10 border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon"><FolderPlus /></EmptyMedia>
            <EmptyTitle>Nothing to play yet</EmptyTitle>
            <EmptyDescription>Tell Beyond Music where your music and videos are kept: a folder on this box, a USB drive or the family computer’s shared folder.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <a href="#settings" data-autofocus className={buttonVariants({ size: "lg" })}>Add your music</a>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 px-2 lg:grid-cols-3">
            {quick.map((a, i) => (
              <a key={a.id} href={`#album/${a.id}`} data-autofocus={i === 0 ? "" : undefined} className="flex items-center gap-3 overflow-hidden rounded-lg bg-card pr-3 font-medium transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring">
                <Cover album={a} className="size-14 rounded-none sm:size-16" />
                <span className="line-clamp-2 text-sm">{a.title}</span>
              </a>
            ))}
          </div>
          {!!lib.tracks.length && (
            <div className="mt-6 flex gap-2 px-2">
              <button type="button" className={buttonVariants({ size: "lg" })} onClick={() => playTracks(lib.tracks, lib, Math.floor(Math.random() * lib.tracks.length), true)}>
                <Shuffle /> Shuffle everything
              </button>
            </div>
          )}
          {recentAlbums.length > 0 && <Shelf title="Played recently">{recentAlbums.slice(0, 12).map((a) => <AlbumCard key={a.id} album={a} lib={lib} />)}</Shelf>}
          {newest.length > 0 && <Shelf title="New in" href="#library/albums">{newest.map((a) => <AlbumCard key={a.id} album={a} lib={lib} />)}</Shelf>}
          {lib.playlists.length > 0 && <PlaylistShelf lib={lib} />}
          {radio && radio.length > 0 && (
            <Shelf title="Radio" href="#radio">
              {radio.slice(0, 10).map((r, i) => (
                <button key={r.id} type="button" onClick={() => playList(radio.map(fromStation), i, false)} className="rounded-xl p-2 text-left transition-colors outline-none hover:bg-card focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-ring">
                  <Cover src={r.logo} radio round className="w-full" />
                  <div className="mt-2 truncate font-medium">{r.name}</div>
                  <div className="truncate text-sm text-muted-foreground">{r.town || "Live"}</div>
                </button>
              ))}
            </Shelf>
          )}
          {lib.videos.length > 0 && (
            <Shelf title="Watch" href="#videos">
              {[...lib.videos].sort((a, b) => b.added - a.added).slice(0, 10).map((v) => (
                <a key={v.id} href={v.kind === "episode" ? `#show/${encodeURIComponent(v.show || "")}` : `#watch/${v.id}`} className="rounded-xl p-2 transition-colors outline-none hover:bg-card focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-ring">
                  <div className="grid aspect-video place-items-center rounded-lg bg-gradient-to-br from-chrome to-void"><Play className="size-8 text-lilac" /></div>
                  <div className="mt-2 truncate font-medium">{v.kind === "episode" ? v.show : v.kind === "home" ? v.folder || v.title : v.title}</div>
                  <div className="truncate text-sm text-muted-foreground">{v.kind === "episode" ? `Season ${v.season}, episode ${v.episode}` : v.kind === "home" ? v.title : v.year || "Film"}</div>
                </a>
              ))}
            </Shelf>
          )}
        </>
      )}
    </Page>
  )
}

function PlaylistShelf({ lib }: { lib: Library }) {
  const { album, track } = index(lib)
  return (
    <Shelf title="Your playlists" href="#library/playlists">
      {lib.playlists.map((p) => {
        const first = album.get(track.get(p.items[0])?.albumId || "")
        return (
          <a key={p.id} href={`#playlist/${p.id}`} className="rounded-xl p-2 transition-colors outline-none hover:bg-card focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-ring">
            <Cover album={first} className="w-full" />
            <div className="mt-2 truncate font-medium">{p.name}</div>
            <div className="truncate text-sm text-muted-foreground">{plural(p.items.length, "song")}</div>
          </a>
        )
      })}
    </Shelf>
  )
}

export function Loading() {
  return (
    <div className="grid min-h-[60dvh] place-items-center text-muted-foreground">
      <Loader2 className="size-8 animate-spin" />
    </div>
  )
}

export function NoBox({ message }: { message: string }) {
  return (
    <Page title="Can’t find the music box">
      <Alert variant="warning">
        <AlertTitle>{message}</AlertTitle>
        <AlertDescription>Check the box is plugged in and on the same Wi-Fi as this screen, then try again.</AlertDescription>
      </Alert>
      <button type="button" data-autofocus className={buttonVariants({ size: "lg", className: "mt-4" })} onClick={() => location.reload()}>Try again</button>
    </Page>
  )
}
