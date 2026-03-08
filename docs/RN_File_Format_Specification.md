# Race Navigator File Format Specification

> Based on: **Race Navigator Files Format Specification rev 1.1**  
> Schema: `LapDataSchema_6.xsd` (namespace: `http://macrix.eu/racenavigator/LapDataSchema`, schema version 5)  
> Sample file: `20240528_133327794_RNPRO-383_Lap_10_1min25sec019.rnz`  
> Vehicle: **Maserati MC20 – 003** · Circuit: **Autodromo di Varano** (2 350 m) · Lap 10 · 1:25.019

---

## 1. Container: `.rnz`

A `.rnz` file is a standard **ZIP archive** with a custom extension. It contains:

| File | Extension | Format | Purpose |
|---|---|---|---|
| Lap data | `.rn` | UTF-8 XML | Full structured lap record (track definition + telemetry) |
| CAN data | `.cdrn` | UTF-8 CSV (semicolon) | Raw CAN/OBD channel log (ABS, ESP, ASR, …) |

### 1.1 ZIP Comment (metadata header)

The ZIP's comment block encodes key export metadata as `Key=Value` lines. This allows quick access to lap identity without parsing the XML:

```
EventName=Varano Long
EventStartTime=2024-05-28 13:17:42.599
Driver=Driver 02
LapTime=00:01:25.019
LapNumber=10
LapStartTime=2024-05-28 13:33:27.794
VehicleModel=MC20 - 003
VehicleNumber=3
SourceDeviceName=RNPRO-383
SourceLapId=5490
ExportDeviceName=RNA4Win-MSI
ExportDeviceVersion=1.16.5.0
ExportDeviceTime=2025-05-09 08:15:08.186
ExportDataVersion=5
IsStartLineCrossed=true
IsEndLineCrossed=true
TrackVariantId=10DAFF9D-E360-458D-9300-9D6DC05C9D1A
VideoLocationType_0=20240528_133002074_RNPRO-383_Driver_02_Lap_10_1min25sec019.mp4
LapType=0
EventType=11
```

---

## 2. Lap Data File (`.rn`) — XML Structure

The root element is `<lapData>` with the following top-level attributes:

```xml
<lapData
  exportDeviceName="RNA4Win-MSI"
  exportDeviceVersion="1.16.5.0"
  exportDeviceTime="2025-05-09 08:15:08.186"
  exportDataVersion="5"
  sourceDeviceName="RNPRO-383"
  lastExportRnDeviceName="RNPRO-383">
```

### Top-level child elements (in order)

| Element | Purpose |
|---|---|
| `<lap>` | Lap metadata (number, time window, flags) |
| `<driver>` | Driver identity |
| `<vehicle>` | Vehicle identity |
| `<event>` | Session/event metadata |
| `<track>` | Track master record |
| `<trackVariant>` | Variant definition with full geometric layout |
| `<measurements>` | Time-series telemetry samples |
| `<lapSectors>` | Sector timing sub-records |
| `<videos>` | Video file references |

---

## 3. Track Definition

### 3.1 `<track>` — master record

```xml
<track>
  <id>F98C81CF-3B3E-4AAB-8C36-552C07AC1B1E</id>
  <name>Varano</name>
  <distance>2350</distance>      <!-- metres -->
  <width>15</width>              <!-- metres, xs:byte → max 127 m -->
  <definitionModificationDate>2022-04-12 09:10:08.000</definitionModificationDate>
  <isDeleted>0</isDeleted>
  <timeZoneContinent>Europe</timeZoneContinent>
  <timeZoneCity>Rome</timeZoneCity>
  <trackType>0</trackType>       <!-- -1=Unknown, 0=Normal, 1=Rally -->
</track>
```

### 3.2 `<trackVariant>` — geometric layout

A track can have multiple variants (configurations). Each variant embeds its full geometry inside `<trackDataXml><definition>`:

