// Pure decisions about an audio CD, kept apart from the drive so the tests can run them: reading the disc's
// table of contents as a Mac describes it, asking MusicBrainz which album it is, and naming the copies.

// A Mac mounts an audio CD as a folder in /Volumes with a hidden .TOC.plist; `plutil -convert json` turns it into
// this. Blocks there count from 0, MusicBrainz counts from the 150 block lead-in, so 150 is added.
export function tocFromPlist(plist) {
  const session = (plist?.Sessions || [])[0]
  if (!session) return null
  const tracks = (session["Track Array"] || [])
    .filter((t) => !t.Data && Number.isInteger(t.Point) && t.Point >= 1 && t.Point <= 99)
    .sort((a, b) => a.Point - b.Point)
  const leadout = session["Leadout Block"]
  if (!tracks.length || !Number.isInteger(leadout)) return null
  return {
    first: tracks[0].Point,
    last: tracks[tracks.length - 1].Point,
    leadout: leadout + 150,
    offsets: tracks.map((t) => t["Start Block"] + 150),
  }
}

// MusicBrainz finds the album from the table of contents, without anybody typing a name.
export function lookupUrl(toc) {
  const parts = [toc.first, toc.last, toc.leadout, ...toc.offsets].join("+")
  return `https://musicbrainz.org/ws/2/discid/-?toc=${parts}&inc=artist-credits+recordings&cdstubs=no&fmt=json`
}

const credit = (ac) => (Array.isArray(ac) ? ac.map((c) => (c.name || c.artist?.name || "") + (c.joinphrase || "")).join("").trim() : "")

// The best match for a disc with this many tracks: a release whose CD has exactly that many.
export function albumFrom(answer, trackCount) {
  for (const r of answer?.releases || []) {
    const disc = (r.media || []).find((m) => (m.tracks || []).length === trackCount && (!m.format || /CD/i.test(m.format)))
      || (r.media || []).find((m) => (m.tracks || []).length === trackCount)
    if (!disc) continue
    const artist = credit(r["artist-credit"]) || "Unknown artist"
    return {
      id: r.id,
      artist,
      album: r.title || "Audio CD",
      year: /^\d{4}/.test(r.date || "") ? Number(r.date.slice(0, 4)) : undefined,
      disc: (r.media || []).length > 1 ? disc.position : undefined,
      tracks: disc.tracks.map((t) => ({
        title: t.title || t.recording?.title || `Track ${t.position}`,
        artist: credit(t["artist-credit"]) || artist,
      })),
    }
  }
  return null
}

// Names a folder can hold on a Mac, Windows and a USB stick.
export const safe = (s) =>
  String(s || "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/^\.+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "Untitled"

// Where each track goes: Artist/Album/01 Title.flac, the shape the library already reads names from.
export function copyPlan(album, trackCount, today = new Date(), ext = "flac") {
  const d = today
  const when = `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`
  const various = album && album.tracks.some((t) => t.artist !== album.artist)
  const artistDir = album ? (various ? "Various artists" : safe(album.artist)) : "Unknown artist"
  const albumDir = album ? safe(album.album + (album.disc ? ` (disc ${album.disc})` : "")) : `Audio CD ${when}`
  return Array.from({ length: trackCount }, (_, i) => {
    const t = album?.tracks[i]
    const n = String(i + 1).padStart(2, "0")
    const title = t ? safe(various ? `${t.artist} - ${t.title}` : t.title) : `Track ${i + 1}`
    return { dir: `${artistDir}/${albumDir}`, file: `${n} ${title}.${ext}` }
  })
}

// "1 Audio Track.aiff", "12 Audio Track.aiff" (and the same in other languages) in track order.
export function trackFiles(names) {
  return names
    .filter((n) => /\.aiff?$/i.test(n) && /^\d+/.test(n))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
}
