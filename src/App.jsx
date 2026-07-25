import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from "react";
import { THEMES, TOOLS, PREDEFINED, LUT_PRESETS } from "./data/constants.js";
import { SILHOUETTES } from "./data/silhouettes.js";
import { uid, clamp, dist, vpts, computeMeasurements, snapPoint, alignTwoPoints, buildScope, evalFormula, getMissingVars, autoControlPoints, findTangentOnCurve, snapTangentToCurve } from "./lib/utils.js";
import { generateInterpretation } from "./lib/interpretation.js";
import { generateReport } from "./report/reportGenerator.js";
import { processImageToCanvas, computeHistogram, FloatingHistogram } from "./canvas/imageUtils.jsx";
import { KatexSpan, LatexFloatingPanel } from "./hooks/useKatex.jsx";
import { Btn, Tag, Sld, PropRow, Inp } from "./ui/ui.jsx";
import ToolBtn from "./ui/ToolBtn.jsx";
import { drawMarkup, drawInProgress, drawScaleBar, drawLUTLegend, drawSnapIndicator, drawDisplacementVectors, drawAirwayOverlay, hitTest, getSilhouetteHandlesImage } from "./canvas/drawMarkups.js";
import { MarkupsPanel } from "./panels/MarkupsPanel.jsx";
import { MeasurementsPanel } from "./panels/MeasurementsPanel.jsx";
import { FormulasPanel } from "./panels/FormulasPanel.jsx";
import { ImagePanel } from "./panels/ImagePanel.jsx";
import { LayersPanel } from "./panels/LayersPanel.jsx";
import { TemplatesPanel } from "./panels/TemplatesPanel.jsx";
import { SilhouettesPanel } from "./panels/SilhouettesPanel.jsx";
import { MarkupProps } from "./panels/MarkupProps.jsx";
import { ExamplesPanel } from "./panels/ExamplesPanel.jsx";
import { loadNormLibrary, saveNormLibrary } from "./data/normLibrary.js";
import { createRedraw } from "./canvas/redraw.js";
import { useWorkspaceUIState } from "./hooks/useWorkspaceUIState.js";
import { autoCreateMeasurements } from "./workspace/template.js";
import { pushUndoSnapshot, undoAction, redoAction } from "./workspace/undo.js";
import { refreshAutoMeasurements, markupDefaults } from "./workspace/markupHelpers.js";
import { finalizeCalibRuler, finalizeCalibManual, exportCSV as exportCSVData } from "./workspace/calibration.js";
import { loadImageFile, handleImageDrop } from "./workspace/images.js";
import { Modal } from "./panels/Modal.jsx";
import PanelGuideModal from "./panels/PanelGuideModal.jsx";
import HomePage from "./panels/HomePage.jsx";
import Toolbar from "./panels/Toolbar.jsx";
import TopBar from "./panels/TopBar.jsx";
import ErrorBoundary from "./ui/ErrorBoundary.jsx";
import SessionsPanel from "./panels/SessionsPanel.jsx";
import AirwayPanel from "./panels/AirwayPanel.jsx";
import { PanelContent } from "./panels/PanelContent.jsx";
import { PANEL_ICONS, PANEL_TABS } from "./panels/panelIcons.jsx";
import { RightPanelSidebar } from "./panels/RightPanelSidebar.jsx";
import SessionFilmstrip from "./panels/SessionFilmstrip.jsx";
import AnonModal from "./panels/AnonModal.jsx";
import ResearchPanel from "./research/ResearchPanel.jsx";
import InterpretationPanel from "./panels/InterpretationPanel.jsx";
import NormogramPanel from "./panels/NormogramPanel.jsx";
import { mkProject, updateSessionInProject } from "./model/project.js";
import { storeImageBlob, getImageDataUrl, clearImageBlobs, deleteOrphanBlobs, idbAvailable } from "./storage/imageStore.js";
import { importCephxPayload, validateCepht, CEPHX_FORMAT, CEPHX_VERSION, normalizeSessionImages } from "./storage/cephxFormat.js";
import { encryptJSON, decryptJSON, clearSecureStorage, secureStorageAvailable } from "./storage/secureStorage.js";
import { anonymizeProject, hasUnanonymizedPHI } from "./report/anonymize.js";
import { logError, logWarn } from "./lib/logger.js";

import { INITIAL_UI, Actions, useWorkspaceStore } from "./state/workspaceStore.js";

function profileProject(project) {
  const rows = [];
  const sessions = project.sessions || [];
  
  // Image totals
  let totalImgBytes = 0;
  sessions.forEach(s => {
    const imgs = s.images || [];
    imgs.forEach(imgEntry => {
      const du = imgEntry.dataUrl || "";
      if (du.length > 0) {
        totalImgBytes += du.length;
        rows.push({ name: `${s.name || s.id} / ${imgEntry.name || imgEntry.id}`, what: "image.dataUrl", mb: (du.length / 1024 / 1024).toFixed(1) });
      }
    });
    const mu = s.markups ? JSON.stringify(s.markups).length : 0;
    if (mu > 1000) rows.push({ name: s.name || s.id, what: "markups", mb: (mu / 1024 / 1024).toFixed(1) });
    const nu = s.norms ? JSON.stringify(s.norms).length : 0;
    if (nu > 1000) rows.push({ name: s.name || s.id, what: "norms", mb: (nu / 1024 / 1024).toFixed(1) });
    const fu = s.formulas ? JSON.stringify(s.formulas).length : 0;
    if (fu > 1000) rows.push({ name: s.name || s.id, what: "formulas", mb: (fu / 1024 / 1024).toFixed(1) });
    const mu2 = s.meta ? JSON.stringify(s.meta).length : 0;
    if (mu2 > 1000) rows.push({ name: s.name || s.id, what: "meta", mb: (mu2 / 1024 / 1024).toFixed(1) });
  });
  
  // Research studies
  const rs = project.researchStudies || [];
  rs.forEach((r, i) => {
    const ru = JSON.stringify(r).length;
    if (ru > 10000) rows.push({ name: r.name || "study[" + i + "]", what: "researchStudy", mb: (ru / 1024 / 1024).toFixed(1) });
  });
  
  // Everything else
  const subs = project.subjects || [];
  const rest = { subjects: subs, meta: project.meta || {} };
  const restBytes = JSON.stringify(rest).length;
  
  const imgMB = (totalImgBytes / 1024 / 1024).toFixed(1);
  const rsMB = rows.filter(r => r.what === "researchStudy").reduce((s, r) => s + parseFloat(r.mb), 0).toFixed(1);
  const otherMB = (restBytes / 1024 / 1024).toFixed(1);
  
  rows.sort((a, b) => parseFloat(b.mb) - parseFloat(a.mb));
  const grandTotal = totalImgBytes + rs.reduce((s, r) => s + JSON.stringify(r).length, 0) + restBytes;
  return { rows, imgMB, rsMB, otherMB, grandTotalMB: (grandTotal / 1024 / 1024).toFixed(1) };
}

