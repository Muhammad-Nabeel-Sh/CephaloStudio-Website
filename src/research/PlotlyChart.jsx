/* eslint-disable react-refresh/only-export-components */
import { useRef, useEffect, useState } from "react";

const FONT_STACK = "'DM Sans','DM Mono',monospace";
const FAILED = "Chart library failed to load.";

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

export function heatmapLayout(t, extra) {
  return {
    paper_bgcolor: t.surf,
    plot_bgcolor: t.surf,
    font: { color: t.tx2, family: FONT_STACK, size: 10 },
    xaxis: { side: "top", tickangle: -30, tickfont: { size: 8 }, gridcolor: t.surf3, zeroline: false },
    yaxis: { tickfont: { size: 8 }, gridcolor: t.surf3, zeroline: false, autorange: "reversed" },
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

export default function PlotlyChart({ data, layout, config, style }) {
  const ref = useRef(null);
  const [status, setStatus] = useState("loading");
  const plotlyRef = useRef(null);

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

  return <div ref={ref} style={{ width: "100%", minHeight: 300, ...style }} />;
}
