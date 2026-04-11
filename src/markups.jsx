import { clamp, dist, angle3pt, angle4pt, perpDist, polyArea, polyLen, vpts, catmullRom, splineArea, splineLen, getInfiniteLinePoints } from "./utils.js";

function isReproPointVisible(m, reproCollecting){
  if(!reproCollecting || !m.repro) return true;
  return m.repro.studyId === reproCollecting.studyId && m.repro.opId === reproCollecting.opId && m.repro.trialIdx === reproCollecting.trialIdx;
}

export function drawMeasLabel(ctx, text, x, y, showAnnotations = true, annotationSize = 1){
  if(!showAnnotations) return;
  
  const fontSize = 10 * annotationSize;
  const prevFont = ctx.font;
  ctx.font = `${fontSize}px "DM Mono",monospace`;
  
  const metrics = ctx.measureText(text);
  const padding = 3 * annotationSize;
  const bgHeight = 14 * annotationSize;
  
  ctx.fillStyle = "rgba(46, 46, 46, 0.85)";
  ctx.roundRect(x - padding, y - bgHeight + 2, metrics.width + padding * 2, bgHeight + 4 , 5);
  ctx.fill();
  
  const prevFill = ctx.fillStyle;
  ctx.fillStyle = "#fff";
  ctx.fillText(text, x, y);
  ctx.fillStyle = prevFill;
  ctx.font = prevFont;
}

export function drawMarkup(ctx, m, zoom, pan, cal, sel, t, reproCollecting, canvasSize, angleMode, showAnnotations = true, annotationSize = 1){
  if(m.visible === false) return;
  if(m.type === "point" && m.repro && !isReproPointVisible(m, reproCollecting)) return;
  
  const sc = p => ({ x: p.x * zoom + pan.x, y: p.y * zoom + pan.y });
  const fmtAngle = (v) => {
    const [sign, unit] = angleMode?.split("-") || ["signed", "deg"];
    if(sign === "abs") v = Math.abs(v);
    else if(sign === "simple") v = Math.abs(v);
    else if(sign === "reflex") v = Math.abs(v) > 180 ? 360 - Math.abs(v) : 360 - Math.abs(v);
    if(unit === "rad") return (v * Math.PI / 180).toFixed(4) + " rad";
    return v.toFixed(1) + "°";
  };
  
  const sp = vpts(m).map(sc);
  if(!sp.length) return;
  
  const isSel = sel === m.id;
  ctx.save();
  
  switch(m.type){
    case "point":
      drawPoint(ctx, m, sp, isSel, t, zoom, pan, showAnnotations, annotationSize);
      break;
    case "arrow":
      drawArrow(ctx, m, sp, t, zoom);
      break;
    case "line":
    case "parallel":
      drawLine(ctx, m, sp, isSel, t, cal, zoom, canvasSize, showAnnotations, annotationSize);
      break;
    case "angle3":
      drawAngle3(ctx, m, sp, isSel, t, cal, zoom, fmtAngle, showAnnotations, annotationSize);
      break;
    case "angle4":
      drawAngle4(ctx, m, sp, t, fmtAngle, zoom, showAnnotations, annotationSize);
      break;
    case "polygon":
      drawPolygon(ctx, m, sp, isSel, t, cal, zoom, showAnnotations, annotationSize);
      break;
    case "curve":
      drawCurve(ctx, m, sp, isSel, t, cal, zoom, showAnnotations, annotationSize);
      break;
    case "perp":
      drawPerp(ctx, m, sp, t, cal, zoom, pan, showAnnotations, annotationSize);
      break;
    case "text":
      drawText(ctx, m, sp, isSel, t, zoom, showAnnotations, annotationSize);
      break;
    case "ruler":
      drawRuler(ctx, m, sp, t, zoom, showAnnotations, annotationSize);
      break;
  }
  
  ctx.restore();
}