// Strip session image data from any objects nested in research study results
function sanitizeResults(obj, depth = 0) {
  if (depth > 20 || !obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(v => sanitizeResults(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object") {
      // If it looks like a session object (has image.dataUrl), strip the image data
      if (v.image?.dataUrl) {
        out[k] = { ...v, image: { ...v.image, dataUrl: "[stripped]" } };
      } else if (v.session && typeof v.session === "object" && v.session.image?.dataUrl) {
        out[k] = { ...v, session: { ...v.session, image: { ...v.session.image, dataUrl: "[stripped]" } } };
      } else if (k === "sessions" && Array.isArray(v)) {
        // Array of session objects — strip image data
        out[k] = v.map(s => s?.image?.dataUrl ? { ...s, image: { ...s.image, dataUrl: "[stripped]" } } : s);
      } else {
        out[k] = sanitizeResults(v, depth + 1);
      }
    } else {
      out[k] = v;
    }
  }
  return out;
}

function exportCephx(project) {
  profileProject(project);
  
  let cleaned = { ...project };
  if (cleaned.images) cleaned.images = undefined;
  
  // Normalize session images via the shared import/export helper so the two
  // paths can't drift (D4). Coerces legacy session.image → session.images[].
  if (cleaned.sessions) {
    cleaned.sessions = cleaned.sessions.map(s => normalizeSessionImages(s));
  }
  
  // Sanitize research study results (strip any session objects with image data)
  if (cleaned.researchStudies) {
    cleaned = {
      ...cleaned,
      researchStudies: cleaned.researchStudies.map(rs => ({
        ...rs,
        results: rs.results ? sanitizeResults(rs.results) : rs.results,
      })),
    };
  }
  
  const payload = { format: CEPHX_FORMAT, version: CEPHX_VERSION, exported: Date.now(), project: cleaned };
  const json = JSON.stringify(payload);
  
  const blob = new Blob([json], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(project.name || "project").replace(/\s+/g, "_")}.cephx`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),60000);
}
function importCephx(file,onLoad){
  const reader=new FileReader();
  reader.onload=e=>{
    let parsed;
    try{ parsed=JSON.parse(e.target.result); }
    catch(err){ logError("Cephx import error:",err); alert("Cannot parse file — it is not valid JSON."); return; }
    const res=importCephxPayload(parsed);
    if(!res.ok){ alert(res.error); return; }
    onLoad(res.project);
    if(res.warnings&&res.warnings.length){
      setTimeout(()=>alert("Imported with notes:\n• "+res.warnings.join("\n• ")),60);
    }
  };
  reader.onerror=()=>{ logError("Cephx file read failed:",reader.error); alert("Could not read the file."); };
  reader.readAsText(file);
}
function exportCepht(template,version="1.0"){
  const payload={format:"cepht",version,exported:Date.now(),...template};
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));
  a.download=`${template.name.replace(/\s+/g,"_")}.cepht`;a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),60000);
}
function exportTemplateAsCepht(project,name,includeCoord){
  const session=project.sessions?.find(s=>s.id===project.activeSessionId)||project.sessions?.[0];
  const allMarkups=session?.markups||[];
  const markupsToExport=allMarkups.map(m=>{
    if(includeCoord)return{...m,placed:m.placed!==false};
    const{points:_pts,placed:_p,...rest}=m;
    return rest;
  });
  const template={name,projection:project.projection,markups:markupsToExport,formulas:session?.formulas||[],norms:session?.norms||[]};
  exportCepht(template,includeCoord?"2.0":"1.0");
}
function hasPlacedCoords(markups){
  return markups.some(m=>m.points&&m.points.length>0&&!m.points.every(p=>Math.abs((p.x||0)+99999)<1&&Math.abs((p.y||0)+99999)<1));
}

// ═══════════════════════════════════════════════════════════════════════════════





function CalibModal({t,calibration,onFinish,rulerLabel,rulerCount}){
  const[mm,setMm]=useState(String(calibration.knownMm||"10"));const[ppm,setPpm]=useState(String(calibration.pxPerMm||"1"));const[mode,setMode]=useState("ruler");const[guideKey,setGuideKey]=useState(null);
  return(
    <div>
      <div style={{display:"flex",gap:6,marginBottom:16,alignItems:"center"}}>{["ruler","manual"].map(m=><Btn key={m} t={t} small active={mode===m} onClick={()=>setMode(m)}>{m==="ruler"?"From Ruler":"Manual px/mm"}</Btn>)}
        <button onClick={()=>setGuideKey("calibration")}
          style={{background:"none",border:`1px solid ${t.tx3}55`,color:t.tx3,borderRadius:10,width:18,height:18,fontSize:10,lineHeight:"16px",textAlign:"center",cursor:"pointer",padding:0,marginLeft:"auto",flexShrink:0}} title="Guide">?</button>
      </div>
      {mode==="ruler"?<><div style={{fontSize:13,color:t.tx2,marginBottom:16,lineHeight:1.6}}>Draw a ruler on the image (⟺ key), then enter its real-world length.</div>
        {rulerLabel&&<div style={{fontSize:12,color:t.ok,marginBottom:8}}>Using ruler: <strong>{rulerLabel}</strong></div>}
        {!rulerLabel&&rulerCount>1&&<div style={{fontSize:12,color:t.warn,marginBottom:8}}>⚠ Multiple rulers found — using the first one. Draw a ruler for a specific selection.</div>}
        <PropRow label="Distance (mm)" t={t}><input type="number" value={mm} onChange={e=>setMm(e.target.value)} min="1" style={{background:t.surf2,border:`1px solid ${t.bdr}`,borderRadius:6,padding:"6px 10px",color:t.tx,fontSize:14,width:"90%",fontFamily:"'DM Mono',monospace"}}/></PropRow><div style={{fontSize:9,color:t.tx3,marginTop:8}}>2D cephalometric radiographs carry ~8–15% magnification. Ensure the ruler distance reflects the actual image scale (not CBCT).</div><Btn t={t} onClick={()=>onFinish(parseFloat(mm))} style={{width:"100%",marginTop:12}}>Set Calibration</Btn></>
      :<><div style={{fontSize:13,color:t.tx2,marginBottom:16}}>Enter px/mm directly (from DICOM metadata).</div>{calibration.done&&<div style={{fontSize:12,color:t.ok,marginBottom:10}}>Current: {calibration.pxPerMm.toFixed(4)} px/mm</div>}<PropRow label="px / mm" t={t}><input type="number" value={ppm} onChange={e=>setPpm(e.target.value)} step="0.001" min="0.001" style={{background:t.surf2,border:`1px solid ${t.bdr}`,borderRadius:6,padding:"6px 10px",color:t.tx,fontSize:14,width:"90%",fontFamily:"'DM Mono',monospace"}}/></PropRow><div style={{fontSize:9,color:t.tx3,marginTop:8}}>2D cephalograms have ~8–15% inherent magnification. CBCT-derived px/mm is more accurate for linear measurements.</div><Btn t={t} onClick={()=>onFinish(parseFloat(mm),parseFloat(ppm))} style={{width:"100%",marginTop:12}}>Apply</Btn></>}
      {guideKey&&<PanelGuideModal t={t} guideKey={guideKey} onClose={()=>setGuideKey(null)}/>}
    </div>
  );
}

function TextModal({t,onConfirm,onCancel,defaultColor}){
  const[txt,setTxt]=useState("Label");const[fontSize,setFontSize]=useState(14);const[bold,setBold]=useState(false);const[color,setColor]=useState(defaultColor||"#38bdf8");
  return(
    <div>
      <PropRow label="Text" t={t}><Inp value={txt} onChange={setTxt} t={t}/></PropRow>
      <PropRow label="Size" t={t}><div style={{display:"flex",gap:8,alignItems:"center"}}><input type="range" min={8} max={48} value={fontSize} onChange={e=>setFontSize(+e.target.value)} style={{flex:1,accentColor:t.acc}}/><span style={{fontSize:11,color:t.tx2,fontFamily:"'DM Mono',monospace",width:30}}>{fontSize}px</span></div></PropRow>
      <PropRow label="Bold" t={t}><input type="checkbox" checked={bold} onChange={e=>setBold(e.target.checked)} style={{accentColor:t.acc}}/></PropRow>
      <PropRow label="Color" t={t}><input type="color" value={color} onChange={e=>setColor(e.target.value)} style={{width:40,height:28,border:"none",cursor:"pointer",borderRadius:4}}/></PropRow>
      <div style={{marginTop:16,display:"flex",gap:8}}><Btn t={t} onClick={()=>onConfirm(txt,{fontSize,bold,color})} style={{flex:1}}>Add</Btn><Btn t={t} onClick={onCancel} style={{flex:1}}>Cancel</Btn></div>
    </div>
  );
}

function FormulaEditor({t,formula,scope,onSave,onClose}){
  const[name,setName]=useState(formula?.name||"");const[latex,setLatex]=useState(formula?.latex||"");
  const[expr,setExpr]=useState(formula?.expression||"");const[unit,setUnit]=useState(formula?.unit||"");const[unitCustom,setUnitCustom]=useState("");
  const[desc,setDesc]=useState(formula?.description||"");
  const[bigLatex,setBigLatex]=useState(null);const[showFx,setShowFx]=useState(false);const inputRef=useRef(null);
  const preview=useMemo(()=>evalFormula(expr,scope),[expr,scope]);
  const missing=useMemo(()=>getMissingVars(expr,scope),[expr,scope]);

  const groups=useMemo(()=>{
    const cats={Angles:[],Lengths:[],Points:[],Polygons:[],Other:[]};
    Object.keys(scope).forEach(k=>{
      if(k.endsWith("_angle"))cats.Angles.push(k);
      else if(k.endsWith("_length"))cats.Lengths.push(k);
      else if(k.endsWith("_x")||k.endsWith("_y"))cats.Points.push(k);
      else if(k.endsWith("_area")||k.endsWith("_perimeter"))cats.Polygons.push(k);
      else cats.Other.push(k);
    });
    return Object.entries(cats).filter(([,vs])=>vs.length>0);
  },[scope]);

  const insertVar=varName=>{
    const el=inputRef.current;if(!el){setExpr(prev=>prev+varName);return;}
    const start=el.selectionStart??expr.length;const end=el.selectionEnd??expr.length;
    setExpr(prev=>prev.slice(0,start)+varName+prev.slice(end));
    setTimeout(()=>{el.focus();const p=start+varName.length;el.setSelectionRange(p,p);},0);
  };
  const handleSelect=(cat,e)=>{
    const v=e.target.value;
    if(v&&v!=="__placeholder")insertVar(v);
    e.target.value="__placeholder";
  };

  const UNIT_OPTIONS=[
    {value:"",label:"None"},
    {value:"°",label:"Degrees (°)"},
    {value:"mm",label:"Millimeters (mm)"},
    {value:"mm²",label:"Square mm (mm²)"},
    {value:"mm³",label:"Cubic mm (mm³)"},
    {value:"%",label:"Percent (%)"},
    {value:"ratio",label:"Ratio"},
    {value:"°_mm",label:"°/mm"},
    {value:"__custom__",label:"Custom…"},
  ];
  const isCustomUnit=unit==="__custom__"||(!!unit&&!UNIT_OPTIONS.some(o=>o.value===unit));
  const displayUnit=isCustomUnit?(unitCustom||unit):unit;

  const selectStyle={
    background:t.surf3,border:`1px solid ${t.bdr}`,borderRadius:4,
    padding:"4px 6px",color:t.tx,fontSize:11,fontFamily:"'DM Mono',monospace",
    width:"100%",cursor:"pointer",outline:"none",
  };

  return(
    <div>
      <PropRow label="Name" t={t}><Inp value={name} onChange={setName} t={t} placeholder="e.g. ANB Angle"/></PropRow>
      <div style={{marginBottom:8}}>
        <div style={{fontSize:11,color:t.tx2,marginBottom:3}}>LaTeX display</div>
        <Inp value={latex} onChange={setLatex} t={t} placeholder="\angle ANB = \angle SNA - \angle SNB"/>
        {latex&&<div onClick={()=>setBigLatex(latex)} style={{background:t.surf2,border:`1px solid ${t.bdr}`,borderRadius:6,padding:"8px 12px",marginTop:6,cursor:"pointer",minHeight:36,display:"flex",alignItems:"center",gap:8}}>
          <KatexSpan latex={latex}/>
          <span style={{fontSize:9,color:t.tx3,marginLeft:"auto"}}>click to enlarge ↗</span>
        </div>}
      </div>
      <div style={{marginBottom:8}}>
        <div style={{fontSize:11,color:t.tx2,marginBottom:3,display:"flex",alignItems:"center",gap:6}}>Expression (mathjs)
          <span onClick={()=>setShowFx(!showFx)} style={{fontSize:9,fontWeight:700,color:t.acc,cursor:"pointer",background:t.accMuted,borderRadius:3,padding:"1px 6px",fontFamily:"'DM Mono',monospace"}}>fx</span>
        </div>
        {showFx&&<div style={{background:t.surf2,border:`1px solid ${t.bdr}`,borderRadius:6,padding:"8px 10px",marginBottom:6,fontSize:10,lineHeight:1.7,color:t.tx2}}>
          <b style={{color:t.tx}}>Operators:</b> + - * / ^ %<br/>
          <b style={{color:t.tx}}>Functions:</b> sin(), cos(), tan(), asin(), acos(), atan(), atan2(y,x)<br/>
          <span style={{marginLeft:50}}/>abs(), sqrt(), exp(), log(), log2(), log10()<br/>
          <span style={{marginLeft:50}}/>ceil(), floor(), round(), min(a,b), max(a,b), pow(x,y)<br/>
          <b style={{color:t.tx}}>Constants:</b> pi, e
        </div>}
        <Inp ref={inputRef} value={expr} onChange={setExpr} t={t} placeholder="SNA_angle - SNB_angle"/>
        {groups.length>0&&<div style={{marginTop:8,display:"flex",flexDirection:"column",gap:6}}>
          <div style={{fontSize:10,color:t.tx3}}>Insert a variable:</div>
          {groups.map(([cat,vars])=>(
            <div key={cat} style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{fontSize:9,color:t.tx2,fontWeight:700,textTransform:"uppercase",letterSpacing:0.5,width:60,flexShrink:0,textAlign:"right"}}>{cat}</div>
              <select style={selectStyle} onChange={e=>handleSelect(cat,e)} defaultValue="__placeholder">
                <option value="__placeholder" disabled>Select {cat.toLowerCase()}…</option>
                {vars.map(v=><option key={v} value={v}>{v} {scope[v]!==undefined?`(${typeof scope[v]==="number"?scope[v].toFixed(2):scope[v]})`:""}</option>)}
              </select>
            </div>
          ))}
        </div>}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",padding:"6px 8px",background:preview!==null?t.ok+"11":expr?t.err+"11":t.surf2,borderRadius:6,marginBottom:8}}>
        <span style={{fontSize:12,color:t.tx2}}>Preview</span>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:700,color:preview!==null?t.ok:expr?t.err:t.tx3}}>
          {preview!==null?`${preview.toFixed(2)} ${displayUnit}`:expr?(missing.length>0?`Unknown: ${missing.join(", ")}`:"Error"):"—"}
        </span>
      </div>
      <PropRow label="Unit" t={t}>
        <div style={{display:"flex",flexDirection:"column",gap:4,width:"100%"}}>
          <select style={selectStyle} value={isCustomUnit?"__custom__":unit} onChange={e=>{if(e.target.value==="__custom__"){setUnit("__custom__");setUnitCustom("")}else{setUnit(e.target.value);setUnitCustom("")}}}>
            {UNIT_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {isCustomUnit&&<Inp value={unitCustom||(unit!=="__custom__"?unit:"")} onChange={v=>setUnitCustom(v)} t={t} placeholder="e.g. pixels" style={{width:"100%",boxSizing:"border-box"}}/>}
        </div>
      </PropRow>
      <PropRow label="Notes" t={t}><Inp value={desc} onChange={setDesc} t={t} placeholder="Reference"/></PropRow>
      <div style={{display:"flex",gap:8,marginTop:14}}><Btn t={t} onClick={()=>onSave({id:formula?.id||uid(),name,latex,expression:expr,unit:displayUnit,description:desc})} style={{flex:1}} disabled={!name||!expr}>Save</Btn><Btn t={t} onClick={onClose} style={{flex:1}}>Cancel</Btn></div>
      {bigLatex&&<LatexFloatingPanel latex={bigLatex} onClose={()=>setBigLatex(null)}/>}
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE
// ═══════════════════════════════════════════════════════════════════════════════
function Workspace({project,onUpdateProject,onHome,t,theme,setTheme,onSave,onImport}){
  // ══════════════════════════════════════
  // CANVAS + REFS
  const canvasRef=useRef(null);const containerRef=useRef(null);
  const procCache=useRef(new Map());const imgRefs=useRef({});const rafRef=useRef(null);
  // F1: pointer state lives in refs (not reducer state) so mousemove skips React re-render
  const mousePosRef=useRef(null);const snapPosRef=useRef(null);
  const flashMarkupIdRef=useRef(null);const flashStartTimeRef=useRef(0);
  const boxSelectRectRef=useRef(null);const panRef=useRef({x:40,y:40});
  // F2: device-pixel-ratio for crisp HiDPI rendering
  const dprRef=useRef(window.devicePixelRatio||1);
  // F4: offscreen canvas for static content (image+markups) — blitted on mousemove
  const staticDirtyRef=useRef(true);
  // F8: rAF handle for ResizeObserver coalescing
  const resizeRafRef=useRef(null);

  // file input refs
  const openImgRef=useRef(null);const stackImgRef=useRef(null);const importRef=useRef(null);

  const{ui,dispatch,setSelectedId,setActiveTool,setRightPanel,
    setPlacingQueue,setShowMobilePanel,
    setShowLUT,setShowScaleBar,setShowHistogram,setShowDisplacement,setDisplacementOverlay,setRefLandmark1,setRefLandmark2,setOverlayBlend,setOverlayAlignMode,setOverlayVectorScale,setShowTrackingLines}=useWorkspaceStore();
  const{zoom,selectedId,selectedIds,replacingId,currentDraw,
    activeTool,snapEnabled,showScaleBar,showDefTooltips,
    showLUT,showHistogram,showAnnotations,annotationSize,showDisplacement,rightPanel,showCalib,pendingRuler,
    showExport,showAnon,showNormogram,
    pendingTextPos,showFormulaEditor,editFormulaId,
    placingMode,placingQueue,placingIdx,loadingImages,
    isMobile,showMobilePanel,mobileToolsExpanded,
    toolbarPos,toolbarDragging,rightPanelWidth,rightPanelResizing,
    spotlightMode,
    displacementOverlay,refLandmark1,refLandmark2,overlayBlend,overlayAlignMode,overlayVectorScale,showTrackingLines,}=ui;
  const {
    compareSession, setCompareSession,
    contextMenu, setContextMenu,
    showGrid, setShowGrid,
    showAirwayOverlay, setShowAirwayOverlay,
    showReportOptions, setShowReportOptions,
    filmstripOpen, setFilmstripOpen,
    guideKey, setGuideKey,
    defaultSections, reportSections, setReportSections,
    pinnedFormulas, setPinnedFormulas,
  } = useWorkspaceUIState();
  const rightPanelWidthRef=useRef(rightPanelWidth);rightPanelWidthRef.current=rightPanelWidth;
  const toolbarPosRef=useRef(toolbarPos);toolbarPosRef.current=toolbarPos;
  // Panel collapse state — useRef + DOM manipulation to avoid canvas re-renders
  const collapsedRef=useRef(false);
  const panelRef=useRef(null);
  const contentRef=useRef(null);
  const toggleBtnRef=useRef(null);
  const skipResizeRef=useRef(false);
  const syncCollapsed=()=>{
    if(!panelRef.current)return;
    if(collapsedRef.current){
      panelRef.current.style.width="52px";
      if(contentRef.current){contentRef.current.style.maxWidth="0px";contentRef.current.style.opacity="0";}
      if(toggleBtnRef.current)toggleBtnRef.current.innerText="◀";
    } else {
      panelRef.current.style.width=rightPanelWidth+"px";
      if(contentRef.current){contentRef.current.style.maxWidth="800px";contentRef.current.style.opacity="1";}
      if(toggleBtnRef.current)toggleBtnRef.current.innerText="▶";
    }
  };
  useLayoutEffect(syncCollapsed);
  const toggleCollapsed=()=>{
    collapsedRef.current=!collapsedRef.current;
    skipResizeRef.current=true;
    syncCollapsed();
    setTimeout(()=>{
      skipResizeRef.current=false;
      const el=containerRef.current;
      if(el){
        const c=canvasRef.current;
        if(c){const dpr=dprRef.current;c.width=el.clientWidth*dpr;c.height=el.clientHeight*dpr;c.style.width=el.clientWidth+"px";c.style.height=el.clientHeight+"px";
          canvasSize.current={w:el.clientWidth,h:el.clientHeight};staticDirtyRef.current=true;scheduleRedraw();}
      }
    },300);
  };

  useEffect(()=>{const fn=()=>dispatch({type:"SET",payload:{isMobile:window.innerWidth<768}});window.addEventListener("resize",fn);return()=>window.removeEventListener("resize",fn);},[dispatch]);

  useEffect(()=>{
    if(!rightPanelResizing)return;
    const onMove=e=>{const nw=Math.max(200,Math.min(500,rightPanelWidthRef.current+e.movementX));rightPanelWidthRef.current=nw;dispatch({type:"SET",payload:{rightPanelWidth:nw}});};
    const onUp=()=>dispatch({type:"SET",payload:{rightPanelResizing:false}});
    window.addEventListener("mousemove",onMove);
    window.addEventListener("mouseup",onUp);
    return()=>{window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};
  },[rightPanelResizing,dispatch]);

  useEffect(()=>{
    if(!toolbarDragging)return;
    const onMove=e=>{const np={x:toolbarPosRef.current.x+e.movementX,y:toolbarPosRef.current.y+e.movementY};toolbarPosRef.current=np;dispatch({type:"SET",payload:{toolbarPos:np}});};
    const onUp=()=>dispatch({type:"SET",payload:{toolbarDragging:false}});
    window.addEventListener("mousemove",onMove);
    window.addEventListener("mouseup",onUp);
    return()=>{window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};
  },[toolbarDragging,dispatch]);

  // ─── These must be declared before any useEffect that references them ──────
  // ══════════════════════════════════════
  // SESSION STATE
  const activeSession=project.sessions?.find(s=>s.id===project.activeSessionId)||project.sessions?.[0];
  const markups=useMemo(()=>activeSession?.markups||[],[activeSession?.markups]);

  // Migration: legacy session.image -> session.images[]
  const legacyMigrationDoneRef=useRef(false);
  useEffect(()=>{
    if(legacyMigrationDoneRef.current)return;
    if(!activeSession)return;
    if(activeSession.images?.length)return;
    const oldImg = activeSession.image || project.images?.[0] || project.sessions?.find(s=>s.image)?.image;
    if(oldImg){
      const entry = oldImg.id ? oldImg : {id:uid(),name:"Imported",dataUrl:oldImg.dataUrl||oldImg,dx:0,dy:0,opacity:1,blendMode:"normal",visible:true,color:"none",transform:{tx:0,ty:0,rot:0,scale:1}};
      onUpdateProject(updateSessionInProject(project,activeSession.id,{images:[entry],image:undefined}));
    }
    legacyMigrationDoneRef.current=true;
  },[activeSession, project, onUpdateProject, activeSession?.id]);

  // ══════════════════════════════════════
  // DRAG + EVENT REFS
  const isPanning=useRef(false);const panStart=useRef(null);
  const isDragging=useRef(false);const dragStart=useRef(null);const dragStartState=useRef(null);
  const dragMid=useRef(null);const dragPtIdx=useRef(null);
  const multiDragIdsRef=useRef(null);
  const copiedMarkupRef=useRef(null);
  const silhouetteAction=useRef(null);const hoveredPtRef=useRef(null);
  const mouseCanvasRef=useRef({x:0,y:0});
  const canvasSize=useRef({w:800,h:600});const lastTouchDist=useRef(null);const lastTapRef=useRef(0);
  const undoStackRef=useRef([]);
  const redoStackRef=useRef([]);
  const snapshotRef=useRef();
  const [undoVersion,setUndoVersion]=useState(0);

  const sessionImage=useMemo(()=>activeSession?.images||[],[activeSession?.images]);

  // Auto-start placing mode when project has unplaced markups (from wizard)
  const placingInitRef=useRef(true);
  useEffect(()=>{
    if(!placingInitRef.current)return;
    placingInitRef.current=false;
    const unplaced=markups.filter(m=>!m.placed&&m.type==="point");
    if(unplaced.length>0){
      setPlacingQueue(unplaced.map(m=>m.id));
      dispatch({type:"SET",payload:{placingIdx:0}});
      dispatch({type:"SET",payload:{placingMode:true}});
      dispatch({type:"SET",payload:{rightPanel:"markups"}});
    }
  },[dispatch,markups,setPlacingQueue]);

  const calibration=useMemo(()=>activeSession?.calibration||{done:false,pxPerMm:1},[activeSession?.calibration]);
  const processing=useMemo(()=>activeSession?.processing||{brightness:0,contrast:0,windowWidth:0,windowCenter:128,edgeEnhance:0},[activeSession?.processing]);
  const lutMode=activeSession?.lutMode||"gray";const lutInvert=activeSession?.lutInvert||false;
  const formulas=useMemo(()=>activeSession?.formulas||[],[activeSession?.formulas]);const norms=useMemo(()=>activeSession?.norms||[],[activeSession?.norms]);
  const analysisTemplate=activeSession?.analysisTemplate||"blank";
  const patientSex=activeSession?.meta?.sex||null;
  const patientAge=activeSession?.meta?.age!==undefined&&activeSession?.meta?.age!==null?Number(activeSession.meta.age):null;
  const selectedMarkup=markups.find(m=>m.id===selectedId);

  const [userPresets,setUserPresets]=useState(()=>loadNormLibrary());
  const handleSavePreset=useCallback((preset,mode)=>{setUserPresets(prev=>{const next=mode==="update"?prev.map(p=>p.id===preset.id?preset:p):[...prev,preset];saveNormLibrary(next);return next;});},[]);
  const handleDeletePreset=useCallback(id=>{setUserPresets(prev=>{const next=prev.filter(p=>p.id!==id);saveNormLibrary(next);return next;});},[]);

  const updSessionRef=useRef();
  updSessionRef.current=patch=>onUpdateProject(updateSessionInProject(project,activeSession.id,patch));
  const updSession=useCallback(patch=>updSessionRef.current(patch),[]);
  const angleMode=activeSession?.angleMode||"signed-deg";
  const setAngleMode=m=>updSession({angleMode:m});
  const formatAngle=(v)=>{
    const[sign,unit]=angleMode.split("-");
    let val=v;
    if(sign==="abs")val=Math.abs(v);
    else if(sign==="simple")val=Math.abs(v);
    else if(sign==="reflex")val=Math.abs(v)>180?Math.abs(v):360-Math.abs(v);
    if(unit==="rad")return(val*Math.PI/180).toFixed(4)+" rad";
    return val.toFixed(1)+"°";
  };
  const undoRef=useRef();
  const redoRef=useRef();
  const updMarkupRef=useRef();
  const delMarkupRef=useRef();
  snapshotRef.current=()=>JSON.stringify({markups,norms,placingMode,placingIdx,placingQueue,calibration,formulas,processing});
  // ══════════════════════════════════════
  // UNDO / REDO
  const setPlacing=(mode,queue,idx)=>dispatch({type:"SET",payload:{placingMode:mode,placingQueue:queue,placingIdx:idx}});
  const restoreSnapshot=(prev)=>{
    const parsed=JSON.parse(prev);
    if(Array.isArray(parsed)){
      updSession({markups:parsed});
    }else{
      updSession({markups:parsed.markups,norms:parsed.norms,calibration:parsed.calibration,formulas:parsed.formulas,processing:parsed.processing});
    }
  };
  const pushUndoRef=useRef();
  pushUndoRef.current=()=>{
    pushUndoSnapshot(snapshotRef,undoStackRef,redoStackRef,setUndoVersion,snapshotRef.current());
  };
  const pushUndo=useCallback(()=>pushUndoRef.current(),[]);
  undoRef.current=()=>{undoAction(snapshotRef,undoStackRef,redoStackRef,setUndoVersion,setPlacing,restoreSnapshot);};
  const undo=useCallback(()=>undoRef.current(),[]);
  redoRef.current=()=>{redoAction(snapshotRef,undoStackRef,redoStackRef,setUndoVersion,restoreSnapshot,setPlacing);};
  const redo=useCallback(()=>redoRef.current(),[]);
  const refreshAutoMeasRef=useRef();
  refreshAutoMeasRef.current=refreshAutoMeasurements;
  const refreshAutoMeas=useCallback(ms=>refreshAutoMeasRef.current(ms),[]);
  const updMarkups=useCallback(fn=>{pushUndo();updSession({markups:refreshAutoMeas(fn(markups))});},[pushUndo,updSession,refreshAutoMeas,markups]);
  updMarkupRef.current=(id,patch)=>{
    updMarkups(ms=>ms.map(m=>m.id===id?{...m,...patch}:m));
  };
  const updMarkup=useCallback((id,patch)=>updMarkupRef.current(id,patch),[]);
  delMarkupRef.current=id=>{
    updMarkups(ms=>ms.filter(mm=>mm.id!==id));
    if(selectedId===id)dispatch({type:"SET",payload:{selectedId:null}});
  };
  const delMarkup=useCallback(id=>delMarkupRef.current(id),[]);
  // ══════════════════════════════════════
  // MARKUP CRUD
  const addMarkupRef=useRef();
  addMarkupRef.current=partial=>{
    const m=markupDefaults(partial,markups,t);
    updMarkups(ms=>[...ms,m]);dispatch({type:"SET",payload:{selectedId:m.id}});return m;
  };
  const addMarkup=useCallback(partial=>addMarkupRef.current(partial),[]);
  const finalizeMarkupRef=useRef();
  finalizeMarkupRef.current=draw=>{
    const D={
      line:{color:t.acc,width:1.5,style:"solid",mode:"segment",label:`Line ${markups.filter(m=>m.type==="line").length+1}`,showLength:true},
      angle3:{color:"#f472b6",width:1.5,label:`Angle ${markups.filter(m=>m.type==="angle3").length+1}`},
      angle4:{color:"#c084fc",width:1.5,label:`Inc_Angle ${markups.filter(m=>m.type==="angle4").length+1}`},
      polygon:{strokeColor:t.acc,fillColor:t.acc+"22",strokeWidth:1.5,label:`Polygon ${markups.filter(m=>m.type==="polygon").length+1}`},
      curve:{color:"#fb923c",width:1.5,label:`Trace ${markups.filter(m=>m.type==="curve").length+1}`},
      perp:{color:"#a78bfa",width:1.5,label:`Perp ${markups.filter(m=>m.type==="perp").length+1}`},
      ellipse:{color:"#60a5fa",width:1.5,label:`Ellipse ${markups.filter(m=>m.type==="ellipse").length+1}`},
      arc:{color:"#fb923c",width:1.5,label:`Arc ${markups.filter(m=>m.type==="arc").length+1}`},
      circle:{color:"#38bdf8",width:1.5,label:`Circle ${markups.filter(m=>m.type==="circle").length+1}`},
      bezier:{color:"#c084fc",width:1.5,cp:autoControlPoints(draw.points||[]),label:`Bezier ${markups.filter(m=>m.type==="bezier").length+1}`},
      tangent:{color:"#f97316",width:1.5,label:`Tangent ${markups.filter(m=>m.type==="tangent").length+1}`},
      concentric:{color:"#60a5fa",width:1.5,count:4,spacing:0.3,label:`Concentric ${markups.filter(m=>m.type==="concentric").length+1}`}
    };
    const newMarkup={...D[draw.type]||{},...draw};
    if(draw.replacingId){
      updMarkup(draw.replacingId,{points:draw.points,placed:true,curveStyle:draw.curveStyle});
      dispatch({type:"SET",payload:{replacingId:null}});
    }else{
      addMarkup(newMarkup);
    }
  };
  const finalizeMarkup=useCallback(draw=>finalizeMarkupRef.current(draw),[]);

  const loadAirwayTier=useCallback((landmarkLabels)=>{
    const airwayAnalysis=(PREDEFINED.lateral||[]).find(a=>a.name&&a.name.toLowerCase().includes("airway"));
    const defMap={};
    if(airwayAnalysis){airwayAnalysis.pts.forEach(pt=>{defMap[pt.l.toLowerCase()]=pt;});}
    const newMarkups=[];
    landmarkLabels.forEach(label=>{
      const alreadyPlaced=markups.some(m=>m.type==="point"&&m.label?.toLowerCase()===label.toLowerCase()&&m.placed&&m.visible!==false);
      if(alreadyPlaced)return;
      const def=defMap[label.toLowerCase()];
      const id=uid();
      newMarkups.push({id,type:"point",points:[{x:-99999,y:-99999}],label,definition:def?.def||"",color:def?.color||t.acc,size:6,visible:true,placed:false});
    });
    if(!newMarkups.length)return;
    pushUndo();
    updSession({markups:[...markups,...newMarkups]});
    setPlacingQueue(newMarkups.map(m=>m.id));
    dispatch({type:"SET",payload:{placingIdx:0}});
    dispatch({type:"SET",payload:{placingMode:true}});
    dispatch({type:"SET",payload:{rightPanel:"airway"}});
  },[markups,t.acc,pushUndo,updSession,setPlacingQueue,dispatch]);

  // load images — from dataUrl (just imported) or from IndexedDB (restored from auto-save)
  useEffect(()=>{
    const pending=sessionImage.filter(imgE=>!imgRefs.current[imgE.id]);
    if(!pending.length)return;
    dispatch({type:"SET",payload:{loadingImages:true}});
    let loaded=0;
    const onLoad=(id,src)=>{const img=new Image();img.onload=()=>{imgRefs.current[id]=img;loaded++;if(loaded===pending.length)dispatch({type:"SET",payload:{loadingImages:false}});scheduleRedraw();};img.onerror=()=>{loaded++;if(loaded===pending.length)dispatch({type:"SET",payload:{loadingImages:false}});};img.src=src;};
    pending.forEach(imgE=>{
      if(imgE.dataUrl){
        onLoad(imgE.id,imgE.dataUrl);
      } else {
        getImageDataUrl(imgE.id).then(dataUrl=>{
          if(dataUrl){
            onLoad(imgE.id,dataUrl);
          } else {
            loaded++;if(loaded===pending.length)dispatch({type:"SET",payload:{loadingImages:false}});
          }
        });
      }
    });
  },[sessionImage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ══════════════════════════════════════
  // CANVAS DRAW PIPELINE
  const getProcessed=useCallback(imgEntry=>{
    const key=`${imgEntry.id}-${JSON.stringify(processing)}-${lutMode}-${lutInvert}`;
    if(!procCache.current.has(key)){for(const k of procCache.current.keys())if(k.startsWith(imgEntry.id+"-")&&k!==key)procCache.current.delete(k);procCache.current.set(key,processImageToCanvas(imgRefs.current[imgEntry.id],processing,lutMode,lutInvert));}
    staticDirtyRef.current=true; // F4: processing changed → rebuild static cache
    return procCache.current.get(key);
  },[processing,lutMode,lutInvert]);

  // F7: clear processed-image cache when switching sessions
  useEffect(()=>{procCache.current.clear();},[activeSession?.id]);

  // F6: memoize histogram computation — avoid re-running on every render while histogram is open
  const histImgRef=sessionImage[0]?imgRefs.current[sessionImage[0].id]:null;
  const histData=useMemo(()=>computeHistogram(histImgRef),[histImgRef]);

  const toImage=useCallback((sx,sy)=>({x:(sx-panRef.current.x)/zoom,y:(sy-panRef.current.y)/zoom}),[zoom]);
  const getCanvasPos=useCallback(e=>{const r=canvasRef.current.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};},[]);

  // U2: zoom-to-landmark — when selecting from MarkupsPanel, pan viewport to center on the markup
  const flashRafRef=useRef(null);const flashTimerRef=useRef(null);
  const selectAndFocusMarkup=useCallback(id=>{
    setSelectedId(id);
    if(!id)return;
    const m=markups.find(x=>x.id===id);if(!m)return;
    const pts=vpts(m);if(!pts.length)return;
    const cx=pts.reduce((s,p)=>s+p.x,0)/pts.length;
    const cy=pts.reduce((s,p)=>s+p.y,0)/pts.length;
    const cw=canvasSize.current.w,ch=canvasSize.current.h;
    const dpr=dprRef.current;
    const newPan={x:(cw/dpr)/2-cx*zoom,y:(ch/dpr)/2-cy*zoom};
    panRef.current=newPan;
    dispatch({type:"SET",payload:{pan:newPan}});
    flashMarkupIdRef.current=id;flashStartTimeRef.current=performance.now();
    if(flashTimerRef.current)clearTimeout(flashTimerRef.current);
    flashTimerRef.current=setTimeout(()=>{flashMarkupIdRef.current=null;flashTimerRef.current=null;},1500);
    if(flashRafRef.current)cancelAnimationFrame(flashRafRef.current);
    const _fl=()=>{if(!flashMarkupIdRef.current)return;flashRafRef.current=requestAnimationFrame(_fl);scheduleRedrawRef.current();};flashRafRef.current=requestAnimationFrame(_fl);
  },[markups,zoom,setSelectedId,dispatch]);

  // F2+F8: ResizeObserver with DPR scaling and rAF coalescing
  useEffect(()=>{
    const obs=new ResizeObserver(()=>{
      if(skipResizeRef.current)return;
      // F8: coalesce multiple resize frames into one rAF
      if(resizeRafRef.current)cancelAnimationFrame(resizeRafRef.current);
      resizeRafRef.current=requestAnimationFrame(()=>{
        resizeRafRef.current=null;
        const el=containerRef.current;if(!el)return;const c=canvasRef.current;if(!c)return;
        const dpr=dprRef.current;
        c.width=el.clientWidth*dpr;c.height=el.clientHeight*dpr;
        c.style.width=el.clientWidth+"px";c.style.height=el.clientHeight+"px";
        canvasSize.current={w:el.clientWidth,h:el.clientHeight};
        staticDirtyRef.current=true; // F4: canvas resized → rebuild static cache
        scheduleRedraw();
      });
    });
    if(containerRef.current)obs.observe(containerRef.current);return()=>obs.disconnect();
  },[]); // eslint-disable-line react-hooks/exhaustive-deps

  const redraw=useCallback(()=>{
    const dc={
      canvasRef,dprRef,mousePosRef,snapPosRef,boxSelectRectRef,panRef,
      mouseCanvasRef,flashMarkupIdRef,flashStartTimeRef,
      canvasSize,imgRefs,hoveredPtRef,
      drawMarkup,drawInProgress,drawScaleBar,drawLUTLegend,
      drawSnapIndicator,drawDisplacementVectors,drawAirwayOverlay,
      markups,selectedId,selectedIds,zoom,sessionImage,calibration,t,
      currentDraw,snapEnabled,showScaleBar,showDefTooltips,showLUT,
      showAnnotations,annotationSize,showDisplacement,compareSession,
      getProcessed,angleMode,lutMode,lutInvert,activeTool,
      displacementOverlay,overlayBlend,overlayAlignMode,overlayVectorScale,
      showTrackingLines,refLandmark1,refLandmark2,showCalib,pendingRuler,
      showGrid,showAirwayOverlay,
      alignTwoPoints,
      silhouettes:SILHOUETTES,
    };
    createRedraw(dc)();
  },[markups,selectedId,selectedIds,zoom,sessionImage,calibration,t,currentDraw,snapEnabled,showScaleBar,showDefTooltips,showLUT,showAnnotations,annotationSize,showDisplacement,compareSession,getProcessed,angleMode,lutMode,lutInvert,activeTool,displacementOverlay,overlayBlend,overlayAlignMode,overlayVectorScale,showTrackingLines,refLandmark1,refLandmark2,showCalib,pendingRuler,showGrid,showAirwayOverlay]);

  useEffect(()=>{if(!rafRef.current)rafRef.current=requestAnimationFrame(()=>{rafRef.current=null;redraw();});},[redraw]);
  const scheduleRedraw=useCallback(()=>{if(!rafRef.current)rafRef.current=requestAnimationFrame(()=>{rafRef.current=null;redraw();});},[redraw]);
  const scheduleRedrawRef=useRef(scheduleRedraw);scheduleRedrawRef.current=scheduleRedraw;
  // W3: listen for image-processed events from the worker and trigger a redraw
  useEffect(()=>{
    const onProcessed=()=>scheduleRedrawRef.current();
    window.addEventListener("cephalostudio:image-processed",onProcessed);
    return ()=>window.removeEventListener("cephalostudio:image-processed",onProcessed);
  },[]);

  // U3: Keep redrawing while calibration modal is open (pulsing highlight animation)
  useEffect(()=>{if(!showCalib||!pendingRuler)return;let raf;const loop=()=>{scheduleRedrawRef.current();raf=requestAnimationFrame(loop);};raf=requestAnimationFrame(loop);return()=>cancelAnimationFrame(raf);},[showCalib,pendingRuler]);

  // ══════════════════════════════════════
  // IMAGE LOADING
  const loadImage=useCallback((file,addToStack=false)=>{
    loadImageFile(file, addToStack, { sessionImages: activeSession?.images || [], dispatch, updSession, imgRefs, canvasSize, panRef });
  },[activeSession?.images, dispatch, updSession, imgRefs, canvasSize, panRef]);

  const handleDrop=useCallback(e=>{handleImageDrop(e, loadImage);},[loadImage]);

  useEffect(()=>{
    const fn=e=>{
      if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA")return;
      if((e.ctrlKey||e.metaKey)&&e.key==="z"){undo();return;}
      if((e.ctrlKey||e.metaKey)&&e.key==="y"){redo();return;}
      if(e.key==="Escape"){boxSelectRectRef.current=null;dispatch({type:"SET",payload:{currentDraw:null,selectedId:null,selectedIds:[]}});if(mobileToolsExpanded)dispatch({type:"SET",payload:{mobileToolsExpanded:false}});else if(placingMode){if(placingIdx<placingQueue.length-1)dispatch({type:"SET",payload:{placingIdx:placingIdx+1}});else{dispatch({type:"SET",payload:{placingMode:false}});dispatch({type:"SET",payload:{placingQueue:[]}});dispatch({type:"SET",payload:{placingIdx:0}});}}return;}
      if(e.key==="F10"&&e.shiftKey){e.preventDefault();const hitMarkup=selectedId||null;setContextMenu({x:window.innerWidth/2,y:window.innerHeight/2,markupId:hitMarkup,imageX:0,imageY:0});return;}
      if(e.key==="ContextMenu"||e.key==="Apps"){e.preventDefault();const hitMarkup=selectedId||null;setContextMenu({x:window.innerWidth/2,y:window.innerHeight/2,markupId:hitMarkup,imageX:0,imageY:0});return;}
      const tool=TOOLS.filter(Boolean).find(t2=>t2.key===e.key.toLowerCase());
      if(tool){dispatch({type:"SET",payload:{activeTool:tool.id}});dispatch({type:"SET",payload:{currentDraw:null}});return;}
      if(e.key==="Backspace"&&placingMode&&placingQueue.length>0){if(placingIdx>0)dispatch({type:"SET",payload:{placingIdx:placingIdx-1}});else{dispatch({type:"SET",payload:{placingMode:false}});dispatch({type:"SET",payload:{placingQueue:[]}});dispatch({type:"SET",payload:{placingIdx:0}});}return;}
      if((e.key==="Delete"||e.key==="Backspace")&&(selectedId||selectedIds.length)){
        const idsToDelete=selectedIds.length?selectedIds:selectedId?[selectedId]:[];
        const lockedIds=new Set(markups.filter(m=>m.locked).map(m=>m.id));
        const filtered=idsToDelete.filter(id=>!lockedIds.has(id));
        if(filtered.length){pushUndo();updSession({markups:refreshAutoMeas(markups.filter(m=>!filtered.includes(m.id)))});}
        dispatch({type:"SET",payload:{selectedIds:[],selectedId:null}});return;
      }
      if(e.key==="+"||e.key==="=")dispatch({type:"SET",payload:{zoom:z=>clamp(z*1.15,0.05,15)}});
      if(e.key==="-")dispatch({type:"SET",payload:{zoom:z=>clamp(z/1.15,0.05,15)}});
      if(e.key==="0"){dispatch({type:"SET",payload:{zoom:1}});panRef.current={x:40,y:40};dispatch({type:"SET",payload:{pan:{x:40,y:40}}});}
    };
    window.addEventListener("keydown",fn);return()=>window.removeEventListener("keydown",fn);
  },[selectedId,selectedIds,placingMode,placingIdx,placingQueue,markups,delMarkup,redo,undo,dispatch,pushUndo,refreshAutoMeas,updSession,mobileToolsExpanded]);

  // ══════════════════════════════════════
  // EVENT HANDLERS
  const handleMouseDown=useCallback(e=>{
    if(e.button===1){e.preventDefault();isPanning.current=true;panStart.current={mx:e.clientX,my:e.clientY,px:panRef.current.x,py:panRef.current.y};return;}
    if(e.button!==0)return;
    const sp=getCanvasPos(e);let ip=toImage(sp.x,sp.y);
    ip=snapPoint(ip,markups,12/zoom,snapEnabled);
     if(placingMode&&placingQueue.length>0&&placingIdx<placingQueue.length){
       const qid=placingQueue[placingIdx];
       const updatedMarkups=markups.map(m=>m.id===qid?{...m,points:[ip],placed:true}:m);
        const newAuto=autoCreateMeasurements(updatedMarkups,analysisTemplate,calibration);
       const newNorms=[];
       for(const m of newAuto){
         if(m.norm){
           const measureType=m.type==="angle3"||m.type==="angle4"?"angle":m.type==="line"?"length":m.type==="polygon"?"area":m.type==="ratio"||m.type==="sum"||m.type==="difference"||m.type==="percentage"?"value":m.type==="projDist"?"projectedDistance":"distance";
           if(!norms.some(n=>n.markupLabel===m.label&&n.measureType===measureType)){
             newNorms.push({id:uid(),markupLabel:m.label,measureType,mean:m.norm.mean,sd:m.norm.sd,source:analysisTemplate});
           }
         }
       }
        pushUndo();
        updSession({markups:refreshAutoMeas([...updatedMarkups,...newAuto]),norms:[...norms,...newNorms]});
       if(placingIdx<placingQueue.length-1)dispatch({type:"SET",payload:{placingIdx:placingIdx+1}});else{dispatch({type:"SET",payload:{placingMode:false}});dispatch({type:"SET",payload:{placingQueue:[]}});dispatch({type:"SET",payload:{placingIdx:0}});}
       return;
     }
    if(activeTool==="pan"){isPanning.current=true;panStart.current={mx:e.clientX,my:e.clientY,px:panRef.current.x,py:panRef.current.y};return;}
    if(activeTool==="select"){
      const hit=hitTest(markups,ip,zoom);
      if(!hit){
        boxSelectRectRef.current={x1:ip.x,y1:ip.y,x2:ip.x,y2:ip.y};
        dispatch({type:"SET",payload:{selectedIds:[],selectedId:null}});
        return;
      }
      setSelectedId(hit);
      const m=markups.find(x=>x.id===hit);
      const isMulti=selectedIds.length&&selectedIds.includes(hit);
      if(isMulti){multiDragIdsRef.current=[...selectedIds];dragStart.current=ip;isDragging.current=true;dragStartState.current=snapshotRef.current();return;}
      if(selectedIds.length)dispatch({type:"SET",payload:{selectedIds:[]}});
      if(m?.locked){isDragging.current=false;return;}
        if(m?.type==="silhouette"){
          try {
            const handles = getSilhouetteHandlesImage(m, zoom);
            const thr = Math.max(10, 20 * Math.sqrt(zoom)) / zoom;
            if (handles.rotCenter && isFinite(handles.rotCenter.x) && dist(ip, handles.rotCenter) < thr) {
              silhouetteAction.current = {
                type: "rotate", markupId: hit, startIp: ip,
                initialRotation: m.rotation || 0,
                center: { x: (handles.bbox.minX + handles.bbox.maxX) / 2, y: (handles.bbox.minY + handles.bbox.maxY) / 2 },
              };
              dragStartState.current=snapshotRef.current();
              return;
            }
            if (m.paths) {
              const ptThr = 8 / zoom;
              const rot = m.rotation || 0;
              const sc = m.scale || 1;
              const pos = m.position || { x: 0, y: 0 };
              const baseSize = 100;
              const cosR = Math.cos(rot);
              const sinR = Math.sin(rot);
              let bestPathIdx = -1, bestPtIdx = -1, bestDist = Infinity;
              m.paths.forEach((path, pi) => {
                path.points.forEach((p, ptI) => {
                  const sx = p.x * sc * baseSize;
                  const sy = p.y * sc * baseSize;
                  const rx = sx * cosR - sy * sinR;
                  const ry = sx * sinR + sy * cosR;
                  const d = dist(ip, { x: rx + pos.x, y: ry + pos.y });
                  if (d < bestDist) { bestDist = d; bestPathIdx = pi; bestPtIdx = ptI; }
                });
              });
              if (bestDist < ptThr && !e.ctrlKey && !e.shiftKey) {
                isDragging.current = true;
                dragMid.current = hit;
                dragStartState.current = snapshotRef.current();
                dragPtIdx.current = { pathIdx: bestPathIdx, ptIdx: bestPtIdx };
                dragStart.current = ip;
                return;
              }
            }
            if (e.ctrlKey && m.paths) {
              const rot = m.rotation || 0;
              const sc = m.scale || 1;
              const pos = m.position || { x: 0, y: 0 };
              const baseSize = 100;
              const cosR = Math.cos(rot);
              const sinR = Math.sin(rot);
              let bestPathIdx = -1, bestPtIdx = -1, bestDist = Infinity;
              m.paths.forEach((path, pi) => {
                path.points.forEach((p, ptI) => {
                  const sx = p.x * sc * baseSize;
                  const sy = p.y * sc * baseSize;
                  const rx = sx * cosR - sy * sinR;
                  const ry = sx * sinR + sy * cosR;
                  const d = dist(ip, { x: rx + pos.x, y: ry + pos.y });
                  if (d < bestDist) { bestDist = d; bestPathIdx = pi; bestPtIdx = ptI; }
                });
              });
              const dnx = ((ip.x - pos.x) * cosR + (ip.y - pos.y) * sinR) / (sc * baseSize);
              const dny = (-(ip.x - pos.x) * sinR + (ip.y - pos.y) * cosR) / (sc * baseSize);
              const newPaths = m.paths.map((path, pi) => {
                if (pi !== bestPathIdx) return path;
                const newPoints = [...path.points];
                newPoints.splice(bestPtIdx + 1, 0, { x: dnx, y: dny });
                return { ...path, points: newPoints };
              });
              updMarkup(hit, { paths: newPaths });
              return;
            }
            if (e.shiftKey && m.paths) {
              const rot = m.rotation || 0;
              const sc = m.scale || 1;
              const pos = m.position || { x: 0, y: 0 };
              const baseSize = 100;
              const cosR = Math.cos(rot);
              const sinR = Math.sin(rot);
              let bestPathIdx = -1, bestPtIdx = -1, bestDist = Infinity;
              m.paths.forEach((path, pi) => {
                path.points.forEach((p, ptI) => {
                  const sx = p.x * sc * baseSize;
                  const sy = p.y * sc * baseSize;
                  const rx = sx * cosR - sy * sinR;
                  const ry = sx * sinR + sy * cosR;
                  const d = dist(ip, { x: rx + pos.x, y: ry + pos.y });
                  if (d < bestDist) { bestDist = d; bestPathIdx = pi; bestPtIdx = ptI; }
                });
              });
              if (m.paths[bestPathIdx].points.length > 2) {
                const newPaths = m.paths.map((path, pi) => {
                  if (pi !== bestPathIdx) return path;
                  return { ...path, points: path.points.filter((_, i) => i !== bestPtIdx) };
                });
                updMarkup(hit, { paths: newPaths });
              }
              return;
            }
            const cornerThr = Math.max(6, 10 * Math.sqrt(zoom)) / zoom;
            for (let hi = 0; hi < handles.corners.length; hi++) {
              const c = handles.corners[hi];
              if (isFinite(c.x) && dist(ip, c) < cornerThr) {
                const cx = (handles.bbox.minX + handles.bbox.maxX) / 2;
                const cy = (handles.bbox.minY + handles.bbox.maxY) / 2;
                silhouetteAction.current = {
                  type: "resize", markupId: hit, startIp: ip,
                  initialScale: m.scale || 1,
                  center: { x: cx, y: cy },
                  initialDist: dist(ip, { x: cx, y: cy }),
                };
                dragStartState.current=snapshotRef.current();
                return;
              }
            }
          } catch(e) { logError("Silhouette handle error", e); }
          isDragging.current=true;dragMid.current=hit;dragStartState.current=snapshotRef.current();
          dragPtIdx.current=-1;dragStart.current=ip;
          return;
        }
        if(e.ctrlKey&&(m.type==="curve"||m.type==="polygon"||m.type==="bezier")){
          const vp=vpts(m);
          let bestIdx=-1,bestDist=Infinity;
          for(let i=0;i<vp.length;i++){const d=dist(ip,vp[i]);if(d<bestDist){bestDist=d;bestIdx=i;}}
          const newPoints=[...m.points];
          newPoints.splice(bestIdx+1,0,ip);
          const patch={points:newPoints};
          if(m.type==="bezier"&&Array.isArray(m.cp)&&m.cp.length===2*(m.points.length-1)&&bestIdx<vp.length-1){
            const oc=m.cp,nc=new Array(oc.length+2);
            let j=0;
            for(;j<2*bestIdx;j++)nc[j]=oc[j];
            nc[j]=oc[j];j++;
            const p0=vp[bestIdx],p1=ip,p2=vp[bestIdx+1];
            nc[j]={x:p1.x-(p2.x-p1.x)/6,y:p1.y-(p2.y-p1.y)/6};j++;
            nc[j]={x:p1.x+(p2.x-p0.x)/6,y:p1.y+(p2.y-p0.y)/6};j++;
            nc[j]=oc[j-2];j++;
            for(;j<nc.length;j++)nc[j]=oc[j-2];
            patch.cp=nc;
          }else if(m.type==="bezier")patch.cp=autoControlPoints(newPoints);
          updMarkup(hit,patch);
          return;
        }
        if(e.shiftKey&&(m.type==="curve"||m.type==="polygon"||m.type==="bezier")){
          const vp=vpts(m);
          let bestIdx=-1,bestDist=Infinity;
          for(let i=0;i<vp.length;i++){const d=dist(ip,vp[i]);if(d<bestDist){bestDist=d;bestIdx=i;}}
          if(bestIdx>=0&&vp.length>2){const newPoints=m.points.filter((_,i)=>i!==bestIdx);const patch={points:newPoints};if(m.type==="bezier"&&Array.isArray(m.cp)&&m.cp.length===2*(m.points.length-1)){const oc=m.cp;if(bestIdx===0)patch.cp=oc.slice(2);else if(bestIdx===vp.length-1)patch.cp=oc.slice(0,oc.length-2);else{const nc=new Array(oc.length-2);let j=0;for(;j<2*bestIdx-1;j++)nc[j]=oc[j];nc[j]=oc[2*bestIdx+1];j++;for(;j<nc.length;j++)nc[j]=oc[j+2];patch.cp=nc;}}else if(m.type==="bezier")patch.cp=autoControlPoints(newPoints);updMarkup(hit,patch);}
          return;
        }
        if(m.type==="bezier"&&hoveredPtRef.current?.type==="bezierCp"){
          isDragging.current=true;dragMid.current=hit;dragStartState.current=snapshotRef.current();
          dragPtIdx.current={type:"cp",idx:hoveredPtRef.current.cpIdx};dragStart.current=ip;
          return;
        }
        isDragging.current=true;dragMid.current=hit;dragStartState.current=snapshotRef.current();
        let bi=0,bd=Infinity;(m.points||[]).forEach((p,i)=>{const d=dist(p,ip);if(d<bd){bd=d;bi=i;}});
        if(bd>12/zoom)bi=-1;
        dragPtIdx.current=bi;dragStart.current=ip;
      return;
    }
    if(activeTool==="text"){dispatch({type:"SET",payload:{pendingTextPos:ip}});return;}
    if(activeTool==="point"){
      if(replacingId){updMarkup(replacingId,{points:[ip],placed:true});dispatch({type:"SET",payload:{replacingId:null}});return;}
      const nNon=markups.filter(m=>m.type==="point"&&!m.repro).length;
      addMarkup({type:"point",points:[ip],label:`P${nNon+1}`,color:t.acc,size:6,definition:""});
      return;
    }
    if(activeTool==="ruler"){if(!currentDraw)dispatch({type:"SET",payload:{currentDraw:{type:"ruler",points:[ip]}}});else{const ruler={...currentDraw,type:"ruler",points:[...currentDraw.points,ip],label:"Ruler"};dispatch({type:"SET",payload:{pendingRuler:ruler}});addMarkup(ruler);dispatch({type:"SET",payload:{currentDraw:null}});dispatch({type:"SET",payload:{showCalib:true}});}return;}
    if(activeTool==="parallel"){if(selectedMarkup&&(selectedMarkup.type==="line"||selectedMarkup.type==="parallel")){const vp=vpts(selectedMarkup);if(vp.length>=2){const dx=vp[1].x-vp[0].x,dy=vp[1].y-vp[0].y,len=Math.sqrt(dx*dx+dy*dy)||1,half=len/2;addMarkup({type:"parallel",points:[{x:ip.x-dx/len*half,y:ip.y-dy/len*half},{x:ip.x+dx/len*half,y:ip.y+dy/len*half}],color:"#34d399",width:1.5,style:"solid",label:`∥`,showLength:true});return;}}if(!currentDraw)dispatch({type:"SET",payload:{currentDraw:{type:"line",points:[ip]}}});else{finalizeMarkup({...currentDraw,points:[...currentDraw.points,ip]});dispatch({type:"SET",payload:{currentDraw:null}});}return;}
    if(activeTool==="midpoint"){if(!currentDraw)dispatch({type:"SET",payload:{currentDraw:{type:"midpoint",points:[ip]}}});else{const p1=currentDraw.points[0],p2=ip;if(p1.x>-9000&&p2.x>-9000){const mid={x:(p1.x+p2.x)/2,y:(p1.y+p2.y)/2};const n=markups.filter(m=>m.type==="point").length;addMarkup({type:"point",points:[mid],label:`M${n+1}`,color:"#fbbf24",size:6,definition:"Midpoint"});}dispatch({type:"SET",payload:{currentDraw:null}});}return;}
    if(activeTool==="perppoint"){if(!currentDraw)dispatch({type:"SET",payload:{currentDraw:{type:"perppoint",points:[ip]}}});else if(currentDraw.points.length===1)dispatch({type:"SET",payload:{currentDraw:{type:"perppoint",points:[currentDraw.points[0],ip]}}});else{const p1=currentDraw.points[0],p2=currentDraw.points[1],p3=ip;if(p1.x>-9000&&p2.x>-9000&&p3.x>-9000){const lx1=p2.x-p1.x,ly1=p2.y-p1.y;const lx2=-ly1,ly2=lx1;const perpPt={x:p3.x+lx2,y:p3.y+ly2};const n=markups.filter(m=>m.type==="line"||m.type==="perp").length+1;addMarkup({type:"line",mode:"segment",points:[perpPt,p3],color:"#f472b6",width:1.5,style:"solid",label:`⊥${n}`,showLength:true});}dispatch({type:"SET",payload:{currentDraw:null}});}return;}
    if(activeTool==="arrow"){if(!currentDraw)dispatch({type:"SET",payload:{currentDraw:{type:"arrow",points:[ip]}}});else{const p1=currentDraw.points[0],p2=ip;if(p1.x>-9000&&p2.x>-9000){addMarkup({type:"arrow",points:[p1,p2],color:"#34d399",width:2});}dispatch({type:"SET",payload:{currentDraw:null}});}return;}
    if(activeTool==="tangent"){
      if(!currentDraw){
        const thr=25/zoom;
        const hit=findTangentOnCurve(markups,ip,thr);
        if(hit){
          const a=hit.tangentAngle;
          dispatch({type:"SET",payload:{currentDraw:{type:"tangent",points:[hit.tangentPoint],tangentAngle:a,tangentCurveId:hit.curveId,tangentCenter:hit.curveCenter,tangentRadius:hit.curveRadius}}});
        }else{
          dispatch({type:"SET",payload:{currentDraw:{type:"tangent",points:[ip]}}});
        }
      }else{
        const p0=currentDraw.points[0];
        if(currentDraw.tangentAngle!=null){
          const a=currentDraw.tangentAngle;
          const dx=ip.x-p0.x,dy=ip.y-p0.y;
          const proj=dx*Math.cos(a)+dy*Math.sin(a);
          const ep={x:p0.x+proj*Math.cos(a),y:p0.y+proj*Math.sin(a)};
          finalizeMarkup({...currentDraw,points:[p0,ep]});
        }else{
          finalizeMarkup({...currentDraw,points:[p0,ip]});
        }
        dispatch({type:"SET",payload:{currentDraw:null}});
      }
      return;}
    if(activeTool==="ellipse"||activeTool==="arc"||activeTool==="circle"||activeTool==="concentric"){
      if(!currentDraw)dispatch({type:"SET",payload:{currentDraw:{type:activeTool,points:[ip],curveStyle:"linear",replacingId}}});
      else{const nps=[...currentDraw.points,ip];const need={ellipse:3,arc:3,circle:2,concentric:3}[activeTool];
        if(need&&nps.length>=need){finalizeMarkup({...currentDraw,points:nps});dispatch({type:"SET",payload:{currentDraw:null}});}
        else dispatch({type:"SET",payload:{currentDraw:{...currentDraw,points:nps}}});}
      return;}
    if(activeTool==="bezier"){
      if(!currentDraw)dispatch({type:"SET",payload:{currentDraw:{type:"bezier",points:[ip],replacingId}}});
      else{dispatch({type:"SET",payload:{currentDraw:{...currentDraw,points:[...currentDraw.points,ip]}}});}
      return;}
    if(["line","angle3","angle4","polygon","curve","perp"].includes(activeTool)){
      if(!currentDraw)dispatch({type:"SET",payload:{currentDraw:{type:activeTool,points:[ip],curveStyle:"linear",replacingId}}});
      else{const nps=[...currentDraw.points,ip];const need={line:2,angle3:3,angle4:4,perp:3}[activeTool];if(need&&nps.length>=need){finalizeMarkup({...currentDraw,points:nps});dispatch({type:"SET",payload:{currentDraw:null}});}else dispatch({type:"SET",payload:{currentDraw:{...currentDraw,points:nps}}});}return;}
  },[activeTool,markups,zoom,snapEnabled,currentDraw,selectedMarkup,selectedIds,placingMode,placingQueue,placingIdx,replacingId,setSelectedId,updMarkup,addMarkup,finalizeMarkup,toImage,getCanvasPos,t,analysisTemplate,autoCreateMeasurements,dispatch,norms,pushUndo,refreshAutoMeas,updSession,calibration]);

  const syncTangents=(curveId,dx,dy)=>{markups.forEach(tm=>{if(tm.type==="tangent"&&tm.tangentCurveId===curveId){const pts=tm.points||[];if(tm.tangentAngle!=null){const newPts=[{x:pts[0].x+dx,y:pts[0].y+dy},{x:pts[1].x+dx,y:pts[1].y+dy}];updMarkup(tm.id,{points:newPts});}else{updMarkup(tm.id,{points:pts.map(p=>({x:p.x+dx,y:p.y+dy}))});}}});};
  const syncRefDeps=(label,dx,dy)=>{if(!label)return;markups.forEach(dm=>{if(dm.type==="point"||!dm.refLabels)return;const rl=dm.refLabels;let changed=false;const pts=(dm.points||[]).map((p,i)=>{if(rl[i]===label){changed=true;return{x:p.x+dx,y:p.y+dy};}return p;});if(changed){const patch={points:pts};if(dm.type==="bezier"&&dm.cp)patch.cp=dm.cp.map(cp=>({x:cp.x+dx,y:cp.y+dy}));updMarkup(dm.id,patch);}});};

  const handleMouseMove=useCallback(e=>{
    const sp=getCanvasPos(e);
    mouseCanvasRef.current=sp;
    // F1: write pointer state to refs — no dispatch, no React re-render
    mousePosRef.current=sp;
    if(snapEnabled&&activeTool!=="select"&&activeTool!=="pan"){const ip=toImage(sp.x,sp.y);const sn=snapPoint(ip,markups,12/zoom,snapEnabled);const prev=snapPosRef.current;snapPosRef.current=(Math.abs(sn.x-ip.x)>0.1||Math.abs(sn.y-ip.y)>0.1)?sn:null;if((prev===null)!==(snapPosRef.current===null)||((prev&&snapPosRef.current)&&(prev.x!==snapPosRef.current.x||prev.y!==snapPosRef.current.y)))scheduleRedrawRef.current();}else{if(snapPosRef.current!==null){snapPosRef.current=null;scheduleRedrawRef.current();}}
    if(activeTool==="select"&&!isDragging.current&&!silhouetteAction.current){const ip=toImage(sp.x,sp.y);let best=null,bd=Infinity;const ptThr=12/zoom;for(const m2 of markups){if(m2.locked||m2.visible===false)continue;if(m2.type==="point"){const vp=vpts(m2);if(vp.length){const d=dist(ip,vp[0]);if(d<bd&&d<ptThr){bd=d;best={type:"point",mid:m2.id};}}}if(m2.type==="silhouette"){const paths=m2.paths||SILHOUETTES[m2.silhouetteType]?.paths;if(!paths)continue;const rot=m2.rotation||0;const sc=m2.scale||1;const pos=m2.position||{x:0,y:0};const cosR=Math.cos(rot);const sinR=Math.sin(rot);paths.forEach((path,pi)=>{path.points.forEach((p,ptI)=>{const sx=p.x*sc*100;const sy=p.y*100;const rx=sx*cosR-sy*sinR;const ry=sx*sinR+sy*cosR;const d=dist(ip,{x:rx+pos.x,y:ry+pos.y});if(d<bd&&d<ptThr){bd=d;best={type:"silhouette",mid:m2.id,pathIdx:pi,ptIdx:ptI};}});});if(m2.id===selectedId){try{const h=getSilhouetteHandlesImage(m2,zoom);const rotThr=Math.max(10,22*Math.sqrt(zoom))/zoom;if(h.rotCenter&&isFinite(h.rotCenter.x)){const d=dist(ip,h.rotCenter);if(d<rotThr&&d<bd){bd=d;best={type:"rotate",mid:m2.id};}}const cornerThr=Math.max(8,12*Math.sqrt(zoom))/zoom;h.corners.forEach((c,ci)=>{if(isFinite(c.x)){const d=dist(ip,c);if(d<cornerThr&&d<bd){bd=d;best={type:"corner",mid:m2.id,cornerIdx:ci};}}});}catch{/*silent*/}}        }else if(m2.type==="curve"||m2.type==="polygon"||m2.type==="bezier"||m2.type==="tangent"){if(m2.type==="bezier"&&m2.cp){m2.cp.forEach((p,i)=>{const d=dist(ip,p);if(d<bd&&d<ptThr){bd=d;best={type:"bezierCp",mid:m2.id,cpIdx:i};}});}(m2.points||[]).forEach((p,i)=>{const d=dist(ip,p);if(d<bd&&d<ptThr){bd=d;best={type:m2.type==="bezier"?"bezier":m2.type==="tangent"?"tangent":"path",mid:m2.id,ptIdx:i};}});}}const _prevHover=hoveredPtRef.current;hoveredPtRef.current=best;if(JSON.stringify(_prevHover)!==JSON.stringify(best))scheduleRedrawRef.current();}else{hoveredPtRef.current=null;}
    const _hp=hoveredPtRef.current;const _isPanning=isPanning.current;const _curCursor=(_hp&&(_hp.type==="bezierCp"||_hp.type==="bezier"||_hp.type==="path"||_hp.type==="point"||_hp.type==="tangent"||_hp.type==="silhouette"||_hp.type==="rotate"||_hp.type==="corner"))?"pointer":_isPanning?"grabbing":activeTool==="pan"?"grab":activeTool==="select"?"default":"crosshair";if(canvasRef.current.style.cursor!==_curCursor)canvasRef.current.style.cursor=_curCursor;
    if(boxSelectRectRef.current){const ip=toImage(sp.x,sp.y);boxSelectRectRef.current={...boxSelectRectRef.current,x2:ip.x,y2:ip.y};scheduleRedrawRef.current();return;}
    if(isPanning.current&&panStart.current){panRef.current={x:panStart.current.px+(e.clientX-panStart.current.mx),y:panStart.current.py+(e.clientY-panStart.current.my)};scheduleRedrawRef.current();return;}
    if(isDragging.current&&multiDragIdsRef.current){const ip=toImage(sp.x,sp.y);const dx=ip.x-dragStart.current.x,dy=ip.y-dragStart.current.y;const ids=multiDragIdsRef.current;ids.forEach(cid=>{const cm=markups.find(x=>x.id===cid);if(cm?.label)syncRefDeps(cm.label,dx,dy);});updMarkups(ms=>ms.map(m=>{if(!ids.includes(m.id))return m;if(m.type==="silhouette")return{...m,position:{x:(m.position?.x||0)+dx,y:(m.position?.y||0)+dy}};return{...m,points:(m.points||[]).map(p=>p.x>-9000?{x:p.x+dx,y:p.y+dy}:p)};}));ids.forEach(cid=>{const cm=markups.find(x=>x.id===cid);if(!cm)return;if(["circle","arc","ellipse","bezier","curve","polygon"].includes(cm.type))syncTangents(cid,dx,dy);});dragStart.current=ip;scheduleRedrawRef.current();return;}
    if(isDragging.current&&dragMid.current){const ip=toImage(sp.x,sp.y);const dx=ip.x-dragStart.current.x,dy=ip.y-dragStart.current.y;const m=markups.find(x=>x.id===dragMid.current);if(!m)return;if(m.type==="silhouette"){if(typeof dragPtIdx.current==="object"&&dragPtIdx.current!==null){const sc=m.scale||1;const rot=m.rotation||0;const cosR=Math.cos(rot);const sinR=Math.sin(rot);const baseSize=100;const dnx=(cosR*dx+sinR*dy)/(sc*baseSize);const dny=(-sinR*dx+cosR*dy)/(sc*baseSize);const{pathIdx,ptIdx}=dragPtIdx.current;updMarkup(dragMid.current,{paths:(m.paths||[]).map((path,pi)=>({...path,points:path.points.map((p,ptI)=>pi===pathIdx&&ptI===ptIdx?{x:p.x+dnx,y:p.y+dny}:p)}))});}else{updMarkup(dragMid.current,{position:{x:(m.position?.x||0)+dx,y:(m.position?.y||0)+dy}});}}else if(m.type==="tangent"&&dragPtIdx.current===0&&m.tangentCurveId){const curve=markups.find(c=>c.id===m.tangentCurveId);if(curve){const raw={x:(m.points[0]||{}).x+dx,y:(m.points[0]||{}).y+dy};const snapped=snapTangentToCurve(curve,raw);if(snapped){const ep=m.points[1]||raw;const a=snapped.tangentAngle;const dex=ep.x-snapped.tangentPoint.x,dey=ep.y-snapped.tangentPoint.y;const proj=dex*Math.cos(a)+dey*Math.sin(a);const newEp={x:snapped.tangentPoint.x+proj*Math.cos(a),y:snapped.tangentPoint.y+proj*Math.sin(a)};updMarkup(dragMid.current,{points:[snapped.tangentPoint,newEp],tangentAngle:snapped.tangentAngle});}}else{updMarkup(dragMid.current,{points:(m.points||[]).map((p,i)=>i===0?{x:p.x+dx,y:p.y+dy}:p)});}}else if(m.type==="bezier"&&typeof dragPtIdx.current==="object"&&dragPtIdx.current?.type==="cp"){const cp=[...(m.cp||[])];const ci=dragPtIdx.current.idx;if(ci<cp.length)cp[ci]={x:cp[ci].x+dx,y:cp[ci].y+dy};updMarkup(dragMid.current,{cp});}else if(m.type==="bezier"&&typeof dragPtIdx.current==="number"&&dragPtIdx.current>=0){const ni=dragPtIdx.current;const pts=(m.points||[]).map((p,i)=>i===ni?{x:p.x+dx,y:p.y+dy}:p);const cp=Array.isArray(m.cp)?[...(m.cp)]:[];if(cp.length===2*(pts.length-1)){if(ni>0&&cp[2*ni-1])cp[2*ni-1]={x:cp[2*ni-1].x+dx,y:cp[2*ni-1].y+dy};if(ni<pts.length-1&&cp[2*ni])cp[2*ni]={x:cp[2*ni].x+dx,y:cp[2*ni].y+dy};}updMarkup(dragMid.current,{points:pts,cp});}else{syncRefDeps(m.label,dx,dy);updMarkup(dragMid.current,{points:(m.points||[]).map((p,i)=>i===dragPtIdx.current?{x:p.x+dx,y:p.y+dy}:p)});syncTangents(m.id,dx,dy);}dragStart.current=ip;scheduleRedrawRef.current();}
    if(silhouetteAction.current){
      try {
        const ip=toImage(sp.x,sp.y);const sa=silhouetteAction.current;
        const m=markups.find(x=>x.id===sa.markupId);
        if(!m||!isFinite(sa.center.x)||!isFinite(sa.center.y)){silhouetteAction.current=null;return;}
        if(sa.type==="resize"&&isFinite(sa.initialDist)&&sa.initialDist>0){
          const d=dist(ip,sa.center);
          if(!isFinite(d)) return;
          const f=d/sa.initialDist;
          updMarkup(sa.markupId,{scale:Math.max(0.05,Math.min(20,sa.initialScale*f))});
        }else if(sa.type==="rotate"&&isFinite(sa.startIp.x)){
          const a=Math.atan2(ip.y-sa.center.y,ip.x-sa.center.x);
          const s=Math.atan2(sa.startIp.y-sa.center.y,sa.startIp.x-sa.center.x);
          updMarkup(sa.markupId,{rotation:sa.initialRotation+(a-s)});
        }
        scheduleRedrawRef.current();
      } catch { silhouetteAction.current=null; /*silent*/ }
    }
  },[activeTool,markups,zoom,snapEnabled,selectedId,updMarkup,updMarkups,toImage,getCanvasPos,currentDraw?.type,syncTangents,syncRefDeps]);

  const handleMouseUp=()=>{
    if(boxSelectRectRef.current){
      const{x1,y1,x2,y2}=boxSelectRectRef.current;
      boxSelectRectRef.current=null;
      const minX=Math.min(x1,x2),maxX=Math.max(x1,x2);
      const minY=Math.min(y1,y2),maxY=Math.max(y1,y2);
      const inside=markups.filter(m=>{
        if(m.locked||m.visible===false)return false;
        const pts=m.type==="silhouette"?(m.position?[m.position]:[]):vpts(m);
        return pts.some(p=>p.x>=minX&&p.x<=maxX&&p.y>=minY&&p.y<=maxY);
      });
      const ids=inside.map(m=>m.id);
      dispatch({type:"SET",payload:{selectedIds:ids,selectedId:ids.length===1?ids[0]:null}});
      multiDragIdsRef.current=null;
    }
    if((isDragging.current||silhouetteAction.current)&&dragStartState.current){
      const currentState=snapshotRef.current();
      if(dragStartState.current!==currentState){
        undoStackRef.current.push(dragStartState.current);
        if(undoStackRef.current.length>50)undoStackRef.current.shift();
        redoStackRef.current=[];
        setUndoVersion(v=>v+1);
      }
      dragStartState.current=null;
    }
    isPanning.current=false;isDragging.current=false;silhouetteAction.current=null;multiDragIdsRef.current=null;
  };
  const handleDblClick=()=>{if((["polygon","curve","bezier"].includes(activeTool))&&currentDraw?.points.length>=2){finalizeMarkup(currentDraw);dispatch({type:"SET",payload:{currentDraw:null}});}};
  const handleCanvasContextMenu=useCallback(e=>{e.preventDefault();const sp=getCanvasPos(e);const ip=toImage(sp.x,sp.y);const hit=hitTest(markups,ip,zoom);setContextMenu(hit?{x:e.clientX,y:e.clientY,markupId:hit,imageX:ip.x,imageY:ip.y}:{x:e.clientX,y:e.clientY,markupId:null,imageX:ip.x,imageY:ip.y});},[markups,zoom,getCanvasPos,toImage]);
  useEffect(()=>{if(!contextMenu)return;const close=()=>setContextMenu(null);const onKey=e=>{if(e.key==="Escape")close();if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();const items=document.querySelectorAll('[data-cmenu] [role="menuitem"]');const current=e.target.closest('[role="menuitem"]');const idx=Array.from(items).indexOf(current);const next=e.key==="ArrowDown"?Math.min(idx+1,items.length-1):Math.max(idx-1,0);if(items[next])items[next].focus();}if(e.key==="Tab"){e.preventDefault();const items=document.querySelectorAll('[data-cmenu] [role="menuitem"]');const first=items[0];const last=items[items.length-1];if(e.shiftKey){if(document.activeElement===first){last.focus();}}else{if(document.activeElement===last){first.focus();}}}};const onClickOutside=e=>{if(!e.target.closest('[data-cmenu]'))close()};document.addEventListener("mousedown",onClickOutside);document.addEventListener("keydown",onKey);setTimeout(()=>{const first=document.querySelector('[data-cmenu] [role="menuitem"]');if(first)first.focus();},0);return()=>{document.removeEventListener("mousedown",onClickOutside);document.removeEventListener("keydown",onKey);};},[contextMenu]);
  useEffect(()=>{const c=canvasRef.current;if(!c)return;const onWheel=e=>{if(Math.abs(e.deltaY)>0.1||Math.abs(e.deltaX)>0.1){e.preventDefault();e.stopPropagation();const sp=getCanvasPos(e),f=e.deltaY>0?0.9:1.1,nz=clamp(zoom*f,0.05,15);const prev=panRef.current;panRef.current={x:sp.x-(sp.x-prev.x)*(nz/zoom),y:sp.y-(sp.y-prev.y)*(nz/zoom)};dispatch({type:"SET",payload:{pan:panRef.current}});dispatch({type:"SET",payload:{zoom:nz}});}};c.addEventListener("wheel",onWheel,{passive:false});return()=>c.removeEventListener("wheel",onWheel);},[zoom,dispatch,getCanvasPos]);
  const touchStartRef=useRef();const touchMoveRef=useRef();const touchEndRef=useRef();const longPressTimerRef=useRef(null);
  touchStartRef.current=e=>{
    if(e.touches.length===1){const t2=e.touches[0];const now=Date.now();if(now-lastTapRef.current<300){handleDblClick();lastTapRef.current=0;}else{lastTapRef.current=now;handleMouseDown({button:0,clientX:t2.clientX,clientY:t2.clientY});const sp=getCanvasPos({clientX:t2.clientX,clientY:t2.clientY});const ip=toImage(sp.x,sp.y);const hit=hitTest(markups,ip,zoom);longPressTimerRef.current=setTimeout(()=>{longPressTimerRef.current=null;setContextMenu({x:t2.clientX,y:t2.clientY,markupId:hit||null,imageX:ip.x,imageY:ip.y});},500);}}
    if(e.touches.length===2){lastTouchDist.current=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);if((activeTool==="curve"||activeTool==="polygon")&&currentDraw?.points.length>=2){handleMouseDown({button:0,clientX:(e.touches[0].clientX+e.touches[1].clientX)/2,clientY:(e.touches[0].clientY+e.touches[1].clientY)/2,ctrlKey:true});}}
  };
  touchMoveRef.current=e=>{
    if(longPressTimerRef.current){clearTimeout(longPressTimerRef.current);longPressTimerRef.current=null;}
    if(e.touches.length===1){const t2=e.touches[0];handleMouseMove({clientX:t2.clientX,clientY:t2.clientY});}
    if(e.touches.length===2&&lastTouchDist.current){const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);const f=d/lastTouchDist.current,nz=clamp(zoom*f,0.05,15);const cx=(e.touches[0].clientX+e.touches[1].clientX)/2,cy=(e.touches[0].clientY+e.touches[1].clientY)/2;const r=canvasRef.current.getBoundingClientRect();const sp={x:cx-r.left,y:cy-r.top};const prev=panRef.current;panRef.current={x:sp.x-(sp.x-prev.x)*(nz/zoom),y:sp.y-(sp.y-prev.y)*(nz/zoom)};dispatch({type:"SET",payload:{pan:panRef.current}});dispatch({type:"SET",payload:{zoom:nz}});lastTouchDist.current=d;}
  };
  touchEndRef.current=()=>{if(longPressTimerRef.current){clearTimeout(longPressTimerRef.current);longPressTimerRef.current=null;}handleMouseUp();lastTouchDist.current=null;};
  useEffect(()=>{const c=canvasRef.current;if(!c)return;const opts={passive:false};const onStart=e=>{e.preventDefault();touchStartRef.current(e);};const onMove=e=>{e.preventDefault();touchMoveRef.current(e);};const onEnd=e=>{touchEndRef.current(e);};c.addEventListener("touchstart",onStart,opts);c.addEventListener("touchmove",onMove,opts);c.addEventListener("touchend",onEnd,opts);return()=>{c.removeEventListener("touchstart",onStart);c.removeEventListener("touchmove",onMove);c.removeEventListener("touchend",onEnd);};},[]);

  // ══════════════════════════════════════
  // CALIBRATION + TEMPLATE + EXPORT
  const finalizeCalib=useCallback((mm,manualPpm)=>{
    if(manualPpm){
      finalizeCalibManual(manualPpm, pushUndo, updSession, dispatch);
      return;
    }
    finalizeCalibRuler(pendingRuler, mm, markups, { pushUndo, updSession, dispatch });
  },[pendingRuler, markups, pushUndo, updSession, dispatch]);

  const loadTemplate=(analysis)=>{
    const newMarkups=[];
    const pointIds={};
    analysis.pts.forEach(pt=>{
      const alreadyPlaced = markups.some(m =>
        m.type === "point" && m.label?.toLowerCase() === pt.l.toLowerCase() && m.placed && m.visible !== false
      );
      if (alreadyPlaced) return;
      const id=uid();
      pointIds[pt.l]=id;
      newMarkups.push({id,type:"point",points:[{x:-99999,y:-99999}],label:pt.l,definition:pt.def,color:pt.color,size:6,visible:true,placed:false});
    });
    pushUndo();
    updSession({markups:[...markups,...newMarkups],analysisTemplate:analysis.name});
    setPlacingQueue(newMarkups.map(m=>m.id));dispatch({type:"SET",payload:{placingIdx:0}});dispatch({type:"SET",payload:{placingMode:true}});dispatch({type:"SET",payload:{rightPanel:"markups"}});
    if(analysis.name?.toLowerCase().includes("airway")){
      dispatch({type:"SET",payload:{rightPanel:"airway"}});
    }
  };

  const exportCSV=useCallback(()=>{
    exportCSVData(markups, calibration, formatAngle, project.name);
  },[markups, calibration, formatAngle, project.name]);

  const captureMarkupImage = useCallback(async () => {
    const imgEl = sessionImage?.[0] ? imgRefs.current[sessionImage[0].id] : null;
    if (!imgEl) return null;
    const c = document.createElement("canvas");
    c.width = imgEl.naturalWidth;
    c.height = imgEl.naturalHeight;
    const ctx = c.getContext("2d");if(!ctx)return null;
    ctx.drawImage(imgEl, 0, 0);
    const visible = markups.filter(m => m.visible !== false);
    const cs = { w: c.width, h: c.height };
    visible.forEach(m => drawMarkup(ctx, m, 1, { x: 0, y: 0 }, calibration, null, t, false, cs, "deg", true, 1.2));
    return c.toDataURL("image/png");
  }, [sessionImage, markups, calibration, t]);

  const measScope=useMemo(()=>buildScope(markups,calibration),[markups,calibration]);
  const allMeas=useMemo(()=>markups.map(m=>({m,meas:computeMeasurements(m,calibration)})).filter(x=>Object.keys(x.meas).length>0),[markups,calibration]);
  const formulaMeas = useMemo(() => {
    const res = [];
    formulas.forEach(f => {
      if (!pinnedFormulas.has(f.id)) return;
      const v = evalFormula(f.expression, measScope);
      if (v !== null && isFinite(v)) {
        res.push({
          m: { id: "fm_" + f.id, type: "formula", label: f.name, color: t.acc2 },
          meas: { value: v },
        });
      }
    });
    return res;
  }, [formulas, measScope, pinnedFormulas, t]);
  const cursorStyle={select:"default",boxselect:"crosshair",pan:"grab",point:"crosshair",line:"crosshair",angle3:"crosshair",angle4:"crosshair",polygon:"crosshair",curve:"crosshair",perp:"crosshair",parallel:"crosshair",midpoint:"crosshair",perppoint:"crosshair",arrow:"crosshair",text:"text",ruler:"crosshair"}[activeTool]||"default";
  const _availAnalyses=PREDEFINED[project.projection]||[];

  const panelIcons = PANEL_ICONS;
  const panelTabs = PANEL_TABS;

  // ── Panel prop bundles ──
  const pMarkups={markups,t,theme,selectedId,onSelect:selectAndFocusMarkup,onDelete:delMarkup,calibration,placingMode,placingQueue,placingIdx,norms,formatAngle,angleMode,setAngleMode,replacingId,
    onToggleVisible:id=>updMarkup(id,{visible:markups.find(m=>m.id===id)?.visible===false}),
    onToggleLock:id=>updMarkup(id,{locked:!markups.find(m=>m.id===id)?.locked}),
    onToggleLabel:id=>updMarkup(id,{noLabel:!markups.find(m=>m.id===id)?.noLabel}),
    onToggleGroupVisible:types=>{
      const group=markups.filter(m=>types.includes(m.type));
      if(!group.length)return;
      const allVisible=group.every(m=>m.visible!==false);
      pushUndo();
      updSession({markups:refreshAutoMeas(markups.map(m=>types.includes(m.type)?{...m,visible:allVisible?false:true}:m))});
    },
    onStopPlacing:()=>{dispatch({type:"SET",payload:{placingMode:false,placingQueue:[],placingIdx:0}});},
    onPausePlacing:()=>dispatch({type:"SET",payload:{placingMode:false}}),
    onResumePlacing:()=>dispatch({type:"SET",payload:{placingMode:true}}),
    onClear:()=>{pushUndo();updSession({markups:[]})},
    onAddPoint:()=>{dispatch({type:"SET",payload:{activeTool:"point",currentDraw:null}});},
    onReplace:(type,id)=>{if(replacingId===id){dispatch({type:"SET",payload:{replacingId:null,activeTool:"select"}});}else{dispatch({type:"SET",payload:{replacingId:id,activeTool:type}});}dispatch({type:"SET",payload:{currentDraw:null}});},
  };
  const pSessions={project,t,onUpdateProject,activeSession,compareSession,setCompareSession,
    showDisplacement,setShowDisplacement,
    displacementOverlay,setDisplacementOverlay,
    refLandmark1,setRefLandmark1,refLandmark2,setRefLandmark2,
    overlayBlend,setOverlayBlend,overlayAlignMode,setOverlayAlignMode,
    overlayVectorScale,setOverlayVectorScale,
    showTrackingLines,setShowTrackingLines,
    showAirwayOverlay,setShowAirwayOverlay,
    calibration,formatAngle,
    setActiveSession:id=>onUpdateProject({...project,activeSessionId:id}),
    onExportTemplate:v=>exportCepht({name:`${project.name}`,projection:project.projection,markups:v.markups||[],formulas:v.formulas||[],norms:v.norms||[]}),
  };

  return(
    <div style={{height:"100vh",display:"flex",flexDirection:"column",background:t.bg,color:t.tx,fontFamily:"'DM Sans',sans-serif",overflow:"hidden"}}>
      {/* hidden file inputs */}
      <input ref={openImgRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{if(e.target.files[0])loadImage(e.target.files[0]);e.target.value="";}}/>
      <input ref={stackImgRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{if(e.target.files[0])loadImage(e.target.files[0],true);e.target.value="";}}/>
      <input ref={importRef} type="file" accept=".cephx" style={{display:"none"}} onChange={e=>{if(e.target.files[0])onImport(e.target.files[0]);e.target.value="";}}/>

      {/* TOP BAR */}
      <TopBar t={t} theme={theme} project={project} isMobile={isMobile} onHome={onHome}
        compareSession={compareSession} showAnnotations={showAnnotations} annotationSize={annotationSize}
        showDisplacement={showDisplacement} onSave={onSave}
        openImgRef={openImgRef} importRef={importRef} dispatch={dispatch} calibration={calibration}
        snapEnabled={snapEnabled} showScaleBar={showScaleBar} showDefTooltips={showDefTooltips}
        placingMode={placingMode} placingQueue={placingQueue} placingIdx={placingIdx}
        showMobilePanel={showMobilePanel} setShowMobilePanel={setShowMobilePanel}
        imgRefs={imgRefs} setTheme={setTheme}
      />

      {/* BODY */}
      <div style={{flex:1,display:"flex",overflow:"hidden",position:"relative"}}>
        {/* TOOL SIDEBAR */}
        {!isMobile&&<Toolbar activeTool={activeTool} theme={theme} t={t} dispatch={dispatch}
          setActiveTool={setActiveTool} sessionImage={sessionImage} calibration={calibration}
          zoom={zoom} spotlightMode={spotlightMode} updSession={updSession}
          isMobile={isMobile} showMobilePanel={showMobilePanel}
          panRef={panRef} undo={undo} redo={redo} undoVersion={undoVersion}
          undoStackRef={undoStackRef} redoStackRef={redoStackRef}
          handleDblClick={handleDblClick} currentDraw={currentDraw}
          mobileToolsExpanded={mobileToolsExpanded}
        />}

        {/* TOOL SIDEBAR — mobile */}
        {isMobile&&!showMobilePanel&&<Toolbar activeTool={activeTool} theme={theme} t={t} dispatch={dispatch}
          setActiveTool={setActiveTool} sessionImage={sessionImage} calibration={calibration}
          zoom={zoom} spotlightMode={spotlightMode} updSession={updSession}
          isMobile={isMobile} showMobilePanel={showMobilePanel}
          panRef={panRef} undo={undo} redo={redo} undoVersion={undoVersion}
          undoStackRef={undoStackRef} redoStackRef={redoStackRef}
          handleDblClick={handleDblClick} currentDraw={currentDraw}
          mobileToolsExpanded={mobileToolsExpanded}
        />}

        {/* CANVAS */}
        <div ref={containerRef} style={{flex:1,position:"relative",overflow:"hidden",background:t.bg,paddingBottom:isMobile&&!showMobilePanel?52:0}} onDrop={handleDrop} onDragOver={e=>e.preventDefault()}>
          <canvas ref={canvasRef} style={{display:"block",cursor:cursorStyle,touchAction:"none",background:"transparent"}}
            onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
            onAuxClick={e=>e.preventDefault()} onDoubleClick={handleDblClick} onContextMenu={handleCanvasContextMenu}/>
          {loadingImages&&<div role="status" aria-live="polite" style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:t.bg+"cc",zIndex:10}}>
            <div style={{textAlign:"center"}}><div style={{width:28,height:28,border:`3px solid ${t.bdr}`,borderTopColor:t.acc,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 10px"}}/><div style={{fontSize:13,color:t.tx2}}>Loading images…</div></div>
          </div>}
          {/* A5: Placing-mode card — floating React panel (was canvas-drawn) */}
          {placingMode&&placingQueue.length>0&&placingIdx<placingQueue.length&&(markups.find(x=>x.id===placingQueue[placingIdx]))&&(()=>{
            const m=markups.find(x=>x.id===placingQueue[placingIdx]);
            const defText=m.definition||"No definition available";
            return(
              <div role="status" aria-label={`Place ${m.label}: ${defText}`} style={{position:"absolute",bottom:20,left:"50%",transform:"translateX(-50%)",width:"min(520px,calc(100% - 32px))",background:t.surf,borderRadius:10,boxShadow:`0 4px 16px rgba(0,0,0,0.5)`,overflow:"hidden",zIndex:8}}>
                <div style={{height:4,background:t.acc,borderRadius:"10px 10px 0 0"}}/>
                <div style={{padding:"12px 16px 10px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <span style={{fontWeight:"bold",fontSize:15,color:t.tx,fontFamily:"'DM Sans',sans-serif"}}>{m.label}</span>
                    <span style={{fontSize:11,color:t.tx3,fontFamily:"'DM Sans',sans-serif"}}>{placingIdx+1}/{placingQueue.length}</span>
                  </div>
                  <div style={{fontSize:13,color:t.tx2,fontFamily:"'DM Sans',sans-serif",marginBottom:8,lineHeight:1.4}}>{defText}</div>
                  <div style={{display:"flex",gap:16,fontSize:10,color:t.tx3,fontFamily:"'DM Mono',monospace"}}>
                    <span>Click to place</span><span>Esc skip</span><span>Backspace back</span>
                  </div>
                </div>
              </div>
            );
          })()}
          {!isMobile&&<div style={{position:"absolute",bottom:34,left:30,display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            {/* F1: coordinates now drawn on canvas in redraw() — no DOM element needed */}
            {currentDraw&&<div style={{background:t.acc+"22",border:`1px solid ${t.acc}`,borderRadius:6,padding:"3px 10px",fontSize:11,color:t.acc,fontFamily:"'DM Mono',monospace"}}>
              {["polygon","curve","bezier"].includes(activeTool)?`${currentDraw.points.length} pts · ${isMobile?"double-tap to finish":"dbl-click to finish"}`:activeTool==="tangent"?`${currentDraw.points.length===1?(currentDraw.tangentAngle!=null?"tangent snapped · click for endpoint":"click 2nd point"):""}`:(()=>{const n={line:2,angle3:3,angle4:4,perp:3,ruler:2,ellipse:3,arc:3,circle:2,tangent:2,concentric:3}[activeTool];return n?`${currentDraw.points.length}/${n}`:`${currentDraw.points.length} pts`;})()}
            </div>}
          </div>}
          {/* Floating session filmstrip at bottom — collapsible to the left (desktop only) */}
          {!isMobile&&(filmstripOpen ? (
            <div style={{position:"absolute",bottom:8,left:"50%",transform:"translateX(-50%)",zIndex:5,borderRadius:8,background:t.surf+"ee",border:`1px solid ${t.bdr}`,boxShadow:`0 2px 12px ${t.shadow}44`,backdropFilter:"blur(6px)",display:"flex",alignItems:"stretch",overflow:"hidden"}}>
              <SessionFilmstrip project={project} t={t} onUpdateProject={onUpdateProject}/>
              <button onClick={()=>setFilmstripOpen(false)} title="Collapse filmstrip"
                style={{background:"none",border:"none",borderLeft:`1px solid ${t.bdr}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:"0 6px",color:t.tx3,fontSize:10,flexShrink:0,transition:"color 0.15s"}}
                onMouseEnter={e=>e.currentTarget.style.color=t.tx} onMouseLeave={e=>e.currentTarget.style.color=t.tx3}>◀</button>
            </div>
          ) : (
            <button onClick={()=>setFilmstripOpen(true)} title="Show filmstrip"
              style={{position:"absolute",left:8,bottom:8,zIndex:5,background:t.surf+"ee",border:`1px solid ${t.bdr}`,borderRadius:6,boxShadow:`0 2px 12px ${t.shadow}44`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:"8px 4px",color:t.tx3,fontSize:10,backdropFilter:"blur(6px)",transition:"color 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.color=t.tx} onMouseLeave={e=>e.currentTarget.style.color=t.tx3}>▶</button>
          ))}
        </div>

        {/* RIGHT PANEL — VSCode-style vertical tabs on left */}
        {(!isMobile||(isMobile&&showMobilePanel))&&(
          <div ref={panelRef} style={{...(isMobile?{position:"fixed",top:42,right:0,bottom:52,width:"85vw",maxWidth:300,zIndex:15,boxShadow:`-4px 0 20px ${t.shadow}`}:{width:rightPanelWidth,flexShrink:0}),background:t.surf,display:"flex",flexDirection:"row",userSelect:rightPanelResizing?"none":"auto",cursor:rightPanelResizing?"col-resize":"auto",transition:"width 0.25s ease"}}>
            <RightPanelSidebar t={t} rightPanel={rightPanel} setRightPanel={setRightPanel}
              panelTabs={panelTabs} toggleBtnRef={toggleBtnRef} toggleCollapsed={toggleCollapsed}
              isMobile={isMobile} showMobilePanel={showMobilePanel} />
              {/* Panel content — scrollbar hidden but scrollable */}
            <div ref={contentRef} style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0,maxWidth:800,opacity:1,transition:"max-width 0.25s ease, opacity 0.2s ease"}}>
              <PanelContent rightPanel={rightPanel} panelIcons={panelIcons} panelTabs={panelTabs} t={t}
                pMarkups={pMarkups} pSessions={pSessions}
                allMeas={allMeas} formulaMeas={formulaMeas} calibration={calibration} norms={norms} formatAngle={formatAngle}
                exportCSV={exportCSV} userPresets={userPresets} handleSavePreset={handleSavePreset} handleDeletePreset={handleDeletePreset}
                updSession={updSession} dispatch={dispatch}
                formulas={formulas} measScope={measScope} pinnedFormulas={pinnedFormulas} setPinnedFormulas={setPinnedFormulas}
                processing={processing} lutMode={lutMode} lutInvert={lutInvert} showLUT={showLUT} setShowLUT={setShowLUT} showScaleBar={showScaleBar} setShowScaleBar={setShowScaleBar} showHistogram={showHistogram} setShowHistogram={setShowHistogram}
                sessionImage={sessionImage} stackImgRef={stackImgRef}
                project={project} onUpdateProject={onUpdateProject}
                markups={markups} loadAirwayTier={loadAirwayTier} showAirwayOverlay={showAirwayOverlay} setShowAirwayOverlay={setShowAirwayOverlay}
                loadTemplate={loadTemplate} patientSex={patientSex} patientAge={patientAge} canvasRef={canvasRef}
                canvasSize={canvasSize} toImage={toImage} addMarkup={addMarkup} pushUndo={pushUndo}
              />
            {selectedMarkup&&<div style={{borderTop:`1px solid ${t.bdr}`,padding:12,flexShrink:0,maxHeight:isMobile?180:260,overflowY:"auto",scrollbarWidth:"none"}}>
                <MarkupProps m={selectedMarkup} t={t} theme={theme} onUpdate={p=>updMarkup(selectedMarkup.id,p)} onDelete={()=>delMarkup(selectedMarkup.id)} calibration={calibration} onParallel={()=>dispatch({type:"SET",payload:{activeTool:"parallel"}})} formatAngle={formatAngle} norms={norms} onUpdateNorms={ns=>updSession({norms:ns})}/>
              </div>}
            </div>
            {/* Resize handle */}
            <div onMouseDown={()=>dispatch({type:"SET",payload:{rightPanelResizing:true}})} style={{width:4,cursor:"col-resize",background: rightPanelResizing ? t.acc : "transparent",transition:"background 0.15s",flexShrink:0}}/>
          </div>
        )}
      </div>

      {/* RIGHT-CLICK CONTEXT MENU */}
      {contextMenu&&(()=>{
        const mId=contextMenu.markupId;const m=mId?markups.find(x=>x.id===mId):null;
        const close=()=>setContextMenu(null);
        const sel=selectedIds.length>1?selectedIds:[];
        const dup=()=>{if(!m)return;const pts=m.points?.map(p=>({x:p.x+15,y:p.y+15}));const dupe={...m,id:uid(),label:`${m.label||m.type} (copy)`,points:pts};if(m.type==="bezier"){const cp=m.cp?m.cp.map(p=>({x:p.x+15,y:p.y+15})):autoControlPoints(pts);dupe.cp=cp;}addMarkup(dupe);close();};
        const copyMeas=()=>{if(!m)return;const meas=computeMeasurements(m,calibration);const txt=Object.entries(meas).filter(([k])=>!k.startsWith("_")&&k!=="x"&&k!=="y").map(([k,v])=>`${m.label||m.type} ${k}: ${k==="angle"?v.toFixed(1)+"°":v.toFixed(2)+(k==="area"?(calibration.done?" mm²":" px²"):(calibration.done?" mm":" px"))}`).join("\n");if(txt)navigator.clipboard.writeText(txt);close();};
        const copyMarkup=()=>{if(!m)return;copiedMarkupRef.current=JSON.stringify(m);close();};
        const pasteMarkup=(setPos)=>{const raw=copiedMarkupRef.current;if(!raw)return;try{const src=JSON.parse(raw);const imgPt=setPos||{x:contextMenu.imageX||0,y:contextMenu.imageY||0};const pts=src.points?.map(p=>({x:p.x+imgPt.x-(src.points?.[0]?.x||0),y:p.y+imgPt.y-(src.points?.[0]?.y||0)}));const dupe={...src,id:uid(),label:`${src.label||src.type} (pasted)`,points:pts};if(src.type==="bezier"&&src.cp)dupe.cp=src.cp.map(p=>({x:p.x+imgPt.x-(src.points?.[0]?.x||0),y:p.y+imgPt.y-(src.points?.[0]?.y||0)}));addMarkup(dupe);close();}catch{/*silent*/};};
        const toFront=()=>{if(!m)return;updMarkups(ms=>{const idx=ms.findIndex(x=>x.id===mId);if(idx<0||idx===ms.length-1)return ms;const cp=[...ms];cp.splice(idx,1);cp.push(m);return cp;});close();};
        const toBack=()=>{if(!m)return;updMarkups(ms=>{const idx=ms.findIndex(x=>x.id===mId);if(idx<0||idx===0)return ms;const cp=[...ms];cp.splice(idx,1);cp.unshift(m);return cp;});close();};
        const groupSel=()=>{if(sel.length<2)return;const gid=uid();updMarkups(ms=>ms.map(x=>sel.includes(x.id)?{...x,groupId:gid}:x));close();};
        const ungroupSel=()=>{const ids=m&&m.groupId?[...sel,mId]:sel;if(!ids.length)return;updMarkups(ms=>ms.map(x=>ids.includes(x.id)?{...x,groupId:void 0}:x));close();};
        const pivotY=Math.min(contextMenu.y,window.innerHeight-320);
        const item=(label,onClick,danger)=>(
          <div role="menuitem" tabIndex={0} onClick={onClick} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onClick();}}} style={{padding:"6px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,color:danger?t.err:t.tx,fontSize:12,transition:"background 0.1s",whiteSpace:"nowrap"}}
            onMouseEnter={e=>e.currentTarget.style.background=t.surf2} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{label}</div>
        );
        const sep=<div style={{borderTop:`1px solid ${t.bdr}`,margin:"4px 0"}}/>;
        return <div data-cmenu="1" role="menu" style={{position:"fixed",left:Math.min(contextMenu.x,window.innerWidth-200),top:pivotY,zIndex:1000,background:t.surf,border:`1px solid ${t.bdr}`,borderRadius:8,boxShadow:`0 4px 20px ${t.shadow}88`,padding:"4px 0",minWidth:170,fontSize:12,color:t.tx}}>
          {m ? <>
            <div style={{padding:"6px 14px",fontSize:10,color:t.tx3,textTransform:"uppercase",letterSpacing:0.5,borderBottom:`1px solid ${t.bdr}`,fontWeight:600}}>{m.label||m.type}</div>
            {item("Focus",()=>{selectAndFocusMarkup(mId);close()})}
            {item("Rename",()=>{const n=window.prompt("Rename markup:",m.label);if(n&&n.trim())updMarkup(mId,{label:n.trim()});close()})}
            {item("Change Color",()=>{const ci=document.createElement('input');ci.type='color';ci.value=m.color||t.acc;ci.style.position='fixed';ci.style.opacity='0';ci.style.pointerEvents='none';document.body.appendChild(ci);ci.addEventListener('input',()=>updMarkup(mId,{color:ci.value}));ci.addEventListener('change',()=>{document.body.removeChild(ci)});close();ci.click()})}
            {sep}
            {item("Duplicate",dup)}
            {item("Copy",copyMarkup)}
            {copiedMarkupRef.current?item("Paste",pasteMarkup):null}
            {sep}
            {item(m.visible===false?"Show":"Hide",()=>{updMarkup(mId,{visible:m.visible===false});close()})}
            {item(m.locked?"Unlock":"Lock",()=>{updMarkup(mId,{locked:!m.locked});close()})}
            {sep}
            {item(refLandmark1===m.label?"✓ Ref Landmark 1":"Ref Landmark 1",()=>{setRefLandmark1(m.label===refLandmark1?null:m.label);close()})}
            {item(refLandmark2===m.label?"✓ Ref Landmark 2":"Ref Landmark 2",()=>{setRefLandmark2(m.label===refLandmark2?null:m.label);close()})}
            {item("Copy Measurement",copyMeas)}
            {sep}
            {item("Move to Front",toFront)}
            {item("Send to Back",toBack)}
            {sep}
            {m.groupId?item("Ungroup",ungroupSel):null}
            {sel.length>1?item("Group",groupSel):null}
            {item("Delete",()=>{delMarkup(mId);close()},true)}
          </> : <>
            <div style={{padding:"6px 14px",fontSize:10,color:t.tx3,textTransform:"uppercase",letterSpacing:0.5,fontWeight:600}}>Canvas</div>
            {copiedMarkupRef.current?item("Paste",()=>pasteMarkup({x:contextMenu.imageX||0,y:contextMenu.imageY||0})):null}
            {item("Select All",()=>{const all=markups.map(x=>x.id);dispatch({type:"SET",payload:{selectedIds:all,selectedId:all.length===1?all[0]:null}});close()})}
            {item("Calibrate ⟺",()=>{dispatch({type:"SET",payload:{showCalib:true}});close()})}
            {item("Fit to View ⊙",()=>{dispatch({type:"SET",payload:{zoom:1}});panRef.current={x:40,y:40};dispatch({type:"SET",payload:{pan:{x:40,y:40}}});close()})}
            {sep}
            {item(showGrid?"Grid: On ✓":"Grid: Off",()=>{setShowGrid(v=>!v);close()})}
          </>}
        </div>;
      })()}

      {/* MODALS */}
      {showCalib&&<Modal t={t} title="Calibration" onClose={()=>dispatch({type:"SET",payload:{showCalib:false}})}><CalibModal t={t} calibration={calibration} onFinish={finalizeCalib} rulerLabel={pendingRuler?.label||null} rulerCount={markups.filter(m=>m.type==="ruler").length}/></Modal>}
      {showExport&&<Modal t={t} title="Export" onClose={()=>dispatch({type:"SET",payload:{showExport:false}})}><div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"flex",justifyContent:"flex-end"}}><button onClick={()=>setGuideKey("export")}
          style={{background:"none",border:`1px solid ${t.tx3}55`,color:t.tx3,borderRadius:10,width:18,height:18,fontSize:10,lineHeight:"16px",textAlign:"center",cursor:"pointer",padding:0}} title="Guide">?</button></div>
        <Btn t={t} onClick={()=>{exportCSV();dispatch({type:"SET",payload:{showExport:false}});}}>Measurements CSV</Btn>
        <Btn t={t} onClick={async()=>{const anon=await anonymizeProject(project,{reason:"export"});onSave?.(anon);dispatch({type:"SET",payload:{showExport:false}});}}>Anonymized .cephx (recommended)</Btn>
        <Btn t={t} danger={hasUnanonymizedPHI(project)} onClick={()=>{if(hasUnanonymizedPHI(project)&&!window.confirm("This project still contains patient identifiers (name, DOB, age, etc.). Exporting a FULL project file will include them. Continue? Consider exporting an Anonymized .cephx instead."))return;onSave?.(project);dispatch({type:"SET",payload:{showExport:false}});}}>{hasUnanonymizedPHI(project)?"⚠ Full Project .cephx (contains PHI)":"Full Project .cephx"}</Btn>
        <Btn t={t} onClick={()=>{setReportSections({...defaultSections});setShowReportOptions(true);}}>PDF Report</Btn>
        <Btn t={t} onClick={()=>{const name=window.prompt("Template name:",project.name);if(name){exportTemplateAsCepht(project,name);dispatch({type:"SET",payload:{showExport:false}});}}}>Template .cepht (definitions only)</Btn>
        <Btn t={t} onClick={()=>{const name=window.prompt("Template name:",project.name+" (placed)");if(name){exportTemplateAsCepht(project,name,true);dispatch({type:"SET",payload:{showExport:false}});}}}>Template .cepht (with placements)</Btn>
        <Btn t={t} ghost onClick={()=>{const p=profileProject(project);alert(`Images: ${p.imgMB}MB\nResearch: ${p.rsMB}MB\nMeta/subjects: ${p.otherMB}MB\nTotal: ${p.grandTotalMB}MB\n(See console for full breakdown)`);}}>Check Size</Btn>
      </div></Modal>}
      {showReportOptions&&<Modal t={t} title="PDF Report Options" onClose={()=>setShowReportOptions(false)}>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <div style={{fontSize:11,color:t.tx2,marginBottom:4}}>Select sections to include in the report:</div>
          {[
            ["cover","Cover Page"],["images","Original & Marked-up Images"],
            ["measurements","Measurements Table"],["normograms","Normogram Charts"],
            ["research","Research Studies"],["formulas","Custom Formulas"],
            ["interpretation","Clinical Interpretation"],
          ].map(([key,label])=>(
            <div key={key} style={{display:"flex",alignItems:"center",gap:10}}>
              <button onClick={()=>setReportSections(s=>({...s,[key]:!s[key]}))} style={{width:20,height:20,borderRadius:4,border:`1px solid ${reportSections[key]?t.acc:t.bdr}`,background:reportSections[key]?t.acc+"22":"transparent",color:reportSections[key]?t.acc:t.tx3,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}}>
                {reportSections[key]&&<span>✓</span>}
              </button>
              <span style={{fontSize:13,color:t.tx,userSelect:"none",cursor:"pointer"}} onClick={()=>setReportSections(s=>({...s,[key]:!s[key]}))}>{label}</span>
            </div>
          ))}
          <div style={{borderTop:`1px solid ${t.bdr}`,marginTop:10,paddingTop:12,display:"flex",gap:10}}>
            <Btn t={t} onClick={async ()=>{setShowReportOptions(false);
              if(hasUnanonymizedPHI(project)&&!window.confirm("This project contains patient identifiers (name, DOB, etc.). The PDF report will include them on the cover. This software is intended for research and educational purposes only. Continue?")){setShowReportOptions(true);return;}
              try {
                const imgEl = sessionImage?.[0] ? imgRefs.current[sessionImage[0].id] : null;
                const origUrl = imgEl ? imgEl.src : null;
                const markupUrl = await captureMarkupImage();
                const interp = generateInterpretation(allMeas, norms);
                const fv = {}; formulas.forEach(f => { const v = evalFormula(f.expression, measScope); if (v !== null) fv[f.id] = v; });
                await generateReport({ project, session: activeSession, allMeas, norms, formulas, formulaValues: fv, originalImageDataUrl: origUrl, markupImageDataUrl: markupUrl, interpretation: interp, sections: reportSections });
              } catch (e) { logError("PDF generation failed:", e); }
            }} style={{flex:1}}>Generate PDF</Btn>
            <Btn t={t} onClick={()=>setShowReportOptions(false)} style={{flex:1}} ghost>Cancel</Btn>
          </div>
        </div>
      </Modal>}
      {pendingTextPos&&<Modal t={t} title="Text Annotation" onClose={()=>dispatch({type:"SET",payload:{pendingTextPos:null}})}><TextModal t={t} defaultColor="#fbbf24" onConfirm={(txt,opts)=>{addMarkup({type:"text",points:[pendingTextPos],text:txt,...opts});dispatch({type:"SET",payload:{pendingTextPos:null}});}} onCancel={()=>dispatch({type:"SET",payload:{pendingTextPos:null}})}/></Modal>}
      {showAnon&&<Modal t={t} title="Anonymization" onClose={()=>dispatch({type:"SET",payload:{showAnon:false}})}><AnonModal t={t} project={project} onUpdateProject={onUpdateProject} onClose={()=>dispatch({type:"SET",payload:{showAnon:false}})}/></Modal>}
      {showNormogram&&<Modal t={t} title="Cephalometric Normogram" wide onClose={()=>dispatch({type:"SET",payload:{showNormogram:false}})}><NormogramPanel allMeas={allMeas} norms={norms} t={t} formatAngle={formatAngle}/></Modal>}

      {showFormulaEditor&&<Modal t={t} title={editFormulaId?"Edit Formula":"New Formula"} onClose={()=>dispatch({type:"SET",payload:{showFormulaEditor:false}})}><FormulaEditor t={t} formula={editFormulaId?formulas.find(f=>f.id===editFormulaId):null} scope={measScope} onSave={f=>{const newFs=editFormulaId?formulas.map(x=>x.id===editFormulaId?f:x):[...formulas,f];updSession({formulas:newFs});dispatch({type:"SET",payload:{showFormulaEditor:false}});}} onClose={()=>dispatch({type:"SET",payload:{showFormulaEditor:false}})}/></Modal>}
      {showHistogram&&<FloatingHistogram hist={histData} t={t} lutMode={lutMode} lutInvert={lutInvert} processing={processing} onProcessingChange={p=>updSession({processing:p})} onClose={()=>dispatch({type:"SET",payload:{showHistogram:false}})}/>}
      {guideKey&&<PanelGuideModal t={t} guideKey={guideKey} onClose={()=>setGuideKey(null)}/>}
      <div style={{position:"relative",bottom:0,left:0,right:0,zIndex:999,background:t.surf,borderTop:`1px solid ${t.surf}`,padding:"3px 12px",display:"flex",justifyContent:"center",alignItems:"center",gap:8,fontSize:9,color:t.tx3}}>
        <span style={{fontWeight:700,fontSize:8,color:t.warn,letterSpacing:0.5}}>⚠ RESEARCH & EDUCATIONAL USE ONLY</span>
        <span>Not cleared for clinical diagnosis. Clinical decisions should not rely solely on these measurements.</span>
      </div>
    </div>
  );
}





