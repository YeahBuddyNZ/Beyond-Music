export function onsets(samples: Float32Array, hop?: number): Float32Array
export function findTempo(env: Float32Array, rate: number, lo?: number, hi?: number): { bpm: number; first: number } | null
export function tempoRate(fader: number, range?: number): number
export function syncTo(myBpm: number, theirBpm: number, theirRate: number, range: number): { rate: number; range: number; fader: number }
export function phaseShift(myPos: number, myFirst: number, myBpm: number, theirPos: number, theirFirst: number, theirBpm: number): number
export function beatAt(pos: number, first: number, bpm: number): number
export function loopFrom(pos: number, first: number, bpm: number, beats: number): [number, number]
export function crossfade(x: number, curve?: "smooth" | "sharp"): [number, number]
export function eqDb(v: number): number
export function scratchRate(turn: number, dt: number, rpm?: number): number
export function platterAngle(pos: number, rpm?: number): number
export function turnBetween(a: number, b: number): number
export function peaks(samples: Float32Array, buckets: number): Float32Array
export type Midi = { type: "note" | "cc" | "bend"; channel: number; number: number; value: number; down?: boolean }
export function readMidi(data: ArrayLike<number>): Midi | null
export function controlKey(m: Midi): string
export function jogSteps(value: number, style?: "centred" | "twos"): number
export function jogStyle(value: number): "centred" | "twos"
export type DjAction = { id: string; label: string; kind: "button" | "fader" | "jog" }
export const DJ_ACTIONS: DjAction[]
