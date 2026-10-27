// Answers "where is beyond-music.local?" on the house network (multicast DNS), so phones, laptops and the TV
// can open http://beyond-music.local:8097 without anybody knowing the box's address. Best effort: if another
// program already owns the port, the box still works by its address.

import dgram from "node:dgram"
import { networkInterfaces } from "node:os"

const GROUP = "224.0.0.251"
const PORT = 5353

export function lanAddresses() {
  const out = []
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list || []) if (a.family === "IPv4" && !a.internal && isPrivate(a.address)) out.push(a.address)
  }
  return out
}

export function isPrivate(ip) {
  const v4 = String(ip).replace(/^::ffff:/, "")
  return (
    /^(10\.|127\.|192\.168\.|169\.254\.)/.test(v4) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(v4) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(v4) ||
    v4 === "::1" ||
    /^f[cd]/i.test(v4) ||
    /^fe80:/i.test(v4)
  )
}

// The names in a question, read from a DNS packet. Exported for the tests.
export function questions(buf) {
  if (buf.length < 12 || buf[2] & 0x80) return [] // answers, not questions
  const count = buf.readUInt16BE(4)
  const out = []
  let p = 12
  for (let q = 0; q < count && p < buf.length; q++) {
    const labels = []
    while (p < buf.length && buf[p] !== 0) {
      if ((buf[p] & 0xc0) === 0xc0) { p += 1; break }
      labels.push(buf.toString("utf8", p + 1, p + 1 + buf[p]))
      p += 1 + buf[p]
    }
    p += 1
    const type = buf.readUInt16BE(p)
    p += 4
    out.push({ name: labels.join(".").toLowerCase(), type })
  }
  return out
}

export function answer(name, ip, id = 0) {
  const labels = name.split(".")
  const parts = [Buffer.from([id >> 8, id & 255, 0x84, 0, 0, 0, 0, 1, 0, 0, 0, 0])]
  for (const l of labels) parts.push(Buffer.from([l.length]), Buffer.from(l))
  const tail = Buffer.alloc(15)
  tail[0] = 0
  tail.writeUInt16BE(1, 1) // A
  tail.writeUInt16BE(0x8001, 3) // IN, cache flush
  tail.writeUInt32BE(120, 5)
  tail.writeUInt16BE(4, 9)
  ip.split(".").forEach((n, i) => (tail[11 + i] = Number(n)))
  parts.push(tail)
  return Buffer.concat(parts)
}

// What to send back for a question, and where: nothing unless it asks for our name. Asked from any port but 5353
// (Beyond TV on Google TV asks like this), the answer goes straight back to the asker with its question's id, as
// multicast DNS says for a one-off question; otherwise to everybody on the group. Exported for the tests.
export function reply(msg, from, host, ip) {
  if (!ip || !questions(msg).some((q) => q.name === host && (q.type === 1 || q.type === 255))) return null
  if (from && from.port !== PORT && isPrivate(from.address)) return { packet: answer(host, ip, msg.readUInt16BE(0)), port: from.port, address: from.address }
  return { packet: answer(host, ip), port: PORT, address: GROUP }
}

export function advertise(host = "beyond-music.local", log = () => {}) {
  const sock = dgram.createSocket({ type: "udp4", reuseAddr: true })
  sock.on("error", (e) => {
    log(`Can't answer for ${host} (${e.code}); use the box's address instead.`)
    try { sock.close() } catch {}
  })
  sock.on("message", (msg, from) => {
    const r = reply(msg, from, host, lanAddresses()[0])
    if (r) sock.send(r.packet, r.port, r.address)
  })
  sock.bind(PORT, () => {
    try {
      sock.addMembership(GROUP)
      log(`Answering for ${host}`)
    } catch (e) {
      log(`Can't join multicast (${e.message})`)
    }
  })
  return sock
}
