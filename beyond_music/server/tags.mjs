// Reads what a music file says about itself: title, artist, album, track, year, length and its cover.
// MP3 (ID3v2 and ID3v1), FLAC, M4A/MP4 and Ogg (Vorbis and Opus), with no packages. Anything it can't read
// comes back empty, and the library falls back to the folder names (Artist/Album/01 Title.flac).

import { open } from "node:fs/promises"

async function readAt(fh, pos, len) {
  const buf = Buffer.alloc(len)
  const { bytesRead } = await fh.read(buf, 0, len, pos)
  return buf.subarray(0, bytesRead)
}

const clean = (s) => (typeof s === "string" ? s.replace(/\0+$/g, "").replace(/\0/g, "/").trim() : "")
const num = (s) => {
  const n = parseInt(String(s || ""), 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}
const yearOf = (s) => {
  const m = /(\d{4})/.exec(String(s || ""))
  return m ? Number(m[1]) : undefined
}

// ---------- ID3v2 ----------

const syncsafe = (b, o) => (b[o] << 21) | (b[o + 1] << 14) | (b[o + 2] << 7) | b[o + 3]

function id3Text(frame) {
  const enc = frame[0]
  const body = frame.subarray(1)
  if (enc === 0) return body.toString("latin1")
  if (enc === 3) return body.toString("utf8")
  if (enc === 1 || enc === 2) {
    let b = body
    let le = enc === 1
    if (b[0] === 0xff && b[1] === 0xfe) { le = true; b = b.subarray(2) }
    else if (b[0] === 0xfe && b[1] === 0xff) { le = false; b = b.subarray(2) }
    if (!le) {
      const swapped = Buffer.from(b)
      for (let i = 0; i + 1 < swapped.length; i += 2) [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]]
      b = swapped
    }
    return b.toString("utf16le")
  }
  return ""
}

function id3Picture(frame, v2) {
  // APIC: encoding, mime\0, picture type, description\0, data. v2.2 PIC has a 3-letter format instead of a mime.
  const enc = frame[0]
  let i = 1
  let mime
  if (v2) {
    mime = frame.subarray(1, 4).toString("latin1").toLowerCase() === "png" ? "image/png" : "image/jpeg"
    i = 4
  } else {
    const end = frame.indexOf(0, 1)
    if (end < 0) return
    mime = frame.subarray(1, end).toString("latin1") || "image/jpeg"
    i = end + 1
  }
  i += 1 // picture type
  if (enc === 1 || enc === 2) {
    while (i + 1 < frame.length && !(frame[i] === 0 && frame[i + 1] === 0)) i += 2
    i += 2
  } else {
    while (i < frame.length && frame[i] !== 0) i++
    i += 1
  }
  if (!mime.includes("/")) mime = "image/" + mime.toLowerCase().replace("jpg", "jpeg")
  return { mime, data: frame.subarray(i) }
}

export function parseId3v2(buf) {
  if (buf.length < 10 || buf.toString("latin1", 0, 3) !== "ID3") return
  const major = buf[3]
  const flags = buf[5]
  const size = syncsafe(buf, 6)
  const end = Math.min(10 + size, buf.length)
  let p = 10
  if (flags & 0x40 && major >= 3) p += major === 4 ? syncsafe(buf, p) : buf.readUInt32BE(p) + 4
  const out = {}
  const v2 = major === 2
  while (p + (v2 ? 6 : 10) <= end) {
    const id = buf.toString("latin1", p, p + (v2 ? 3 : 4))
    if (!/^[A-Z0-9]{3,4}$/.test(id)) break
    let len
    if (v2) len = (buf[p + 3] << 16) | (buf[p + 4] << 8) | buf[p + 5]
    else len = major === 4 ? syncsafe(buf, p + 4) : buf.readUInt32BE(p + 4)
    const start = p + (v2 ? 6 : 10)
    if (len <= 0 || start + len > end) break
    const frame = buf.subarray(start, start + len)
    const key = id.slice(0, 3) === "PIC" || id === "APIC" ? "pic" : id
    if (key === "pic") {
      if (!out.picture) out.picture = id3Picture(frame, v2)
    } else if (id[0] === "T") {
      out[id] = clean(id3Text(frame))
    }
    p = start + len
  }
  const t = (a, b) => out[a] || out[b] || ""
  return {
    title: t("TIT2", "TT2"),
    artist: t("TPE1", "TP1"),
    albumArtist: t("TPE2", "TP2"),
    album: t("TALB", "TAL"),
    track: num(t("TRCK", "TRK")),
    disc: num(t("TPOS", "TPA")),
    year: yearOf(t("TDRC", "TYER") || out.TYE || out.TDOR),
    genre: clean(t("TCON", "TCO")).replace(/^\(\d+\)/, ""),
    duration: num(out.TLEN) ? Math.round(num(out.TLEN) / 1000) : undefined,
    picture: out.picture,
    headerSize: 10 + size,
  }
}

