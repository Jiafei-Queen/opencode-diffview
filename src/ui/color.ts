import { RGBA } from "@opentui/core"

export function tint(base: RGBA, overlay: RGBA, alpha: number): RGBA {
  const red = base.r + (overlay.r - base.r) * alpha
  const green = base.g + (overlay.g - base.g) * alpha
  const blue = base.b + (overlay.b - base.b) * alpha
  return RGBA.fromInts(Math.round(red * 255), Math.round(green * 255), Math.round(blue * 255))
}
