/* eslint-disable react-refresh/only-export-components */
// ═══════════════════════════════════════════════════════════════════════════════
// HOOKS - Custom React hooks
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from "react";
// KaTeX is now BUNDLED from the npm package (was loaded at runtime from
// cdnjs.cloudflare.com with no integrity/SRI — a supply-chain and offline
// risk for a clinical tool). Bundling ships the matched CSS+JS from the same
// origin as the app, so a CDN compromise or offline clinic can't break or
// hijack rendering. The version now tracks package.json (^0.16.44) instead of
// the previously-hardcoded 0.16.8 CDN path.
import katex from "katex";
import "katex/dist/katex.min.css";

// Kept for API compatibility. KaTeX is available synchronously now, so there is
// no async load step — always reports loaded.
export function useKatex() {
  return true;
}

export function KatexSpan({ latex, block = false, large = false, fontSize }) {
  useKatex();
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !katex) return;
    try {
      katex.render(latex, ref.current, {
        throwOnError: false, displayMode: block,
        output: "html",
      });
    } catch { /* ignore KaTeX render errors */ }
  }, [latex, block]);
  const size = fontSize ? `${fontSize}pt` : (large ? "2.4rem" : "inherit");
  return (
    <span ref={ref}
      style={{ fontSize: size, fontFamily: "inherit", display: block ? "block" : "inline" }}
    />
  );
}

export function LatexFloatingPanel({ latex, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#ffffff", borderRadius: 16, padding: "48px 60px", maxWidth: "80vw", minWidth: 360, boxShadow: "0 32px 80px rgba(0,0,0,0.5)", position: "relative" }}>
        <button onClick={onClose} title="Close" style={{ position: "absolute", top: 12, right: 16, background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 22, lineHeight: 1 }}>×</button>
        <div style={{ color: "#111", fontSize: "40pt", fontFamily: "'KaTeX_Main',serif", textAlign: "center", lineHeight: 1.4 }}>
          <KatexSpan latex={latex} block fontSize={40} />
        </div>
        <div style={{ marginTop: 24, padding: "8px 12px", background: "#f5f5f5", borderRadius: 6, fontFamily: "monospace", fontSize: 12, color: "#555", textAlign: "center", wordBreak: "break-all" }}>{latex}</div>
      </div>
    </div>
  );
}