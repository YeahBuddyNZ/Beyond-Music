import { Radio as RadioIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { Cover, Grid, Page } from "@/components/media"
import { Badge } from "@/components/reui/badge"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { current, fromStation, playList, usePlayer } from "@/lib/player"
import { findIn } from "@/lib/pure.js"
import { loadRadio, useLibrary } from "@/lib/store"
import { Loading } from "./Listen"

export function Radio() {
  const { radio } = useLibrary()
  const [q, setQ] = useState("")
  usePlayer()
  useEffect(() => void loadRadio(), [])
  if (!radio) return <Loading />
  const list = q ? radio.filter((r) => findIn(q, [r.name, r.town, ...r.tags])) : radio
  const now = current()
  return (
    <Page title="Radio" kicker="New Zealand stations, live">
      {radio.length > 6 && <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a station or a town" className="mx-2 mb-4 h-11 max-w-md" aria-label="Find a station" />}
      {!radio.length ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon"><RadioIcon /></EmptyMedia>
            <EmptyTitle>Can’t reach the radio list</EmptyTitle>
            <EmptyDescription>The box finds stations on the internet. Check it’s online, then come back.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Grid>
          {list.map((r, i) => {
            const on = now?.kind === "radio" && now.id === r.id
            return (
              <button key={r.id} type="button" data-autofocus={i === 0 ? "" : undefined} onClick={() => playList(list.map(fromStation), i, false)} className="rounded-xl p-2 text-left outline-none transition-colors hover:bg-card focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-ring aria-pressed:bg-card" aria-pressed={on}>
                <Cover src={r.logo} radio round className="w-full" />
                <div className="mt-2 flex items-center gap-2">
                  <span className="truncate font-medium">{r.name}</span>
                  {on && <Badge variant="primary-light" className="px-1.5 text-xs">On</Badge>}
                </div>
                <div className="truncate text-sm text-muted-foreground">{[r.town, r.tags[0]].filter(Boolean).join(" · ") || "Live"}</div>
              </button>
            )
          })}
        </Grid>
      )}
      <p className="mt-6 px-2 text-xs text-muted-foreground">Station list from Radio Browser (radio-browser.info). Stations stream from their own websites.</p>
    </Page>
  )
}