function drawPoint(ctx, m, sp, isSel, t, zoom, pan, showAnnotations, annotationSize = 1){
  const p = sp[0], r = (m.size || 6) * Math.sqrt(zoom);
  
  if(m.arrowFrom && m.arrowFrom.x > -9000){
    const ap = { x: m.arrowFrom.x * zoom + pan.x, y: m.arrowFrom.y * zoom + pan.y };
    ctx.strokeStyle = m.color || t.acc;
    ctx.lineWidth = 2 * Math.sqrt(zoom);
    ctx.beginPath();
    ctx.moveTo(ap.x, ap.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    
    const angle = Math.atan2(p.y - ap.y, p.x - ap.x);
    const arrowSize = 10 * Math.sqrt(zoom);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - arrowSize * Math.cos(angle - Math.PI/6), p.y - arrowSize * Math.sin(angle - Math.PI/6));
    ctx.lineTo(p.x - arrowSize * Math.cos(angle + Math.PI/6), p.y - arrowSize * Math.sin(angle + Math.PI/6));
    ctx.closePath();
    ctx.fillStyle = m.color || t.acc;
    ctx.fill();
  }
  
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = m.color || t.acc;
  ctx.fill();
  
  if(isSel){
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  
  ctx.strokeStyle = m.color || t.acc;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(p.x - r * 1.9, p.y);
  ctx.lineTo(p.x + r * 1.9, p.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - r * 1.9);
  ctx.lineTo(p.x, p.y + r * 1.9);
  ctx.stroke();
  
  if(m.label && showAnnotations){
    const fs = clamp(11 * Math.sqrt(zoom) * annotationSize, 9, 16);
    ctx.font = `bold ${fs}px "DM Mono",monospace`;
    ctx.fillStyle = m.color || t.acc;
    drawMeasLabel(ctx, m.label, p.x + r + 3, p.y - r - 1, showAnnotations, annotationSize);
  }
}

function drawArrow(ctx, m, sp, t, zoom){
  if(sp.length < 2){ ctx.restore(); return; }
  const p1 = sp[0], p2 = sp[1];
  
  ctx.strokeStyle = m.color || t.acc;
  ctx.lineWidth = (m.width || 2) * Math.sqrt(zoom);
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
  
  const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  const arrowSize = 12 * Math.sqrt(zoom);
  ctx.beginPath();
  ctx.moveTo(p2.x, p2.y);
  ctx.lineTo(p2.x - arrowSize * Math.cos(angle - Math.PI/6), p2.y - arrowSize * Math.sin(angle - Math.PI/6));
  ctx.lineTo(p2.x - arrowSize * Math.cos(angle + Math.PI/6), p2.y - arrowSize * Math.sin(angle + Math.PI/6));
  ctx.closePath();
  ctx.fillStyle = m.color || t.acc;
  ctx.fill();
}

function drawLine(ctx, m, sp, isSel, t, cal, zoom, canvasSize, showAnnotations, annotationSize = 1){
  if(sp.length < 2){ ctx.restore(); return; }
  
  const isInfinite = m.mode === "infinite";
  const cw = canvasSize?.w || 800, ch = canvasSize?.h || 600;
  const linePts = isInfinite ? getInfiniteLinePoints(sp[0], sp[1], cw, ch) : [sp[0], sp[1]];
  
  ctx.strokeStyle = "#a706e2";
  ctx.lineWidth = (m.width || 1.5) * Math.sqrt(zoom);
  
  if(m.style === "dashed") ctx.setLineDash([8 * zoom, 4 * zoom]);
  else if(m.style === "dotted") ctx.setLineDash([2 * zoom, 4 * zoom]);
  else ctx.setLineDash([]);
  
  ctx.beginPath();
  ctx.moveTo(linePts[0].x, linePts[0].y);
  ctx.lineTo(linePts[1].x, linePts[1].y);
  ctx.stroke();
  ctx.setLineDash([]);
  
  if(isSel){
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = (m.width || 1.5) * Math.sqrt(zoom) + 4;
    ctx.beginPath();
    ctx.moveTo(linePts[0].x, linePts[0].y);
    ctx.lineTo(linePts[1].x, linePts[1].y);
    ctx.stroke();
  }
  
  if(showAnnotations && (m.type === "line" || m.type === "parallel") && !isInfinite && cal?.done && cal.pxPerMm){
    const ip = vpts(m);
    if(ip.length >= 2){
      const d = dist(ip[0], ip[1]) / cal.pxPerMm;
      const mid = { x: (sp[0].x + sp[1].x) / 2, y: (sp[0].y + sp[1].y) / 2 };
      ctx.font = `${clamp(10 * Math.sqrt(zoom) * annotationSize, 8, 14)}px "DM Mono",monospace`;
      ctx.fillStyle = "#a706e2";
      drawMeasLabel(ctx, d.toFixed(1) + " mm", mid.x + 10, mid.y - 15, showAnnotations, annotationSize);
    }
  }
  
  if(isSel && m.locked && showAnnotations){
    const mid = { x: (sp[0].x + sp[1].x) / 2, y: (sp[0].y + sp[1].y) / 2 };
    ctx.font = `${clamp(10 * Math.sqrt(zoom) * annotationSize, 8, 14)}px "DM Mono",monospace`;
    ctx.fillStyle = "#f59e0b";
    drawMeasLabel(ctx, "🔒", mid.x + 5, mid.y + 28, showAnnotations, annotationSize);
  }
}

function drawAngle3(ctx, m, sp, isSel, t, cal, zoom, fmtAngle, showAnnotations, annotationSize = 1){
  if(sp.length < 3){ ctx.restore(); return; }
  
  ctx.strokeStyle = m.color || "#f472b6";
  ctx.lineWidth = (m.width || 1.5) * Math.sqrt(zoom);
  ctx.setLineDash([]);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  
  ctx.beginPath();
  ctx.moveTo(sp[0].x, sp[0].y);
  ctx.lineTo(sp[1].x, sp[1].y);
  ctx.lineTo(sp[2].x, sp[2].y);
  ctx.stroke();
  
  const ip = vpts(m);
  const v1 = { x: ip[0].x - ip[1].x, y: ip[0].y - ip[1].y };
  const v2 = { x: ip[2].x - ip[1].x, y: ip[2].y - ip[1].y };
  const a1 = Math.atan2(v1.y, v1.x);
  const a2 = Math.atan2(v2.y, v2.x);
  const arcR = 24 * Math.sqrt(zoom);
  
  let startA = a1, endA = a2;
  if(endA < startA){ const tmp = startA; startA = endA; endA = tmp; }
  if(endA - startA > Math.PI){ startA += Math.PI * 2; }
  
  ctx.beginPath();
  ctx.arc(sp[1].x, sp[1].y, arcR, startA, endA);
  ctx.strokeStyle = (m.color || "#f472b6") + "99";
  ctx.lineWidth = (m.width || 1.5) * 0.8 * Math.sqrt(zoom);
  ctx.stroke();
  
  if(showAnnotations){
    const ang = angle3pt(ip[0], ip[1], ip[2]);
    const midA = (startA + endA) / 2;
    ctx.font = `bold ${clamp(11 * Math.sqrt(zoom), 9, 15)}px "DM Mono",monospace`;
    ctx.fillStyle = m.color || "#f472b6";
    drawMeasLabel(ctx, fmtAngle(ang), sp[1].x + Math.cos(midA) * (arcR + 16), sp[1].y + Math.sin(midA) * (arcR + 16), showAnnotations, annotationSize);
  }
}

function drawAngle4(ctx, m, sp, t, fmtAngle, zoom, showAnnotations, annotationSize = 1){
  if(sp.length < 4){ ctx.restore(); return; }
  
  ctx.strokeStyle = m.color || "#f472b6";
  ctx.lineWidth = (m.width || 1.5) * Math.sqrt(zoom);
  ctx.setLineDash([]);
  
  ctx.beginPath();
  ctx.moveTo(sp[0].x, sp[0].y);
  ctx.lineTo(sp[1].x, sp[1].y);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(sp[2].x, sp[2].y);
  ctx.lineTo(sp[3].x, sp[3].y);
  ctx.stroke();
  
  if(showAnnotations){
    const ip = vpts(m);
    const ang = angle4pt(ip[0], ip[1], ip[2], ip[3]);
    const cx = (sp[0].x + sp[1].x + sp[2].x + sp[3].x) / 4;
    const cy = (sp[0].y + sp[1].y + sp[2].y + sp[3].y) / 4;
    
    ctx.font = `bold ${clamp(11 * Math.sqrt(zoom), 9, 15)}px "DM Mono",monospace`;
    ctx.fillStyle = m.color || "#f472b6";
    drawMeasLabel(ctx, fmtAngle(ang), cx, cy - 8, showAnnotations, annotationSize);
  }
}

function drawPolygon(ctx, m, sp, isSel, t, cal, zoom, showAnnotations, annotationSize = 1){
  if(sp.length < 2){ ctx.restore(); return; }
  
  ctx.beginPath();
  if(m.curveStyle === "bspline" && sp.length >= 3) catmullRom(ctx, sp, true);
  else{
    ctx.moveTo(sp[0].x, sp[0].y);
    sp.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.closePath();
  }
  
  ctx.fillStyle = m.fillColor || "rgba(56,189,248,0.12)";
  ctx.fill();
  
  if(m.style === "dashed") ctx.setLineDash([8 * zoom, 4 * zoom]);
  else if(m.style === "dotted") ctx.setLineDash([2 * zoom, 4 * zoom]);
  else ctx.setLineDash([]);
  
  ctx.strokeStyle = m.strokeColor || t.acc;
  ctx.lineWidth = (m.strokeWidth || 1.5) * Math.sqrt(zoom);
  ctx.stroke();
  ctx.setLineDash([]);
  
  if(isSel){
    sp.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
    });
  }
  
  if(showAnnotations && cal?.done && sp.length >= 3){
    const ip = vpts(m);
    const cx = sp.reduce((s, p) => s + p.x, 0) / sp.length;
    const cy = sp.reduce((s, p) => s + p.y, 0) / sp.length;
    const area = (m.curveStyle === "bspline" ? splineArea(ip) : polyArea(ip)) / cal.pxPerMm ** 2;
    ctx.font = `${clamp(10 * Math.sqrt(zoom), 8, 14)}px "DM Mono",monospace`;
    ctx.fillStyle = m.strokeColor || t.acc;
    drawMeasLabel(ctx, area.toFixed(1) + " mm²", cx - 20, cy, showAnnotations, annotationSize);
  }
  
  if(m.label && showAnnotations){
    const cx = sp.reduce((s, p) => s + p.x, 0) / sp.length;
    const cy = sp.reduce((s, p) => s + p.y, 0) / sp.length;
    ctx.font = `bold ${clamp(10 * Math.sqrt(zoom), 8, 14)}px "DM Mono",monospace`;
    ctx.fillStyle = m.strokeColor || t.acc;
    drawMeasLabel(ctx, m.label, cx - 20, cy + 16, showAnnotations, annotationSize);
  }
}

