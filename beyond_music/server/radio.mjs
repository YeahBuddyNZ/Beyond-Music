// Live New Zealand radio: the stations Radio Browser (a free, open directory) lists for NZ, RNZ first.
// Each station's own stream plays on the TV or phone. Nothing is ever recorded (see docs/law.md).

const DIRECTORY = "https://all.api.radio-browser.info/json/stations/bycountrycodeexact/NZ?hidebroken=true&order=clickcount&reverse=true&limit=150"
const DAY = 24 * 3600 * 1000

let cache = { at: 0, stations: [] }

export function shapeStations(raw) {
  const seen = new Set()
  const out = []
  for (const s of Array.isArray(raw) ? raw : []) {
    const url = String(s.url_resolved || s.url || "")
    const name = String(s.name || "").replace(/\s+/g, " ").trim()
    if (!/^https?:\/\//.test(url) || !name) continue
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, "")
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      id: String(s.stationuuid || key).slice(0, 40),
      name: name.slice(0, 60),
      url,
      logo: /^https:\/\//.test(s.favicon || "") ? s.favicon : "",
      town: String(s.state || "").slice(0, 40),
      tags: String(s.tags || "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 3),
      rnz: /\brnz\b|radio new zealand/i.test(name),
    })
  }
  // RNZ first, then the order Radio Browser gave (most listened to).
  return [...out.filter((s) => s.rnz), ...out.filter((s) => !s.rnz)]
}

export async function stations(fetchImpl = fetch) {
  if (Date.now() - cache.at < DAY && cache.stations.length) return cache.stations
  try {
    const res = await fetchImpl(DIRECTORY, { headers: { "User-Agent": "BeyondMusic/1 (gobeyond.nz)" }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(String(res.status))
    cache = { at: Date.now(), stations: shapeStations(await res.json()) }
  } catch {
    // Keep what we had; with no internet there is no radio anyway.
  }
  return cache.stations
}
