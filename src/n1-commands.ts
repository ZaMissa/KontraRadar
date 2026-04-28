/**
 * Text commands mirrored from `n1/app-service.js` (configure, settings, targetmap, upgrade hooks).
 * All lines are terminated with LF by {@link ./protocol.stringToBlePayload}.
 */

/** Configure tab — pole / gate basics */
export function cmdSimpleCfg612(orientation: 1 | 2): string {
  return `SimpleCfgCommon 6 2 ${orientation}`
}

export function cmdSetGatePoleType(index1to3: number): string {
  return `SetGatePoleType ${index1to3}`
}

export function cmdSetPoleLengthCm(cm: number): string {
  return `SetPoleLength ${Math.round(cm)}`
}

export function cmdNearNoDetect(value: number): string {
  return `SimpleCfgCommon 2 2 ${value}`
}

/** Same as configure: sensitivity preset row */
export function cmdSetParas42Level(levelSpaceSeparated: string): string {
  return `SetParas 4 2 ${levelSpaceSeparated}`
}

export function cmdSyncUnixTime(unixSec: number): string {
  return `SetParas 10 2 ${unixSec}`
}

/** Advanced settings — judgement / relay / direction (from pages/config/settings.js) */
export function cmdSetJudgeTarActive(mode: number): string {
  return `SetJudgeTarActive ${mode}`
}

export function cmdSetPassDirection(dir: number): string {
  return `SetPassDirection ${dir}`
}

export function cmdSetGateGPIOCtrl(v: number): string {
  return `SetGateGPIOCtrl ${v}`
}

/** Light follow + delay: `SimpleCfgCommon 16 2` + on/off + "1000 60" style string */
export function cmdSimpleCfg162(enable01: number, singleLightOn: string): string {
  return `SimpleCfgCommon 16 2 ${enable01} ${singleLightOn}`
}

/** BLE reporting flag packaged as SetParas 4 2 on settings page (distinct from level — same opcode, context). */
export function cmdSetParas42BleFlag(v: number): string {
  return `SetParas 4 2 ${v}`
}

/** Det sensitivity: level string + internal counter `o` from mini program */
export function cmdSetDetSensitivity(levelValue: string, o: number): string {
  return `SetDetSensitivity ${levelValue} ${o}`
}

/** Delay light-off (ms) for new firmware path */
export function cmdSimpleCfg82Ms(ms: number): string {
  return `SimpleCfgCommon 8 2 ${ms}`
}

export function cmdSetLRNoDetectWidth(l: number, r: number): string {
  return `SetLRNoDetectWidth 1 ${l} ${r}`
}

export function cmdSimpleCfg421(leftWidth: number): string {
  return `SimpleCfgCommon 4 2 1 ${leftWidth}`
}

export function cmdSimpleCfg422(rightWidth: number): string {
  return `SimpleCfgCommon 4 2 2 ${rightWidth}`
}

/** Cut area: index 1..4 and payload string from device */
export function cmdSetCutArea(index: number, payload: string): string {
  return `SetCutArea [${index}] ${payload}`
}

function fmtCutNumber(n: number): string {
  const v = Math.abs(n) < 0.0005 ? 0 : n
  return v.toFixed(2)
}

/**
 * Normalize cut-area payload to vendor-like row format:
 * `enable xMin xMax yMin yMax`
 * Accepts either 5 fields (explicit enable) or 4 fields (assumes enable=1).
 */
export function normalizeCutAreaPayload(raw: string): string {
  const cleaned = raw.replace(/,/g, ' ').trim()
  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length !== 4 && parts.length !== 5) {
    throw new Error('expected 4 or 5 numeric fields')
  }

  let enable = 1
  let start = 0
  if (parts.length === 5) {
    enable = Number(parts[0])
    start = 1
    if (!Number.isFinite(enable) || ![0, 1].includes(Math.trunc(enable))) {
      throw new Error('enable must be 0 or 1')
    }
    enable = Math.trunc(enable)
  }

  const xMin = Number(parts[start])
  const xMax = Number(parts[start + 1])
  const yMin = Number(parts[start + 2])
  const yMax = Number(parts[start + 3])
  if (![xMin, xMax, yMin, yMax].every((n) => Number.isFinite(n))) {
    throw new Error('all cut bounds must be numeric')
  }

  if (xMin < -4 || xMin > 4 || xMax < -4 || xMax > 4) {
    throw new Error('X bounds must stay within -4.00..4.00')
  }
  if (yMin < 0 || yMin > 7 || yMax < 0 || yMax > 7) {
    throw new Error('Y bounds must stay within 0.00..7.00')
  }
  if (xMin > xMax) throw new Error('X minimum cannot be greater than X maximum')
  if (yMin > yMax) throw new Error('Y minimum cannot be greater than Y maximum')

  return `${enable} ${fmtCutNumber(xMin)} ${fmtCutNumber(xMax)} ${fmtCutNumber(yMin)} ${fmtCutNumber(yMax)}`
}

export function cmdSetParas12RangeJudge(spaceSeparated: string): string {
  return `SetParas 1 2 ${spaceSeparated}`
}