function drawCurve(ctx, m, sp, isSel, t, cal, zoom, showAnnotations, annotationSize = 1){
  if(sp.length < 2){ ctx.restore(); return; }
  
  if(m.style === "dashed") ctx.setLineDash([8 * zoom, 4 * zoom]);
  else if(m.style === "dotted") ctx.setLineDash([2 * zoom, 4 * zoom]);
  else ctx.setLineDash([]);
  
  ctx.strokeStyle = m.color || "#fb923c";
  ctx.lineWidth = (m.width || 1.5) * Math.sqrt(zoom);
  ctx.beginPath();
  
  if(m.curveStyle === "bspline" && sp.length >= 3) catmullRom(ctx, sp, false);
  else{
    ctx.moveTo(sp[0].x, sp[0].y);
    sp.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
  }
  ctx.stroke();
  ctx.setLineDash([]);
  
  if(isSel){
    sp.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
    });
  }
  
  if(showAnnotations && cal?.done){
    const ip = vpts(m);
    const lp = sp[Math.floor(sp.length / 2)];
    const len = (m.curveStyle === "bspline" && ip.length >= 3 ? splineLen(ip, false) : polyLen(ip, false)) / cal.pxPerMm;
    ctx.font = `${clamp(10 * Math.sqrt(zoom), 8, 14)}px "DM Mono",monospace`;
    ctx.fillStyle = m.color || "#fb923c";
    drawMeasLabel(ctx, len.toFixed(1) + " mm", lp.x + 5, lp.y - 8, showAnnotations, annotationSize);
  }
}

