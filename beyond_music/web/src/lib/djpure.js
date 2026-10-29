// DJ mode's decisions, in plain JavaScript so `node --test` runs them with no build: finding the beat, matching two
// songs, the crossfader, the platter and reading a MIDI controller. The sound itself is in dj.ts, the controller in midi.ts.

// How hard the music hits, about 86 times a second: the rise in loudness from one short slice to the next. Beats are
// where it jumps. Mono samples in, one number per hop out.
export function onsets(samples, hop = 512) {
  const n = Math.floor(samples.length / hop)
  const env = new Float32Array(n)
  let last = 0
  for (let f = 0; f < n; f++) {
    let e = 0
    for (let i = f * hop, end = i + hop; i < end; i++) e += samples[i] * samples[i]
    e = Math.sqrt(e / hop)
    env[f] = Math.max(0, e - last)
    last = e
  }
  return env
}

// The tempo and where the first beat falls, from onsets() at `rate` slices a second. Most dance music sits between
// 78 and 156 beats a minute, so a reading outside that is halved or doubled into it. null when there's no beat to find
// (a quiet track, or speech).
export function findTempo(env, rate, lo = 78, hi = 156) {
  if (env.length < rate * 8) return null
  const minLag = Math.floor((60 / 190) * rate)
  const maxLag = Math.ceil((60 / 60) * rate)
  let best = -1
  let bestLag = 0
  const score = new Float32Array(maxLag + 2)
  for (let lag = minLag; lag <= maxLag + 1; lag++) {
    let s = 0
    for (let i = lag; i < env.length; i++) s += env[i] * env[i - lag]
    score[lag] = s / (env.length - lag)
  }
  for (let lag = minLag; lag <= maxLag; lag++) {
    // A beat also echoes at twice its gap, so a tempo that lines up at both is the real one.
    const s = score[lag] + 0.5 * (lag * 2 <= maxLag + 1 ? score[lag * 2] : 0)
    if (s > best) {
      best = s
      bestLag = lag
    }
  }
  if (best <= 0) return null
  // Between two lags: the top of the curve through its neighbours.
  const a = score[bestLag - 1] || 0
  const b = score[bestLag]
  const c = score[bestLag + 1] || 0
  const shift = a - 2 * b + c ? (0.5 * (a - c)) / (a - 2 * b + c) : 0
  let bpm = (60 * rate) / (bestLag + Math.max(-0.5, Math.min(0.5, shift)))
  while (bpm < lo) bpm *= 2
  while (bpm > hi) bpm /= 2
  // Then the exact tempo and where the beats fall together: of the tempos close by, the one whose beats land on the
  // most onsets across the whole song. A small error adds up over five minutes, so this is what keeps a long mix in step.
  let bestBpm = bpm
  let bestOff = 0
  let bestSum = -1
  for (let t = bpm - 1.5; t <= bpm + 1.5; t += 0.05) {
    const period = (60 / t) * rate
    for (let o = 0; o < period; o += 0.5) {
      let sum = 0
      for (let x = o; x < env.length; x += period) sum += env[Math.round(x)] || 0
      if (sum > bestSum) {
        bestSum = sum
        bestOff = o
        bestBpm = t
      }
    }
  }
  bpm = bestBpm
  return { bpm: Math.round(bpm * 10) / 10, first: bestOff / rate }
}

// The tempo fader: -1 to 1 across a range (8% like a club deck, or 16% or 50%).
export const tempoRate = (fader, range = 0.08) => 1 + Math.max(-1, Math.min(1, fader)) * range

// Sync: the speed that brings this song's tempo to the other's, and the fader position that gives it. A gap too wide
// for the range widens it rather than leaving the songs apart.
export function syncTo(myBpm, theirBpm, theirRate, range) {
  const rate = (theirBpm * theirRate) / myBpm
  const ranges = [0.08, 0.16, 0.5]
  let r = range
  if (Math.abs(rate - 1) > r) r = ranges.find((x) => Math.abs(rate - 1) <= x) || 0.5
  const clamped = Math.max(1 - r, Math.min(1 + r, rate))
  return { rate: clamped, range: r, fader: (clamped - 1) / r }
}

// How far to move this song (in seconds of the song) so its beats land on the other's: the shortest way, forward or
// back, never more than half a beat.
export function phaseShift(myPos, myFirst, myBpm, theirPos, theirFirst, theirBpm) {
  const mine = (((myPos - myFirst) * myBpm) / 60) % 1
  const theirs = (((theirPos - theirFirst) * theirBpm) / 60) % 1
  let d = ((theirs - mine) % 1 + 1.5) % 1 - 0.5
  return (d * 60) / myBpm
}

// Beat number at a place in the song: whole beats since the first, for the counter on each deck.
export const beatAt = (pos, first, bpm) => Math.floor(((pos - first) * bpm) / 60)

// Where in the beat grid a loop of n beats starts, from the beat now playing.
export function loopFrom(pos, first, bpm, beats) {
  const period = 60 / bpm
  const start = first + Math.floor((pos - first) / period) * period
  return [Math.max(0, start), Math.max(0, start) + beats * period]
}

