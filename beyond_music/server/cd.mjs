// Copying a CD: put the disc in a USB CD drive on the box and press Copy this CD. abcde does the work
// (cdparanoia to read it, MusicBrainz for the names, FLAC so nothing is lost), into the box's own "Copied CDs"
// folder, then the disc comes out. Only CDs: the law allows copying music you own, not films (docs/law.md).
// Not yet run on a real drive: the first CD is its first test.

import { spawn, execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { writeFile, mkdir } from "node:fs/promises"
import { join } from "node:path"

const DRIVES = ["/dev/cdrom", "/dev/sr0", "/dev/sr1"]

export function createCd({ dataDir, ripsDir, onDone, log = () => {} }) {
  let job = null // { started, lines: [], done, ok }
  const has = (cmd) =>
    new Promise((ok) => execFile("sh", ["-c", `command -v ${cmd}`], (err) => ok(!err)))

  async function status() {
    const tools = (await has("abcde")) && (await has("cdparanoia")) && (await has("flac"))
    const drive = DRIVES.find((d) => existsSync(d))
    return {
      canCopy: Boolean(tools && drive),
      hasTools: tools,
      hasDrive: Boolean(drive),
      copying: Boolean(job && !job.done),
      last: job ? { started: job.started, done: job.done, ok: job.ok, line: job.lines[job.lines.length - 1] || "" } : null,
    }
  }

  async function copy() {
    if (job && !job.done) throw new Error("A CD is already being copied.")
    const drive = DRIVES.find((d) => existsSync(d))
    if (!drive) throw new Error("Plug a CD drive into the box first.")
    await mkdir(ripsDir, { recursive: true })
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
      for (const line of String(b).split("\n").map((l) => l.trim()).filter(Boolean)) {
        job.lines.push(line.slice(0, 200))
        if (job.lines.length > 40) job.lines.shift()
      }
    }
    child.stdout.on("data", take)
    child.stderr.on("data", take)
    child.on("close", (code) => {
      job.done = true
      job.ok = code === 0
      log(`CD copy finished (${code})`)
      if (job.ok) onDone()
    })
    return status()
  }

  return { status, copy }
}