function drawPerp(ctx, m, sp, t, cal, zoom, pan, showAnnotations, annotationSize = 1){
  if(sp.length < 2){ ctx.restore(); return; }
  
  ctx.strokeStyle = m.color || "#a78bfa";
  ctx.lineWidth = (m.width || 1.5) * Math.sqrt(zoom);
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(sp[0].x, sp[0].y);
  ctx.lineTo(sp[1].x, sp[1].y);
  ctx.stroke();
  
  if(sp.length >= 3 && showAnnotations){
    const ip = vpts(m);
    if(ip.length >= 3){
      const ax = ip[0].x, ay = ip[0].y;
      const bx = ip[1].x, by = ip[1].y;
      const px = ip[2].x, py = ip[2].y;
      const t2 = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / Math.max(dist(ip[0], ip[1]) ** 2, 1e-9);
      const fx = ax + t2 * (bx - ax);
      const fy = ay + t2 * (by - ay);
      const fs = { x: fx * zoom + pan.x, y: fy * zoom + pan.y };
      
      ctx.setLineDash([4 * zoom, 4 * zoom]);
      ctx.strokeStyle = (m.color || "#a78bfa") + "cc";
      ctx.beginPath();
      ctx.moveTo(sp[2].x, sp[2].y);
      ctx.lineTo(fs.x, fs.y);
      ctx.stroke();
      ctx.setLineDash([]);
      
      const d2 = dist(ip[0], ip[1]);
      if(d2 > 1e-6){
        const dx = (bx - ax) / d2 * 8 * Math.sqrt(zoom);
        const dy = (by - ay) / d2 * 8 * Math.sqrt(zoom);
        ctx.strokeStyle = m.color || "#a78bfa";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(fs.x + dx, fs.y + dy);
        ctx.lineTo(fs.x + dx - dy, fs.y + dy + dx);
        ctx.lineTo(fs.x - dy, fs.y + dx);
        ctx.stroke();
      }
      
      if(cal?.done){
        const pd = perpDist(ip[2], ip[0], ip[1]) / cal.pxPerMm;
        const lx = (sp[2].x + fs.x) / 2;
        const ly = (sp[2].y + fs.y) / 2;
        ctx.font = `bold ${clamp(10 * Math.sqrt(zoom), 8, 14)}px "DM Mono",monospace`;
        ctx.fillStyle = m.color || "#a78bfa";
        drawMeasLabel(ctx, pd.toFixed(1) + " mm", lx + 5, ly, showAnnotations, annotationSize);
      }
    }
  }
}

