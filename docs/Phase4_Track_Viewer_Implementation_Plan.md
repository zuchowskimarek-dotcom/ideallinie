# Phase 4 — Track Viewer & Geometry Rendering

## Context

Phases 1-3 are complete (v0.3.0): monorepo scaffold, RNZ importer, gaming dashboard with real track cards from DB. Phase 4 adds the ability to **click a track card and see an interactive SVG track map** with curvature visualization, pan/zoom, and hover info. This is the first phase where the platform starts visualizing actual track geometry.

---

## Step 0 — Fix Importer + Seed Full Centreline Data

**Problem:** `RnTrackVariantSource.centrelinePoints` only stores `curves[0].points` (first curve segment, ~9-26 points). The full centreline requires ALL curve segments concatenated (~150+ points).

### 0a. Fix the importer parser
**Modify:** `services/rnz-importer/src/parser/rn-xml.ts`
- Change `centrelinePoints` assignment from `curves[0].points` to concatenation of ALL curves' points
- Deduplicate overlapping endpoints between adjacent curve segments (skip if distance < 0.5m)
- This ensures all future imports store the complete centreline

### 0b. Write + execute a DB seed script
**New:** `scripts/seed-centrelines.ts`
- Standalone script using Prisma client
- Queries all `RnTrackVariantSource` rows (fetching `id`, `rawDefinitionXml`)
- For each row: parses `rawDefinitionXml` using the same `fast-xml-parser` + reference point extraction logic from the importer
- Concatenates all curve segments into the full centreline (same deduplication as 0a)
- Updates `centrelinePoints` in place via `prisma.rnTrackVariantSource.update()`
- Logs results: `"Updated track X: 19 pts → 156 pts"`
- Run once: `npx tsx scripts/seed-centrelines.ts`

**Reference code:** `services/rnz-importer/src/parser/rn-xml.ts` — reuse `toArray()`, `parseReferencePoints()`, and `parseDefinition()` logic

### 0c. Verify
- After running the seed script, query the DB to confirm `centrelinePoints` arrays now have 100+ points per track
- The track-service `/tracks/:id` endpoint should return the enriched data immediately (no code change needed)

---

## Step 1 — Backend: Track Geometry Endpoint

No `fast-xml-parser` needed in track-service — centreline data is now correct in the DB.

### 1a. Shared geometry types
**Modify:** `packages/shared-types/src/index.ts` — add:
- `RnGpsPointDto` — `{latitude, longitude, direction}`
- `TrackLineGeometry` — `{label, left: Point2D, centre: Point2D, right: Point2D}`
- `TrackGeometry` — full rendering payload: centreline (`TrackPoint[]`), boundaries, start/end/sector lines, bounds
- `TrackOutline` — lightweight thumbnail data: simplified `Point2D[]` + bounds

### 1b. Geometry math module
**New:** `services/track-service/src/geometry/math.ts` (~180 lines)
- `projectToCartesian(gpsPoints)` — equirectangular GPS→Cartesian (centered on track centroid)
- `projectPoint(lat, lon, originLat, originLon)` — single point projection
- `computeHeadings(points, gpsDirections)` — heading per point (atan2, fallback to GPS direction)
- `computeCurvatures(headings, arcLengths)` — κ = dθ/ds via central differences
- `computeArcLengths(points)` — cumulative distance
- `offsetPolyline(points, headings, offsetM)` — perpendicular offset for boundaries
- `computeBounds(points, padding)` — bounding box
- `simplifyPolyline(points, epsilon)` — Ramer-Douglas-Peucker for thumbnails

### 1c. Geometry route
**New:** `services/track-service/src/routes/geometry.ts` (~100 lines)
- `GET /tracks/:id/geometry` — fetches `RnTrackVariantSource`, reads `centrelinePoints` + `startLinePoints` + `endLinePoints` + `sectorLines` + `widthM` directly from DB, projects, computes geometry, returns `TrackGeometry`
- Follows existing route pattern: `FastifyPluginAsync<{ prisma }>`, `{ data, message }` envelope

### 1d. Register route
**Modify:** `services/track-service/src/index.ts` — import + register `geometryRoutes`
- No API gateway changes needed — existing proxy `prefix: "/api/tracks"` already routes `/api/tracks/:id/geometry`

### 1e. Add outlines to track list
**Modify:** `services/track-service/src/routes/tracks.ts`
- Extend `GET /tracks` to also return `outline: TrackOutline` per track
- Read `centrelinePoints` → project → simplify (RDP, 1m tolerance) → return
- Also return `distanceM`, `widthM` for card metadata

---

## Step 2 — Frontend: Component Decomposition

**New directory structure:**
```
frontend/src/
  types.ts                          # Theme, Tab, ServiceInfo, ImportResult, TrackData
  config.ts                         # SERVICES, FEATURES arrays
  hooks/
    useTheme.ts
    useServiceStatuses.ts
    useTracks.ts                    # Updated TrackData with outline field
  components/
    StatusBadge.tsx
    SettingsPanel.tsx
    ImportPanel.tsx
    TrackCard.tsx                   # Enhanced with SVG thumbnail + onClick
    TrackThumbnail.tsx              # Mini SVG track outline
    TrackViewer/
      TrackViewer.tsx               # Full-page detail view container
      TrackSvg.tsx                  # Pure SVG renderer
      TrackTooltip.tsx              # Hover info popup
      usePanZoom.ts                 # Pan/zoom state + mouse handlers
      useTrackGeometry.ts           # Fetch geometry from API
      curvature-colors.ts           # Curvature → color mapping
```

