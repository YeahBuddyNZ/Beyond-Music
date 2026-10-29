// Playlists onto a Pioneer USB stick (beyond_music/server/usb.mjs): what goes where, and a copy into a folder
// standing in for the stick.
import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile, readFile, stat, readdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createUsb, describe, planExport, safeName } from "../beyond_music/server/usb.mjs"

const song = (id, over = {}) => ({ id, title: `Song ${id}`, artist: "The Made-Up Band", albumArtist: "The Made-Up Band", album: "Pretend Summer", track: Number(id.slice(-1)), ext: "mp3", added: Date.UTC(2026, 9, 29), path: `/music/Pretend Summer/${id}.mp3`, ...over })

test("names a stick takes", () => {
  assert.equal(safeName('AC/DC: "Live"?'), "AC DC Live")
  assert.equal(safeName("Trailing dots..."), "Trailing dots")
  assert.equal(safeName("   "), "Unknown")
  assert.equal(safeName("Tūī"), "Tūī")
  assert.ok(safeName("x".repeat(300)).length <= 80)
})

test("what goes on the stick: each song once, players' kinds only, in playlist order", () => {
  const tracks = [song("aaaaaaaaaaa1"), song("aaaaaaaaaaa2", { genre: "House" }), song("aaaaaaaaaaa3", { ext: "ogg", path: "/music/x.ogg" }), song("aaaaaaaaaaa4", { artist: "Guest", album: "Other" })]
  const plan = planExport({
    tracks,
    playlists: [
      { name: "Warm up", items: ["aaaaaaaaaaa2", "aaaaaaaaaaa1", "aaaaaaaaaaa3", "gone00000000"] },
      { name: "Late", items: ["aaaaaaaaaaa1", "aaaaaaaaaaa4"] },
    ],
    tempo: { aaaaaaaaaaa1: 126.4, aaaaaaaaaaa2: "nonsense" },
  })
  assert.equal(plan.songs.length, 3, "an Ogg file can't go, and a song in two playlists goes once")
  assert.deepEqual(plan.skipped.map((s) => s.ext), ["ogg"])
  assert.equal(plan.songs[0].rel, "Contents/The Made-Up Band/Pretend Summer/aaaaaaaaaaa2.mp3")
  assert.equal(plan.songs.find((s) => s.from.endsWith("1.mp3")).bpm, 126.4)
  assert.equal(plan.songs[0].bpm, 0, "a tempo that isn't a number isn't used")
  assert.deepEqual(plan.playlists.map((p) => [p.name, p.trackIds]), [["Warm up", [1, 2]], ["Late", [2, 3]]])
  assert.equal(plan.genres.length, 1)
  assert.equal(plan.artists.length, 2)
  assert.equal(plan.songs[0].dateAdded, "2026-10-29")
})

test("two songs with one file name both survive", () => {
  const plan = planExport({ tracks: [song("bbbbbbbbbbb1", { path: "/a/01.mp3" }), song("bbbbbbbbbbb2", { path: "/b/01.mp3" })], playlists: [{ name: "P", items: ["bbbbbbbbbbb1", "bbbbbbbbbbb2"] }] })
  assert.deepEqual(plan.songs.map((s) => s.rel.split("/").pop()), ["01.mp3", "01 2.mp3"])
})

async function waitDone(usb) {
  for (let i = 0; i < 200 && usb.status().state === "copying"; i++) await new Promise((r) => setTimeout(r, 10))
  return usb.status()
}

test("a copy onto a stick, then a second one that takes away what's no longer chosen", async () => {
  const box = await mkdtemp(join(tmpdir(), "bm-box-"))
  const stick = await mkdtemp(join(tmpdir(), "bm-stick-"))
  const tracks = []
  for (const n of [1, 2, 3]) {
    const path = join(box, `${n}.mp3`)
    await writeFile(path, Buffer.alloc(1000 * n, n))
    tracks.push(song(`ccccccccccc${n}`, { path }))
  }
  await writeFile(join(stick, "my own notes.txt"), "keep me")
  const usb = createUsb({ list: async () => [await describe(stick, "TEST STICK")] })
  await usb.run(stick, planExport({ tracks, playlists: [{ name: "All", items: tracks.map((t) => t.id) }] }))
  assert.equal((await waitDone(usb)).state, "done")
  const pdb = await readFile(join(stick, "PIONEER/rekordbox/export.pdb"))
  assert.equal(pdb.readUInt32LE(4), 4096)
  assert.equal((await stat(join(stick, "Contents/The Made-Up Band/Pretend Summer/3.mp3"))).size, 3000)

  await usb.run(stick, planExport({ tracks, playlists: [{ name: "Two", items: [tracks[1].id] }] }))
  assert.equal((await waitDone(usb)).state, "done")
  assert.deepEqual((await readdir(join(stick, "Contents/The Made-Up Band/Pretend Summer"))).sort(), ["2.mp3"])
  assert.equal(await readFile(join(stick, "my own notes.txt"), "utf8"), "keep me", "nothing of theirs is touched")
})

test("a stick rekordbox made is asked about, and its library kept", async () => {
  const box = await mkdtemp(join(tmpdir(), "bm-box-"))
  const stick = await mkdtemp(join(tmpdir(), "bm-stick-"))
  await mkdir(join(stick, "PIONEER/rekordbox"), { recursive: true })
  await writeFile(join(stick, "PIONEER/rekordbox/export.pdb"), "theirs")
  const path = join(box, "1.mp3")
  await writeFile(path, "x")
  const plan = planExport({ tracks: [song("ddddddddddd1", { path })], playlists: [{ name: "P", items: ["ddddddddddd1"] }] })
  const usb = createUsb({ list: async () => [await describe(stick, "DJ STICK")] })
  await assert.rejects(usb.run(stick, plan), /rekordbox library/)
  await usb.run(stick, plan, { replace: true })
  assert.equal((await waitDone(usb)).state, "done")
  assert.equal(await readFile(join(stick, "PIONEER/rekordbox/export.pdb.rekordbox-backup"), "utf8"), "theirs")
})

test("a stick that isn't plugged in, or nothing to copy, says so", async () => {
  const usb = createUsb({ list: async () => [] })
  await assert.rejects(usb.run("/nowhere", { songs: [], skipped: [] }), /isn't plugged in/)
})
