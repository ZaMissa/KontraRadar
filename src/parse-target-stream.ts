/**
 * Parses target points from BLE ASCII log after `COMOutputCfg 8` (same stream as `n1` target map).
 * Lines look like: x=-0.13,y=2.48,p=221280 — optionally grouped by Frame:N markers (bench captures).
 */

export type TargetPoint = { readonly x: number; readonly y: number; readonly p: number }

const FRAME_LINE = /^Frame:\s*\d+\s*$/i
const POINT_LINE = /^x=([-0-9.]+)\s*,\s*y=([-0-9.]+)\s*,\s*p=(\d+)\s*$/i

/** Firmware lateral axis (m), roughly ±4 in vendor cut-area UI. */
export const ACROSS_MIN = -4
export const ACROSS_MAX = 4
/** Down-range (m), OEM cut-area Y up to ~7 m. */
export const RANGE_MIN = 0
export const RANGE_MAX = 7

/**
 * Returns points from the latest `Frame:` block when present; otherwise scans the tail of the log for point lines.
 */
export function parseLatestFramePoints(rxLog: string): TargetPoint[] {
  const chunk = rxLog.length > 48_000 ? rxLog.slice(-48_000) : rxLog
  const lines = chunk.split(/\r?\n/)

  let sliceStart = 0
  let foundFrame = false
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i]!.trim()
    if (FRAME_LINE.test(t)) {
      sliceStart = i + 1
      foundFrame = true
      break
    }
  }

  let slice = foundFrame ? lines.slice(sliceStart) : lines.length > 160 ? lines.slice(-160) : lines

  const points: TargetPoint[] = []
  for (const line of slice) {
    const m = line.trim().match(POINT_LINE)
    if (!m) continue
    const x = Number(m[1])
    const y = Number(m[2])
    const p = Number(m[3])
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(p)) continue
    points.push({ x, y, p })
  }
  return points
}
