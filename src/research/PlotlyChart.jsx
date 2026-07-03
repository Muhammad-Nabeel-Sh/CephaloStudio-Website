/* eslint-disable react-refresh/only-export-components */
import { useRef, useEffect, useState, useCallback } from "react";

const FONT_STACK = "'DM Sans','DM Mono',monospace";
const FAILED = "Chart library failed to load.";

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

const btnStyle = (t) => ({
  position: "absolute", top: 4, right: 4, width: 26, height: 26, borderRadius: 4,
  border: `1px solid ${t?.bdr || "#444"}`, background: t?.surf3 || "#2a2a3e",
  color: t?.tx2 || "#888", cursor: "pointer", display: "flex", alignItems: "center",
  justifyContent: "center", fontSize: 13, lineHeight: 1, zIndex: 10, opacity: 0.6,
  transition: "opacity 0.15s",
});

export function heatmapLayout(t, extra) {
  return {
    paper_bgcolor: t.surf,
    plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 11 },
    xaxis: { side: "top", tickangle: -30, tickfont: { size: 9 }, gridcolor: t.surf3, zeroline: false },
    yaxis: { tickfont: { size: 9 }, gridcolor: t.surf3, zeroline: false, autorange: "reversed" },
    margin: { l: 80, r: 20, t: 60, b: 20 },
    ...extra,
  };
}

export function heatmapData(z, xLabels, yLabels, text, extra) {
  return [{
    z,
    x: xLabels,
    y: yLabels || xLabels,
    type: "heatmap",
    text: text || null,
    hovertemplate: "%{x} \u00d7 %{y}: %{z:.3f}<extra></extra>",
    hoverongaps: false,
    ...extra,
  }];
}

export default function PlotlyChart({ data, layout, config, style, filename }) {
  const ref = useRef(null);
  const [status, setStatus] = useState("loading");
  const plotlyRef = useRef(null);
  const [t, setT] = useState(null);

  const download = useCallback((fmt) => {
    const p = plotlyRef.current;
    if (!p || !ref.current) return;
    const name = filename || layout?.title || "chart";
    p.downloadImage(ref.current, { format: fmt, width: ref.current.clientWidth * 2, height: ref.current.clientHeight * 2, filename: name });
  }, [filename, layout]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !data) return;
    let cancelled = false;

    import("plotly.js-dist-min").then(Plotly => {
      if (cancelled || el !== ref.current) return;
      plotlyRef.current = Plotly;
      Plotly.newPlot(el, deepClone(data), deepClone(layout), {
        responsive: true, displayModeBar: false, ...(config || {}),
      });
      setStatus("ok");
      setT(layout?.font?.color ? { tx2: layout.font.color, bdr: layout.font.color + "44", surf3: layout.paper_bgcolor || "#1a1a2e" } : null);
    }).catch(() => {
      if (!cancelled) setStatus("error");
    });

    return () => {
      cancelled = true;
      if (plotlyRef.current && el) {
        plotlyRef.current.purge(el);
        plotlyRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "error") return <div style={{ padding: 40, textAlign: "center", color: "#999", fontFamily: FONT_STACK, fontSize: 12 }}>{FAILED}</div>;
  if (!data) return null;

  return (
    <div style={{ position: "relative" }}>
      {status === "ok" && (
        <button onClick={() => download("png")} title="Download PNG"
          style={btnStyle(t)} onMouseEnter={e => e.currentTarget.style.opacity = 1}
          onMouseLeave={e => e.currentTarget.style.opacity = 0.6}>⇩</button>
      )}
      <div ref={ref} style={{ width: "100%", minHeight: 300, ...style }} />
    </div>
  );
}
