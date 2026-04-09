// ═══════════════════════════════════════════════════════════════════════════════
// MODALS - Dialog components
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { uid, vpts } from "./utils.js";
import { THEMES } from "./constants.js";

const DEFAULT_THEME = THEMES.bluish;

// Helper components (duplicated to avoid circular deps - could be moved to ui.js later)
function Btn({ onClick, children, style, active, small, danger, t = DEFAULT_THEME, disabled, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: small ? "4px 10px" : "8px 16px",
        background: active ? t.acc : (danger ? t.err : t.surf2),
        color: active ? "#fff" : (danger ? "#fff" : t.tx),
        border: `1px solid ${active ? t.acc : (danger ? t.err : t.bdr)}`,
        borderRadius: 6,
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: small ? 11 : 13,
        fontWeight: 600,
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.15s",
        fontFamily: "inherit",
        ...style
      }}
    >
      {children}
    </button>
  );
}

function Inp({ value, onChange, t = DEFAULT_THEME }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: t.surf3,
        border: `1px solid ${t.bdr}`,
        borderRadius: 4,
        padding: "6px 10px",
        color: t.tx,
        fontSize: 12,
        width: "100%",
        fontFamily: "inherit"
      }}
    />
  );
}

function PropRow({ label, t = DEFAULT_THEME, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: t.tx2, marginBottom: 3 }}>{label}</div>
      {children}
    </div>
  );
}

function Divider({ t = DEFAULT_THEME }) {
  return <div style={{ height: 1, background: t.bdr, margin: "16px 0" }} />;
}

