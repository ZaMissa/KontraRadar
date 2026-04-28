/**
 * UI fragments mapped from `n1` pages: `pages/config/settings`, `pages/config/instructions`, target stream.
 */
import { getState, patchState } from './state'
import { getActiveSession, type RadarSession } from './radar-session'
import { toast } from './toast'
import { LEVEL_CODES, LEVEL_PRESETS, levelPresetForIndex } from './protocol'
import {
  buildAdvancedSaveCommands,
  cmdComOutputCfg,
  cmdReadRadeConfig,
  cmdResetRadeConfig,
  cmdReboot,
  type AdvancedFormSnapshot,
} from './n1-commands'
import {
  parseReadRadeConfigToAdvanced,
  type ParsedAdvancedConfig,
} from './parse-read-config'
import { runQueueWithFirmwareDiagnostics } from './save-diagnostics'
import {
  collapseHelpWs,
  advanced,
  instructions,
  firmware,
  support,
  target as targetHelp,
  sensitivityTriplesFold,
  judgePassModesFold,
  spaceTuplesFold,
} from './ui-explanations'

const PENDING_ADV_PARSE_KEY = 'radar-pwa-pending-adv-parse'

/** Stash parsed read reply and open the Advanced tab (form is not in DOM on this page). */
export function stashAdvancedParseAndNavigate(parsed: ParsedAdvancedConfig): void {
  sessionStorage.setItem(PENDING_ADV_PARSE_KEY, JSON.stringify(parsed))
  location.hash = '#/advanced'
}

