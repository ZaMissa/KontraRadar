import { describe, expect, it } from 'vitest'
import { normalizeCutAreaPayload } from './n1-commands'

describe('normalizeCutAreaPayload', () => {
  it('normalizes explicit enable and bounds', () => {
    expect(normalizeCutAreaPayload('1 -1.0 3 1 2')).toBe('1 -1.00 3.00 1.00 2.00')
  })

  it('assumes enabled when only 4 fields are provided', () => {
    expect(normalizeCutAreaPayload('-1 3 1 2')).toBe('1 -1.00 3.00 1.00 2.00')
  })

  it('accepts disabled zero row in vendor format', () => {
    expect(normalizeCutAreaPayload('0 0.00 0.00 0.00 0.00')).toBe('0 0.00 0.00 0.00 0.00')
  })

  it('rejects out-of-range values', () => {
    expect(() => normalizeCutAreaPayload('1 -5 0 0 1')).toThrow(/-4.00\.\.4.00/)
    expect(() => normalizeCutAreaPayload('1 0 1 0 8')).toThrow(/0.00\.\.7.00/)
  })

  it('rejects invalid ordering', () => {
    expect(() => normalizeCutAreaPayload('1 2 1 0 1')).toThrow(/X minimum/)
    expect(() => normalizeCutAreaPayload('1 0 1 2 1')).toThrow(/Y minimum/)
  })
})
