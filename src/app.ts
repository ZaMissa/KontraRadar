import './style.css'
import { getState, patchState, resetConnection } from './state'
import { sendDeviceCommand, pollCommandList } from './api'
import { isWebBluetoothAvailable } from './bluetooth'
import { connectNewRadar, disconnectRadar, getActiveSession } from './radar-session'
import type { RadarSession } from './radar-session'
import {
  buildConfigureCommands,
  LEVEL_CODES,
  LEVEL_PRESETS,
  POLE_TYPES,
  syncTimeCommand,
  levelPresetForIndex,
} from './protocol'
import { parseReadRadeConfigToConfigure, type ParsedConfigureForm } from './parse-read-config'
import { toast } from './toast'
import {
  collapseHelpWs,
  connect,
  configure,
  more,
  target,
  settings,
  commands,
  docsRef,
  sensitivityTriplesFold,
} from './ui-explanations'
import {
  bindAdvancedPage,
  bindInstructionsPage,
  bindTargetExtras,
  firmwarePageHtml,
  pageAdvancedHtml,
  pageInstructionsHtml,
  supportPageHtml,
  targetExtrasHtml,
} from './pages-n1'
import { bindBenchLabPage, pageBenchLabHtml } from './bench-lab'

type Route =
  | 'connect'
  | 'configure'
  | 'target'
  | 'more'
  | 'settings'
  | 'advanced'
  | 'instructions'
  | 'firmware'
  | 'commands'
  | 'support'
  | 'bench'

