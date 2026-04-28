import { connectNewRadar, disconnectRadar, getActiveSession, type RadarSession } from './radar-session'
import { toast } from './toast'
import { patchState } from './state'

let benchRxUnsub: (() => void) | null = null
let benchPaused = false
let benchAutoscroll = true
let benchEvents = ''

function nowStamp(): string {
  return new Date().toLocaleString()
}

function appendEvent(line: string): void {
  benchEvents += `[${nowStamp()}] ${line}\n`
  const pre = document.getElementById('bench-events')
  if (pre) {
    pre.textContent = benchEvents || '—'
    pre.scrollTop = pre.scrollHeight
  }
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
    const serial = (document.getElementById('bench-serial') as HTMLInputElement | null)?.value?.trim() || 'unknown'
    const txt = (document.getElementById('bench-rx')?.textContent || '').trim()
    downloadText(`bench-raw-${serial}-${Date.now()}.txt`, txt)
    toast('Raw log exported')
  })
  document.getElementById('bench-export-report')?.addEventListener('click', () => {
    const serial = (document.getElementById('bench-serial') as HTMLInputElement | null)?.value?.trim() || 'unknown'
    downloadText(`bench-report-${serial}-${Date.now()}.txt`, buildReportText())
    toast('Report exported')
  })

  if (benchRxUnsub) benchRxUnsub()
  const sess = getActiveSession()
  if (sess?.connected) {
    benchRxUnsub = sess.onRx(() => syncBenchRx())
  } else {
    benchRxUnsub = null
  }
}

