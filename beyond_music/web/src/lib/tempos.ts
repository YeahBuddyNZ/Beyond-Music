// The tempo of every song DJ mode has looked at (kept with its cues in this browser by lib/dj.ts), for the library
// on a Pioneer USB stick. Its own file so Settings doesn't load the DJ engine.
export function knownTempos(): Record<string, number> {
  try {
    const all = JSON.parse(localStorage.getItem("bm.dj.cues") || "{}") as Record<string, { bpm?: number }>
    return Object.fromEntries(Object.entries(all).filter(([, v]) => typeof v.bpm === "number").map(([k, v]) => [k, v.bpm as number]))
  } catch {
    return {}
  }
}
