import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from "react";
import { THEMES, TOOLS, PREDEFINED, LUT_PRESETS } from "./constants.js";
import { SILHOUETTES } from "./silhouettes.js";
import { uid, clamp, dist, vpts, computeMeasurements, snapPoint, alignTwoPoints, buildScope, evalFormula, getMissingVars } from "./utils.js";
import { generateInterpretation } from "./interpretation.js";
import { generateReport } from "./reportGenerator.js";
import { processImageToCanvas, computeHistogram, FloatingHistogram } from "./imageUtils.jsx";
import { KatexSpan, LatexFloatingPanel } from "./hooks.jsx";
import { Btn, Tag, Sld, PropRow, Inp } from "./ui.jsx";
import ToolBtn from "./ToolBtn.jsx";
import { drawMarkup, drawInProgress, drawScaleBar, drawLUTLegend, drawSnapIndicator, drawDisplacementVectors, drawAirwayOverlay, hitTest, getSilhouetteHandlesImage } from "./markups.jsx";
import { MarkupsPanel, MeasurementsPanel, FormulasPanel, ImagePanel, LayersPanel, MarkupProps, TemplatesPanel, SilhouettesPanel, ExamplesPanel } from "./panels.jsx";
import { Modal } from "./panels/Modal.jsx";
import HomePage from "./panels/HomePage.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import SessionsPanel from "./panels/SessionsPanel.jsx";
import SessionFilmstrip from "./panels/SessionFilmstrip.jsx";
import AnonModal from "./panels/AnonModal.jsx";
import ResearchPanel from "./research/ResearchPanel.jsx";
import InterpretationPanel from "./panels/InterpretationPanel.jsx";
import NormogramPanel from "./panels/NormogramPanel.jsx";
import { mkProject, updateSessionInProject } from "./model/project.js";
import { storeImageBlob, getImageDataUrl, clearImageBlobs, deleteOrphanBlobs, idbAvailable } from "./storage/imageStore.js";
import { importCephxPayload, validateCepht, CEPHX_FORMAT, CEPHX_VERSION, normalizeSessionImages } from "./storage/cephxFormat.js";
import { encryptJSON, decryptJSON, clearSecureStorage, secureStorageAvailable } from "./storage/secureStorage.js";
import { anonymizeProject, hasUnanonymizedPHI } from "./anonymize.js";
import { logError, logWarn } from "./logger.js";

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
  a.download = `${project.name.replace(/\s+/g, "_")}.cephx`;
  a.click();
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
  const[mm,setMm]=useState(String(calibration.knownMm||"10"));const[ppm,setPpm]=useState(String(calibration.pxPerMm||"1"));const[mode,setMode]=useState("ruler");
  return(
    <div>
      <div style={{display:"flex",gap:6,marginBottom:16}}>{["ruler","manual"].map(m=><Btn key={m} t={t} small active={mode===m} onClick={()=>setMode(m)}>{m==="ruler"?"From Ruler":"Manual px/mm"}</Btn>)}</div>
      {mode==="ruler"?<><div style={{fontSize:13,color:t.tx2,marginBottom:16,lineHeight:1.6}}>Draw a ruler on the image (⟺ key), then enter its real-world length.</div>
        {rulerLabel&&<div style={{fontSize:12,color:t.ok,marginBottom:8}}>Using ruler: <strong>{rulerLabel}</strong></div>}
        {!rulerLabel&&rulerCount>1&&<div style={{fontSize:12,color:t.warn,marginBottom:8}}>⚠ Multiple rulers found — using the first one. Draw a ruler for a specific selection.</div>}
        <PropRow label="Distance (mm)" t={t}><input type="number" value={mm} onChange={e=>setMm(e.target.value)} min="1" style={{background:t.surf2,border:`1px solid ${t.bdr}`,borderRadius:6,padding:"6px 10px",color:t.tx,fontSize:14,width:"100%",fontFamily:"'DM Mono',monospace"}}/></PropRow><Btn t={t} onClick={()=>onFinish(parseFloat(mm))} style={{width:"100%",marginTop:12}}>Set Calibration</Btn></>
      :<><div style={{fontSize:13,color:t.tx2,marginBottom:16}}>Enter px/mm directly (from DICOM metadata).</div>{calibration.done&&<div style={{fontSize:12,color:t.ok,marginBottom:10}}>Current: {calibration.pxPerMm.toFixed(4)} px/mm</div>}<PropRow label="px / mm" t={t}><input type="number" value={ppm} onChange={e=>setPpm(e.target.value)} step="0.001" min="0.001" style={{background:t.surf2,border:`1px solid ${t.bdr}`,borderRadius:6,padding:"6px 10px",color:t.tx,fontSize:14,width:"100%",fontFamily:"'DM Mono',monospace"}}/></PropRow><Btn t={t} onClick={()=>onFinish(parseFloat(mm),parseFloat(ppm))} style={{width:"100%",marginTop:12}}>Apply</Btn></>}
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
  const canvasRef=useRef(null);const containerRef=useRef(null);
  const procCache=useRef(new Map());const imgRefs=useRef({});const rafRef=useRef(null);
  // F1: pointer state lives in refs (not reducer state) so mousemove skips React re-render
  const mousePosRef=useRef(null);const snapPosRef=useRef(null);
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
    setShowLUT,setShowScaleBar,setShowHistogram,setShowDisplacement,setDisplacementOverlay,setRefLandmark1,setRefLandmark2,setOverlayBlend}=useWorkspaceStore();
  const{zoom,selectedId,selectedIds,replacingId,currentDraw,
    activeTool,snapEnabled,showScaleBar,showDefTooltips,
    showLUT,showHistogram,showAnnotations,annotationSize,showDisplacement,rightPanel,showCalib,pendingRuler,
    showExport,showAnon,showNormogram,
    pendingTextPos,showFormulaEditor,editFormulaId,
    placingMode,placingQueue,placingIdx,loadingImages,
    isMobile,showMobilePanel,mobileToolsExpanded,
    toolbarPos,toolbarDragging,rightPanelWidth,rightPanelResizing,
    spotlightMode,
    displacementOverlay,refLandmark1,refLandmark2,overlayBlend}=ui;
  const [compareSession, setCompareSession] = useState(null);
  const [showReportOptions, setShowReportOptions] = useState(false);
  const defaultSections = { cover: true, images: true, measurements: true, normograms: true, research: true, formulas: true, interpretation: true };
  const [reportSections, setReportSections] = useState({ ...defaultSections });
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

  // Migration: legacy session.image -> session.images[]
  useEffect(()=>{
    if(!activeSession)return;
    if(activeSession.images?.length)return;
    const oldImg = activeSession.image || project.images?.[0] || project.sessions?.find(s=>s.image)?.image;
    if(oldImg){
      const entry = oldImg.id ? oldImg : {id:uid(),name:"Imported",dataUrl:oldImg.dataUrl||oldImg,dx:0,dy:0,opacity:1,blendMode:"normal",visible:true,color:"none",transform:{tx:0,ty:0,rot:0,scale:1}};
      onUpdateProject(updateSessionInProject(project,activeSession.id,{images:[entry],image:undefined}));
    }
  },[]); // eslint-disable-line react-hooks/exhaustive-deps

  const isPanning=useRef(false);const panStart=useRef(null);
  const isDragging=useRef(false);const dragStart=useRef(null);const dragStartState=useRef(null);
  const dragMid=useRef(null);const dragPtIdx=useRef(null);
  const multiDragIdsRef=useRef(null);
  const silhouetteAction=useRef(null);const hoveredPtRef=useRef(null);
  const canvasSize=useRef({w:800,h:600});const lastTouchDist=useRef(null);const lastTapRef=useRef(0);
  const undoStackRef=useRef([]);
  const redoStackRef=useRef([]);
  const snapshotRef=useRef();
  const [undoVersion,setUndoVersion]=useState(0);

  const activeSession=project.sessions?.find(s=>s.id===project.activeSessionId)||project.sessions?.[0];
  const markups=useMemo(()=>activeSession?.markups||[],[activeSession?.markups]);
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
  const selectedMarkup=markups.find(m=>m.id===selectedId);

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
  snapshotRef.current=()=>JSON.stringify({markups,norms,placingMode,placingIdx,placingQueue});
  const pushUndoRef=useRef();
  pushUndoRef.current=()=>{
    undoStackRef.current.push(snapshotRef.current());
    if(undoStackRef.current.length>50)undoStackRef.current.shift();
    redoStackRef.current=[];
    setUndoVersion(v=>v+1);
  };
  const pushUndo=useCallback(()=>pushUndoRef.current(),[]);
  undoRef.current=()=>{
    if(undoStackRef.current.length===0)return;
    redoStackRef.current.push(snapshotRef.current());
    if(redoStackRef.current.length>50)redoStackRef.current.shift();
    const prev=undoStackRef.current.pop();
    if(!prev)return;
    const parsed=JSON.parse(prev);
    if(Array.isArray(parsed)){
      updSession({markups:parsed});
    }else{
      updSession({markups:parsed.markups,norms:parsed.norms});
      dispatch({type:"SET",payload:{placingMode:parsed.placingMode,placingIdx:parsed.placingIdx,placingQueue:parsed.placingQueue}});
    }
    setUndoVersion(v=>v+1);
  };
  const undo=useCallback(()=>undoRef.current(),[]);
  redoRef.current=()=>{
    if(redoStackRef.current.length===0)return;
    undoStackRef.current.push(snapshotRef.current());
    if(undoStackRef.current.length>50)undoStackRef.current.shift();
    const next=redoStackRef.current.pop();
    if(!next)return;
    const parsed=JSON.parse(next);
    if(Array.isArray(parsed)){
      updSession({markups:parsed});
    }else{
      updSession({markups:parsed.markups,norms:parsed.norms});
      dispatch({type:"SET",payload:{placingMode:parsed.placingMode,placingIdx:parsed.placingIdx,placingQueue:parsed.placingQueue}});
    }
    setUndoVersion(v=>v+1);
  };
  const redo=useCallback(()=>redoRef.current(),[]);
  const refreshAutoMeasRef=useRef();
  refreshAutoMeasRef.current=(ms)=>{const placed={};const markupMap={};for(const m of ms){if(m.placed&&m.label)placed[m.label]=m;if(m.label)markupMap[m.label]=m;}return ms.map(m=>{if(!m.refLabels||m.refLabels.length===0)return m;if(m.type==="ratio"||m.type==="sum"||m.type==="difference"||m.type==="percentage"){const allRefsExist=m.refLabels.every(rl=>markupMap[rl]);if(!allRefsExist)return m;let nv=0;if(m.type==="ratio"){const v0=getMeasValue(markupMap[m.refLabels[0]]);const v1=getMeasValue(markupMap[m.refLabels[1]]);nv=v1!==0?v0/v1:0;}else if(m.type==="difference"){nv=getMeasValue(markupMap[m.refLabels[0]])-getMeasValue(markupMap[m.refLabels[1]]);}else if(m.type==="percentage"){const v0=getMeasValue(markupMap[m.refLabels[0]]);const v1=getMeasValue(markupMap[m.refLabels[1]]);nv=v1!==0?(v0/v1)*100:0;}else{nv=m.refLabels.reduce((s,rl)=>s+getMeasValue(markupMap[rl]),0);}if(m.computedValue!==nv)return{...m,computedValue:nv};return m;}const allPlaced=m.refLabels.every(rl=>placed[rl]);if(!allPlaced)return m;const np=m.refLabels.map(rl=>placed[rl].points[0]);if(np.some((p,i)=>p.x!==m.points[i]?.x||p.y!==m.points[i]?.y))return{...m,points:np};return m;});};
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
  const addMarkupRef=useRef();
  addMarkupRef.current=partial=>{
    const typeCount=(type)=>markups.filter(m=>m.type===type).length;
    const m={id:uid(),color:t.acc,width:1.5,style:"solid",size:6,label:"",definition:"",showLength:true,strokeColor:t.acc,fillColor:t.acc+"22",strokeWidth:1.5,visible:true,placed:true,...partial};
    if(partial.type==="point")m.label=`P${typeCount("point")+1}`;
    if(partial.type==="line"||partial.type==="parallel")m.label=partial.label||`Line ${typeCount("line")+typeCount("parallel")+1}`;
    if(partial.type==="curve")m.label=partial.label||`Trace ${typeCount("curve")+1}`;
    if(partial.type==="angle3")m.label=partial.label||`Angle ${typeCount("angle3")+1}`;
    if(partial.type==="angle4")m.label=partial.label||`Inc_Angle ${typeCount("angle4")+1}`;
    if(!m.refLabels&&m.type!=="point"&&m.points&&m.points.length>=1&&m.points.every(p=>p.x>-9000)){
      const refs=m.points.map(p=>{for(const src of markups)if(src.type==="point"&&src.label&&src.points?.length&&src.visible!==false&&Math.abs(src.points[0].x-p.x)<0.5&&Math.abs(src.points[0].y-p.y)<0.5)return src.label;return null;});
      if(refs.every(l=>l))m.refLabels=refs;
    }
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
      perp:{color:"#a78bfa",width:1.5,label:`Perp ${markups.filter(m=>m.type==="perp").length+1}`}
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
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext("2d");
    // F2: DPR-aware coordinate space — all drawing in CSS pixels
    const dpr=dprRef.current;
    ctx.save();ctx.scale(dpr,dpr);
    const W=canvas.width/dpr,H=canvas.height/dpr;
    // F1: read hot pointer state from refs (not React state) — avoids re-render on mousemove
    const mousePos=mousePosRef.current;
    const snapPos=snapPosRef.current;
    const boxSelectRect=boxSelectRectRef.current;
    const pan=panRef.current;

    ctx.clearRect(0,0,W,H);
    ctx.fillStyle=t.bg;ctx.fillRect(0,0,W,H);
    
    if(sessionImage.length===0 && markups.length===0){
      ctx.fillStyle=t.surf;ctx.fillRect(pan.x,pan.y,600*zoom,500*zoom);ctx.strokeStyle=t.bdr;ctx.lineWidth=1;ctx.strokeRect(pan.x,pan.y,600*zoom,500*zoom);
      ctx.fillStyle=t.tx3;ctx.font=`15px "DM Sans",sans-serif`;ctx.textAlign="center";ctx.fillText("Drop or open a cephalogram image",pan.x+300*zoom,pan.y+240*zoom);ctx.fillText("Open Image  •  drag & drop",pan.x+300*zoom,pan.y+265*zoom);ctx.textAlign="left";
    } else {
      sessionImage.forEach(imgE=>{
        if(!imgE.visible)return;const src=getProcessed(imgE)||imgRefs.current[imgE.id];if(!src)return;
        const tf=imgE.transform||{tx:0,ty:0,rot:0,scale:1};const nw=src.naturalWidth||src.width||600,nh=src.naturalHeight||src.height||500;
        ctx.save();ctx.globalAlpha=imgE.opacity??1;ctx.globalCompositeOperation=imgE.blendMode||"normal";
        ctx.translate(pan.x+(imgE.dx||0)*zoom,pan.y+(imgE.dy||0)*zoom);
        ctx.translate((nw/2+tf.tx)*zoom,(nh/2+tf.ty)*zoom);ctx.rotate(tf.rot||0);ctx.scale((tf.scale||1)*zoom,(tf.scale||1)*zoom);
        ctx.drawImage(src,-nw/2,-nh/2);
        if(imgE.color&&imgE.color!=="none"){ctx.globalCompositeOperation="color";ctx.fillStyle=imgE.color+"77";ctx.fillRect(-nw/2,-nh/2,nw,nh);}
        ctx.restore();
      });
    }
    const drawMarkups=markups;
    const drawCalibration=calibration;
    // Overlay mode: draw compare version's markups first with reduced opacity
    if(displacementOverlay && compareSession){
      ctx.save();
      ctx.globalAlpha = overlayBlend;
      const compMarkups = compareSession.markups || [];
      // Structural reference alignment
      if(refLandmark1 && refLandmark2){
        const p1a = vpts(markups.find(m => m.type === "point" && m.label === refLandmark1)||{});
        const p1b = vpts(markups.find(m => m.type === "point" && m.label === refLandmark2)||{});
        const p2a = vpts(compMarkups.find(m => m.type === "point" && m.label === refLandmark1)||{});
        const p2b = vpts(compMarkups.find(m => m.type === "point" && m.label === refLandmark2)||{});
        if(p1a.length && p1b.length && p2a.length && p2b.length){
          const tf = alignTwoPoints(p2a[0], p2b[0], p1a[0], p1b[0]);
          ctx.translate(pan.x, pan.y);
          ctx.scale(zoom, zoom);
          ctx.translate(tf.tx, tf.ty);
          ctx.rotate(tf.rot);
          ctx.scale(tf.scale, tf.scale);
          compMarkups.forEach(m => drawMarkup(ctx, m, 1, {x:0,y:0}, drawCalibration, null, t, false, canvasSize.current, angleMode, false, annotationSize, null));
        } else {
          compMarkups.forEach(m => drawMarkup(ctx, m, zoom, pan, drawCalibration, null, t, false, canvasSize.current, angleMode, false, annotationSize, null));
        }
      } else {
        compMarkups.forEach(m => drawMarkup(ctx, m, zoom, pan, drawCalibration, null, t, false, canvasSize.current, angleMode, false, annotationSize, null));
      }
      ctx.restore();
    }
    drawMarkups.forEach(m=>drawMarkup(ctx,m,zoom,pan,drawCalibration,selectedId,t,false,canvasSize.current,angleMode,showAnnotations,annotationSize,hoveredPtRef.current));
    // U3: In-canvas calibration guidance — highlight the ruler used for calibration
    if(showCalib&&pendingRuler){
      const rp=drawMarkups.find(m=>m.id===pendingRuler.id);
      if(rp){
        const vp=vpts(rp);if(vp.length>=2){
          const sp0={x:vp[0].x*zoom+pan.x,y:vp[0].y*zoom+pan.y};
          const sp1={x:vp[1].x*zoom+pan.x,y:vp[1].y*zoom+pan.y};
          const now=Date.now(),pulse=0.5+0.5*Math.sin(now/200);
          ctx.save();ctx.strokeStyle=`rgba(255,215,0,${0.4+0.4*pulse})`;ctx.lineWidth=4;ctx.setLineDash([8,4]);ctx.beginPath();ctx.moveTo(sp0.x,sp0.y);ctx.lineTo(sp1.x,sp1.y);ctx.stroke();ctx.setLineDash([]);ctx.restore();
          const mx=(sp0.x+sp1.x)/2,my=(sp0.y+sp1.y)/2;
          ctx.save();ctx.fillStyle=`rgba(255,215,0,${0.7+0.3*pulse})`;ctx.font="bold 11px 'DM Sans',sans-serif";ctx.textAlign="center";ctx.fillText("Calibration ruler",mx,my-10);ctx.restore();
        }
      }
    }
    if(showDisplacement){
      if(!compareSession){
        ctx.fillStyle="rgba(0,0,0,0.6)";ctx.fillRect(8,8,220,36);
        ctx.fillStyle="#ffd700";ctx.font="bold 12px 'DM Sans',sans-serif";
        ctx.fillText("⇝ Select a compare version in Versions panel",16,28);
      } else {
        drawDisplacementVectors(ctx,drawMarkups,compareSession.markups||[],zoom,pan,drawCalibration);
      }
    }
    drawAirwayOverlay(ctx,drawMarkups,zoom,pan,drawCalibration);
    // Point definition tooltip on hover
    if(showDefTooltips&&hoveredPtRef.current?.type==="point"&&activeTool==="select"){
      const hp=drawMarkups.find(m=>m.id===hoveredPtRef.current.mid);
      if(hp&&hp.definition){
        const vp=vpts(hp);
        if(vp.length){
          const sp={x:vp[0].x*zoom+pan.x,y:vp[0].y*zoom+pan.y};
          const tipW=Math.max(120,Math.min(340,W-sp.x-20));
          ctx.font=`11px "DM Sans",sans-serif`;
          const lines=[];let line="";
          for(const word of hp.definition.split(" ")){
            const test=line?line+" "+word:word;
            if(ctx.measureText(test).width>tipW-24&&line){lines.push(line);line=word;}else line=test;
          }
          if(line)lines.push(line);
          const tipH=Math.max(54,38+lines.length*18);
          let tx=sp.x+14,ty=sp.y-10;
          if(tx+tipW>W-8)tx=sp.x-tipW-14;
          if(ty+tipH>H-8)ty=H-tipH-8;
          if(ty<8)ty=8;
          ctx.save();
          ctx.shadowColor="rgba(0,0,0,0.4)";ctx.shadowBlur=10;ctx.shadowOffsetY=2;
          ctx.fillStyle=t.surf2;ctx.beginPath();ctx.roundRect(tx,ty,tipW,tipH,8);ctx.fill();
          ctx.shadowColor="transparent";ctx.shadowBlur=0;ctx.shadowOffsetY=0;
          ctx.fillStyle=t.acc;ctx.beginPath();ctx.roundRect(tx,ty,tipW,3,{upperLeft:8,upperRight:8});ctx.fill();
          ctx.fillStyle=t.tx;ctx.font=`bold 12px "DM Sans",sans-serif`;
          ctx.fillText(hp.label,tx+12,ty+20);
          ctx.fillStyle=t.tx2;ctx.font=`11px "DM Sans",sans-serif`;
          lines.forEach((l,i)=>ctx.fillText(l,tx+12,ty+38+i*16));
          ctx.restore();
        }
      }
    }
    if(currentDraw)drawInProgress(ctx,currentDraw,mousePos,zoom,pan,t);
    if(snapEnabled&&snapPos)drawSnapIndicator(ctx,snapPos,zoom,pan);
    if(boxSelectRect){
      const{x1,y1,x2,y2}=boxSelectRect;
      ctx.save();
      ctx.strokeStyle=t.acc;ctx.lineWidth=1.5/zoom;ctx.setLineDash([4/zoom,4/zoom]);
      ctx.strokeRect(x1*zoom+pan.x,y1*zoom+pan.y,(x2-x1)*zoom,(y2-y1)*zoom);
      ctx.fillStyle=t.acc+"22";ctx.fillRect(x1*zoom+pan.x,y1*zoom+pan.y,(x2-x1)*zoom,(y2-y1)*zoom);
      ctx.setLineDash([]);
      ctx.restore();
    }
    if(selectedIds.length>0){
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      selectedIds.forEach(id=>{
        const m=markups.find(x=>x.id===id);
        if(!m||m.visible===false)return;
        let pts=[];
        if(m.type==="silhouette"){
          const pos=m.position||{x:0,y:0};
          if(pos.x>-9000)pts.push(pos);
          const paths=m.paths||SILHOUETTES[m.silhouetteType]?.paths;
          if(paths){
            const rot=m.rotation||0;const sc=m.scale||1;const baseSize=100;
            const cosR=Math.cos(rot);const sinR=Math.sin(rot);
            paths.forEach(path=>{path.points.forEach(p=>{
              const sx=p.x*sc*baseSize;const sy=p.y*sc*baseSize;
              pts.push({x:sx*cosR-sy*sinR+pos.x,y:sx*sinR+sy*cosR+pos.y});
            });});
          }
        }else{pts=vpts(m);}
        pts.forEach(p=>{if(p.x>-9000){if(p.x<minX)minX=p.x;if(p.y<minY)minY=p.y;if(p.x>maxX)maxX=p.x;if(p.y>maxY)maxY=p.y;}});
      });
      if(isFinite(minX)){
        ctx.save();
        const bx=minX*zoom+pan.x,by=minY*zoom+pan.y,bw=(maxX-minX)*zoom,bh=(maxY-minY)*zoom;
        const pad=4/zoom;
        ctx.strokeStyle=t.acc;ctx.lineWidth=1.5/zoom;ctx.setLineDash([5/zoom,4/zoom]);
        ctx.strokeRect(bx-pad,by-pad,bw+pad*2,bh+pad*2);
        ctx.setLineDash([]);
        const hs=6/zoom;
        const hc=[[bx-pad,by-pad],[bx+bw+pad,by-pad],[bx-pad,by+bh+pad],[bx+bw+pad,by+bh+pad]];
        hc.forEach(([cx,cy])=>{
          ctx.fillStyle=t.surf;ctx.strokeStyle=t.acc;ctx.lineWidth=1/zoom;
          ctx.fillRect(cx-hs/2,cy-hs/2,hs,hs);
          ctx.strokeRect(cx-hs/2,cy-hs/2,hs,hs);
        });
        ctx.restore();
      }
    }
    if(showScaleBar)drawScaleBar(ctx,zoom,drawCalibration,W,H);
    if(showLUT&&lutMode!=="gray")drawLUTLegend(ctx,lutMode,lutInvert,W,H,t);
    // A5: Placing-mode card moved to floating React panel — no longer drawn on canvas
    // F1: draw coordinates on canvas (replaces DOM overlay — no React re-render needed)
    if(mousePos){
      const ip={x:(mousePos.x-pan.x)/zoom,y:(mousePos.y-pan.y)/zoom};
      const coordTxt=`${ip.x.toFixed(1)}, ${ip.y.toFixed(1)} px${calibration.done?` · (${(ip.x/calibration.pxPerMm).toFixed(1)}, ${(ip.y/calibration.pxPerMm).toFixed(1)} mm)`:""}`;
      ctx.font=`11px "DM Mono",monospace`;
      const tw=ctx.measureText(coordTxt).width;
      ctx.fillStyle=t.surf+"ee";ctx.strokeStyle=t.bdr;ctx.lineWidth=1;
      ctx.beginPath();ctx.roundRect(22,H-30,tw+16,22,6);ctx.fill();ctx.stroke();
      ctx.fillStyle=t.tx2;ctx.fillText(coordTxt,30,H-14);
    }
    ctx.restore(); // F2: end DPR scale
  },[markups,selectedId,selectedIds,zoom,sessionImage,calibration,t,currentDraw,snapEnabled,showScaleBar,showDefTooltips,showLUT,showAnnotations,annotationSize,showDisplacement,compareSession,getProcessed,angleMode,lutMode,lutInvert,activeTool,displacementOverlay,overlayBlend,refLandmark1,refLandmark2,showCalib,pendingRuler]);

  useEffect(()=>{if(!rafRef.current)rafRef.current=requestAnimationFrame(()=>{rafRef.current=null;redraw();});});
  const scheduleRedraw=useCallback(()=>{if(!rafRef.current)rafRef.current=requestAnimationFrame(()=>{rafRef.current=null;redraw();});},[redraw]);
  const scheduleRedrawRef=useRef(scheduleRedraw);scheduleRedrawRef.current=scheduleRedraw;

  // U3: Keep redrawing while calibration modal is open (pulsing highlight animation)
  useEffect(()=>{if(!showCalib||!pendingRuler)return;let raf;const loop=()=>{scheduleRedrawRef.current();raf=requestAnimationFrame(loop);};raf=requestAnimationFrame(loop);return()=>cancelAnimationFrame(raf);},[showCalib,pendingRuler]);

  const loadImage=(file,addToStack=false)=>{
    if(!file||!file.type.startsWith("image/"))return;
    dispatch({type:"SET",payload:{loadingImages:true}});
    const reader=new FileReader();
    reader.onload=e=>{
      const dataUrl=e.target.result;const img=new Image();
      img.onload=()=>{
        const id=uid();imgRefs.current[id]=img;
        const entry={id,name:file.name,dataUrl,dx:0,dy:0,opacity:1,blendMode:"normal",visible:true,color:"none",transform:{tx:0,ty:0,rot:0,scale:1}};
        const currentImages = activeSession?.images || [];
        if(addToStack){
          updSession({images: [...currentImages, entry]});
        } else {
          updSession({images: [entry]});
        }
        dispatch({type:"SET",payload:{loadingImages:false}});
        if(!addToStack){const cw=canvasSize.current.w-80,ch=canvasSize.current.h-80;const sc=Math.min(cw/(img.naturalWidth||600),ch/(img.naturalHeight||500),1);dispatch({type:"SET",payload:{zoom:sc}});panRef.current={x:40,y:40};dispatch({type:"SET",payload:{pan:{x:40,y:40}}});}
      };
      // D8: a corrupt/permission-denied image decode used to hang the
      // "Loading images…" overlay forever. Clear it and tell the user.
      img.onerror=()=>{ dispatch({type:"SET",payload:{loadingImages:false}}); logError("Image decode failed:",null); alert(`Could not decode "${file?.name||"image"}". The file may be corrupt or in an unsupported format.`); };
      img.src=dataUrl;
    };
    // D8: same for the FileReader itself (file unreadable / revoked).
    reader.onerror=()=>{ dispatch({type:"SET",payload:{loadingImages:false}}); logError("File read failed:",reader.error); alert(`Could not read "${file?.name||"file"}".`); };
    reader.readAsDataURL(file);
  };

  const handleDrop=e=>{e.preventDefault();const files=Array.from(e.dataTransfer.files).filter(f=>f.type.startsWith("image/"));files.forEach((f,i)=>loadImage(f,i>0));};

  useEffect(()=>{
    const fn=e=>{
      if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA")return;
      if((e.ctrlKey||e.metaKey)&&e.key==="z"){undo();return;}
      if((e.ctrlKey||e.metaKey)&&e.key==="y"){redo();return;}
      if(e.key==="Escape"){boxSelectRectRef.current=null;dispatch({type:"SET",payload:{currentDraw:null,selectedId:null,selectedIds:[]}});if(mobileToolsExpanded)dispatch({type:"SET",payload:{mobileToolsExpanded:false}});else if(placingMode){if(placingIdx<placingQueue.length-1)dispatch({type:"SET",payload:{placingIdx:placingIdx+1}});else{dispatch({type:"SET",payload:{placingMode:false}});dispatch({type:"SET",payload:{placingQueue:[]}});dispatch({type:"SET",payload:{placingIdx:0}});}}return;}
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

  const autoCreateMeasurementsRef=useRef();
  const autoCreateMeasurements=useCallback((markups,templateName)=>autoCreateMeasurementsRef.current(markups,templateName),[]);
  const handleMouseDown=useCallback(e=>{
    if(e.button!==0)return;
    const sp=getCanvasPos(e);let ip=toImage(sp.x,sp.y);
    ip=snapPoint(ip,markups,12/zoom,snapEnabled);
     if(placingMode&&placingQueue.length>0&&placingIdx<placingQueue.length){
       const qid=placingQueue[placingIdx];
       const updatedMarkups=markups.map(m=>m.id===qid?{...m,points:[ip],placed:true}:m);
        const newAuto=autoCreateMeasurements(updatedMarkups,analysisTemplate);
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
      const isMulti=selectedIds.length&&selectedIds.includes(hit);
      if(isMulti){multiDragIdsRef.current=[...selectedIds];dragStart.current=ip;isDragging.current=true;dragStartState.current=snapshotRef.current();return;}
      if(selectedIds.length)dispatch({type:"SET",payload:{selectedIds:[]}});
      const m=markups.find(x=>x.id===hit);
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
        if(e.ctrlKey&&(m.type==="curve"||m.type==="polygon")){
          const vp=vpts(m);
          let bestIdx=-1,bestDist=Infinity;
          for(let i=0;i<vp.length;i++){const d=dist(ip,vp[i]);if(d<bestDist){bestDist=d;bestIdx=i;}}
          const newPoints=[...m.points];
          newPoints.splice(bestIdx+1,0,ip);
          updMarkup(hit,{points:newPoints});
          return;
        }
        if(e.shiftKey&&(m.type==="curve"||m.type==="polygon")){
          const vp=vpts(m);
          let bestIdx=-1,bestDist=Infinity;
          for(let i=0;i<vp.length;i++){const d=dist(ip,vp[i]);if(d<bestDist){bestDist=d;bestIdx=i;}}
          if(bestIdx>=0&&vp.length>2){const newPoints=m.points.filter((_,i)=>i!==bestIdx);updMarkup(hit,{points:newPoints});}
          return;
        }
        isDragging.current=true;dragMid.current=hit;dragStartState.current=snapshotRef.current();
        let bi=0,bd=Infinity;(m.points||[]).forEach((p,i)=>{const d=dist(p,ip);if(d<bd){bd=d;bi=i;}});
        if(bd>8/zoom)bi=-1;
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
    if(["line","angle3","angle4","polygon","curve","perp"].includes(activeTool)){
      if(!currentDraw)dispatch({type:"SET",payload:{currentDraw:{type:activeTool,points:[ip],curveStyle:"linear",replacingId}}});
      else{const nps=[...currentDraw.points,ip];const need={line:2,angle3:3,angle4:4,perp:3}[activeTool];if(need&&nps.length>=need){finalizeMarkup({...currentDraw,points:nps});dispatch({type:"SET",payload:{currentDraw:null}});}else dispatch({type:"SET",payload:{currentDraw:{...currentDraw,points:nps}}});}return;}
  },[activeTool,markups,zoom,snapEnabled,currentDraw,selectedMarkup,selectedIds,placingMode,placingQueue,placingIdx,replacingId,setSelectedId,updMarkup,addMarkup,finalizeMarkup,toImage,getCanvasPos,t,analysisTemplate,autoCreateMeasurements,dispatch,norms,pushUndo,refreshAutoMeas,updSession]);

  const handleMouseMove=useCallback(e=>{
    const sp=getCanvasPos(e);
    // F1: write pointer state to refs — no dispatch, no React re-render
    mousePosRef.current=sp;
    if(snapEnabled&&activeTool!=="select"&&activeTool!=="pan"){const ip=toImage(sp.x,sp.y);const sn=snapPoint(ip,markups,12/zoom,snapEnabled);snapPosRef.current=(Math.abs(sn.x-ip.x)>0.1||Math.abs(sn.y-ip.y)>0.1)?sn:null;}else snapPosRef.current=null;
    if(activeTool==="select"&&!isDragging.current&&!silhouetteAction.current){const ip=toImage(sp.x,sp.y);let best=null,bd=Infinity;const ptThr=8/zoom;for(const m2 of markups){if(m2.locked||m2.visible===false)continue;if(m2.type==="point"){const vp=vpts(m2);if(vp.length){const d=dist(ip,vp[0]);if(d<bd&&d<ptThr){bd=d;best={type:"point",mid:m2.id};}}}if(m2.type==="silhouette"){const paths=m2.paths||SILHOUETTES[m2.silhouetteType]?.paths;if(!paths)continue;const rot=m2.rotation||0;const sc=m2.scale||1;const pos=m2.position||{x:0,y:0};const cosR=Math.cos(rot);const sinR=Math.sin(rot);paths.forEach((path,pi)=>{path.points.forEach((p,ptI)=>{const sx=p.x*sc*100;const sy=p.y*100;const rx=sx*cosR-sy*sinR;const ry=sx*sinR+sy*cosR;const d=dist(ip,{x:rx+pos.x,y:ry+pos.y});if(d<bd&&d<ptThr){bd=d;best={type:"silhouette",mid:m2.id,pathIdx:pi,ptIdx:ptI};}});});if(m2.id===selectedId){try{const h=getSilhouetteHandlesImage(m2,zoom);const rotThr=Math.max(10,22*Math.sqrt(zoom))/zoom;if(h.rotCenter&&isFinite(h.rotCenter.x)){const d=dist(ip,h.rotCenter);if(d<rotThr&&d<bd){bd=d;best={type:"rotate",mid:m2.id};}}const cornerThr=Math.max(8,12*Math.sqrt(zoom))/zoom;h.corners.forEach((c,ci)=>{if(isFinite(c.x)){const d=dist(ip,c);if(d<cornerThr&&d<bd){bd=d;best={type:"corner",mid:m2.id,cornerIdx:ci};}}});}catch{/*silent*/}}}else if(m2.type==="curve"||m2.type==="polygon"){(m2.points||[]).forEach((p,i)=>{const d=dist(ip,p);if(d<bd&&d<ptThr){bd=d;best={type:"path",mid:m2.id,ptIdx:i};}});}}hoveredPtRef.current=best;}else{hoveredPtRef.current=null;}
    if(boxSelectRectRef.current){const ip=toImage(sp.x,sp.y);boxSelectRectRef.current={...boxSelectRectRef.current,x2:ip.x,y2:ip.y};scheduleRedrawRef.current();return;}
    if(isPanning.current&&panStart.current){panRef.current={x:panStart.current.px+(e.clientX-panStart.current.mx),y:panStart.current.py+(e.clientY-panStart.current.my)};scheduleRedrawRef.current();return;}
    if(isDragging.current&&multiDragIdsRef.current){const ip=toImage(sp.x,sp.y);const dx=ip.x-dragStart.current.x,dy=ip.y-dragStart.current.y;const ids=multiDragIdsRef.current;updMarkups(ms=>ms.map(m=>{if(!ids.includes(m.id))return m;if(m.type==="silhouette")return{...m,position:{x:(m.position?.x||0)+dx,y:(m.position?.y||0)+dy}};return{...m,points:(m.points||[]).map(p=>p.x>-9000?{x:p.x+dx,y:p.y+dy}:p)};}));dragStart.current=ip;scheduleRedrawRef.current();return;}
    if(isDragging.current&&dragMid.current){const ip=toImage(sp.x,sp.y);const dx=ip.x-dragStart.current.x,dy=ip.y-dragStart.current.y;const m=markups.find(x=>x.id===dragMid.current);if(!m)return;if(m.type==="silhouette"){if(typeof dragPtIdx.current==="object"&&dragPtIdx.current!==null){const sc=m.scale||1;const rot=m.rotation||0;const cosR=Math.cos(rot);const sinR=Math.sin(rot);const baseSize=100;const dnx=(cosR*dx+sinR*dy)/(sc*baseSize);const dny=(-sinR*dx+cosR*dy)/(sc*baseSize);const{pathIdx,ptIdx}=dragPtIdx.current;updMarkup(dragMid.current,{paths:(m.paths||[]).map((path,pi)=>({...path,points:path.points.map((p,ptI)=>pi===pathIdx&&ptI===ptIdx?{x:p.x+dnx,y:p.y+dny}:p)}))});}else{updMarkup(dragMid.current,{position:{x:(m.position?.x||0)+dx,y:(m.position?.y||0)+dy}});}}else{updMarkup(dragMid.current,{points:(m.points||[]).map((p,i)=>i===dragPtIdx.current?{x:p.x+dx,y:p.y+dy}:p)});}dragStart.current=ip;scheduleRedrawRef.current();}
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
  },[activeTool,markups,zoom,snapEnabled,selectedId,updMarkup,updMarkups,toImage,getCanvasPos]);

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
  const handleDblClick=()=>{if((activeTool==="polygon"||activeTool==="curve")&&currentDraw?.points.length>=2){finalizeMarkup(currentDraw);dispatch({type:"SET",payload:{currentDraw:null}});}};
  useEffect(()=>{const c=canvasRef.current;if(!c)return;const onWheel=e=>{if(Math.abs(e.deltaY)>0.1||Math.abs(e.deltaX)>0.1){e.preventDefault();e.stopPropagation();const sp=getCanvasPos(e),f=e.deltaY>0?0.9:1.1,nz=clamp(zoom*f,0.05,15);const prev=panRef.current;panRef.current={x:sp.x-(sp.x-prev.x)*(nz/zoom),y:sp.y-(sp.y-prev.y)*(nz/zoom)};dispatch({type:"SET",payload:{pan:panRef.current}});dispatch({type:"SET",payload:{zoom:nz}});}};c.addEventListener("wheel",onWheel,{passive:false});return()=>c.removeEventListener("wheel",onWheel);},[zoom,dispatch,getCanvasPos]);
  const touchStartRef=useRef();const touchMoveRef=useRef();const touchEndRef=useRef();
  touchStartRef.current=e=>{
    if(e.touches.length===1){const t2=e.touches[0];const now=Date.now();if(now-lastTapRef.current<300){handleDblClick();lastTapRef.current=0;}else{lastTapRef.current=now;handleMouseDown({button:0,clientX:t2.clientX,clientY:t2.clientY});}}
    if(e.touches.length===2){lastTouchDist.current=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);if((activeTool==="curve"||activeTool==="polygon")&&currentDraw?.points.length>=2){handleMouseDown({button:0,clientX:(e.touches[0].clientX+e.touches[1].clientX)/2,clientY:(e.touches[0].clientY+e.touches[1].clientY)/2,ctrlKey:true});}}
  };
  touchMoveRef.current=e=>{
    if(e.touches.length===1){const t2=e.touches[0];handleMouseMove({clientX:t2.clientX,clientY:t2.clientY});}
    if(e.touches.length===2&&lastTouchDist.current){const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);const f=d/lastTouchDist.current,nz=clamp(zoom*f,0.05,15);const cx=(e.touches[0].clientX+e.touches[1].clientX)/2,cy=(e.touches[0].clientY+e.touches[1].clientY)/2;const r=canvasRef.current.getBoundingClientRect();const sp={x:cx-r.left,y:cy-r.top};const prev=panRef.current;panRef.current={x:sp.x-(sp.x-prev.x)*(nz/zoom),y:sp.y-(sp.y-prev.y)*(nz/zoom)};dispatch({type:"SET",payload:{pan:panRef.current}});dispatch({type:"SET",payload:{zoom:nz}});lastTouchDist.current=d;}
  };
  touchEndRef.current=e=>{handleMouseUp();lastTouchDist.current=null;if(e.touches.length===0)lastTapRef.current=0;};
  useEffect(()=>{const c=canvasRef.current;if(!c)return;const opts={passive:false};const onStart=e=>{e.preventDefault();touchStartRef.current(e);};const onMove=e=>{e.preventDefault();touchMoveRef.current(e);};const onEnd=e=>{touchEndRef.current(e);};c.addEventListener("touchstart",onStart,opts);c.addEventListener("touchmove",onMove,opts);c.addEventListener("touchend",onEnd,opts);return()=>{c.removeEventListener("touchstart",onStart);c.removeEventListener("touchmove",onMove);c.removeEventListener("touchend",onEnd);};},[]);

  const finalizeCalib=(mm,manualPpm)=>{
    if(manualPpm){updSession({calibration:{done:true,pxPerMm:manualPpm,knownMm:mm}});dispatch({type:"SET",payload:{showCalib:false}});return;}
    const ruler=pendingRuler||markups.find(m=>m.type==="ruler");if(!ruler)return;const vp=vpts(ruler);if(vp.length<2)return;
    updSession({calibration:{done:true,pxPerMm:dist(vp[0],vp[1])/mm,knownMm:mm}});dispatch({type:"SET",payload:{showCalib:false}});
  };

  const loadTemplate=(analysis)=>{
    const newMarkups=[];
    const pointIds={};
    analysis.pts.forEach(pt=>{
      const id=uid();
      pointIds[pt.l]=id;
      newMarkups.push({id,type:"point",points:[{x:-99999,y:-99999}],label:pt.l,definition:pt.def,color:pt.color,size:6,visible:true,placed:false});
    });
    updSession({markups:[...markups,...newMarkups],analysisTemplate:analysis.name});
    setPlacingQueue(newMarkups.map(m=>m.id));dispatch({type:"SET",payload:{placingIdx:0}});dispatch({type:"SET",payload:{placingMode:true}});dispatch({type:"SET",payload:{rightPanel:"markups"}});
  };

  autoCreateMeasurementsRef.current=(markups,templateName)=>{
    const analysis=PREDEFINED.lateral.find(a=>a.name===templateName)
      ||PREDEFINED.ap.find(a=>a.name===templateName)
      ||PREDEFINED.smv.find(a=>a.name===templateName)
      ||PREDEFINED.opg.find(a=>a.name===templateName)
      ||PREDEFINED.handwrist.find(a=>a.name===templateName)
      ||PREDEFINED.photolateral.find(a=>a.name===templateName)
      ||PREDEFINED.photofrontal.find(a=>a.name===templateName);
    if(!analysis||!analysis.measurements||analysis.measurements.length===0)return[];
    const placed={};
    for(const m of markups){
      if(m.placed&&m.label)placed[m.label]=m;
    }
    const existingLabels=new Set(markups.map(m=>m.label));
    const result=[];
    for(const meas of analysis.measurements){
      if(meas.type==="ratio"||meas.type==="sum"||meas.type==="difference"||meas.type==="percentage")continue;
      if(!meas.pts||meas.pts.length<2)continue;
      if(existingLabels.has(meas.l))continue;
      const allPlaced=meas.pts.every(rl=>placed[rl]);
      if(!allPlaced)continue;
      const points=meas.pts.map(rl=>placed[rl].points[0]);
      const extraProps={};
      if(meas.type==="line"&&!meas.norm){
        extraProps.mode="infinite";
        extraProps.style="dashed";
      }
      if(meas.type==="polygon"){
        extraProps.fillColor="rgba(56,189,248,0.08)";
        extraProps.curveStyle="linear";
      }
      result.push({
        id:uid(),type:meas.type,points,
        label:meas.l,definition:meas.def||"",
        color:meas.color||"#888",
        visible:true,locked:true,autoCreated:true,placed:true,
        refLabels:meas.pts,norm:meas.norm,...extraProps,
      });
    }
    const updatedLabels=new Set([...existingLabels,...result.map(m=>m.label)]);
    const markupMap={};
    for(const m of[...markups,...result]){
      if(m.label)markupMap[m.label]=m;
    }
    for(const meas of analysis.measurements){
      if(meas.type!=="ratio"&&meas.type!=="sum"&&meas.type!=="difference"&&meas.type!=="percentage")continue;
      if(!meas.pts||meas.pts.length<2)continue;
      if(updatedLabels.has(meas.l))continue;
      const allRefsExist=meas.pts.every(rl=>markupMap[rl]);
      if(!allRefsExist)continue;
      let computedValue=0;
      if(meas.type==="ratio"){
        const v0=getMeasValue(markupMap[meas.pts[0]]);
        const v1=getMeasValue(markupMap[meas.pts[1]]);
        computedValue=v1!==0?v0/v1:0;
      }else if(meas.type==="difference"){
        const v0=getMeasValue(markupMap[meas.pts[0]]);
        const v1=getMeasValue(markupMap[meas.pts[1]]);
        computedValue=v0-v1;
      }else if(meas.type==="percentage"){
        const v0=getMeasValue(markupMap[meas.pts[0]]);
        const v1=getMeasValue(markupMap[meas.pts[1]]);
        computedValue=v1!==0?(v0/v1)*100:0;
      }else{
        computedValue=meas.pts.reduce((s,rl)=>s+getMeasValue(markupMap[rl]),0);
      }
      result.push({
        id:uid(),type:meas.type,points:[],
        label:meas.l,definition:meas.def||"",
        color:meas.color||"#888",
        visible:true,locked:true,autoCreated:true,
        refLabels:meas.pts,computedValue,norm:meas.norm,
      });
    }
    return result;
  };
  const getMeasValue=(m)=>{
    const ms=computeMeasurements(m,calibration);
    const vals=Object.values(ms).filter(v=>typeof v==="number"&&isFinite(v));
    return vals.length>0?vals[0]:0;
  };

  const exportCSV=()=>{
    const rows=[["ID","Type","Label","Definition","Points_px","Measurement","Value","Unit"]];
    markups.forEach(m=>{const meas=computeMeasurements(m,calibration);const ps=vpts(m).map(p=>`(${p.x.toFixed(1)},${p.y.toFixed(1)})`).join(";");if(!Object.keys(meas).length)rows.push([m.id,m.type,m.label||"",m.definition||"",ps,"","",""]);else Object.entries(meas).forEach(([k,v])=>rows.push([m.id,m.type,m.label||"",m.definition||"",ps,k,v.toFixed(2),k==="angle"?formatAngle(v):"mm"]));});
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([rows.map(r=>r.map(c=>`"${c}"`).join(",")).join("\n")],{type:"text/csv"}));a.download=`${project.name}.csv`;a.click();
  };

  const captureMarkupImage = useCallback(async () => {
    const imgEl = sessionImage?.[0] ? imgRefs.current[sessionImage[0].id] : null;
    if (!imgEl) return null;
    const c = document.createElement("canvas");
    c.width = imgEl.naturalWidth;
    c.height = imgEl.naturalHeight;
    const ctx = c.getContext("2d");
    ctx.drawImage(imgEl, 0, 0);
    const visible = markups.filter(m => m.visible !== false);
    const cs = { w: c.width, h: c.height };
    visible.forEach(m => drawMarkup(ctx, m, 1, { x: 0, y: 0 }, calibration, null, t, false, cs, "deg", true, 1.2));
    return c.toDataURL("image/png");
  }, [sessionImage, markups, calibration, t]);

  const measScope=useMemo(()=>buildScope(markups,calibration),[markups,calibration]);
  const allMeas=useMemo(()=>markups.map(m=>({m,meas:computeMeasurements(m,calibration)})).filter(x=>Object.keys(x.meas).length>0),[markups,calibration]);
  const [pinnedFormulas, setPinnedFormulas] = useState(new Set());
  const [filmstripOpen, setFilmstripOpen] = useState(true);
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

  const panelIcons={
    markups:<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M621.5-338.5Q680-397 680-480t-58.5-141.5Q563-680 480-680t-141.5 58.5Q280-563 280-480t58.5 141.5Q397-280 480-280t141.5-58.5ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Z"/></svg>,
    measurements:<svg fill="currentColor" height="24px" width="24px" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" xmlSpace="preserve"> <g><g>
		<path d="M418.364,0L0,418.364L93.636,512L512,93.636L418.364,0z M22.153,418.364l16.443-16.443l54.875,54.875l11.076-11.076
			l-54.875-54.875l10.939-10.939l16.477,16.477l11.076-11.077l-16.477-16.477l10.939-10.939l27.485,27.485l11.077-11.076
			l-27.485-27.485l10.939-10.939l16.477,16.477l11.076-11.077l-16.477-16.477l10.939-10.939l54.874,54.875l11.076-11.077
			l-54.875-54.875l10.939-10.939l16.477,16.477l11.076-11.076l-16.476-16.474l10.939-10.939l27.485,27.485l11.076-11.076
			l-27.485-27.485l10.939-10.939l16.477,16.477l11.076-11.076l-16.477-16.477l10.939-10.939l54.874,54.875l11.077-11.076
			l-54.874-54.875l10.939-10.939l16.477,16.477l11.076-11.076l-16.477-16.477l10.939-10.939l27.485,27.485l11.076-11.076
			L269.83,170.69l10.939-10.939l16.477,16.477l11.077-11.076l-16.477-16.477l10.939-10.939l54.875,54.875l11.077-11.076
			l-54.875-54.874l10.939-10.939l16.477,16.477l11.077-11.076l-16.477-16.477l10.939-10.939l27.485,27.485l11.076-11.076
			l-27.489-27.487l10.939-10.939l16.477,16.477l11.077-11.076l-16.478-16.477l10.939-10.939l54.875,54.875l11.076-11.076
			l-54.875-54.875l16.443-16.443l71.482,71.482L93.636,489.847L22.153,418.364z"/>
	</g></g></svg>,
    formulas:<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M240-160v-80l260-240-260-240v-80h480v120H431l215 200-215 200h289v120H240Z"/></svg>,
    image:<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm40-80h480L570-480 450-320l-90-120-120 160Zm-40 80v-560 560Z"/></svg>,
    layers:<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M480-118 120-398l66-50 294 228 294-228 66 50-360 280Zm0-202L120-600l360-280 360 280-360 280Zm0-280Zm0 178 230-178-230-178-230 178 230 178Z"/></svg>,
    sessions:<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Zm0 0v-80 80Zm280 240q-17 0-28.5-11.5T440-440q0-17 11.5-28.5T480-480q17 0 28.5 11.5T520-440q0 17-11.5 28.5T480-400Zm-188.5-11.5Q280-423 280-440t11.5-28.5Q303-480 320-480t28.5 11.5Q360-457 360-440t-11.5 28.5Q337-400 320-400t-28.5-11.5ZM640-400q-17 0-28.5-11.5T600-440q0-17 11.5-28.5T640-480q17 0 28.5 11.5T680-440q0 17-11.5 28.5T640-400ZM480-240q-17 0-28.5-11.5T440-280q0-17 11.5-28.5T480-320q17 0 28.5 11.5T520-280q0 17-11.5 28.5T480-240Zm-188.5-11.5Q280-263 280-280t11.5-28.5Q303-320 320-320t28.5 11.5Q360-297 360-280t-11.5 28.5Q337-240 320-240t-28.5-11.5ZM640-240q-17 0-28.5-11.5T600-280q0-17 11.5-28.5T640-320q17 0 28.5 11.5T680-280q0 17-11.5 28.5T640-240Z"/></svg>,
    research:<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M316-80q-52 0-88-38t-36-90q0-36 17-64t45-44l-14-464q-2-62 40-105t104-43q62 0 104 43t40 105l-14 464q28 16 45 44t17 64q0 52-36 90t-88 38H316Zm2-560h124l2-60q1-26-16-45t-43-19q-26 0-43 17t-19 43l-5 64Zm-2 480h128q14 0 24-11t10-25q0-14-9-24t-23-10l-36-2 6-188H344l-4 188-36 2q-14 0-23 10t-9 24q0 14 10 25t24 11Zm-2-80Zm258-20q-14-14-20-30.5t-4-33.5l82-456q5-28 25-48t48-20q32 0 54 24.5t18 56.5l-38 458q-2 26-20.5 44.5T672-200q-26 0-46-17t-24-43h-28Z"/></svg>,
    interpretation:<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M280-280h280v-80H280v80Zm0-160h400v-80H280v80Zm0-160h400v-80H280v80Zm-80 480q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z"/></svg>,
    templates:<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M480-60q-50 0-85-35t-35-85q0-39 22.5-70t57.5-43v-73q-11-4-21-9.5T401-389l-63 37q1 5 1.5 10.5t.5 11.5q0 50-35 85t-85 35q-50 0-85-35t-35-85q0-50 35-85t85-35q23 0 43 7.5t36 21.5l62-36q-1-5-1.5-11t-.5-12q0-6 .5-11.5T361-502l-62-37q-16 14-36 21.5t-43 7.5q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 6-.5 12t-1.5 11l63 36q8-8 18-13t21-9v-73q-35-12-57.5-43.5T360-780q0-50 35-85t85-35q50 0 85 35t35 85q0 39-22.5 70.5T520-666v73q11 4 20.5 9.5T558-570l64-38q-1-5-1.5-10.5T620-630q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35q-23 0-42.5-7.5T662-539l-65 38q1 5 1.5 10.5t.5 10.5q0 5-.5 11t-1.5 11l65 37q16-14 35.5-21.5T740-450q50 0 85 35t35 85q0 50-35 85t-85 35q-50 0-85-35t-35-85q0-6 .5-11.5T622-352l-64-37q-8 8-17.5 13t-20.5 9v74q35 12 57.5 43t22.5 70q0 50-35 85t-85 35Zm0-80q17 0 28.5-11.5T520-180q0-17-11.5-28.5T480-220q-17 0-28.5 11.5T440-180q0 17 11.5 28.5T480-140ZM220-290q17 0 28.5-11.5T260-330q0-17-11.5-28.5T220-370q-17 0-28.5 11.5T180-330q0 17 11.5 28.5T220-290Zm520 0q17 0 28.5-11.5T780-330q0-17-11.5-28.5T740-370q-17 0-28.5 11.5T700-330q0 17 11.5 28.5T740-290ZM480-440q17 0 28.5-11.5T520-480q0-17-11.5-28.5T480-520q-17 0-28.5 11.5T440-480q0 17 11.5 28.5T480-440ZM220-590q17 0 28.5-11.5T260-630q0-17-11.5-28.5T220-670q-17 0-28.5 11.5T180-630q0 17 11.5 28.5T220-590Zm520 0q17 0 28.5-11.5T780-630q0-17-11.5-28.5T740-670q-17 0-28.5 11.5T700-630q0 17 11.5 28.5T740-590ZM480-740q17 0 28.5-11.5T520-780q0-17-11.5-28.5T480-820q-17 0-28.5 11.5T440-780q0 17 11.5 28.5T480-740Z"/></svg>,
    silhouettes:<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M240-80v-170q-39-17-68.5-45.5t-50-64.5q-20.5-36-31-77T80-520q0-158 112-259t288-101q176 0 288 101t112 259q0 42-10.5 83t-31 77q-20.5 36-50 64.5T720-250v170H240Zm80-80h40v-80h80v80h80v-80h80v80h40v-142q38-9 67.5-30t50-50q20.5-29 31.5-64t11-74q0-125-88.5-202.5T480-800q-143 0-231.5 77.5T160-520q0 39 11 74t31.5 64q20.5 29 50.5 50t67 30v142Zm100-200h120l-60-120-60 120Zm-80-80q33 0 56.5-23.5T420-520q0-33-23.5-56.5T340-600q-33 0-56.5 23.5T260-520q0 33 23.5 56.5T340-440Zm280 0q33 0 56.5-23.5T700-520q0-33-23.5-56.5T620-600q-33 0-56.5 23.5T540-520q0 33 23.5 56.5T620-440ZM480-160Z"/></svg>,
    examples:<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M382-240 154-468l57-56 171 171 367-367 57 57-424 424Z"/></svg>
  };
  const panelTabs=[["markups","Markups"],["measurements","Measure"],["formulas","Formulas"],["image","Image"],["layers","Layers"],["sessions","Sessions"],["research","Research"],["interpretation","Interpret"],["templates","Templates"],["silhouettes","Silhouettes"],["examples","Examples"]];

  return(
    <div style={{height:"100vh",display:"flex",flexDirection:"column",background:t.bg,color:t.tx,fontFamily:"'DM Sans',sans-serif",overflow:"hidden"}}>
      {/* hidden file inputs */}
      <input ref={openImgRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{if(e.target.files[0])loadImage(e.target.files[0]);e.target.value="";}}/>
      <input ref={stackImgRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{if(e.target.files[0])loadImage(e.target.files[0],true);e.target.value="";}}/>
      <input ref={importRef} type="file" accept=".cephx" style={{display:"none"}} onChange={e=>{if(e.target.files[0])onImport(e.target.files[0]);e.target.value="";}}/>

      {/* TOP BAR */}
      <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px 5px",height:isMobile?42:46,background:t.surf,flexShrink:0,overflowX:"auto"}}>
        <button onClick={onHome} title="Back to Home" style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:4,padding:"4px 8px",borderRadius:6,flexShrink:0,color:t.tx}}>
          <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill={t.tx}><path d="M240-200h120v-240h240v240h120v-360L480-740 240-560v360Zm-80 80v-480l320-240 320 240v480H520v-240h-80v240H160Zm320-350Z"/></svg>
        </button>
        <button onClick={onHome} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:5,padding:"4px 8px",borderRadius:6,flexShrink:0}}>
          <span><img src="/favicon.svg" alt="Website Icon" width="48" height="48"/> </span>
          {!isMobile&&<span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:t.tx,fontSize:17,display:"inline-flex",alignItems:"center",gap:6}}>Cephalometry Studio<span style={{fontSize:8,fontWeight:700,color:t.acc,background:t.accMuted,borderRadius:5,padding:"1px 5px",letterSpacing:0.8}}>BETA</span></span>}
        </button>
        <div style={{width:1,height:20,background:t.bdr,flexShrink:0}}/>
        <Tag color={t.acc}>{project.projection?.toUpperCase()}</Tag>
        {project.meta?.anonymized&&<Tag color={t.ok}>🔒 Anon</Tag>}
        {calibration.done&&<Tag color={t.ok}>⟺{"\u00A0"}{calibration.pxPerMm.toFixed(2)}px/mm</Tag>}
        {placingMode&&<Tag color={t.warn}>📍 {placingIdx+1}/{placingQueue.length}</Tag>}
        <div style={{flex:1}}/>
        {!isMobile&&<>
           <Btn ghost t={t} small active={snapEnabled} title="Snap to grid" onClick={()=>dispatch({type:"SET",payload:{snapEnabled:!snapEnabled}})}>
            <svg fill={t.tx} width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21.7,12.818a1.022,1.022,0,0,1,0,1.445L20.154,15.81l-3.589-3.589,1.547-1.548a1.022,1.022,0,0,1,1.444,0ZM9.737,2.3,8.19,3.846l3.59,3.589,1.546-1.547a1.021,1.021,0,0,0,0-1.444L11.181,2.3A1.021,1.021,0,0,0,9.737,2.3ZM4.478,19.522a8.458,8.458,0,0,0,11.963,0l2.269-2.268-3.589-3.589-2.269,2.268a3.384,3.384,0,0,1-4.785-4.785l2.269-2.269L6.747,5.29,4.478,7.559A8.458,8.458,0,0,0,4.478,19.522Z"/></svg>
            </Btn>
           <Btn ghost t={t} small active={showScaleBar} title="Toggle scale bar" onClick={()=>dispatch({type:"SET",payload:{showScaleBar:!showScaleBar}})}>
              <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill={t.tx}><path d="M160-240q-33 0-56.5-23.5T80-320v-320q0-33 23.5-56.5T160-720h640q33 0 56.5 23.5T880-640v320q0 33-23.5 56.5T800-240H160Zm0-80h640v-320H680v160h-80v-160h-80v160h-80v-160h-80v160h-80v-160H160v320Zm120-160h80-80Zm160 0h80-80Zm160 0h80-80Zm-120 0Z"/></svg>
            </Btn>
           <Btn ghost t={t} small active={showDefTooltips} title="Toggle definition tooltips" onClick={()=>dispatch({type:"SET",payload:{showDefTooltips:!showDefTooltips}})}>
              <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill={t.tx}><path d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/></svg>
            </Btn>
           <Btn ghost t={t} small active={showAnnotations} title="Toggle annotations" onClick={()=>dispatch({type:"SET",payload:{showAnnotations:!showAnnotations}})}>
            <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill={t.tx}><path d="M338-241q16 0 23-10.5t9-24.5q2-10 3.5-20t3.5-22q2-11 4.5-24t5.5-30q23-5 45-8.5t43-5.5q23-3 45.5-4.5T564-394q5 24 10.5 43t11.5 36q8 23 17.5 38t23.5 26q14 11 30.5 12t28.5-9q9-7 9-21t-8-35q-5-11-8.5-22.5T670-350q-5-14-9-25.5t-7-22.5q13-1 23.5-4.5T695-412q7-6 10.5-14.5T709-445q0-11-4.5-18.5T691-476q-9-5-22.5-6.5t-30.5.5q-2-18-4-35.5t-5-35.5q-3-17-5.5-35t-7.5-35q-6-26-17-44.5T574-698q-13-11-28.5-16.5T511-720q-22 0-42 9t-40 27q-11 11-22 23.5T386-631q-8-6-14.5-8t-14.5-2q-11 0-18.5 6t-7.5 20q0 18-2 36t-6 36q-5 26-11 51.5T301-440q-11 2-19.5 5.5T267-427q-8 5-11.5 12.5T252-399q0 7 2 13t7 11q5 5 12 7.5t16 3.5q-1 12-1.5 22.5T287-321q0 21 3 36t9 25q6 10 15.5 14.5T338-241Zm71-223q6-23 14-44.5t18-44.5q16-37 34-59t32-22q11 0 19 17t13 51q3 20 5 43t4 43q-17 1-35 2.5t-35 3.5q-17 2-34.5 4.5T409-464ZM160-80q-33 0-56.5-23.5T80-160v-640q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v640q0 33-23.5 56.5T800-80H160Zm0-80h640v-640H160v640Zm0 0v-640 640Z"/></svg>
          </Btn>
          {showAnnotations&&<input type="range" min="0.5" max="2" step="0.1" value={annotationSize} onChange={e=>dispatch({type:"SET",payload:{annotationSize:+e.target.value}})} style={{width:60,marginLeft:4,accentColor:t.acc}} title={`Annotation size: ${annotationSize.toFixed(1)}`}/>}
          {compareSession&&<Btn ghost t={t} small active={showDisplacement} title="Toggle displacement vectors" onClick={()=>dispatch({type:"SET",payload:{showDisplacement:!showDisplacement}})}>⇝ Vec</Btn>}
          <div style={{width:1,height:20,background:t.bdr}}/>
        </>}
        <Btn ghost t={t} small title="Open image" onClick={()=>openImgRef.current?.click()}>
          <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill={t.tx}>
          <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm40-80h480L570-480 450-320l-90-120-120 160Zm-40 80v-560 560Z"/> 
          </svg>
        </Btn>
        <Btn ghost t={t} small title="Import (.cephx)" onClick={()=>importRef.current?.click()}>
          <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill={t.tx}>
            <path d="M440-320v-326L336-542l-56-58 200-200 200 200-56 58-104-104v326h-80ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/>
          </svg>
        </Btn>
        <Btn ghost t={t} small title="Save project" onClick={()=>{
          if(hasUnanonymizedPHI(project)&&!window.confirm("This project still contains patient identifiers (name, DOB, age, etc.). Exporting will include them. Continue? Use the Export dialog for an anonymized export."))return;
          const patched={...project,sessions:project.sessions?.map(s=>({...s,images:s.images?.map(img=>({...img,dataUrl:imgRefs.current[img.id]?.src||img.dataUrl}))}))};
          onSave?.(patched);
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill={t.tx}>
            <path d="M840-680v480q0 33-23.5 56.5T760-120H200q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h480l160 160Zm-80 34L646-760H200v560h560v-446ZM565-275q35-35 35-85t-35-85q-35-35-85-35t-85 35q-35 35-35 85t35 85q35 35 85 35t85-35ZM240-560h360v-160H240v160Zm-40-86v446-560 114Z"/>
          </svg>
        </Btn>
        {!isMobile&&<Btn ghost t={t} small title="Session Manager" onClick={()=>dispatch({type:"SET",payload:{rightPanel:"sessions"}})}>
            <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill={t.tx}>
            <path d="M480-120q-151 0-255.5-46.5T120-280v-400q0-66 105.5-113T480-840q149 0 254.5 47T840-680v400q0 67-104.5 113.5T480-120Zm0-479q89 0 179-25.5T760-679q-11-29-100.5-55T480-760q-91 0-178.5 25.5T200-679q14 30 101.5 55T480-599Zm0 199q42 0 81-4t74.5-11.5q35.5-7.5 67-18.5t57.5-25v-120q-26 14-57.5 25t-67 18.5Q600-528 561-524t-81 4q-42 0-82-4t-75.5-11.5Q287-543 256-554t-56-25v120q25 14 56 25t66.5 18.5Q358-408 398-404t82 4Zm0 200q46 0 93.5-7t87.5-18.5q40-11.5 67-26t32-29.5v-98q-26 14-57.5 25t-67 18.5Q600-328 561-324t-81 4q-42 0-82-4t-75.5-11.5Q287-343 256-354t-56-25v99q5 15 31.5 29t66.5 25.5q40 11.5 88 18.5t94 7Z"/></svg>
          </Btn>}
        {!isMobile&&<Btn ghost t={t} small title="Export" onClick={()=>dispatch({type:"SET",payload:{showExport:true}})}>
          <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill={t.tx}><path d="M160-80v-80h640v80H160Zm320-160L200-600h160v-280h240v280h160L480-240Zm0-130 116-150h-76v-280h-80v280h-76l116 150Zm0-150Z"/></svg>
          </Btn>}
        {!isMobile&&<Btn ghost t={t} small title="Normogram" onClick={()=>dispatch({type:"SET",payload:{showNormogram:true}})}>
          <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill={t.tx}><path d="M200-120q-33 0-56.5-23.5T120-200v-640h80v640h640v80H200Zm40-120v-360h160v360H240Zm200 0v-560h160v560H440Zm200 0v-200h160v200H640Z"/></svg>
          </Btn>}
        {!isMobile&&<Btn ghost t={t} small title="Anonymize" onClick={()=>dispatch({type:"SET",payload:{showAnon:true}})}>
          <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill={t.tx}><path d="m644-428-58-58q9-47-27-88t-93-32l-58-58q17-8 34.5-12t37.5-4q75 0 127.5 52.5T660-500q0 20-4 37.5T644-428Zm128 126-58-56q38-29 67.5-63.5T832-500q-50-101-143.5-160.5T480-720q-29 0-57 4t-55 12l-62-62q41-17 84-25.5t90-8.5q151 0 269 83.5T920-500q-23 59-60.5 109.5T772-302Zm20 246L624-222q-35 11-70.5 16.5T480-200q-151 0-269-83.5T40-500q21-53 53-98.5t73-81.5L56-792l56-56 736 736-56 56ZM222-624q-29 26-53 57t-41 67q50 101 143.5 160.5T480-280q20 0 39-2.5t39-5.5l-36-38q-11 3-21 4.5t-21 1.5q-75 0-127.5-52.5T300-500q0-11 1.5-21t4.5-21l-84-82Zm319 93Zm-151 75Z"/></svg>
          </Btn>}
        <div style={{width:1,height:20,background:t.bdr,flexShrink:0}}/>
        {Object.values(THEMES).map(th=>(
          <button key={th.id} onClick={()=>setTheme(th.id)} title={th.name} aria-label={th.name} style={{width:22,height:22,borderRadius:6,border:theme===th.id?`2px solid ${t.acc}`:`1px solid ${t.bdr}`,background:th.bg,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{width:10,height:10,borderRadius:3,background:th.acc}}/>
          </button>
        ))}
        {isMobile&&<Btn ghost t={t} small active={showMobilePanel} title="Toggle panel" onClick={()=>setShowMobilePanel(v=>!v)}>≡</Btn>}
      </div>

      {/* BODY */}
      <div style={{flex:1,display:"flex",overflow:"hidden",position:"relative"}}>
        {/* TOOL SIDEBAR — desktop */}
        {!isMobile&&(
          <div style={{width:88,background:t.surf,display:"flex",flexDirection:"column",alignItems:"center",padding:"8px 4px",gap:1,flexShrink:0,overflowY:"auto",scrollbarWidth:"thin"}}>
            <div style={{display:"flex",flexDirection:"column",gap:1,width:"100%"}}>
              {/* Row 1: Select | Pan */}
              <div style={{display:"flex",gap:1}}>
                <ToolBtn tool={{id:"select",icon:"⊹",label:"Select/Move"}} active={activeTool==="select"} onClick={()=>{dispatch({type:"SET",payload:{activeTool:"select"}});dispatch({type:"SET",payload:{currentDraw:null}});}} theme={theme} t={t} style={{flex:1}}/>
                <ToolBtn tool={{id:"pan",icon:"⊕",label:"Pan"}} active={activeTool==="pan"} onClick={()=>{dispatch({type:"SET",payload:{activeTool:"pan"}});dispatch({type:"SET",payload:{currentDraw:null}});}} theme={theme} t={t} style={{flex:1}}/>
              </div>
              {/* Row 2: Landmark | Midpoint */}
              <div style={{display:"flex",gap:1}}>
                <ToolBtn tool={{id:"point",icon:"◉",label:"Landmark"}} active={activeTool==="point"} onClick={()=>{dispatch({type:"SET",payload:{activeTool:"point"}});dispatch({type:"SET",payload:{currentDraw:null}});}} theme={theme} t={t} style={{flex:1}}/>
                <ToolBtn tool={{id:"midpoint",icon:"◈",label:"Midpoint"}} active={activeTool==="midpoint"} onClick={()=>{setActiveTool("midpoint");dispatch({type:"SET",payload:{currentDraw:null}});}} theme={theme} t={t} style={{flex:1}}/>
              </div>
              {/* Row 3: Line | Parallel */}
              <div style={{display:"flex",gap:1}}>
                <ToolBtn tool={{id:"line",icon:"⟋",label:"Line"}} active={activeTool==="line"} onClick={()=>{dispatch({type:"SET",payload:{activeTool:"line"}});dispatch({type:"SET",payload:{currentDraw:null}});}} theme={theme} t={t} style={{flex:1}}/>
                <ToolBtn tool={{id:"parallel",icon:"⫿",label:"Parallel"}} active={activeTool==="parallel"} onClick={()=>{dispatch({type:"SET",payload:{activeTool:"parallel"}});dispatch({type:"SET",payload:{currentDraw:null}});}} theme={theme} t={t} style={{flex:1}}/>
              </div>
              {/* Row 4: Perp Point | Perp Dist */}
              <div style={{display:"flex",gap:1}}>
                <ToolBtn tool={{id:"perppoint",icon:"⊦",label:"Perp Point"}} active={activeTool==="perppoint"} onClick={()=>{setActiveTool("perppoint");dispatch({type:"SET",payload:{currentDraw:null}});}} theme={theme} t={t} style={{flex:1}}/>
                <ToolBtn tool={{id:"perp",icon:"⊥",label:"Perp Dist"}} active={activeTool==="perp"} onClick={()=>{dispatch({type:"SET",payload:{activeTool:"perp"}});dispatch({type:"SET",payload:{currentDraw:null}});}} theme={theme} t={t} style={{flex:1}}/>
              </div>
              {/* Row 5: Angle3pt | Angle4pt */}
              <div style={{display:"flex",gap:1}}>
                <ToolBtn tool={{id:"angle3",icon:"∠",label:"Angle 3-pt"}} active={activeTool==="angle3"} onClick={()=>{setActiveTool("angle3");dispatch({type:"SET",payload:{currentDraw:null}});}} theme={theme} t={t} style={{flex:1}}/>
                <ToolBtn tool={{id:"angle4",icon:"∡",label:"Angle 4-pt"}} active={activeTool==="angle4"} onClick={()=>{setActiveTool("angle4");dispatch({type:"SET",payload:{currentDraw:null}});}} theme={theme} t={t} style={{flex:1}}/>
              </div>
              {/* Row 6: Polygon | Curve */}
              <div style={{display:"flex",gap:1}}>
                <ToolBtn tool={{id:"polygon",icon:"⬡",label:"Polygon"}} active={activeTool==="polygon"} onClick={()=>{setActiveTool("polygon");dispatch({type:"SET",payload:{currentDraw:null}});}} theme={theme} t={t} style={{flex:1}}/>
                <ToolBtn tool={{id:"curve",icon:"∿",label:"Curve"}} active={activeTool==="curve"} onClick={()=>{setActiveTool("curve");dispatch({type:"SET",payload:{currentDraw:null}});}} theme={theme} t={t} style={{flex:1}}/>
              </div>
              {/* Row 7: Arrow | Text */}
              <div style={{display:"flex",gap:1}}>
                <ToolBtn tool={{id:"arrow",icon:"→",label:"Arrow"}} active={activeTool==="arrow"} onClick={()=>{setActiveTool("arrow");dispatch({type:"SET",payload:{currentDraw:null}});}} theme={theme} t={t} style={{flex:1}}/>
                <ToolBtn tool={{id:"text",icon:"T",label:"Text"}} active={activeTool==="text"} onClick={()=>{setActiveTool("text");dispatch({type:"SET",payload:{currentDraw:null}});}} theme={theme} t={t} style={{flex:1}}/>
              </div>
              {/* Row 8: Ruler (centered) */}
              <div style={{display:"flex",justifyContent:"center"}}>
                <ToolBtn tool={{id:"ruler",icon:"⟺",label:"Ruler"}} active={activeTool==="ruler"} onClick={()=>{setActiveTool("ruler");dispatch({type:"SET",payload:{currentDraw:null}});}} theme={theme} t={t}/>
              </div>
              {/* Row 8b: Spotlight mode */}
              <div style={{display:"flex",justifyContent:"center"}}>
                <button onClick={()=>{const next=!spotlightMode;dispatch({type:"SET",payload:{spotlightMode:next}});if(sessionImage.length>0){const img=sessionImage[0];const upd=next?{...img,opacityBeforeSpotlight:img.opacity||1,opacity:0.5}:{...img,opacity:img.opacityBeforeSpotlight||1};updSession({images:sessionImage.map((x,i)=>i===0?upd:x)});}}} title="Spotlight (reduce image opacity)" aria-label="Spotlight" style={{width:42,height:42,borderRadius:8,border:"none",background:spotlightMode?t.acc:t.surf2,color:spotlightMode?(theme==="light"?"#fff":t.bg):t.tx,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:spotlightMode?`0 0 0 2px ${t.acc}`:"none"}}>💡</button>
              </div>
              {/* Separator */}
              <div style={{width:"100%",height:1,background:t.bdr,margin:"4px 0"}}/>
              {/* Row 9: Undo | Redo — undoVersion forces re-render on stack changes */}
              {(()=>{const canUndo=undoVersion>=0&&undoStackRef.current.length>0,canRedo=undoVersion>=0&&redoStackRef.current.length>0;return(
              <div style={{display:"flex",gap:1}}>
                <button onClick={undo} disabled={!canUndo} aria-label="Undo (Ctrl+Z)" style={{flex:1,height:32,borderRadius:6,border:"none",background:"transparent",color:canUndo?t.tx2:t.bdr,cursor:canUndo?"pointer":"not-allowed",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} title="Undo (Ctrl+Z)">↶</button>
                <button onClick={redo} disabled={!canRedo} aria-label="Redo (Ctrl+Y)" style={{flex:1,height:32,borderRadius:6,border:"none",background:"transparent",color:canRedo?t.tx2:t.bdr,cursor:canRedo?"pointer":"not-allowed",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} title="Redo (Ctrl+Y)">↷</button>
              </div>);})()}
              {/* Row 10: Zoom in | Zoom out */}
              <div style={{display:"flex",gap:1}}>
                <button onClick={()=>dispatch({type:"SET",payload:{zoom:z=>clamp(z*1.3,0.05,15)}})} aria-label="Zoom In" style={{flex:1,height:32,borderRadius:6,border:"none",background:"transparent",color:t.tx2,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} title="Zoom In">＋</button>
                <button onClick={()=>dispatch({type:"SET",payload:{zoom:z=>clamp(z/1.3,0.05,15)}})} aria-label="Zoom Out" style={{flex:1,height:32,borderRadius:6,border:"none",background:"transparent",color:t.tx2,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} title="Zoom Out">－</button>
              </div>
              {/* Row 11: Fit to Window */}
              <div style={{display:"flex",justifyContent:"center"}}>
                <button onClick={()=>{dispatch({type:"SET",payload:{zoom:1}});panRef.current={x:40,y:40};dispatch({type:"SET",payload:{pan:{x:40,y:40}}});}} aria-label="Fit to Window" style={{width:38,height:32,borderRadius:6,border:"none",background:"transparent",color:t.tx2,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} title="Fit to Window (⊙)">⊙</button>
              </div>
              {/* Separator */}
              <div style={{width:"100%",height:1,background:t.bdr,margin:"4px 0"}}/>
              {/* Cal indicator */}
              {calibration.done&&<div style={{display:"flex",justifyContent:"center"}}><div style={{fontSize:8,color:t.ok,fontFamily:"'DM Mono',monospace",fontWeight:700,textAlign:"center",padding:"2px 0"}}>⟺{calibration.pxPerMm.toFixed(1)}</div></div>}
              {/* Zoom % */}
              <div style={{display:"flex",justifyContent:"center"}}><div style={{fontSize:9,color:t.tx3,fontFamily:"'DM Mono',monospace",textAlign:"center",padding:"2px 0"}}>{(zoom*100).toFixed(0)}%</div></div>
            </div>
          </div>
        )}

        {/* TOOL SIDEBAR — mobile: collapsed horizontal bar + expandable sheet */}
        {isMobile&&!showMobilePanel&&(()=>{
          const selTool=(id)=>{dispatch({type:"SET",payload:{activeTool:id}});dispatch({type:"SET",payload:{currentDraw:null}});dispatch({type:"SET",payload:{mobileToolsExpanded:false}});};
          const canUndo=undoVersion>=0&&undoStackRef.current.length>0;
          const canRedo=undoVersion>=0&&redoStackRef.current.length>0;
          const primaryTools=[
            {id:"select",icon:"⊹",label:"Select"},{id:"point",icon:"◉",label:"Landmark"},
            {id:"line",icon:"⟋",label:"Line"},{id:"ruler",icon:"⟺",label:"Ruler"},
          ];
          const secondaryTools=[
            [{id:"pan",icon:"⊕",label:"Pan"},{id:"midpoint",icon:"◈",label:"Midpoint"}],
            [{id:"parallel",icon:"⫿",label:"Parallel"},{id:"perppoint",icon:"⊦",label:"Perp Pt"}],
            [{id:"perp",icon:"⊥",label:"Perp Dist"},{id:"angle3",icon:"∠",label:"Angle 3"}],
            [{id:"angle4",icon:"∡",label:"Angle 4"},{id:"polygon",icon:"⬡",label:"Polygon"}],
            [{id:"curve",icon:"∿",label:"Curve"},{id:"arrow",icon:"→",label:"Arrow"}],
            [{id:"text",icon:"T",label:"Text"}],
          ];
          return(<>
            {/* Collapsed bar — horizontal scroll row */}
            <div style={{position:"fixed",bottom:0,left:0,right:0,height:52,display:"flex",alignItems:"center",borderTop:`1px solid ${t.bdr}`,zIndex:20,background:t.surf,padding:"0 4px",gap:2,overflowX:"auto",overflowY:"hidden",scrollbarWidth:"none",WebkitOverflowScrolling:"touch"}}>
              {primaryTools.map(tool=>(
                <ToolBtn key={tool.id} tool={tool} active={activeTool===tool.id} onClick={()=>selTool(tool.id)} theme={theme} t={t} style={{flexShrink:0}}/>
              ))}
              <div style={{width:1,height:28,background:t.bdr,flexShrink:0}}/>
              <button onClick={undo} disabled={!canUndo} aria-label="Undo" style={{width:42,height:42,borderRadius:8,border:"none",background:"transparent",color:canUndo?t.tx2:t.bdr,cursor:canUndo?"pointer":"not-allowed",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} title="Undo">↶</button>
              <button onClick={redo} disabled={!canRedo} aria-label="Redo" style={{width:42,height:42,borderRadius:8,border:"none",background:"transparent",color:canRedo?t.tx2:t.bdr,cursor:canRedo?"pointer":"not-allowed",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} title="Redo">↷</button>
              <div style={{width:1,height:28,background:t.bdr,flexShrink:0}}/>
              <button onClick={()=>dispatch({type:"SET",payload:{zoom:z=>clamp(z*1.3,0.05,15)}})} aria-label="Zoom In" style={{width:42,height:42,borderRadius:8,border:"none",background:"transparent",color:t.tx2,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>＋</button>
              <button onClick={()=>dispatch({type:"SET",payload:{zoom:z=>clamp(z/1.3,0.05,15)}})} aria-label="Zoom Out" style={{width:42,height:42,borderRadius:8,border:"none",background:"transparent",color:t.tx2,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>－</button>
              <button onClick={()=>{dispatch({type:"SET",payload:{zoom:1}});panRef.current={x:40,y:40};dispatch({type:"SET",payload:{pan:{x:40,y:40}}});}} aria-label="Fit" style={{width:42,height:42,borderRadius:8,border:"none",background:"transparent",color:t.tx2,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>⊙</button>
              <div style={{width:1,height:28,background:t.bdr,flexShrink:0}}/>
              <button onClick={()=>dispatch({type:"SET",payload:{mobileToolsExpanded:v=>!v}})} aria-label="More tools" style={{width:42,height:42,borderRadius:8,border:"none",background:mobileToolsExpanded?t.acc:t.surf2,color:mobileToolsExpanded?(theme==="light"?"#fff":t.bg):t.tx,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:mobileToolsExpanded?`0 0 0 2px ${t.acc}`:"none"}} title="More tools">⋯</button>
            </div>
            {/* Expanded bottom sheet — full tool grid */}
            {mobileToolsExpanded&&(<>
              <div onClick={()=>dispatch({type:"SET",payload:{mobileToolsExpanded:false}})} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.3)",zIndex:19}}/>
              <div style={{position:"fixed",bottom:52,left:0,right:0,maxHeight:"55vh",background:t.surf,borderTop:`1px solid ${t.bdr}`,borderRadius:"12px 12px 0 0",zIndex:20,overflowY:"auto",padding:"12px 8px 16px",boxShadow:`0 -4px 20px ${t.shadow}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,padding:"0 8px"}}>
                  <span style={{fontSize:13,fontWeight:600,color:t.tx2,fontFamily:"'DM Sans',sans-serif"}}>All Tools</span>
                  <span style={{fontSize:9,color:t.tx3,fontFamily:"'DM Mono',monospace"}}>{(zoom*100).toFixed(0)}%{calibration.done?` · ⟺${calibration.pxPerMm.toFixed(1)}`:""}</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                  {secondaryTools.map((row)=>row.map(tool=>(
                    <ToolBtn key={tool.id} tool={tool} active={activeTool===tool.id} onClick={()=>selTool(tool.id)} theme={theme} t={t} style={{flex:1,height:46}}/>
                  )))}
                </div>
              </div>
            </>)}
          </>);
        })()}

        {/* CANVAS */}
        <div ref={containerRef} style={{flex:1,position:"relative",overflow:"hidden",background:t.bg,paddingBottom:isMobile&&!showMobilePanel?52:0}} onDrop={handleDrop} onDragOver={e=>e.preventDefault()}>
          <canvas ref={canvasRef} style={{display:"block",cursor:cursorStyle,touchAction:"none",background:"transparent"}}
            onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
            onDoubleClick={handleDblClick}/>
          {loadingImages&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:t.bg+"cc",zIndex:10}}>
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
          {!isMobile&&<div style={{position:"absolute",bottom:isMobile?60:8,left:30,display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            {/* F1: coordinates now drawn on canvas in redraw() — no DOM element needed */}
            {currentDraw&&<div style={{background:t.acc+"22",border:`1px solid ${t.acc}`,borderRadius:6,padding:"3px 10px",fontSize:11,color:t.acc,fontFamily:"'DM Mono',monospace"}}>
              {["polygon","curve"].includes(activeTool)?`${currentDraw.points.length} pts · dbl-click done`:(()=>{const n={line:2,angle3:3,angle4:4,perp:3,ruler:2}[activeTool];return`${currentDraw.points.length}/${n}`;})()}
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
            {/* Vertical tabs on left side */}
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",paddingTop:8,flexShrink:0,background:t.surf2}}>
              {panelTabs.map(([id,label])=>{
                const icons={
                  markups:<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M621.5-338.5Q680-397 680-480t-58.5-141.5Q563-680 480-680t-141.5 58.5Q280-563 280-480t58.5 141.5Q397-280 480-280t141.5-58.5ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Z"/></svg>,
                  measurements: <svg fill="currentColor" height="24px" width="24px" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" xmlSpace="preserve"> <g><g>
                                <path d="M418.364,0L0,418.364L93.636,512L512,93.636L418.364,0z M22.153,418.364l16.443-16.443l54.875,54.875l11.076-11.076
                                  l-54.875-54.875l10.939-10.939l16.477,16.477l11.076-11.077l-16.477-16.477l10.939-10.939l27.485,27.485l11.077-11.076
                                  l-27.485-27.485l10.939-10.939l16.477,16.477l11.076-11.077l-16.477-16.477l10.939-10.939l54.874,54.875l11.076-11.077
                                  l-54.875-54.875l10.939-10.939l16.477,16.477l11.076-11.076l-16.476-16.474l10.939-10.939l27.485,27.485l11.076-11.076
                                  l-27.485-27.485l10.939-10.939l16.477,16.477l11.076-11.076l-16.477-16.477l10.939-10.939l54.874,54.875l11.077-11.076
                                  l-54.874-54.875l10.939-10.939l16.477,16.477l11.076-11.076l-16.477-16.477l10.939-10.939l27.485,27.485l11.076-11.076
                                  L269.83,170.69l10.939-10.939l16.477,16.477l11.077-11.076l-16.477-16.477l10.939-10.939l54.875,54.875l11.077-11.076
                                  l-54.875-54.874l10.939-10.939l16.477,16.477l11.077-11.076l-16.477-16.477l10.939-10.939l27.485,27.485l11.076-11.076
                                  l-27.489-27.487l10.939-10.939l16.477,16.477l11.077-11.076l-16.478-16.477l10.939-10.939l54.875,54.875l11.076-11.076
                                  l-54.875-54.875l16.443-16.443l71.482,71.482L93.636,489.847L22.153,418.364z"/>
                              </g></g></svg>,
                  formulas:<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M240-160v-80l260-240-260-240v-80h480v120H431l215 200-215 200h289v120H240Z"/></svg>,
                  image:<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm40-80h480L570-480 450-320l-90-120-120 160Zm-40 80v-560 560Z"/></svg>,
                  layers:<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M480-118 120-398l66-50 294 228 294-228 66 50-360 280Zm0-202L120-600l360-280 360 280-360 280Zm0-280Zm0 178 230-178-230-178-230 178 230 178Z"/></svg>,
                  sessions:<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Zm0 0v-80 80Zm280 240q-17 0-28.5-11.5T440-440q0-17 11.5-28.5T480-480q17 0 28.5 11.5T520-440q0 17-11.5 28.5T480-400Zm-188.5-11.5Q280-423 280-440t11.5-28.5Q303-480 320-480t28.5 11.5Q360-457 360-440t-11.5 28.5Q337-400 320-400t-28.5-11.5ZM640-400q-17 0-28.5-11.5T600-440q0-17 11.5-28.5T640-480q17 0 28.5 11.5T680-440q0 17-11.5 28.5T640-400ZM480-240q-17 0-28.5-11.5T440-280q0-17 11.5-28.5T480-320q17 0 28.5 11.5T520-280q0 17-11.5 28.5T480-240Zm-188.5-11.5Q280-263 280-280t11.5-28.5Q303-320 320-320t28.5 11.5Q360-297 360-280t-11.5 28.5Q337-240 320-240t-28.5-11.5ZM640-240q-17 0-28.5-11.5T600-280q0-17 11.5-28.5T640-320q17 0 28.5 11.5T680-280q0 17-11.5 28.5T640-240Z"/></svg>,
                  research:<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M316-80q-52 0-88-38t-36-90q0-36 17-64t45-44l-14-464q-2-62 40-105t104-43q62 0 104 43t40 105l-14 464q28 16 45 44t17 64q0 52-36 90t-88 38H316Zm2-560h124l2-60q1-26-16-45t-43-19q-26 0-43 17t-19 43l-5 64Zm-2 480h128q14 0 24-11t10-25q0-14-9-24t-23-10l-36-2 6-188H344l-4 188-36 2q-14 0-23 10t-9 24q0 14 10 25t24 11Zm-2-80Zm258-20q-14-14-20-30.5t-4-33.5l82-456q5-28 25-48t48-20q32 0 54 24.5t18 56.5l-38 458q-2 26-20.5 44.5T672-200q-26 0-46-17t-24-43h-28Z"/></svg>,
                  interpretation:<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M280-280h280v-80H280v80Zm0-160h400v-80H280v80Zm0-160h400v-80H280v80Zm-80 480q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z"/></svg>,
                  templates:<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M480-60q-50 0-85-35t-35-85q0-39 22.5-70t57.5-43v-73q-11-4-21-9.5T401-389l-63 37q1 5 1.5 10.5t.5 11.5q0 50-35 85t-85 35q-50 0-85-35t-35-85q0-50 35-85t85-35q23 0 43 7.5t36 21.5l62-36q-1-5-1.5-11t-.5-12q0-6 .5-11.5T361-502l-62-37q-16 14-36 21.5t-43 7.5q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 6-.5 12t-1.5 11l63 36q8-8 18-13t21-9v-73q-35-12-57.5-43.5T360-780q0-50 35-85t85-35q50 0 85 35t35 85q0 39-22.5 70.5T520-666v73q11 4 20.5 9.5T558-570l64-38q-1-5-1.5-10.5T620-630q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35q-23 0-42.5-7.5T662-539l-65 38q1 5 1.5 10.5t.5 10.5q0 5-.5 11t-1.5 11l65 37q16-14 35.5-21.5T740-450q50 0 85 35t35 85q0 50-35 85t-85 35q-50 0-85-35t-35-85q0-6 .5-11.5T622-352l-64-37q-8 8-17.5 13t-20.5 9v74q35 12 57.5 43t22.5 70q0 50-35 85t-85 35Zm0-80q17 0 28.5-11.5T520-180q0-17-11.5-28.5T480-220q-17 0-28.5 11.5T440-180q0 17 11.5 28.5T480-140ZM220-290q17 0 28.5-11.5T260-330q0-17-11.5-28.5T220-370q-17 0-28.5 11.5T180-330q0 17 11.5 28.5T220-290Zm520 0q17 0 28.5-11.5T780-330q0-17-11.5-28.5T740-370q-17 0-28.5 11.5T700-330q0 17 11.5 28.5T740-290ZM480-440q17 0 28.5-11.5T520-480q0-17-11.5-28.5T480-520q-17 0-28.5 11.5T440-480q0 17 11.5 28.5T480-440ZM220-590q17 0 28.5-11.5T260-630q0-17-11.5-28.5T220-670q-17 0-28.5 11.5T180-630q0 17 11.5 28.5T220-590Zm520 0q17 0 28.5-11.5T780-630q0-17-11.5-28.5T740-670q-17 0-28.5 11.5T700-630q0 17 11.5 28.5T740-590ZM480-740q17 0 28.5-11.5T520-780q0-17-11.5-28.5T480-820q-17 0-28.5 11.5T440-780q0 17 11.5 28.5T480-740Z"/></svg>,
                   silhouettes:<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M240-80v-170q-39-17-68.5-45.5t-50-64.5q-20.5-36-31-77T80-520q0-158 112-259t288-101q176 0 288 101t112 259q0 42-10.5 83t-31 77q-20.5 36-50 64.5T720-250v170H240Zm80-80h40v-80h80v80h80v-80h80v80h40v-142q38-9 67.5-30t50-50q20.5-29 31.5-64t11-74q0-125-88.5-202.5T480-800q-143 0-231.5 77.5T160-520q0 39 11 74t31.5 64q20.5 29 50.5 50t67 30v142Zm100-200h120l-60-120-60 120Zm-80-80q33 0 56.5-23.5T420-520q0-33-23.5-56.5T340-600q-33 0-56.5 23.5T260-520q0 33 23.5 56.5T340-440Zm280 0q33 0 56.5-23.5T700-520q0-33-23.5-56.5T620-600q-33 0-56.5 23.5T540-520q0 33 23.5 56.5T620-440ZM480-160Z"/></svg>,
                   examples:<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M382-240 154-468l57-56 171 171 367-367 57 57-424 424Z"/></svg>,
                 };
                 return(
                  <button key={id} onClick={()=>setRightPanel(id)} aria-label={label} title={label}
                    onMouseEnter={e=>{if(rightPanel!==id)e.currentTarget.style.background=t.accMuted;e.currentTarget.style.color=t.acc;}}
                    onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=rightPanel===id?t.acc:t.tx;}}
                    style={{width:52,minHeight:52,padding:"6px 4px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,border:"none",background:"transparent",color:rightPanel===id?t.acc:t.tx,cursor:"pointer",borderRadius:8,marginBottom:4,transition:"all 0.15s",boxShadow:rightPanel===id?`inset 2px 0 0 ${t.acc}`:"none"}}>
                    <span style={{fontSize:24}}>{icons[id]||"O"}</span>
                  </button>
                );
              })}
              {/* Collapse/expand toggle */}
              <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"flex-end",paddingBottom:8}}>
                <button ref={toggleBtnRef} onClick={toggleCollapsed} aria-label="Toggle panel" title="Toggle panel"
                  style={{width:44,height:36,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf3,color:t.tx2,cursor:"pointer",fontSize:16,transition:"all 0.15s"}}>
                  ▶
                </button>
              </div>
            </div>
              {/* Panel content — scrollbar hidden but scrollable */}
            <div ref={contentRef} style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0,maxWidth:800,opacity:1,transition:"max-width 0.25s ease, opacity 0.2s ease"}}>
              {/* Panel header — double-click to collapse/expand */}
              <div style={{padding:"12px 14px 10px",borderBottom:`1px solid ${t.bdr}`,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
                 <span style={{fontSize:18}}>{panelIcons[rightPanel]||"𝛜"}</span>
                  <span style={{fontSize:13,fontWeight:700,color:t.tx,textTransform:"capitalize",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{panelTabs.find(([id])=>id===rightPanel)?.[1]}</span>
                </div>
              </div>
              <div style={{flex:1,overflowY:"auto",scrollbarWidth:"none"}}>
                <style>{`.panel-scroll::-webkit-scrollbar{display:none}`}</style>
                <div className="panel-scroll">
                  {rightPanel==="markups"&&<MarkupsPanel markups={markups} t={t} theme={theme} selectedId={selectedId} onSelect={selectAndFocusMarkup} onDelete={delMarkup} onToggleVisible={id=>updMarkup(id,{visible:markups.find(m=>m.id===id)?.visible===false})} onToggleLock={id=>updMarkup(id,{locked:!markups.find(m=>m.id===id)?.locked})} onToggleLabel={id=>updMarkup(id,{noLabel:!markups.find(m=>m.id===id)?.noLabel})} calibration={calibration} placingMode={placingMode} placingQueue={placingQueue} placingIdx={placingIdx} onStopPlacing={()=>{dispatch({type:"SET",payload:{placingMode:false}});dispatch({type:"SET",payload:{placingQueue:[]}});dispatch({type:"SET",payload:{placingIdx:0}});}} onPausePlacing={()=>{dispatch({type:"SET",payload:{placingMode:false}});}} onResumePlacing={()=>{dispatch({type:"SET",payload:{placingMode:true}});}} onClear={()=>updSession({markups:[]})} onAddPoint={()=>{dispatch({type:"SET",payload:{activeTool:"point"}});dispatch({type:"SET",payload:{currentDraw:null}});}} norms={norms} formatAngle={formatAngle} angleMode={angleMode} setAngleMode={setAngleMode} onReplace={(type,id)=>{if(replacingId===id){dispatch({type:"SET",payload:{replacingId:null}});dispatch({type:"SET",payload:{activeTool:"select"}});}else{dispatch({type:"SET",payload:{replacingId:id}});dispatch({type:"SET",payload:{activeTool:type}});}dispatch({type:"SET",payload:{currentDraw:null}});}} replacingId={replacingId}/>}
                  {rightPanel==="measurements"&&<MeasurementsPanel allMeas={allMeas} formulaMeas={formulaMeas} t={t} calibration={calibration} norms={norms} onUpdateNorms={ns=>updSession({norms:ns})} onExportCSV={exportCSV} onOpenCalib={()=>dispatch({type:"SET",payload:{showCalib:true}})} formatAngle={formatAngle}/>}
                  {rightPanel==="formulas"&&<FormulasPanel formulas={formulas} t={t} scope={measScope} onAdd={()=>{dispatch({type:"SET",payload:{editFormulaId:null}});dispatch({type:"SET",payload:{showFormulaEditor:true}});}} onEdit={id=>{dispatch({type:"SET",payload:{editFormulaId:id}});dispatch({type:"SET",payload:{showFormulaEditor:true}});}} onDelete={id=>updSession({formulas:formulas.filter(f=>f.id!==id)})} pinnedFormulas={pinnedFormulas} onPinFormula={id=>setPinnedFormulas(s=>{const n=new Set(s);if(n.has(id))n.delete(id);else n.add(id);return n;})}/>}
                  {rightPanel==="image"&&<ImagePanel t={t} processing={processing} setProcessing={p=>updSession({processing:p})} lutMode={lutMode} setLutMode={m=>updSession({lutMode:m})} lutInvert={lutInvert} setLutInvert={v=>updSession({lutInvert:v})} showLUT={showLUT} setShowLUT={setShowLUT} showScaleBar={showScaleBar} setShowScaleBar={setShowScaleBar} calibration={calibration} onOpenCalib={()=>dispatch({type:"SET",payload:{showCalib:true}})} onReset={()=>updSession({processing:{brightness:0,contrast:0,windowWidth:0,windowCenter:128,edgeEnhance:0},lutMode:"gray",lutInvert:false})} onShowHist={()=>setShowHistogram(v=>!v)} showHistogram={showHistogram}/>}
                  {rightPanel==="layers"&&<LayersPanel t={t} images={sessionImage} onUpdateImages={imgs=>updSession({images:imgs})} onAddImage={()=>stackImgRef.current?.click()} onShowAlign={()=>{}} onShowTransform={()=>{}}/>}
                  {rightPanel==="sessions"&&<SessionsPanel project={project} t={t} onUpdateProject={onUpdateProject} activeSession={activeSession} setActiveSession={id=>onUpdateProject({...project,activeSessionId:id})} onExportTemplate={v=>exportCepht({name:`${project.name}`,projection:project.projection,markups:v.markups||[],formulas:v.formulas||[],norms:v.norms||[]})} compareSession={compareSession} setCompareSession={setCompareSession} showDisplacement={showDisplacement} setShowDisplacement={setShowDisplacement} displacementOverlay={displacementOverlay} setDisplacementOverlay={setDisplacementOverlay} refLandmark1={refLandmark1} setRefLandmark1={setRefLandmark1} refLandmark2={refLandmark2} setRefLandmark2={setRefLandmark2} overlayBlend={overlayBlend} setOverlayBlend={setOverlayBlend} calibration={calibration} formatAngle={formatAngle}/>}
                  {rightPanel==="research"&&<ResearchPanel t={t} project={project} onUpdateProject={onUpdateProject} calibration={calibration}/>}
                  {rightPanel==="interpretation"&&<InterpretationPanel allMeas={allMeas} norms={norms} t={t} formatAngle={formatAngle}/>}
                  {rightPanel==="silhouettes"&&<SilhouettesPanel t={t} onInsert={(silhouetteType) => {
                    try {
                      const def = SILHOUETTES[silhouetteType];
                      if (!def) return;
                      const cw = canvasSize.current?.w || 800, ch = canvasSize.current?.h || 600;
                      const center = toImage(cw / 2, ch / 2);
                      const scale = def.onInsertFit ? Math.min(cw, ch) / 100 : 1;
                      addMarkup({
                        type: "silhouette",
                        silhouetteType,
                        position: center,
                        scale,
                        rotation: 0,
                        color: def.color,
                        fillColor: def.color + "22",
                        width: 1.5,
                        label: def.name,
                        paths: def.paths.map(p => ({
                          ...p,
                          points: p.points.map(pt => ({ ...pt })),
                        })),
                      });
                    } catch(e) { logError("Silhouette insert error:", e); }
                  }}/>}
                  {rightPanel==="templates"&&<TemplatesPanel t={t} projection={project.projection} onLoadTemplate={loadTemplate} onImportCepht={data=>{
          const err=validateCepht(data);if(err){alert(err);return;}
          const hasCoords=data.version==="2.0"&&hasPlacedCoords(data.markups);
          const newMarkups=data.markups.map(m=>{
            const base={...m,id:uid(),definition:m.definition||m.def||"",visible:m.visible!==false};
            if(hasCoords)return{...base,placed:m.placed!==false,points:m.points||[{x:-99999,y:-99999}]};
            return{...base,placed:false,points:m.type==="silhouette"?m.points:[{x:-99999,y:-99999}]};
          });
          updSession({markups:[...markups,...newMarkups],formulas:[...formulas,...(data.formulas||[])],norms:[...norms,...(data.norms||[])],analysisTemplate:data.name||"Imported"});
          if(!hasCoords){setPlacingQueue(newMarkups.filter(m=>!m.placed).map(m=>m.id));dispatch({type:"SET",payload:{placingIdx:0,placingMode:true,rightPanel:"markups"}});}
         }        }/>}
                   {rightPanel==="examples"&&<ExamplesPanel t={t}/>}
                 </div>
              </div>
              {selectedMarkup&&<div style={{borderTop:`1px solid ${t.bdr}`,padding:12,flexShrink:0,maxHeight:isMobile?180:260,overflowY:"auto",scrollbarWidth:"none"}}>
                <MarkupProps m={selectedMarkup} t={t} theme={theme} onUpdate={p=>updMarkup(selectedMarkup.id,p)} onDelete={()=>delMarkup(selectedMarkup.id)} calibration={calibration} onParallel={()=>dispatch({type:"SET",payload:{activeTool:"parallel"}})} formatAngle={formatAngle} norms={norms} onUpdateNorms={ns=>updSession({norms:ns})}/>
              </div>}
            </div>
            {/* Resize handle */}
            <div onMouseDown={()=>dispatch({type:"SET",payload:{rightPanelResizing:true}})} style={{width:4,cursor:"col-resize",background: rightPanelResizing ? t.acc : "transparent",transition:"background 0.15s",flexShrink:0}}/>
          </div>
        )}
      </div>

      {/* MODALS */}
      {showCalib&&<Modal t={t} title="Calibration" onClose={()=>dispatch({type:"SET",payload:{showCalib:false}})}><CalibModal t={t} calibration={calibration} onFinish={finalizeCalib} rulerLabel={pendingRuler?.label||null} rulerCount={markups.filter(m=>m.type==="ruler").length}/></Modal>}
      {showExport&&<Modal t={t} title="Export" onClose={()=>dispatch({type:"SET",payload:{showExport:false}})}><div style={{display:"flex",flexDirection:"column",gap:10}}>
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
      setProjects(lp);
      setActiveId(lp.length>0?lp[0].id:null);
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

  useEffect(()=>{if(loaded)saveProjects(projects).then(()=>{dirtyRef.current=false;});},[projects,loaded]);

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
        {!activeId&&!loaded&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:t.tx3,fontSize:12}}>Loading your projects…</div>}
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
