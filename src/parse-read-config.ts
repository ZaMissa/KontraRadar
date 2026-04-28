/**
 * Parses `ReadRadeConfig 2` style text replies — mirrors advanced-page `setfalg` in `n1/app-service.js`.
 */
import { LEVEL_CODES } from './protocol'
import type { AdvancedFormSnapshot } from './n1-commands'

/** Split vendor-style RX blob (commas + newlines, optional noise) into logical lines. */
export function splitReadConfigLines(raw: string): string[] {
  const chunks = raw
    .replace(/\r/g, '\n')
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  return chunks
}

/** Map internal counter `x` from `SensitiveInfo` tail to display seconds (n1 formula). */
export function lightOutFromSensitiveCounter(
  x: number,
  deviceModel: string,
  firmwareMainVer: number
): number {
  if (deviceModel === 'BR7702S') {
    if (firmwareMainVer >= 12) {
      if (x < 8) return 0.5
      if (x < 14) return 1
      if (x < 23) return 2
      if (x < 32) return 3
      if (x < 41) return 4
      return 5
    }
    if (x < 9) return 0.5
    if (x < 17) return 1
    if (x < 28) return 2
    if (x < 39) return 3
    if (x < 50) return 4
    return 5
  }
  if (x < 10) return 0.5
  if (x < 20) return 1
  if (x < 34) return 2
  if (x < 46) return 3
  if (x < 60) return 4
  return 5
}

function afterFirstColon(line: string): string {
  const i = line.indexOf(':')
  return i >= 0 ? line.slice(i + 1).trim() : ''
}

/** Level string + internal counter tail for `SensitiveInfo:` (same split as n1 `setfalg`). */
function parseSensitiveInfoValue(line: string): { levelStr: string; counter: number } | undefined {
  const payload = afterFirstColon(line).trim()
  if (!payload) return undefined
  let v = -1
  for (let D = payload.length - 1; D > 0; D--) {
    if (payload[D] === ' ') {
      v = D
      break
    }
  }
  if (v < 0) return undefined
  const levelStr = payload.slice(0, v).trimEnd()
  const tail = payload.slice(v + 1).trim()
  const counter = parseInt(tail, 10)
  if (!Number.isFinite(counter) || !levelStr) return undefined
  return { levelStr, counter }
}

function parseGateTimeParamLightSec(line: string): number | undefined {
  const M = afterFirstColon(line).split(' ')
  const c: string[] = []
  for (let F = 0; F < M.length; F++) if (M[F] !== '') c.push(M[F]!)
  if (c.length < 3) return undefined
  const ms = parseInt(c[1]!, 10)
  if (!Number.isFinite(ms)) return undefined
  if (ms === 0) return 0
  if (ms < 1000) return 0.5
  return Math.floor(ms / 1000)
}

export type ParsedAdvancedConfig = Partial<AdvancedFormSnapshot> & { _fields?: string[] }

/** Configure tab (`pages/config/configure` in n1) — subset of `setfalg` on read. */
export interface ParsedConfigureForm {
  orientation?: 1 | 2
  poleTypeId?: 1 | 2 | 3
  /** Meters (from `PoleLength` cm / 100). */
  poleLengthM?: number
  nearNoDetect?: number
  levelIndex?: 1 | 2 | 3 | 4 | 5
  _fields?: string[]
}

function clampPoleTypeId(n: number): 1 | 2 | 3 {
  if (n <= 1) return 1
  if (n >= 3) return 3
  return n as 1 | 2 | 3
}

/**
 * Parse `ReadRadeConfig` text into Configure-tab fields (n1 configure `setfalg`).
 * Keys: `GateFixation`, `GatePoleType`, `PoleLength`, `SensitiveInfo` (level only), `YLimitWidth`.
 */
