/** Mirrors `string2buffer` from the WeChat mini program `utils/common.js` (ASCII + trailing 0x0A). */
export function stringToBlePayload(line: string): Uint8Array {
  let hexCsv = ''
  for (let i = 0; i < line.length; i++) {
    const b = line.charCodeAt(i) & 0xff
    hexCsv += (hexCsv ? ',' : '') + b.toString(16)
  }
  hexCsv += ',0a'
  const pairs = hexCsv.match(/[0-9a-f]{2}/gi)
  if (!pairs) return new Uint8Array([0x0a])
  return new Uint8Array(pairs.map((h) => parseInt(h, 16)))
}

export function decodeBleAscii(view: ArrayBufferView): string {
  const u8 = new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
  let s = ''
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!)
  return s
}

/** Configure-tab level presets (same strings as mini program `levelCodes`). */
export const LEVEL_CODES = ['2 2 2', '3 3 2', '4 4 2', '7 7 2', '5 5 3'] as const

/** Plain-language helpers — the three numbers are firmware tokens, not centimetres or seconds. */
export const LEVEL_PRESETS: readonly {
  readonly code: (typeof LEVEL_CODES)[number]
  readonly shortLabel: string
  readonly blurb: string
}[] = [
  {
    code: '2 2 2',
    shortLabel: 'Calm site',
    blurb: 'Lowest tier in the OEM list — start here if you see too many false opens.',
  },
  {
    code: '3 3 2',
    shortLabel: 'Balanced',
    blurb: 'Same default row many units ship with in the vendor app.',
  },
  {
    code: '4 4 2',
    shortLabel: 'Busier lane',
    blurb: 'More eager than balanced — only after mounting is solid and clutter is low.',
  },
  {
    code: '7 7 2',
    shortLabel: 'High reach',
    blurb: 'Strong preset in the OEM table — verify with walk tests before leaving site.',
  },
  {
    code: '5 5 3',
    shortLabel: 'Maximum OEM row',
    blurb: 'Top entry in the vendor preset list — last resort tuning; wrong install causes strikes.',
  },
] as const

export function levelPresetForIndex(levelIndex1to5: number): (typeof LEVEL_PRESETS)[number] | undefined {
  const i = Math.min(5, Math.max(1, Math.floor(levelIndex1to5))) - 1
  return LEVEL_PRESETS[i]
}

export function formatLevelOptionLabel(levelIndex1to5: number): string {
  const p = levelPresetForIndex(levelIndex1to5)
  if (!p) return ''
  return `${p.shortLabel} · ${p.code}`
}

export const POLE_TYPES = [
  { id: 1, label: 'Straight arm' },
  { id: 2, label: 'Grid / fence arm' },
  { id: 3, label: 'Ad / wide arm' },
] as const

export function buildConfigureCommands(opts: {
  orientation: 1 | 2
  poleTypeId: 1 | 2 | 3
  poleLengthM: number
  nearNoDetect: number
  levelIndex: 1 | 2 | 3 | 4 | 5
}): string[] {
  const cm = Math.round(opts.poleLengthM * 100)
  const level = LEVEL_CODES[opts.levelIndex - 1]
  return [
    `SimpleCfgCommon 6 2 ${opts.orientation}`,
    `SetGatePoleType ${opts.poleTypeId}`,
    `SetPoleLength ${cm}`,
    `SimpleCfgCommon 2 2 ${opts.nearNoDetect}`,
    `SetParas 4 2 ${level}`,
  ]
}

export function syncTimeCommand(): string {
  const unix = Math.floor(Date.now() / 1000)
  return `SetParas 10 2 ${unix}`
}
