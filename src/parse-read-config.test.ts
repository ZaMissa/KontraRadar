import { describe, expect, it } from 'vitest'
import {
  lightOutFromSensitiveCounter,
  parseReadRadeConfigToAdvanced,
  parseReadRadeConfigToConfigure,
  splitReadConfigLines,
} from './parse-read-config'

describe('splitReadConfigLines', () => {
  it('splits on commas and newlines', () => {
    const s = 'JudgeSwitch: 1,\nYLimitWidth: 30'
    expect(splitReadConfigLines(s)).toContain('JudgeSwitch: 1')
    expect(splitReadConfigLines(s)).toContain('YLimitWidth: 30')
  })
})

describe('parseReadRadeConfigToConfigure', () => {
  it('maps configure-tab keys', () => {
    const raw = `
      GateFixation: 2,
      GatePoleType: 3,
      PoleLength: 350,
      SensitiveInfo: 3 3 2 42,
      YLimitWidth: 40
    `
    const p = parseReadRadeConfigToConfigure(raw)
    expect(p.orientation).toBe(2)
    expect(p.poleTypeId).toBe(3)
    expect(p.poleLengthM).toBeCloseTo(3.5)
    expect(p.levelIndex).toBe(2)
    expect(p.nearNoDetect).toBe(40)
    expect(p._fields?.length).toBeGreaterThan(0)
  })

  it('keeps exact YLimit width from spaced key format', () => {
    const raw = `YLimit   Width: 15`
    const p = parseReadRadeConfigToConfigure(raw)
    expect(p.nearNoDetect).toBe(15)
  })
})

describe('parseReadRadeConfigToAdvanced', () => {
  it('parses JudgeSwitch and BleSwitchFlag', () => {
    const raw = 'JudgeSwitch: 1,\nBleSwitchFlag: x y 0'
    const p = parseReadRadeConfigToAdvanced(raw, 'BR7901A', 30)
    expect(p.judgeTarActive).toBe(1)
    expect(p.bleFlag).toBe(1)
  })

  it('parses GateRelay token', () => {
    const raw = 'GateRelay: 0 1'
    const p = parseReadRadeConfigToAdvanced(raw, 'BR7901A', 30)
    expect(p.gateGpio).toBe(0)
  })

  it('parses spaced key variants and raw blocks', () => {
    const raw = `
      Judge   Switch: 0
      Direction Ctrl: 3
      GateRelay Flag: 1
      Sensitive Info: 2 2 2 7
      Set Mid  Width: 0 40 10
      RainVal [<3.5]: 5000 9500
      isCarCFG  [01]: 1 2 3
    `
    const p = parseReadRadeConfigToAdvanced(raw, 'BR7901A', 30)
    expect(p.judgeTarActive).toBe(2)
    expect(p.passDirection).toBe(3)
    expect(p.gateGpio).toBe(1)
    expect(p.levelValue).toBe('2 2 2')
    expect(p.lMid).toBe(40)
    expect(p.rMid).toBe(10)
    expect(p.rainLt35).toContain('5000')
    expect(p.isCarCfg01).toContain('1 2 3')
  })
})

describe('lightOutFromSensitiveCounter', () => {
  it('maps counter for generic model', () => {
    expect(lightOutFromSensitiveCounter(5, 'BR7901A', 30)).toBe(0.5)
    expect(lightOutFromSensitiveCounter(15, 'BR7901A', 30)).toBe(1)
  })
})
