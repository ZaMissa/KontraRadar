import { connectNewRadar, disconnectRadar, getActiveSession, type RadarSession } from './radar-session'
import { toast } from './toast'
import { patchState } from './state'

let benchRxUnsub: (() => void) | null = null
let benchPaused = false
let benchAutoscroll = true
let benchEvents = ''
let exportDirHandle: FileSystemDirectoryHandle | null = null
const EXPORT_SUBDIR = 'bench-reports'
const DB_NAME = 'radar-pwa-fs'
const DB_STORE = 'handles'
const DB_KEY_EXPORT_DIR = 'benchExportDir'

function nowStamp(): string {
  return new Date().toLocaleString()
}

function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function saveExportDirHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openHandleDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite')
    tx.objectStore(DB_STORE).put(handle, DB_KEY_EXPORT_DIR)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function loadExportDirHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openHandleDb()
  const out = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly')
    const req = tx.objectStore(DB_STORE).get(DB_KEY_EXPORT_DIR)
    req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle | undefined) ?? null)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return out
}

async function ensureExportSubdir(): Promise<FileSystemDirectoryHandle | null> {
  if (!exportDirHandle) return null
  const permApi = exportDirHandle as unknown as {
    queryPermission?: (opts: { mode: 'readwrite' }) => Promise<PermissionState>
  }
  const perm = permApi.queryPermission ? await permApi.queryPermission({ mode: 'readwrite' }) : 'granted'
  if (perm !== 'granted') return null
  return exportDirHandle.getDirectoryHandle(EXPORT_SUBDIR, { create: true })
}

function setExportPathLabel(s: string): void {
  const el = document.getElementById('bench-export-path')
  if (el) el.textContent = s
}

function appendEvent(line: string): void {
  benchEvents += `[${nowStamp()}] ${line}\n`
  const pre = document.getElementById('bench-events')
  if (pre) {
    pre.textContent = benchEvents || '—'
    pre.scrollTop = pre.scrollHeight
  }
}

function extractSerialFromText(t: string): string {
  const m1 = t.match(/Gate-([A-Za-z0-9._-]+):\/>/)
  if (m1?.[1]) return m1[1]
  const m2 = t.match(/79G[-\s]?Radar[-\s]?([A-Za-z0-9._-]+)/i)
  if (m2?.[1]) return m2[1]
  return ''
}

function setRunStatus(id: string, v: 'idle' | 'running' | 'ok' | 'fail'): void {
  const el = document.getElementById(id)
  if (!el) return
  el.className = `badge ${v === 'ok' ? 'badge-ok' : v === 'fail' ? 'badge-warn' : v === 'running' ? 'badge-soft' : ''}`
  el.textContent = v === 'running' ? 'Running' : v === 'ok' ? 'Pass' : v === 'fail' ? 'Fail' : 'Idle'
}

function updateBleStatus(): void {
  const sess = getActiveSession()
  const status = document.getElementById('bench-ble-status')
  const meta = document.getElementById('bench-ble-meta')
  if (!status || !meta) return
  if (sess?.connected) {
    status.className = 'badge badge-ok'
    status.textContent = 'Connected'
    meta.textContent = `${sess.meta?.deviceName || 'Radar'} | ${sess.meta?.serviceUuid || ''}`
  } else {
    status.className = 'badge badge-warn'
    status.textContent = 'Disconnected'
    meta.textContent = 'No active GATT session'
  }
}

async function requireSession(): Promise<RadarSession> {
  const s = getActiveSession()
  if (!s?.connected) throw new Error('Connect BLE first')
  return s
}

function syncBenchRx(): void {
  const pre = document.getElementById('bench-rx')
  const s = getActiveSession()
  if (!pre || !s || benchPaused) return
  pre.textContent = s.rxLog || '—'
  if (benchAutoscroll) pre.scrollTop = pre.scrollHeight
}

async function runBaselineCapture(): Promise<void> {
  setRunStatus('bench-step1-status', 'running')
  appendEvent('Step 1 baseline capture started')
  try {
    const s = await requireSession()
    s.clearRxLog()
    await s.enqueueWrite('GetSoftwareVersion')
    await s.waitForText(/Done|VER|version/i, 8000).catch(() => {})
    await s.enqueueWrite('ReadRadeConfig 2')
    await s.waitForText(/Done/i, 15000)
    syncBenchRx()
    const serialInput = document.getElementById('bench-serial') as HTMLInputElement | null
    if (serialInput && !serialInput.value.trim()) {
      const guessed = extractSerialFromText(s.rxLog || '') || extractSerialFromText(s.meta?.deviceName || '')
      if (guessed) {
        serialInput.value = guessed
        appendEvent(`Serial auto-detected: ${guessed}`)
      }
    }
    appendEvent('Step 1 baseline capture completed')
    setRunStatus('bench-step1-status', 'ok')
  } catch (e) {
    appendEvent(`Step 1 failed: ${e instanceof Error ? e.message : 'error'}`)
    setRunStatus('bench-step1-status', 'fail')
    throw e
  }
}

