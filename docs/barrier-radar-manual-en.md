# User Manual — 79 GHz Millimeter-Wave Anti-Crush Radar (Full Barrier Types)

English translation of the OEM user manual (Chinese source).

---

## I. Precautions

When using this 79 GHz millimeter-wave barrier anti-crush radar, follow these precautions:

1. Configure operating parameters for your site using this manual as a reference.
2. Choose a suitable mounting height—installation that is too low or too high can cause the radar to fail.
3. Connect signal wires and the barrier controller interfaces correctly, as described in this manual.
4. Power the radar only with a **dedicated 12 V DC, 1 A** supply. **Do not** connect it to **220 V AC**.

---

## II. Interface Description

| No. | Wire color | Label | Description |
|-----|------------|--------|-------------|
| 1 | Red | VCC | 12 V DC positive |
| 2 | Black | GND | 12 V DC negative / ground |
| 3 | White | TX | RS-485 B / TTL (default: TTL) |
| 4 | Purple | RX | RS-485 A / TTL (default: TTL) |
| 5 | Blue | Common | Normally open relay output (common side) |
| 6 | Orange | Loop / presence | Normally open relay output (loop side) |
| 7 | Green | — | Configuration button |
| 8 | Yellow | — | (refer to product wiring diagram) |

**Note:** Always **disconnect power** before wiring, unplugging, or changing connections. **Do not** let the **white** or **purple** wires touch the **12 V positive** supply.

---

## III. Radar Installation

### (1) Mounting position

Mount the radar flush on the barrier cabinet or on a dedicated pole, with the **indicator facing upward**.

- **Cars / light vehicles:** recommended height (distance from road surface to the radar indicator): **0.65 m–0.7 m**.
- **Trucks / large vehicles:** recommended height **0.9 m–1.1 m**.
- **Mixed traffic (large + small vehicles):** use **two radars** at **0.65–0.7 m** and **0.9–1.1 m** respectively.

**Horizontal placement (distance from boom):**

- Straight boom: **10–20 cm** from the boom.
- Non-straight boom: **20–30 cm** from the boom.

Consult the OEM diagram for left/right mounting illustrations.

**Note:** The radar face should protrude or be flush with adjacent surfaces—not recessed. Within **1.5 m on each side** there must be **no obstacles**, or detection may be disturbed.

### (2) Drill and fix

Drill mounting holes using a **Φ 8 mm** bit. After routing and fixing holes are prepared, pass the cable through the center hole and tighten fasteners so the radar cannot move. Usually **one routing hole plus one fixing hole** is enough.

### (3) Adhesive mounting (optional)

Instead of screws, you may fix the radar with adhesive (e.g. **3M** tape) around the perimeter; press firmly.

### (4) Connection to the barrier

Connect **red** and **black** to the barrier’s **12 V** positive and negative. Connect **blue** to the barrier board **common** and **orange** to the barrier **loop / presence** input. **Purple and white** do **not** need to go to the barrier controller for basic operation (confirm against your barrier wiring diagram).

Refer to the OEM **outline / installation drawing**.

---

## IV. Radar Commissioning

### (1) Before commissioning — enable Bluetooth

- **Method A (automatic):** Bluetooth is **on by default** after power-on. If **no device connects within 5 minutes**, Bluetooth turns **off** automatically.
- **Method B (manual):** Press and hold the button until the red/green LEDs **flash once**, release, then **short-press** once until the indicator shows **double yellow**; wait **3 s**—Bluetooth is on. If **no connection within 5 minutes**, Bluetooth turns **off** automatically.

**Note:** Method A is usually simplest.

### (2) Open the configuration app

Turn on **phone Bluetooth** and **location**. On the original product, use the WeChat mini program **“毫米波雷达调试工具”** (mmWave radar debug tool) or scan the OEM QR code. Allow **Bluetooth** and **location**. On the **Connect** screen, tap **Connect Bluetooth device**.

*(This project’s **Radar Debug PWA** is an English-friendly alternative when served over HTTPS with a compatible browser.)*

### (3) Connect to the radar

In the device picker, choose **`79G-Radar` [number]** and connect. **[Number]** corresponds to the device **serial number** on the unit.

**If connection fails:**

1. Confirm the app has **Bluetooth** and **location** permission.
2. Power-cycle the radar and try again.

### (4) Radar configuration

After this section, the radar is normally ready; extra settings are rarely needed.

1. Set **vehicle type**, **boom type**, and **boom length** — length is often set **about 0.5 m shorter** than the actual boom.
2. Set **mounting side**: facing the radar from behind the boom, boom on the **left** = **left-fixed**; boom on the **right** = **right-fixed**.
3. Tap **Save radar configuration**.
4. Raise the boom; ensure **no people within 1.5 m** on either side of the radar; run **Raise-background learning** until complete.
5. Again ensure **no people within 1.5 m** on either side; run **Boom up/down learning** and cycle the boom with the remote until complete.
6. Lower the boom fully. When the radar indicator **green light goes off**, **self-learning** runs: keep **no entry within 1.5 m** on either side for **30 s** until self-learning completes.

Commissioning is then complete.

**Note:** If you change **boom length**, **boom type**, or **fixed side**, repeat from **step 3** onward; skipping this can cause **vehicle strike** incidents.

---

## V. Frequently Asked Issues / Tips

1. The barrier cabinet or pole must be **rigidly fixed**—loose structures can make the radar behave erratically.
2. **Bent or deformed booms** should be repaired—deformation can cause **false targets**.
3. There must be **no objects** in the detection zone that block targets; **no protrusions** (e.g. metal guardrails, ANPR housings, walls) **within 1.5 m** to the sides, or detection may degrade.
4. For **mixed large/small vehicles**, a **single radar** may not be safe; **two radars** are recommended (e.g. one near **~1.1 m** for large vehicles, one near **~0.65 m** for small ones).
5. If vehicles approach at **large angles** (severe skew in/out), use **cones or guides** to straighten paths, and **contact factory technical support** if needed.
