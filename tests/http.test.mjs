// The real server on a spare port: the house-network guard, streaming with Range, covers and the Subsonic door.
import test from "node:test"
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { copyFileSync, mkdirSync, mkdtempSync } from "node:fs"
import { request } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"

const fx = (f) => join(import.meta.dirname, "fixtures", f)
const root = mkdtempSync(join(tmpdir(), "bm-http-"))
mkdirSync(join(root, "Music/Aroha Band/First Light"), { recursive: true })
copyFileSync(fx("song.mp3"), join(root, "Music/Aroha Band/First Light/02 Tui.mp3"))
copyFileSync(fx("plain.mp3"), join(root, "Music/Aroha Band/First Light/03 Morning.mp3"))
const PORT = 18000 + Math.floor(Math.random() * 2000)

const call = (path, { method = "GET", headers = {}, body } = {}) =>
  new Promise((done, fail) => {
    const req = request({ host: "127.0.0.1", port: PORT, path, method, headers: { host: `127.0.0.1:${PORT}`, ...headers } }, (res) => {
      const chunks = []
      res.on("data", (c) => chunks.push(c))
      res.on("end", () => done({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }))
    })
    req.on("error", fail)
    req.end(body)
  })
const json = async (...a) => JSON.parse((await call(...a)).body.toString())

let server
test.before(async () => {
  server = spawn(process.execPath, [join(import.meta.dirname, "../beyond_music/server/main.mjs")], {
    env: { ...process.env, PORT: String(PORT), HOME: root, BEYOND_MUSIC_DATA: join(root, "data"), BEYOND_MUSIC_FOLDERS: join(root, "Music"), BEYOND_MUSIC_MDNS: "0" },
    stdio: "ignore",
  })
  for (let i = 0; i < 50; i++) {
    try {
      const lib = await json("/api/library")
      if (!lib.scanning && lib.tracks.length) return
    } catch {}
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error("server didn't start")
})
test.after(() => server?.kill())

test("the library has the album, with no file paths in it", async () => {
  const res = await call("/api/library")
  const lib = JSON.parse(res.body.toString())
  assert.equal(lib.albums.length, 1)
  assert.equal(lib.tracks.length, 2)
  assert.ok(!res.body.toString().includes(root), "paths never leave the box")
})

test("songs stream with Range, and covers come from the file", async () => {
  const { tracks, albums } = await json("/api/library")
  const full = await call(`/api/play/${tracks[0].id}`)
  assert.equal(full.status, 200)
  const part = await call(`/api/play/${tracks[0].id}`, { headers: { range: "bytes=0-99" } })
  assert.equal(part.status, 206)
  assert.equal(part.body.length, 100)
  const cover = await call(`/api/cover/${albums[0].id}`)
  assert.equal(cover.status, 200)
  assert.match(cover.headers["content-type"], /image/)
  assert.equal((await call("/api/play/ffffffffffff")).status, 404)
  assert.equal((await call("/api/play/..%2F..%2Fetc%2Fpasswd")).status, 404)
})

test("a page from outside the house can't use it (DNS rebinding)", async () => {
  assert.equal((await call("/api/library", { headers: { host: "evil.example.com" } })).status, 403)
  const write = await call("/api/playlists", { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example.com" }, body: JSON.stringify({ name: "x", items: [] }) })
  assert.equal(write.status, 403)
  const form = await call("/api/playlists", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" })
  assert.ok(form.status >= 400, "writes need JSON, so a plain form can't post")
})

test("playlists save, and other apps only get in with the password", async () => {
  const { tracks } = await json("/api/library")
  const p = await json("/api/playlists", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Car songs", items: [tracks[0].id] }) })
  assert.equal(p.name, "Car songs")
  const off = await call("/rest/ping.view?u=household&p=x&f=json")
  assert.match(off.body.toString(), /Turn on/)
  const { on } = await json("/api/apps", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ on: true }) })
  assert.ok(on)
  const { password } = await json("/api/apps")
  const ok = JSON.parse((await call(`/rest/getAlbumList2.view?type=newest&u=household&p=${encodeURIComponent(password)}&f=json`)).body.toString())
  assert.equal(ok["subsonic-response"].status, "ok")
  assert.equal(ok["subsonic-response"].albumList2.album.length, 1)
  const bad = JSON.parse((await call("/rest/ping.view?u=household&p=wrong&f=json")).body.toString())
  assert.equal(bad["subsonic-response"].status, "failed")
})
