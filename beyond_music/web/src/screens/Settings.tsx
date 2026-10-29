import { CheckCircle2, ChevronRight, Copy, Disc, Disc3, Folder, FolderPlus, FlaskConical, HardDrive, Loader2, RefreshCw, Smartphone, Trash2, Usb } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { box, PREVIEW } from "@/api"
import { Page } from "@/components/media"
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert"
import { Badge } from "@/components/reui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { plural } from "@/lib/pure.js"
import { reload, useLibrary } from "@/lib/store"
import { knownTempos } from "@/lib/tempos"
import type { Apps, CdStatus, Folder as FolderT, Labs, Places, Stick, UsbJob } from "@/lib/types"

declare const __APP_VERSION__: string

// Early features show only with ?labs in the address, or once one is switched on.
const LABS_ASKED = /[?&]labs/.test(location.search) || /[?&]labs/.test(location.hash)

export function Settings() {
  const { lib } = useLibrary()
  const [labs, setLabs] = useState<Labs | null>(null)
  useEffect(() => void box.labs().then(setLabs).catch(() => {}), [])
  return (
    <Page title="Settings">
      <div className="flex max-w-3xl flex-col gap-4 px-2">
        <PlacesCard scanning={!!lib?.scanning} />
        <CdCard />
        <AppsCard />
        {labs?.usb && <UsbCard />}
        {labs && (LABS_ASKED || Object.values(labs).some(Boolean)) && <LabsCard labs={labs} onChange={setLabs} />}
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
            <Disc /> {cd.copying ? "Copying…" : cd.disc ? `Copy “${cd.disc}”` : "Copy the CD in the drive"}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            {cd.needsDisc ? "Put one of your CDs in the drive. Any USB CD drive works." : !cd.hasDrive ? "No CD drive found. Plug a USB CD drive into this box." : "This box needs its CD copying tools added first; see the README’s “Copying CDs” part."}
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

function LabsCard({ labs, onChange }: { labs: Labs; onChange: (l: Labs) => void }) {
  const flip = async (on: boolean) => onChange(await box.setLab("usb", on))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FlaskConical className="size-5" /> Try things early</CardTitle>
        <CardDescription>Still being made and checked. They may change, or go.</CardDescription>
      </CardHeader>
      <CardContent>
        <label className="flex items-center gap-3">
          <Switch checked={!!labs.usb} onCheckedChange={flip} />
          <span className="font-medium">A USB stick for DJ decks</span>
        </label>
      </CardContent>
    </Card>
  )
}

const gb = (n: number | null) => (n == null ? "" : `${(n / 1e9).toFixed(n < 1e10 ? 1 : 0)} GB`)

function UsbCard() {
  const { lib } = useLibrary()
  const [state, setState] = useState<{ sticks: Stick[]; job: UsbJob } | null>(null)
  const [stick, setStick] = useState<string | null>(null)
  const [chosen, setChosen] = useState<string[]>([])
  const [asking, setAsking] = useState(false)
  const load = () => box.usb().then(setState).catch(() => {})
  const copying = state?.job.state === "copying"
  useEffect(() => {
    load()
    const t = setInterval(load, copying ? 1000 : 5000)
    return () => clearInterval(t)
  }, [copying])
  useEffect(() => {
    if (state && !state.sticks.some((s) => s.path === stick)) setStick(state.sticks[0]?.path ?? null)
  }, [state, stick])
  const playlists = lib?.playlists ?? []
  const toggle = (id: string, on: boolean) => setChosen((c) => (on ? [...c, id] : c.filter((x) => x !== id)))
  const go = async (replace = false) => {
    if (!stick) return
    setAsking(false)
    try {
      const r = await box.copyToUsb({ stick, playlists: chosen, tempo: knownTempos(), replace })
      setState((s) => (s ? { ...s, job: r.job } : s))
      if (r.skipped.length) toast(`${plural(r.skipped.length, "song")} can’t go on: the players don’t play that kind of file.`)
    } catch (e) {
      if ((e as { body?: { rekordbox?: boolean } }).body?.rekordbox) setAsking(true)
      else toast.error((e as Error).message)
    }
  }
  const job = state?.job
  const picked = state?.sticks.find((s) => s.path === stick)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Disc3 className="size-5" /> A USB stick for DJ decks <Badge variant="warning-light">Trying it out</Badge></CardTitle>
        <CardDescription>Puts your playlists on a USB stick the way rekordbox does, so Pioneer DJ players (CDJs, XDJs and the all-in-ones) can find them. For you and your household. Playing to people at a gig or a bar needs the venue’s music licence.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!state ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : !state.sticks.length ? (
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">Plug a USB stick into this box.</p>
            <Button variant="outline" size="sm" onClick={load}><RefreshCw /> Look again</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {state.sticks.map((s) => (
              <Item key={s.path} variant={s.path === stick ? "muted" : "outline"} render={<button type="button" onClick={() => setStick(s.path)} />} className="text-left">
                <ItemMedia variant="icon"><Usb /></ItemMedia>
                <ItemContent>
                  <ItemTitle>{s.name}</ItemTitle>
                  <ItemDescription>{[s.free != null && `${gb(s.free)} free of ${gb(s.size)}`, s.ours && "has your DJ playlists", s.rekordbox && "has a rekordbox library"].filter(Boolean).join(", ")}</ItemDescription>
                </ItemContent>
                {s.path === stick && <ItemActions><CheckCircle2 className="size-5 text-primary" /></ItemActions>}
              </Item>
            ))}
          </div>
        )}
        {state && state.sticks.length > 0 && (
          playlists.length ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Which playlists</p>
              {playlists.map((p) => (
                <label key={p.id} className="flex items-center gap-3">
                  <Switch checked={chosen.includes(p.id)} onCheckedChange={(on) => toggle(p.id, on)} />
                  <span>{p.name} <span className="text-muted-foreground">({plural(p.items.length, "song")})</span></span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Make a playlist first: the stick holds playlists, and each song in them.</p>
          )
        )}
        {job?.state === "copying" && (
          <div className="flex flex-col gap-1">
            <Progress value={job.total ? Math.round(((job.done || 0) / job.total) * 100) : 0} />
            <p className="truncate text-sm text-muted-foreground">{job.done} of {job.total}{job.current ? `: ${job.current}` : ""}</p>
          </div>
        )}
        {job?.state === "done" && (
          <Alert variant="success">
            <CheckCircle2 />
            <AlertTitle>Ready on {job.stick}</AlertTitle>
            <AlertDescription>Eject it first, then plug it into the decks. Songs DJ mode has opened carry their tempo; waveforms and beat grids aren’t on the stick yet.</AlertDescription>
          </Alert>
        )}
        {job?.state === "failed" && (
          <Alert variant="warning">
            <Usb />
            <AlertTitle>That copy didn’t finish</AlertTitle>
            <AlertDescription>{job.error}</AlertDescription>
          </Alert>
        )}
        {state && state.sticks.length > 0 && playlists.length > 0 && (
          <Button size="lg" className="self-start" disabled={!stick || !chosen.length || copying} onClick={() => go()}>
            <Usb /> {copying ? "Copying…" : picked ? `Copy to ${picked.name}` : "Copy to the stick"}
          </Button>
        )}
        {PREVIEW && <p className="text-xs text-muted-foreground">Preview: nothing here is real.</p>}
      </CardContent>
      <Dialog open={asking} onOpenChange={setAsking}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>This stick has a rekordbox library on it</DialogTitle>
            <DialogDescription>Put yours on instead? The rekordbox library is kept on the stick as a backup, and its songs stay where they are, but the players will list your playlists, not those.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setAsking(false)}>Keep it as it is</Button>
            <Button onClick={() => go(true)}>Put mine on</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