function esc(s: string): string {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

function runBle(fn: (s: RadarSession) => Promise<void>): void {
  const s = getActiveSession()
  if (!s?.connected) {
    toast('Connect BLE first (Connect tab)', false)
    return
  }
  void (async () => {
    try {
      await fn(s)
      toast('OK')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error', false)
    }
  })()
}

export function pageAdvancedHtml(): string {
  const st = getState()
  const dm = esc(st.deviceModel || '')
  const fv = st.firmwareMainVer || ''
  return `
    <section class="page">
      <p class="banner-warn">Professional use only — wrong parameters can cause vehicle damage (same warning as the vendor app).</p>
      <p class="lede lede-tight">${collapseHelpWs(advanced.intro)}</p>
      <div class="card stack">
        <h2 class="card-title tight">Device profile (for sensitivity math)</h2>
        <p class="hint">${collapseHelpWs(advanced.deviceProfile)}</p>
        <label class="field">
          <span class="field-label">Model (e.g. BR7901A)</span>
          <input type="text" id="adv-model" value="${dm}" placeholder="BR7901A" />
        </label>
        <label class="field">
          <span class="field-label">Firmware main version</span>
          <input type="number" id="adv-fw" value="${fv}" min="0" placeholder="30" />
        </label>
      </div>
      <details class="card details-block" open>
        <summary>Judgement, direction, relay, BLE report</summary>
        <div class="details-body stack">
          <p class="hint">${collapseHelpWs(advanced.judgeBlock)}</p>
          <details class="fold-hint">
            <summary>What do Judge / pass numbers mean?</summary>
            <p class="hint">${collapseHelpWs(judgePassModesFold)}</p>
          </details>
          <div class="seg-row">
            <button type="button" class="seg-btn seg-active" data-adv-judge="1" title="Vendor judgement track A">Judge A</button>
            <button type="button" class="seg-btn" data-adv-judge="2" title="Vendor judgement track B">Judge B</button>
          </div>
          <span class="field-label">Pass direction (vendor modes)</span>
          <div class="seg-row">
            <button type="button" class="seg-btn seg-active" data-adv-pass="1" title="OEM direction mode 1">1</button>
            <button type="button" class="seg-btn" data-adv-pass="2" title="OEM direction mode 2">2</button>
            <button type="button" class="seg-btn" data-adv-pass="3" title="OEM direction mode 3">3</button>
          </div>
          <span class="field-label">Gate relay GPIO (barrier board input)</span>
          <div class="seg-row">
            <button type="button" class="seg-btn seg-active" data-adv-gpio="0">Low</button>
            <button type="button" class="seg-btn" data-adv-gpio="1">High</button>
          </div>
          <span class="field-label">Bluetooth status reporting (phone link, not loop output)</span>
          <div class="seg-row">
            <button type="button" class="seg-btn seg-active" data-adv-ble="0" title="Less radio traffic">Off</button>
            <button type="button" class="seg-btn" data-adv-ble="1" title="Radar reports state over BLE">On</button>
          </div>
        </div>
      </details>
      <details class="card details-block" open>
        <summary>Sensitivity &amp; delay</summary>
        <div class="details-body stack">
          <p class="hint">${collapseHelpWs(advanced.sensitivityBlock)}</p>
          <label class="field">
            <span class="field-label">Sensitivity tier</span>
            <select id="adv-level" aria-describedby="adv-level-blurb">${LEVEL_PRESETS.map(
              (p, i) =>
                `<option value="${esc(p.code)}" ${i === 1 ? 'selected' : ''}>${esc(p.shortLabel)} — ${esc(p.code)}</option>`
            ).join('')}</select>
          </label>
          <p class="hint" id="adv-level-blurb">${LEVEL_PRESETS[1]!.blurb}</p>
          <details class="fold-hint">
            <summary>Why three numbers?</summary>
            <p class="hint">${collapseHelpWs(sensitivityTriplesFold)}</p>
          </details>
          <label class="field">
            <span class="field-label">Light-off delay after detection (seconds)</span>
            <input type="number" id="adv-lightout" min="0" max="5" step="0.5" value="1" />
          </label>
          <label class="field row gap align-center">
            <input type="checkbox" id="adv-sc82" />
            <span>Use SimpleCfgCommon 8 2 (ms) instead of SetDetSensitivity</span>
          </label>
        </div>
      </details>
      <details class="card details-block">
        <summary>Distances &amp; widths</summary>
        <div class="details-body stack">
          <p class="hint">${collapseHelpWs(advanced.distancesBlock)}</p>
          <label class="field"><span class="field-label">Near-field blind (ignore zone ahead)</span><input type="number" id="adv-near" min="10" max="100" step="10" value="10" /></label>
          <label class="field"><span class="field-label">Middle blind strips left / right (cm)</span></label>
          <div class="row gap">
            <input type="number" class="flex-1" id="adv-lmid" min="0" max="100" value="30" />
            <input type="number" class="flex-1" id="adv-rmid" min="0" max="100" value="0" />
          </div>
          <label class="field"><span class="field-label">Left / right detection width</span></label>
          <div class="row gap">
            <input type="number" class="flex-1" id="adv-left" min="10" max="150" value="60" />
            <input type="number" class="flex-1" id="adv-right" min="10" max="150" value="60" />
          </div>
        </div>
      </details>
      <details class="card details-block">
        <summary>Range judge &amp; false-alarm filter</summary>
        <div class="details-body stack">
          <p class="hint">${collapseHelpWs(advanced.rangeBlock)}</p>
          <details class="fold-hint">
            <summary>What is a long line of numbers?</summary>
            <p class="hint">${collapseHelpWs(spaceTuplesFold)}</p>
          </details>
          <label class="field"><span class="field-label">RangeDimensionJudge → SetParas 1 2</span>
            <textarea id="adv-rj" rows="2">1 40 1 10</textarea></label>
          <label class="field"><span class="field-label">FalseAlarmFilter → SetParas 3 2</span>
            <textarea id="adv-mpf" rows="2">1 20 2000 18 18 15 15 3</textarea></label>
        </div>
      </details>
      <details class="card details-block">
        <summary>Speed / trace / zone triggers</summary>
        <div class="details-body stack">
          <p class="hint">${collapseHelpWs(advanced.triggerBlock)}</p>
          <details class="fold-hint">
            <summary>Why so many decimals?</summary>
            <p class="hint">${collapseHelpWs(spaceTuplesFold)}</p>
          </details>
          <label class="field"><span class="field-label">TriggerParas 1 2</span><input type="text" id="adv-t1" value="1 0.15 0.40" /></label>
          <label class="field"><span class="field-label">TriggerParas 2 2</span><input type="text" id="adv-t2" value="1 3 0.30" /></label>
          <label class="field"><span class="field-label">TriggerParas 3 2</span><input type="text" id="adv-t3" value="1 2" /></label>
          <label class="field"><span class="field-label">TriggerParas 4 2</span><input type="text" id="adv-t4" value="1" /></label>
        </div>
      </details>
      <details class="card details-block">
        <summary>Cut areas &amp; light-follow string</summary>
        <div class="details-body stack">
          <p class="hint">${collapseHelpWs(advanced.cutBlock)}</p>
          <label class="field"><span class="field-label">Cut [1]</span><textarea id="adv-c1" rows="2" placeholder="device format"></textarea></label>
          <label class="field"><span class="field-label">Cut [2]</span><textarea id="adv-c2" rows="2"></textarea></label>
          <label class="field"><span class="field-label">Cut [3]</span><textarea id="adv-c3" rows="2"></textarea></label>
          <label class="field"><span class="field-label">Cut [4]</span><textarea id="adv-c4" rows="2"></textarea></label>
          <span class="field-label">Light follow (SimpleCfgCommon 16 2)</span>
          <div class="seg-row">
            <button type="button" class="seg-btn seg-active" data-adv-lf="0">Mode 0</button>
            <button type="button" class="seg-btn" data-adv-lf="1">Mode 1</button>
          </div>
          <label class="field"><span class="field-label">singleLightOn pair</span>
            <input type="text" id="adv-slon" value="1000 60" /></label>
        </div>
      </details>
      <details class="card details-block">
        <summary>Readback-only blocks (RainVal / isCarCFG)</summary>
        <div class="details-body stack">
          <p class="hint">Captured from ReadRadeConfig as raw text for analysis. These blocks are not edited/saved by this form yet.</p>
          <label class="field"><span class="field-label">RainVal [&lt;3.5]</span><textarea id="adv-rain-lt35" rows="2" placeholder="readback value"></textarea></label>
          <label class="field"><span class="field-label">RainVal [&gt;3.5]</span><textarea id="adv-rain-gt35" rows="2" placeholder="readback value"></textarea></label>
          <label class="field"><span class="field-label">isCarCFG [01]</span><textarea id="adv-ic1" rows="2" placeholder="readback value"></textarea></label>
          <label class="field"><span class="field-label">isCarCFG [02]</span><textarea id="adv-ic2" rows="2" placeholder="readback value"></textarea></label>
          <label class="field"><span class="field-label">isCarCFG [03]</span><textarea id="adv-ic3" rows="2" placeholder="readback value"></textarea></label>
        </div>
      </details>
      <p class="hint">${collapseHelpWs(advanced.actions)}</p>
      <div class="card row gap wrap">
        <button type="button" class="btn btn-secondary flex-1" id="adv-read">Read ReadRadeConfig 2</button>
        <button type="button" class="btn btn-primary flex-1" id="adv-save">Save queue</button>
        <button type="button" class="btn btn-secondary flex-1" id="adv-reboot">${esc(cmdReboot())}</button>
        <button type="button" class="btn btn-secondary flex-1" id="adv-reset">${esc(cmdResetRadeConfig())}</button>
      </div>
      <div class="card row gap wrap">
        <label class="row gap align-center hint" style="margin:0">
          <input type="checkbox" id="adv-autoscroll" checked />
          <span>Autoscroll</span>
        </label>
        <button type="button" class="btn btn-ghost" id="adv-freeze">Freeze</button>
        <button type="button" class="btn btn-ghost" id="adv-copy-rx">Copy log</button>
        <button type="button" class="btn btn-ghost" id="adv-clear-rx">Clear log</button>
      </div>
      <pre class="card code-out tall" id="adv-rx"></pre>
      <div class="card">
        <div class="row between card-head-row">
          <h2 class="card-title tight">Last error</h2>
          <button type="button" class="btn btn-ghost tight" id="adv-copy-last-error">Copy</button>
        </div>
        <pre class="code-out" id="adv-last-error">—</pre>
      </div>
    </section>
  `
}

function readAdvSnapshot(): AdvancedFormSnapshot {
  const st = getState()
  const judge = document.querySelector('[data-adv-judge].seg-active')?.getAttribute('data-adv-judge') ?? '1'
  const pass = document.querySelector('[data-adv-pass].seg-active')?.getAttribute('data-adv-pass') ?? '1'
  const gpio = document.querySelector('[data-adv-gpio].seg-active')?.getAttribute('data-adv-gpio') ?? '0'
  const ble = document.querySelector('[data-adv-ble].seg-active')?.getAttribute('data-adv-ble') ?? '0'
  const lf = document.querySelector('[data-adv-lf].seg-active')?.getAttribute('data-adv-lf') ?? '0'
  const model =
    (document.getElementById('adv-model') as HTMLInputElement)?.value?.trim() || st.deviceModel || 'BR7901A'
  const fw = +(document.getElementById('adv-fw') as HTMLInputElement)?.value || st.firmwareMainVer || 30
  return {
    judgeTarActive: judge === '2' ? 2 : 1,
    passDirection: pass === '3' ? 3 : pass === '2' ? 2 : 1,
    gateGpio: gpio === '1' ? 1 : 0,
    bleFlag: ble === '1' ? 1 : 0,
    levelValue: (document.getElementById('adv-level') as HTMLSelectElement)?.value || LEVEL_CODES[1]!,
    lightOutNum: +(document.getElementById('adv-lightout') as HTMLInputElement)?.value || 1,
    useSimpleCfg82: !!(document.getElementById('adv-sc82') as HTMLInputElement)?.checked,
    nearNum: +(document.getElementById('adv-near') as HTMLInputElement)?.value || 10,
    lMid: +(document.getElementById('adv-lmid') as HTMLInputElement)?.value || 0,
    rMid: +(document.getElementById('adv-rmid') as HTMLInputElement)?.value || 0,
    leftW: +(document.getElementById('adv-left') as HTMLInputElement)?.value || 60,
    rightW: +(document.getElementById('adv-right') as HTMLInputElement)?.value || 60,
    rangeJudge: (document.getElementById('adv-rj') as HTMLTextAreaElement)?.value || '',
    multipath: (document.getElementById('adv-mpf') as HTMLTextAreaElement)?.value || '',
    trigSpeed: (document.getElementById('adv-t1') as HTMLInputElement)?.value || '',
    trigTrace: (document.getElementById('adv-t2') as HTMLInputElement)?.value || '',
    trigZoneSpd: (document.getElementById('adv-t3') as HTMLInputElement)?.value || '',
    trigZoneTrace: (document.getElementById('adv-t4') as HTMLInputElement)?.value || '',
    cut1: (document.getElementById('adv-c1') as HTMLTextAreaElement)?.value || '',
    cut2: (document.getElementById('adv-c2') as HTMLTextAreaElement)?.value || '',
    cut3: (document.getElementById('adv-c3') as HTMLTextAreaElement)?.value || '',
    cut4: (document.getElementById('adv-c4') as HTMLTextAreaElement)?.value || '',
    singleLightOn: (document.getElementById('adv-slon') as HTMLInputElement)?.value || '1000 60',
    lightFollow01: lf === '1' ? 1 : 0,
    deviceModel: model,
    firmwareMainVer: fw,
  }
}

function bindSegGroup(selector: string): void {
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    el.addEventListener('click', () => {
      document.querySelectorAll<HTMLElement>(selector).forEach((n) => n.classList.remove('seg-active'))
      el.classList.add('seg-active')
    })
  })
}

