import { NativeError, NativeStatus, OptimizedBuffer } from "@opentui/core"

// OpenTUI's test renderer can read a frame while its native writer is flushing.
const frames = new WeakMap<OptimizedBuffer, Uint8Array>()
const getRealCharBytes = OptimizedBuffer.prototype.getRealCharBytes
OptimizedBuffer.prototype.getRealCharBytes = function (addLineBreaks) {
  try {
    const bytes = getRealCharBytes.call(this, addLineBreaks)
    frames.set(this, bytes)
    return bytes
  } catch (error) {
    if (!(error instanceof NativeError) || error.status !== NativeStatus.OutputBusy) throw error
    return frames.get(this) ?? new Uint8Array()
  }
}