export function parseReadRadeConfigToConfigure(raw: string): ParsedConfigureForm {
  const lines = splitReadConfigLines(raw)
  const out: ParsedConfigureForm = { _fields: [] }
  const touch = (key: string) => {
    out._fields!.push(key)
  }

  for (const line of lines) {
    const compact = line.replace(/\s+/g, '')
    const rawLine = line

    if (compact.includes('GateFixation')) {
      const n = parseInt(afterFirstColon(line), 10)
      if (n === 1 || n === 2) {
        out.orientation = n
        touch('GateFixation')
      }
      continue
    }
    if (compact.includes('GatePoleType')) {
      const n = parseInt(afterFirstColon(line), 10)
      if (Number.isFinite(n)) {
        out.poleTypeId = clampPoleTypeId(n)
        touch('GatePoleType')
      }
      continue
    }
    if (compact.includes('PoleLength')) {
      const cm = parseInt(afterFirstColon(rawLine).replace(/\s+/g, ''), 10)
      if (Number.isFinite(cm) && cm > 0) {
        let m = cm / 100
        if (m < 1) m = 1
        if (m > 7) m = 7
        out.poleLengthM = m
        touch('PoleLength')
      }
      continue
    }
    if (compact.includes('SensitiveInfo')) {
      const parsed = parseSensitiveInfoValue(rawLine)
      if (parsed) {
        const idx = (LEVEL_CODES as readonly string[]).indexOf(parsed.levelStr.trim())
        if (idx >= 0) {
          out.levelIndex = (idx + 1) as 1 | 2 | 3 | 4 | 5
          touch('SensitiveInfo')
        }
      }
      continue
    }
    if (compact.includes('YLimitWidth')) {
      const S = parseInt(afterFirstColon(line), 10)
      if (Number.isFinite(S)) {
        let n = S
        if (n < 10) n = 10
        if (n > 100) n = 100
        n = Math.round(n / 10) * 10
        out.nearNoDetect = n
        touch('YLimitWidth')
      }
      continue
    }
  }

  return out
}

/**
 * Parse comma/newline-separated key lines from a `ReadRadeConfig` reply.
 * Unknown lines are skipped. Last occurrence wins for overlapping keys.
 */