function parseRoute(): Route {
  const h = (location.hash.replace(/^#\/?/, '') || 'connect').split('/')[0]
  const map: Record<string, Route> = {
    connect: 'connect',
    configure: 'configure',
    target: 'target',
    more: 'more',
    settings: 'settings',
    advanced: 'advanced',
    instructions: 'instructions',
    firmware: 'firmware',
    commands: 'commands',
    support: 'support',
    bench: 'bench',
  }
  return map[h] ?? 'connect'
}

function setHash(route: Route): void {
  location.hash = `#/${route}`
}

let targetMapRaf = 0
let targetMapCanvas: HTMLCanvasElement | null = null
let rxUnsub: (() => void) | null = null

function buildStamp(): string {
  const ts = Number.isNaN(Date.parse(__APP_BUILT_AT__))
    ? __APP_BUILT_AT__
    : new Date(__APP_BUILT_AT__).toLocaleString()
  return `v${__APP_VERSION__} · ${__APP_COMMIT__} · ${ts}`
}

function titleFor(r: Route): string {
  const titles: Record<Route, string> = {
    connect: 'Connect',
    configure: 'Configure',
    target: 'Targets',
    more: 'Tools & settings',
    settings: 'Cloud & BLE IDs',
    advanced: 'Radar advanced',
    instructions: 'Instruction console',
    firmware: 'Firmware update',
    commands: 'Command console',
    support: 'Remote support',
    bench: 'Bench test lab',
  }
  return titles[r]
}

/** Inline SVG icons (24×24, currentColor) for tabs & cards */
const Ico = {
  bluetooth: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.71 7.71L12 2h-1v7.59L6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 11 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29zM13 5.83l1.88 1.88L13 9.59V5.83zm1.88 10.46L13 18.17v-3.76l1.88 1.88z"/></svg>`,
  sliders: `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path stroke-linecap="round" d="M4 7h5M4 17h3m10 0h3M15 7h5"/><circle cx="11" cy="7" r="2.5" fill="currentColor" stroke="none"/><circle cx="9" cy="17" r="2.5" fill="currentColor" stroke="none"/><circle cx="17" cy="17" r="2.5" fill="currentColor" stroke="none"/></svg>`,
  grid: `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="8" cy="8" r="2"/><circle cx="16" cy="8" r="2"/><circle cx="8" cy="16" r="2"/><circle cx="16" cy="16" r="2"/><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/></svg>`,
  menu: `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" d="M5 7h14M5 12h14M5 17h10"/></svg>`,
  bolt: `<svg class="ico ico-sm" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M11 21h2l1-7h6l-8-12v9H9l2 10z"/></svg>`,
  radar: `<svg class="ico ico-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 12l6.5-3.5M12 12L7 17"/></svg>`,
  cloud: `<svg class="ico ico-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M7 18a4 4 0 1 1 1-7.87A5 5 0 0 1 17.5 9a3.5 3.5 0 0 1 1.8 6.5H7z"/></svg>`,
  help: `<svg class="ico ico-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M12 16v.5M12 8a3 3 0 0 0-3 3c0 1 .5 1.5 1 2"/></svg>`,
}

function statusStrip(route: Route): string {
  const main: Route[] = ['connect', 'configure', 'target', 'more']
  if (!main.includes(route)) return ''
  const sess = getActiveSession()
  const st = getState()
  const name = sess?.meta?.deviceName || st.deviceName
  let line: string
  if (sess?.connected && name) line = `Live · ${escapeHtml(name)}`
  else if (name) line = `Saved · ${escapeHtml(name)}`
  else line = 'No radar linked — open Connect'
  return `
    <div class="status-strip" role="status">
      <span class="status-pill ${sess?.connected ? 'status-pill-on' : 'status-pill-off'}">
        <span class="status-dot" aria-hidden="true"></span>
        ${sess?.connected ? 'BLE connected' : 'BLE offline'}
      </span>
      <span class="status-line">${line}</span>
      <span class="status-version" title="App version · commit · build time">${escapeHtml(buildStamp())}</span>
    </div>
  `
}

function shell(route: Route): string {
  const showBack = ['settings', 'advanced', 'instructions', 'firmware', 'commands', 'support', 'bench'].includes(
    route
  )

  return `
    <header class="app-header">
      ${showBack ? `<button type="button" class="btn-back" id="btn-back" aria-label="Back">←</button>` : '<span class="header-spacer"></span>'}
      <div class="header-center">
        <h1 class="app-title">${escapeHtml(titleFor(route))}</h1>
        ${showBack ? '' : `<p class="header-tagline">Vendor-style ASCII · Web Bluetooth</p>`}
      </div>
      <span class="header-spacer"></span>
    </header>
    ${statusStrip(route)}
    <main class="app-main" id="main-pane"></main>
    ${['settings', 'advanced', 'instructions', 'firmware', 'commands', 'support', 'bench'].includes(route) ? '' : tabBar(route)}
  `
}

function tabBar(active: Route): string {
  const tabs: { id: Route; label: string; icon: string }[] = [
    { id: 'connect', label: 'Connect', icon: Ico.bluetooth },
    { id: 'configure', label: 'Configure', icon: Ico.sliders },
    { id: 'target', label: 'Targets', icon: Ico.grid },
    { id: 'more', label: 'More', icon: Ico.menu },
  ]
  return `
    <nav class="tab-bar" role="tablist" aria-label="Primary">
      ${tabs
        .map(
          (t) => `
        <button type="button" role="tab" class="tab ${active === t.id ? 'tab-active' : ''}"
          data-route="${t.id}" aria-selected="${active === t.id}">
          ${t.icon}
          <span class="tab-label">${t.label}</span>
        </button>`
        )
        .join('')}
    </nav>
  `
}

function escapeHtml(s: string): string {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

function bleBadge(): string {
  const s = getActiveSession()
  if (!s?.connected) return '<span class="badge badge-warn">BLE idle</span>'
  return '<span class="badge badge-ok">BLE live</span>'
}

function pageConnect(): string {
  const st = getState()
  const meta = getActiveSession()?.meta
  return `
    <section class="page page-connect">
      <div class="hero-card">
        <div class="hero-card-icon" aria-hidden="true">${Ico.bluetooth}</div>
        <div>
          <h2 class="hero-card-title">Link your radar</h2>
          <p class="hero-card-text">
            Pick the unit in the system dialog, then open <strong>Configure</strong> to push line-based commands like the OEM WeChat tool (ASCII + LF).
          </p>
          <p class="hint">${collapseHelpWs(connect.heroBody)}</p>
        </div>
      </div>

      <ol class="flow-steps" aria-label="Setup flow">
        <li class="flow-step flow-step-done"><span class="flow-n">1</span> Pair Bluetooth</li>
        <li class="flow-step"><span class="flow-n">2</span> Tune gate &amp; sensitivity</li>
        <li class="flow-step"><span class="flow-n">3</span> Watch targets / logs</li>
      </ol>

      <div class="card card-elevated">
        <div class="card-head">
          ${Ico.bolt}
          <div>
            <h2 class="card-title tight">Radio link</h2>
            <p class="card-sub">Web Bluetooth · write + notify characteristics</p>
          </div>
        </div>
        <div class="row between card-head-row">
          <span class="field-label" style="margin:0">Browser support</span>
          ${isWebBluetoothAvailable() ? bleBadge() : '<span class="badge badge-warn">Unavailable</span>'}
        </div>
        <button type="button" class="btn btn-primary btn-block" id="btn-ble-connect">Choose radar (BLE)</button>
        <button type="button" class="btn btn-ghost btn-block" id="btn-ble-disconnect" ${getActiveSession() ? '' : 'disabled'}>Disconnect</button>
        <p class="hint">${collapseHelpWs(connect.btSession)} Chrome or Edge, HTTPS or localhost — if the picker stays empty, add optional service UUIDs under <em>More → Cloud &amp; BLE IDs</em>.</p>
      </div>
      ${
        meta
          ? `<div class="card">
        <div class="card-head">
          ${Ico.radar}
          <div>
            <h2 class="card-title tight">Active GATT session</h2>
            <p class="card-sub">Characteristics used for commands and live log</p>
          </div>
        </div>
        <p class="hint">${collapseHelpWs(connect.gattCard)}</p>
        <div class="kv"><span>Device</span><span>${escapeHtml(meta.deviceName)}</span></div>
        <div class="kv"><span>Service</span><span class="uuid">${escapeHtml(meta.serviceUuid)}</span></div>
        <div class="kv"><span>Write</span><span class="uuid">${escapeHtml(meta.writeUuid)}</span></div>
        <div class="kv"><span>Notify</span><span class="uuid">${escapeHtml(meta.notifyUuid)}</span></div>
      </div>`
          : ''
      }
      <div class="card">
        <div class="card-head">
          ${Ico.grid}
          <div>
            <h2 class="card-title tight">Offline demo</h2>
            <p class="card-sub">Labels only — no RF traffic</p>
          </div>
        </div>
        <p class="hint">${collapseHelpWs(connect.demo)}</p>
        <button type="button" class="btn btn-secondary btn-block" id="btn-demo">Use demo session</button>
      </div>
      <div class="card card-muted">
        <h2 class="card-title tight">Stored labels</h2>
        <p class="hint">${collapseHelpWs(connect.storedLabels)}</p>
        <div class="kv"><span>Name</span><span>${escapeHtml(st.deviceName || '—')}</span></div>
        <div class="kv"><span>Serial</span><span>${escapeHtml(st.deviceSn || '—')}</span></div>
        <button type="button" class="btn btn-ghost btn-block" id="btn-clear-session">Clear saved labels</button>
      </div>
    </section>
  `
}

function pageConfigure(): string {
  const sess = getActiveSession()
  const warn = sess?.connected
    ? ''
    : `<div class="banner-warn" role="alert">
        <strong>No live BLE session.</strong> Open <strong>Connect</strong>, choose your radar, then return here to send <code>SetParas</code>, <code>SimpleCfgCommon</code>, etc.
      </div>`
  return `
    <section class="page page-configure">
      ${warn}
      <p class="lede lede-tight">${collapseHelpWs(configure.lede)}</p>

      <div class="card card-elevated">
        <div class="card-head">
          ${Ico.sliders}
          <div>
            <h2 class="card-title tight">Sensitivity</h2>
            <p class="card-sub">Five OEM tiers · same tokens as WeChat <code>SetParas 4 2</code></p>
          </div>
        </div>
        <div class="ring-wrap">
          <canvas id="ring-canvas" width="200" height="200" aria-label="Sensitivity gauge"></canvas>
          <div class="ring-meta">
            <div class="ring-step-line"><span id="ring-value">3</span><span class="unit"> / 5</span></div>
            <div class="preset-tier-title" id="level-tier-name">${LEVEL_PRESETS[2]!.shortLabel}</div>
            <div class="preset-token mono" id="level-code">${LEVEL_CODES[2]}</div>
            <p class="hint preset-blurb" id="level-blurb">${LEVEL_PRESETS[2]!.blurb}</p>
          </div>
        </div>
        <label class="field">
          <span class="field-label">Choose aggressiveness</span>
          <input type="range" id="rng-level" min="1" max="5" step="1" value="3" aria-describedby="level-blurb" />
        </label>
        <details class="fold-hint">
          <summary>Why three numbers like “3 3 2”?</summary>
          <p class="hint">${collapseHelpWs(sensitivityTriplesFold)}</p>
        </details>
        <p class="hint">${collapseHelpWs(configure.sensitivity)}</p>
      </div>

      <div class="card">
        <div class="card-head">
          ${Ico.radar}
          <div>
            <h2 class="card-title tight">Barrier layout</h2>
            <p class="card-sub">Orientation, pole type, length &amp; near blind zone</p>
          </div>
        </div>
        <div class="seg" role="group" aria-label="Approach side">
          <span class="field-label">Vehicle approach side</span>
          <div class="seg-row">
            <button type="button" class="seg-btn seg-active" data-orient="1" id="ori-l">Left fixed</button>
            <button type="button" class="seg-btn" data-orient="2" id="ori-r">Right fixed</button>
          </div>
        </div>
        <label class="field">
          <span class="field-label">Barrier arm type</span>
          <select id="pole-type">
            ${POLE_TYPES.map((p) => `<option value="${p.id}">${p.label}</option>`).join('')}
          </select>
        </label>
        <label class="field">
          <span class="field-label">Arm length (m)</span>
          <input type="range" id="pole-m" min="1" max="7" step="0.1" value="3" />
          <span class="hint"><span id="pole-m-lbl">3.0</span> m → sent as cm via <code>SetPoleLength</code>.</span>
        </label>
        <label class="field">
          <span class="field-label">Near-range ignore</span>
          <input type="range" id="near" min="1" max="100" step="1" value="10" />
          <span class="hint">Value <span id="near-lbl">10</span> — same scale as vendor “near no-detect” distance.</span>
        </label>
        <p class="hint">${collapseHelpWs(configure.barrierLayout)}</p>
      </div>

      <div class="card">
        <div class="card-head">
          ${Ico.bolt}
          <div>
            <h2 class="card-title tight">Actions</h2>
            <p class="card-sub">BLE write queue</p>
          </div>
        </div>
        <div class="btn-grid">
          <button type="button" class="btn btn-secondary" id="btn-read-cfg">Read config</button>
          <button type="button" class="btn btn-primary" id="btn-save-cfg">Save to radar</button>
          <button type="button" class="btn btn-secondary" id="btn-sync-time">Sync time</button>
          <button type="button" class="btn btn-secondary" id="btn-get-ver">Get version</button>
        </div>
        <p class="hint">${collapseHelpWs(configure.actions)}</p>
      </div>

      <div class="card card-log">
        <div class="row between card-head-row">
          <div class="card-head card-head-inline">
            ${Ico.radar}
            <div>
              <h2 class="card-title tight">Live from radar</h2>
              <p class="card-sub">Notify stream (ASCII)</p>
            </div>
          </div>
          <div class="row gap wrap">
            <label class="row gap align-center hint" style="margin:0">
              <input type="checkbox" id="chk-autoscroll-rx" checked />
              <span>Autoscroll</span>
            </label>
            <button type="button" class="btn btn-ghost tight" id="btn-pause-rx">Freeze</button>
            <button type="button" class="btn btn-ghost tight" id="btn-copy-rx">Copy</button>
            <button type="button" class="btn btn-ghost tight" id="btn-clear-rx">Clear</button>
          </div>
        </div>
        <p class="hint">${collapseHelpWs(configure.liveLog)}</p>
        <pre class="code-out tall" id="ble-rx" aria-live="polite">—</pre>
      </div>
    </section>
  `
}

function pageTarget(): string {
  return `
    <section class="page page-target">
      <p class="lede lede-tight">${collapseHelpWs(target.lede)}</p>
      <div class="card pad-0 target-viz-card">
        <div class="target-viz-head row between">
          <span class="target-viz-title">Detection plane</span>
          <span class="badge badge-soft">Demo motion</span>
        </div>
        <div class="target-canvas-wrap">
          <canvas id="target-canvas" width="340" height="280" aria-label="Target scatter plot"></canvas>
          <span class="axis-label axis-y">Across</span>
          <span class="axis-label axis-x">Range →</span>
        </div>
      </div>
      <div class="card stats-row row between">
        <div>
          <span class="stats-label">Tracks (sim)</span>
          <strong class="stats-value" id="target-count">0</strong>
        </div>
        <div class="stats-hint muted">Replace with parsed COM / CAN targets when wired.</div>
      </div>
      ${targetExtrasHtml()}
    </section>
  `
}

function linkCard(go: Route, title: string, sub: string, iconHtml: string): string {
  return `
    <li>
      <button type="button" class="link-card" data-go="${go}">
        <span class="link-card-icon" aria-hidden="true">${iconHtml}</span>
        <span class="link-card-body">
          <span class="link-card-title">${title}</span>
          <span class="link-card-sub">${sub}</span>
        </span>
        <span class="chev" aria-hidden="true">›</span>
      </button>
    </li>`
}

function pageMore(): string {
  return `
    <section class="page page-more">
      <p class="lede lede-tight">${collapseHelpWs(more.lede)}</p>

      <div class="more-group">
        <h3 class="more-heading">Radar tuning</h3>
        <ul class="link-list">
          ${linkCard('advanced', 'Radar advanced', collapseHelpWs(more.cardAdvanced), Ico.radar)}
          ${linkCard('instructions', 'Instruction console', collapseHelpWs(more.cardInstructions), Ico.bolt)}
          ${linkCard('bench', 'Bench test lab', 'One-page test runner with BLE control, scripted runs, and exports.', Ico.grid)}
        </ul>
      </div>

      <div class="more-group">
        <h3 class="more-heading">Cloud &amp; device</h3>
        <ul class="link-list">
          ${linkCard('settings', 'Cloud API & BLE UUIDs', collapseHelpWs(more.cardSettings), Ico.cloud)}
          ${linkCard('firmware', 'Firmware update', collapseHelpWs(more.cardFirmware), Ico.bolt)}
          ${linkCard('commands', 'Command console', collapseHelpWs(more.cardCommands), Ico.sliders)}
        </ul>
      </div>

      <div class="more-group">
        <h3 class="more-heading">Help</h3>
        <ul class="link-list">
          ${linkCard('support', 'Remote support', collapseHelpWs(more.cardSupport), Ico.help)}
        </ul>
      </div>

      <p class="footnote">${collapseHelpWs(docsRef)} Command strings follow the decompiled WeChat build (<code>n1/app-service.js</code>).</p>
    </section>
  `
}

function pageSettings(): string {
  const st = getState()
  const extra = st.optionalBleServices.join('\n')
  return `
    <section class="page">
      <p class="lede lede-tight">${collapseHelpWs(settings.lede)}</p>
      <form id="form-settings" class="card stack">
        <label class="field">
          <span class="field-label">Cloud API base URL</span>
          <input type="url" name="serverUrl" value="${escapeHtml(st.serverUrl)}" required autocomplete="off" />
          <span class="hint">${collapseHelpWs(settings.serverUrl)}</span>
        </label>
        <label class="field">
          <span class="field-label">Session / user id</span>
          <input type="text" name="sessionId" value="${escapeHtml(st.sessionId)}" placeholder="Optional" autocomplete="off" />
          <span class="hint">${collapseHelpWs(settings.sessionId)}</span>
        </label>
        <label class="field">
          <span class="field-label">Device serial (label)</span>
          <input type="text" name="deviceSn" value="${escapeHtml(st.deviceSn)}" placeholder="Optional" autocomplete="off" />
          <span class="hint">${collapseHelpWs(settings.deviceSn)}</span>
        </label>
        <label class="field">
          <span class="field-label">Device model (for sensitivity math)</span>
          <input type="text" name="deviceModel" value="${escapeHtml(st.deviceModel)}" placeholder="BR7901A" autocomplete="off" />
          <span class="hint">${collapseHelpWs(settings.deviceModel)}</span>
        </label>
        <label class="field">
          <span class="field-label">Firmware main version</span>
          <input type="number" name="firmwareMainVer" value="${st.firmwareMainVer || ''}" min="0" placeholder="30" />
          <span class="hint">${collapseHelpWs(settings.firmwareMainVer)}</span>
        </label>
        <label class="field">
          <span class="field-label">Extra BLE service UUIDs</span>
          <textarea name="optionalBleServices" rows="4" placeholder="One 128-bit UUID per line — required if Chrome hides your vendor service">${escapeHtml(extra)}</textarea>
          <span class="hint">${collapseHelpWs(settings.optionalBleServices)}</span>
        </label>
        <button type="submit" class="btn btn-primary btn-block">Save</button>
      </form>
      <p class="hint">After editing UUIDs, disconnect and reconnect so the browser grants access to those services.</p>
    </section>
  `
}

function pageFirmware(): string {
  return firmwarePageHtml()
}

function pageCommands(): string {
  return `
    <section class="page">
      <p class="lede lede-tight">${collapseHelpWs(commands.lede)}</p>
      <div class="card stack">
        <label class="field">
          <span class="field-label">ASCII command (LF added automatically)</span>
          <textarea id="cmd-input" rows="3" placeholder="ReadRadeConfig 2"></textarea>
        </label>
        <label class="field row gap align-center">
          <input type="checkbox" id="cmd-ble" checked />
          <span>Send over BLE when connected (otherwise cloud API)</span>
        </label>
        <div class="row gap">
          <button type="button" class="btn btn-primary flex-1" id="btn-send-cmd">Send</button>
          <button type="button" class="btn btn-secondary flex-1" id="btn-poll-cmd">Poll reply (cloud)</button>
        </div>
        <p class="hint">${collapseHelpWs(commands.poll)}</p>
      </div>
      <pre class="card code-out tall" id="cmd-output">—</pre>
    </section>
  `
}

function pageSupport(): string {
  return supportPageHtml()
}

function pageBench(): string {
  return pageBenchLabHtml()
}

function renderMain(route: Route): void {
  rxUnsub?.()
  rxUnsub = null

  const pane = document.getElementById('main-pane')
  if (!pane) return
  const pages: Record<Route, () => string> = {
    connect: pageConnect,
    configure: pageConfigure,
    target: pageTarget,
    more: pageMore,
    settings: pageSettings,
    advanced: pageAdvancedHtml,
    instructions: pageInstructionsHtml,
    firmware: pageFirmware,
    commands: pageCommands,
    support: pageSupport,
    bench: pageBench,
  }
  pane.innerHTML = pages[route]()

  if (route === 'configure') bindConfigure()
  if (route === 'target') {
    bindTargetMap()
    bindTargetExtras()
  }
  if (route === 'settings') bindSettings()
  if (route === 'advanced') bindAdvancedPage()
  if (route === 'instructions') bindInstructionsPage()
  if (route === 'commands') bindCommands()
  if (route === 'connect') bindConnect()
  if (route === 'bench') bindBenchLabPage()

  attachRxMirror(route)
}

function attachRxMirror(route: Route): void {
  if (route !== 'configure' && route !== 'connect') return
  const pre = document.getElementById('ble-rx')
  const sess = getActiveSession()
  if (!sess || !pre) return
  const pauseBtn = document.getElementById('btn-pause-rx') as HTMLButtonElement | null
  const copyBtn = document.getElementById('btn-copy-rx') as HTMLButtonElement | null
  const autoEl = document.getElementById('chk-autoscroll-rx') as HTMLInputElement | null
  let paused = false

  pauseBtn?.addEventListener('click', () => {
    paused = !paused
    pauseBtn.textContent = paused ? 'Resume' : 'Freeze'
  })
  copyBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(pre.textContent || '')
      toast('Log copied')
    } catch {
      toast('Clipboard blocked', false)
    }
  })

  const sync = () => {
    if (paused) return
    pre.textContent = sess.rxLog || '—'
    if (autoEl?.checked ?? true) pre.scrollTop = pre.scrollHeight
  }
  sync()
  rxUnsub = sess.onRx(() => sync())
}

