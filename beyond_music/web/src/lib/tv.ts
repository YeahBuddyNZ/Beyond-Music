// Driving the app with a TV remote: arrows move between things on screen, OK presses, Back goes back, and the
// play, pause and skip buttons drive the music. On a phone or computer only the media keys do anything.

import { nearest, remoteKey } from "./pure.js"
import * as player from "./player"

const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
export const TV = /[?&]tv\b/.test(location.search) || /Web0S|webOS|Tizen|SMART-TV|SmartTV|AFT[A-Z]|BRAVIA|GoogleTV|Android TV|AndroidTV|HbbTV|BeyondTV/i.test(ua)

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"]), video'

function candidates(): HTMLElement[] {
  const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"], [role="menu"]')
  const scope: ParentNode = dialogs.length ? dialogs[dialogs.length - 1] : document
  return [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && !el.closest("[inert], [aria-hidden=true]")
  })
}

const boxOf = (el: Element) => {
  const r = el.getBoundingClientRect()
  return { x: r.left, y: r.top, w: r.width, h: r.height }
}

export function focusFirst() {
  const first = document.querySelector<HTMLElement>("[data-autofocus]") || document.querySelector<HTMLElement>("main " + FOCUSABLE.split(",")[1])
  first?.focus()
}

function move(dir: "up" | "down" | "left" | "right") {
  const here = document.activeElement as HTMLElement | null
  const all = candidates()
  if (!here || here === document.body || !all.includes(here)) {
    focusFirst()
    return
  }
  const others = all.filter((el) => el !== here)
  const i = nearest(boxOf(here), others.map(boxOf), dir)
  if (i < 0) {
    if (dir === "up") window.scrollBy({ top: -300, behavior: "smooth" })
    return
  }
  others[i].focus({ preventScroll: true })
  others[i].scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" })
}

function back() {
  const open = document.querySelector('[role="dialog"], [role="menu"]')
  if (open) {
    document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    return true
  }
  if (location.hash && location.hash !== "#listen" && location.hash !== "#") {
    history.back()
    return true
  }
  return false
}

export function startRemote() {
  if (TV) document.documentElement.dataset.tv = ""
  window.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
    const key = remoteKey(e)
    if (!key) return
    const el = document.activeElement as HTMLElement | null
    const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA") && (el as HTMLInputElement).type !== "range"
    if (key === "playpause") return e.preventDefault(), player.toggle()
    if (key === "play") return e.preventDefault(), player.play()
    if (key === "pause" || key === "stop") return e.preventDefault(), player.pause()
    if (key === "next") return e.preventDefault(), player.next()
    if (key === "previous") return e.preventDefault(), player.previous()
    if (key === "back") {
      if (typing && e.key === "Backspace") return
      if (back() || TV) e.preventDefault()
      return
    }
    if (!TV) return
    if (key === "ok") return
    // A video that has focus takes left and right for skipping.
    if (el?.tagName === "VIDEO" && (key === "left" || key === "right")) {
      const v = el as HTMLVideoElement
      v.currentTime = Math.max(0, v.currentTime + (key === "right" ? 10 : -10))
      return e.preventDefault()
    }
    // In a text box, left and right move the cursor; up and down leave it.
    if (typing && (key === "left" || key === "right")) return
    if (el?.getAttribute("role") === "slider" && (key === "left" || key === "right")) return
    e.preventDefault()
    move(key)
  })
}
