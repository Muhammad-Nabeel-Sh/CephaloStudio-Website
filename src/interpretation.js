import { normDeviation } from "./utils.js";

const RULES = {
  // ═══════════════════════════════════════════
  // SKELETAL — AP
  // ═══════════════════════════════════════════
  SNA: {
    category: "skeletal", subgroup: "maxilla-ap",
    label: "SNA Angle",
    description: "Maxillary position relative to cranial base",
    interpret: (v, m) => {
      if (v > m) return "Maxilla is protruded relative to cranial base";
      if (v < m) return "Maxilla is retruded relative to cranial base";
      return "Maxillary position is within normal range";
    },
  },
  SNB: {
    category: "skeletal", subgroup: "mandible-ap",
    label: "SNB Angle",
    description: "Mandibular position relative to cranial base",
    interpret: (v, m) => {
      if (v > m) return "Mandible is prognathic relative to cranial base";
      if (v < m) return "Mandible is retrognathic relative to cranial base";
      return "Mandibular position is within normal range";
    },
  },
  ANB: {
    category: "skeletal", subgroup: "ap-differential",
    label: "ANB Angle",
    description: "Sagittal jaw relationship — difference between SNA and SNB",
    interpret: (v, m) => {
      if (v > m + 1) return "Skeletal Class II pattern (mandibular retrognathism or maxillary prognathism)";
      if (v < m - 1) return "Skeletal Class III pattern (mandibular prognathism or maxillary retrognathism)";
      return "Sagittal jaw relationship is within normal range (Class I)";
    },
  },
  "N-A-Pog": {
    category: "skeletal", subgroup: "ap-differential",
    label: "N-A-Pog Angle",
    description: "Facial convexity angle",
    interpret: (v, m) => {
      if (v > m) return "Facial profile is convex";
      if (v < m) return "Facial profile is concave";
      return "Facial profile is within normal range";
    },
  },
  "A-N-B": {
    category: "skeletal", subgroup: "ap-differential",
    label: "A-N-B Angle",
    description: "Skeletal convexity at nasion",
    interpret: (v, m) => {
      if (v > m) return "Increased skeletal convexity";
      if (v < m) return "Decreased skeletal convexity or straight profile";
      return "Skeletal convexity is within normal range";
    },
  },
  "Wits": {
    category: "skeletal", subgroup: "ap-differential",
    label: "Wits Appraisal",
    description: "Sagittal jaw relationship measured along occlusal plane",
    interpret: (v, m) => {
      if (v > m + 1) return "Skeletal Class II (maxillary protrusion or mandibular retrusion)";
      if (v < m - 1) return "Skeletal Class III (mandibular protrusion or maxillary retrusion)";
      return "Wits appraisal is within normal range (Class I)";
    },
  },
  "Facial axis": {
    category: "skeletal", subgroup: "overall",
    label: "Facial Axis Angle",
    description: "Direction of facial growth (Ricketts)",
    interpret: (v, m) => {
      if (v < m) return "Vertical/dolichofacial growth pattern";
      if (v > m) return "Horizontal/brachyfacial growth pattern";
      return "Facial growth pattern is within normal range";
    },
  },
  "Facial depth": {
    category: "skeletal", subgroup: "mandible-ap",
    label: "Facial Depth Angle",
    description: "Mandibular prominence in relation to Frankfort horizontal",
    interpret: (v, m) => {
      if (v > m) return "Increased mandibular prominence";
      if (v < m) return "Decreased mandibular prominence";
      return "Mandibular prominence is within normal range";
    },
  },
  "Convexity": {
    category: "skeletal", subgroup: "ap-differential",
    label: "Convexity (Point A to facial plane)",
    description: "Skeletal convexity measured in mm (Ricketts)",
    interpret: (v, m) => {
      if (v > m) return "Increased facial convexity";
      if (v < m) return "Straight or concave facial profile";
      return "Facial convexity is within normal range";
    },
  },
  "FMA": {
    category: "skeletal", subgroup: "vertical",
    label: "Frankfort-Mandibular Plane Angle",
    description: "Mandibular plane angle relative to Frankfort horizontal",
    interpret: (v, m) => {
      if (v > m) return "Hyperdivergent / high-angle skeletal pattern (increased vertical dimension)";
      if (v < m) return "Hypodivergent / low-angle skeletal pattern (decreased vertical dimension)";
      return "Vertical skeletal relationship is within normal range";
    },
  },
  "SN-MP": {
    category: "skeletal", subgroup: "vertical",
    label: "SN-Mandibular Plane Angle",
    description: "Mandibular plane angle relative to cranial base",
    interpret: (v, m) => {
      if (v > m) return "Hyperdivergent growth pattern (steep mandibular plane)";
      if (v < m) return "Hypodivergent growth pattern (flat mandibular plane)";
      return "Mandibular plane angle is within normal range";
    },
  },
  "GoGn-SN": {
    category: "skeletal", subgroup: "vertical",
    label: "GoGn-SN Angle",
    description: "Gonion-Gnathion to SN plane — mandibular inclination",
    interpret: (v, m) => {
      if (v > m) return "Increased mandibular inclination (hyperdivergent)";
      if (v < m) return "Decreased mandibular inclination (hypodivergent)";
      return "Mandibular inclination is within normal range";
    },
  },
  "SN-Occ": {
    category: "skeletal", subgroup: "vertical",
    label: "SN-Occlusal Plane Angle",
    description: "Occlusal plane inclination relative to cranial base",
    interpret: (v, m) => {
      if (v > m) return "Steep occlusal plane";
      if (v < m) return "Flat occlusal plane";
      return "Occlusal plane inclination is within normal range";
    },
  },
  "Lower facial height": {
    category: "skeletal", subgroup: "vertical",
    label: "Lower Facial Height Angle",
    description: "Proportion of lower facial height (Ricketts)",
    interpret: (v, m) => {
      if (v > m) return "Increased lower facial height (long-face tendency)";
      if (v < m) return "Decreased lower facial height (short-face tendency)";
      return "Lower facial height is within normal range";
    },
  },
  "Mandibular arc": {
    category: "skeletal", subgroup: "overall",
    label: "Mandibular Arc Angle",
    description: "Curvature of mandibular corpus growth (Ricketts)",
    interpret: (v, m) => {
      if (v < m) return "Deficient mandibular corpus growth";
      if (v > m) return "Excessive mandibular corpus growth";
      return "Mandibular arc is within normal range";
    },
  },
  "Y-axis": {
    category: "skeletal", subgroup: "vertical",
    label: "Y-Axis Angle",
    description: "Direction of facial growth relative to cranial base",
    interpret: (v, m) => {
      if (v > m) return "Vertical growth direction (dolichofacial)";
      if (v < m) return "Horizontal growth direction (brachyfacial)";
      return "Facial growth direction is within normal range";
    },
  },
  // ═══════════════════════════════════════════
  // DENTAL
  // ═══════════════════════════════════════════
  "U1-NA": {
    category: "dental", subgroup: "maxillary-incisor",
    label: "U1-NA Angle",
    description: "Maxillary central incisor inclination relative to NA line",
    interpret: (v, m) => {
      if (v > m) return "Maxillary incisors are proclined";
      if (v < m) return "Maxillary incisors are retroclined";
      return "Maxillary incisor inclination is within normal range";
    },
  },
  "U1-NA-mm": {
    category: "dental", subgroup: "maxillary-incisor",
    label: "U1-NA (mm)",
    description: "Maxillary incisor position relative to NA line (linear)",
    interpret: (v, m) => {
      if (v > m) return "Maxillary incisors are protrusive";
      if (v < m) return "Maxillary incisors are retrusive";
      return "Maxillary incisor position is within normal range";
    },
  },
  "U1-SN": {
    category: "dental", subgroup: "maxillary-incisor",
    label: "U1-SN Angle",
    description: "Maxillary incisor inclination relative to SN plane",
    interpret: (v, m) => {
      if (v > m) return "Maxillary incisors are proclined";
      if (v < m) return "Maxillary incisors are retroclined";
      return "Maxillary incisor inclination is within normal range";
    },
  },
  "U1-APog": {
    category: "dental", subgroup: "maxillary-incisor",
    label: "U1-APog Angle",
    description: "Maxillary incisor inclination relative to A-Pog line (Ricketts)",
    interpret: (v, m) => {
      if (v > m) return "Maxillary incisors are proclined";
      if (v < m) return "Maxillary incisors are retroclined";
      return "Maxillary incisor inclination is within normal range";
    },
  },
  "U1-APog-mm": {
    category: "dental", subgroup: "maxillary-incisor",
    label: "U1-APog (mm)",
    description: "Maxillary incisor position relative to A-Pog line (Ricketts)",
    interpret: (v, m) => {
      if (v > m) return "Maxillary incisors are protrusive";
      if (v < m) return "Maxillary incisors are retrusive";
      return "Maxillary incisor position is within normal range";
    },
  },
  "L1-NB": {
    category: "dental", subgroup: "mandibular-incisor",
    label: "L1-NB Angle",
    description: "Mandibular incisor inclination relative to NB line",
    interpret: (v, m) => {
      if (v > m) return "Mandibular incisors are proclined";
      if (v < m) return "Mandibular incisors are retroclined";
      return "Mandibular incisor inclination is within normal range";
    },
  },
  "L1-NB-mm": {
    category: "dental", subgroup: "mandibular-incisor",
    label: "L1-NB (mm)",
    description: "Mandibular incisor position relative to NB line (linear)",
    interpret: (v, m) => {
      if (v > m) return "Mandibular incisors are protrusive";
      if (v < m) return "Mandibular incisors are retrusive";
      return "Mandibular incisor position is within normal range";
    },
  },
  "L1-MP": {
    category: "dental", subgroup: "mandibular-incisor",
    label: "L1-MP Angle (IMPA)",
    description: "Mandibular incisor inclination relative to mandibular plane",
    interpret: (v, m) => {
      if (v > m) return "Mandibular incisors are proclined (lingual crown torque indicated)";
      if (v < m) return "Mandibular incisors are retroclined (labial crown torque indicated)";
      return "Mandibular incisor inclination is within normal range";
    },
  },
  "IMPA": {
    category: "dental", subgroup: "mandibular-incisor",
    label: "IMPA",
    description: "Incisor Mandibular Plane Angle",
    interpret: (v, m) => {
      if (v > m) return "Mandibular incisors are proclined";
      if (v < m) return "Mandibular incisors are retroclined";
      return "Incisor mandibular plane angle is within normal range";
    },
  },
  "Interincisal": {
    category: "dental", subgroup: "interincisal",
    label: "Interincisal Angle",
    description: "Angle between maxillary and mandibular incisors",
    interpret: (v, m) => {
      if (v > m) return "Interincisal angle is increased (incisors are retroclined relative to each other)";
      if (v < m) return "Interincisal angle is decreased (incisors are proclined relative to each other, bimaxillary protrusion tendency)";
      return "Interincisal relationship is within normal range";
    },
  },
  "U1-L1": {
    category: "dental", subgroup: "interincisal",
    label: "U1-L1 Angle",
    description: "Angle between upper and lower incisors",
    interpret: (v, m) => {
      if (v > m) return "Decreased incisor compensation (upright incisors)";
      if (v < m) return "Increased incisor compensation (bimaxillary proclination tendency)";
      return "Incisor compensation is within normal range";
    },
  },
  // ═══════════════════════════════════════════
  // SOFT TISSUE
  // ═══════════════════════════════════════════
  "NLA": {
    category: "soft-tissue", subgroup: "lip",
    label: "Nasolabial Angle",
    description: "Angle between columella and upper lip",
    interpret: (v, m) => {
      if (v > m) return "Nasolabial angle is obtuse (upper lip retrusive or nose drooping)";
      if (v < m) return "Nasolabial angle is acute (upper lip protrusive or nose tip elevated)";
      return "Nasolabial angle is within normal range";
    },
  },
  "ULP": {
    category: "soft-tissue", subgroup: "lip",
    label: "Upper Lip Position",
    description: "Upper lip prominence relative to esthetic plane",
    interpret: (v, m) => {
      if (v > m) return "Upper lip is protrusive";
      if (v < m) return "Upper lip is retrusive";
      return "Upper lip position is within normal range";
    },
  },
  "LLP": {
    category: "soft-tissue", subgroup: "lip",
    label: "Lower Lip Position",
    description: "Lower lip prominence relative to esthetic plane",
    interpret: (v, m) => {
      if (v > m) return "Lower lip is protrusive";
      if (v < m) return "Lower lip is retrusive";
      return "Lower lip position is within normal range";
    },
  },
  "Holdaway ratio": {
    category: "soft-tissue", subgroup: "lip",
    label: "Holdaway Ratio",
    description: "Ratio of soft tissue facial harmony",
    interpret: (v, m) => {
      if (v > m) return "Increased soft tissue convexity";
      if (v < m) return "Decreased soft tissue convexity or concave profile";
      return "Soft tissue harmony is within normal range";
    },
  },
  // ═══════════════════════════════════════════
  // AIRWAY
  // ═══════════════════════════════════════════
  "PAS": {
    category: "airway", subgroup: "pharyngeal",
    label: "Posterior Airway Space",
    description: "Pharyngeal airway space behind the tongue base",
    interpret: (v, m) => {
      if (v < m) return "Posterior airway space is narrowed (potential airway restriction)";
      if (v > m) return "Posterior airway space is adequate";
      return "Posterior airway space is within normal range";
    },
  },
  "PNS-A": {
    category: "airway", subgroup: "nasopharyngeal",
    label: "PNS-A Distance",
    description: "Nasopharyngeal airway depth",
    interpret: (v, m) => {
      if (v < m) return "Nasopharyngeal airway is narrowed";
      if (v > m) return "Nasopharyngeal airway is adequate";
      return "Nasopharyngeal airway depth is within normal range";
    },
  },
  // ═══════════════════════════════════════════
  // SKELETAL — Cranial Base
  // ═══════════════════════════════════════════
  "N-S-Ar": {
    category: "skeletal", subgroup: "cranial-base",
    label: "N-S-Ar (Saddle Angle)",
    description: "Cranial base flexure at sella — angle between anterior and posterior cranial base",
    interpret: (v, m) => {
      if (v > m) return "Cranial base is more flexed (kyphotic) — anterior cranial base rotated downward relative to posterior";
      if (v < m) return "Cranial base is more extended (lordotic) — anterior cranial base rotated upward relative to posterior";
      return "Cranial base flexure is within normal range";
    },
  },
  // ═══════════════════════════════════════════
  // SKELETAL — Mandibular Shape
  // ═══════════════════════════════════════════
  "S-Ar-Go": {
    category: "skeletal", subgroup: "mandibular-shape",
    label: "S-Ar-Go (Articular Angle)",
    description: "Angle at articulare between posterior cranial base and mandibular ramus",
    interpret: (v, m) => {
      if (v > m) return "Increased articular angle — ramus is more posteriorly inclined";
      if (v < m) return "Decreased articular angle — ramus is more anteriorly inclined";
      return "Articular angle is within normal range";
    },
  },
  "Ar-Go-Me": {
    category: "skeletal", subgroup: "mandibular-shape",
    label: "Ar-Go-Me (Gonial Angle)",
    description: "Angle between mandibular ramus and body — reflects mandibular shape and vertical pattern",
    interpret: (v, m) => {
      if (v > m) return "Increased gonial angle — associated with hyperdivergent growth and increased lower facial height";
      if (v < m) return "Decreased gonial angle — associated with hypodivergent growth and decreased lower facial height";
      return "Gonial angle is within normal range";
    },
  },
  // ═══════════════════════════════════════════
  // SKELETAL — Overall
  // ═══════════════════════════════════════════
  "Sum of angles": {
    category: "skeletal", subgroup: "overall",
    label: "Björk Sum of Angles",
    description: "Sum of saddle + articular + gonial angles — overall facial type indicator",
    interpret: (v, m) => {
      if (v > m) return "Increased sum — hyperdivergent facial type (vertical growth tendency)";
      if (v < m) return "Decreased sum — hypodivergent facial type (horizontal growth tendency)";
      return "Facial type is within normal range";
    },
  },
  "N-Pog": {
    category: "skeletal", subgroup: "overall",
    label: "N-Pog (Facial Plane)",
    description: "Facial plane line from nasion to pogonion — overall facial profile reference",
    interpret: (v, m) => {
      if (v > m) return "Facial plane is more anteriorly inclined";
      if (v < m) return "Facial plane is more posteriorly inclined";
      return "Facial plane inclination is within normal range";
    },
  },
  // ═══════════════════════════════════════════
  // SKELETAL — AP
  // ═══════════════════════════════════════════
  "N-A": {
    category: "skeletal", subgroup: "maxilla-ap",
    label: "N-A Angle",
    description: "Maxillary depth relative to nasion — position of Point A along cranial base",
    interpret: (v, m) => {
      if (v > m) return "Maxilla is more protrusive relative to nasion";
      if (v < m) return "Maxilla is more retrusive relative to nasion";
      return "Maxillary depth is within normal range";
    },
  },
  "N-B": {
    category: "skeletal", subgroup: "mandible-ap",
    label: "N-B Angle",
    description: "Mandibular depth relative to nasion — position of Point B along cranial base",
    interpret: (v, m) => {
      if (v > m) return "Mandible is more protrusive relative to nasion";
      if (v < m) return "Mandible is more retrusive relative to nasion";
      return "Mandibular depth is within normal range";
    },
  },
  "A-N": {
    category: "skeletal", subgroup: "maxilla-ap",
    label: "A-N Distance",
    description: "Linear distance from Point A to nasion — maxillary position",
    interpret: (v, m) => {
      if (v > m) return "Maxilla is protrusive relative to nasion";
      if (v < m) return "Maxilla is retrusive relative to nasion";
      return "Maxillary AP position is within normal range";
    },
  },
  "Facial angle": {
    category: "skeletal", subgroup: "ap-differential",
    label: "Facial Angle",
    description: "Angle between Frankfort horizontal and facial plane (N-Pog)",
    interpret: (v, m) => {
      if (v > m) return "Facial profile is more prognathic (mandibular prominence)";
      if (v < m) return "Facial profile is more retrognathic (mandibular deficiency)";
      return "Facial angle is within normal range";
    },
  },
  "AB plane angle": {
    category: "skeletal", subgroup: "ap-differential",
    label: "AB Plane Angle",
    description: "Angle between A-B line and facial plane (N-Pog) — sagittal jaw relationship",
    interpret: (v, m) => {
      if (v > m) return "AB plane angle increased — skeletal Class II tendency (Point B posterior to A)";
      if (v < m) return "AB plane angle decreased or negative — skeletal Class III tendency (Point B anterior to A)";
      return "AB plane angle is within normal range (Class I)";
    },
  },
  // ═══════════════════════════════════════════
  // SKELETAL — Vertical / Plane Angles
  // ═══════════════════════════════════════════
  "Mandibular plane": {
    category: "skeletal", subgroup: "vertical",
    label: "Mandibular Plane Angle",
    description: "Angle of mandibular plane relative to reference (Ricketts)",
    interpret: (v, m) => {
      if (v > m) return "Steep mandibular plane — hyperdivergent / high-angle pattern";
      if (v < m) return "Flat mandibular plane — hypodivergent / low-angle pattern";
      return "Mandibular plane angle is within normal range";
    },
  },
  "ML-NSL": {
    category: "skeletal", subgroup: "vertical",
    label: "ML-NSL Angle",
    description: "Mandibular line to NSL — mandibular inclination relative to anterior cranial base",
    interpret: (v, m) => {
      if (v > m) return "Steep mandibular inclination — hyperdivergent growth pattern";
      if (v < m) return "Flat mandibular inclination — hypodivergent growth pattern";
      return "Mandibular inclination is within normal range";
    },
  },
  "NL-NSL": {
    category: "skeletal", subgroup: "vertical",
    label: "NL-NSL Angle",
    description: "Nasal line to NSL — maxillary inclination relative to anterior cranial base",
    interpret: (v, m) => {
      if (v > m) return "Maxillary plane is steep — posterior maxillary vertical excess";
      if (v < m) return "Maxillary plane is flat — reduced maxillary inclination";
      return "Maxillary inclination is within normal range";
    },
  },
  // ═══════════════════════════════════════════
  // DENTAL — Additional
  // ═══════════════════════════════════════════
  "FMIA": {
    category: "dental", subgroup: "mandibular-incisor",
    label: "FMIA (Frankfort-Mandibular Incisor Angle)",
    description: "Angle between Frankfort horizontal and long axis of mandibular incisor (Tweed)",
    interpret: (v, m) => {
      if (v > m) return "Mandibular incisors are retroclined relative to Frankfort horizontal";
      if (v < m) return "Mandibular incisors are proclined relative to Frankfort horizontal";
      return "FMIA is within normal range";
    },
  },
  "L1-APog": {
    category: "dental", subgroup: "mandibular-incisor",
    label: "L1-APog Angle",
    description: "Mandibular incisor inclination relative to A-Pog line",
    interpret: (v, m) => {
      if (v > m) return "Mandibular incisors are proclined relative to A-Pog line";
      if (v < m) return "Mandibular incisors are retroclined relative to A-Pog line";
      return "Mandibular incisor inclination is within normal range";
    },
  },
  "L1-APog-mm": {
    category: "dental", subgroup: "mandibular-incisor",
    label: "L1-APog (mm)",
    description: "Mandibular incisor position relative to A-Pog line (linear)",
    interpret: (v, m) => {
      if (v > m) return "Mandibular incisors are protrusive relative to A-Pog line";
      if (v < m) return "Mandibular incisors are retrusive relative to A-Pog line";
      return "Mandibular incisor position is within normal range";
    },
  },
  "Occlusal plane": {
    category: "dental", subgroup: "occlusion",
    label: "Occlusal Plane Angle",
    description: "Inclination of the occlusal plane relative to a reference plane",
    interpret: (v, m) => {
      if (v > m) return "Steep occlusal plane — associated with hyperdivergent pattern";
      if (v < m) return "Flat occlusal plane — associated with hypodivergent pattern";
      return "Occlusal plane inclination is within normal range";
    },
  },
  "SNB/Facial angle": {
    category: "assessment", subgroup: "overall",
    label: "Overall AP Assessment",
    description: "Combined assessment of mandibular AP position",
  },
  "ANB difference": {
    category: "assessment", subgroup: "sagittal",
    label: "Sagittal Classification",
    description: "Skeletal Class determination based on ANB",
  },
};

