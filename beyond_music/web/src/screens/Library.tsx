import { Disc3, ListMusic, Mic2, Pencil, Play, Shuffle, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { box } from "@/api"
import { AlbumCard, Cover, Grid, Page, TrackList, playAlbum, playTracks } from "@/components/media"
import { TrackMenu } from "@/components/track-menu"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { howLong, plural } from "@/lib/pure.js"
import { index, reload, useLibrary } from "@/lib/store"
import type { Library as Lib, Track } from "@/lib/types"
import { Loading, NoBox } from "./Listen"

const TABS = [
  { id: "albums", label: "Albums" },
  { id: "artists", label: "Artists" },
  { id: "playlists", label: "Playlists" },
]

export function Library({ tab = "albums" }: { tab?: string }) {
  const { lib, error } = useLibrary()
  const [sort, setSort] = useState<"az" | "new" | "artist">("az")
  if (error && !lib) return <NoBox message={error} />
  if (!lib) return <Loading />
  return (
    <Page title="Your music">
      <div role="tablist" className="mb-4 flex gap-2 px-2">
        {TABS.map((t, i) => (
          <a key={t.id} role="tab" href={`#library/${t.id}`} aria-selected={tab === t.id} data-autofocus={i === 0 ? "" : undefined} className="rounded-full bg-card px-4 py-1.5 text-sm font-medium outline-none transition-colors hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring aria-selected:bg-foreground aria-selected:text-background">
            {t.label}
          </a>
        ))}
      </div>
      {tab === "albums" && (
        <>
          <div className="mb-2 flex gap-1 px-2 text-sm">
            {(["az", "new", "artist"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)} className="rounded-md px-2 py-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-pressed:text-foreground aria-pressed:underline">
                {k === "az" ? "A to Z" : k === "new" ? "Newest" : "By artist"}
              </button>
            ))}
          </div>
          {lib.albums.length ? (
            <Grid>
              {[...lib.albums]
                .sort((a, b) => (sort === "new" ? b.added - a.added : sort === "artist" ? a.artist.localeCompare(b.artist) || (a.year || 0) - (b.year || 0) : a.title.localeCompare(b.title)))
                .map((a) => <AlbumCard key={a.id} album={a} lib={lib} />)}
            </Grid>
          ) : (
            <Nothing icon={<Disc3 />} title="No albums yet" text="Add a folder of music in Settings and they’ll show up here." />
          )}
        </>
      )}
      {tab === "artists" &&
        (lib.artists.length ? (
          <Grid>
            {[...lib.artists].sort((a, b) => a.name.localeCompare(b.name)).map((a) => {
              const first = lib.albums.find((al) => a.albumIds.includes(al.id) && al.hasCover)
              return (
                <a key={a.id} href={`#artist/${a.id}`} className="rounded-xl p-2 text-center transition-colors outline-none hover:bg-card focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-ring">
                  <Cover album={first} round className="w-full" />
                  <div className="mt-2 truncate font-medium">{a.name}</div>
                  <div className="text-sm text-muted-foreground">{plural(a.albumIds.length, "album")}</div>
                </a>
              )
            })}
          </Grid>
        ) : (
          <Nothing icon={<Mic2 />} title="No artists yet" text="They’ll appear as the box finds your music." />
        ))}
      {tab === "playlists" && <Playlists lib={lib} />}
    </Page>
  )
}

