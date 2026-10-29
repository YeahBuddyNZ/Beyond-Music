import type { Apps, CdStatus, Folder, Library, Places, Playlist, Station } from "@/lib/types"
export function mockLibrary(): Promise<Library>
export function mockRadio(): Promise<Station[]>
export function mockPlaces(): Promise<Places>
export function mockBrowse(path?: string): Promise<{ at: string | null; folders: Folder[] }>
export function mockAddPlace(path: string): Promise<void>
export function mockRemovePlace(id: string): Promise<void>
export function mockSavePlaylist(p: { id?: string; name: string; items: string[] }): Promise<Playlist>
export function mockDeletePlaylist(id: string): Promise<void>
export function mockPlayed(id: string): Promise<void>
export function mockSold(albumId: string): Promise<{ deleted: number; elsewhere: number }>
export function mockCd(): Promise<CdStatus>
export function mockApps(): Promise<Apps>
export function mockSetApps(on: boolean): Promise<void>
export function mockUsb(): Promise<{ sticks: import("@/lib/types").Stick[]; job: import("@/lib/types").UsbJob }>
export function mockCopyToUsb(o: unknown): Promise<{ job: import("@/lib/types").UsbJob; skipped: { title: string }[] }>
