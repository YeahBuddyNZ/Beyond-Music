import { lazy, Suspense, useEffect, useState } from "react"
import { Shell } from "@/components/shell"
import { focusFirst, startRemote, TV } from "@/lib/tv"
import { AlbumScreen, ArtistScreen, Library, PlaylistScreen } from "@/screens/Library"
import { Listen, Loading } from "@/screens/Listen"
import { Now } from "@/screens/Now"
import { Radio } from "@/screens/Radio"
import { Search } from "@/screens/Search"
import { Settings } from "@/screens/Settings"
import { Show, Videos, Watch } from "@/screens/Videos"

// Screens by address: #listen, #search, #library/<albums|artists|playlists>, #album/<id>, #artist/<id>,
// #playlist/<id>, #videos, #show/<name>, #watch/<id>, #radio, #dj, #now, #settings.
const read = () => {
  const [screen, ...rest] = location.hash.slice(1).split("/")
  return { screen: screen || "listen", id: rest.length ? decodeURIComponent(rest.join("/")) : undefined }
}

startRemote()

// DJ mode carries its own audio engine, so it loads only when opened.
const Dj = lazy(() => import("@/screens/Dj").then((m) => ({ default: m.Dj })))

export function App() {
  const [at, setAt] = useState(read)
  useEffect(() => {
    const onHash = () => {
      setAt(read())
      window.scrollTo(0, 0)
    }
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])
  // On a TV, something always has the remote's focus, so the arrows do something straight away.
  useEffect(() => {
    if (!TV) return
    const t = setTimeout(() => {
      if (!document.activeElement || document.activeElement === document.body) focusFirst()
    }, 300)
    return () => clearTimeout(t)
  }, [at])

  const { screen, id } = at
  if (screen === "watch" && id) return <Watch id={id} />
  if (screen === "dj") return <Shell screen="dj" bare><Suspense fallback={<Loading />}><Dj /></Suspense></Shell>
  if (screen === "now") return <Shell screen="now" bare><Now /></Shell>
  return (
    <Shell screen={screen}>
      {screen === "search" ? <Search />
        : screen === "library" ? <Library tab={id} />
        : screen === "album" && id ? <AlbumScreen key={id} id={id} />
        : screen === "artist" && id ? <ArtistScreen key={id} id={id} />
        : screen === "playlist" && id ? <PlaylistScreen key={id} id={id} />
        : screen === "videos" ? <Videos />
        : screen === "show" && id ? <Show name={id} />
        : screen === "radio" ? <Radio />
        : screen === "settings" ? <Settings />
        : <Listen />}
    </Shell>
  )
}
