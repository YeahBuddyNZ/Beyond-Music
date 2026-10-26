// The player's and the remote's decisions (beyond_music/web/src/lib/pure.js), and the rule that only api.ts talks to the box.
import test from "node:test"
import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { clock, counts, findIn, groupVideos, howLong, nearest, nextPosition, previousPosition, remoteKey, shuffleOrder } from "../beyond_music/web/src/lib/pure.js"

test("times read the way people say them", () => {
  assert.equal(clock(187), "3:07")
  assert.equal(clock(3765), "1:02:45")
  assert.equal(clock(NaN), "0:00")
  assert.equal(howLong(20), "under a minute")
  assert.equal(howLong(60), "1 minute")
  assert.equal(howLong(3900), "1 hour 5 minutes")
})

test("shuffle keeps the song playing first and plays everything once", () => {
  const order = shuffleOrder(10, 4)
  assert.equal(order[0], 4)
  assert.deepEqual([...order].sort((a, b) => a - b), [...Array(10).keys()])
  assert.deepEqual(shuffleOrder(0), [])
})

test("next, previous and repeat", () => {
  assert.equal(nextPosition(2, 5, "off"), 3)
  assert.equal(nextPosition(4, 5, "off"), -1)
  assert.equal(nextPosition(4, 5, "all"), 0)
  assert.equal(nextPosition(2, 5, "one", true), 2)
  assert.equal(nextPosition(2, 5, "one", false), 3, "pressing Next still moves on")
  assert.deepEqual(previousPosition(3, 10, 5), { restart: true, pos: 3 })
  assert.deepEqual(previousPosition(3, 1, 5), { restart: false, pos: 2 })
  assert.deepEqual(previousPosition(0, 1, 5), { restart: true, pos: 0 })
})

test("a song counts as played after half of it or four minutes", () => {
  assert.ok(!counts(30, 200))
  assert.ok(counts(100, 200))
  assert.ok(counts(240, 3600))
  assert.ok(counts(30, 0))
})

test("the remote's arrows go to the nearest thing in that direction", () => {
  const from = { x: 0, y: 0, w: 100, h: 50 }
  const boxes = [
    { x: 120, y: 0, w: 100, h: 50 }, // right, in line
    { x: 110, y: 300, w: 100, h: 50 }, // right but far below
    { x: 0, y: 80, w: 100, h: 50 }, // below
    { x: -150, y: 0, w: 100, h: 50 }, // left
  ]
  assert.equal(nearest(from, boxes, "right"), 0)
  assert.equal(nearest(from, boxes, "down"), 2)
  assert.equal(nearest(from, boxes, "left"), 3)
  assert.equal(nearest(from, boxes, "up"), -1)
})

test("TV remotes' keys: LG, Samsung and Android TV", () => {
  assert.equal(remoteKey({ key: "", keyCode: 461 }), "back")
  assert.equal(remoteKey({ key: "", keyCode: 10009 }), "back")
  assert.equal(remoteKey({ key: "MediaPlayPause", keyCode: 179 }), "playpause")
  assert.equal(remoteKey({ key: "", keyCode: 415 }), "play")
  assert.equal(remoteKey({ key: "ArrowLeft", keyCode: 37 }), "left")
  assert.equal(remoteKey({ key: "a", keyCode: 65 }), undefined)
})

test("videos group into shows, films and home videos", () => {
  const g = groupVideos([
    { id: "1", kind: "episode", show: "B", season: 2, episode: 1, title: "x", ext: "mp4", size: 1, added: 1 },
    { id: "2", kind: "episode", show: "B", season: 1, episode: 2, title: "y", ext: "mp4", size: 1, added: 1 },
    { id: "3", kind: "film", title: "Zed", ext: "mp4", size: 1, added: 1 },
    { id: "4", kind: "film", title: "Alpha", ext: "mp4", size: 1, added: 1 },
    { id: "5", kind: "home", title: "old", ext: "mp4", size: 1, added: 1 },
    { id: "6", kind: "home", title: "new", ext: "mp4", size: 1, added: 9 },
  ])
  assert.deepEqual(g.shows[0].episodes.map((e) => e.id), ["2", "1"])
  assert.deepEqual(g.films.map((f) => f.title), ["Alpha", "Zed"])
  assert.deepEqual(g.home.map((h) => h.title), ["new", "old"])
})

test("search ignores macrons and case", () => {
  assert.ok(findIn("tui", ["Tūī Song"]))
  assert.ok(findIn("AROHA first", ["First Light", "Aroha Band"]))
  assert.ok(!findIn("", ["x"]))
})

test("only api.ts talks to the box", () => {
  const src = join(import.meta.dirname, "../beyond_music/web/src")
  const files = []
  const walk = (d) => readdirSync(d).forEach((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : files.push(join(d, f))))
  walk(src)
  for (const f of files.filter((f) => /\.(ts|tsx|js)$/.test(f) && !/api\.ts$|mock\.js$/.test(f))) {
    assert.ok(!/\bfetch\(|XMLHttpRequest|WebSocket\(/.test(readFileSync(f, "utf8")), `${f} must go through api.ts`)
  }
})

test("the preview's made-up library never ships in the box's build", () => {
  const api = readFileSync(join(import.meta.dirname, "../beyond_music/web/src/api.ts"), "utf8")
  assert.match(api, /import\.meta\.env\.MODE !== "box"/)
})
