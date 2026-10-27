// Copying a CD: put the disc in any USB CD drive on the box and press Copy this CD. Only CDs: the law allows copying
// music you own, not films (docs/law.md).
//
// On a Mac nothing needs installing: macOS mounts an audio CD as a folder of AIFF tracks, `afconvert` (part of
// macOS) turns each into Apple Lossless, MusicBrainz names the album from the disc's table of contents and the
// Cover Art Archive gives the cover. Elsewhere (a Raspberry Pi, a Linux box) abcde does the work (cdparanoia to read
// it, MusicBrainz for the names, FLAC so nothing is lost). Either way the copies go into the box's own "Copied CDs"
// folder and the disc comes out. Neither has been run on a real drive yet: the first CD is its first test.

import { spawn, execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { writeFile, mkdir, readdir, rename, unlink } from "node:fs/promises"
import { join } from "node:path"
import { platform } from "node:os"
import { tocFromPlist, lookupUrl, albumFrom, copyPlan, trackFiles } from "./disc.mjs"

const DRIVES = ["/dev/cdrom", "/dev/sr0", "/dev/sr1"]
const MAC = platform() === "darwin"
const AGENT = "BeyondMusic/0.2 (https://gobeyond.nz/music)"

const run = (cmd, args) =>
  new Promise((ok, fail) => execFile(cmd, args, { maxBuffer: 4 << 20 }, (err, out) => (err ? fail(err) : ok(out))))
const has = (cmd) => new Promise((ok) => execFile("sh", ["-c", `command -v ${cmd}`], (err) => ok(!err)))

// The audio CD in the Mac's drive, if there is one: a volume holding a .TOC.plist.
async function macDisc() {
  const vols = await readdir("/Volumes").catch(() => [])
  for (const v of vols) {
    const path = join("/Volumes", v)
    if (existsSync(join(path, ".TOC.plist"))) return { path, name: v }
  }
  return null
}

async function lookup(toc) {
  try {
    const res = await fetch(lookupUrl(toc), { headers: { "user-agent": AGENT, accept: "application/json" }, signal: AbortSignal.timeout(10000) })
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

async function cover(releaseId, dir) {
  try {
    const res = await fetch(`https://coverartarchive.org/release/${releaseId}/front-500`, { headers: { "user-agent": AGENT }, signal: AbortSignal.timeout(15000) })
    if (res.ok) await writeFile(join(dir, "cover.jpg"), Buffer.from(await res.arrayBuffer()))
  } catch {}
}

const ENCODE = {
  afflac: (from, to) => run("afconvert", ["-f", "flac", "-d", "flac", from, to]),
  flac: (from, to) => run("flac", ["--silent", "--best", "-o", to, from]),
  alac: (from, to) => run("afconvert", ["-f", "m4af", "-d", "alac", from, to]),
}
const encode = (how, from, to) => ENCODE[how](from, to)

// The first way that works on this Mac, tried on the first track.
async function pickEncoder(from, to) {
  for (const how of ["afflac", "flac", "alac"]) {
    try {
      await encode(how, from, to)
      return how
    } catch {
      await unlink(to).catch(() => {})
    }
  }
  throw new Error("This Mac couldn't read the CD's tracks.")
}

export function createCd({ dataDir, ripsDir, onDone, log = () => {} }) {
  let job = null // { started, lines: [], done, ok }
  const say = (line) => {
    job.lines.push(String(line).slice(0, 200))
    if (job.lines.length > 40) job.lines.shift()
  }
  const finish = (ok) => {
    job.done = true
    job.ok = ok
    log(`CD copy finished (${ok ? "ok" : "failed"})`)
    if (ok) onDone()
  }

  async function status() {
    const last = job ? { started: job.started, done: job.done, ok: job.ok, line: job.lines[job.lines.length - 1] || "" } : null
    const copying = Boolean(job && !job.done)
    if (MAC) {
      const disc = await macDisc()
      const tools = await has("afconvert")
      // A Mac shows no drive until a disc is in it, so "no drive" here reads as "put a CD in".
      return { canCopy: Boolean(tools && disc), hasTools: tools, hasDrive: Boolean(disc), needsDisc: !disc, disc: disc?.name || null, copying, last }
    }
    const tools = (await has("abcde")) && (await has("cdparanoia")) && (await has("flac"))
    const drive = DRIVES.find((d) => existsSync(d))
    return { canCopy: Boolean(tools && drive), hasTools: tools, hasDrive: Boolean(drive), needsDisc: false, disc: null, copying, last }
  }

  async function copy() {
    if (job && !job.done) throw new Error("A CD is already being copied.")
    await mkdir(ripsDir, { recursive: true })
    if (MAC) {
      const disc = await macDisc()
      if (!disc) throw new Error("Put a CD in the drive first.")
      job = { started: Date.now(), lines: [], done: false, ok: false }
      copyOnMac(disc).then(
        () => finish(true),
        (err) => {
          say(err.message || "The copy stopped.")
          finish(false)
        },
      )
      return status()
    }
    return copyWithAbcde()
  }

  async function copyOnMac(disc) {
    say("Reading the CD")
    const plist = JSON.parse(await run("plutil", ["-convert", "json", "-o", "-", join(disc.path, ".TOC.plist")]))
    const toc = tocFromPlist(plist)
    const files = trackFiles(await readdir(disc.path))
    if (!files.length) throw new Error("That disc has no music tracks on it.")
    say("Finding the album's name")
    const album = toc ? albumFrom(await lookup(toc), files.length) : null
    say(album ? `${album.artist}, ${album.album}` : "No name found for this CD, so it's saved as Audio CD")
    const plan = copyPlan(album, files.length, new Date(), "flac")
    const dir = join(ripsDir, plan[0].dir)
    await mkdir(dir, { recursive: true })
    let how = null
    for (let i = 0; i < files.length; i++) {
      say(`Copying track ${i + 1} of ${files.length}`)
      const from = join(disc.path, files[i])
      const part = join(dir, plan[i].file) + ".part"
      if (!how) how = await pickEncoder(from, part) // the first track is copied while finding a way that works
      else
        await encode(how, from, part).catch(async (err) => {
          await unlink(part).catch(() => {})
          throw new Error(`Track ${i + 1} wouldn't read. Clean the disc and try again.`, { cause: err })
        })
      // FLAC: nothing lost, and every browser and TV plays it. Newer macOS writes it itself; otherwise the flac
      // tool from Homebrew; failing both, Apple Lossless, which Apple devices play but Chrome and Google TV don't.
      const out = join(dir, how === "alac" ? plan[i].file.replace(/\.flac$/, ".m4a") : plan[i].file)
      await rename(part, out)
    }
    if (album?.id) await cover(album.id, dir)
    await run("drutil", ["eject"]).catch(() => {})
    say(album ? `Copied ${album.album}` : `Copied ${files.length} tracks`)
    if (how === "alac") say("Saved as Apple Lossless. Add the flac tool (brew install flac) so Google TV and Chrome can play your next CD.")
  }

  async function copyWithAbcde() {
    const drive = DRIVES.find((d) => existsSync(d))
    if (!drive) throw new Error("Plug a CD drive into the box first.")
    const conf = join(dataDir, "abcde.conf")
    await writeFile(
      conf,
      [
        `OUTPUTDIR="${ripsDir}"`,
        "OUTPUTTYPE=flac",
        "CDDBMETHOD=musicbrainz",
        "PADTRACKS=y",
        "EJECTCD=y",
        "INTERACTIVE=n",
        "ACTIONS=cddb,read,encode,tag,move,clean",
        "OUTPUTFORMAT='${ARTISTFILE}/${ALBUMFILE}/${TRACKNUM} ${TRACKFILE}'",
        "VAOUTPUTFORMAT='Various artists/${ALBUMFILE}/${TRACKNUM} ${ARTISTFILE} - ${TRACKFILE}'",
        "mungefilename () { echo \"$@\" | sed -e 's/^\\.*//' -e 's/[\\/:*?\"<>|]/ /g'; }",
        "",
      ].join("\n"),
    )
    job = { started: Date.now(), lines: [], done: false, ok: false }
    const child = spawn("abcde", ["-N", "-c", conf, "-d", drive], { stdio: ["ignore", "pipe", "pipe"] })
    const take = (b) => {
      for (const line of String(b).split("\n").map((l) => l.trim()).filter(Boolean)) say(line)
    }
    child.stdout.on("data", take)
    child.stderr.on("data", take)
    child.on("close", (code) => finish(code === 0))
    return status()
  }

  return { status, copy }
}
