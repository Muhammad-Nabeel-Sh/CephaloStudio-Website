# CephaloStudio — Cephalometric Analysis Gap Analysis

> **Date**: 2026-06-05
> **Purpose**: Identify gaps between our current analysis library and industry-standard cephalometric software (Dolphin, AudaxCeph, WebCeph, NemoCeph, OnyxCeph, BCeph, CephX).

---

## 1. Current State

| Projection | Analyses | Points | Measurements | Status |
|------------|----------|--------|--------------|--------|
| **Lateral Ceph** | 39 (9 hardcoded + 30 CSV) | ~500 | ~355 defined in CSV | ✅ Full coverage |
| **AP/PA Ceph** | 10 (6 hardcoded + 4 CSV) | ~135 | ~45 defined with norms | ✅ Strong coverage |
| **SMV** | 1 | 43 | 7 with norms | ✅ Norms populated |
| **OPG** | 1 | 22 | 4 with norms | ✅ Norms populated |
| **Lateral Photo** | 1 | 15 | 12 with norms | ✅ Supported |
| **Frontal Photo** | 1 | 19 | 12 with norms | ✅ Supported |
| **Hand-Wrist** | 1 | 11 | 6 | ✅ Supported |
| **Study Models** | 0 | 0 | 0 | ❌ Not supported |
| **CBCT/3D** | 0 | 0 | 0 | ❌ Not supported |

---

## 2. Lateral Ceph Coverage

### Hardcoded Analysis Point/Measurement Counts

| Analysis | Points | Measurements | Norms | Status |
|----------|--------|-------------|-------|--------|
| General Ceph Analysis | 25 | 11 | Partial | ✅ |
| Steiner Analysis | 21 | 14 | Full | ✅ |
| Ricketts Analysis | 26 | 14 | Full | ✅ |
| McNamara Analysis | 11 | 10 | Partial | ✅ |
| Downs Analysis | 16 | 10 | Full | ✅ |
| Bjork Analysis | 17 | 10 | Full | ✅ |
| Tweed Analysis | 12 | 8 | Full | ✅ |
| Jarv-Bjork (Jarabak) | 14 | 8 | Full | ✅ |
| Wits Analysis | 8 | 1 (projDist) | Full | ✅ |
| Holdaway Soft Tissue | 10 | 3 | Full | ✅ |
| Sassouni Analysis | 17 | 17 | Norms defined | ✅ |
| Arnett STCA/FAB | 14 | 12 | Norms defined | ✅ |
| ABO Discrepancy Index | 10 | 5 | Full (ABO) | ✅ |
| CVM (Baccetti) | 10 | 11 | Norms defined | ✅ |
| Kim ODI/APDI/CF | 16+ | 3 | Full | ✅ |
| Eastman Analysis | 12+ | 3 | Full | ✅ |
| Delaire Analysis | 16+ | 3 | Full | ✅ |
| Merrifield Z-angle | 4 | 1 | Full | ✅ |
| Bimler Analysis | 16 | 7 | Full | ✅ |
| Tollaro Analysis | 9 | 7 | Full | ✅ |
| Lautrou Analysis | 18 | 9 | Full | ✅ |
| Gugino Analysis | 15 | 7 | Full | ✅ |
| Epker's Soft Tissue | 13 | 8 | Full | ✅ |
| COGS Analysis (Burstone) | 18 | 9 | Full | ✅ |

### CSV-Only Analyses with Measurements

| Analysis | Points | Measurements | Status |
|----------|--------|-------------|--------|
| Coben Craniofacial | 8 | 12 | ✅ |
| Di Paolo's Quadrilateral | 5 | 10 | ✅ |
| Farkas Soft Tissue | 16 | 10 | ✅ |
| Harvold | 9 | 5 | ✅ |
| Hasund (Bergen) | 18 | 5 | ✅ |
| Legan & Burstone Soft Tissue | 7 | 8 | ✅ |
| Riedel | 19 | 11 | ✅ |
| Schwarz | 13 | 5 | ✅ |
| Wylie ISBI | 19 | 10 | ✅ |

### Orphan CSV Analyses (Points Only, No Measurements)

| Analysis | Points | Notes |
|----------|--------|-------|
| Basis (ISBI) | 14 | Italian School point-identification template |
| Cagliari (ISBI) | 21 | Italian School point-identification template |
| Chieti (ISBI) | 21 | Italian School point-identification template |
| McGann (ISBI) | 21 | Italian School point-identification template |
| Coben Dentition | 4 | Dentition subset — points only |

---

## 3. AP/PA Ceph Coverage

| Analysis | Points | Measurements | Status |
|----------|--------|-------------|--------|
| Ricketts (Frontal) | 14 | 5 | ✅ |
| General PA Analysis | 36+ | 8 | ✅ |
| Grummons Frontal Asymmetry | 11 | 4 | ✅ |
| Hewitt | 7 | 2 | ✅ |
| Svanholt-Solow | 6 | 2 | ✅ |
| Grayson Multiplane | 7 | 1 | ✅ |
| Van Arsdale | 13 | 6 | ✅ |
| Grummons Simplified AP | 11 | 5 | ✅ |
| Sassouni Frontal | 13 | 6 | ✅ |
| Moorrees Mesh | 14 | 9 | ✅ |

---

## 4. Other Projections

