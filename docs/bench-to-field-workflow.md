# Bench-to-Field Workflow (Radar on Table First)

This workflow is for your current constraint: radar is **not mounted on barrier yet**.  
Goal: extract as much truth as possible on bench, lock a safe baseline, and minimize field time.

---

## 0) Safety + expectations

- Bench tests can validate:
  - BLE stability
  - command/read pipeline
  - parser correctness
  - profile capture and rollback flow
- Bench tests **cannot** fully validate:
  - real gate hold/open behavior
  - approach-angle artifacts
  - reflections from real cabinet/road geometry

Treat bench output as **pre-commissioning**, not final acceptance.

---

## 1) Prepare one baseline package per device

For each radar unit (serial):

1. Connect via PWA.
2. Run and copy:
   - `GetSoftwareVersion`
   - `ReadRadeConfig 2` (full block)
3. Save to a text file named:
   - `SN_<serial>__fw_<version>__bench_baseline.txt`

This is your factory rollback anchor.

---

## 2) Bench command stability test (no barrier needed)

Run this sequence 3 times:

1. `ReadRadeConfig 2`  
2. `ReadRadeConfig 2` again  
3. `GetSoftwareVersion`  
4. `COMOutputCfg 8` (10-20 s)  
5. `COMOutputCfg 0`

Pass criteria:
- no disconnect
- no stuck write queue
- logs copied fully (Freeze/Copy works)
- parser fills Advanced + readback-only blocks (`RainVal`, `isCarCFG`)

If this fails on bench, fix now before field trip.

---

## 3) Build a "safe startup profile" on bench

Use conservative settings (not aggressive):

- sensitivity tier: low/balanced (`2 2 2` or `3 3 2`)
- keep `SetCutArea [1..4]` at known-good zeros unless required
- keep `RangeDimensionJudge` / `FalseAlarmFilter` at baseline initially
- geometry placeholders:
  - set `Pole Length` to intended site length (or slightly shorter as OEM suggests)
  - set fixation side according to expected install side

Then:
1. Save queue.
2. Read back (`ReadRadeConfig 2`).
3. Verify all intended keys match.

Export this as:
- `SN_<serial>__startup_profile.txt`

---

## 4) Diff discipline (bench)

For every experiment:

1. Read + copy **before**.
2. Change exactly one logical group.
3. Save.
4. Read + copy **after**.
5. Record what changed.

Use this format:

- change id:
- commands sent:
- before excerpt:
- after excerpt:
- interpretation:

This creates a local knowledge base for opaque tuple fields.

---

## 5) What to postpone for field (must be on real barrier)

Do **not** sign off these on bench:

- final sensitivity aggressiveness
- final left/right widths and blind corridors
- trigger tuple tuning for real traffic
- rain behavior validation
- any anti-crush claim

---

## 6) Field checklist (short, high-impact)

Bring:
- bench baseline file
- startup profile file
- laptop + browser ready

On-site sequence:

1. Install and wire per OEM manual.
2. Confirm model/firmware.
3. Load startup profile settings.
4. Read back and confirm values.
5. Run minimum functional tests:
   - vehicle present under boom -> hold/open behavior correct
   - no vehicle -> normal close
6. Do small tuning only if needed:
   - first: geometry widths / near blind
   - second: sensitivity tier
   - third: advanced tuples
7. Capture final accepted `ReadRadeConfig 2`:
   - `SN_<serial>__field_final.txt`

---

## 7) Data you should send back after bench

Send these so we can pre-compute likely field tuning:

1. `GetSoftwareVersion`
2. full baseline `ReadRadeConfig 2`
3. startup-profile `ReadRadeConfig 2`
4. one 20-30 s `COMOutputCfg 8` sample
5. note intended installation:
   - side (left/right fixed)
   - arm type
   - arm length
   - expected vehicle mix

With this, we can produce:
- a recommended first field profile
- a small "if symptom X -> change Y" decision table.

