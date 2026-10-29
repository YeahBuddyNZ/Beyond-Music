// A Mac's own music (beyond_music/server/apple.mjs): iCloud's stand-in files, and the Music app's playlists.
import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { cloudName, iCloudDrive, matchPlaylists, placeName, readMusicLibrary, readPlist } from "../beyond_music/server/apple.mjs"
import { createLibrary } from "../beyond_music/server/library.mjs"
import { createStore } from "../beyond_music/server/store.mjs"

// The shape the Music app writes, with made-up songs.
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Major Version</key><integer>1</integer>
	<key>Tracks</key>
	<dict>
		<key>101</key>
		<dict>
			<key>Track ID</key><integer>101</integer>
			<key>Name</key><string>T&#363;&#299; Song</string>
			<key>Location</key><string>file:///Users/family/Music/Music/Media.localized/Music/Made%20Up/First%20Light/02%20T%C5%AB%C4%AB%20Song.mp3</string>
		</dict>
		<key>102</key>
		<dict>
			<key>Track ID</key><integer>102</integer>
			<key>Name</key><string>Rock &amp; Roll</string>
			<key>Location</key><string>file:///Users/family/Music/Elsewhere/song.m4a</string>
		</dict>
		<key>103</key>
		<dict>
			<key>Track ID</key><integer>103</integer>
			<key>Name</key><string>A subscription song</string>
			<key>Apple Music</key><true/>
			<key>Protected</key><true/>
		</dict>
	</dict>
	<key>Playlists</key>
	<array>
		<dict>
			<key>Name</key><string>Library</string>
			<key>Master</key><true/>
			<key>Playlist Items</key><array><dict><key>Track ID</key><integer>101</integer></dict></array>
		</dict>
		<dict>
			<key>Name</key><string>Music</string>
			<key>Distinguished Kind</key><integer>4</integer>
		</dict>
		<dict>
			<key>Name</key><string>Kids</string>
			<key>Folder</key><true/>
		</dict>
		<dict>
			<key>Name</key><string>Road trip</string>
			<key>Playlist Persistent ID</key><string>A1B2C3D4E5F60708</string>
			<key>Playlist Items</key>
			<array>
				<dict><key>Track ID</key><integer>101</integer></dict>
				<dict><key>Track ID</key><integer>102</integer></dict>
				<dict><key>Track ID</key><integer>103</integer></dict>
			</array>
		</dict>
		<dict>
			<key>Name</key><string>Empty one</string>
			<key>Playlist Persistent ID</key><string>FFFF</string>
		</dict>
	</array>
</dict>
</plist>`

test("reads Apple's property lists", () => {
  const p = readPlist(XML)
  assert.equal(p["Major Version"], 1)
  assert.equal(p.Tracks["101"].Name, "Tūī Song")
  assert.equal(p.Tracks["102"].Name, "Rock & Roll")
  assert.equal(p.Tracks["103"].Protected, true)
  assert.equal(p.Playlists.length, 5)
  assert.throws(() => readPlist("<html></html>"))
})

test("the Music app's own playlists come across, its built-in ones and folders don't", () => {
  const lib = readMusicLibrary(XML)
  assert.deepEqual(lib.playlists.map((p) => p.name), ["Road trip", "Empty one"])
  const trip = lib.playlists[0]
  assert.equal(trip.key, "A1B2C3D4E5F60708")
  assert.deepEqual(trip.paths, ["/Users/family/Music/Music/Media.localized/Music/Made Up/First Light/02 Tūī Song.mp3", "/Users/family/Music/Elsewhere/song.m4a"])
  assert.equal(trip.locked, 1, "an Apple Music song is counted, never played")
  assert.equal(lib.locked, 1)
})

test("songs are matched to the box's library by where they are, macrons and all", () => {
  const lib = readMusicLibrary(XML)
  // macOS hands back names with the macron as a separate mark; the XML has it joined. Both must match.
  const where = new Map([["aaaaaaaaaaaa", "/Users/family/Music/Music/Media.localized/Music/Made Up/First Light/02 Tūī Song.mp3"]])
  const m = matchPlaylists(lib, where)
  assert.deepEqual(m.playlists[0], { key: "A1B2C3D4E5F60708", name: "Road trip", items: ["aaaaaaaaaaaa"] })
  assert.equal(m.outside, 1, "the song outside the box's places is counted")
})

test("iCloud's stand-in files and the friendly names", () => {
  assert.equal(cloudName(".02 Tūī Song.mp3.icloud"), "02 Tūī Song.mp3")
  assert.equal(cloudName("song.mp3"), null)
  assert.equal(cloudName(".DS_Store"), null)
  assert.equal(placeName(iCloudDrive("/Users/family"), "/Users/family"), "iCloud Drive")
  assert.equal(placeName("/Users/family/Music/Music/Media.localized/Music", "/Users/family"), "Music app")
  assert.equal(placeName("/Volumes/Drive", "/Users/family"), null)
})

test("a scan counts songs still in iCloud, and the Music app's playlists follow it", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bm-icloud-"))
  const music = join(dir, "iCloud")
  mkdirSync(music)
  copyFileSync(join(import.meta.dirname, "fixtures", "song.mp3"), join(music, "here.mp3"))
  writeFileSync(join(music, ".away.mp3.icloud"), "")
  writeFileSync(join(music, ".notes.txt.icloud"), "")
  const store = await createStore(join(dir, "data"))
  let synced = null
  const library = createLibrary({
    dataDir: join(dir, "data"),
    sources: () => [{ id: "p1", name: "iCloud Drive", path: music }],
    onScanned: async (view) => {
      synced = store.syncAppPlaylists([{ key: "K1", name: "From the app", items: [...view.where.keys()] }])
    },
  })
  const view = await library.scan()
  assert.equal(view.tracks.length, 1)
  assert.deepEqual(library.cloud, { p1: 1 }, "only the song waiting in iCloud, not the text file")
  assert.equal(synced, 1)
  const fromApp = store.state.playlists.find((p) => p.app === "K1")
  assert.equal(fromApp.items.length, 1)
  assert.throws(() => store.savePlaylist({ name: "Mine now", items: [] }, fromApp.id), /Music app/)
  assert.throws(() => store.deletePlaylist(fromApp.id), /Music app/)
  // Made on the box: left alone when the Music app's list changes.
  const mine = store.savePlaylist({ name: "Ours", items: [] })
  store.syncAppPlaylists([])
  assert.deepEqual(store.state.playlists.map((p) => p.id), [mine.id], "a playlist taken away in the Music app goes, ours stays")
})