function syncAdvPresetBlurb(): void {
  const sel = document.getElementById('adv-level') as HTMLSelectElement | null
  const el = document.getElementById('adv-level-blurb')
  if (!sel || !el) return
  const idx = LEVEL_CODES.indexOf(sel.value as (typeof LEVEL_CODES)[number])
  const preset = idx >= 0 ? levelPresetForIndex(idx + 1) : undefined
  el.textContent =
    preset?.blurb ??
    'Readback tier not in the five OEM presets — kept for an honest copy of the device; change only if the vendor documented that token.'
}

function setSegByAttr(selector: string, attr: string, value: string): void {
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    if (el.getAttribute(attr) !== value) return
    document.querySelectorAll<HTMLElement>(selector).forEach((n) => n.classList.remove('seg-active'))
    el.classList.add('seg-active')
  })
}

export function applyParsedAdvancedToForm(parsed: ParsedAdvancedConfig): number {
  const { _fields, ...p } = parsed as ParsedAdvancedConfig & { _fields?: string[] }
  const keys = _fields?.length ?? 0

  if (p.judgeTarActive !== undefined)
    setSegByAttr('[data-adv-judge]', 'data-adv-judge', String(p.judgeTarActive))
  if (p.passDirection !== undefined)
    setSegByAttr('[data-adv-pass]', 'data-adv-pass', String(p.passDirection))
  if (p.gateGpio !== undefined)
    setSegByAttr('[data-adv-gpio]', 'data-adv-gpio', String(p.gateGpio))
  if (p.bleFlag !== undefined)
    setSegByAttr('[data-adv-ble]', 'data-adv-ble', String(p.bleFlag))
  if (p.lightFollow01 !== undefined)
    setSegByAttr('[data-adv-lf]', 'data-adv-lf', String(p.lightFollow01))

  const levelSel = document.getElementById('adv-level') as HTMLSelectElement | null
  if (levelSel && p.levelValue !== undefined) {
    const v = p.levelValue
    if (![...levelSel.options].some((o) => o.value === v)) {
      const opt = document.createElement('option')
      opt.value = v
      opt.textContent = v
      levelSel.appendChild(opt)
    }
    levelSel.value = v
  }

  const setNum = (id: string, n: number | undefined) => {
    if (n === undefined) return
    const el = document.getElementById(id) as HTMLInputElement | null
    if (el) el.value = String(n)
  }
  setNum('adv-lightout', p.lightOutNum)
  setNum('adv-near', p.nearNum)
  setNum('adv-lmid', p.lMid)
  setNum('adv-rmid', p.rMid)
  setNum('adv-left', p.leftW)
  setNum('adv-right', p.rightW)

  const setStr = (id: string, s: string | undefined) => {
    if (s === undefined) return
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null
    if (el) el.value = s
  }
  setStr('adv-rj', p.rangeJudge)
  setStr('adv-mpf', p.multipath)
  setStr('adv-t1', p.trigSpeed)
  setStr('adv-t2', p.trigTrace)
  setStr('adv-t3', p.trigZoneSpd)
  setStr('adv-t4', p.trigZoneTrace)
  setStr('adv-c1', p.cut1)
  setStr('adv-c2', p.cut2)
  setStr('adv-c3', p.cut3)
  setStr('adv-c4', p.cut4)
  setStr('adv-slon', p.singleLightOn)
  setStr('adv-rain-lt35', p.rainLt35)
  setStr('adv-rain-gt35', p.rainGt35)
  setStr('adv-ic1', p.isCarCfg01)
  setStr('adv-ic2', p.isCarCfg02)
  setStr('adv-ic3', p.isCarCfg03)

  syncAdvPresetBlurb()
  return keys
}