function applyParsedConfigureToForm(parsed: ParsedConfigureForm): number {
  const { _fields, ...p } = parsed as ParsedConfigureForm & { _fields?: string[] }
  const n = _fields?.length ?? 0

  if (p.orientation !== undefined) {
    document.querySelectorAll<HTMLElement>('[data-orient]').forEach((el) => {
      const on = el.getAttribute('data-orient') === String(p.orientation)
      el.classList.toggle('seg-active', on)
    })
  }
  if (p.poleTypeId !== undefined) {
    const sel = document.getElementById('pole-type') as HTMLSelectElement | null
    if (sel) sel.value = String(p.poleTypeId)
  }
  if (p.poleLengthM !== undefined) {
    const el = document.getElementById('pole-m') as HTMLInputElement | null
    if (el) el.value = String(p.poleLengthM)
    const poleLbl = document.getElementById('pole-m-lbl')
    if (poleLbl) poleLbl.textContent = p.poleLengthM.toFixed(1)
  }
  if (p.nearNoDetect !== undefined) {
    const el = document.getElementById('near') as HTMLInputElement | null
    if (el) el.value = String(p.nearNoDetect)
    const nearLbl = document.getElementById('near-lbl')
    if (nearLbl) nearLbl.textContent = String(p.nearNoDetect)
  }
  if (p.levelIndex !== undefined) {
    const rng = document.getElementById('rng-level') as HTMLInputElement | null
    if (rng) rng.value = String(p.levelIndex)
    const valEl = document.getElementById('ring-value')
    if (valEl) valEl.textContent = String(p.levelIndex)
    const codeEl = document.getElementById('level-code')
    const preset = levelPresetForIndex(p.levelIndex)
    if (codeEl) codeEl.textContent = preset?.code ?? ''
    const tierEl = document.getElementById('level-tier-name')
    if (tierEl) tierEl.textContent = preset?.shortLabel ?? '—'
    const blurbEl = document.getElementById('level-blurb')
    if (blurbEl) blurbEl.textContent = preset?.blurb ?? ''
    const canvas = document.getElementById('ring-canvas') as HTMLCanvasElement | null
    if (canvas) drawRing(canvas, p.levelIndex)
  }
  return n
}