```xml
<trackVariant>
  <id>10DAFF9D-E360-458D-9300-9D6DC05C9D1A</id>
  <name>Varano Long</name>
  <distance>2350</distance>       <!-- xs:int, metres -->
  <width>15.0</width>             <!-- xs:double, metres -->
  <isHistorical>false</isHistorical>
  <isPreinstalled>false</isPreinstalled>
  <trackDataXml>
    <definition>
      <!-- startLine, endLine, sectors, curves, picture -->
    </definition>
  </trackDataXml>
</trackVariant>
```

### 3.3 `<location>` — the fundamental geometry type

All geometric primitives are composed of `<referencePoint>` elements:

```xml
<referencePoint
  latitude="44.6809246638384"      <!-- WGS-84, xs:double -->
  longitude="10.02104513456251"    <!-- WGS-84, xs:double -->
  direction="90.9515696382"        <!-- heading in degrees, 0=North clockwise -->
  description="" />
```

### 3.4 `<startLine>` and `<endLine>`

A transverse line across the track defined by **3 reference points** (left edge, centre, right edge). For Varano Long, start = finish:

```xml
<startLine>
  <referencePoints>
    <!-- left boundary -->
    <referencePoint latitude="44.6809246638384"  longitude="10.02104513456251" direction="90.9516" description="" />
    <!-- centre -->
    <referencePoint latitude="44.680699950021847" longitude="10.021037922474539" direction="90.9516" description="" />
    <!-- right boundary -->
    <referencePoint latitude="44.68044294765965"  longitude="10.02103007018594"  direction="90.9516" description="" />
  </referencePoints>
</startLine>
```

### 3.5 `<sectors>` — timing sectors

Sector lines follow the same 3-point convention. Varano Long has **2 sectors**:

```xml
<sector description="Sector Line 1">
  <referencePoints>
    <referencePoint latitude="44.681828093480313" longitude="10.02412080475033"  direction="263.4634" description="" />
    <referencePoint latitude="44.681667668763353" longitude="10.024151978639139" direction="263.4634" description="" />
    <referencePoint latitude="44.68154488446001"  longitude="10.024179018864411" direction="263.4634" description="" />
  </referencePoints>
</sector>

<sector description="Sector Line 2">
  <referencePoints>
    <referencePoint latitude="44.681607352844807" longitude="10.017790904122631" direction="283.4615" description="" />
    <referencePoint latitude="44.681468359951083" longitude="10.01774454078612"  direction="283.4615" description="" />
    <referencePoint latitude="44.681344045707682" longitude="10.0177005021053"  direction="283.4615" description="" />
  </referencePoints>
</sector>
```

### 3.6 `<curves>` — the corridor definition ⭐

This is the **most important element for the Ideallinie corridor builder**. Each curve is a polyline of reference points tracing the **centreline of the track** through that section. The RN device uses these to correlate the car's GPS position to a known track segment.

Varano Long has **10 curves** with between 9 and 26 reference points each.

#### Curve 1 — main straight into first chicane (19 pts)

A nearly straight section, `direction` stays near 90° (heading East):

```xml
<curve description="Curve 1">
  <referencePoints>
    <referencePoint latitude="44.680658942048687" longitude="10.021052976356341" direction="91.909" description="" />
    <referencePoint latitude="44.680643600817547" longitude="10.021699803725429" direction="91.510" description="" />
    <referencePoint latitude="44.680634999872289" longitude="10.02215915471322"  direction="88.749" description="" />
    <referencePoint latitude="44.680641449338687" longitude="10.0225739878521"   direction="87.699" description="" />
    <referencePoint latitude="44.680651666464478" longitude="10.02293166972464"  direction="84.167" description="" />
    <referencePoint latitude="44.680677030285672" longitude="10.02328074680268"  direction="83.564" description="" />
    <referencePoint latitude="44.680697743151818" longitude="10.02353904309032"  direction="79.231" description="" />
    <referencePoint latitude="44.680734970749647" longitude="10.023814214113351" direction="78.124" description="" />
    <referencePoint latitude="44.68077222629374"  longitude="10.0240632720026"   direction="74.085" description="" />
    <referencePoint latitude="44.680798447976983" longitude="10.024192573743051" direction="62.809" description="" />
    <!-- direction drops sharply → turn begins -->
    <referencePoint latitude="44.680825691648543" longitude="10.02426714723226"  direction="49.892" description="" />
    <referencePoint latitude="44.680860977826043" longitude="10.0243260419031"   direction="42.420" description="" />
    <referencePoint latitude="44.680896290880632" longitude="10.02437139532104"  direction="29.007" description="" />
    <referencePoint latitude="44.680928417830522" longitude="10.0243964485326"   direction="21.601" description="" />
    <referencePoint latitude="44.680965390522452" longitude="10.0244170318927"   direction="14.618" description="" />
    <referencePoint latitude="44.681021681696"    longitude="10.024437673632381" direction="11.961" description="" />
    <referencePoint latitude="44.681082777696432" longitude="10.0244558810952"   direction="12.776" description="" />
    <referencePoint latitude="44.681132617864563" longitude="10.02447176746012"  direction="10.376" description="" />
    <referencePoint latitude="44.681183014886123" longitude="10.024484730076461" direction="10.376" description="" />
  </referencePoints>
</curve>
```