async function runStabilitySequence(): Promise<void> {
  setRunStatus('bench-step2-status', 'running')
  appendEvent('Step 2 stability sequence started (3 cycles)')
  try {
    const s = await requireSession()
    s.clearRxLog()
    for (let i = 1; i <= 3; i++) {
      appendEvent(`Cycle ${i}: ReadRadeConfig`)
      await s.enqueueWrite('ReadRadeConfig 2')
      await s.waitForText(/Done/i, 15000)
      appendEvent(`Cycle ${i}: GetSoftwareVersion`)
      await s.enqueueWrite('GetSoftwareVersion')
      await s.waitForText(/Done|VER|version/i, 8000).catch(() => {})
    }
    syncBenchRx()
    appendEvent('Step 2 stability sequence completed')
    setRunStatus('bench-step2-status', 'ok')
  } catch (e) {
    appendEvent(`Step 2 failed: ${e instanceof Error ? e.message : 'error'}`)
    setRunStatus('bench-step2-status', 'fail')
    throw e
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function runTargetSample(): Promise<void> {
  setRunStatus('bench-step3-status', 'running')
  appendEvent('Step 3 COMOutput sample started')
  try {
    const s = await requireSession()
    await s.enqueueWrite('COMOutputCfg 8')
    appendEvent('COMOutputCfg 8 sent, capturing 12 seconds...')
    await sleep(12000)
    await s.enqueueWrite('COMOutputCfg 0')
    appendEvent('COMOutputCfg 0 sent, sample stopped')
    syncBenchRx()
    setRunStatus('bench-step3-status', 'ok')
  } catch (e) {
    appendEvent(`Step 3 failed: ${e instanceof Error ? e.message : 'error'}`)
    setRunStatus('bench-step3-status', 'fail')
    throw e
  }
}

function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function saveTextToPickedFolder(filename: string, content: string): Promise<boolean> {
  const dir = await ensureExportSubdir()
  if (!dir) return false
  const fileHandle = await dir.getFileHandle(filename, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(content)
  await writable.close()
  return true
}

function buildReportText(): string {
  const operator = (document.getElementById('bench-operator') as HTMLInputElement | null)?.value?.trim() || ''
  const site = (document.getElementById('bench-site') as HTMLInputElement | null)?.value?.trim() || ''
  const serial = (document.getElementById('bench-serial') as HTMLInputElement | null)?.value?.trim() || ''
  const notes = (document.getElementById('bench-notes') as HTMLTextAreaElement | null)?.value || ''
  const rx = (document.getElementById('bench-rx') as HTMLElement | null)?.textContent || ''
  const s1 = document.getElementById('bench-step1-status')?.textContent || 'Idle'
  const s2 = document.getElementById('bench-step2-status')?.textContent || 'Idle'
  const s3 = document.getElementById('bench-step3-status')?.textContent || 'Idle'
  return [
    'Radar Bench Test Report',
    `Generated: ${nowStamp()}`,
    `Operator: ${operator}`,
    `Site/rig: ${site}`,
    `Device serial: ${serial}`,
    '',
    `Step1 baseline: ${s1}`,
    `Step2 stability: ${s2}`,
    `Step3 COM sample: ${s3}`,
    '',
    '--- Notes ---',
    notes || '(none)',
    '',
    '--- Event Log ---',
    benchEvents || '(empty)',
    '',
    '--- Raw RX Log ---',
    rx || '(empty)',
    '',
  ].join('\n')
}

export function pageBenchLabHtml(): string {
  return `
    <section class="page">
      <p class="lede">Bench Test Lab: one-page workflow for BLE connect, scripted test runs, and exportable evidence packages.</p>
      <div class="card stack">
        <h2 class="card-title tight">Tester metadata</h2>
        <label class="field"><span class="field-label">Operator</span><input id="bench-operator" type="text" placeholder="Name" /></label>
        <label class="field"><span class="field-label">Site / rig</span><input id="bench-site" type="text" placeholder="Table bench, office, etc." /></label>
        <label class="field"><span class="field-label">Device serial</span><input id="bench-serial" type="text" placeholder="SN..." /></label>
        <label class="field"><span class="field-label">Notes</span><textarea id="bench-notes" rows="3" placeholder="Anything unusual during tests"></textarea></label>
      </div>

      <div class="card stack">
        <div class="row between">
          <h2 class="card-title tight">BLE control</h2>
          <span id="bench-ble-status" class="badge badge-warn">Disconnected</span>
        </div>
        <p class="hint" id="bench-ble-meta">No active GATT session</p>
        <div class="row gap">
          <button class="btn btn-primary flex-1" id="bench-connect">Connect BLE</button>
          <button class="btn btn-secondary flex-1" id="bench-disconnect">Disconnect</button>
        </div>
      </div>

      <div class="card stack">
        <h2 class="card-title tight">Guided workflow</h2>
        <div class="row between"><span>1) Baseline capture (GetSoftwareVersion + ReadRadeConfig 2)</span><span id="bench-step1-status" class="badge">Idle</span></div>
        <button class="btn btn-secondary" id="bench-run-step1">Run Step 1</button>
        <div class="row between"><span>2) Stability run (3x read/version cycles)</span><span id="bench-step2-status" class="badge">Idle</span></div>
        <button class="btn btn-secondary" id="bench-run-step2">Run Step 2</button>
        <div class="row between"><span>3) COM sample (COMOutputCfg 8 for 12s)</span><span id="bench-step3-status" class="badge">Idle</span></div>
        <button class="btn btn-secondary" id="bench-run-step3">Run Step 3</button>
        <button class="btn btn-primary" id="bench-run-all">Run Full Bench Workflow</button>
      </div>

      <div class="card row gap wrap">
        <button class="btn btn-secondary" id="bench-set-folder">Set export folder</button>
        <span class="hint" id="bench-export-path">Export target: browser download</span>
      </div>

      <div class="card row gap wrap">
        <label class="row gap align-center hint" style="margin:0">
          <input type="checkbox" id="bench-autoscroll" checked />
          <span>Autoscroll</span>
        </label>
        <button class="btn btn-ghost" id="bench-freeze">Freeze</button>
        <button class="btn btn-ghost" id="bench-copy">Copy RX</button>
        <button class="btn btn-ghost" id="bench-clear">Clear RX</button>
        <button class="btn btn-secondary" id="bench-export-raw">Export raw log</button>
        <button class="btn btn-primary" id="bench-export-report">Export full report</button>
      </div>

      <pre class="card code-out tall" id="bench-rx">—</pre>
      <pre class="card code-out tall" id="bench-events">—</pre>
    </section>
  `
}

export function bindBenchLabPage(): void {
  benchPaused = false
  benchAutoscroll = true
  updateBleStatus()
  void (async () => {
    try {
      exportDirHandle = await loadExportDirHandle()
      if (exportDirHandle) {
        const permApi = exportDirHandle as unknown as {
          queryPermission?: (opts: { mode: 'readwrite' }) => Promise<PermissionState>
        }
        const perm = permApi.queryPermission ? await permApi.queryPermission({ mode: 'readwrite' }) : 'granted'
        if (perm === 'granted') setExportPathLabel(`Export target: chosen folder/${EXPORT_SUBDIR}`)
        else setExportPathLabel('Export target: chosen folder (permission needed)')
      } else {
        setExportPathLabel('Export target: browser download')
      }
    } catch {
      setExportPathLabel('Export target: browser download')
    }
  })()
  const s = getActiveSession()
  if (s) {
    const pre = document.getElementById('bench-rx')
    if (pre) pre.textContent = s.rxLog || '—'
  }

  document.getElementById('bench-connect')?.addEventListener('click', async () => {
    try {
      const s = await connectNewRadar()
      patchState({ connected: true, deviceName: s.meta?.deviceName || 'Radar' })
      appendEvent('BLE connected from Bench Lab')
      updateBleStatus()
      if (benchRxUnsub) benchRxUnsub()
      benchRxUnsub = s.onRx(() => syncBenchRx())
      syncBenchRx()
      toast('BLE connected')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'BLE connect failed', false)
    }
  })

  document.getElementById('bench-disconnect')?.addEventListener('click', () => {
    disconnectRadar()
    patchState({ connected: false })
    appendEvent('BLE disconnected from Bench Lab')
    updateBleStatus()
    toast('Disconnected')
  })

  document.getElementById('bench-run-step1')?.addEventListener('click', () => {
    void runBaselineCapture().catch((e) => toast(e instanceof Error ? e.message : 'Step 1 failed', false))
  })
  document.getElementById('bench-run-step2')?.addEventListener('click', () => {
    void runStabilitySequence().catch((e) => toast(e instanceof Error ? e.message : 'Step 2 failed', false))
  })
  document.getElementById('bench-run-step3')?.addEventListener('click', () => {
    void runTargetSample().catch((e) => toast(e instanceof Error ? e.message : 'Step 3 failed', false))
  })
  document.getElementById('bench-run-all')?.addEventListener('click', () => {
    void (async () => {
      try {
        await runBaselineCapture()
        await runStabilitySequence()
        await runTargetSample()
        toast('Bench workflow complete')
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Workflow failed', false)
      }
    })()
  })

  document.getElementById('bench-autoscroll')?.addEventListener('change', (ev) => {
    benchAutoscroll = !!(ev.target as HTMLInputElement).checked
  })
  document.getElementById('bench-freeze')?.addEventListener('click', () => {
    benchPaused = !benchPaused
    const b = document.getElementById('bench-freeze')
    if (b) b.textContent = benchPaused ? 'Resume' : 'Freeze'
  })
  document.getElementById('bench-copy')?.addEventListener('click', async () => {
    const txt = (document.getElementById('bench-rx')?.textContent || '').trim()
    try {
      await navigator.clipboard.writeText(txt)
      toast('RX copied')
    } catch {
      toast('Clipboard blocked', false)
    }
  })
  document.getElementById('bench-clear')?.addEventListener('click', () => {
    getActiveSession()?.clearRxLog()
    const pre = document.getElementById('bench-rx')
    if (pre) pre.textContent = '—'
    appendEvent('RX log cleared')
  })
  document.getElementById('bench-export-raw')?.addEventListener('click', () => {
    void (async () => {
      const serial = (document.getElementById('bench-serial') as HTMLInputElement | null)?.value?.trim() || 'unknown'
      const txt = (document.getElementById('bench-rx')?.textContent || '').trim()
      const name = `bench-raw-${serial}-${Date.now()}.txt`
      try {
        if (await saveTextToPickedFolder(name, txt)) {
          toast('Raw log saved to chosen folder')
        } else {
          downloadText(name, txt)
          toast('Raw log downloaded')
        }
      } catch {
        downloadText(name, txt)
        toast('Folder save failed, downloaded instead', false)
      }
    })()
  })
  document.getElementById('bench-export-report')?.addEventListener('click', () => {
    void (async () => {
      const serial = (document.getElementById('bench-serial') as HTMLInputElement | null)?.value?.trim() || 'unknown'
      const content = buildReportText()
      const name = `bench-report-${serial}-${Date.now()}.txt`
      try {
        if (await saveTextToPickedFolder(name, content)) {
          toast('Report saved to chosen folder')
        } else {
          downloadText(name, content)
          toast('Report downloaded')
        }
      } catch {
        downloadText(name, content)
        toast('Folder save failed, downloaded instead', false)
      }
    })()
  })

  document.getElementById('bench-set-folder')?.addEventListener('click', () => {
    void (async () => {
      if (!(window as unknown as { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker) {
        toast('Folder picker not supported in this browser', false)
        return
      }
      try {
        const handle = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> })
          .showDirectoryPicker()
        const reqApi = handle as unknown as {
          requestPermission?: (opts: { mode: 'readwrite' }) => Promise<PermissionState>
        }
        const perm = reqApi.requestPermission ? await reqApi.requestPermission({ mode: 'readwrite' }) : 'granted'
        if (perm !== 'granted') {
          toast('Folder permission denied', false)
          return
        }
        exportDirHandle = handle
        await saveExportDirHandle(handle)
        await handle.getDirectoryHandle(EXPORT_SUBDIR, { create: true })
        setExportPathLabel(`Export target: chosen folder/${EXPORT_SUBDIR}`)
        appendEvent(`Export folder set: ${EXPORT_SUBDIR}`)
        toast('Export folder configured')
      } catch (e) {
        if ((e as Error)?.name !== 'AbortError') toast('Failed to set folder', false)
      }
    })()
  })

  if (benchRxUnsub) benchRxUnsub()
  const sess = getActiveSession()
  if (sess?.connected) {
    benchRxUnsub = sess.onRx(() => syncBenchRx())
  } else {
    benchRxUnsub = null
  }
}