function Nothing({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{text}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function Playlists({ lib }: { lib: Lib }) {
  const { album, track } = index(lib)
  if (!lib.playlists.length)
    return <Nothing icon={<ListMusic />} title="No playlists yet" text="Press … on any song and choose Add to a playlist. Everyone in the house shares them." />
  return (
    <Grid>
      {lib.playlists.map((p) => (
        <a key={p.id} href={`#playlist/${p.id}`} className="rounded-xl p-2 transition-colors outline-none hover:bg-card focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-ring">
          <Cover album={album.get(track.get(p.items[0])?.albumId || "")} className="w-full" />
          <div className="mt-2 truncate font-medium">{p.name}</div>
          <div className="text-sm text-muted-foreground">{plural(p.items.length, "song")}</div>
        </a>
      ))}
    </Grid>
  )
}

export function AlbumScreen({ id }: { id: string }) {
  const { lib, error } = useLibrary()
  const [selling, setSelling] = useState(false)
  if (error && !lib) return <NoBox message={error} />
  if (!lib) return <Loading />
  const { album, track } = index(lib)
  const a = album.get(id)
  if (!a) return <Gone />
  const tracks = a.trackIds.map((t) => track.get(t)).filter((t): t is Track => !!t)
  const sold = async () => {
    try {
      const r = await box.sold(a.id)
      toast(r.elsewhere ? `Copies removed. ${plural(r.elsewhere, "song")} in your own folders are hidden; delete those yourself.` : "Copies removed. Thanks for keeping it fair.")
      setSelling(false)
      await reload()
      history.back()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }
  return (
    <Page>
      <div className="flex flex-col items-center gap-5 px-2 sm:flex-row sm:items-end">
        <Cover album={a} className="w-52 shadow-2xl shadow-black/50 sm:w-56" />
        <div className="min-w-0 text-center sm:text-left">
          <div className="text-sm font-medium text-muted-foreground">Album</div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">{a.title}</h1>
          <div className="mt-2 text-muted-foreground">
            <a href={`#artist/${a.artistId}`} className="font-semibold text-foreground hover:underline">{a.artist}</a>
            {a.year ? ` · ${a.year}` : ""} · {plural(tracks.length, "song")}, {howLong(a.duration)}
          </div>
        </div>
      </div>
      <div className="my-5 flex flex-wrap gap-2 px-2">
        <Button size="lg" data-autofocus onClick={() => playAlbum(a, lib, 0, false)}><Play className="fill-current" /> Play</Button>
        <Button size="lg" variant="secondary" onClick={() => playAlbum(a, lib, Math.floor(Math.random() * tracks.length), true)}><Shuffle /> Shuffle</Button>
        <TrackMenu tracks={tracks} lib={lib} label="Add" />
      </div>
      <TrackList tracks={tracks} lib={lib} numbers onPlay={(i) => playAlbum(a, lib, i, false)} actions={(t) => <TrackMenu tracks={[t]} lib={lib} />} />
      <div className="mt-10 px-2">
        <Button variant="ghost" className="text-muted-foreground" onClick={() => setSelling(true)}>I sold or gave away this CD</Button>
      </div>
      <Dialog open={selling} onOpenChange={setSelling}>
        <DialogContent className="dark">
          <DialogHeader>
            <DialogTitle>Sold or gave away {a.title}?</DialogTitle>
            <DialogDescription>
              New Zealand’s copyright law lets you keep a copy of music you own, but only while you still own the CD. Beyond Music will delete the copies it made, and hide any in your own folders.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" size="lg" />}>Keep it</DialogClose>
            <Button variant="destructive" size="lg" onClick={sold}><Trash2 /> Remove the copies</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  )
}

export function ArtistScreen({ id }: { id: string }) {
  const { lib, error } = useLibrary()
  if (error && !lib) return <NoBox message={error} />
  if (!lib) return <Loading />
  const { artist, album } = index(lib)
  const ar = artist.get(id)
  if (!ar) return <Gone />
  const albums = ar.albumIds.map((x) => album.get(x)).filter((x): x is NonNullable<typeof x> => !!x).sort((a, b) => (b.year || 0) - (a.year || 0))
  const songs = lib.tracks.filter((t) => t.artistId === id || albums.some((a) => a.id === t.albumId))
  return (
    <Page kicker="Artist" title={ar.name} actions={<><Button size="lg" data-autofocus onClick={() => playTracks(songs, lib, 0, false)}><Play className="fill-current" /> Play</Button><Button size="lg" variant="secondary" onClick={() => playTracks(songs, lib, Math.floor(Math.random() * songs.length), true)}><Shuffle /> Shuffle</Button></>}>
      <h2 className="mb-2 px-2 text-xl font-bold">Albums</h2>
      <Grid>{albums.map((a) => <AlbumCard key={a.id} album={a} lib={lib} />)}</Grid>
    </Page>
  )
}

export function PlaylistScreen({ id }: { id: string }) {
  const { lib, error } = useLibrary()
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState("")
  if (error && !lib) return <NoBox message={error} />
  if (!lib) return <Loading />
  const p = lib.playlists.find((x) => x.id === id)
  if (!p) return <Gone />
  const { track } = index(lib)
  const tracks = p.items.map((x) => track.get(x)).filter((t): t is Track => !!t)
  const save = async (items: string[], newName = p.name) => {
    try {
      await box.savePlaylist({ id: p.id, name: newName, items })
      reload()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }
  const remove = async () => {
    await box.deletePlaylist(p.id)
    await reload()
    location.hash = "#library/playlists"
  }
  return (
    <Page
      kicker="Playlist"
      title={p.name}
      actions={
        <>
          <Button size="lg" data-autofocus disabled={!tracks.length} onClick={() => playTracks(tracks, lib, 0, false)}><Play className="fill-current" /> Play</Button>
          <Button size="lg" variant="secondary" disabled={!tracks.length} onClick={() => playTracks(tracks, lib, Math.floor(Math.random() * tracks.length), true)}><Shuffle /> Shuffle</Button>
          <Button size="lg" variant="outline" onClick={() => (setName(p.name), setRenaming(true))}><Pencil /> Rename</Button>
          <Button size="lg" variant="ghost" onClick={remove}><Trash2 /> Delete</Button>
        </>
      }
    >
      <div className="mb-3 px-2 text-sm text-muted-foreground">{plural(tracks.length, "song")}. The whole household shares this playlist.</div>
      {tracks.length ? (
        <TrackList tracks={tracks} lib={lib} showAlbum actions={(_, i) => (
          <Button variant="ghost" size="icon-lg" aria-label="Take off the playlist" className="text-muted-foreground" onClick={() => save(p.items.filter((_, j) => j !== i))}><Trash2 /></Button>
        )} />
      ) : (
        <Nothing icon={<ListMusic />} title="Nothing on it yet" text="Press … on any song and choose Add to a playlist." />
      )}
      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent className="dark sm:max-w-md">
          <DialogHeader><DialogTitle>Rename the playlist</DialogTitle></DialogHeader>
          <form className="flex gap-2" onSubmit={(e) => (e.preventDefault(), save(p.items, name.trim() || p.name), setRenaming(false))}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
            <Button type="submit" size="lg">Save</Button>
          </form>
        </DialogContent>
      </Dialog>
    </Page>
  )
}

export function Gone() {
  return (
    <Page title="That one’s gone">
      <p className="px-2 text-muted-foreground">It may have been moved or removed from the box.</p>
      <a href="#listen" data-autofocus className={buttonVariants({ size: "lg", className: "mx-2 mt-4" })}>Back to Listen</a>
    </Page>
  )
}