function consumePendingAdvancedParse(): void {
  const raw = sessionStorage.getItem(PENDING_ADV_PARSE_KEY)
  if (!raw) return
  sessionStorage.removeItem(PENDING_ADV_PARSE_KEY)
  try {
    const parsed = JSON.parse(raw) as ParsedAdvancedConfig
    const n = applyParsedAdvancedToForm(parsed)
    if (n > 0) toast(`Applied ${n} setting group(s) from Instruction console`)
  } catch {
    /* ignore */
  }
}

export function bindAdvancedPage(): void {
  const setPersistentError = (msg: string): void => {
    const pre = document.getElementById('adv-last-error')
    if (!pre) return
    pre.textContent = `[${new Date().toLocaleString()}] ${msg}`
  }
  document.getElementById('adv-copy-last-error')?.addEventListener('click', async () => {
    try {
      const txt = document.getElementById('adv-last-error')?.textContent || ''
      await navigator.clipboard.writeText(txt)
      toast('Error copied')
    } catch {
      toast('Clipboard blocked', false)
    }
  })

  consumePendingAdvancedParse()
  bindSegGroup('[data-adv-judge]')
  bindSegGroup('[data-adv-pass]')
  bindSegGroup('[data-adv-gpio]')
  bindSegGroup('[data-adv-ble]')
  bindSegGroup('[data-adv-lf]')

  document.getElementById('adv-level')?.addEventListener('change', syncAdvPresetBlurb)
  syncAdvPresetBlurb()

  const rx = document.getElementById('adv-rx')
  const sess = getActiveSession()
  const freezeBtn = document.getElementById('adv-freeze') as HTMLButtonElement | null
  const copyBtn = document.getElementById('adv-copy-rx') as HTMLButtonElement | null
  const clearBtn = document.getElementById('adv-clear-rx') as HTMLButtonElement | null
  const autoEl = document.getElementById('adv-autoscroll') as HTMLInputElement | null
  let paused = false
  freezeBtn?.addEventListener('click', () => {
    paused = !paused
    freezeBtn.textContent = paused ? 'Resume' : 'Freeze'
  })
  copyBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(rx?.textContent || '')
      toast('Advanced log copied')
    } catch {
      toast('Clipboard blocked', false)
    }
  })
  clearBtn?.addEventListener('click', () => {
    sess?.clearRxLog()
    if (rx) rx.textContent = '—'
  })
  if (sess && rx) {
    rx.textContent = sess.rxLog || '—'
    sess.onRx(() => {
      if (paused) return
      if (rx) {
        rx.textContent = sess.rxLog
        if (autoEl?.checked ?? true) rx.scrollTop = rx.scrollHeight
      }
    })
  }

  document.getElementById('adv-read')?.addEventListener('click', () => {
    const sess = getActiveSession()
    if (!sess?.connected) {
      toast('Connect BLE first (Connect tab)', false)
      return
    }
    void (async () => {
      try {
        const snap = readAdvSnapshot()
        sess.clearRxLog()
        await sess.enqueueWrite(cmdReadRadeConfig(2))
        await sess.waitForText(/Done/i, 15_000)
        const parsed = parseReadRadeConfigToAdvanced(
          sess.rxLog,
          snap.deviceModel || 'BR7901A',
          snap.firmwareMainVer || 30
        )
        const n = applyParsedAdvancedToForm(parsed)
        if (n > 0) toast(`Filled ${n} setting group(s) from reply`)
        else toast('Read finished — no parsed KEY: lines (check log below)')
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error'
        setPersistentError(msg)
        toast(msg, false)
      }
    })()
  })

  document.getElementById('adv-save')?.addEventListener('click', () => {
    const snap = readAdvSnapshot()
    patchState({ deviceModel: snap.deviceModel, firmwareMainVer: snap.firmwareMainVer })
    runBle(async (s) => {
      const cmds = buildAdvancedSaveCommands(snap)
      try {
        const res = await runQueueWithFirmwareDiagnostics(s, cmds, 8000)
        if (res.warnings.length > 0) {
          const msg = res.warnings.map((w) => w.message).join('\n')
          setPersistentError(msg)
          toast('Saved with firmware guardrail warning(s)', false)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Save failed'
        setPersistentError(msg)
        throw e
      }
    })
  })

  document.getElementById('adv-reboot')?.addEventListener('click', () => {
    runBle(async (s) => {
      await s.enqueueWrite(cmdReboot())
    })
  })

  document.getElementById('adv-reset')?.addEventListener('click', () => {
    if (!confirm('Factory reset radar config?')) return
    runBle(async (s) => {
      await s.enqueueWrite(cmdResetRadeConfig())
    })
  })
}