function drawRing(canvas: HTMLCanvasElement, level: number): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const pct = (level / 5) * 100
  const w = canvas.width
  const h = canvas.height
  const cx = w / 2
  const cy = h / 2
  const r = Math.min(w, h) / 2 - 14
  ctx.clearRect(0, 0, w, h)
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.strokeStyle = '#ebebeb'
  ctx.lineWidth = 12
  ctx.stroke()
  const end = (-Math.PI / 2 + (pct / 100) * Math.PI * 2) % (Math.PI * 2)
  ctx.beginPath()
  ctx.arc(cx, cy, r, -Math.PI / 2, end)
  ctx.strokeStyle = '#ff9c07'
  ctx.lineWidth = 12
  ctx.stroke()
}

function readConfigureForm(): {
  orientation: 1 | 2
  poleTypeId: 1 | 2 | 3
  poleLengthM: number
  nearNoDetect: number
  levelIndex: 1 | 2 | 3 | 4 | 5
} {
  const ori = document.querySelector('.seg-btn.seg-active')?.getAttribute('data-orient') ?? '1'
  const poleType = +(document.getElementById('pole-type') as HTMLSelectElement)?.value || 1
  const poleM = +(document.getElementById('pole-m') as HTMLInputElement)?.value || 3
  const near = +(document.getElementById('near') as HTMLInputElement)?.value || 10
  const level = +(document.getElementById('rng-level') as HTMLInputElement)?.value || 3
  return {
    orientation: ori === '2' ? 2 : 1,
    poleTypeId: Math.min(3, Math.max(1, poleType)) as 1 | 2 | 3,
    poleLengthM: poleM,
    nearNoDetect: near,
    levelIndex: Math.min(5, Math.max(1, level)) as 1 | 2 | 3 | 4 | 5,
  }
}