// The crossfader, -1 (all A) to 1 (all B). Smooth keeps the loudness even across the middle; Sharp cuts in fast like a
// scratch mixer, both sides full in the middle.
export function crossfade(x, curve = "smooth") {
  const t = (Math.max(-1, Math.min(1, x)) + 1) / 2
  if (curve === "sharp") return [Math.min(1, (1 - t) * 8), Math.min(1, t * 8)]
  return [Math.cos((t * Math.PI) / 2), Math.sin((t * Math.PI) / 2)]
}

// An EQ knob, 0 to 1, to decibels: the middle is flat, all the way down cuts that part out, all the way up adds 6.
export const eqDb = (v) => (v >= 0.5 ? (v - 0.5) * 12 : v <= 0.02 ? -40 : (0.5 - v) * -52)

// The platter turns at 33⅓ like a record. A hand moving it by `turn` radians in `dt` seconds plays at this speed
// (1 is normal, negative is backwards).
export const scratchRate = (turn, dt, rpm = 100 / 3) => (dt > 0 ? turn / (2 * Math.PI) / ((dt * rpm) / 60) : 0)

// The platter's angle, in degrees, a `pos` seconds into the song.
export const platterAngle = (pos, rpm = 100 / 3) => ((pos * rpm) / 60) * 360

// The smallest turn between two angles (radians), so crossing from just under π to just over -π reads as a small move.
export function turnBetween(a, b) {
  let d = b - a
  while (d > Math.PI) d -= 2 * Math.PI
  while (d < -Math.PI) d += 2 * Math.PI
  return d
}

// The loudest moment in each slice of the song, 0 to 1, for the waveform.
export function peaks(samples, buckets) {
  const out = new Float32Array(buckets)
  const size = samples.length / buckets
  let top = 0
  for (let b = 0; b < buckets; b++) {
    let m = 0
    for (let i = Math.floor(b * size), end = Math.floor((b + 1) * size); i < end; i++) {
      const v = samples[i] < 0 ? -samples[i] : samples[i]
      if (v > m) m = v
    }
    out[b] = m
    if (m > top) top = m
  }
  if (top > 0) for (let b = 0; b < buckets; b++) out[b] /= top
  return out
}

// A MIDI message, as a controller sends it: a button (note on or off), a knob or fader (control change) or a 14 bit
// pitch bend. Channels count from 1, the way controllers print them.
export function readMidi(data) {
  const [status, a = 0, b = 0] = data
  const kind = status & 0xf0
  const channel = (status & 0x0f) + 1
  if (kind === 0x90) return { type: "note", channel, number: a, value: b, down: b > 0 }
  if (kind === 0x80) return { type: "note", channel, number: a, value: 0, down: false }
  if (kind === 0xb0) return { type: "cc", channel, number: a, value: b }
  if (kind === 0xe0) return { type: "bend", channel, number: 0, value: ((b << 7) | a) / 16383 }
  return null
}

// The name a control is kept under in the saved mapping.
export const controlKey = (m) => `${m.type}:${m.channel}:${m.number}`

// A jog wheel or endless knob sends how far it turned, not where it is. Most (Pioneer, Numark, Hercules) count from 64;
// some send 1 for one step one way and 127 for one step the other.
export function jogSteps(value, style = "centred") {
  if (style === "twos") return value < 64 ? value : value - 128
  return value - 64
}

// Which way a jog sends its turns, from the first value it sent: near 64 means counting from 64.
export const jogStyle = (value) => (value > 32 && value < 96 ? "centred" : "twos")

// Everything a control can be set to do, in the words the Learn list shows.
export const DJ_ACTIONS = (() => {
  const list = [{ id: "xfader", label: "Crossfader", kind: "fader" }]
  for (const d of ["a", "b"]) {
    const D = d.toUpperCase()
    list.push(
      { id: `${d}.play`, label: `Deck ${D} play`, kind: "button" },
      { id: `${d}.cue`, label: `Deck ${D} cue`, kind: "button" },
      { id: `${d}.sync`, label: `Deck ${D} sync`, kind: "button" },
      { id: `${d}.jog`, label: `Deck ${D} jog wheel`, kind: "jog" },
      { id: `${d}.tempo`, label: `Deck ${D} tempo`, kind: "fader" },
      { id: `${d}.volume`, label: `Deck ${D} volume`, kind: "fader" },
      { id: `${d}.high`, label: `Deck ${D} high`, kind: "fader" },
      { id: `${d}.mid`, label: `Deck ${D} mid`, kind: "fader" },
      { id: `${d}.low`, label: `Deck ${D} low`, kind: "fader" },
      { id: `${d}.loop`, label: `Deck ${D} 4 beat loop`, kind: "button" },
      ...[1, 2, 3, 4].map((n) => ({ id: `${d}.hot${n}`, label: `Deck ${D} hot cue ${n}`, kind: "button" })),
    )
  }
  return list
})()
