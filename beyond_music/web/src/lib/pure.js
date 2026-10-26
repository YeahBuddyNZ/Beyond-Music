// The player's and the remote's decisions, in plain JavaScript so `node --test` runs them with no build.

// 3:07, or 1:02:45 for a film.
export function clock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const s = Math.floor(seconds % 60)
  const m = Math.floor(seconds / 60) % 60
  const h = Math.floor(seconds / 3600)
  const two = (n) => String(n).padStart(2, "0")
  return h ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`
}

// "42 minutes" or "1 hour 5 minutes", the way a person says how long an album is.
export function howLong(seconds) {
  const mins = Math.round((seconds || 0) / 60)
  if (mins < 1) return "under a minute"
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"}`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h} hour${h === 1 ? "" : "s"}${m ? ` ${m} minute${m === 1 ? "" : "s"}` : ""}`
}

export const plural = (n, word, many = word + "s") => `${n} ${n === 1 ? word : many}`

// A shuffled order of 0..n-1 that starts with the song playing now, so pressing Shuffle never jumps away from it.
export function shuffleOrder(n, current = 0, rand = Math.random) {
  const rest = []
  for (let i = 0; i < n; i++) if (i !== current) rest.push(i)
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j], rest[i]]
  }
  return n ? [current, ...rest] : []
}

// Where Next goes: position in the play order, or -1 when the queue has finished.
export function nextPosition(pos, length, repeat, ended = false) {
  if (!length) return -1
  if (ended && repeat === "one") return pos
  if (pos + 1 < length) return pos + 1
  return repeat === "all" || repeat === "one" ? 0 : -1
}

// Previous restarts the song if it's more than three seconds in, like every music player people know.
export function previousPosition(pos, time, length) {
  if (time > 3 || pos <= 0) return { restart: true, pos: Math.max(0, pos) }
  return { restart: false, pos: Math.min(pos - 1, length - 1) }
}

// A song counts as played after half of it, or four minutes, whichever comes first (the usual rule).
export const counts = (played, duration) => played >= 240 || (duration > 0 && played >= Math.min(duration / 2, 240)) || (!duration && played >= 30)

// The remote's arrows: the nearest thing in the direction pressed, preferring things in line with where you are.
// Boxes are {x, y, w, h}. Returns the index of the best candidate, or -1.
export function nearest(from, boxes, dir) {
  const cx = (b) => b.x + b.w / 2
  const cy = (b) => b.y + b.h / 2
  let best = -1
  let bestScore = Infinity
  boxes.forEach((b, i) => {
    let main, cross
    if (dir === "right") { main = b.x - (from.x + from.w); cross = Math.abs(cy(b) - cy(from)) }
    else if (dir === "left") { main = from.x - (b.x + b.w); cross = Math.abs(cy(b) - cy(from)) }
    else if (dir === "down") { main = b.y - (from.y + from.h); cross = Math.abs(cx(b) - cx(from)) }
    else { main = from.y - (b.y + b.h); cross = Math.abs(cx(b) - cx(from)) }
    if (main < -2) return
    // Something overlapping in the other direction is "in line" and wins over something closer but off to the side.
    const overlap = dir === "left" || dir === "right" ? b.y < from.y + from.h && b.y + b.h > from.y : b.x < from.x + from.w && b.x + b.w > from.x
    const score = Math.max(0, main) + cross * (overlap ? 0.3 : 2) + (overlap ? 0 : 400)
    if (score < bestScore) { bestScore = score; best = i }
  })
  return best
}

// The remote buttons TVs send, by key code: LG (webOS), Samsung (Tizen) and Android TV all share most of these.
export function remoteKey(e) {
  const k = e.key
  const c = e.keyCode
  if (k === "ArrowUp" || c === 38) return "up"
  if (k === "ArrowDown" || c === 40) return "down"
  if (k === "ArrowLeft" || c === 37) return "left"
  if (k === "ArrowRight" || c === 39) return "right"
  if (k === "Enter" || c === 13) return "ok"
  if (k === "GoBack" || k === "BrowserBack" || c === 461 || c === 10009) return "back"
  if (k === "MediaPlayPause" || c === 179 || c === 10252) return "playpause"
  if (k === "MediaPlay" || c === 415) return "play"
  if (k === "MediaPause" || c === 19) return "pause"
  if (k === "MediaStop" || c === 413) return "stop"
  if (k === "MediaTrackNext" || k === "MediaFastForward" || c === 417 || c === 176) return "next"
  if (k === "MediaTrackPrevious" || k === "MediaRewind" || c === 412 || c === 177) return "previous"
}

// Shows grouped by name, seasons in order, episodes in order; films A to Z; home videos newest first.
export function groupVideos(videos) {
  const shows = new Map()
  const films = []
  const home = []
  for (const v of videos) {
    if (v.kind === "episode") {
      const name = v.show || "Shows"
      if (!shows.has(name)) shows.set(name, [])
      shows.get(name).push(v)
    } else if (v.kind === "home") home.push(v)
    else films.push(v)
  }
  for (const list of shows.values()) list.sort((a, b) => (a.season || 0) - (b.season || 0) || (a.episode || 0) - (b.episode || 0) || a.title.localeCompare(b.title))
  films.sort((a, b) => a.title.localeCompare(b.title))
  home.sort((a, b) => b.added - a.added)
  return { shows: [...shows].map(([name, episodes]) => ({ name, episodes })).sort((a, b) => a.name.localeCompare(b.name)), films, home }
}

// What a word typed into Search finds: every word somewhere in the fields.
export function findIn(query, fields) {
  const key = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
  const words = key(query).split(/\s+/).filter(Boolean)
  if (!words.length) return false
  const hay = key(fields.filter(Boolean).join(" "))
  return words.every((w) => hay.includes(w))
}
