import { useMemo } from "react";
import { computeAirwayMeasurements } from "../research/airway.js";
import { InfoBox, Tag, Btn } from "../ui.jsx";

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const REQUIRED_LANDMARKS = [
  "PNS", "Ba", "C3", "H", "Eb", "TT", "SP", "Ad1",
  "Ad2", "Ad3", "Ad4", "Vallecula", "Epiglottis", "PASbot",
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function isPlaced(markups, label) {
  try {
    const lo = label.toLowerCase();
    return markups.some(
      (m) =>
        m.visible !== false &&
        m.label &&
        m.label.toLowerCase() === lo &&
        m.points &&
        m.points.length > 0 &&
        m.points[0].x > -9000
    );
  } catch {
    return false;
  }
}

function zBadge(z, t) {
  if (z === null || z === undefined) return { color: t.tx3, label: "—" };
  const a = Math.abs(z);
  if (a <= 1) return { color: t.ok, label: "Normal" };
  if (a <= 2) return { color: t.warn, label: "Borderline" };
  return { color: t.err, label: "Constrained" };
}

function fmtVal(v) {
  if (v === null || v === undefined) return "—";
  return v % 1 === 0 ? v.toFixed(1) : v.toFixed(1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function AirwayPanel({ t, markups, calibration, norms, onAddPoint, onUpdateMarkups, showOverlay, onToggleOverlay }) {
  void norms;
  void onUpdateMarkups;

  const measurements = useMemo(
    () => computeAirwayMeasurements(markups, calibration),
    [markups, calibration],
  );

  const summary = useMemo(() => {
    const valid = measurements.filter((m) => m.value !== null && m.zScore !== null);
    const total = valid.length;
    const abnormal = valid.filter((m) => Math.abs(m.zScore) > 1).length;
    return { total, normal: total - abnormal, abnormal };
  }, [measurements]);

  const calDone = calibration?.done === true;
  const unit = calDone ? "mm" : "px";

  return (
    <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
      {/* ─── Header ─── */}
      <div style={{ fontSize: 13, fontWeight: 700, color: t.tx, marginTop: 8 }}>
        Airway Analysis
      </div>
      <InfoBox t={t}>
        Computes pharyngeal airway dimensions from placed cephalometric landmarks.
        Place required landmarks below to enable measurements.
      </InfoBox>

      {/* ─── Calibration warning ─── */}
      {!calDone && (
        <div
          style={{
            background: t.warn + "18",
            border: `1px solid ${t.warn}44`,
            borderRadius: 6,
            padding: "8px 10px",
            fontSize: 11,
            color: t.warn,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ fontSize: 13 }}>⚠</span>
          <span>Not calibrated — values shown in pixels</span>
        </div>
      )}

      {/* ─── Required Landmarks ─── */}
      <div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: t.tx2,
            textTransform: "uppercase",
            letterSpacing: 0.6,
            marginBottom: 6,
          }}
        >
          Required Landmarks
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          {REQUIRED_LANDMARKS.map((label) => {
            const placed = isPlaced(markups, label);
            return (
              <div
                key={label}
                onClick={() => !placed && onAddPoint && onAddPoint(label)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 6px",
                  borderRadius: 4,
                  background: placed ? t.ok + "0a" : t.surf3 + "66",
                  border: `1px solid ${placed ? t.ok + "30" : t.bdr}`,
                  cursor: placed ? "default" : "pointer",
                  fontSize: 10,
                  color: t.tx,
                  transition: "all 0.12s",
                  fontFamily: "'DM Mono', monospace",
                }}
                title={placed ? `${label} placed` : `Click to place ${label}`}
              >
                {placed ? (
                  <span style={{ color: t.ok, fontSize: 12 }}>✓</span>
                ) : (
                  <span style={{ color: t.warn, fontSize: 12 }}>⚠</span>
                )}
                <span style={{ flex: 1 }}>{label}</span>
                {!placed && (
                  <span style={{ fontSize: 8, color: t.tx3 }}>place</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Divider ─── */}
      <div style={{ height: 1, background: t.bdr, margin: "2px 0" }} />

      {/* ─── Airway Overlay Toggle ─── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 8px",
          borderRadius: 6,
          background: t.surf3 + "44",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={onToggleOverlay}
      >
        <input
          type="checkbox"
          checked={showOverlay}
          onChange={onToggleOverlay}
          style={{ accentColor: t.acc, cursor: "pointer", margin: 0 }}
        />
        <span style={{ fontSize: 11, fontWeight: 600, color: t.tx, flex: 1 }}>
          Airway Overlay
        </span>
        <span style={{ fontSize: 9, color: t.tx3 }}>
          {showOverlay ? "Visible" : "Hidden"}
        </span>
      </div>

      {/* ─── Measurements ─── */}
      <div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: t.tx2,
            textTransform: "uppercase",
            letterSpacing: 0.6,
            marginBottom: 6,
          }}
        >
          Measurements
        </div>
        {measurements.length === 0 ? (
          <div style={{ fontSize: 10, color: t.tx3, textAlign: "center", padding: "12px 0" }}>
            No airway measurements available.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {measurements.map((m) => {
              const badge = zBadge(m.zScore, t);
              const valStr = m.value !== null ? `${fmtVal(m.value)} ${m.unit || unit}` : "—";
              const rangeStr =
                m.normMean && m.normSD
                  ? `${(m.normMean - m.normSD).toFixed(1)}–${(m.normMean + m.normSD).toFixed(1)} ${m.unit || unit}`
                  : "—";
              return (
                <div
                  key={m.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: "2px 6px",
                    padding: "5px 8px",
                    borderRadius: 5,
                    background: t.surf2,
                    border: `1px solid ${t.bdr}`,
                    borderLeft: m.value !== null ? `3px solid ${badge.color}` : `3px solid ${t.tx3}44`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: t.tx,
                      fontFamily: "'DM Mono', monospace",
                    }}
                  >
                    {m.label}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: m.value !== null ? t.tx : t.tx3,
                      textAlign: "right",
                      fontFamily: "'DM Mono', monospace",
                    }}
                  >
                    {valStr}
                  </div>
                  {m.zScore !== null && (
                    <div
                      style={{
                        fontSize: 8,
                        color: t.tx3,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: badge.color,
                          flexShrink: 0,
                        }}
                      />
                      {badge.label}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: 8,
                      color: t.tx3,
                      textAlign: "right",
                    }}
                  >
                    {rangeStr}
                  </div>
                  {m.value === null && (
                    <div
                      style={{
                        fontSize: 8,
                        color: t.tx3,
                        fontStyle: "italic",
                        gridColumn: "1 / -1",
                      }}
                    >
                      {m.interpretation || "Missing landmarks"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Summary ─── */}
      {summary.total > 0 && (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            background: t.surf3,
            border: `1px solid ${t.bdr}`,
            fontSize: 11,
            lineHeight: 1.5,
          }}
        >
          {summary.abnormal === 0 ? (
            <span style={{ color: t.ok, fontWeight: 600 }}>
              All measurements within normal range
            </span>
          ) : (
            <span
              style={{
                color: summary.abnormal > summary.total / 2 ? t.err : t.warn,
                fontWeight: 600,
              }}
            >
              {summary.abnormal} of {summary.total} measurements abnormal
            </span>
          )}
        </div>
      )}
    </div>
  );
}
