// The "…" on a song: play it next, add it to what's playing, or put it on a playlist.

import { EllipsisVertical, ListEnd, ListMusic, ListPlus, Plus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { box } from "@/api"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { addToQueue, fromTrack, playNext } from "@/lib/player"
import { index, reload } from "@/lib/store"
import type { Library, Track } from "@/lib/types"

export function TrackMenu({ tracks, lib, label }: { tracks: Track[]; lib: Library; label?: string }) {
  const [picking, setPicking] = useState(false)
  const items = () => tracks.map((t) => fromTrack(t, index(lib).album.get(t.albumId)))
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={label ? <Button variant="outline" size="lg" /> : <Button variant="ghost" size="icon-lg" aria-label={`More for ${tracks[0]?.title}`} className="text-muted-foreground" />}>
          {label ? <><ListPlus /> {label}</> : <EllipsisVertical />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuItem onClick={() => (playNext(items()), toast("Playing next"))}><ListMusic /> Play next</DropdownMenuItem>
          <DropdownMenuItem onClick={() => (addToQueue(items()), toast("Added to what’s playing"))}><ListEnd /> Add to what’s playing</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPicking(true)}><ListPlus /> Add to a playlist</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <PlaylistPicker open={picking} onOpenChange={setPicking} lib={lib} ids={tracks.map((t) => t.id)} />
    </>
  )
}

export function PlaylistPicker({ open, onOpenChange, lib, ids }: { open: boolean; onOpenChange: (o: boolean) => void; lib: Library; ids: string[] }) {
  const [name, setName] = useState("")
  const add = async (p?: { id: string; name: string; items: string[] }) => {
    try {
      const saved = await box.savePlaylist(p ? { id: p.id, name: p.name, items: [...p.items, ...ids] } : { name: name.trim() || "New playlist", items: ids })
      toast(`Added to ${saved.name}`)
      setName("")
      onOpenChange(false)
      reload()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dark sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to a playlist</DialogTitle>
          <DialogDescription>Playlists are the whole household’s, on every screen.</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {lib.playlists.filter((p) => !p.app).map((p) => (
            <Button key={p.id} variant="ghost" size="lg" className="justify-start" onClick={() => add(p)}>
              <ListMusic /> {p.name}
            </Button>
          ))}
        </div>
        <form className="flex gap-2" onSubmit={(e) => (e.preventDefault(), add())}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="A new playlist’s name" maxLength={80} />
          <Button type="submit" size="lg"><Plus /> New</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
