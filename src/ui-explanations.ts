/**
 * In-app help text: bridges OEM manual (`docs/barrier-radar-manual-en.md`) with behaviour
 * inferred from the WeChat bundle `n1/` (ASCII opcodes, `ReadRadeConfig`, save queues).
 * Strings are static HTML fragments for trusted innerHTML insertion only.
 */

/** Collapse source whitespace so multi-line strings render as one readable paragraph in HTML. */
export function collapseHelpWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

export const connect = {
  heroBody: `The 79 GHz barrier radar is commissioned over Bluetooth like the OEM WeChat tool
    (<span lang="zh">毫米波雷达调试工具</span>). This PWA sends the same style of line commands with a trailing
    line feed (LF), matching <code>n1</code> <code>string2buffer</code>.`,
  btSession: `Per the OEM manual, Bluetooth may be on at power-on and can turn off automatically after about
    five minutes without a connection — reconnect if the device disappears from the picker. Pick the radar
    (often named like <code>79G-Radar</code> plus digits tied to serial), grant browser Bluetooth access,
    Chrome or Edge on HTTPS or localhost.`,
  gattCard: `Commands go out on a vendor write characteristic; replies stream on notify as ASCII text (plus
    firmware acknowledgements such as <code>Done</code>). UUIDs vary by firmware — add optional service IDs
    under More so the browser can enumerate your module.`,
  demo: `Sets friendly labels only. No RF traffic; use it to explore the UI without hardware.`,
  storedLabels: `Copies serial/name-style labels into local storage for forms and remote-support notes; they do
    not authenticate the radar by themselves.`,
} as const

/** Shown near sensitivity controls — triples are not distances. */
export const sensitivityTriplesFold = `Those three digits are one <strong>preset token</strong> baked into the vendor firmware
    (same rows as the Chinese WeChat tool’s level table). They are <em>not</em> metres, kilometres, or timer seconds — you can
    think of them as an opaque “recipe ID” the DSP uses for thresholds. Higher steps on this screen generally move toward
    stronger reactions, but always confirm with walk tests because mounting and clutter dominate real behaviour.` as const

export const configure = {
  lede: `Matches the vendor “configure” workflow: sensitivity preset, which side vehicles approach from, boom
    (barrier arm) shape and effective length, and near-range suppression — then push the batch or read values
    back. After changing boom length, arm type, or fixed side, the OEM manual requires repeating background /
    boom learning on site; this web app now includes a guided lifting background-learning trigger and captures
    learning-related notify markers in the live log.`,
  sensitivity: `Five discrete presets encoded as <code>SetParas 4 2</code> level strings (same triples as
    <code>n1</code> <code>levelCodes</code>). Higher bands generally demand cleaner mounting: keep the radar
    rigid, avoid bent booms and obstacles within about 1.5 m to the sides (manual FAQ).`,
  barrierLayout: `<strong>Approach side</strong> follows the manual: standing behind the boom, if the boom is on
    your left choose left-fixed; if on your right, right-fixed — this maps to <code>SimpleCfgCommon 6 2</code>.
    <strong>Arm type</strong> selects straight vs fence/advertising arms (<code>SetGatePoleType</code>).
    <strong>Length</strong> is sent in centimetres via <code>SetPoleLength</code>; installers often set it
    slightly shorter than the physical boom (manual suggests about 0.5 m shorter). <strong>Near ignore</strong>
    expands the blind region very close to the radar (<code>SimpleCfgCommon 2 2</code>) to reduce ground clutter.`,
  actions: `<strong>Read config</strong> sends <code>ReadRadeConfig 2</code> and fills these controls when the
    reply contains lines such as <code>GateFixation</code>, <code>PoleLength</code>, etc.
    <strong>Save to radar</strong> queues the same command bundle the mini program builds for basic commissioning.
    <strong>Lifting learn</strong> runs <code>SetBGLearnStatus 2</code> with safety prompts and watches the notify
    stream for <code>Done</code>/<code>Error</code>/<code>Learn</code>/<code>Finish</code> markers.
    <strong>Sync time</strong> pushes Unix time (<code>SetParas 10 2</code>). <strong>Get version</strong> asks the
    firmware identity — use it with Settings model/FW for advanced sensitivity math.`,
  liveLog: `Mirrors the notify stream: human-readable keys, commas, and <code>Done</code> endings as in vendor logs.
    Use it to verify saves or to copy text into Instruction console parsing.`,
} as const