| Projection | Analyses | Measurements | Status |
|------------|----------|-------------|--------|
| SMV (Submentovertex) | 1 (General SMV) | 7 widths | ✅ |
| OPG (Panoramic) | 1 (General OPG) | 4 widths | ✅ |
| Lateral Photo | 1 (Lateral Photo) | 12 (angles + TVL perps) | ✅ |
| Frontal Photo | 1 (Frontal Photo) | 12 (widths, heights, ratios) | ✅ |
| Hand-Wrist Radiograph | 1 (Hand-Wrist) | 6 (gaps + ratio) | ✅ |

---

## 5. What's Still Missing

### 🔴 Bugs / Cleanup
- **8 unnecessary `eslint-disable` comments** in `App.jsx` (lines 571, 643, 649, 671, 695, 721, 741, 779) on plain `const` declarations — rule doesn't apply, comments are cargo-culted
- **PA naming mismatch**: `PA_Ceph.csv` uses `"Ricketts PA"` but `AnalysisMeasurements.csv` uses `"Ricketts"` — measurements don't merge into the PA Ricketts analysis; they merge into the lateral Ricketts analysis instead (same name `"Ricketts"` in `_measurementLookup`)

### 🟡 Medium Priority
- **4 orphan CSV analyses** (Basis, Cagliari, Chieti, McGann) have 14–21 points each but zero measurements — users can place landmarks but nothing auto-creates
- **OPG "General Analysis"** — 2 orphan points (Inc-L, Inc-R) with no measurements

### 🟢 Low Priority (Major Features)
- **Study model analysis** (Bolton discrepancy, Schwarz arch analysis) — needs different input model
- **VTO/Growth prediction** — requires growth forecasting algorithms
- **CBCT/3D analysis** — volumetric assessment with 3D norms
- **PDF reporting** — export analysis results to PDF
- **Patient database** — only basic study mode exists
- **AI auto-landmark detection** — automatic point placement

---

## 6. Key Recent Improvements

| Change | Description |
|--------|-------------|
| Wits auto-creation fix | Removed `projDist` from first-pass skip list — now auto-creates when all 4 points (A, B, APOcc, PPOcc) placed |
| Reference planes as infinite dashed lines | All `Line` type measurements without norms auto-create with `mode: "infinite"` + `style: "dashed"` — covers SN, FH, NBo, N-Ba, Mandibular, Occlusal, Palatal, Dental (A-Pg), Facial (N-Pg), A-B, Y-axis, etc. |
| Property panel toggle | Lines/parallels have "Type" toggle (2-Point / Infinite) and "Dash" dropdown (Solid / Dashed / Dotted) |
| Steiner expanded | Added 9 measurements: Occlusal Plane-SN, SN-GoGn, U1-NA (mm+°), L1-NB (mm+°), Interincisal, Upper/Lower lip to S-line; added 11 points (Ia, Iia, APOcc, PPOcc, Prn, Sn, Pog', UL, LL) |
| Ricketts expanded | Added 8 measurements: Facial axis, Mandibular plane, Lower facial height, Mandibular arc, L1 to A-Pog, Interincisal, Upper/Lower lip to E-plane; added 12 points |
| McNamara expanded | Added MMD (Difference), U1 to NA line, L1 to A-Pog, PNS-Ad airway |
| Downs expanded | Added AB plane angle, Occlusal plane angle, Angle of convexity, Interincisal angle |
| Björk expanded | Added Interincisal, U1-ML, U1-NSL |
| Tweed expanded | Added FMIA, IMPA, SNA, SNB, ANB |

---

## 7. Measurement Type Summary

| Type | Code | Canvas Visual | Status |
|------|------|--------------|--------|
| Point | `point` | Dot + label | ✅ |
| Line | `line` | Segment or infinite dashed | ✅ |
| Parallel | `parallel` | Parallel line | ✅ |
| Angle (3-pt) | `angle3` | Arc between rays | ✅ |
| Angle (4-pt) | `angle4` | Arc between rays | ✅ |
| Perpendicular Distance | `perp` | Line with right-angle marker | ✅ |
| Polygon | `polygon` | Closed shape | ✅ |
| Curve | `curve` | Open spline/polyline | ✅ |
| Arrow | `arrow` | Directional arrow | ✅ |
| Text | `text` | Text annotation | ✅ |
| Ruler/Calibration | `ruler` | Calibration line | ✅ |
| Ratio | `ratio` | v0/v1 (label-ref derived) | ✅ |
| Sum | `sum` | v0+v1+... (label-ref derived) | ✅ |
| Difference | `difference` | v0−v1 (label-ref derived) | ✅ |
| Percentage | `percentage` | (v0/v1)×100 (label-ref derived) | ✅ |
| Projected Distance | `projDist` | Signed projection onto ref line | ✅ |
| Vector | — | Directional displacement | ❌ |
| Area/Volume | — | Airway analysis | ❌ |

---

## 8. Future Development Priorities

### Phase 7 (Next)
- Fix 8 unnecessary eslint-disable comments
- Fix PA naming mismatch (`Ricketts PA` → `Ricketts` or vice versa)
- Add measurements to orphan ISBI analyses (Basis, Cagliari, Chieti, McGann)
- Study model analysis (Bolton discrepancy, Schwarz arch analysis)

### Phase 8 (Future)
- VTO growth prediction
- CBCT frontal norms / 3D analysis
- PDF reporting / patient database
- AI auto-landmark detection

---

*Generated by CephaloStudio Development — 2026-06-05*