export function pageInstructionsHtml(): string {
  return `
    <section class="page">
      <p class="lede">${collapseHelpWs(instructions.lede)}</p>
      <div class="card stack">
        <label class="field">
          <span class="field-label">Instruction line</span>
          <textarea id="ins-cmd" rows="3">ReadRadeConfig 2</textarea>
        </label>
        <label class="field row gap align-center">
          <input type="checkbox" id="ins-wait" checked />
          <span>Wait for “Done” (15s)</span>
        </label>
        <div class="row gap wrap">
          <button type="button" class="btn btn-primary flex-1" id="ins-send">Send</button>
          <button type="button" class="btn btn-secondary flex-1" id="ins-apply-adv">Fill Advanced from reply</button>
        </div>
        <p class="hint">${collapseHelpWs(instructions.fillAdvanced)}</p>
      </div>
      <pre class="card code-out tall" id="ins-out"></pre>
    </section>
  `
}

export function bindInstructionsPage(): void {
  document.getElementById('ins-send')?.addEventListener('click', () => {
    const line = (document.getElementById('ins-cmd') as HTMLTextAreaElement)?.value?.trim()
    const wait = (document.getElementById('ins-wait') as HTMLInputElement)?.checked
    const out = document.getElementById('ins-out')
    if (!line) {
      toast('Enter a command', false)
      return
    }
    runBle(async (s) => {
      s.clearRxLog()
      await s.enqueueWrite(line.replace(/\s+/g, ' '))
      if (wait) await s.waitForText(/Done|Error/i, 15_000).catch(() => {})
      if (out) out.textContent = s.rxLog
    })
  })

  document.getElementById('ins-apply-adv')?.addEventListener('click', () => {
    const out = document.getElementById('ins-out')?.textContent?.trim()
    const sess = getActiveSession()
    const raw =
      out && out !== '—'
        ? out
        : sess?.rxLog && sess.rxLog.trim()
          ? sess.rxLog
          : ''
    if (!raw) {
      toast('No reply text — send a command first or paste ReadRadeConfig output below', false)
      return
    }
    const st = getState()
    const parsed = parseReadRadeConfigToAdvanced(
      raw,
      st.deviceModel || 'BR7901A',
      st.firmwareMainVer || 30
    )
    const n = parsed._fields?.length ?? 0
    if (n < 1) {
      toast('No recognized KEY: lines in log', false)
      return
    }
    stashAdvancedParseAndNavigate(parsed)
  })
}

