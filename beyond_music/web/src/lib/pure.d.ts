import type { Video } from "./types"
export function clock(seconds: number): string
export function howLong(seconds: number): string
export function plural(n: number, word: string, many?: string): string
export function shuffleOrder(n: number, current?: number, rand?: () => number): number[]
export function nextPosition(pos: number, length: number, repeat: "off" | "all" | "one", ended?: boolean): number
export function previousPosition(pos: number, time: number, length: number): { restart: boolean; pos: number }
export function counts(played: number, duration: number): boolean
export type Box = { x: number; y: number; w: number; h: number }
export function nearest(from: Box, boxes: Box[], dir: "up" | "down" | "left" | "right"): number
export type RemoteKey = "up" | "down" | "left" | "right" | "ok" | "back" | "playpause" | "play" | "pause" | "stop" | "next" | "previous"
export function remoteKey(e: { key: string; keyCode: number }): RemoteKey | undefined
export function groupVideos(videos: Video[]): { shows: { name: string; episodes: Video[] }[]; films: Video[]; home: Video[] }
export function findIn(query: string, fields: (string | number | undefined)[]): boolean
