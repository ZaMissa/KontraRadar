import type { RadarSession } from './radar-session'

export interface QueueWarning {
  command: string
  message: string
}

export interface QueueResult {
  warnings: QueueWarning[]
}

function extractErrorCode(text: string): number | null {
  const hits = [...text.matchAll(/Error\s*(-?\d+)/gi)]
  if (!hits.length) return null
  const last = hits[hits.length - 1]?.[1]
  const num = Number(last)
  return Number.isFinite(num) ? num : null
}

function compactReplyLine(reply: string): string {
  const line = reply
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .find((s) => /^Error\s*-?\d+/i.test(s))
  return line || ''
}

function isKnownUnsupportedCommand(command: string, errorCode: number): boolean {
  if (errorCode !== -1) return false
  return /^SetParas\s+10\s+2\b/i.test(command)
}

function commandHint(command: string, errorCode: number): string {
  if (errorCode === -1 && /^SetDetSensitivity\b/i.test(command)) {
    return 'Firmware rejected SetDetSensitivity. On this unit, try enabling "Use SimpleCfgCommon 8 2 (ms)" and save again.'
  }
  if (errorCode === -1 && /^SetParas\s+10\s+2\b/i.test(command)) {
    return 'This firmware appears to reject sync-time opcode SetParas 10 2.'
  }
  return ''
}

export async function runQueueWithFirmwareDiagnostics(
  s: RadarSession,
  cmds: string[],
  waitMs = 8000
): Promise<QueueResult> {
  const warnings: QueueWarning[] = []
  s.clearRxLog()
  for (let i = 0; i < cmds.length; i++) {
    const cmd = cmds[i]!
    await s.enqueueWrite(cmd)
    const reply = await s.waitForText(/Done|Error\s*-?\d*/i, waitMs).catch(() => '')
    const errorCode = extractErrorCode(reply)
    if (errorCode === null) continue

    if (isKnownUnsupportedCommand(cmd, errorCode)) {
      const msg = `Skipped unsupported command (Error ${errorCode}): ${cmd}`
      warnings.push({ command: cmd, message: msg })
      continue
    }

    const errorLine = compactReplyLine(reply)
    const hint = commandHint(cmd, errorCode)
    const detail = errorLine ? `; reply: ${errorLine}` : ''
    const extra = hint ? ` ${hint}` : ''
    throw new Error(`Save failed at step ${i + 1}/${cmds.length}: ${cmd} (Error ${errorCode}${detail}).${extra}`)
  }
  return { warnings }
}