The `direction` change from 91° → 10° over 19 points reveals the right-hand turn. **The rate of change of `direction` is a direct proxy for track curvature** — exactly what the corridor builder needs.

#### Curve 2 — left-right chicane exit (13 pts)

```xml
<curve description="Curve 2">
  <referencePoints>
    <referencePoint latitude="44.681190403645957" longitude="10.02448744917397"  direction="15.397" description="" />
    <referencePoint latitude="44.681254685178928" longitude="10.024512342148791" direction="29.772" description="" />
    <referencePoint latitude="44.681310919084552" longitude="10.02455755855852"  direction="43.541" description="" />
    <referencePoint latitude="44.681343047645527" longitude="10.024600499774269" direction="59.727" description="" />
    <referencePoint latitude="44.68137030913077"  longitude="10.02466612768322"  direction="66.919" description="" />
    <referencePoint latitude="44.6813990703274"   longitude="10.02476098523859"  direction="74.713" description="" />
    <referencePoint latitude="44.6814214167403"   longitude="10.02487586832161"  direction="81.043" description="" />
    <referencePoint latitude="44.681442084236522" longitude="10.025060233342741" direction="85.919" description="" />
    <referencePoint latitude="44.681451615271243" longitude="10.025247991562431" direction="87.419" description="" />
    <referencePoint latitude="44.68146012991383"  longitude="10.02551395686779"  direction="89.295" description="" />
    <referencePoint latitude="44.681464973273833" longitude="10.02606617913875"  direction="89.400" description="" />
    <referencePoint latitude="44.681469926286617" longitude="10.026729970510591" direction="88.691" description="" />
    <referencePoint latitude="44.681479514268759" longitude="10.02731963505722"  direction="88.691" description="" />
  </referencePoints>
</curve>
```

`direction` rises from 15° → 89°: left-hand turn tightening then opening into a straight heading East.

#### Curve 3 — hairpin (24 pts)

A full U-turn — `direction` goes from 88° all the way to 263°:

```xml
<!-- First point entering hairpin, last 3 points exiting -->
<referencePoint latitude="44.6814794370226"  longitude="10.027332228053931" direction="88.619" description="" />
<!-- ... 20 intermediate points through the apex ... -->
<referencePoint latitude="44.6816935875259"  longitude="10.02415600853511"  direction="263.316" description="" />
```

---

## 4. Telemetry Measurements (`<measurements>`)

### 4.1 Structure

Each telemetry sample is a single `<sm>` element with all channels as XML attributes. There is **no element content** — everything is in attributes for compact storage.

Varano Lap 10: **851 samples** over **85.019 seconds** → ~10 Hz sampling rate.

```xml
<measurements>
  <sm id="6257306"
      mt="2024-05-28 13:33:27.805"
      lt="44.6806255" lg="10.02104066667"
      gs="18011" gd="12" ga="10"
      la="-15" lo="225" za="343"
      ph="-10" rl="-6" ya="-77"
      ds="0" df="0"
      rp="3704" tp="43"
      os="0" ot="0" wt="0"
      al="171.8" dr="91.3"
      ipc="false" igpsv="true" igyrv="true" iobdv="false"
      mn="1" />
</measurements>
```