export function cmdSetParas32Multipath(spaceSeparated: string): string {
  return `SetParas 3 2 ${spaceSeparated}`
}

export function cmdTriggerParas12(s: string): string {
  return `TriggerParas 1 2 ${s}`
}

export function cmdTriggerParas22(s: string): string {
  return `TriggerParas 2 2 ${s}`
}

export function cmdTriggerParas32(s: string): string {
  return `TriggerParas 3 2 ${s}`
}

export function cmdTriggerParas42(s: string): string {
  return `TriggerParas 4 2 ${s}`
}

export function cmdReadRadeConfig(section = 2): string {
  return `ReadRadeConfig ${section}`
}

export function cmdResetRadeConfig(): string {
  return 'ResetRadeConfig'
}

export function cmdReboot(): string {
  return 'reboot'
}

export function cmdGetSoftwareVersion(): string {
  return 'GetSoftwareVersion'
}

/** Target map — stream targets over serial BLE */
export function cmdComOutputCfg(mode: number): string {
  return `COMOutputCfg ${mode}`
}

/** Sub-doppler preset seen in read chain */
export function cmdSetSubDopplerDefault(): string {
  return 'SetSubDoppler 10000 10000 10000 10000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000'
}

/** Snapshot from advanced settings UI (maps `pages/config/settings` in n1). */
export interface AdvancedFormSnapshot {
  judgeTarActive: 1 | 2
  passDirection: 1 | 2 | 3
  gateGpio: 0 | 1
  bleFlag: 0 | 1
  levelValue: string
  lightOutNum: number
  /** Use ms path for delay light (new firmware). */
  useSimpleCfg82: boolean
  nearNum: number
  lMid: number
  rMid: number
  leftW: number
  rightW: number
  rangeJudge: string
  multipath: string
  trigSpeed: string
  trigTrace: string
  trigZoneSpd: string
  trigZoneTrace: string
  cut1: string
  cut2: string
  cut3: string
  cut4: string
  singleLightOn: string
  /** Light-follow row (SimpleCfgCommon 16 2). */
  lightFollow01: 0 | 1
  deviceModel: string
  firmwareMainVer: number
}

export function buildAdvancedSaveCommands(s: AdvancedFormSnapshot): string[] {
  const out: string[] = []
  out.push(cmdSimpleCfg162(s.lightFollow01, s.singleLightOn))
  out.push(cmdSetJudgeTarActive(s.judgeTarActive))
  out.push(cmdSetPassDirection(s.passDirection))
  out.push(cmdSetGateGPIOCtrl(s.gateGpio))
  out.push(cmdSetParas42BleFlag(s.bleFlag))

  const o = computeDetSensitivityO(s.lightOutNum, s.deviceModel || 'BR7901A', s.firmwareMainVer || 30)
  if (s.useSimpleCfg82) {
    out.push(cmdSimpleCfg82Ms(Math.round(1000 * s.lightOutNum)))
  } else {
    out.push(cmdSetDetSensitivity(s.levelValue, o))
  }

  out.push(cmdNearNoDetect(s.nearNum))
  out.push(cmdSetLRNoDetectWidth(s.lMid, s.rMid))
  out.push(cmdSimpleCfg421(s.leftW))
  out.push(cmdSimpleCfg422(s.rightW))

  const rj = s.rangeJudge.trim()
  if (rj) out.push(cmdSetParas12RangeJudge(rj))
  const mp = s.multipath.trim()
  if (mp) out.push(cmdSetParas32Multipath(mp))

  const t1 = s.trigSpeed.trim()
  if (t1) out.push(cmdTriggerParas12(t1))
  const t2 = s.trigTrace.trim()
  if (t2) out.push(cmdTriggerParas22(t2))
  const t3 = s.trigZoneSpd.trim()
  if (t3) out.push(cmdTriggerParas32(t3))
  const t4 = s.trigZoneTrace.trim()
  if (t4) out.push(cmdTriggerParas42(t4))

  const cuts = [s.cut1, s.cut2, s.cut3, s.cut4]
  cuts.forEach((c, i) => {
    const t = c.trim()
    if (!t) return
    try {
      const normalized = normalizeCutAreaPayload(t)
      out.push(cmdSetCutArea(i + 1, normalized))
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'invalid cut-area format'
      throw new Error(`Cut [${i + 1}] invalid: ${reason}`)
    }
  })

  return out.map((x) => x.replace(/\s+/g, ' ').trim())
}

/** Compute `o` for SetDetSensitivity from light-out seconds (simplified from BR7702 heuristics). */
export function computeDetSensitivityO(
  lightOutNum: number,
  deviceModel: string,
  firmwareMain: number
): number {
  let i = 75
  let n = 8
  if (deviceModel === 'BR7702S') {
    if (firmwareMain >= 12) {
      i = 110
      n = 7
    } else {
      i = 90
      n = 7
    }
  }
  const ms = Math.round(1000 * lightOutNum)
  let o = Math.floor(ms / i)
  if (ms % i > 0) o += 1
  if (o < n) o = n
  return o
}