function bindConfigure(): void {
  const canvas = document.getElementById('ring-canvas') as HTMLCanvasElement | null
  const rng = document.getElementById('rng-level') as HTMLInputElement | null
  const valEl = document.getElementById('ring-value')
  const codeEl = document.getElementById('level-code')
  const tierNameEl = document.getElementById('level-tier-name')
  const blurbEl = document.getElementById('level-blurb')
  const poleM = document.getElementById('pole-m') as HTMLInputElement | null
  const poleLbl = document.getElementById('pole-m-lbl')
  const near = document.getElementById('near') as HTMLInputElement | null
  const nearLbl = document.getElementById('near-lbl')

  document.querySelectorAll<HTMLElement>('[data-orient]').forEach((el) => {
    el.addEventListener('click', () => {
      document.querySelectorAll<HTMLElement>('[data-orient]').forEach((n) => n.classList.remove('seg-active'))
      el.classList.add('seg-active')
    })
  })

  const updLevel = () => {
    const v = +rng!.value
    const clamped = Math.min(5, Math.max(1, v))
    if (valEl) valEl.textContent = String(clamped)
    const preset = levelPresetForIndex(clamped)
    if (codeEl) codeEl.textContent = preset?.code ?? ''
    if (tierNameEl) tierNameEl.textContent = preset?.shortLabel ?? '—'
    if (blurbEl) blurbEl.textContent = preset?.blurb ?? ''
    if (canvas) drawRing(canvas, clamped)
  }
  rng?.addEventListener('input', updLevel)
  updLevel()

  const updPole = () => {
    if (poleLbl && poleM) poleLbl.textContent = Number(poleM.value).toFixed(1)
  }
  poleM?.addEventListener('input', updPole)
  updPole()

  const updNear = () => {
    if (nearLbl && near) nearLbl.textContent = near.value
  }
  near?.addEventListener('input', updNear)
  updNear()

  document.getElementById('btn-clear-rx')?.addEventListener('click', () => {
    getActiveSession()?.clearRxLog()
    const pre = document.getElementById('ble-rx')
    if (pre) pre.textContent = '—'
  })

  const runBle = async (fn: (s: RadarSession) => Promise<void>) => {
    const s = getActiveSession()
    if (!s?.connected) {
      toast('Connect under Connect tab first', false)
      return
    }
    try {
      await fn(s)
      toast('Done')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'BLE error', false)
    }
  }

  const runQueueWithDiagnostics = async (s: RadarSession, cmds: string[]): Promise<void> => {
    s.clearRxLog()
    for (let i = 0; i < cmds.length; i++) {
      const cmd = cmds[i]!
      await s.enqueueWrite(cmd)
      await s.waitForText(/Done|Error\s*-?\d*/i, 7000).catch(() => {})
      const tail = s.rxLog.slice(-500)
      if (/Error\s*-?\d*/i.test(tail)) {
        throw new Error(`Save failed at step ${i + 1}/${cmds.length}: ${cmd}`)
      }
    }
  }

  document.getElementById('btn-read-cfg')?.addEventListener('click', () => {
    const s = getActiveSession()
    if (!s?.connected) {
      toast('Connect under Connect tab first', false)
      return
    }
    void (async () => {
      try {
        s.clearRxLog()
        await s.enqueueWrite('ReadRadeConfig 2')
        await s.waitForText(/Done/i, 12_000)
        const parsed = parseReadRadeConfigToConfigure(s.rxLog)
        const n = applyParsedConfigureToForm(parsed)
        if (n > 0) toast(`Filled ${n} configure field group(s) from reply`)
        else toast('Read finished — no configure keys parsed (see log)')
      } catch (e) {
        toast(e instanceof Error ? e.message : 'BLE error', false)
      }
    })()
  })

  document.getElementById('btn-save-cfg')?.addEventListener('click', () => {
    void runBle(async (s) => {
      const cmds = buildConfigureCommands(readConfigureForm())
      await runQueueWithDiagnostics(s, cmds)
    })
  })

  document.getElementById('btn-sync-time')?.addEventListener('click', () => {
    const s = getActiveSession()
    if (!s?.connected) {
      toast('Connect under Connect tab first', false)
      return
    }
    void (async () => {
      try {
        s.clearRxLog()
        await s.enqueueWrite(syncTimeCommand())
        await s.waitForText(/Done|Error\s*-?\d*/i, 6000).catch(() => {})
        const rx = s.rxLog
        if (/Error\s*-?\d*/i.test(rx)) {
          toast('Sync time rejected by device (Error -1). This firmware may not support SetParas 10 2.', false)
          return
        }
        toast('Time sync command sent')
      } catch (e) {
        toast(e instanceof Error ? e.message : 'BLE error', false)
      }
    })()
  })

  document.getElementById('btn-get-ver')?.addEventListener('click', () => {
    void runBle(async (s) => {
      s.clearRxLog()
      await s.enqueueWrite('GetSoftwareVersion')
      await s.waitForText(/Done|VER|version/i, 6000).catch(() => {
        /* still show partial rx */
      })
    })
  })
}