// ═══════════════════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════════════════
const STORAGE_KEY = "cephalometry_projects";

// Async load with legacy-plaintext migration. Old autosaves were a bare
// JSON array in localStorage; new autosaves are an {enc, iv, ct} (or fallback
// {enc:false, plaintext}) envelope. Both shapes are handled so existing users
// don't lose their projects on upgrade. Sessions are normalized to the
// canonical `session.images[]` shape here too (D4) and the referenced image-id
// baseline is captured for orphan GC (D2).
let _knownImageIds = new Set();

function collectReferencedImageIds(projects) {
  const ids = new Set();
  for (const p of projects) {
    for (const s of p.sessions || []) {
      for (const img of s.images || []) {
        if (img && img.id) ids.add(img.id);
      }
    }
  }
  return ids;
}

async function loadProjects() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) { logError("loadProjects/parse", e); return []; }
    let projects = null;
    if (Array.isArray(parsed)) projects = parsed; // legacy plaintext projects array
    else if (parsed && typeof parsed === "object") {
      projects = await decryptJSON(parsed);
      // P7: key-loss detection — if the envelope was encrypted but decrypt returned null
      if (!projects && parsed.enc === true) {
        emitStorageWarning("key-loss", "Your saved data could not be decrypted. The encryption key may have been lost (cleared IndexedDB). If you have a backup file (.cephx), import it to restore your projects.");
      }
    }
    if (!projects) return [];
    // Normalize legacy session.image → session.images[] on load so the GC
    // baseline (and the rest of the app) sees the canonical shape.
    projects = projects.map(p => ({
      ...p,
      sessions: (p.sessions || []).map(s => normalizeSessionImages(s)),
    }));
    _knownImageIds = collectReferencedImageIds(projects);
    return projects;
  } catch (e) {
    logWarn("Failed to load projects from storage:", e);
    return [];
  }
}

