// F3: Image processing Web Worker — runs per-pixel loops off the main thread.
// Inlines the small pure helpers (clamp, getLUTColor, applyEdgeKernel) so the
// worker is self-contained and doesn't pull in React component modules.

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function getLUTColor(v, mode, invert) {
  v = clamp(Math.round(v), 0, 255);
  if (invert) v = 255 - v;
  switch (mode) {
    case "hot": if (v < 85) return [v * 3, 0, 0]; if (v < 170) return [255, (v - 85) * 3, 0]; return [255, 255, (v - 170) * 3];
    case "cool": return [v, 255 - v, 255];
    case "jet": {
      const n = v / 255;
      let r = 0, g = 0, b = 0;
      if (n < 0.125) b = 0.5 + 4 * n;
      else if (n < 0.375) { g = 4 * (n - 0.125); b = 1; }
      else if (n < 0.625) { r = 4 * (n - 0.375); g = 1; b = 1 - 4 * (n - 0.375); }
      else if (n < 0.875) { r = 1; g = 1 - 4 * (n - 0.625); }
      else { r = 1 - 4 * (n - 0.875); }
      return [r * 255, g * 255, b * 255];
    }
    case "viridis": {
      const stops = [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]];
      const n = v / 255 * 4, i = Math.min(3, Math.floor(n)), f = n - i, c0 = stops[i], c1 = stops[i + 1];
      return [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f];
    }
    case "bone": {
      const n = v / 255;
      return [clamp(n * 210, 0, 255), clamp(n * 210, 0, 255), clamp(v * 1.08, 0, 255)];
    }
    case "rainbow": {
      const h = v / 255 * 300;
      let r = 0, g = 0, b = 0;
      if (h < 60) { r = 0.5; g = h / 60 * 0.5; }
      else if (h < 120) { r = 0.5 - (h - 60) / 60 * 0.5; g = 0.5; }
      else if (h < 180) { g = 0.5; b = (h - 120) / 60 * 0.5; }
      else if (h < 240) { g = 0.5 - (h - 180) / 60 * 0.5; b = 0.5; }
      else if (h < 300) { r = (h - 240) / 60 * 0.5; b = 0.5; }
      else { r = 0.5; b = 0.5 - (h - 300) / 60 * 0.5; }
      return [(r + 0.2) * 255, (g + 0.2) * 255, (b + 0.2) * 255];
    }
    default: return [v, v, v];
  }
}

function applyEdgeKernel(data, width, height, strength) {
  const out = new Uint8ClampedArray(data), k = clamp(strength / 100 * 2.5, 0, 3);
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const ci = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const v = data[ci + c] * (1 + 4 * k)
          - data[((y - 1) * width + x) * 4 + c] * k
          - data[((y + 1) * width + x) * 4 + c] * k
          - data[(y * width + x - 1) * 4 + c] * k
          - data[(y * width + x + 1) * 4 + c] * k;
        out[ci + c] = clamp(v, 0, 255);
      }
    }
  return out;
}

self.onmessage = function (e) {
  const { id, pixels, width, height, proc, lutMode, lutInvert } = e.data;
  const { brightness = 0, contrast = 0, windowWidth = 0, windowCenter = 128, edgeEnhance = 0 } = proc;
  let data = pixels;
  if (edgeEnhance > 0) data = applyEdgeKernel(data, width, height, edgeEnhance);
  const cf = (contrast + 100) / 100;
  for (let i = 0; i < data.length; i += 4) {
    let v = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (windowWidth > 0) { const lo = windowCenter - windowWidth / 2, hi = windowCenter + windowWidth / 2; v = clamp((v - lo) / Math.max(hi - lo, 1) * 255, 0, 255); }
    v = clamp(v + brightness, 0, 255);
    v = clamp((v - 128) * cf + 128, 0, 255);
    const [lr, lg, lb] = getLUTColor(v, lutMode, lutInvert);
    data[i] = lr; data[i + 1] = lg; data[i + 2] = lb;
  }
  self.postMessage({ id, data }, [data.buffer]);
};
