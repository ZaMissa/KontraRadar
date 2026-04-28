# Radar PWA: What We Learned (Source of Truth)

Last updated: 2026-04-28

This document is the working truth set for reverse-engineered parity between the PWA and the n1 WeChat mini program.
When code behavior and assumptions conflict, this file is the decision anchor until superseded by stronger evidence.

## 1) Device/Firmware facts observed on real hardware

- Product family observed: gate radar (`Gate-BR-1V3` prompt in logs).
- Captured unit:
  - Serial: `1423280291` (short form used in bench naming: `80291`)
  - Hardware: `V131`
  - Firmware: `B013`
  - Version string seen: `BR7702S-V131B013`
- `ReadRadeConfig 2` parsing now reliably handles compact and spaced keys.

## 2) Save behavior truth (critical)

- Firmware may return `Done` and then append `Error -1` shortly after.
- Correct handling: treat `Error` as authoritative even when `Done` appears first.
- Current PWA save diagnostics now:
  - identify exact step and command,
  - include parsed error code,
  - persist full message in Last error panels.

### Known unsupported/fragile opcodes

- `SetParas 10 2 <unix>` (sync time) can return `Error -1` on current firmware family.
- Configure sensitivity write `SetParas 4 2 ...` may be rejected with `Error -1` for some tiers or all tiers.
- Fallback policy in code:
  1. retry lower Configure sensitivity tiers,
  2. then try `SetDetSensitivity ...`,
  3. if both families fail, save is treated as partial (non-sensitivity values sent, sensitivity likely unchanged).

## 3) Advanced page mapping verified from Chinese screenshots

Page title:
- `高级设置` (Advanced settings)

Rows (operator-facing semantics):
- `人车区分` (car/person differentiation)
- `行车方向` (direction mode, left/bidir/right style)
- `继电器状态` (relay mode, normally open/closed)
- `延迟落杆时间` (delay/drop timing)
- `临近不检测距离` (near no-detect distance)
- `左侧不检测区域宽度` / `右侧不检测区域宽度`
- `左侧检测区域宽度` / `右侧检测区域宽度`
- `切割区域 [1..4]` (cut-area rows with configure popup)

## 4) Cut-area format and validation (high confidence)

Popup label:
- `区域切割配置`

Fields:
- enable toggle: `启用状态`
- `X最大值(米)` range `-4.00..4.00`
- `X最小值(米)` range `-4.00..4.00`
- `Y最大值(米)` range `0.00..7.00`
- `Y最小值(米)` range `0.00..7.00`

Observed validation toast:
- `X最小值不能大于X最大值`

Row serialization observed:
- canonical row shape: `enable xMin xMax yMin yMax`
- examples:
  - disabled zero row: `0 0.00 0.00 0.00 0.00`
  - enabled custom row: `1 -1.00 3.00 1.00 2.00`

PWA implementation standard now:
- accepts either 5-field explicit format or 4-field shorthand (`xMin xMax yMin yMax`, assumes enable=1),
- normalizes to canonical 5-field format on save,
- enforces range and min<=max checks before command emission.

## 5) n1 action UX flow observed

Configure/Advanced style action sequence in OEM app:
1. confirm dialog,
2. progress toast (`正在保存配置...` / `读取雷达配置...`),
3. completion toast (`保存配置完成` / `读取配置完成`).

Important: OEM completion toast does not guarantee every command is accepted by firmware.
PWA must keep command-level diagnostics and partial-save messaging.

## 6) Background learning flow facts

Observed prompts include:
- ensure boom is raised before learning,
- keep vehicles out of around +-2.0m area,
- completion toast (`学习完成`).

This flow should remain operator-guided and explicit in PWA wording.

## 7) Unknowns (do not over-interpret yet)

- Exact physical meaning of opaque tuple blocks (`RainVal`, `isCarCFG`, other tuple fields) is still vendor/internal.
- Keep labels neutral and avoid fabricated semantics.
- Continue collecting screenshots and before/after readbacks to tighten mapping.

## 8) Development rules derived from evidence

- Prefer persistent in-page diagnostics over transient toasts for failures.
- For mixed success/failure queues, report partial saves explicitly.
- Keep firmware-aware fallbacks deterministic and visible to operator.
- Validate dangerous input client-side before sending commands (cut bounds, ordering).
