const STORAGE_KEY = 'radar-debug-state-v1'

export interface AppState {
  serverUrl: string
  sessionId: string
  deviceSn: string
  deviceName: string
  connected: boolean
  /** Extra `optionalServices` UUID strings for Web Bluetooth (vendor GATT). */
  optionalBleServices: string[]
  /** From `GetSoftwareVersion` / label — used for SetDetSensitivity math. */
  deviceModel: string
  firmwareMainVer: number
}

const defaults: AppState = {
  serverUrl: 'https://www.eeyetech.com:5566',
  sessionId: '',
  deviceSn: '',
  deviceName: '',
  connected: false,
  optionalBleServices: [],
  deviceModel: '',
  firmwareMainVer: 0,
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...defaults }
    const p = JSON.parse(raw) as Partial<AppState>
    return { ...defaults, ...p }
  } catch {
    return { ...defaults }
  }
}

let state = load()

export function getState(): Readonly<AppState> {
  return state
}

export function patchState(partial: Partial<AppState>): void {
  state = { ...state, ...partial }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function resetConnection(): void {
  patchState({
    connected: false,
    deviceSn: '',
    deviceName: '',
  })
}
