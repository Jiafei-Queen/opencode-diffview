import type { ScrollAcceleration } from "@opentui/core"

export const SCROLL_LINES_MIN = 1
export const SCROLL_LINES_MAX = 20
export const SCROLL_WHEEL_MIN = 0.25
export const SCROLL_WHEEL_MAX = 5

/** Lines moved by a single j/k or arrow key press. */
export function scrollLines(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return 1
  return Math.min(SCROLL_LINES_MAX, Math.max(SCROLL_LINES_MIN, Math.trunc(value)))
}

/** Multiplier applied to each mouse wheel step. */
export function scrollWheel(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return 1
  return Math.min(SCROLL_WHEEL_MAX, Math.max(SCROLL_WHEEL_MIN, value))
}

export function wheelAcceleration(speed: () => number): ScrollAcceleration {
  return {
    tick: () => speed(),
    reset() {},
  }
}