interface Point {
  x: number
  y: number
  vx: number
  vy: number
}

function bindTargetMap(): void {
  targetMapCanvas = document.getElementById('target-canvas') as HTMLCanvasElement | null
  const countEl = document.getElementById('target-count')
  if (!targetMapCanvas || !countEl) return

  const pts: Point[] = Array.from({ length: 12 }, () => ({
    x: Math.random(),
    y: Math.random(),
    vx: (Math.random() - 0.5) * 0.003,
    vy: (Math.random() - 0.5) * 0.003,
  }))

  const loop = () => {
    const c = targetMapCanvas!
    const ctx = c.getContext('2d')
    if (!ctx) return
    const w = c.width
    const h = c.height
    ctx.fillStyle = '#f8f9fb'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#dde1e6'
    ctx.lineWidth = 1
    ctx.strokeRect(40, 20, w - 80, h - 40)
    ctx.fillStyle = '#86868b'
    ctx.font = '11px system-ui'
    ctx.fillText('Range →', w - 72, h - 8)

    for (const p of pts) {
      p.x += p.vx
      p.y += p.vy
      if (p.x < 0.05 || p.x > 0.95) p.vx *= -1
      if (p.y < 0.08 || p.y > 0.92) p.vy *= -1
      const px = 40 + p.x * (w - 80)
      const py = 20 + p.y * (h - 40)
      ctx.beginPath()
      ctx.arc(px, py, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#007aff'
      ctx.fill()
    }

    countEl.textContent = String(pts.length)
    targetMapRaf = requestAnimationFrame(loop)
  }
  cancelAnimationFrame(targetMapRaf)
  loop()
}

function bindSettings(): void {
  const form = document.getElementById('form-settings') as HTMLFormElement | null
  if (!form) return
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const fd = new FormData(form)
    const raw = String(fd.get('optionalBleServices') || '')
    const optionalBleServices = raw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
    patchState({
      serverUrl: String(fd.get('serverUrl') || '').trim(),
      sessionId: String(fd.get('sessionId') || '').trim(),
      deviceSn: String(fd.get('deviceSn') || '').trim(),
      deviceModel: String(fd.get('deviceModel') || '').trim(),
      firmwareMainVer: Number(fd.get('firmwareMainVer')) || 0,
      optionalBleServices,
    })
    toast('Settings saved')
    setHash('more')
    navigate()
  })
}

