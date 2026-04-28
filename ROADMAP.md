# Radar PWA — feature roadmap & vendor parity

Scope: standalone **Web Bluetooth** PWA under `radar-pwa/`, mirroring ASCII command behavior from the decompiled WeChat bundle **`n1/`** (毫米波雷达调试助手). This file tracks **what exists today**, **what could still be built**, and **what is intentionally out of scope** for a browser.

**Status legend**

| Tag | Meaning |
|-----|---------|
| **Done** | Implemented and wired in the UI |
| **Partial** | Works but incomplete, demo-only, or depends on your backend |
| **Not started** | Feasible and aligned with `n1`; not implemented |
| **Blocked / unlikely** | WeChat-only, native DFU, or impractical in Web Bluetooth |

---

## 1. Core platform

| Feature | Status | Notes |
|---------|--------|--------|
| Web Bluetooth device picker | **Done** | `radar-session.ts`, `bluetooth.ts` |
| GATT discovery (vendor service / write / notify heuristics) | **Done** | Optional UUID list in Settings |
| ASCII lines + `0x0A` framing (`stringToBlePayload`) | **Done** | `protocol.ts` |
| Write queue + notify aggregation + `rxLog` | **Done** | `radar-session.ts` |
| Wait for regex in RX (`waitForText`) | **Done** | Used after reads / scripted sends |
| Persist settings (API URL, UUIDs, model, FW, labels) | **Done** | `state.ts` → `localStorage` |
| Offline “demo session” labels | **Done** | Connect tab — no RF |
| PWA shell + routing + service worker | **Done** | `app.ts`, `public/sw.js` |

---

## 2. Configure tab (vendor “configure” page)

| Feature | Status | Notes |
|---------|--------|--------|
| Sensitivity ring + level presets (`LEVEL_CODES`) | **Done** | Syncs with `SetParas 4 2 …` |
| Approach side (`SimpleCfgCommon 6 2`) | **Done** | |
| Barrier type (`SetGatePoleType`) | **Done** | |
| Arm length (`SetPoleLength` cm) | **Done** | |
| Near blind zone (`SimpleCfgCommon 2 2`) | **Done** | |
| Save batch (`buildConfigureCommands`) | **Done** | |
| Read `ReadRadeConfig 2` | **Done** | Also fills the form when keys parse |
| Parse read reply into Configure UI | **Done** | `parseReadRadeConfigToConfigure` — `GateFixation`, `GatePoleType`, `PoleLength`, `SensitiveInfo` (level), `YLimitWidth` (`app.ts`) |
| Extra configure read keys (`RainVal`, `CarPassMinTime`, …) | **Not started** | Optional parity with full n1 configure `setfalg` |
| Sync time (`SetParas 10 2` unix) | **Done** | |
| Get software version | **Done** | `GetSoftwareVersion` |
| Multi-step read chain (`SetSubDoppler` preset, etc.) | **Partial** | Command exists in `n1-commands.ts`; no guided wizard like `n1` |

---

## 3. Advanced tab (vendor `pages/config/settings`)

| Feature | Status | Notes |
|---------|--------|--------|
| Full save queue (`buildAdvancedSaveCommands`) | **Done** | Judgement, direction, GPIO, BLE flag, sensitivity paths, widths, `SetParas`, `TriggerParas`, cut areas, `SimpleCfgCommon 16 2`, … |
| Model + FW fields for sensitivity math | **Done** | Also in global Settings |
| Read `ReadRadeConfig 2` | **Done** | |
| Parse reply → auto-fill form (`parse-read-config.ts`) | **Done** | Mirrors advanced `setfalg` keys (`JudgeSwitch`, `SensitiveInfo`, `SetCutArea`, …) |
| Reboot / factory reset commands | **Done** | Buttons send `reboot` / `ResetRadeConfig` |
| Pole-learning / calibration flows | **Not started** | Large `n1` surface (steps, timers, UI modals) |
| BR7702-specific relay quirks in parser | **Partial** | Generic mapping; vendor branches on model/FW/relay type |

---

## 4. Instruction console

| Feature | Status | Notes |
|---------|--------|--------|
| Send arbitrary ASCII line | **Done** | |
| Optional wait for `Done` | **Done** | |
| Parse reply → jump to Advanced & fill form | **Done** | **Fill Advanced from reply** — `sessionStorage` handoff + `consumePendingAdvancedParse` (`pages-n1.ts`) |

---

## 5. Targets tab

| Feature | Status | Notes |
|---------|--------|--------|
| Plan-view visualization | **Partial** | Animated **demo** scatter — not tied to device |
| `COMOutputCfg 8` / `0` (start/stop stream) | **Done** | `pages-n1.ts` |
| Decode COM/UART binary target protocol | **Not started** | Vendor uses ECharts + device-specific framing |
| Mirror notify stream into chart from real data | **Not started** | Needs format spec or reverse engineering |

---

## 6. Cloud & command console

| Feature | Status | Notes |
|---------|--------|--------|
| POST command (`/noauth/commands`) | **Done** | `api.ts` — shape from `n1` HTTP helpers |
| Poll command list (`/noauth/querydevice/commandlist`) | **Done** | |
| HTTP error detail + one network retry | **Done** | Summaries + body `message`; retry on transient failure (`api.ts`) |
| TLS / cookies / vendor auth | **Partial** | Your server must accept the payloads; no WeChat login |
| Remote config execution without BLE | **Partial** | Same APIs; behavior depends on cloud pairing |

---

## 7. Firmware / upgrade

| Feature | Status | Notes |
|---------|--------|--------|
| Nordic-like DFU service + AT/bootstrap sequence | **Blocked / unlikely** | Documented on Firmware page; Web Bluetooth lacks same Android/iOS DFU ergonomics |
| Local file picker placeholder | **Done** | No upload pipeline wired |

---

## 8. Remote support & identity

| Feature | Status | Notes |
|---------|--------|--------|
| Display session id / serial | **Done** | Support page |
| MQTT / live remote session (`n1`) | **Not started** | Needs broker + policy |
| WeChat OAuth / tenant login | **Blocked / unlikely** | Not applicable to open web PWA |

---

## 9. Parser / config coverage (technical backlog)

| Area | Status | Notes |
|------|--------|--------|
| Advanced keys in `parse-read-config.ts` | **Done** | Large subset of `ReadRadeConfig` text keys |
| Configure-tab core keys | **Partial** | `GateFixation`, `GatePoleType`, `PoleLength`, `SensitiveInfo`, `YLimitWidth` — not `RainVal` / `CarPassMinTime` / etc. |
| `PowerCheckProcess` → UI | **Not started** | Parsed in vendor app in some builds |
| Unit tests (`vitest`) | **Partial** | `npm test` — `parse-read-config.test.ts`; extend as needed |

---

## 10. Suggested implementation order (optional)

1. ~~**Configure read → form**~~ — **Done** (core keys).
2. ~~**Instructions: apply read to Advanced**~~ — **Done** (**Fill Advanced from reply**).
3. **Target stream decode** — still **open**: needs a binary/text format capture from hardware.
4. **Tests** — **started** (`vitest`); add golden logs from real devices when available.
5. **Cloud hardening** — **partially done** (retry + HTTP summaries); auth / cookies remain product-specific.

---

*Last updated (`radar-pwa/`, April 2026).*