export function targetExtrasHtml(): string {
  return `
    <div class="card stack">
      <h2 class="card-title tight">Live stream (n1: COMOutputCfg)</h2>
      <p class="hint">${collapseHelpWs(targetHelp.extras)}</p>
      <div class="row gap">
        <button type="button" class="btn btn-primary flex-1" id="tgt-start">Start COMOutputCfg 8</button>
        <button type="button" class="btn btn-secondary flex-1" id="tgt-stop">Stop COMOutputCfg 0</button>
      </div>
      <div class="row gap">
        <button type="button" class="btn btn-ghost flex-1" id="tgt-snapshot">Snapshot log tail</button>
        <button type="button" class="btn btn-ghost flex-1" id="tgt-copy">Copy tail</button>
      </div>
      <label class="field">
        <span class="field-label">Raw notify tail</span>
        <pre class="code-out" id="tgt-raw"></pre>
      </label>
    </div>
  `
}

export function bindTargetExtras(): void {
  const pre = document.getElementById('tgt-raw')
  const sess = getActiveSession()
  const sync = () => {
    if (pre && sess) {
      const t = sess.rxLog
      pre.textContent = t.length > 4000 ? t.slice(-4000) : t
    }
  }
  if (sess) sess.onRx(() => sync())

  document.getElementById('tgt-start')?.addEventListener('click', () => {
    runBle(async (s) => {
      await s.enqueueWrite(cmdComOutputCfg(8))
    })
  })
  document.getElementById('tgt-stop')?.addEventListener('click', () => {
    runBle(async (s) => {
      await s.enqueueWrite(cmdComOutputCfg(0))
    })
  })
  document.getElementById('tgt-snapshot')?.addEventListener('click', () => {
    sync()
    toast('Snapshot captured')
  })
  document.getElementById('tgt-copy')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(pre?.textContent || '')
      toast('Tail copied')
    } catch {
      toast('Clipboard blocked', false)
    }
  })
  sync()
}

export function firmwarePageHtml(): string {
  return `
    <section class="page">
      <div class="card">
        <p class="lede">${collapseHelpWs(firmware.lede)}</p>
        <ul class="hint list">
          <li>Use vendor PC tool or keep using the WeChat upgrade page for production.</li>
          <li>This PWA can still push ASCII maintenance commands over the main data characteristic.</li>
        </ul>
        <label class="field">
          <span class="field-label">Firmware file (local only — no upload wired)</span>
          <input type="file" id="fw-file" accept=".bin,.hex,.zip" />
          <span class="hint">${collapseHelpWs(firmware.fileInput)}</span>
        </label>
      </div>
    </section>
  `
}

export function supportPageHtml(): string {
  return `
    <section class="page">
      <div class="card">
        <p class="lede">${collapseHelpWs(support.lede)}</p>
        <div class="kv"><span>Session id</span><span>${esc(getState().sessionId || '—')}</span></div>
        <div class="kv"><span>Device S/N</span><span>${esc(getState().deviceSn || '—')}</span></div>
        <p class="hint">${collapseHelpWs(support.footer)}</p>
      </div>
    </section>
  `
}