function drawText(ctx, m, sp, isSel, t, zoom){
  if(!sp.length){ ctx.restore(); return; }
  
  const p = sp[0];
  const fs = clamp((m.fontSize || 14) * Math.sqrt(zoom), 8, 48);
  ctx.font = `${m.bold ? "bold " : ""}${fs}px "DM Sans",sans-serif`;
  ctx.fillStyle = m.color || t.acc;
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 5;
  ctx.fillText(m.text || "Text", p.x, p.y);
  ctx.shadowBlur = 0;
  
  if(isSel){
    const mtr = ctx.measureText(m.text || "Text");
    ctx.strokeStyle = t.acc + "88";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(p.x - 2, p.y - fs, mtr.width + 4, fs + 6);
    ctx.setLineDash([]);
  }
}

function drawRuler(ctx, m, sp, t, zoom, showAnnotations, annotationSize = 1){
  if(sp.length < 2){ ctx.restore(); return; }
  
  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = 2 * Math.sqrt(zoom);
  ctx.setLineDash([6 * zoom, 3 * zoom]);
  ctx.beginPath();
  ctx.moveTo(sp[0].x, sp[0].y);
  ctx.lineTo(sp[1].x, sp[1].y);
  ctx.stroke();
  ctx.setLineDash([]);
  
  [sp[0], sp[1]].forEach(p => {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 8 * Math.sqrt(zoom));
    ctx.lineTo(p.x, p.y + 8 * Math.sqrt(zoom));
    ctx.stroke();
  });
  
  if(showAnnotations){
    const mid = { x: (sp[0].x + sp[1].x) / 2, y: (sp[0].y + sp[1].y) / 2 };
    ctx.font = `bold ${clamp(11 * Math.sqrt(zoom), 9, 15)}px "DM Mono",monospace`;
    ctx.fillStyle = "#facc15";
    drawMeasLabel(ctx, m.label || "ruler", mid.x + 5, mid.y - 8, showAnnotations, annotationSize);
  }
}

