import { describe, expect, it } from 'vitest'
import { parseLatestFramePoints } from './parse-target-stream'

const BENCH_SNIP = `
Gate-BR-1V3:/>COMOutputCfg 8
Done
Frame:739
x=-0.13,y=2.48,p=221280
x=0.25,y=2.41,p=743592
x=0.61,y=2.28,p=822398
Frame:740
x=0.00,y=2.48,p=336195
x=-0.13,y=2.48,p=221308
`

describe('parseLatestFramePoints', () => {
  it('parses last Frame block only', () => {
    const pts = parseLatestFramePoints(BENCH_SNIP)
    expect(pts).toHaveLength(2)
    expect(pts[0]).toEqual({ x: 0, y: 2.48, p: 336195 })
    expect(pts[1]).toEqual({ x: -0.13, y: 2.48, p: 221308 })
  })

  it('parses tail without Frame lines', () => {
    const pts = parseLatestFramePoints(`noise\nx=1,y=2,p=3\n`)
    expect(pts).toEqual([{ x: 1, y: 2, p: 3 }])
  })

  it('ignores malformed lines', () => {
    expect(parseLatestFramePoints('x=nan,y=1,p=1')).toHaveLength(0)
  })
})
