import { Search as SearchIcon } from "lucide-react"
import { useState } from "react"
import { AlbumCard, Cover, Grid, Page, TrackList } from "@/components/media"
import { TrackMenu } from "@/components/track-menu"
import { Input } from "@/components/ui/input"
import { findIn } from "@/lib/pure.js"
import { useLibrary } from "@/lib/store"
import { Loading, NoBox } from "./Listen"

export function Search() {
  const { lib, error } = useLibrary()
  const [q, setQ] = useState(() => sessionStorage.getItem("bm.search") || "")
  if (error && !lib) return <NoBox message={error} />
  if (!lib) return <Loading />
  const type = (v: string) => {
    setQ(v)
    try { sessionStorage.setItem("bm.search", v) } catch {}
  }
  const artists = q ? lib.artists.filter((a) => findIn(q, [a.name])).slice(0, 12) : []
  const albums = q ? lib.albums.filter((a) => findIn(q, [a.title, a.artist, a.year])).slice(0, 12) : []
  const songs = q ? lib.tracks.filter((t) => findIn(q, [t.title, t.artist, t.album, t.genre])).slice(0, 50) : []
  const videos = q ? lib.videos.filter((v) => findIn(q, [v.title, v.show, v.folder])).slice(0, 12) : []
  const none = q && !artists.length && !albums.length && !songs.length && !videos.length
  return (
    <Page title="Search">
      <label className="relative mx-2 mb-6 block max-w-xl">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input data-autofocus autoFocus value={q} onChange={(e) => type(e.target.value)} placeholder="Songs, albums, artists or videos" className="h-12 rounded-full pl-11 text-base" aria-label="Search" />
      </label>
      {none && <p className="px-2 text-muted-foreground">Nothing called “{q}” on the box.</p>}
      {artists.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 px-2 text-xl font-bold">Artists</h2>
          <Grid>
            {artists.map((a) => (
              <a key={a.id} href={`#artist/${a.id}`} className="rounded-xl p-2 text-center outline-none hover:bg-card focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-ring">
                <Cover album={lib.albums.find((al) => a.albumIds.includes(al.id) && al.hasCover)} round className="w-full" />
                <div className="mt-2 truncate font-medium">{a.name}</div>
              </a>
            ))}
          </Grid>
        </section>
      )}
      {albums.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 px-2 text-xl font-bold">Albums</h2>
          <Grid>{albums.map((a) => <AlbumCard key={a.id} album={a} lib={lib} />)}</Grid>
        </section>
      )}
      {songs.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 px-2 text-xl font-bold">Songs</h2>
          <TrackList tracks={songs} lib={lib} showAlbum actions={(t) => <TrackMenu tracks={[t]} lib={lib} />} />
        </section>
      )}
      {videos.length > 0 && (
        <section>
          <h2 className="mb-2 px-2 text-xl font-bold">Videos</h2>
          <div className="flex flex-col">
            {videos.map((v) => (
              <a key={v.id} href={`#watch/${v.id}`} className="rounded-lg px-2 py-2 outline-none hover:bg-card focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-ring">
                <div className="font-medium">{v.kind === "episode" ? `${v.show}: ${v.title}` : v.title}</div>
                <div className="text-sm text-muted-foreground">{v.kind === "episode" ? `Season ${v.season}, episode ${v.episode}` : v.kind === "home" ? v.folder || "Home video" : v.year || "Film"}</div>
              </a>
            ))}
          </div>
        </section>
      )}
    </Page>
  )
}