### 4.2 Attribute Reference

#### Identification & Time

| Attr | Type | Description |
|---|---|---|
| `id` | int | Global unique measurement ID |
| `mt` | CustomDate | Measurement timestamp — `YYYY-MM-DD HH:mm:ss.fff` |
| `mn` | int | Measurement number within the lap |

#### GPS Position & Quality

| Attr | Type | Unit | Description |
|---|---|---|---|
| `lt` | double | degrees | WGS-84 latitude |
| `lg` | double | degrees | WGS-84 longitude |
| `al` | double | metres | GPS altitude |
| `dr` | double | degrees | GPS heading (0 = North, clockwise) |
| `gd` | int | cm | GPS position deviation (accuracy radius) |
| `ga` | int | — | GPS accuracy rating |
| `igpsv` | bool | — | GPS data valid flag |

#### Speed & Distance

| Attr | Type | Unit | Raw→Real | Description |
|---|---|---|---|---|
| `gs` | int | km/h | ÷ 100 | GPS speed |
| `ds` | int | mm | ÷ 1 000 = metres | Distance travelled in lap |
| `df` | int | mm | ÷ 1 000 = metres | Distance offset correction |
| `os` | int | km/h | ÷ 100 | OBD speed (when OBD connected) |

#### Inertial Sensors (IMU)

| Attr | Type | Unit | Raw→Real | Description |
|---|---|---|---|---|
| `la` | int | g | ÷ 100 | Lateral acceleration (positive = right) |
| `lo` | int | g | ÷ 100 | Longitudinal acceleration (positive = accel) |
| `za` | int | g | ÷ 100 | Vertical (Z) acceleration |
| `ph` | int | °/s | ÷ 100 | Pitch rate |
| `rl` | int | °/s | ÷ 100 | Roll rate |
| `ya` | int | °/s | ÷ 100 | Yaw rate |
| `igyrv` | bool | — | — | Gyroscope data valid flag |

#### Engine & Driver Inputs

| Attr | Type | Unit | Raw→Real | Description |
|---|---|---|---|---|
| `rp` | int | RPM | × 1 | Engine RPM |
| `tp` | int | % | × 1 | Throttle position (0–100) |
| `ot` | int | °C | × 1 | Engine oil temperature |
| `wt` | int | °C | × 1 | Coolant / water temperature |
| `iobdv` | bool | — | — | OBD data valid flag |

#### Optional CAN channels

| Attr | Type | Unit | Description |
|---|---|---|---|
| `gr` | int | — | Gear position |
| `sa` | int | — | Steering angle |
| `bp` | int | % | Brake pedal position |
| `op` | int | bar | Engine oil pressure |

#### Validity Flags

| Attr | Type | Description |
|---|---|---|
| `ipc` | bool | `true` if position was calculated (dead-reckoning), not measured |
| `igpsv` | bool | GPS data is valid |
| `igyrv` | bool | Gyroscope data is valid |
| `iobdv` | bool | OBD data is valid |

### 4.3 Sample Measurements — Varano Lap 10

The following 8 samples illustrate the full lap from start crossing to finish. Speed and G-values allow reconstruction of braking/cornering events:

| # | Time | Speed (km/h) | Lateral G | Longitudinal G | Distance (m) | Throttle % | RPM |
|---|---|---|---|---|---|---|---|
| 0 | 13:33:27.805 | 180.1 | −0.15 | +2.25 | 0.0 | 43 | 3 704 |
| 85 | 13:33:36.401 | 186.2 | −9.98 | +0.97 | 26.2 | 20 | 3 389 |
| 170 | 13:33:44.900 | 196.0 | −0.89 | +2.19 | 48.5 | 60 | 3 991 |
| 255 | 13:33:53.400 | 198.1 | −5.43 | +4.95 | 68.3 | 60 | 3 759 |
| 340 | 13:34:01.900 | 204.8 | −0.21 | −9.62 | 98.9 | 0 | 5 184 |
| 425 | 13:34:10.400 | 219.3 | +0.50 | +4.62 | 115.1 | 50 | 4 104 |
| 510 | 13:34:18.800 | 210.5 | +0.93 | +3.88 | 139.5 | 53 | 4 736 |
| 595 | 13:34:27.400 | 195.7 | −7.45 | +3.88 | 165.3 | 50 | 4 527 |
| 680 | 13:34:35.900 | 184.7 | −10.38 | +1.09 | 184.5 | 23 | 3 420 |
| 850 | 13:34:52.800 | 180.5 | −1.34 | −0.58 | 224.7 | 0 | 3 716 |