// Serialize concurrent saves so rapid project edits can't write envelopes out
// of order (encryption is async). The last call always wins.
let _saveChain = Promise.resolve();
let _idbQuotaWarned = false;

// Surface a storage problem to the UI via a decoupled custom event (D3). The
// root component listens and renders a dismissible banner; saveProjects stays
// outside React so it can't call setState directly.
function emitStorageWarning(kind, message) {
  try {
    window.dispatchEvent(new CustomEvent("cephalostudio:storage-warning", { detail: { kind, message } }));
  } catch { /* best-effort */ }
}

function saveProjects(projects) {
  _saveChain = _saveChain.then(async () => {
    try {
      // 1. Gather images that carry an in-memory dataUrl (just loaded/imported)
      //    and need persisting to IDB before they're stripped from localStorage.
      const toStore = [];
      for (const p of projects) {
        for (const s of p.sessions || []) {
          for (const img of s.images || []) {
            if (img && img.dataUrl) toStore.push({ id: img.id, dataUrl: img.dataUrl });
          }
        }
      }

      // 2. D1: persist to IDB FIRST and await the result. Only strip the dataUrl
      //    from the localStorage payload for images whose blob was actually
      //    stored. Failed / unavailable images keep their dataUrl in localStorage
      //    so the radiograph isn't lost (localStorage may hit quota, but silent
      //    image loss in a medical app is worse). Previously the order was
      //    reversed — localStorage was written with dataUrl:null BEFORE a
      //    fire-and-forget IDB write whose .catch(()=>{}) swallowed failures, so
      //    a failed/aborted IDB write permanently lost the image.
      const failedIds = new Set();
      let hadIdbQuota = false;
      let hadIdbUnavailable = false;
      if (toStore.length > 0) {
        const results = await Promise.all(
          toStore.map(({ id, dataUrl }) => storeImageBlob(id, dataUrl))
        );
        results.forEach((r, i) => {
          if (!r || !r.ok) {
            failedIds.add(toStore[i].id);
            if (r && r.error === "quota") hadIdbQuota = true;
            if (r && r.error === "unavailable") hadIdbUnavailable = true;
          }
        });
      }
      if (hadIdbQuota && !_idbQuotaWarned) {
        _idbQuotaWarned = true;
        emitStorageWarning("idb-quota", "Image storage is full. Some new images could not be saved locally — export your project as .cephx to keep them, then clear local data.");
      }
      if (hadIdbUnavailable && !idbAvailable()) {
        emitStorageWarning("idb-unavailable", "Image storage is unavailable in this browser/session (e.g. private mode). Images won't persist across sessions — export your work as .cephx to keep it.");
      }

      // 3. Build the stripped payload: null dataUrl for stored images, keep
      //    dataUrl for the failures so they survive in the (encrypted) envelope.
      const stripped = projects.map(p => ({
        ...p,
        sessions: p.sessions?.map(s => ({
          ...s,
          images: s.images?.map(img => ({
            ...img,
            dataUrl: (img && failedIds.has(img.id)) ? img.dataUrl : null,
          }))
        }))
      }));

      // 4. D2: garbage-collect orphaned blobs — sessions/images/projects that
      //    were removed since the last save. Diff against the known-id baseline
      //    (cheap); on a cold baseline this falls back to a full IDB scan.
      const referencedIds = collectReferencedImageIds(projects);
      try {
        await deleteOrphanBlobs(referencedIds, _knownImageIds);
      } catch (e) {
        logWarn("Orphan blob GC failed:", e);
      }
      _knownImageIds = referencedIds;

      // 5. Write the encrypted envelope to localStorage.
      const envelope = await encryptJSON(stripped);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    } catch (e) {
      if (e && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED")) {
        emitStorageWarning("ls-quota", "Local storage is full. Your projects could not be saved. Export your project files (.cephx) to preserve your data, then clear browser storage or remove unused projects.");
      } else {
        logWarn("Failed to save projects:", e);
      }
    }
  });
  return _saveChain;
}

