/** Web Bluetooth — pick a device (no passive scan list like WeChat BLE APIs). */
export function isWebBluetoothAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth?.requestDevice
}

export async function pickBleDevice(serviceUuid?: string): Promise<BluetoothDevice | null> {
  if (!navigator.bluetooth?.requestDevice) return null
  if (serviceUuid) {
    return navigator.bluetooth.requestDevice({
      filters: [{ services: [serviceUuid as BluetoothServiceUUID] }],
      optionalServices: [serviceUuid as BluetoothServiceUUID],
    })
  }
  return navigator.bluetooth.requestDevice({ acceptAllDevices: true })
}
