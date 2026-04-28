import { getState } from './state'

/** Mirrors WeChat mini paths under `/api/csnw/mgmt/wechat/miniprogram/noauth/` */
export interface CommandResponse {
  ok: boolean
  status: number
  body: unknown
  error?: string
}

function httpSummary(status: number): string {
  if (status === 401 || status === 403) return `Unauthorized (${status})`
  if (status === 404) return `Not found (${status})`
  if (status >= 500) return `Server error (${status})`
  return `HTTP ${status}`
}

async function postJsonOnce(
  url: string,
  payload: Record<string, unknown>,
  timeoutMs: number
): Promise<{ res: Response; body: unknown }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const body = await res.json().catch(() => null)
  return { res, body }
}

/** One retry on transient network failures (timeouts, disconnects). */
async function postJsonWithRetry(
  url: string,
  payload: Record<string, unknown>,
  timeoutMs: number
): Promise<{ res: Response; body: unknown; error?: string }> {
  try {
    return await postJsonOnce(url, payload, timeoutMs)
  } catch (first) {
    await new Promise((r) => setTimeout(r, 350))
    try {
      return await postJsonOnce(url, payload, timeoutMs)
    } catch (second) {
      const msg = second instanceof Error ? second.message : 'Request failed'
      return {
        res: new Response(null, { status: 0 }),
        body: null,
        error: msg,
      }
    }
  }
}

export async function sendDeviceCommand(sendcmd: string): Promise<CommandResponse> {
  const { serverUrl, sessionId, deviceSn } = getState()
  const url = `${serverUrl.replace(/\/$/, '')}/api/csnw/mgmt/wechat/miniprogram/noauth/commands`
  try {
    const { res, body, error } = await postJsonWithRetry(
      url,
      {
        id: sessionId || undefined,
        devicesn: deviceSn || undefined,
        sendcmd,
      },
      120_000
    )
    if (error) {
      return { ok: false, status: 0, body: null, error }
    }
    const extra =
      !res.ok && typeof body === 'object' && body !== null && 'message' in body
        ? String((body as { message?: unknown }).message ?? '')
        : ''
    const errDetail = !res.ok ? (extra ? `${httpSummary(res.status)}: ${extra}` : httpSummary(res.status)) : undefined
    return { ok: res.ok, status: res.status, body, error: errDetail }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return { ok: false, status: 0, body: null, error: msg }
  }
}

export async function pollCommandList(): Promise<CommandResponse> {
  const { serverUrl, sessionId, deviceSn } = getState()
  const url = `${serverUrl.replace(/\/$/, '')}/api/csnw/mgmt/wechat/miniprogram/noauth/querydevice/commandlist`
  try {
    const { res, body, error } = await postJsonWithRetry(
      url,
      {
        id: sessionId || undefined,
        devicesn: deviceSn || undefined,
        current: 1,
        pageSize: 1,
      },
      3_000
    )
    if (error) {
      return { ok: false, status: 0, body: null, error }
    }
    const extra =
      !res.ok && typeof body === 'object' && body !== null && 'message' in body
        ? String((body as { message?: unknown }).message ?? '')
        : ''
    const errDetail = !res.ok ? (extra ? `${httpSummary(res.status)}: ${extra}` : httpSummary(res.status)) : undefined
    return { ok: res.ok, status: res.status, body, error: errDetail }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return { ok: false, status: 0, body: null, error: msg }
  }
}
