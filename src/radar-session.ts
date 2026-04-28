import { decodeBleAscii, stringToBlePayload } from './protocol'
import { getState } from './state'

/** UUIDs commonly used by BLE serial / vendor services (optionalServices filter). */
const OPTIONAL_SERVICE_UUIDS: BluetoothServiceUUID[] = [
  'battery_service',
  'device_information',
  '02f00000-0000-0000-0000-00000000fe00',
  '0000fff0-0000-1000-8000-00805f9b34fb',
  '0000ae00-0000-1000-8000-00805f9b34fb',
  '0000ae30-0000-1000-8000-00805f9b34fb',
].map((u) => u as BluetoothServiceUUID)

export type RadarMeta = {
  deviceName: string
  serviceUuid: string
  writeUuid: string
  notifyUuid: string
}

export class RadarSession {
  readonly device: BluetoothDevice
  private gatt: BluetoothRemoteGATTServer | null = null
  private writeChar: BluetoothRemoteGATTCharacteristic | null = null
  private _meta: RadarMeta | null = null
  private notifyBuffer = ''
  private notifyHandlers: Array<(text: string) => void> = []
  private writeQueue: Promise<void> = Promise.resolve()
  private lastRx = ''

  private constructor(device: BluetoothDevice) {
    this.device = device
    this.device.addEventListener('gattserverdisconnected', () => {
      this.gatt = null
      this.writeChar = null
    })
  }

  static async openPicker(): Promise<RadarSession | null> {
    if (!navigator.bluetooth?.requestDevice) return null
    const extra = getState().optionalBleServices
      .filter(Boolean)
      .map((u) => u.trim())
      .filter(Boolean) as BluetoothServiceUUID[]
    const optionalServices = [...OPTIONAL_SERVICE_UUIDS, ...extra]
    let device: BluetoothDevice
    try {
      device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices,
      })
    } catch (err) {
      // Common failure: one custom UUID in settings is malformed -> picker never opens.
      if ((err as Error)?.name === 'TypeError' && extra.length > 0) {
        device = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [...OPTIONAL_SERVICE_UUIDS],
        })
      } else {
        throw err
      }
    }
    return RadarSession.fromDevice(device)
  }

  static async fromDevice(device: BluetoothDevice): Promise<RadarSession> {
    const s = new RadarSession(device)
    await s.discover()
    return s
  }

  get meta(): RadarMeta | null {
    return this._meta
  }

  get rxLog(): string {
    return this.lastRx
  }

  onRx(handler: (text: string) => void): () => void {
    this.notifyHandlers.push(handler)
    return () => {
      this.notifyHandlers = this.notifyHandlers.filter((h) => h !== handler)
    }
  }

  private emitRx(chunk: string): void {
    this.lastRx += chunk
    if (this.lastRx.length > 120_000) this.lastRx = this.lastRx.slice(-80_000)
    for (const h of this.notifyHandlers) h(chunk)
  }

  clearRxLog(): void {
    this.lastRx = ''
    this.notifyBuffer = ''
  }

  private async discover(): Promise<void> {
    const gatt = this.device.gatt
    if (!gatt) throw new Error('GATT unavailable')
    this.gatt = await gatt.connect()
    const services = await this.gatt.getPrimaryServices()
    if (!services.length) throw new Error('No GATT services')

    let primary = services[0]!
    if (services.length > 1) {
      const hit = services.find((s) => s.uuid.toLowerCase().startsWith('02f00000'))
      if (hit) primary = hit
    }
    const pref = services.find((s) => {
      const u = s.uuid.toUpperCase()
      return u.includes('AE') || u.includes('FFF')
    })
    if (pref) primary = pref

    const characteristics = await primary.getCharacteristics()
    let notifyChar: BluetoothRemoteGATTCharacteristic | undefined
    let writeChar: BluetoothRemoteGATTCharacteristic | undefined

    for (const c of characteristics) {
      if (c.properties.notify && !notifyChar) notifyChar = c
      if (c.properties.writeWithoutResponse && !writeChar) writeChar = c
    }
    if (!writeChar) writeChar = characteristics.find((c) => c.properties.write)

    if (!notifyChar || !writeChar) {
      throw new Error(
        'Could not find notify + write characteristics on the primary service. Pick the radar device or check firmware.'
      )
    }

    this.writeChar = writeChar
    this._meta = {
      deviceName: this.device.name || 'Unknown BLE',
      serviceUuid: primary.uuid,
      writeUuid: writeChar.uuid,
      notifyUuid: notifyChar.uuid,
    }

    await notifyChar.startNotifications()
    notifyChar.addEventListener('characteristicvaluechanged', (ev) => {
      const t = ev.target as BluetoothRemoteGATTCharacteristic
      const v = t.value
      if (!v) return
      const text = decodeBleAscii(v)
      this.notifyBuffer += text
      this.emitRx(text)
    })
  }

  disconnect(): void {
    this.gatt?.disconnect()
    this.gatt = null
    this.writeChar = null
  }

  get connected(): boolean {
    return !!this.gatt?.connected
  }

  /** Serialise writes so the radar can process line-by-line. */
  enqueueWrite(line: string, gapMs = 90): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      await this.writeNow(line)
      await sleep(gapMs)
    })
    return this.writeQueue
  }

  async writeNow(line: string): Promise<void> {
    const c = this.writeChar
    if (!c) throw new Error('Not connected')
    const payload = stringToBlePayload(line)
    const out = new Uint8Array(payload.length)
    out.set(payload)
    if (c.properties.writeWithoutResponse) {
      await c.writeValueWithoutResponse(out)
    } else {
      await c.writeValue(out)
    }
  }

  /** Send several configuration lines in order (like mini program save queue). */
  async sendLines(lines: string[], gapMs?: number): Promise<void> {
    for (const line of lines) await this.enqueueWrite(line, gapMs)
  }

  /** Wait until incoming text matches `needle` or timeout (for reads). */
  waitForText(needle: string | RegExp, timeoutMs = 8000): Promise<string> {
    const startLen = this.lastRx.length
    return new Promise((resolve, reject) => {
      const matches = () =>
        typeof needle === 'string'
          ? this.lastRx.includes(needle)
          : needle.test(this.lastRx)

      let off = () => {}
      const finishOk = () => {
        clearTimeout(to)
        off()
        resolve(this.lastRx.slice(startLen))
      }
      const to = window.setTimeout(() => {
        off()
        reject(new Error('Timed out waiting for radar reply'))
      }, timeoutMs)
      off = this.onRx(() => {
        if (matches()) finishOk()
      })
      if (matches()) finishOk()
    })
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

let active: RadarSession | null = null

export function getActiveSession(): RadarSession | null {
  return active
}

export async function connectNewRadar(): Promise<RadarSession> {
  active?.disconnect()
  const s = await RadarSession.openPicker()
  if (!s) throw new Error('No device selected')
  active = s
  return s
}

export function disconnectRadar(): void {
  active?.disconnect()
  active = null
}

export function attachSession(session: RadarSession): void {
  active?.disconnect()
  active = session
}
