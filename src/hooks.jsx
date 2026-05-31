/* eslint-disable react-refresh/only-export-components */
// ═══════════════════════════════════════════════════════════════════════════════
// HOOKS - Custom React hooks
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from "react";

export function useKatex() {
  const [loaded, setLoaded] = useState(!!window.katex);
  useEffect(() => {
    if (!document.getElementById("katex-css")) {
      const l = document.createElement("link");
      l.id = "katex-css"; l.rel = "stylesheet";
      l.href = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.8/katex.min.css";
      document.head.appendChild(l);
    }
    if (!document.getElementById("katex-js")) {
      const s = document.createElement("script");
      s.id = "katex-js";
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.8/katex.min.js";
      s.onload = () => setLoaded(true);
      document.head.appendChild(s);
    }
  }, []);
  return loaded;
}

export function KatexSpan({ latex, block = false, large = false, fontSize }) {
  const loaded = useKatex();
  const ref = useRef(null);
  useEffect(() => {
    if (!loaded || !ref.current || !window.katex) return;
    window.katex.render(latex, ref.current, {
      throwOnError: false, displayMode: block,
      output: "html",
    });
  }, [latex, block, loaded]);
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
        <button onClick={onClose} style={{ position: "absolute", top: 12, right: 16, background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 22, lineHeight: 1 }}>×</button>
        <div style={{ color: "#111", fontSize: "40pt", fontFamily: "'KaTeX_Main',serif", textAlign: "center", lineHeight: 1.4 }}>
          <KatexSpan latex={latex} block fontSize={40} />
        </div>
        <div style={{ marginTop: 24, padding: "8px 12px", background: "#f5f5f5", borderRadius: 6, fontFamily: "monospace", fontSize: 12, color: "#555", textAlign: "center", wordBreak: "break-all" }}>{latex}</div>
      </div>
    </div>
  );
}