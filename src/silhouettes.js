// ═══════════════════════════════════════════════════════════════════════════════
// PREDEFINED SILHOUETTES – Anatomical tracing templates for cephalometric overlay
// Source: Jacobson & Jacobson, Radiographic Cephalometry (Quintessence, 2006)
//         Templates 1–5 (manual tracing acetate series, Figs 4-3 / 4-4)
//
// Coordinate system (normalised, centred at 0,0):
//   +X = anterior (patient faces RIGHT on screen)
//   +Y = inferior  (down)
//   range approximately [-0.5 … 0.5]
//
// Template origin is registered to the Frankfort Horizontal (FH) plane at
// the porion/ear-rod intersection (as in the Jacobson method).
// ═══════════════════════════════════════════════════════════════════════════════

export const SILHOUETTES = {

  // ───────────────────────────────────────────────────────────────────────────
  // TEMPLATE 1 – CRANIAL / SOFT-TISSUE SILHOUETTE
  // Outer profile: vertex → forehead → glabella → nasion → nasal dorsum →
  // pronasale (nose tip) → columella → anterior neck.
  // Cervical spine (C1-C3 posterior arch) also registered to this template.
  // Tracing registered on sella–nasion (S-N) plane; porion ear-rod visible.
  // ───────────────────────────────────────────────────────────────────────────
  cranialSilhouette: {
    name: "Cranial & Soft Tissue Profile",
    category: "Craniofacial",
    color: "#f59e0b",
    paths: [
      // Outer cranial vault + face profile  (superior → anterior → inferior)
      // Superior cranial vertex → posterior occiput is omitted (off-film in
      // standard lateral ceph); trace runs forehead → soft tissue chin.
      { closed: false, points: [
        // Forehead / frontal bone (high, slightly posterior to Nasion)
        { x:  0.14, y: -0.42 },
        { x:  0.16, y: -0.38 },
        { x:  0.18, y: -0.34 },
        { x:  0.20, y: -0.30 },
        // Glabella – slight convexity
        { x:  0.22, y: -0.26 },
        { x:  0.23, y: -0.22 },
        // Soft-tissue Nasion (slight concavity at naso-frontal suture)
        { x:  0.22, y: -0.18 },
        // Nasal dorsum – straight with slight convexity
        { x:  0.23, y: -0.14 },
        { x:  0.25, y: -0.10 },
        { x:  0.27, y: -0.06 },
        // Pronasale (nasal tip – most anterior point)
        { x:  0.30, y: -0.02 },
        // Columella – curves back inferiorly
        { x:  0.28, y:  0.02 },
        { x:  0.25, y:  0.04 },
        // Subnasale
        { x:  0.23, y:  0.06 },
        // Upper lip (labrale superius – slight anterior convexity)
        { x:  0.24, y:  0.08 },
        { x:  0.25, y:  0.10 },
        // Oral slit / stomion
        { x:  0.24, y:  0.12 },
        // Lower lip (labrale inferius)
        { x:  0.23, y:  0.14 },
        { x:  0.22, y:  0.16 },
        // Labiomental sulcus (concavity)
        { x:  0.20, y:  0.18 },
        // Soft-tissue pogonion
        { x:  0.22, y:  0.20 },
        { x:  0.23, y:  0.22 },
        // Soft-tissue menton
        { x:  0.22, y:  0.24 },
        { x:  0.20, y:  0.26 },
        // Anterior neck / soft-tissue chin base
        { x:  0.17, y:  0.28 },
        { x:  0.13, y:  0.30 },
        { x:  0.08, y:  0.32 },
      ]},
      // Ear-rod marker (porion registration cross – Template 1 left cross)
      // Rendered as a small crosshair; two short perpendicular segments
      { closed: false, points: [
        { x: -0.20, y: -0.04 },
        { x: -0.14, y: -0.04 },
      ]},
      { closed: false, points: [
        { x: -0.17, y: -0.07 },
        { x: -0.17, y: -0.01 },
      ]},
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // TEMPLATE 2 – SELLA TURCICA / SPHENOIDAL REGION
  // Planum sphenoidale → tuberculum sellae → sella floor → dorsum sellae →
  // posterior clinoid process → anterior clinoid process outline.
  // The condylar fossa (glenoid fossa / articular eminence) with the
  // ear-rod circle are also on this template.
  // ───────────────────────────────────────────────────────────────────────────
  sellaTurcica: {
    name: "Sella Turcica",
    category: "Craniofacial",
    color: "#60a5fa",
    paths: [
      // Planum sphenoidale (flat, runs anteriorly from sella)
      { closed: false, points: [
        { x:  0.08, y: -0.08 },
        { x:  0.04, y: -0.08 },
        { x:  0.00, y: -0.08 },
        // Tuberculum sellae (slight upward projection)
        { x: -0.02, y: -0.09 },
        // Sella floor (concave inferiorly – pituitary fossa)
        { x: -0.04, y: -0.06 },
        { x: -0.05, y: -0.03 },
        { x: -0.05, y:  0.00 },
        { x: -0.04, y:  0.03 },
        // Dorsum sellae (posterior vertical wall)
        { x: -0.02, y:  0.05 },
        { x:  0.00, y:  0.07 },
        // Posterior clinoid process (small upward hook)
        { x:  0.01, y:  0.09 },
        { x:  0.00, y:  0.11 },
        { x: -0.01, y:  0.10 },
      ]},
      // Articular eminence + glenoid fossa (condylar fossa on Template 2)
      // S-shaped curve: eminence convexity then fossa concavity
      { closed: false, points: [
        { x: -0.14, y:  0.00 },
        { x: -0.12, y: -0.02 },
        { x: -0.10, y: -0.04 },
        // Articular eminence (most inferior convex point)
        { x: -0.09, y: -0.02 },
        { x: -0.09, y:  0.00 },
        // Glenoid fossa (concavity)
        { x: -0.10, y:  0.02 },
        { x: -0.12, y:  0.03 },
        { x: -0.14, y:  0.02 },
        { x: -0.16, y:  0.00 },
      ]},
      // Ear-rod circle (porion, inner circle ~0.02 radius)
      // Approximated as a small closed near-circle (8 points)
      { closed: true, points: [
        { x: -0.18,  y:  0.02 },
        { x: -0.17,  y:  0.00 },
        { x: -0.18,  y: -0.02 },
        { x: -0.20,  y: -0.03 },
        { x: -0.22,  y: -0.02 },
        { x: -0.23,  y:  0.00 },
        { x: -0.22,  y:  0.02 },
        { x: -0.20,  y:  0.03 },
      ]},
      // Dashed outline of condylar head (sits above glenoid fossa)
      // Rendered as a separate path; caller can apply dash styling by key
      { closed: true, dashed: true, points: [
        { x: -0.14, y: -0.06 },
        { x: -0.12, y: -0.08 },
        { x: -0.10, y: -0.09 },
        { x: -0.08, y: -0.08 },
        { x: -0.07, y: -0.06 },
        { x: -0.08, y: -0.04 },
        { x: -0.10, y: -0.03 },
        { x: -0.12, y: -0.04 },
      ]},
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // SELLA & CRANIAL BASE (user-supplied manual tracing)
  // Manually traced outline of sella turcica region and cranial base structures.
  // ───────────────────────────────────────────────────────────────────────────
  sellaAndCranialBase: {
    name: "Sella & Cranial Base",
    category: "Craniofacial",
    color: "#60a5fa",
    paths: [
      { closed: false, points: [
        { x: 0.50000, y: -0.34366 },
        { x: 0.43947, y: -0.34022 },
        { x: 0.32440, y: -0.28808 },
        { x: 0.18824, y: -0.26578 },
        { x: 0.06435, y: -0.22476 },
        { x: -0.08822, y: -0.18838 },
        { x: -0.11676, y: -0.16603 },
        { x: -0.11568, y: -0.11696 },
        { x: -0.12262, y: -0.09678 },
        { x: -0.14414, y: -0.07496 },
        { x: -0.17066, y: -0.06148 },
        { x: -0.19977, y: -0.06179 },
        { x: -0.22088, y: -0.07793 },
        { x: -0.22205, y: -0.09867 },
        { x: -0.19036, y: -0.14005 },
        { x: -0.19842, y: -0.15260 },
        { x: -0.21690, y: -0.14818 },
        { x: -0.30956, y: -0.01863 },
        { x: -0.48918, y: 0.28289 },
        { x: -0.49889, y: 0.33000 },
        { x: -0.48969, y: 0.34148 },
        { x: -0.47149, y: 0.34255 },
        { x: -0.34798, y: 0.25587 },
        { x: -0.25754, y: 0.20309 },
        { x: -0.17903, y: 0.17139 },
        { x: -0.01606, y: 0.12807 },
        { x: 0.03704, y: 0.10038 },
        { x: 0.08106, y: 0.06495 },
        { x: 0.13187, y: 0.01161 },
        { x: 0.16101, y: -0.05064 },
        { x: 0.17596, y: -0.14467 },
        { x: 0.17701, y: -0.22815 },
        { x: 0.18618, y: -0.26577 },
      ]},
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // TEMPLATE 3 – MAXILLA & UPPER DENTITION
  // Nasal floor → ANS → anterior maxilla (Point A region) → alveolar process
  // → posterior maxilla → PNS; plus upper incisor and upper molar crowns/roots.
  // ───────────────────────────────────────────────────────────────────────────
  maxilla: {
    name: "Maxilla",
    category: "Craniofacial",
    color: "#34d399",
    paths: [
      // Nasal floor – nearly horizontal, slight inferior slope anteriorly
      { closed: false, points: [
        { x:  0.14, y: -0.04 },
        { x:  0.10, y: -0.04 },
        { x:  0.06, y: -0.04 },
        { x:  0.02, y: -0.04 },
        // ANS – slight downward spike at the most anterior inferior nasal spine
        { x:  0.00, y: -0.03 },
        { x: -0.01, y: -0.02 },
        { x:  0.00, y: -0.01 },
        // Anterior maxilla / Point A region (concavity)
        { x:  0.01, y:  0.02 },
        { x:  0.02, y:  0.04 },
        { x:  0.01, y:  0.06 },
        // Anterior alveolar crest (under upper incisors)
        { x:  0.00, y:  0.08 },
        { x: -0.02, y:  0.10 },
      ]},
      // Posterior maxilla: tuberosity → PNS
      // Runs from posterior alveolar area superiorly back to PNS
      { closed: false, points: [
        { x:  0.14, y: -0.04 },
        // Posterior nasal spine (PNS) – terminal point of nasal floor
        { x:  0.16, y: -0.03 },
        { x:  0.18, y: -0.02 },
      ]},
      // Key ridge / zygomatic process of maxilla
      // Comma / hook shape at the junction of maxilla and zygomatic arch
      { closed: false, points: [
        { x:  0.10, y: -0.08 },
        { x:  0.11, y: -0.06 },
        { x:  0.12, y: -0.04 },
        { x:  0.12, y: -0.02 },
        { x:  0.11, y:  0.00 },
        { x:  0.10, y:  0.01 },
        { x:  0.09, y:  0.00 },
        { x:  0.09, y: -0.02 },
        { x:  0.10, y: -0.04 },
        { x:  0.10, y: -0.06 },
      ]},
    ],
  },

  upperCentralIncisor: {
    name: "Upper Central Incisor",
    category: "Teeth",
    color: "#4ade80",
    paths: [
      // Crown outline: trapezoidal, wider at incisal edge
      { closed: false, points: [
        // Incisal edge (most inferior on upper incisor; crown faces down)
        { x: -0.01, y:  0.10 },
        { x:  0.01, y:  0.10 },
        // Labial surface
        { x:  0.02, y:  0.08 },
        { x:  0.03, y:  0.05 },
        { x:  0.02, y:  0.02 },
        // Cervical area / CEJ (labial)
        { x:  0.01, y:  0.00 },
        // Root (tapers apically, slight labial curvature)
        { x:  0.01, y: -0.04 },
        { x:  0.00, y: -0.08 },
        { x:  0.00, y: -0.12 },
        // Apex
        { x:  0.00, y: -0.16 },
        // Palatal root surface
        { x: -0.01, y: -0.12 },
        { x: -0.01, y: -0.08 },
        { x: -0.01, y: -0.04 },
        // CEJ palatal
        { x: -0.02, y:  0.00 },
        // Palatal surface of crown
        { x: -0.03, y:  0.03 },
        { x: -0.02, y:  0.07 },
        // Back to incisal edge
        { x: -0.01, y:  0.10 },
      ]},
    ],
  },

  upperMolar: {
    name: "Upper First Molar",
    category: "Teeth",
    color: "#4ade80",
    paths: [
      // Crown: multi-cusped, wider bucco-palatally
      // Lateral ceph shows buccal and palatal cusps superimposed
      { closed: false, points: [
        // Occlusal/cusp tips (inferior aspect of upper molar faces down)
        { x: -0.08, y:  0.08 },
        { x: -0.05, y:  0.10 },
        { x: -0.02, y:  0.10 },
        { x:  0.01, y:  0.09 },
        { x:  0.04, y:  0.08 },
        // Buccal surface
        { x:  0.06, y:  0.05 },
        { x:  0.06, y:  0.02 },
        // Cervical area
        { x:  0.05, y:  0.00 },
        // Palatal surface
        { x:  0.02, y: -0.01 },
        { x: -0.02, y: -0.01 },
        { x: -0.06, y:  0.00 },
        { x: -0.08, y:  0.02 },
        { x: -0.09, y:  0.05 },
        { x: -0.08, y:  0.08 },
      ]},
      // Mesiobuccal root (shorter, buccally inclined)
      { closed: false, points: [
        { x:  0.02, y:  0.00 },
        { x:  0.02, y: -0.04 },
        { x:  0.01, y: -0.09 },
        { x:  0.00, y: -0.13 },
        // Apex
        { x:  0.00, y: -0.15 },
      ]},
      // Palatal root (longer, diverges palatally / posteriorly in lateral view)
      { closed: false, points: [
        { x: -0.03, y:  0.00 },
        { x: -0.04, y: -0.05 },
        { x: -0.05, y: -0.10 },
        { x: -0.06, y: -0.15 },
        { x: -0.07, y: -0.18 },
        // Apex (curves distally at tip)
        { x: -0.08, y: -0.19 },
      ]},
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // TEMPLATE 4 – MANDIBLE
  // Complete mandibular outline: condyle → sigmoid notch → coronoid process →
  // anterior ramus → mandibular body → antegonial notch → gonion → posterior
  // ramus → back to condyle.  Lower incisor and lower molar also on this sheet.
  // ───────────────────────────────────────────────────────────────────────────
  mandible: {
    name: "Mandible",
    category: "Mandible",
    color: "#a78bfa",
    paths: [
      // Main mandibular outline (single continuous path, open – start at
      // condylar head, end at coronoid process tip for a clean trace)
      { closed: false, points: [
        // --- Condyle (superior, sits posteriorly) ---
        // Medial pole (most superior-posterior)
        { x: -0.12, y: -0.24 },
        // Condylar head – convex superior surface
        { x: -0.10, y: -0.26 },
        { x: -0.08, y: -0.27 },
        { x: -0.06, y: -0.26 },
        // Lateral condylar pole descending to neck
        { x: -0.05, y: -0.24 },
        { x: -0.05, y: -0.20 },
        // --- Sigmoid (mandibular) notch ---
        { x: -0.04, y: -0.18 },
        { x: -0.02, y: -0.17 },
        { x:  0.00, y: -0.17 },
        { x:  0.02, y: -0.18 },
        // --- Coronoid process (anterior ramus, pointed tip) ---
        { x:  0.04, y: -0.22 },
        { x:  0.05, y: -0.26 },
        { x:  0.04, y: -0.28 },
      ]},
      // Ramus and body (posterior ramus → gonion → body → symphysis)
      { closed: false, points: [
        // Posterior ramus (posterior border, slightly convex)
        { x: -0.12, y: -0.22 },
        { x: -0.13, y: -0.18 },
        { x: -0.14, y: -0.14 },
        { x: -0.14, y: -0.10 },
        { x: -0.13, y: -0.06 },
        // Gonion (posterior-inferior angle of mandible – rounded)
        { x: -0.12, y: -0.02 },
        { x: -0.10, y:  0.02 },
        { x: -0.08, y:  0.04 },
        // Mandibular body inferior border
        { x: -0.04, y:  0.06 },
        { x:  0.00, y:  0.07 },
        { x:  0.04, y:  0.07 },
        // Antegonial notch (slight superior concavity before symphysis)
        { x:  0.06, y:  0.06 },
        { x:  0.08, y:  0.04 },
        { x:  0.10, y:  0.02 },
        // Symphysis region → menton (most inferior)
        { x:  0.12, y:  0.00 },
        { x:  0.13, y: -0.02 },
        // Gnathion / pogonion area (anterior symphysis)
        { x:  0.14, y: -0.05 },
        { x:  0.14, y: -0.08 },
        // B-point region (lingual concavity – on posterior symphyseal surface)
        { x:  0.13, y: -0.10 },
        { x:  0.12, y: -0.12 },
        // Alveolar crest (inferior to lower incisor root apex)
        { x:  0.10, y: -0.14 },
        { x:  0.08, y: -0.16 },
        // Anterior alveolar process
        { x:  0.06, y: -0.18 },
        { x:  0.05, y: -0.20 },
      ]},
      // Dashed circle for condyle registration (B-point / Me dashed line
      // in Jacobson template 4 at genial tubercle area)
      { closed: true, dashed: true, points: [
        { x:  0.08, y:  0.02 },
        { x:  0.09, y:  0.01 },
        { x:  0.10, y:  0.02 },
        { x:  0.09, y:  0.03 },
      ]},
    ],
  },

  lowerCentralIncisor: {
    name: "Lower Central Incisor",
    category: "Teeth",
    color: "#f472b6",
    paths: [
      // Crown: narrower than upper, more upright
      { closed: false, points: [
        // Incisal edge (superior on lower incisor; crown faces up)
        { x: -0.01, y: -0.10 },
        { x:  0.01, y: -0.10 },
        // Labial surface (slight convexity)
        { x:  0.02, y: -0.08 },
        { x:  0.02, y: -0.05 },
        { x:  0.02, y: -0.02 },
        // CEJ labial
        { x:  0.01, y:  0.00 },
        // Root – more upright than upper incisor
        { x:  0.01, y:  0.04 },
        { x:  0.01, y:  0.08 },
        { x:  0.00, y:  0.12 },
        // Apex
        { x:  0.00, y:  0.14 },
        // Lingual root surface
        { x: -0.01, y:  0.10 },
        { x: -0.01, y:  0.06 },
        { x: -0.01, y:  0.02 },
        // CEJ lingual
        { x: -0.02, y:  0.00 },
        // Lingual surface of crown
        { x: -0.02, y: -0.04 },
        { x: -0.02, y: -0.07 },
        // Back to incisal
        { x: -0.01, y: -0.10 },
      ]},
    ],
  },

  lowerMolar: {
    name: "Lower First Molar",
    category: "Teeth",
    color: "#f472b6",
    paths: [
      // Crown: rectangular, five cusps visible in lateral projection
      { closed: false, points: [
        // Occlusal / cusp tips (superior aspect of lower molar faces up)
        { x: -0.08, y: -0.08 },
        { x: -0.05, y: -0.10 },
        { x: -0.02, y: -0.10 },
        { x:  0.01, y: -0.09 },
        { x:  0.04, y: -0.08 },
        // Buccal surface
        { x:  0.06, y: -0.05 },
        { x:  0.06, y: -0.01 },
        // Cervical area
        { x:  0.05, y:  0.01 },
        // Lingual surface
        { x:  0.02, y:  0.02 },
        { x: -0.02, y:  0.02 },
        { x: -0.06, y:  0.01 },
        { x: -0.08, y: -0.01 },
        { x: -0.09, y: -0.04 },
        { x: -0.08, y: -0.08 },
      ]},
      // Mesial root (anterior, slightly mesially inclined)
      { closed: false, points: [
        { x:  0.02, y:  0.01 },
        { x:  0.02, y:  0.05 },
        { x:  0.01, y:  0.09 },
        { x:  0.00, y:  0.13 },
        { x:  0.00, y:  0.16 },
      ]},
      // Distal root (posterior, more upright)
      { closed: false, points: [
        { x: -0.03, y:  0.02 },
        { x: -0.03, y:  0.06 },
        { x: -0.04, y:  0.10 },
        { x: -0.05, y:  0.13 },
        { x: -0.05, y:  0.15 },
      ]},
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // TEMPLATE 5 – LANDMARK DIAGRAM (FH plane registration)
  // Shows: Frankfort Horizontal (FH) plane, Sella (S), Nasion (N), ANS,
  // PNS, Point A, Articulare (Ar), Basion (Ba), Gonion (Go), Point B,
  // Pogonion (Pg), Gnathion (Gn), Menton (Me), mandibular plane (dashed).
  // This template is drawn as a schematic landmark overlay (not a full tracing)
  // matching Jacobson Fig 4-4 template 5.
  // ───────────────────────────────────────────────────────────────────────────
  landmarkDiagram: {
    name: "Landmark Diagram (Template 5)",
    category: "Craniofacial",
    color: "#e879f9",
    paths: [
      // Frankfort Horizontal (FH) – horizontal reference line through Porion
      // and Orbitale; the vertical drop line is perpendicular FH at Porion.
      { closed: false, points: [
        { x: -0.20, y:  0.00 },
        { x:  0.20, y:  0.00 },
      ]},
      // Perpendicular to FH through Porion (registration line)
      { closed: false, points: [
        { x: -0.17, y: -0.12 },
        { x: -0.17, y:  0.14 },
      ]},
      // S-N line (Anterior cranial base, from Sella to Nasion)
      // Nasion is anterior-superior to Sella by ~6–8° to FH in average adult
      { closed: false, points: [
        { x: -0.05, y: -0.02 },   // Sella (S)
        { x:  0.12, y: -0.10 },   // Nasion (N)
      ]},
      // Palatal plane (ANS–PNS) – nearly horizontal, slightly tipped
      { closed: false, points: [
        { x:  0.20, y:  0.02 },   // PNS
        { x:  0.32, y: -0.01 },   // ANS
      ]},
      // Occlusal plane (approximate midpoint between upper and lower molars)
      { closed: false, dashed: true, points: [
        { x:  0.04, y:  0.12 },
        { x:  0.28, y:  0.10 },
      ]},
      // Mandibular plane (Go–Me) – dashed
      { closed: false, dashed: true, points: [
        { x: -0.08, y:  0.08 },   // Gonion (Go)
        { x:  0.32, y:  0.28 },   // Menton (Me)
      ]},
      // Ramus / posterior facial height line (Ar–Go) – dashed
      { closed: false, dashed: true, points: [
        { x: -0.10, y: -0.08 },   // Articulare (Ar)
        { x: -0.08, y:  0.08 },   // Gonion (Go)
      ]},
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // PTERYGOMAXILLARY FISSURE (PTM / Ptm)
  // Teardrop-shaped radiolucent gap between maxillary tuberosity and
  // pterygoid plates.  Wide superiorly (above the palatal plane), tapers
  // to a point inferiorly.  Its most inferior point = Pterygomaxillare (Ptm).
  // ───────────────────────────────────────────────────────────────────────────
  pterygomaxillaryFissure: {
    name: "Pterygomaxillary Fissure",
    category: "Craniofacial",
    color: "#38bdf8",
    paths: [
      { closed: true, points: [
        // Superior (broad opening)
        { x:  0.00, y: -0.10 },
        { x:  0.02, y: -0.09 },
        { x:  0.03, y: -0.07 },
        { x:  0.04, y: -0.04 },
        { x:  0.04, y: -0.01 },
        { x:  0.03, y:  0.02 },
        { x:  0.02, y:  0.04 },
        { x:  0.01, y:  0.06 },
        // Inferior point = Ptm
        { x:  0.00, y:  0.07 },
        { x: -0.01, y:  0.06 },
        { x: -0.02, y:  0.04 },
        { x: -0.03, y:  0.02 },
        { x: -0.03, y: -0.01 },
        { x: -0.03, y: -0.04 },
        { x: -0.02, y: -0.07 },
        { x: -0.01, y: -0.09 },
      ]},
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // HYOID BONE
  // Body + greater cornu visible in lateral ceph below mandible.
  // Sits at approximately C3–C4 level, anterior neck.
  // ───────────────────────────────────────────────────────────────────────────
  hyoidBone: {
    name: "Hyoid Bone",
    category: "Soft Tissue",
    color: "#fb923c",
    paths: [
      // Body (central rectangle-like shape)
      { closed: false, points: [
        { x:  0.04, y: -0.02 },
        { x:  0.02, y: -0.03 },
        { x:  0.00, y: -0.03 },
        { x: -0.02, y: -0.03 },
        { x: -0.04, y: -0.02 },
        { x: -0.04, y:  0.00 },
        { x: -0.02, y:  0.01 },
        { x:  0.00, y:  0.01 },
        { x:  0.02, y:  0.01 },
        { x:  0.04, y:  0.00 },
        { x:  0.04, y: -0.02 },
      ]},
      // Greater cornu (right / anterior in lateral view – projects posteriorly)
      { closed: false, points: [
        { x: -0.04, y: -0.01 },
        { x: -0.07, y: -0.02 },
        { x: -0.10, y: -0.02 },
        { x: -0.12, y: -0.01 },
        { x: -0.13, y:  0.01 },
      ]},
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // CERVICAL VERTEBRAE (C1–C3 outline)
  // Visible posterior to the pharyngeal airway. C1 (Atlas) is ring-like,
  // C2 (Axis) has the prominent dens. Used for cervical vertebral maturation
  // (CVM) staging.
  // ───────────────────────────────────────────────────────────────────────────
  cervicalVertebrae: {
    name: "Cervical Vertebrae (C1–C3)",
    category: "Spine",
    color: "#60a5fa",
    paths: [
      // C1 – Atlas (ring-like body, no dens)
      { closed: true, points: [
        { x: -0.10, y: -0.04 },
        { x: -0.06, y: -0.05 },
        { x: -0.02, y: -0.05 },
        { x:  0.02, y: -0.04 },
        { x:  0.04, y: -0.02 },
        { x:  0.04, y:  0.00 },
        { x:  0.02, y:  0.02 },
        { x: -0.02, y:  0.03 },
        { x: -0.06, y:  0.02 },
        { x: -0.10, y:  0.00 },
        { x: -0.11, y: -0.02 },
      ]},
      // C2 – Axis body
      { closed: true, points: [
        { x: -0.10, y:  0.04 },
        { x: -0.06, y:  0.03 },
        { x: -0.02, y:  0.03 },
        { x:  0.02, y:  0.04 },
        { x:  0.04, y:  0.06 },
        { x:  0.04, y:  0.10 },
        { x:  0.02, y:  0.12 },
        { x: -0.02, y:  0.13 },
        { x: -0.06, y:  0.12 },
        { x: -0.10, y:  0.10 },
        { x: -0.11, y:  0.07 },
      ]},
      // Odontoid process (dens) of C2 – projects superiorly through C1
      { closed: true, points: [
        { x: -0.01, y: -0.05 },
        { x:  0.01, y: -0.05 },
        { x:  0.02, y: -0.07 },
        { x:  0.02, y: -0.10 },
        { x:  0.01, y: -0.12 },
        { x:  0.00, y: -0.13 },
        { x: -0.01, y: -0.12 },
        { x: -0.02, y: -0.10 },
        { x: -0.02, y: -0.07 },
      ]},
      // C3 body
      { closed: true, points: [
        { x: -0.10, y:  0.14 },
        { x: -0.06, y:  0.13 },
        { x: -0.02, y:  0.13 },
        { x:  0.02, y:  0.14 },
        { x:  0.04, y:  0.16 },
        { x:  0.04, y:  0.20 },
        { x:  0.02, y:  0.22 },
        { x: -0.02, y:  0.23 },
        { x: -0.06, y:  0.22 },
        { x: -0.10, y:  0.20 },
        { x: -0.11, y:  0.17 },
      ]},
    ],
  },

};

// ─────────────────────────────────────────────────────────────────────────────
export const SILHOUETTE_CATEGORIES = [
  { id: "Craniofacial", color: "#f59e0b" },
  { id: "Mandible",     color: "#a78bfa" },
  { id: "Teeth",        color: "#4ade80" },
  { id: "Soft Tissue",  color: "#fb923c" },
  { id: "Spine",        color: "#60a5fa" },
];

export function getSilhouettesByCategory() {
  const grouped = {};
  Object.entries(SILHOUETTES).forEach(([key, s]) => {
    const cat = s.category || "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({ key, ...s });
  });
  return grouped;
}