export function parseId3v1(buf) {
  if (buf.length < 128 || buf.toString("latin1", 0, 3) !== "TAG") return
  const s = (a, b) => clean(buf.toString("latin1", a, b))
  return { title: s(3, 33), artist: s(33, 63), album: s(63, 93), year: yearOf(s(93, 97)), track: buf[125] === 0 && buf[126] ? buf[126] : undefined }
}

// MP3 length: the Xing/Info or VBRI header when there is one, else the first frame's bit rate over the file size.
const BITRATES = {
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
}
const RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] }

export function mp3Duration(buf, audioBytes) {
  for (let i = 0; i + 4 < buf.length && i < 65536; i++) {
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) continue
    const ver = (buf[i + 1] >> 3) & 3
    const layer = (buf[i + 1] >> 1) & 3
    const bri = buf[i + 2] >> 4
    const sri = (buf[i + 2] >> 2) & 3
    if (ver === 1 || layer !== 1 || bri === 0 || bri === 15 || sri === 3) continue
    const rate = RATES[ver][sri]
    const kbps = BITRATES[ver === 3 ? 1 : 2][bri]
    const mono = (buf[i + 3] >> 6) === 3
    const perFrame = ver === 3 ? 1152 : 576
    const side = ver === 3 ? (mono ? 17 : 32) : mono ? 9 : 17
    const x = i + 4 + side
    const tag = buf.toString("latin1", x, x + 4)
    if ((tag === "Xing" || tag === "Info") && buf[x + 7] & 1) return Math.round((buf.readUInt32BE(x + 8) * perFrame) / rate)
    if (buf.toString("latin1", i + 36, i + 40) === "VBRI") return Math.round((buf.readUInt32BE(i + 36 + 14) * perFrame) / rate)
    return Math.round((audioBytes * 8) / (kbps * 1000))
  }
}

// ---------- Vorbis comments (FLAC and Ogg) ----------

export function parseVorbisComment(buf) {
  let p = 0
  const vendor = buf.readUInt32LE(p)
  p += 4 + vendor
  const n = buf.readUInt32LE(p)
  p += 4
  const tags = {}
  let picture
  for (let k = 0; k < n && p + 4 <= buf.length; k++) {
    const len = buf.readUInt32LE(p)
    p += 4
    const s = buf.toString("utf8", p, p + len)
    p += len
    const eq = s.indexOf("=")
    if (eq < 0) continue
    const key = s.slice(0, eq).toUpperCase()
    const val = s.slice(eq + 1)
    if (key === "METADATA_BLOCK_PICTURE") {
      if (!picture) picture = parseFlacPicture(Buffer.from(val, "base64"))
    } else if (!(key in tags)) tags[key] = val.trim()
  }
  return { tags, picture }
}

function parseFlacPicture(b) {
  let p = 4
  const ml = b.readUInt32BE(p)
  const mime = b.toString("latin1", p + 4, p + 4 + ml)
  p += 4 + ml
  const dl = b.readUInt32BE(p)
  p += 4 + dl + 16
  const len = b.readUInt32BE(p)
  return { mime: mime || "image/jpeg", data: b.subarray(p + 4, p + 4 + len) }
}