> **Observation:** sample #340 shows peak braking (−9.62 g longitudinal, throttle 0%) while sample #85 and #680 show high lateral load during cornering (≈−10 g). The MC20's peak lateral G exceeds 10 g — well above what a point-mass model would normally expect.

---

## 5. CAN Data File (`.cdrn`)

The `.cdrn` is a semicolon-delimited UTF-8 CSV (with BOM) containing time-stamped individual CAN channel readings. Unlike the IMU-polled `<sm>` records, CAN channels fire at their own cadence.

### 5.1 Header

```
id;measurementtime;lapid;name;unit;value
```

### 5.2 Sample rows

```
8823833;2024-05-28 13:33:27.850;5490;ABS;-;0
8823834;2024-05-28 13:33:27.850;5490;ESP;-;0
8823835;2024-05-28 13:33:27.861;5490;ASR;-;0
8823836;2024-05-28 13:33:28.027;5490;ABS;-;0
```

| Column | Description |
|---|---|
| `id` | Global CAN record ID |
| `measurementtime` | Timestamp matching `<lap><startTime>` epoch |
| `lapid` | FK → `<lap><sourceLapId>` (5490 in this file) |
| `name` | Channel name (ABS, ESP, ASR, …) |
| `unit` | Physical unit (`-` for binary on/off flags) |
| `value` | Channel value at that timestamp |

> Varano Lap 10 contains **1 712 CAN records**, covering ABS, ESP, and ASR activation flags throughout the lap.

---

## 6. Lap Sectors (`<lapSectors>`)

Sector records capture the actual crossing timestamps of each sector line during the lap:

```xml
<lapSectors>
  <lapsector>
    <id>12345</id>
    <sectorNumber>1</sectorNumber>
    <startTime>2024-05-28 13:33:27.794</startTime>
    <endTime>2024-05-28 13:33:52.100</endTime>
  </lapsector>
  <lapsector>
    <id>12346</id>
    <sectorNumber>2</sectorNumber>
    <startTime>2024-05-28 13:33:52.100</startTime>
    <endTime>2024-05-28 13:34:28.300</endTime>
  </lapsector>
</lapSectors>
```

---

## 7. Date Format

All timestamps use a **custom non-ISO format** validated by the XSD `CustomDate` pattern:

```
YYYY-MM-DD HH:mm:ss.fff
```

Example: `2024-05-28 13:33:27.794`

Note: **no `T` separator**, **no timezone** (device local time, see `timeZoneContinent`/`timeZoneCity` in `<track>`).

---

## 8. Relevance to Ideallinie Corridor Builder

The **`<curves>` section of `<trackVariant><trackDataXml><definition>`** is the primary input for Sprint 1:

| RN data | Ideallinie use |
|---|---|
| `<curve>` reference points | Centreline polyline per segment |
| `direction` per point | Heading → curvature derivative |
| `<startLine>` / `<endLine>` | Origin reference for distance mapping |
| `<sectors>` | Sub-lap timing gates |
| Track `width` | Half-width constraint for corridor bounds |
| `<sm>` `lt`/`lg` + `ds` | Actual driven line for comparison with ideal |
| `<sm>` `gs`, `la`, `lo` | Speed & G-force profile for solver validation |
| `.cdrn` ABS/ESP | Traction limit detection |

The curve reference points define the centreline but **not the left/right boundaries**. The corridor must be inferred from the centreline + the uniform track `width`. For more precise bounds, the RN format would need to be extended with inner/outer boundary polylines — which is a known gap and may require a future custom track definition format.