function bindCommands(): void {
  const out = document.getElementById('cmd-output')
  document.getElementById('btn-send-cmd')?.addEventListener('click', async () => {
    const raw = (document.getElementById('cmd-input') as HTMLTextAreaElement)?.value?.trim()
    const useBle = (document.getElementById('cmd-ble') as HTMLInputElement)?.checked
    if (!raw) {
      toast('Enter a command', false)
      return
    }
    if (out) out.textContent = 'Sending…'
    const sess = getActiveSession()
    if (useBle && sess?.connected) {
      try {
        sess.clearRxLog()
        await sess.enqueueWrite(raw.replace(/\s+/g, ' ').trim())
        if (out) out.textContent = sess.rxLog || '(empty — watch Notify log on Configure tab)'
        toast('Sent over BLE')
      } catch (err) {
        if (out) out.textContent = err instanceof Error ? err.message : 'Error'
        toast('BLE send failed', false)
      }
      return
    }
    const res = await sendDeviceCommand(raw)
    if (out) {
      out.textContent = JSON.stringify(
        {
          status: res.status,
          body: res.body,
          ...(res.error ? { detail: res.error } : {}),
        },
        null,
        2
      )
    }
    toast(res.ok ? 'Sent (cloud)' : res.error ?? 'Request finished', res.ok)
  })
  document.getElementById('btn-poll-cmd')?.addEventListener('click', async () => {
    if (out) out.textContent = 'Polling…'
    const res = await pollCommandList()
    if (out) {
      out.textContent = JSON.stringify(
        {
          status: res.status,
          body: res.body,
          ...(res.error ? { detail: res.error } : {}),
        },
        null,
        2
      )
    }
    toast(res.ok ? 'Poll ok' : res.error ?? 'Poll finished', res.ok)
  })
}