function fromVorbis({ tags, picture }) {
  return {
    title: tags.TITLE || "",
    artist: tags.ARTIST || "",
    albumArtist: tags.ALBUMARTIST || tags["ALBUM ARTIST"] || "",
    album: tags.ALBUM || "",
    track: num(tags.TRACKNUMBER),
    disc: num(tags.DISCNUMBER),
    year: yearOf(tags.DATE || tags.YEAR || tags.ORIGINALDATE),
    genre: tags.GENRE || "",
    picture,
  }
}

async function readFlac(fh, size) {
  let p = 4
  const out = {}
  for (let guard = 0; guard < 64 && p + 4 <= size; guard++) {
    const h = await readAt(fh, p, 4)
    if (h.length < 4) break
    const last = h[0] & 0x80
    const type = h[0] & 0x7f
    const len = (h[1] << 16) | (h[2] << 8) | h[3]
    if (type === 0) {
      const b = await readAt(fh, p + 4, 18)
      const rate = (b[10] << 12) | (b[11] << 4) | (b[12] >> 4)
      const samples = (b[13] & 0x0f) * 2 ** 32 + b.readUInt32BE(14)
      if (rate) out.duration = Math.round(samples / rate)
    } else if (type === 4 && len < 4e6) {
      Object.assign(out, pick(fromVorbis(parseVorbisComment(await readAt(fh, p + 4, len)))))
    } else if (type === 6 && len < 16e6 && !out.picture) {
      out.picture = parseFlacPicture(await readAt(fh, p + 4, len))
    }
    p += 4 + len
    if (last) break
  }
  return out
}

// ---------- Ogg ----------

async function readOgg(fh, size) {
  const head = await readAt(fh, 0, Math.min(size, 1 << 20))
  // Join the payloads of the first pages to find the comment header.
  let p = 0
  const parts = []
  let rate = 0
  let opus = false
  while (p + 27 < head.length && parts.length < 40) {
    if (head.toString("latin1", p, p + 4) !== "OggS") break
    const segs = head[p + 26]
    let len = 0
    for (let i = 0; i < segs; i++) len += head[p + 27 + i]
    parts.push(head.subarray(p + 27 + segs, p + 27 + segs + len))
    p += 27 + segs + len
  }
  const data = Buffer.concat(parts)
  let out = {}
  if (data.toString("latin1", 1, 7) === "vorbis") rate = data.readUInt32LE(12)
  if (data.toString("latin1", 0, 8) === "OpusHead") { opus = true; rate = 48000 }
  const vc = data.indexOf(Buffer.from([3, 0x76, 0x6f, 0x72, 0x62, 0x69, 0x73])) // \x03vorbis
  const ot = data.indexOf(Buffer.from("OpusTags"))
  try {
    if (vc >= 0) out = fromVorbis(parseVorbisComment(data.subarray(vc + 7)))
    else if (ot >= 0) out = fromVorbis(parseVorbisComment(data.subarray(ot + 8)))
  } catch {}
  // Length: the last page's granule position.
  const tail = await readAt(fh, Math.max(0, size - 65536), Math.min(size, 65536))
  const last = tail.lastIndexOf("OggS")
  if (last >= 0 && rate) {
    const g = Number(tail.readBigUInt64LE(last + 6))
    out.duration = Math.round((g - (opus ? 312 : 0)) / rate)
  }
  return out
}

// ---------- MP4 / M4A ----------

async function* atoms(fh, start, end) {
  let p = start
  while (p + 8 <= end) {
    const h = await readAt(fh, p, 16)
    if (h.length < 8) return
    let size = h.readUInt32BE(0)
    const type = h.toString("latin1", 4, 8)
    let header = 8
    if (size === 1) { size = Number(h.readBigUInt64BE(8)); header = 16 }
    else if (size === 0) size = end - p
    if (size < header) return
    yield { type, start: p + header, end: p + size }
    p += size
  }
}

