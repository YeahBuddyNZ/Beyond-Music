// node --test tests/
import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, copyFileSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { readTags, parseId3v1 } from "../beyond_music/server/tags.mjs"
import { cameraDate, fromFileName, idOf, isCoverFile, matches, trackFrom, videoFrom } from "../beyond_music/server/names.mjs"
import { build, createLibrary } from "../beyond_music/server/library.mjs"
import { createStore } from "../beyond_music/server/store.mjs"
import { checkAuth, toXml } from "../beyond_music/server/subsonic.mjs"
import { answer, isPrivate, questions } from "../beyond_music/server/mdns.mjs"
import { shapeStations } from "../beyond_music/server/radio.mjs"
import { createHash } from "node:crypto"

const fx = (f) => join(import.meta.dirname, "fixtures", f)
const tags = (f) => readTags(fx(f), statSync(fx(f)).size)

test("tags come out of every kind of music file, covers and all", async () => {
  const mp3 = await tags("song.mp3")
  assert.equal(mp3.title, "Tūī Song")
  assert.equal(mp3.album, "First Light")
  assert.equal(mp3.track, 2)
  assert.equal(mp3.year, 2021)
  assert.equal(mp3.picture.mime, "image/jpeg")
  const flac = await tags("song.flac")
  assert.deepEqual([flac.title, flac.artist, flac.album, flac.track, flac.year], ["Kōwhai", "Nikau", "Spring", 3, 2019])
  assert.ok(flac.picture?.data.length > 100)
  const m4a = await tags("song.m4a")
  assert.deepEqual([m4a.title, m4a.artist, m4a.album, m4a.track], ["Harbour", "Moana", "Tides", 7])
  assert.ok(m4a.picture)
  assert.equal((await tags("song.ogg")).title, "Rain")
  assert.equal((await tags("song.opus")).title, "Sun")
  for (const [f, d] of [["song.mp3", 3], ["song.flac", 4], ["song.m4a", 5], ["song.ogg", 6], ["song.opus", 7], ["plain.mp3", 3]])
    assert.ok(Math.abs((await tags(f)).duration - d) <= 1, `${f} lasts about ${d}s`)
})

test("a file with no tags isn't a problem", async () => {
  const t = await tags("plain.mp3")
  assert.equal(t.title, undefined)
  assert.ok(!parseId3v1(Buffer.alloc(10)))
})

test("names fall back to the folders a person made", () => {
  assert.deepEqual(fromFileName("01 - Harbour.flac"), { track: 1, title: "Harbour" })
  assert.deepEqual(fromFileName("1-03 Song_Name.mp3"), { disc: 1, track: 3, title: "Song Name" })
  const t = trackFrom("Moana/2018 - Tides/03 Shells.flac")
  assert.deepEqual([t.artist, t.album, t.track, t.title, t.year], ["Moana", "Tides", 3, "Shells", 2018])
  const d = trackFrom("Moana/Tides/CD2/01 Drift.mp3")
  assert.deepEqual([d.artist, d.album, d.disc], ["Moana", "Tides", 2])
  assert.equal(trackFrom("x.mp3", { title: "T", album: "A", artist: "B" }).albumArtist, "B")
})

test("videos sort themselves into shows, films and home videos", () => {
  assert.deepEqual(videoFrom("Kiwi Kids/Kiwi.Kids.S01E02.The.Bush.mp4"), { kind: "episode", show: "Kiwi Kids", season: 1, episode: 2, title: "The Bush" })
  const s = videoFrom("Kiwi Kids/Season 2/03 The Mountain.mkv")
  assert.deepEqual([s.kind, s.show, s.season, s.episode, s.title], ["episode", "Kiwi Kids", 2, 3, "The Mountain"])
  assert.deepEqual(videoFrom("Films/Big Day Out (2019).mp4"), { kind: "film", title: "Big Day Out", year: 2019 })
  assert.equal(videoFrom("Phone/VID_20240101_120000.mp4").title, "01/01/2024, 12:00")
  assert.equal(videoFrom("Birthday party/clip.mov").kind, "home")
  assert.equal(cameraDate("PXL_20251314_000000"), "")
})

test("covers, ids and search", () => {
  assert.ok(isCoverFile("Album/cover.jpg"))
  assert.ok(isCoverFile("Album/Folder.PNG"))
  assert.ok(!isCoverFile("Album/back.jpg"))
  assert.match(idOf("a", "b"), /^[a-f0-9]{12}$/)
  assert.ok(matches("tui song", "Tūī Song", "Aroha Band"))
  assert.ok(!matches("tui rock", "Tūī Song"))
  assert.ok(!matches("", "anything"))
})