export function parseReadRadeConfigToAdvanced(
  raw: string,
  deviceModel: string,
  firmwareMainVer: number
): ParsedAdvancedConfig {
  const lines = splitReadConfigLines(raw)
  const out: ParsedAdvancedConfig = { _fields: [] }
  const touch = (key: string) => {
    out._fields!.push(key)
  }

  for (const line of lines) {
    const compact = line.replace(/\s+/g, '')
    const rawLine = line

    if (compact.includes('JudgeSwitch')) {
      const v = parseInt(afterFirstColon(line), 10)
      if (Number.isFinite(v)) {
        out.judgeTarActive = v === 1 ? 1 : 2
        touch('JudgeSwitch')
      }
      continue
    }
    if (compact.includes('DirectionCtrl')) {
      const d = parseInt(afterFirstColon(line), 10)
      if (d === 1) {
        out.passDirection = 1
        touch('DirectionCtrl')
      } else if (d === 2) {
        out.passDirection = 2
        touch('DirectionCtrl')
      } else if (Number.isFinite(d)) {
        out.passDirection = 3
        touch('DirectionCtrl')
      }
      continue
    }
    if (compact.includes('GateRelay')) {
      const rest = rawLine.slice(rawLine.indexOf(':') + 1)
      const l = rest.split(' ')
      const v = parseInt(l[1]!, 10)
      if (Number.isFinite(v)) {
        out.gateGpio = v === 0 ? 0 : 1
        touch('GateRelay')
      }
      continue
    }
    if (compact.includes('BleSwitchFlag')) {
      const g = afterFirstColon(rawLine).split(' ')
      if (g.length >= 3) {
        const t2 = parseInt(g[2]!, 10)
        if (Number.isFinite(t2)) {
          out.bleFlag = t2 === 0 ? 1 : 0
          touch('BleSwitchFlag')
        }
      }
      continue
    }
    if (compact.includes('SensitiveInfo')) {
      const parsed = parseSensitiveInfoValue(rawLine)
      if (parsed) {
        const m = parsed.levelStr
        out.levelValue = m
        if ((LEVEL_CODES as readonly string[]).includes(m)) {
          // keep as-is for <select>
        }
        out.lightOutNum = lightOutFromSensitiveCounter(parsed.counter, deviceModel, firmwareMainVer)
        touch('SensitiveInfo')
      }
      continue
    }
    if (compact.includes('YLimitWidth')) {
      const S = parseInt(afterFirstColon(line), 10)
      if (Number.isFinite(S)) {
        out.nearNum = S
        touch('YLimitWidth')
      }
      continue
    }
    if (compact.includes('SetMidWidth')) {
      const M = afterFirstColon(rawLine).split(' ')
      const c: string[] = []
      for (let I = 0; I < M.length; I++) if (M[I] !== '') c.push(M[I]!)
      if (c.length >= 3) {
        out.lMid = parseInt(c[1]!, 10)
        out.rMid = parseInt(c[2]!, 10)
        touch('SetMidWidth')
      }
      continue
    }
    if (compact.includes('LeftWidth')) {
      const O = parseInt(afterFirstColon(line), 10)
      if (Number.isFinite(O)) {
        out.leftW = O
        touch('LeftWidth')
      }
      continue
    }
    if (compact.includes('RightWidth')) {
      const L = parseInt(afterFirstColon(line), 10)
      if (Number.isFinite(L)) {
        out.rightW = L
        touch('RightWidth')
      }
      continue
    }
    if (compact.includes('SetCutArea')) {
      const head = rawLine.split(':')[0] ?? ''
      const bracket = head.split(/\s+/)[1]?.trim()
      const H = afterFirstColon(rawLine).trim()
      if (bracket === '[1]') {
        out.cut1 = H
        touch('SetCutArea1')
      } else if (bracket === '[2]') {
        out.cut2 = H
        touch('SetCutArea2')
      } else if (bracket === '[3]') {
        out.cut3 = H
        touch('SetCutArea3')
      } else if (bracket === '[4]') {
        out.cut4 = H
        touch('SetCutArea4')
      }
      continue
    }
    if (compact.includes('OneSideDetect')) {
      const M = afterFirstColon(rawLine).split(' ')
      const c: string[] = []
      for (let R = 0; R < M.length; R++) if (M[R] !== '') c.push(M[R]!)
      if (c.length >= 3) {
        out.singleLightOn = `${c[1]} ${c[2]}`
        out.lightFollow01 = c[0] === '0' ? 0 : 1
        touch('OneSideDetect')
      }
      continue
    }
    if (compact.includes('RangeDimensionJudge')) {
      const H = afterFirstColon(rawLine).trim()
      if (H) {
        out.rangeJudge = H
        touch('RangeDimensionJudge')
      }
      continue
    }
    if (compact.includes('FalseAlarmFilter')) {
      const H = afterFirstColon(rawLine).trim()
      if (H) {
        out.multipath = H
        touch('FalseAlarmFilter')
      }
      continue
    }
    if (compact.includes('TriSenSpeed')) {
      const M = afterFirstColon(rawLine).split(' ')
      const c: string[] = []
      for (let y = 0; y < M.length; y++) if (M[y] !== '') c.push(M[y]!)
      if (c.length >= 3) {
        out.trigSpeed = `${c[0]} ${c[1]} ${c[2]}`
        touch('TriSenSpeed')
      }
      continue
    }
    if (compact.includes('TriSenTrace')) {
      const M = afterFirstColon(rawLine).split(' ')
      const c: string[] = []
      for (let B = 0; B < M.length; B++) if (M[B] !== '') c.push(M[B]!)
      if (c.length >= 3) {
        out.trigTrace = `${c[0]} ${c[1]} ${c[2]}`
        touch('TriSenTrace')
      }
      continue
    }
    if (compact.includes('TriSenZoneSpd')) {
      const M = afterFirstColon(rawLine).split(' ')
      const c: string[] = []
      for (let V = 0; V < M.length; V++) if (M[V] !== '') c.push(M[V]!)
      if (c.length >= 2) {
        out.trigZoneSpd = `${c[0]} ${c[1]}`
        touch('TriSenZoneSpd')
      }
      continue
    }
    if (compact.includes('TriSenZoneTra')) {
      const M = afterFirstColon(rawLine).split(' ')
      const c: string[] = []
      for (let P = 0; P < M.length; P++) if (M[P] !== '') c.push(M[P]!)
      if (c.length >= 1) {
        out.trigZoneTrace = c.join(' ')
        touch('TriSenZoneTra')
      }
      continue
    }
    if (compact.includes('GateTimeParam')) {
      const lo = parseGateTimeParamLightSec(rawLine)
      if (lo !== undefined) {
        out.lightOutNum = lo
        touch('GateTimeParam')
      }
      continue
    }
  }

  return out
}
