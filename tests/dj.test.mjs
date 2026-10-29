// DJ mode's decisions (beyond_music/web/src/lib/djpure.js): finding the beat, sync, the crossfader, the platter, MIDI.
import test from "node:test"
import assert from "node:assert/strict"
import { beatAt, controlKey, crossfade, DJ_ACTIONS, eqDb, findTempo, jogSteps, jogStyle, loopFrom, onsets, peaks, phaseShift, platterAngle, readMidi, scratchRate, syncTo, tempoRate, turnBetween } from "../beyond_music/web/src/lib/djpure.js"

// A made-up beat: a short click every beat, over a little noise, starting `offset` seconds in.
function clicks(bpm, seconds, offset = 0, rate = 22050) {
  const out = new Float32Array(seconds * rate)
  let seed = 7
  for (let i = 0; i < out.length; i++) {
    seed = (seed * 16807) % 2147483647
    out[i] = ((seed / 2147483647) - 0.5) * 0.02
  }
  for (let t = offset; t < seconds; t += 60 / bpm) {
    const at = Math.round(t * rate)
    for (let i = 0; i < 200 && at + i < out.length; i++) out[at + i] += Math.sin(i * 0.6) * Math.exp(-i / 40)
  }
  return out
}

test("finds the tempo of a steady beat", () => {
  for (const bpm of [92, 120, 128, 140, 174]) {
    const rate = 22050
    const found = findTempo(onsets(clicks(bpm, 30, 0.25, rate), 512), rate / 512)
    assert.ok(found, `found a beat at ${bpm}`)
    // 174 drum and bass reads as 87, half time, which mixes the same.
    const want = bpm > 156 ? bpm / 2 : bpm
    assert.ok(Math.abs(found.bpm - want) < 1.5, `${bpm} read as ${found.bpm}`)
  }
})

test("finds where the first beat falls", () => {
  const rate = 22050
  const found = findTempo(onsets(clicks(120, 30, 0.3, rate), 512), rate / 512)
  const period = 60 / found.bpm
  const off = ((found.first - 0.3) % period + period) % period
  assert.ok(Math.min(off, period - off) < 0.03, `first beat at ${found.first}`)
})

test("silence and very short songs have no beat", () => {
  assert.equal(findTempo(new Float32Array(43 * 30), 43), null)
  assert.equal(findTempo(new Float32Array(10), 43), null)
})

test("the tempo fader and sync", () => {
  assert.equal(tempoRate(0), 1)
  assert.ok(Math.abs(tempoRate(1, 0.08) - 1.08) < 1e-9)
  assert.ok(Math.abs(tempoRate(-2, 0.08) - 0.92) < 1e-9, "never past the end of the fader")
  const r = syncTo(124, 128, 1, 0.08)
  assert.ok(Math.abs(124 * r.rate - 128) < 1e-9)
  assert.equal(r.range, 0.08)
  // 100 to 128 is 28% faster: the range widens rather than leaving them apart.
  const wide = syncTo(100, 128, 1, 0.08)
  assert.equal(wide.range, 0.5)
  assert.ok(Math.abs(100 * wide.rate - 128) < 1e-9)
})

test("sync moves the beats the shortest way, never more than half a beat", () => {
  // Both at 120: a beat is half a second. Mine is a quarter beat behind theirs.
  const shift = phaseShift(10.0, 0, 120, 10.125, 0, 120)
  assert.ok(Math.abs(shift - 0.125) < 1e-9)
  const back = phaseShift(10.4, 0, 120, 10.0, 0, 120)
  assert.ok(Math.abs(back - 0.1) < 1e-9, "0.4 of a beat ahead is 0.2 behind the next one")
  for (let i = 0; i < 50; i++) assert.ok(Math.abs(phaseShift(Math.random() * 99, 0.2, 126, Math.random() * 99, 0.1, 128)) <= 60 / 126 / 2 + 1e-9)
})

test("beats, bars and loops", () => {
  assert.equal(beatAt(0.25, 0.25, 120), 0)
  assert.equal(beatAt(2.3, 0.25, 120), 4)
  const [a, b] = loopFrom(10.2, 0, 120, 4)
  assert.equal(a, 10)
  assert.equal(b, 12)
})

test("the crossfader", () => {
  const [a, b] = crossfade(0)
  assert.ok(Math.abs(a * a + b * b - 1) < 1e-9, "smooth keeps the loudness even in the middle")
  assert.deepEqual(crossfade(-1).map((x) => Math.round(x * 1000) / 1000), [1, 0])
  assert.deepEqual(crossfade(1).map((x) => Math.round(x * 1000) / 1000), [0, 1])
  assert.deepEqual(crossfade(0, "sharp"), [1, 1])
  assert.equal(crossfade(-1, "sharp")[1], 0)
})

test("EQ: flat in the middle, cut at the bottom", () => {
  assert.equal(eqDb(0.5), 0)
  assert.equal(eqDb(1), 6)
  assert.equal(eqDb(0), -40)
  assert.ok(eqDb(0.25) < 0 && eqDb(0.25) > -40)
})

test("the platter turns like a record at 33⅓", () => {
  assert.ok(Math.abs(platterAngle(1.8) - 360) < 1e-9, "a turn takes 1.8 seconds")
  assert.ok(Math.abs(scratchRate(2 * Math.PI, 1.8) - 1) < 1e-9, "a hand moving it at the record's speed plays normally")
  assert.ok(scratchRate(-Math.PI, 0.9) < 0, "back is backwards")
  assert.equal(scratchRate(1, 0), 0)
  assert.ok(Math.abs(turnBetween(3.1, -3.1) - (2 * Math.PI - 6.2)) < 1e-9, "across the join is a small turn")
})

test("the waveform's peaks are 0 to 1", () => {
  const p = peaks(Float32Array.from([0, 0.5, -1, 0.25]), 2)
  assert.deepEqual([...p], [0.5, 1])
  assert.equal(peaks(new Float32Array(8), 4)[0], 0)
})

test("reads a controller's messages", () => {
  assert.deepEqual(readMidi([0x90, 11, 127]), { type: "note", channel: 1, number: 11, value: 127, down: true })
  assert.equal(readMidi([0x90, 11, 0]).down, false, "note on at 0 is letting go")
  assert.equal(readMidi([0x81, 11, 64]).down, false)
  assert.deepEqual(readMidi([0xb1, 33, 65]), { type: "cc", channel: 2, number: 33, value: 65 })
  assert.equal(readMidi([0xe0, 0x7f, 0x7f]).value, 1)
  assert.equal(readMidi([0xf8]), null, "clock ticks aren't controls")
  assert.equal(controlKey(readMidi([0xb0, 7, 1])), "cc:1:7")
})

test("jog wheels count from 64 or in steps of 1 and 127", () => {
  assert.equal(jogSteps(65), 1)
  assert.equal(jogSteps(62), -2)
  assert.equal(jogSteps(1, "twos"), 1)
  assert.equal(jogSteps(127, "twos"), -1)
  assert.equal(jogStyle(65), "centred")
  assert.equal(jogStyle(127), "twos")
})

test("every action has a name, and each name once", () => {
  const ids = DJ_ACTIONS.map((a) => a.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(ids.includes("a.jog") && ids.includes("b.play") && ids.includes("xfader"))
  for (const a of DJ_ACTIONS) assert.ok(a.label && ["button", "fader", "jog"].includes(a.kind))
})