export function drawInProgress(ctx, draw, mp, zoom, pan, t){
  if(!draw) return;
  
  const sc = p => ({ x: p.x * zoom + pan.x, y: p.y * zoom + pan.y });
  const sp = draw.points.filter(p => p.x > -9000).map(sc);
  
  ctx.save();
  ctx.strokeStyle = t.acc + "cc";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 5]);
  
  if(draw.type === "midpoint" && sp.length === 1 && mp){
    const mid = { x: (sp[0].x + mp.x) / 2, y: (sp[0].y + mp.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(sp[0].x, sp[0].y);
    ctx.lineTo(mp.x, mp.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(mid.x, mid.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#fbbf24";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  else if(draw.type === "perppoint" && sp.length === 2 && mp){
    const p1 = sp[0], p2 = sp[1];
    ctx.strokeStyle = "#f472b6" + "cc";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    
    const lx1 = p2.x - p1.x, ly1 = p2.y - p1.y;
    const lx2 = -ly1, ly2 = lx1;
    
    ctx.setLineDash([]);
    ctx.strokeStyle = "#f472b6";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mp.x - lx2 * 2, mp.y - ly2 * 2);
    ctx.lineTo(mp.x + lx2 * 2, mp.y + ly2 * 2);
    ctx.stroke();
  }
  else if(draw.type === "arrow" && sp.length === 1 && mp){
    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(sp[0].x, sp[0].y);
    ctx.lineTo(mp.x, mp.y);
    ctx.stroke();
    
    const angle = Math.atan2(mp.y - sp[0].y, mp.x - sp[0].x);
    const arrowSize = 12;
    ctx.beginPath();
    ctx.moveTo(mp.x, mp.y);
    ctx.lineTo(mp.x - arrowSize * Math.cos(angle - Math.PI/6), mp.y - arrowSize * Math.sin(angle - Math.PI/6));
    ctx.lineTo(mp.x - arrowSize * Math.cos(angle + Math.PI/6), mp.y - arrowSize * Math.sin(angle + Math.PI/6));
    ctx.closePath();
    ctx.fillStyle = "#34d399";
    ctx.fill();
  }
  else if(sp.length === 1 && mp){
    ctx.beginPath();
    ctx.moveTo(sp[0].x, sp[0].y);
    ctx.lineTo(mp.x, mp.y);
    ctx.stroke();
  }
  else if(sp.length >= 2){
    ctx.beginPath();
    if((draw.type === "curve" || draw.type === "polygon") && draw.curveStyle === "bspline" && sp.length >= 3){
      catmullRom(ctx, sp, false);
    }
    else{
      ctx.moveTo(sp[0].x, sp[0].y);
      sp.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    }
    if(mp) ctx.lineTo(mp.x, mp.y);
    if(draw.type === "polygon" && mp) ctx.lineTo(sp[0].x, sp[0].y);
    ctx.stroke();
  }
  
  if(draw.type !== "arrowpoint"){
    sp.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = t.acc;
      ctx.fill();
    });
  }
  
  ctx.setLineDash([]);
  ctx.restore();
}

export function drawScaleBar(ctx, zoom, cal, cw, ch){
  if(!cal?.done) return;
  
  const pxPerMm = cal.pxPerMm * zoom;
  const nice = [1, 2, 5, 10, 20, 50, 100, 200, 500];
  const mm = nice.find(v => v * pxPerMm >= 70) || 100;
  const bw = mm * pxPerMm;
  const x0 = cw - bw - 16;
  const y0 = ch - 28;
  
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(x0 - 8, y0 - 20, bw + 36, 28);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0 + bw, y0);
  ctx.moveTo(x0, y0 - 7);
  ctx.lineTo(x0, y0 + 4);
  ctx.moveTo(x0 + bw, y0 - 7);
  ctx.lineTo(x0 + bw, y0 + 4);
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = `bold 10px "DM Mono",monospace`;
  ctx.textAlign = "center";
  ctx.fillText(`${mm} mm`, x0 + bw/2, y0 - 8);
  ctx.textAlign = "left";
  ctx.restore();
}

export function drawLUTLegend(ctx, lutMode, lutInvert, cw, ch, t, LUT_PRESETS){
  const preset = LUT_PRESETS.find(l => l.id === lutMode);
  if(!preset || lutMode === "gray") return;
  
  const bx = cw - 58, by = 20, bh = Math.min(ch * 0.4, 180), bw = 18;
  const stops = lutInvert ? [...preset.stops].reverse() : preset.stops;
  
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(bx - 10, by - 8, bw + 56, bh + 36);
  
  const grad = ctx.createLinearGradient(0, by, 0, by + bh);
  stops.forEach((s, i) => grad.addColorStop(i / (stops.length - 1), s));
  ctx.fillStyle = grad;
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);
  
  ctx.fillStyle = "#fff";
  ctx.font = `9px "DM Mono",monospace`;
  ctx.textAlign = "left";
  for(let i = 0; i <= 4; i++){
    const y = by + bh * i / 4;
    ctx.fillText(Math.round(255 * (1 - i/4)), bx + bw + 4, y + 3);
  }
  ctx.fillStyle = t.acc;
  ctx.font = `bold 9px "DM Mono",monospace`;
  ctx.textAlign = "center";
  ctx.fillText(`${preset.name}${lutInvert ? " ⇅" : ""}`, bx + bw/2, by + bh + 16);
  ctx.textAlign = "left";
  ctx.restore();
}