// Wipe ALL local data: encrypted autosave, the encryption key store, and the
// image blob IDB. Called only from the explicit "Clear all local data" action.
async function clearAllLocalData() {
  await clearSecureStorage(STORAGE_KEY);
  await clearImageBlobs();
  // Reset the orphan-GC baseline so a subsequent save doesn't try to diff
  // against ids that no longer exist (D2), and re-arm the quota warning.
  _knownImageIds = new Set();
  _idbQuotaWarned = false;
}

export default function CephalometryStudio(){
  const[theme,setTheme]=useState("bluish");const t=useMemo(()=>({...THEMES[theme],id:theme}),[theme]);
  // Start empty and async-load the encrypted autosave so the PHI blob is never
  // held in plaintext localStorage. `loaded` guards the save effect so the
  // initial empty state can't clobber the just-decrypted projects.
  const[projects,setProjects]=useState([]);const[activeId,setActiveId]=useState(null);
  const[loaded,setLoaded]=useState(false);
  const dirtyRef=useRef(false);
  // D3: surface IDB-unavailable / storage-quota failures as a dismissible banner
  // instead of silently degrading (incognito mode, full storage). The autosave
  // emits `cephalostudio:storage-warning` events; this listens + seeds the
  // persistent "IDB unavailable" warning on mount.
  const[storageWarn,setStorageWarn]=useState(null);

  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      const lp=await loadProjects();
      if(cancelled)return;
      // P6: data-retention purge — remove projects older than 90 days unless they have an audit log
      const retentionDays = 90;
      const cutoff = Date.now() - retentionDays * 86400000;
      const withRetention = lp.filter(p => (p.modified || 0) > cutoff || (p.meta?.anonymizationLog?.length || 0) > 0);
      if (withRetention.length < lp.length) {
        const purged = lp.length - withRetention.length;
        logWarn(`Retention: purged ${purged} project(s) older than ${retentionDays} days.`);
      }
      setProjects(withRetention);
      setActiveId(withRetention.length>0?withRetention[0].id:null);
      setLoaded(true);
    })();
    return ()=>{cancelled=true;};
  },[]);

  useEffect(()=>{
    if(!idbAvailable()){
      setStorageWarn({kind:"idb-unavailable",message:"Image storage is unavailable in this browser/session (e.g. private mode). Images won't persist across sessions — export your work as .cephx to keep it."}); // eslint-disable-line react-hooks/set-state-in-effect
    }
    const onWarn=e=>setStorageWarn((e&&e.detail)||null);
    window.addEventListener("cephalostudio:storage-warning",onWarn);
    return ()=>window.removeEventListener("cephalostudio:storage-warning",onWarn);
  },[]);

  // W4: debounce autosave so rapid edits don't encrypt-write per tick
  const saveTimerRef=useRef(null);
  const debouncedSave=useCallback(()=>{
    if(saveTimerRef.current)clearTimeout(saveTimerRef.current);
    saveTimerRef.current=setTimeout(()=>{
      saveProjects(projects).then(()=>{dirtyRef.current=false;});
    },800);
  },[projects]);

  useEffect(()=>{if(loaded){dirtyRef.current=true;debouncedSave();}},[projects,loaded,debouncedSave]);

  useEffect(()=>{
    const handler=e=>{if(dirtyRef.current){e.preventDefault();e.returnValue="";}};
    window.addEventListener("beforeunload",handler);
    return ()=>window.removeEventListener("beforeunload",handler);
  },[]);

  const activeProject=projects.find(p=>p.id===activeId);

  const updateProject=(id,patch)=>{dirtyRef.current=true;setProjects(prev=>prev.map(p=>p.id===id?{...p,...patch,modified:Date.now()}:p));};

  const handleClearLocalData=async()=>{
    if(!window.confirm("Clear ALL local data?\n\nThis permanently deletes every project, image, and patient identifier stored in this browser. This cannot be undone. Export any project you want to keep as a .cephx file first."))return;
    await clearAllLocalData();
    dirtyRef.current=false;
    setProjects([]);
    setActiveId(null);
  };

  const createProject=(projection,result)=>{
    const p={...mkProject(projection),name:result.name};
    const session=p.sessions.find(s=>s.id===p.activeSessionId);
    if(result.image)session.images = [{id:uid(),name:"Imported",dataUrl:result.image.dataUrl||result.image,dx:0,dy:0,opacity:1,blendMode:"normal",visible:true,color:"none",transform:{tx:0,ty:0,rot:0,scale:1}}];
    session.calibration=result.calibration||{done:false,pxPerMm:1,knownMm:""};
    if(result.templateType==="analysis"||result.templateType==="complete"){
      const analysis=result.analysis;
      if(analysis){
        session.markups=analysis.pts.map(pt=>({
          id:uid(),type:"point",points:[{x:-99999,y:-99999}],
          label:pt.l,definition:pt.def,color:pt.color,
          size:6,visible:true,placed:false,
        }));
        session.analysisTemplate=analysis.name;
      }
    }else if(result.templateType==="upload"&&result.templateData){
      const d=result.templateData;
      const err=validateCepht(d);if(!err&&d.markups){
        const hasCoords=d.version==="2.0"&&hasPlacedCoords(d.markups);
        session.markups=d.markups.map(m=>{
          const base={...m,id:uid(),definition:m.definition||m.def||"",visible:m.visible!==false};
          if(hasCoords)return{...base,placed:m.placed!==false,points:m.points||[{x:-99999,y:-99999}]};
          return{...base,placed:false,points:[{x:-99999,y:-99999}]};
        });
        if(d.formulas)session.formulas=d.formulas;
        if(d.norms)session.norms=d.norms;
        session.analysisTemplate=d.name||"Imported";
      }
    }
    setProjects(prev=>[...prev,p]);setActiveId(p.id);
  };

  const importCephxFile=(file)=>{
    importCephx(file,proj=>{
      const existing=projects.find(p=>p.id===proj.id);
      if(existing&&!window.confirm("A case with this ID already exists. Overwrite?"))return;
      setProjects(prev=>[...prev.filter(p=>p.id!==proj.id),proj]);setActiveId(proj.id);
    });
  };

  return(
    <ErrorBoundary t={t}>
      <div style={{background:t.bg,minHeight:"100vh"}}>
        {storageWarn&&(
          <div role="alert" aria-live="polite" style={{background:t.warn+"22",borderBottom:`1px solid ${t.warn}`,color:t.tx,fontSize:12,padding:"8px 16px",display:"flex",alignItems:"center",gap:10,zIndex:40}}>
            <span style={{flex:1,lineHeight:1.4}}>⚠ {storageWarn.message}</span>
            <button onClick={()=>setStorageWarn(null)} aria-label="Dismiss warning" style={{background:"none",border:`1px solid ${t.bdr}`,borderRadius:4,color:t.tx2,cursor:"pointer",fontSize:13,padding:"1px 7px",lineHeight:1}}>×</button>
          </div>
        )}
        {!activeId&&!loaded&&<div role="status" aria-live="polite" style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:t.tx3,fontSize:12}}>Loading your projects…</div>}
        {!activeId&&loaded&&<HomePage t={t} theme={theme} setTheme={setTheme} projects={projects} onOpen={id=>setActiveId(id)} onCreate={createProject} onImport={importCephxFile} storageEncrypted={secureStorageAvailable()} onClearLocalData={handleClearLocalData}/>}
        {activeId&&activeProject&&(
          <Workspace key={activeId} project={activeProject}
            onUpdateProject={patch=>updateProject(activeId,patch)}
            onHome={()=>setActiveId(null)} t={t} theme={theme} setTheme={setTheme}
            onSave={proj=>{exportCephx(proj);dirtyRef.current=false;}}
            onImport={importCephxFile}/>
        )}
      </div>
    </ErrorBoundary>
  );
}