async function find(fh, start, end, path) {
  for await (const a of atoms(fh, start, end)) {
    if (a.type !== path[0]) continue
    if (path.length === 1) return a
    const skip = a.type === "meta" ? 4 : 0
    return find(fh, a.start + skip, a.end, path.slice(1))
  }
}

async function readMp4(fh, size) {
  const moov = await find(fh, 0, size, ["moov"])
  if (!moov) return {}
  const out = {}
  const mvhd = await find(fh, moov.start, moov.end, ["mvhd"])
  if (mvhd) {
    const b = await readAt(fh, mvhd.start, 32)
    const v1 = b[0] === 1
    const scale = v1 ? b.readUInt32BE(20) : b.readUInt32BE(12)
    const dur = v1 ? Number(b.readBigUInt64BE(24)) : b.readUInt32BE(16)
    if (scale) out.duration = Math.round(dur / scale)
  }
  const ilst = await find(fh, moov.start, moov.end, ["udta", "meta", "ilst"])
  if (!ilst || ilst.end - ilst.start > 32e6) return out
  for await (const item of atoms(fh, ilst.start, ilst.end)) {
    const data = await find(fh, item.start, item.end, ["data"])
    if (!data) continue
    const b = await readAt(fh, data.start, data.end - data.start)
    const kind = b.readUInt32BE(0) & 0xffffff
    const v = b.subarray(8)
    const text = () => clean(v.toString("utf8"))
    switch (item.type) {
      case "\xa9nam": out.title = text(); break
      case "\xa9ART": out.artist = text(); break
      case "aART": out.albumArtist = text(); break
      case "\xa9alb": out.album = text(); break
      case "\xa9day": out.year = yearOf(text()); break
      case "\xa9gen": out.genre = text(); break
      case "trkn": out.track = v.length >= 4 ? v.readUInt16BE(2) || undefined : undefined; break
      case "disk": out.disc = v.length >= 4 ? v.readUInt16BE(2) || undefined : undefined; break
      case "covr": out.picture = { mime: kind === 14 ? "image/png" : "image/jpeg", data: Buffer.from(v) }; break
    }
  }
  return out
}

// ---------- the one entry point ----------

export async function readTags(file, size) {
  const fh = await open(file, "r")
  try {
    const head = await readAt(fh, 0, Math.min(size, 256 * 1024))
    const magic = head.toString("latin1", 0, 4)
    if (magic === "fLaC") return await readFlac(fh, size)
    if (magic === "OggS") return await readOgg(fh, size)
    if (head.toString("latin1", 4, 8) === "ftyp") return await readMp4(fh, size)
    if (magic.startsWith("ID3") || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0)) {
      let id3
      let body = head
      if (magic.startsWith("ID3")) {
        const want = 10 + syncsafe(head, 6)
        const buf = want > head.length && want < 32e6 ? await readAt(fh, 0, want + 4096) : head
        id3 = parseId3v2(buf)
        // FLAC with an ID3 tag in front of it.
        const after = await readAt(fh, id3?.headerSize || 0, 4096)
        if (after.toString("latin1", 0, 4) === "fLaC") return { ...(await readFlac(fh, size)), ...pick(id3) }
        body = after
      }
      const v1 = !id3 || !id3.title ? parseId3v1(await readAt(fh, size - 128, 128)) : undefined
      const out = { ...(v1 || {}), ...pick(id3 || {}) }
      if (!out.duration) out.duration = mp3Duration(body, size - (id3?.headerSize || 0))
      return out
    }
    return {}
  } finally {
    await fh.close()
  }
}

// Keep only the values that were really there, so a blank ID3 field never wipes a better one.
function pick(t) {
  const out = {}
  for (const [k, v] of Object.entries(t)) if (v !== undefined && v !== "" && k !== "headerSize") out[k] = v
  return out
}