const PATTERN_RECOGNIZERS = [
  {
    id: "skeletal-class",
    label: "Skeletal Class",
    analyze: (deviations) => {
      const anb = deviations.find(d => d.label === "ANB");
      const wits = deviations.find(d => d.label === "Wits");
      if (!anb && !wits) return null;
      const anbZ = anb?.zScore ?? 0;
      const witsZ = wits?.zScore ?? 0;
      if (anbZ > 1.5 || witsZ > 1.5) return { severity: anbZ > 2 || witsZ > 2 ? "severe" : "moderate", summary: "Skeletal Class II pattern", detail: "ANB and/or Wits appraisal indicate sagittal imbalance with mandibular deficiency or maxillary excess." };
      if (anbZ < -1.5 || witsZ < -1.5) return { severity: anbZ < -2 || witsZ < -2 ? "severe" : "moderate", summary: "Skeletal Class III pattern", detail: "ANB and/or Wits appraisal indicate sagittal imbalance with mandibular excess or maxillary deficiency." };
      return null;
    },
  },
  {
    id: "vertical-pattern",
    label: "Vertical Pattern",
    analyze: (deviations) => {
      const vert = deviations.filter(d => d.category === "skeletal" && ["vertical", "overall"].includes(d.subgroup));
      if (vert.length === 0) return null;
      const avgZ = vert.reduce((s, d) => s + d.zScore, 0) / vert.length;
      if (avgZ > 1.2) return { severity: avgZ > 2 ? "severe" : "moderate", summary: "Hyperdivergent growth pattern", detail: "Multiple vertical measurements indicate a tendency toward increased lower facial height and steep mandibular plane." };
      if (avgZ < -1.2) return { severity: avgZ < -2 ? "severe" : "moderate", summary: "Hypodivergent growth pattern", detail: "Multiple vertical measurements indicate a tendency toward decreased lower facial height and flat mandibular plane." };
      return null;
    },
  },
  {
    id: "incisor-compensation",
    label: "Incisor Compensation",
    analyze: (deviations) => {
      const upper = deviations.find(d => d.label === "U1-SN" || d.label === "U1-NA");
      const lower = deviations.find(d => d.label === "L1-MP" || d.label === "IMPA" || d.label === "L1-NB");
      if (!upper || !lower) return null;
      if (upper.zScore > 1 && lower.zScore > 1) return { severity: "moderate", summary: "Bimaxillary protrusion", detail: "Both maxillary and mandibular incisors are proclined — common in bimaxillary dentoalveolar protrusion." };
      if (upper.zScore > 1 && lower.zScore < -1) return { severity: "moderate", summary: "Compensated Class II Division 2 pattern", detail: "Maxillary incisors are proclined while mandibular incisors are retroclined — compensatory mechanism." };
      if (upper.zScore < -1 && lower.zScore > 1) return { severity: "moderate", summary: "Proclined lower incisors with retroclined upper incisors", detail: "May indicate dentoalveolar compensation for skeletal discrepancy." };
      return null;
    },
  },
];

