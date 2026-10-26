import { CheckCircle2, ChevronRight, Copy, Disc, Folder, FolderPlus, HardDrive, Loader2, RefreshCw, Smartphone, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { box, PREVIEW } from "@/api"
import { Page } from "@/components/media"
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert"
import { Badge } from "@/components/reui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { plural } from "@/lib/pure.js"
import { reload, useLibrary } from "@/lib/store"
import type { Apps, CdStatus, Folder as FolderT, Places } from "@/lib/types"

declare const __APP_VERSION__: string

export function Settings() {
  const { lib } = useLibrary()
  return (
    <Page title="Settings">
      <div className="flex max-w-3xl flex-col gap-4 px-2">
        <PlacesCard scanning={!!lib?.scanning} />
        <CdCard />
        <AppsCard />
        <Card>
          <CardHeader>
            <CardTitle>Keeping it fair</CardTitle>
            <CardDescription>Beyond Music plays what your household owns or made. In New Zealand you can keep a copy of music you own on each of your own devices, for the household, while you still own the original.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ul className="list-disc space-y-1 pl-5">
              <li>It copies CDs, never DVDs or Blu-rays (their locks can’t be broken).</li>
              <li>It never downloads from torrent or sharing sites.</li>
              <li>It only answers screens in this house. Nothing is shared outside it.</li>
              <li>What you play stays on the box. It isn’t sent anywhere.</li>
            </ul>
            <p className="mt-3">Beyond™ Music {typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : ""}{lib ? `: ${plural(lib.tracks.length, "song")}, ${plural(lib.videos.length, "video")}` : ""}</p>
          </CardContent>
        </Card>
      </div>
    </Page>
  )
}

function PlacesCard({ scanning }: { scanning: boolean }) {
  const [places, setPlaces] = useState<Places | null>(null)
  const [browsing, setBrowsing] = useState(false)
  const load = () => box.places().then(setPlaces).catch(() => {})
  useEffect(() => void load(), [])
  const add = async (path: string) => {
    try {
      await box.addPlace(path)
      toast("Added. Looking through it now.")
      setBrowsing(false)
      await box.scan()
      load()
      reload()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }
  const remove = async (id: string) => {
    await box.removePlace(id)
    load()
    reload()
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Where your music and videos are</CardTitle>
        <CardDescription>Folders on this box, a USB drive plugged into it, or a shared folder from the family computer. Beyond Music only reads them: it never changes your files.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!places ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <ul className="flex flex-col divide-y rounded-lg border">
              {places.places.map((p) => (
                <li key={p.id} className="flex items-center gap-3 p-3">
                  {p.fixed ? <Disc className="size-5 text-muted-foreground" /> : <HardDrive className="size-5 text-muted-foreground" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="truncate text-sm text-muted-foreground">{p.fixed ? "CDs you copy with Beyond Music go here" : p.path} · {plural(p.files, "file")}</div>
                  </div>
                  {!p.fixed && (
                    <Button variant="ghost" size="icon-lg" aria-label={`Stop using ${p.name}`} onClick={() => remove(p.id)}>
                      <Trash2 />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {places.suggestions.length > 0 && (
              <div>
                <div className="mb-2 text-sm font-medium">Found on this box</div>
                <div className="flex flex-wrap gap-2">
                  {places.suggestions.map((s) => (
                    <Button key={s} variant="secondary" size="lg" onClick={() => add(s)}>
                      <FolderPlus /> {s}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="lg" onClick={() => setBrowsing(true)}>
                <FolderPlus /> Add a folder
              </Button>
              <Button size="lg" variant="outline" disabled={scanning} onClick={() => box.scan().then(() => (toast("Looking for new music"), reload()))}>
                {scanning ? <Loader2 className="animate-spin" /> : <RefreshCw />} {scanning ? "Looking…" : "Look for new music"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
      <Browse open={browsing} onOpenChange={setBrowsing} onPick={add} />
    </Card>
  )
}

function Browse({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (path: string) => void }) {
  const [at, setAt] = useState<string | null>(null)
  const [folders, setFolders] = useState<FolderT[]>([])
  const [trail, setTrail] = useState<string[]>([])
  const go = async (path?: string) => {
    try {
      const r = await box.browse(path)
      setAt(r.at)
      setFolders(r.folders)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }
  useEffect(() => {
    if (open) (setTrail([]), go())
  }, [open])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dark sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pick a folder</DialogTitle>
          <DialogDescription>{at ? at : "Places on this box"}</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {trail.length > 0 && (
            <Button variant="ghost" size="lg" className="justify-start" onClick={() => { const t = trail.slice(0, -1); setTrail(t); go(t[t.length - 1]) }}>
              Back up a level
            </Button>
          )}
          {folders.map((f) => (
            <Button key={f.path} variant="ghost" size="lg" className="justify-start" onClick={() => (setTrail([...trail, f.path]), go(f.path))}>
              <Folder /> <span className="truncate">{f.name}</span> <ChevronRight className="ml-auto" />
            </Button>
          ))}
          {!folders.length && <p className="px-2 py-4 text-sm text-muted-foreground">No folders in here.</p>}
        </div>
        {at && (
          <Button size="lg" onClick={() => onPick(at)}>
            <CheckCircle2 /> Use this folder
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}

function CdCard() {
  const [cd, setCd] = useState<CdStatus | null>(null)
  const load = () => box.cd().then(setCd).catch(() => {})
  useEffect(() => {
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [])
  const copy = async () => {
    try {
      setCd(await box.copyCd())
      toast("Copying. It takes about as long as the CD plays, quicker on a fast drive.")
    } catch (e) {
      toast.error((e as Error).message)
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Copy a CD</CardTitle>
        <CardDescription>Put one of your CDs in a drive plugged into this box and copy it in full quality. Keep the CD: if you sell it or give it away, open the album and press “I sold or gave away this CD”.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {cd?.last && (
          <Alert variant={cd.copying ? "info" : cd.last.ok ? "success" : "warning"}>
            {cd.copying ? <Loader2 className="animate-spin" /> : <Disc />}
            <AlertTitle>{cd.copying ? "Copying the CD" : cd.last.ok ? "CD copied" : "That copy didn’t finish"}</AlertTitle>
            {cd.last.line && <AlertDescription className="truncate">{cd.last.line}</AlertDescription>}
          </Alert>
        )}
        {!cd ? null : cd.canCopy ? (
          <Button size="lg" className="self-start" disabled={cd.copying} onClick={copy}>
            <Disc /> {cd.copying ? "Copying…" : "Copy the CD in the drive"}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            {!cd.hasDrive ? "No CD drive found. Plug a USB CD drive into this box." : "This box needs its CD copying tools added first; see the README’s “Copying CDs” part."}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function AppsCard() {
  const [apps, setApps] = useState<Apps | null>(null)
  const load = () => box.apps().then(setApps).catch(() => {})
  useEffect(() => void load(), [])
  const flip = async (on: boolean) => {
    await box.setApps(on)
    load()
  }
  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => toast("Copied"), () => {})
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Smartphone className="size-5" /> Other music apps, and the car</CardTitle>
        <CardDescription>Apps like Symfonium (Android) and Amperfy (iPhone) can play this box’s music, and they work with Android Auto and CarPlay. Turn it on and type these into the app as a “Subsonic” server.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <label className="flex items-center gap-3">
          <Switch checked={!!apps?.on} onCheckedChange={flip} disabled={!apps} />
          <span className="font-medium">Let other music apps in the house play from this box</span>
        </label>
        {apps?.on && (
          <dl className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 rounded-lg border p-3 text-sm">
            <dt className="text-muted-foreground">Address</dt>
            <dd className="truncate font-mono">{apps.addresses[0] || "this box’s address, port 8097"}</dd>
            <Button variant="ghost" size="icon" aria-label="Copy the address" onClick={() => copy(apps.addresses[0] || "")}><Copy /></Button>
            <dt className="text-muted-foreground">User</dt>
            <dd className="font-mono">{apps.user}</dd>
            <span />
            <dt className="text-muted-foreground">Password</dt>
            <dd className="font-mono">{apps.password}</dd>
            <Button variant="ghost" size="icon" aria-label="Copy the password" onClick={() => copy(apps.password)}><Copy /></Button>
          </dl>
        )}
        {apps?.on && <Badge variant="info-light" className="self-start">Works at home only. Away from home is on the way.</Badge>}
        {PREVIEW && <p className="text-xs text-muted-foreground">Preview: nothing here is real.</p>}
      </CardContent>
    </Card>
  )
}