export const target = {
  lede: `Plan view matches vendor semantics: horizontal axis is down-range (m), vertical axis is across-track (m).
    After <code>COMOutputCfg 8</code>, the firmware emits ASCII lines like <code>x=… ,y=… ,p=…</code> on the same BLE
    notify channel — dots here are parsed from that log (latest <code>Frame:</code> block when present).`,
  extras: `<code>COMOutputCfg 8</code> starts forwarding target-style output on the serial/BLE path;
    <code>COMOutputCfg 0</code> stops it (same as <code>n1</code> 目标图). The tail of the notify buffer is mirrored below for debugging.`,
} as const

export const more = {
  lede: `Surfaces tools that lived under separate tabs in <code>n1</code>: deep parameter pages, a raw opcode
    console, optional cloud relay, firmware notes, and support metadata — grouped for installers who prefer
    English.`,
  cardAdvanced: `Full judgement / GPIO / TriggerParas / cut-mask queue — same danger as OEM “advanced settings”.`,
  cardInstructions: `Raw ASCII lines with LF, like <span lang="zh">指令调试</span>; use after basic commissioning.`,
  cardSettings: `Optional HTTPS gateway plus BLE UUID hints — mirrors <code>n1</code> cloud hooks without WeChat login.`,
  cardFirmware: `DFU is vendor tooling; this entry documents limits and local file slot.`,
  cardCommands: `Single-line POST to BLE or cloud <code>commands</code> endpoint — field remote control.`,
  cardSupport: `Session id / serial for pairing with factory support — extend with MQTT if you bridge <code>n1</code> remotely.`,
} as const

export const settings = {
  lede: `Optional cloud path mirrors vendor HTTPS routes under
    <code>/api/csnw/mgmt/wechat/miniprogram/noauth/</code>. The PWA does not perform WeChat login; your backend
    must accept the JSON body if you rely on remote commands.`,
  serverUrl: `Base URL for POST <code>commands</code> and poll <code>querydevice/commandlist</code>, as in
    <code>n1</code> <code>httpcomm.js</code>.`,
  sessionId: `Session or user id forwarded in cloud requests — analogous to vendor “remote support” pairing when
    a tunnel is available.`,
  deviceSn: `Device serial label for logs and cloud payloads; should match the number printed on the unit (manual:
    picker name includes that id).`,
  deviceModel: `Used with firmware version to branch sensitivity math (<code>SetDetSensitivity</code> /
    <code>SimpleCfgCommon 8 2</code>) the way <code>n1</code> uses <code>globalData.deviceModel</code> (e.g.
    BR7702S vs BR7901A families).`,
  firmwareMainVer: `Main firmware integer from <code>GetSoftwareVersion</code> or OEM records; several opcodes
    change behaviour above specific cut-offs (see advanced save / parser).`,
  optionalBleServices: `Web Bluetooth filters discoverable services. If Chrome never shows your radar, paste the
    vendor 128-bit UUIDs from the datasheet; disconnect and reconnect after saving so the picker requests them.`,
} as const

export const commands = {
  lede: `Send a single ASCII line per submission — the stack adds LF exactly like <code>n1</code>. Choose BLE for
    direct radar access or cloud when your gateway should relay the same string.`,
  poll: `Poll pulls the latest cloud command queue entry — useful when another client issued remote instructions.`,
} as const

/** Opaque OEM modes — honest about documentation gap. */
/** Long rows of integers — honest explanation */
export const spaceTuplesFold = `Lines like <code>1 40 1 10</code> are packed <strong>DSP parameters</strong>, not latitude/longitude.
    Unless you have the factory tuning sheet for your exact firmware, rely on <code>Read ReadRadeConfig</code>, adjust one
    field at a time, and walk-test after each save — the OEM manual warns that wrong tuning can strike vehicles.` as const

export const judgePassModesFold = `The vendor mini program exposes <strong>Judge A / B</strong>, <strong>pass direction 1–3</strong>,
    and similar items without a public English field-by-field spec. In practice they select different internal decision
    paths for “when is a vehicle really there?”. Treat the numbers like saved factory recipes: after
    <code>Read ReadRadeConfig</code>, note what worked on site and change one control at a time.` as const