**Modify:** `frontend/src/App.tsx` — refactor from 503 → ~120 lines:
- Add `selectedTrack: TrackData | null` state
- When set → render `<TrackViewer>` full-page, with `onBack` to return
- Track cards get `onClick={() => setSelectedTrack(t)}`

---

## Step 3 — Frontend: TrackViewer SVG Rendering

### Core SVG layers (bottom to top):
1. **Track surface** — filled polygon from left+right boundaries (very subtle fill `rgba(255,255,255,0.04)`)
2. **Boundary lines** — left/right edges (`--border-card` color, thin)
3. **Curvature-coded centreline** — segmented polyline, color per curvature bucket:
   - Grey (#444) = straight, Accent = gentle, Gold = medium, Red = tight, Hot pink = hairpin
4. **Sector lines** — dashed, muted color
5. **Start/finish line** — accent color, solid, thicker
6. **Hover dot** — accent with glow, on nearest centreline point
7. **Invisible hit area** — thick transparent polyline for mouse interaction

### Key rendering detail:
- SVG `viewBox` computed from geometry bounds
- Y-axis inverted: `svgY = -cartesianY` everywhere
- `preserveAspectRatio="xMidYMid meet"` for proper fit

---

## Step 4 — Pan/Zoom Interaction

**`usePanZoom` hook** — mouse drag for pan, wheel for zoom:
- State: `{scale, translateX, translateY}`
- Returns SVG `transform` string + event handlers
- Zoom range: 0.1x–20x, wheel delta 0.9/1.1 per tick
- Cursor: `grab` / `grabbing`

---

## Step 5 — Track Card Thumbnails

**`TrackThumbnail` component** — renders simplified centreline as SVG polyline:
- Uses `outline` data from track list API (no extra fetch)
- Accent-colored stroke with `vector-effect: non-scaling-stroke`
- Replaces placeholder image in `TrackCard`
- Opacity 0.35 at rest, 0.65 on hover (matches existing image behavior)

---

## Step 6 — CSS Additions

**Modify:** `frontend/src/index.css` — append ~180 lines:
- Missing animations: `.spin` (rotation), `.fade-in` (opacity+translate)
- Track viewer: `.track-viewer`, `.track-viewer-header`, `.track-viewer-canvas`
- SVG elements: `.track-surface`, `.track-boundary`, `.track-centreline-segment`, `.track-start-line`, `.track-sector-line`
- Tooltip: `.track-tooltip`, `.track-tooltip-row`
- Legend: `.track-viewer-legend`
- Thumbnail: `.track-card-svg`, `.track-thumbnail`, `.track-thumbnail-line`
- All using existing CSS variables — theme-aware automatically

---

## Implementation Order

| # | What | Files | Depends On |
|---|------|-------|------------|
| 0a | Fix importer parser | `rnz-importer/src/parser/rn-xml.ts` | — |
| 0b | Seed script | `scripts/seed-centrelines.ts` (new) | 0a (shares logic) |
| 0c | Run seed + verify | execute script | 0b |
| 1a | Geometry types | `shared-types/src/index.ts` | — |
| 1b | Math module | `track-service/src/geometry/math.ts` (new) | 1a |
| 1c | Geometry route | `track-service/src/routes/geometry.ts` (new) | 0c, 1b |
| 1d | Register route | `track-service/src/index.ts` | 1c |
| 1e | Outline in list | `track-service/src/routes/tracks.ts` | 0c, 1b |
| 2 | Component decomposition | 10 new files + App.tsx refactor | — |
| 6 | CSS additions | `frontend/src/index.css` | — |
| 3-4 | TrackViewer + pan/zoom | 6 new files in TrackViewer/ | 1c, 2, 6 |
| 5 | Thumbnails | `TrackThumbnail.tsx`, `TrackCard.tsx` | 1e, 2 |

---

## File Inventory

**New files (18):** `scripts/seed-centrelines.ts`, 2 backend (`geometry/math.ts`, `routes/geometry.ts`), 15 frontend (types, config, 3 hooks, 4 components, 6 TrackViewer files)

**Modified files (5):** `rnz-importer/src/parser/rn-xml.ts`, `shared-types/src/index.ts`, `track-service/src/index.ts`, `track-service/src/routes/tracks.ts`, `frontend/src/App.tsx`, `frontend/src/index.css`

---

## Verification

**After Step 0 (seed):**
- Seed script logs point count increases for each track
- `SELECT id, variant_name, jsonb_array_length(centreline_points) FROM rn_track_variant_sources` shows 100+ points

**Backend (after Step 1):**
- `npm run build` in track-service compiles
- `GET http://localhost:8002/tracks/:id/geometry` returns centreline with 100+ points, boundaries, bounds
- `GET http://localhost:8002/tracks` returns outline per track
- `GET http://localhost:3000/api/tracks/:id/geometry` works through gateway

**Frontend decomposition (after Step 2):**
- `npm run dev` in frontend — renders identically to current version, no regressions

**Track Viewer (after Steps 3-5):**
- Click track card → full-page viewer opens with SVG track
- Track ribbon, boundaries, curvature coloring, start/finish, sectors all visible
- Pan (drag) and zoom (wheel) work
- Hover shows tooltip with distance/heading/curvature
- Back button returns to grid
- Track cards show SVG outlines instead of placeholder images
- Both lava and grello themes render correctly