export function generateInterpretation(allMeas, norms) {
  const deviations = [];
  for (const { m, meas } of allMeas) {
    if (!m.label) continue;
    for (const [measureType, value] of Object.entries(meas)) {
      if (typeof value !== "number" || !isFinite(value)) continue;
      const norm = norms.find(n => n.markupLabel === m.label && n.measureType === measureType);
      if (!norm || norm.sd <= 0) continue;
      const dev = normDeviation(value, norm);
      const rule = RULES[m.label] || RULES[m.label.split(" ").slice(0, 2).join(" ")];
      const interpretFn = rule?.interpret || (() => "");
      deviations.push({
        label: m.label,
        measureType,
        value,
        mean: norm.mean,
        sd: norm.sd,
        delta: dev.delta,
        zScore: dev.sdUnits,
        within1SD: dev.within1SD,
        within2SD: dev.within2SD,
        category: rule?.category || "other",
        subgroup: rule?.subgroup || "",
        description: rule?.description || "",
        interpretation: interpretFn(value, norm.mean),
        normSource: norm.source,
      });
    }
  }
  const patterns = [];
  for (const recognizer of PATTERN_RECOGNIZERS) {
    const result = recognizer.analyze(deviations);
    if (result) patterns.push({ id: recognizer.id, label: recognizer.label, ...result });
  }
  return { deviations, patterns };
}