export function drawSnapIndicator(ctx, sn, zoom, pan){
  const sx = sn.x * zoom + pan.x;
  const sy = sn.y * zoom + pan.y;
  
  ctx.save();
  ctx.strokeStyle = "#ffd700";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(sx, sy, 12, 0, Math.PI * 2);
  ctx.stroke();
  
  ctx.strokeStyle = "#ffd700" + "66";
  ctx.beginPath();
  ctx.moveTo(sx - 18, sy);
  ctx.lineTo(sx + 18, sy);
  ctx.moveTo(sx, sy - 18);
  ctx.lineTo(sx, sy + 18);
  ctx.stroke();
  ctx.restore();
}

export function drawDisplacementVectors(ctx, m1arr, m2arr, zoom, pan){
  ctx.save();
  
  m1arr.filter(m => m.type === "point").forEach(m1 => {
    const m2 = m2arr.find(m => m.type === "point" && m.label === m1.label);
    if(!m2) return;
    
    const vp1 = vpts(m1), vp2 = vpts(m2);
    if(!vp1.length || !vp2.length) return;
    
    const p1 = { x: vp1[0].x * zoom + pan.x, y: vp1[0].y * zoom + pan.y };
    const p2 = { x: vp2[0].x * zoom + pan.x, y: vp2[0].y * zoom + pan.y };
    
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if(len < 1) return;
    
    ctx.strokeStyle = "#ffd700";
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(p1.x, p1.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#38bdf8";
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(p2.x, p2.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#f472b6";
    ctx.fill();
    
    const angle = Math.atan2(dy, dx);
    const hl = Math.min(len * 0.3, 14);
    ctx.beginPath();
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(p2.x - hl * Math.cos(angle - 0.4), p2.y - hl * Math.sin(angle - 0.4));
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(p2.x - hl * Math.cos(angle + 0.4), p2.y - hl * Math.sin(angle + 0.4));
    ctx.stroke();
    
    ctx.fillStyle = "#ffd700";
    ctx.font = `${clamp(9 * Math.sqrt(zoom), 7, 12)}px "DM Mono",monospace`;
    ctx.fillText(len.toFixed(1) + "px", (p1.x + p2.x) / 2 + 4, (p1.y + p2.y) / 2 - 4);
  });
  
  ctx.restore();
}

export function hitTest(markups, ip, zoom, reproCollecting){
  const thr = 8 / zoom;
  
  for(let i = markups.length - 1; i >= 0; i--){
    const m = markups[i];
    if(m.visible === false) continue;
    if(m.type === "point" && m.repro && !isReproPointVisible(m, reproCollecting)) continue;
    if(m.type === "point"){
      const vp = vpts(m);
      if(vp.length && dist(vp[0], ip) < thr + (m.size || 6) / zoom) return m.id;
    }
  }
  
  for(let i = markups.length - 1; i >= 0; i--){
    const m = markups[i];
    if(m.visible === false) continue;
    if(m.type === "point") continue;
    if(m.type === "point" && m.repro && !isReproPointVisible(m, reproCollecting)) continue;
    
    const vp = vpts(m);
    if((m.type === "line" || m.type === "parallel" || m.type === "ruler") && vp.length >= 2 && perpDist(ip, vp[0], vp[1]) < thr) return m.id;
    if((m.type === "angle3" || m.type === "angle4") && vp.some(p => dist(p, ip) < thr * 2)) return m.id;
    if((m.type === "polygon" || m.type === "curve") && vp.length >= 2){
      for(let j = 1; j < vp.length; j++){
        if(perpDist(ip, vp[j-1], vp[j]) < thr && dist(ip, vp[j-1]) < dist(vp[j-1], vp[j]) + thr) return m.id;
      }
    }
    if(m.type === "perp" && vp.length >= 2 && perpDist(ip, vp[0], vp[1]) < thr) return m.id;
    if(m.type === "perp" && vp.length >= 3 && dist(vp[2], ip) < thr * 2) return m.id;
    if(m.type === "text" && vp.length && dist(vp[0], ip) < thr * 4) return m.id;
  }
  
  return null;
}