function Modal({ t = DEFAULT_THEME, title, children, onClose, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: t.surf, borderRadius: 12, border: `1px solid ${t.bdr}`, padding: 20, minWidth: wide ? 500 : 320, maxWidth: "90vw", maxHeight: "90vh", overflow: "auto", boxShadow: `0 16px 48px ${t.shadow}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.tx }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: t.tx2, cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Hash function for PIN
async function hashPin(pin) {
  const msgBuffer = new TextEncoder().encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Modal components
export function CalibModal({ t, calibration, onFinish }) {
  const [mm, setMm] = useState(String(calibration.knownMm || "10"));
  const [ppm, setPpm] = useState(String(calibration.pxPerMm || "1"));
  const [mode, setMode] = useState("ruler");

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {["ruler", "manual"].map(m => (
          <Btn key={m} t={t} small active={mode === m} onClick={() => setMode(m)}>
            {m === "ruler" ? "From Ruler" : "Manual px/mm"}
          </Btn>
        ))}
      </div>
      {mode === "ruler" ? (
        <>
          <div style={{ fontSize: 13, color: t.tx2, marginBottom: 16, lineHeight: 1.6 }}>
            Draw a ruler on the image (⟺ key), then enter its real-world length.
          </div>
          <PropRow label="Distance (mm)" t={t}>
            <input
              type="number"
              value={mm}
              onChange={e => setMm(e.target.value)}
              min="1"
              style={{ background: t.surf2, border: `1px solid ${t.bdr}`, borderRadius: 6, padding: "6px 10px", color: t.tx, fontSize: 14, width: "100%", fontFamily: "'DM Mono', monospace" }}
            />
          </PropRow>
          <Btn t={t} onClick={() => onFinish(parseFloat(mm))} style={{ width: "100%", marginTop: 12 }}>
            Set Calibration
          </Btn>
        </>
      ) : (
        <>
          <div style={{ fontSize: 13, color: t.tx2, marginBottom: 16 }}>
            Enter px/mm directly (from DICOM metadata).
          </div>
          {calibration.done && (
            <div style={{ fontSize: 12, color: t.ok, marginBottom: 10 }}>
              Current: {calibration.pxPerMm.toFixed(4)} px/mm
            </div>
          )}
          <PropRow label="px / mm" t={t}>
            <input
              type="number"
              value={ppm}
              onChange={e => setPpm(e.target.value)}
              step="0.001"
              min="0.001"
              style={{ background: t.surf2, border: `1px solid ${t.bdr}`, borderRadius: 6, padding: "6px 10px", color: t.tx, fontSize: 14, width: "100%", fontFamily: "'DM Mono', monospace" }}
            />
          </PropRow>
          <Btn t={t} onClick={() => onFinish(parseFloat(mm), parseFloat(ppm))} style={{ width: "100%", marginTop: 12 }}>
            Apply
          </Btn>
        </>
      )}
    </div>
  );
}

export function TextModal({ t, onConfirm, onCancel, defaultColor }) {
  const [txt, setTxt] = useState("Label");
  const [fontSize, setFontSize] = useState(14);
  const [bold, setBold] = useState(false);
  const [color, setColor] = useState(defaultColor || "#38bdf8");

  return (
    <div>
      <PropRow label="Text" t={t}><Inp value={txt} onChange={setTxt} t={t} /></PropRow>
      <PropRow label="Size" t={t}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="range" min={8} max={48} value={fontSize} onChange={e => setFontSize(+e.target.value)} style={{ flex: 1, accentColor: t.acc }} />
          <span style={{ fontSize: 11, color: t.tx2, fontFamily: "'DM Mono', monospace", width: 30 }}>{fontSize}px</span>
        </div>
      </PropRow>
      <PropRow label="Bold" t={t}><input type="checkbox" checked={bold} onChange={e => setBold(e.target.checked)} style={{ accentColor: t.acc }} /></PropRow>
      <PropRow label="Color" t={t}><input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: 40, height: 28, border: "none", cursor: "pointer", borderRadius: 4 }} /></PropRow>
      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <Btn t={t} onClick={() => onConfirm(txt, { fontSize, bold, color })} style={{ flex: 1 }}>Add</Btn>
        <Btn t={t} onClick={onCancel} style={{ flex: 1 }}>Cancel</Btn>
      </div>
    </div>
  );
}

export function AnonModal({ t, project, onUpdateProject, onClose }) {
  const [pin, setPin] = useState("");
  const [requirePin, setRequirePin] = useState(project.accessControl?.requirePin || false);

  const anonymize = async () => {
    if (!window.confirm("Remove all patient identifiers permanently?")) return;
    onUpdateProject({ meta: { ...project.meta, patientId: "ANON-" + uid().toUpperCase(), patientName: "", dob: "", age: "", clinician: "", facility: "", referral: "", notes: "[Anonymized]", anonymized: true } });
  };

  const savePin = async () => {
    if (pin.length < 4) { alert("PIN must be ≥4 characters"); return; }
    const hash = await hashPin(pin);
    onUpdateProject({ accessControl: { requirePin, pinHash: hash } });
    setPin("");
    alert("PIN saved.");
  };

  return (
    <div>
      <div style={{ marginBottom: 16, padding: 12, background: t.surf2, borderRadius: 8, border: `1px solid ${t.bdr}` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: t.tx, marginBottom: 10 }}>Patient Metadata</div>
        {[["patientId", "Patient ID"], ["patientName", "Name"], ["dob", "DOB"], ["age", "Age"], ["gender", "Gender"], ["clinician", "Clinician"], ["facility", "Facility"]].map(([k, label]) => (
          <PropRow key={k} label={label} t={t}>
            <input
              type="text"
              value={project.meta[k] || ""}
              onChange={e => onUpdateProject({ meta: { ...project.meta, [k]: e.target.value } })}
              style={{ background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "4px 8px", color: t.tx, fontSize: 12, width: 240, fontFamily: "inherit" }}
            />
          </PropRow>
        ))}
      </div>
      {project.meta.anonymized ? (
        <div style={{ padding: 10, background: t.ok + "11", border: `1px solid ${t.ok}33`, borderRadius: 6, fontSize: 12, color: t.ok, marginBottom: 16 }}>✓ Case is anonymized.</div>
      ) : (
        <Btn t={t} danger onClick={anonymize} style={{ width: "100%", marginBottom: 16 }}>🔏 Anonymize (irreversible)</Btn>
      )}
      <Divider t={t} />
      <div style={{ fontSize: 12, fontWeight: 700, color: t.tx, marginBottom: 8 }}>Access Control</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <input type="checkbox" id="rp" checked={requirePin} onChange={e => setRequirePin(e.target.checked)} style={{ accentColor: t.acc }} />
        <label htmlFor="rp" style={{ fontSize: 12, color: t.tx }}>Require PIN to open</label>
      </div>
      {requirePin && (
        <>
          <PropRow label="New PIN" t={t}>
            <input
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="Min 4 chars"
              style={{ background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "4px 8px", color: t.tx, fontSize: 12, width: "100%", fontFamily: "inherit" }}
            />
          </PropRow>
          <Btn t={t} onClick={savePin} style={{ width: "100%" }}>Save PIN</Btn>
        </>
      )}
    </div>
  );
}

export function AlignModal({ t, markups, images, onUpdateImages, onClose }) {
  const pts = markups.filter(m => m.type === "point" && vpts(m)[0]?.x > -9000);
  const [src1, setSrc1] = useState("");
  const [dst1, setDst1] = useState("");
  const [src2, setSrc2] = useState("");
  const [dst2, setDst2] = useState("");
  const [tgtId, setTgtId] = useState(images[1]?.id || "");

  const PtSel = ({ val, onChange }) => (
    <select
      value={val}
      onChange={e => onChange(e.target.value)}
      style={{ width: "100%", background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "4px 8px", color: t.tx, fontSize: 12, fontFamily: "inherit" }}
    >
      <option value="">—</option>
      {pts.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
    </select>
  );

  const align = () => {
    const sp1 = vpts(markups.find(m => m.id === src1) || {})[0], dp1 = vpts(markups.find(m => m.id === dst1) || {})[0];
    if (!sp1 || !dp1) return;
    let tf;
    if (src2 && dst2) {
      const sp2 = vpts(markups.find(m => m.id === src2) || {})[0], dp2 = vpts(markups.find(m => m.id === dst2) || {})[0];
      tf = sp2 && dp2 ? alignTwoPoints(sp1, sp2, dp1, dp2) : alignOnePoint(sp1, dp1);
    } else {
      tf = alignOnePoint(sp1, dp1);
    }
    const tgt = images.find(i => i.id === tgtId);
    if (!tgt || !tf) return;
    const oldImg = tgt;
    const oldW = oldImg.width || 600, oldH = oldImg.height || 500;
    const newW = oldW, newH = oldH;
    const cos = Math.cos(tf.rot) * tf.scale, sin = Math.sin(tf.rot) * tf.scale;
    const newImg = {
      ...oldImg,
      cx: (tf.tx + cos * oldW / 2 - sin * oldH / 2) + (newW - oldW) / 2,
      cy: (tf.ty + sin * oldW / 2 + cos * oldH / 2) + (newH - oldH) / 2,
      rot: (oldImg.rot || 0) + tf.rot,
      scale: (oldImg.scale || 1) * tf.scale
    };
    onUpdateImages(images.map(i => i.id === tgtId ? newImg : i));
    onClose();
  };

  return (
    <div>
      <PropRow label="Target" t={t}>
        <select
          value={tgtId}
          onChange={e => setTgtId(e.target.value)}
          style={{ width: "100%", background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "4px 8px", color: t.tx, fontSize: 12, fontFamily: "inherit" }}
        >
          {images.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </PropRow>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div><div style={{ fontSize: 10, color: t.tx2, marginBottom: 2 }}>Src pt 1</div><PtSel val={src1} onChange={setSrc1} /></div>
        <div><div style={{ fontSize: 10, color: t.tx2, marginBottom: 2 }}>Dst pt 1</div><PtSel val={dst1} onChange={setDst1} /></div>
        <div><div style={{ fontSize: 10, color: t.tx2, marginBottom: 2 }}>Src pt 2</div><PtSel val={src2} onChange={setSrc2} /></div>
        <div><div style={{ fontSize: 10, color: t.tx2, marginBottom: 2 }}>Dst pt 2</div><PtSel val={dst2} onChange={setDst2} /></div>
      </div>
      <div style={{ fontSize: 11, color: t.tx3, marginBottom: 12 }}>Use 1 point for translation, 2 for rotation + scale.</div>
      <Btn t={t} onClick={align} style={{ width: "100%" }}>Apply Transform</Btn>
    </div>
  );
}

// Inline alignTwoPoints for AlignModal
function alignOnePoint(src, dst) {
  return { tx: dst.x - src.x, ty: dst.y - src.y, rot: 0, scale: 1 };
}

function alignTwoPoints(s1, s2, d1, d2) {
  const srcA = Math.atan2(s2.y - s1.y, s2.x - s1.x), dstA = Math.atan2(d2.y - d1.y, d2.x - d1.x);
  const rot = dstA - srcA, srcLen = dist(s1, s2), dstLen = dist(d1, d2), scale = srcLen > 1e-9 ? dstLen / srcLen : 1;
  const cos = Math.cos(rot) * scale, sin = Math.sin(rot) * scale;
  return { tx: d1.x - (cos * s1.x - sin * s1.y), ty: d1.y - (sin * s1.x + cos * s1.y), rot, scale };
}

function dist(a, b) {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

export function TransformModal({ t, images, onUpdateImages, onClose }) {
  const [tgtId, setTgtId] = useState(images[0]?.id || "");
  const [dx, setDx] = useState("0");
  const [dy, setDy] = useState("0");
  const [scale, setScale] = useState("1");
  const [rot, setRot] = useState("0");

  const apply = () => {
    const img = images.find(i => i.id === tgtId);
    if (!img) return;
    const newImg = {
      ...img,
      cx: (img.cx || 0) + parseFloat(dx),
      cy: (img.cy || 0) + parseFloat(dy),
      scale: (img.scale || 1) * parseFloat(scale),
      rot: (img.rot || 0) + parseFloat(rot) * Math.PI / 180
    };
    onUpdateImages(images.map(i => i.id === tgtId ? newImg : i));
    onClose();
  };

  return (
    <div>
      <PropRow label="Image" t={t}>
        <select value={tgtId} onChange={e => setTgtId(e.target.value)} style={{ width: "100%", background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "4px 8px", color: t.tx, fontSize: 12 }}>
          {images.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </PropRow>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <PropRow label="Translate X" t={t}><input type="number" value={dx} onChange={e => setDx(e.target.value)} style={{ background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "4px 8px", color: t.tx, fontSize: 12, width: "100%" }} /></PropRow>
        <PropRow label="Translate Y" t={t}><input type="number" value={dy} onChange={e => setDy(e.target.value)} style={{ background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "4px 8px", color: t.tx, fontSize: 12, width: "100%" }} /></PropRow>
        <PropRow label="Scale" t={t}><input type="number" value={scale} step="0.1" onChange={e => setScale(e.target.value)} style={{ background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "4px 8px", color: t.tx, fontSize: 12, width: "100%" }} /></PropRow>
        <PropRow label="Rotate (°)" t={t}><input type="number" value={rot} onChange={e => setRot(e.target.value)} style={{ background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "4px 8px", color: t.tx, fontSize: 12, width: "100%" }} /></PropRow>
      </div>
      <Btn t={t} onClick={apply} style={{ width: "100%", marginTop: 12 }}>Apply</Btn>
    </div>
  );
}

export function DatabaseImportModal({ t, onImport, onClose }) {
  const [url, setUrl] = useState("");

  const import_ = () => {
    if (!url.trim()) return;
    onImport(url.trim());
    onClose();
  };

  return (
    <div>
      <div style={{ fontSize: 12, color: t.tx2, marginBottom: 12 }}>Enter image URLs (one per line) to import:</div>
      <textarea
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="https://example.com/image1.png&#10;https://example.com/image2.png"
        style={{ width: "100%", height: 150, background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: 8, color: t.tx, fontSize: 12, fontFamily: "monospace", resize: "vertical" }}
      />
      <Btn t={t} onClick={import_} style={{ width: "100%", marginTop: 12 }}>Import</Btn>
    </div>
  );
}

export function CreateStudyModal({ t, onCreate, onClose }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("intra");
  const [operators, setOperators] = useState([{ name: "Operator 1" }]);
  const [expectedTrials, setExpectedTrials] = useState(3);

  const addOp = () => setOperators([...operators, { name: `Operator ${operators.length + 1}` }]);
  const remOp = i => setOperators(operators.filter((_, j) => j !== i));
  const setOpName = (i, n) => setOperators(operators.map((o, j) => j === i ? { ...o, name: n } : o));

  return (
    <div>
      <PropRow label="Study Name" t={t}>
        <Inp value={name} onChange={setName} t={t} />
      </PropRow>
      <PropRow label="Type" t={t}>
        <select value={type} onChange={e => setType(e.target.value)} style={{ width: "100%", background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "4px 8px", color: t.tx, fontSize: 12 }}>
          <option value="intra">Intra-rater (same operator, multiple trials)</option>
          <option value="inter">Inter-rater (multiple operators, one trial each)</option>
        </select>
      </PropRow>
      {type === "inter" && (
        <>
          <div style={{ fontSize: 11, color: t.tx2, marginBottom: 6 }}>Operators</div>
          {operators.map((o, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
              <Inp value={o.name} onChange={n => setOpName(i, n)} t={t} />
              {operators.length > 1 && <Btn t={t} small onClick={() => remOp(i)}>×</Btn>}
            </div>
          ))}
          <Btn t={t} small onClick={addOp} style={{ marginBottom: 12 }}>+ Add Operator</Btn>
        </>
      )}
      {type === "intra" && (
        <PropRow label="Expected Trials" t={t}>
          <input type="number" value={expectedTrials} onChange={e => setExpectedTrials(+e.target.value)} min={2} max={20} style={{ background: t.surf3, border: `1px solid ${t.bdr}`, borderRadius: 4, padding: "4px 8px", color: t.tx, fontSize: 12, width: 60 }} />
        </PropRow>
      )}
      <Btn t={t} onClick={() => name && onCreate(name, type, operators, expectedTrials)} disabled={!name} style={{ width: "100%", marginTop: 12 }}>Create Study</Btn>
    </div>
  );
}

export { Modal, Btn, Inp, PropRow, Divider };