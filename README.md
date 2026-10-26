# Beyond™ Music

**Your own music, videos and radio on every screen in the house.** Part of the Beyond™ tools, with Beyond™ TV, Beyond™
Home, Beyond™ Gateway and Beyond™ Family. *Free your world.*

Beyond Music turns a box you already have into the house's media centre: the Home Assistant box, a NAS, a mini PC, an
old laptop or a Raspberry Pi. No new hardware. Point it at the folders where your music and videos already live, and
every phone, computer and TV in the house can play them, like Spotify for the music you own and Plex for your own
videos.

## What it does now

- **Your music, by album, artist and playlist,** with covers, from MP3, FLAC, AAC/M4A, Ogg, Opus and WAV. Tags are read
  where they are; where they aren't, the folders (`Artist/Album/01 Song.flac`) fill in the gaps.
- **Plays anywhere in the house:** a phone, a laptop or the TV, in the browser at `http://beyond-music.local:8097`.
  Shuffle, repeat, play next, a queue, and the phone's lock screen and headphone buttons.
- **The TV remote drives it:** arrows move, OK presses, Back goes back, and play, pause and skip work. Everything is a
  size up and lit up so it reads from the couch.
- **Your videos:** shows sorted into seasons and episodes, films, and home videos dated from the phone or camera that
  took them. The next episode starts by itself.
- **New Zealand radio, live,** RNZ first, from the free Radio Browser directory.
- **Copy a CD** in full quality (FLAC) with a USB CD drive plugged into the box.
- **Playlists for the whole household.**
- **Other music apps and the car:** turn on *Other music apps* in Settings and apps like Symfonium (Android) and
  Amperfy (iPhone) play from the box as a "Subsonic" server, with Android Auto and CarPlay through them.

## On the way

- A **Music** button in Beyond TV that finds the box by itself.
- Bringing playlists across from Spotify, and watch history from Plex.
- Video that every TV can play (changing a file's format on the fly), and listening away from home.
- New Zealand artists first: picks from the family's own music.

## Keeping it fair

Beyond Music is built to stay inside New Zealand copyright law: play what the household owns or made, keep one copy per
device, keep the original, and never share outside the house. [docs/law.md](docs/law.md) has the lines the code holds
to. It never copies DVDs or Blu-rays, never downloads from torrent or sharing sites, never stores lyrics, and what you
play stays on the box.

## Put it on a box

**Home Assistant:** Settings, Add-ons, Add-on store, the three dots, *Repositories*, and add
`https://github.com/YeahBuddyNZ/Beyond-Music`. Install **Beyond Music**, start it, and open it from the side bar. Your
`/media` and `/share` folders are already in; add more under the app's *Configuration* or in Beyond Music's Settings.

**Docker** (a NAS, a mini PC):

```sh
docker build -t beyond-music .
docker run -d --name beyond-music --network host --restart unless-stopped \
  -v beyond-music:/data -v /path/to/your/Music:/music/Music:ro beyond-music
```

**Any computer with Node 22** (Mac, Windows, Linux, a Raspberry Pi):

```sh
cd beyond_music/web && npm ci && npm run build:box && cd ../..
node beyond_music/server/main.mjs
```

Then open `http://<the box's address>:8097`, or `http://beyond-music.local:8097`. Settings offers the usual music
folders on that box; add any others there.

### Copying CDs

Plug in a USB CD drive. The box needs `abcde`, `cdparanoia` and `flac` (`brew install abcde cdparanoia flac`, or
`sudo apt install abcde cdparanoia flac`); the Docker image has them. On Home Assistant, CD copying isn't there yet.
Copies go into *Copied CDs* in the box's data folder.

### Settings for the server

| | |
|---|---|
| `PORT` | 8097 |
| `BEYOND_MUSIC_DATA` | where it keeps its list and copies (`~/.beyond-music`, `/data` on Home Assistant) |
| `BEYOND_MUSIC_FOLDERS` | extra folders, comma separated |
| `BEYOND_MUSIC_MDNS=0` | don't answer for `beyond-music.local` |

## Privacy

The box only answers screens on the house network. Nothing goes to Beyond. What you play is kept on the box for
*Played recently* and nowhere else. The radio list comes from radio-browser.info, and each station streams from its own
website.

## For developers

`beyond_music/server` is plain Node with no packages. `beyond_music/web` is the app (React, Vite, Tailwind, ReUI);
`npm run dev` and open `http://localhost:5173/?preview` to see it with a made-up library, or `?preview&tv` for the TV
version. `sh tests/run.sh` runs every test. See `CLAUDE.md` and `docs/adr/`.

## Licence

GPL-3.0. Sora is under the SIL Open Font License.