function bindConnect(): void {
  document.getElementById('btn-ble-connect')?.addEventListener('click', async () => {
    if (!isWebBluetoothAvailable()) {
      toast('Use Chrome or Edge with HTTPS', false)
      return
    }
    try {
      const s = await connectNewRadar()
      patchState({
        connected: true,
        deviceName: s.meta?.deviceName || 'Radar',
        deviceSn: getState().deviceSn,
      })
      toast('BLE connected')
      navigate()
    } catch (e) {
      const err = e as Error
      if (err?.name === 'NotFoundError') {
        toast(
          'No device selected. If radar is missing: power-cycle it, connect within 5 min, enable phone/laptop location + Bluetooth, then retry.',
          false
        )
      } else if (err?.name === 'SecurityError') {
        toast('Bluetooth is blocked by browser/site permissions. Allow Bluetooth for this site and retry.', false)
      } else if (err?.name === 'TypeError') {
        toast(
          'Picker failed before opening. Check More -> Cloud & BLE IDs and remove malformed custom UUID lines, then retry.',
          false
        )
      } else {
        toast(e instanceof Error ? e.message : 'BLE failed', false)
      }
    }
  })

  document.getElementById('btn-ble-disconnect')?.addEventListener('click', () => {
    disconnectRadar()
    patchState({ connected: false })
    toast('Disconnected')
    navigate()
  })

  document.getElementById('btn-demo')?.addEventListener('click', () => {
    patchState({
      connected: true,
      deviceName: 'Demo radar',
      deviceSn: 'DEMO-001',
    })
    toast('Demo labels set — no RF')
    navigate()
  })

  document.getElementById('btn-clear-session')?.addEventListener('click', () => {
    resetConnection()
    toast('Cleared')
    navigate()
  })
}

function navigate(): void {
  const route = parseRoute()
  const root = document.getElementById('app')
  if (!root) return
  root.innerHTML = shell(route)
  renderMain(route)
  bindChrome()
}

function bindChrome(): void {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const r = (btn as HTMLElement).dataset.route as Route
      if (r) setHash(r)
    })
  })
  document.getElementById('btn-back')?.addEventListener('click', () => {
    setHash('more')
    navigate()
  })
  document.querySelectorAll('[data-go]').forEach((el) => {
    el.addEventListener('click', () => {
      const r = (el as HTMLElement).dataset.go as Route
      if (r) setHash(r)
      navigate()
    })
  })
}

export function initApp(): void {
  window.addEventListener('hashchange', navigate)
  if (!location.hash) setHash('connect')
  navigate()

  window.addEventListener('beforeunload', () => {
    cancelAnimationFrame(targetMapRaf)
    rxUnsub?.()
  })
}