export const advanced = {
  intro: `Vendor “advanced settings” page in <code>n1</code>: judgement, relay polarity, reporting flags,
    sensitivity internals, geometric masks, and trigger pipelines. Wrong values can open the barrier when unsafe —
    same crush hazard as the OEM warning.`,
  deviceProfile: `Model and main firmware drive counter thresholds for delay/false-alarm tuning (mini program
    <code>globalData</code>). Align with <strong>GetSoftwareVersion</strong> or the label on the enclosure.`,
  judgeBlock: `<strong>Judge A/B</strong> selects which detection track the barrier logic trusts
    (<code>SetJudgeTarActive</code>). <strong>Pass direction</strong> tells the radar which travel direction counts
    as an approach (<code>SetPassDirection</code>). <strong>Gate relay GPIO</strong> sets active-low vs active-high
    drive to the barrier controller’s relay inputs (manual: blue common / orange loop — polarities must match your
    controller). <strong>BLE flag</strong> toggles whether status is emitted on the Bluetooth channel
    (<code>SetParas 4 2</code> in this context).`,
  sensitivityBlock: `Pick the <strong>named tier</strong> first — the three numbers beside it are the exact token the
    radar expects (see “Why three numbers?” below). Light-off delay is easier: seconds until outputs relax after a
    detection. “SimpleCfg 8 2” switches some firmware builds to a millisecond delay path instead of
    <code>SetDetSensitivity</code>.`,
  distancesBlock: `These fields use <strong>real units where marked (cm)</strong>: near blind distance, blind strips
    beside the boom, and left/right corridor width — align with how far the radar sits from the gate arm (manual:
    typically 10–20 cm straight arm, 20–30 cm non-straight).`,
  rangeBlock: `Expert tuning: filters for “does this blob look like a real vehicle?” vs reflections from rails,
    walls, or skewed paths (manual FAQ). Prefer defaults until you know the site is misbehaving.`,
  triggerBlock: `Each row is one <code>TriggerParas x 2 …</code> command. Numbers enable gates for speed / trace /
    zones — treat them like firmware recipes; copy from a good readback before improvising.`,
  cutBlock: `<strong>SetCutArea</strong> masks regions in device coordinate form so the radar ignores volumes
    (side foliage, signage). <strong>Light follow</strong> pairs with <code>SimpleCfgCommon 16 2</code> for barrier
    lighting behaviour after a passage.`,
  actions: `<strong>Read ReadRadeConfig 2</strong> dumps a text report; this app parses KEY lines into the form.
    <strong>Save queue</strong> replays the vendor save sequence. <strong>reboot</strong> restarts the radar CPU;
    <strong>ResetRadeConfig</strong> restores factory radar parameters — expect to re-commission on site.`,
} as const

export const instructions = {
  lede: `Same role as <span lang="zh">指令调试</span>: experiment with any supported opcode line without walking
    through form fields. Responses concatenate in the notify log; wait for <code>Done</code> when the firmware
    acknowledges.`,
  fillAdvanced: `Parses a prior <code>ReadRadeConfig</code>-style reply (from the box below or the live session
    buffer) and jumps to Radar advanced to populate fields — convenient after copying logs.`,
} as const

export const firmware = {
  lede: `Production firmware upgrades on the OEM side use a Nordic DFU-style service and binary chunks after AT
    bootstrap (<code>n1</code> upgrade page). Web Bluetooth in the browser does not replicate that flow reliably, so
    use the vendor PC tool or WeChat uploader for field releases. Day-two maintenance commands still work over the
    main data characteristic.`,
  fileInput: `Placeholder for local packages — wire your own upload handler if you host a compatible gateway.`,
} as const

export const support = {
  lede: `Full remote desktop in <code>n1</code> combines MQTT, cloud affirmations, and serial tunnels. This PWA
    only stores identifiers you type — extend with your ticketing URL, MQTT credentials, or factory hotline.`,
  footer: `For mounting, wiring (12 V DC only), commissioning sequence, and safety clearances, see the OEM PDF in
    <code>radar-pwa/docs/barrier-radar-manual-en.md</code>.`,
} as const

export const docsRef = `Context for these hints: English OEM manual (<code>docs/barrier-radar-manual-en.md</code>)
  plus opcode names from decompiled WeChat bundle <code>n1/</code>.`