test("the library finds albums, covers and videos in real folders", async () => {
  const root = mkdtempSync(join(tmpdir(), "bm-"))
  const music = join(root, "Music")
  mkdirSync(join(music, "Aroha Band/First Light"), { recursive: true })
  mkdirSync(join(music, "Moana/Tides"), { recursive: true })
  mkdirSync(join(root, "Videos/Films"), { recursive: true })
  copyFileSync(fx("song.mp3"), join(music, "Aroha Band/First Light/02 Tui.mp3"))
  copyFileSync(fx("plain.mp3"), join(music, "Aroha Band/First Light/03 Morning.mp3"))
  copyFileSync(fx("plain.mp3"), join(music, "Moana/Tides/01 Harbour.mp3"))
  writeFileSync(join(music, "Moana/Tides/cover.jpg"), "jpg")
  copyFileSync(fx("clip.mp4"), join(root, "Videos/Films/Big Day Out (2019).mp4"))
  const lib = createLibrary({ dataDir: join(root, "data"), sources: () => [{ id: "m", path: music }, { id: "v", path: join(root, "Videos") }] })
  await lib.load()
  await lib.scan()
  const v = lib.view
  assert.equal(v.albums.length, 2)
  const first = v.albums.find((a) => a.title === "First Light")
  assert.equal(first.trackIds.length, 2)
  assert.ok(v.albums.find((a) => a.title === "Tides").hasCover)
  assert.equal(v.videos[0].title, "Big Day Out")
  assert.ok(v.where.get(first.trackIds[0]).startsWith(music))
  // A second look only rereads what changed.
  await lib.scan()
  assert.equal(lib.view.tracks.length, 3)
  assert.equal(build({ files: {} }).tracks.length, 0)
})

test("the store keeps playlists honest and makes an easy password", async () => {
  const store = await createStore(mkdtempSync(join(tmpdir(), "bm-")))
  assert.throws(() => store.savePlaylist({ name: " ", items: [] }), /name/)
  const p = store.savePlaylist({ name: "Car songs", items: ["abcdef123456", "../etc/passwd", 5] })
  assert.deepEqual(p.items, ["abcdef123456"])
  store.played("abcdef123456")
  store.played("nope")
  assert.equal(store.state.recent.length, 1)
  const pw = store.setApps(true)
  assert.match(pw, /^[a-z]+-[a-z]+-[a-z]+-\d{2}$/)
  assert.equal(store.setApps(true), pw)
  assert.equal(store.setApps(false), "")
  await assert.rejects(store.addPlace("/definitely/not/here"), /isn't there/)
})

test("other music apps sign in the Subsonic way", () => {
  const md5 = (s) => createHash("md5").update(s).digest("hex")
  const q = (o) => new URLSearchParams(o)
  assert.ok(checkAuth(q({ t: md5("kiwi-fern-tui-42" + "salt"), s: "salt" }), "kiwi-fern-tui-42"))
  assert.ok(checkAuth(q({ p: "enc:" + Buffer.from("pw").toString("hex") }), "pw"))
  assert.ok(checkAuth(q({ p: "pw" }), "pw"))
  assert.ok(!checkAuth(q({ p: "wrong" }), "pw"))
  assert.ok(!checkAuth(q({ p: "" }), ""), "turned off means nobody")
  assert.equal(toXml("a", { x: 1, b: [{ y: "<&\"" }] }), '<a x="1"><b y="&lt;&amp;&quot;"/></a>')
})

test("the box answers for beyond-music.local and only trusts the house network", () => {
  const q = Buffer.from([0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 12, ...Buffer.from("beyond-music"), 5, ...Buffer.from("local"), 0, 0, 1, 0, 1])
  assert.deepEqual(questions(q), [{ name: "beyond-music.local", type: 1 }])
  const a = answer("beyond-music.local", "192.168.1.20")
  assert.deepEqual([...a.subarray(a.length - 4)], [192, 168, 1, 20])
  assert.equal(questions(a).length, 0, "an answer isn't a question")
  for (const ip of ["192.168.1.2", "10.0.0.1", "172.20.1.1", "::ffff:192.168.0.5", "127.0.0.1", "fd00::1", "100.64.0.1"]) assert.ok(isPrivate(ip), ip)
  for (const ip of ["8.8.8.8", "172.32.0.1", "203.0.113.4"]) assert.ok(!isPrivate(ip), ip)
})

test("radio stations: RNZ first, no duplicates, only real streams", () => {
  const out = shapeStations([
    { name: "Harbour FM", url_resolved: "https://h.example/stream", stationuuid: "1", state: "Auckland", tags: "pop,hits" },
    { name: "Harbour  FM", url_resolved: "https://h2.example/stream" },
    { name: "RNZ National", url_resolved: "https://rnz.example/national" },
    { name: "Broken", url_resolved: "ftp://nope" },
    { name: "", url_resolved: "https://x.example" },
  ])
  assert.deepEqual(out.map((s) => s.name), ["RNZ National", "Harbour FM"])
  assert.deepEqual(out[1].tags, ["pop", "hits"])
  assert.deepEqual(shapeStations(null), [])
})
