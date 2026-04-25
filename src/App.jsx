import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { SMV_CSV, OPG_CSV, csvToAnalysis, THEMES, TOOLS, PREDEFINED, LUT_PRESETS } from "./constants.js";
import { uid, clamp, dist, angle3pt, angle4pt, perpDist, polyArea, polyLen, vpts, sampleSpline, splineArea, splineLen, getInfiniteLinePoints, computeMeasurements, catmullRom, perpPoint, snapPoint, snapToLine, alignOnePoint, alignTwoPoints, buildScope, evalFormula, normDeviation, deviationColor, mean, variance, stdev, gammaLn, betaIncomplete, betaCF, tDistributeCDF, tTestPaired, calculateICC, getICCInterpretation, dahlbergError, blandAltman } from "./utils.js";
import { getLUTColor, applyEdgeKernel, processImageToCanvas, computeHistogram, FloatingHistogram } from "./imageUtils.jsx";
import { useKatex, KatexSpan, LatexFloatingPanel } from "./hooks.jsx";
import { Btn, Tag, Sld, PropRow, Inp, Divider, PanelHeader } from "./ui.jsx";
import { drawMarkup, drawInProgress, drawScaleBar, drawLUTLegend, drawSnapIndicator, drawDisplacementVectors, hitTest } from "./markups.jsx";
import { MarkupsPanel, MeasurementsPanel, FormulasPanel, ImagePanel, LayersPanel, MarkupProps, TemplatesPanel, ThemesPanel } from "./panels.jsx";

// PROJECT MODEL
// ═══════════════════════════════════════════════════════════════════════════════
function mkVersion(label="T0",name="Initial"){
  return{id:uid(),name,label,timestamp:Date.now(),calibration:{done:false,pxPerMm:1,knownMm:""},
    markups:[],analysisTemplate:"blank",
    processing:{brightness:0,contrast:0,windowWidth:0,windowCenter:128,edgeEnhance:0},
    lutMode:"gray",lutInvert:false,formulas:[],norms:[]};
}
function mkProject(projection){
  const v=mkVersion();
  return{id:uid(),name:"New Case",projection,created:Date.now(),modified:Date.now(),
    meta:{patientId:"",name:"",dob:"",age:"",gender:"",ethnicity:"",clinician:"",facility:"",referral:"",notes:"",anonymized:false},
    accessControl:{requirePin:false,pinHash:""},
    activeVersionId:v.id,versions:[v],images:[]};
}

async function hashPin(pin){
  const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
}

function exportCephx(project){
  const payload={format:"cephx",version:"2.0",exported:Date.now(),project};
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));
  a.download=`${project.name.replace(/\s+/g,"_")}.cephx`;a.click();
}
function importCephx(file,onLoad){
  const reader=new FileReader();
  reader.onload=e=>{try{const d=JSON.parse(e.target.result);if(d.format==="cephx"&&d.project)onLoad(d.project);else alert("Invalid .cephx file");}catch{alert("Cannot parse file");}};
  reader.readAsText(file);
}
function exportCepht(template){
  const payload={format:"cepht",version:"1.0",exported:Date.now(),...template};
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));
  a.download=`${template.name.replace(/\s+/g,"_")}.cepht`;a.click();
}
function importCepht(file,onLoad){
  const reader=new FileReader();
  reader.onload=e=>{try{const d=JSON.parse(e.target.result);if(d.format==="cepht")onLoad(d);else alert("Invalid .cepht file");}catch{alert("Cannot parse template");}};
  reader.readAsText(file);
}
function exportTemplateAsCepht(project,templateName){
  const excludedTypes=["perp","parallel","arrow","text","ruler"];
  const allMarkups=project.versions[0]?.markups||[];
  const markupsToExport=allMarkups.filter(m=>!excludedTypes.includes(m.type)).map(m=>({type:m.type,label:m.label,definition:m.definition,color:m.color,visible:m.visible}));
  const template={name:templateName,projection:project.projection,markups:markupsToExport,formulas:project.versions[0]?.formulas||[],norms:project.versions[0]?.norms||[]};
  const payload={format:"cepht",version:"1.0",exported:Date.now(),...template};
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));
  a.download=`${templateName.replace(/\s+/g,"_")}.cepht`;a.click();
}

// TOOL BUTTON WITH HOVER EFFECT
// ═══════════════════════════════════════════════════════════════════════════════
function ToolBtn({tool,active,onClick,theme,t,style}){
  const[hov,setHov]=useState(false);
  return(
    <button title={`${tool.label} (${tool.key})`} onClick={onClick}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{width:42,height:42,borderRadius:8,border:"none",
        background:active?t.acc:hov?t.accMuted:"transparent",
        color:active?(theme==="light"?"#fff":t.bg):hov?t.acc:t.tx,
        cursor:"pointer",fontSize:tool.id==="text"?14:20,
        display:"flex",alignItems:"center",justifyContent:"center",
        transition:"all 0.15s",fontWeight:tool.id==="text"?700:400,flexShrink:0,
        boxShadow:active?`0 0 0 2px ${t.acc}`:hov?`0 2px 8px ${t.shadow}`:"none",
        transform:hov&&!active?"translateX(1px)":"none",...style}}>
      {tool.icon}
    </button>
  );
}

// CANVAS DRAWING
// ═══════════════════════════════════════════════════════════════════════════════
/** Reproducibility trial points: only visible while that trial/operator session is actively collecting. */
function isReproPointVisible(m,reproCollecting){
  if(m.type!=="point"||!m.repro)return true;
  if(!reproCollecting)return false;
  return m.repro.studyId===reproCollecting.studyId&&m.repro.opId===reproCollecting.opId&&m.repro.trialIdx===reproCollecting.trialIdx;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOME PAGE (V1 design restored)
// ═══════════════════════════════════════════════════════════════════════════════
function HomePage({t,theme,setTheme,projects,onOpen,onCreate,onImport}){
  const[hov,setHov]=useState(null);const[newProj,setNewProj]=useState(null);
  const fileRef=useRef(null);
  const portals=[
    {id:"lateral",title:"Lateral Cephalogram",subtitle:"Profile view analysis",desc:"Sagittal skeletal & dental relationships, airway analysis, vertical proportions,  growth patterns",analyses:["Steiner","Ricketts","McNamara","Downs","Tweed","Björk-Jarabak"],color:t.acc,
      icon:<svg viewBox="0 0 80 100" width="64" height="80" fill="none"><ellipse cx="48" cy="28" rx="22" ry="26" stroke={t.acc} strokeWidth="2" fill={t.accMuted}/><path d="M26 42 Q20 55 22 65 Q24 75 30 80 Q38 90 50 92" stroke={t.acc} strokeWidth="2" fill="none"/><path d="M50 92 Q55 94 58 90 Q62 84 58 76" stroke={t.acc} strokeWidth="2" fill="none"/><path d="M22 65 Q28 68 36 66 Q44 64 50 68" stroke={t.tx2} strokeWidth="1.5" fill="none" strokeDasharray="3,2"/><circle cx="42" cy="24" r="3" fill={t.acc}/><circle cx="30" cy="30" r="2.5" fill={t.acc} fillOpacity="0.7"/><circle cx="50" cy="62" r="2.5" fill="#f472b6"/><line x1="26" y1="42" x2="68" y2="22" stroke={t.tx3} strokeWidth="1" strokeDasharray="3,2"/></svg>},
    {id:"ap",title:"AP Cephalogram",subtitle:"Frontal / Posteroanterior view",desc:"Transverse skeletal asymmetry, dentoalveolar width, mandibular breadth, frontal facial proportions",analyses:["Ricketts","Grummons","Hewitt","Incisal Canting"],color:"#ab3c61",
      icon:<svg viewBox="0 0 80 100" width="64" height="80" fill="none"><ellipse cx="40" cy="30" rx="26" ry="28" stroke="#6d3349" strokeWidth="2" fill="#a78bfa22"/><line x1="40" y1="2" x2="40" y2="98" stroke={t.tx3} strokeWidth="1" strokeDasharray="3,2"/><path d="M20 58 Q30 72 40 75 Q50 72 60 58" stroke="#fa8bb2" strokeWidth="2" fill="none"/><line x1="14" y1="28" x2="66" y2="28" stroke={t.tx2} strokeWidth="1" strokeDasharray="4,2"/><line x1="18" y1="42" x2="62" y2="42" stroke={t.tx2} strokeWidth="1" strokeDasharray="4,2"/><circle cx="40" cy="10" r="2.5" fill="#fa8ba5"/><circle cx="20" cy="58" r="2.5" fill="#fb923c"/><circle cx="60" cy="58" r="2.5" fill="#fb923c"/></svg>},
    {id:"other",title:"Other Projections",subtitle:"Panoramic, Submentovertex & more",desc:"Panoramic tracing, TMJ analysis, palatal width, airway volumes, custom landmark frameworks",analyses:["Panoramic","Submentovertex","Wits","Custom"],color:"#34d399",
      icon:<svg viewBox="0 0 80 100" width="64" height="80" fill="none"><path d="M10 45 Q15 20 40 18 Q65 20 70 45 Q72 65 68 80 Q60 95 40 96 Q20 95 12 80 Q8 65 10 45Z" stroke="#34d399" strokeWidth="2" fill="#34d39922"/><path d="M20 55 Q25 65 40 68 Q55 65 60 55" stroke="#fb923c" strokeWidth="1.5" fill="none"/><path d="M15 40 Q20 30 40 28 Q60 30 65 40" stroke={t.tx2} strokeWidth="1" strokeDasharray="3,2"/><circle cx="22" cy="48" r="3" fill="#fb923c"/><circle cx="58" cy="48" r="3" fill="#fb923c"/><circle cx="40" cy="25" r="2.5" fill="#34d399"/><circle cx="40" cy="88" r="2.5" fill="#34d399"/></svg>},
  ];

  return(
    <div style={{minHeight:"100vh",background:t.bg,color:t.tx,fontFamily:"'DM Sans',sans-serif",position:"relative",overflow:"hidden"}}>
      <div style={{position:"fixed",inset:0,opacity:0.04,backgroundImage:`linear-gradient(${t.tx} 1px,transparent 1px),linear-gradient(90deg,${t.tx} 1px,transparent 1px)`,backgroundSize:"40px 40px",pointerEvents:"none"}}/>
      {/* HEADER */}
      <header style={{padding:"18px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"absolute",top:0,left:0,right:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:50,height:50,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}><img src="\favicon.svg" alt="Website Icon" width="48" height="48"/> </div>
          <div><div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,letterSpacing:-0.5,color:t.tx}}>Cephalometry Studio</div><div style={{fontSize:10,color:t.tx2,letterSpacing:1,textTransform:"uppercase",fontWeight:600}}>Advanced Cephalometric Analysis</div></div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {Object.values(THEMES).filter(th=>th.inHeader).map(th=>(<button key={th.id} onClick={()=>setTheme(th.id)} title={th.name} style={{width:28,height:28,borderRadius:6,border:theme===th.id?`2px solid ${t.acc}`:`1px solid ${t.bdr}`,background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:12,height:12,borderRadius:3,background:th.bg,border:`1px solid ${th.acc}`,boxShadow:theme===th.id?`0 0 0 2px ${t.acc}`:"none"}}/></button>))}
          <div style={{width:1,height:20,background:t.bdr,margin:"0 4px"}}/>
          <input ref={fileRef} type="file" accept=".cephx" style={{display:"none"}} onChange={e=>{if(e.target.files[0])onImport(e.target.files[0]);e.target.value="";}}/>
          <Btn t={t} small onClick={()=>fileRef.current?.click()}>↑ Import .cephx</Btn>
        </div>
      </header>

      {/* HERO */}
      <div style={{textAlign:"center",padding:"64px 32px 48px"}}>
        <div style={{display:"inline-block",background:t.accMuted,border:`1px solid ${t.acc}44`,borderRadius:20,padding:"5px 16px",fontSize:12,color:t.acc,fontWeight:600,letterSpacing:0.5,marginBottom:24}}>RESEARCH-GRADE IN SILICO CEPHALOMETRY</div>
        <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:"clamp(36px,5vw,64px)",margin:"0 0 16px",lineHeight:1.1,letterSpacing:-2,color:t.tx}}>
          Precision Landmark<br/><span style={{color:t.acc}}>Analysis Platform</span>
        </h1>
        <p style={{color:t.tx2,fontSize:17,maxWidth:640,margin:"0 auto",lineHeight:1.7}}>Calibrate, annotate, and measure with reproducible geometric precision.<br /> Export structured data for computational pipelines.</p>
      </div>

      {/* PORTAL CARDS */}
      <div style={{maxWidth:1100,margin:"0 auto",padding:"0 32px 40px",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:20}}>
        {portals.map(portal=>(
          <div key={portal.id} onMouseEnter={()=>setHov(portal.id)} onMouseLeave={()=>setHov(null)} onClick={()=>setNewProj(portal.id)}
            style={{background:hov===portal.id?t.surf2:t.surf,border:`1px solid ${hov===portal.id?portal.color+"88":t.bdr}`,borderRadius:16,padding:28,cursor:"pointer",transition:"all 0.2s",transform:hov===portal.id?"translateY(-4px)":"none",boxShadow:hov===portal.id?`0 16px 40px ${t.shadow},0 0 0 1px ${portal.color}22`:`0 2px 8px ${t.shadow}`}}>
            <div style={{marginBottom:20,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              {portal.icon}
              <div style={{width:10,height:10,borderRadius:"50%",background:portal.color,marginTop:4}}/>
            </div>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:20,color:t.tx,marginBottom:4}}>{portal.title}</div>
            <div style={{fontSize:12,color:portal.color,fontWeight:600,marginBottom:12,textTransform:"uppercase",letterSpacing:0.5}}>{portal.subtitle}</div>
            <div style={{fontSize:14,color:t.tx2,lineHeight:1.6,marginBottom:20}}>{portal.desc}</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:20}}>{portal.analyses.map(a=><Tag key={a} color={portal.color}>{a}</Tag>)}</div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><span style={{fontSize:12,color:t.tx3}}>Click to open workspace</span><span style={{color:portal.color,fontSize:18}}>→</span></div>
          </div>
        ))}
        </div>

      {/* DEVELOPER CREDITS */}
      <div style={{maxWidth:1100,margin:"0 auto",padding:"0 32px 32px"}}>
        <div style={{background:t.surf,border:`1px solid ${t.bdr}`,borderRadius:12,padding:24,textAlign:"center"}}>
          <div style={{fontSize:11,color:t.tx2,marginBottom:8,lineHeight:1.6}}>
            This website was developed by <strong style={{color:t.tx}}>Dr. Muhammad Nabeel Shaesha</strong>,<br/>
            Teaching Assistant at the Prosthodontics Department, PUA<br/>
            Currently enrolled in Masters of Prosthodontics and Implantology Program, PUA
          </div>
          <div style={{fontSize:10,color:t.tx3,marginTop:12,marginBottom:16}}>Built with the help of</div>
          <div style={{display:"flex",justifyContent:"center",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{background:t.id==="dark"?"#fb923c33":"#f59e0b22",color:t.id==="dark"?"#fdba74":t.tx,border:`1px solid ${t.id==="dark"?"#fb923c66":"#f59e0b44"}`,borderRadius:4,padding:"2px 8px",fontSize:11,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>Claude AI</span>
            <span style={{background:t.id==="dark"?"#60a5fa33":"#60a5fa22",color:t.id==="dark"?"#93c5fd":t.tx,border:`1px solid ${t.id==="dark"?"#60a5fa66":"#60a5fa44"}`,borderRadius:4,padding:"2px 8px",fontSize:11,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>OpenCode</span>
            <span style={{background:t.id==="dark"?"#34d39933":"#34d39922",color:t.id==="dark"?"#6ee7b7":t.tx,border:`1px solid ${t.id==="dark"?"#34d39966":"#34d39944"}`,borderRadius:4,padding:"2px 8px",fontSize:11,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>ChatGPT</span>
            <span style={{background:t.id==="dark"?"#a78bfa33":"#a78bfa22",color:t.id==="dark"?"#c4b5fd":t.tx,border:`1px solid ${t.id==="dark"?"#a78bfa66":"#a78bfa44"}`,borderRadius:4,padding:"2px 8px",fontSize:11,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>Gemini</span>
            <span style={{background:t.id==="dark"?"#f472b633":"#f472b622",color:t.id==="dark"?"#f9a8d4":t.tx,border:`1px solid ${t.id==="dark"?"#f472b666":"#f472b644"}`,borderRadius:4,padding:"2px 8px",fontSize:11,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>Cursor AI</span>
            <span style={{background:t.id==="dark"?"#22d3ee33":"#06b6d422",color:t.id==="dark"?"#67e8f9":t.tx,border:`1px solid ${t.id==="dark"?"#22d3ee66":"#06b6d444"}`,borderRadius:4,padding:"2px 8px",fontSize:11,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>VSCode</span>
            <span style={{background:t.id==="dark"?"#a3e63533":"#84cc1622",color:t.id==="dark"?"#d9f99d":t.tx,border:`1px solid ${t.id==="dark"?"#a3e63566":"#84cc1644"}`,borderRadius:4,padding:"2px 8px",fontSize:11,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>GitHub Pages</span>
          </div>
        </div>
      </div>

      {/* SESSION CASES */}
      {projects.length>0&&<div style={{maxWidth:1100,margin:"0 auto",padding:"0 32px 40px"}}>
        <div style={{fontSize:13,fontWeight:700,color:t.tx2,textTransform:"uppercase",letterSpacing:0.5,marginBottom:16}}>Recent Cases</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:12}}>
          {projects.map(p=>(
            <div key={p.id} onClick={()=>onOpen(p.id)} onMouseEnter={()=>setHov(p.id+"-e")} onMouseLeave={()=>setHov(null)}
              style={{border:`1px solid ${hov===p.id+"-e"?t.acc:t.bdr}`,borderRadius:10,padding:14,cursor:"pointer",background:hov===p.id+"-e"?t.surf2:t.surf,transition:"all 0.15s"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,color:t.tx}}>{p.name}</div>
                <div style={{display:"flex",gap:3}}><Tag color={t.acc}>{p.projection}</Tag>{p.meta?.anonymized&&<Tag color={t.ok}>🔒</Tag>}</div>
              </div>
              <div style={{fontSize:11,color:t.tx2}}>{p.versions.length} version{p.versions.length!==1?"s":""}  ·  {(p.versions.find(v=>v.id===p.activeVersionId)?.markups||[]).length} markups</div>
              <div style={{fontSize:10,color:t.tx3,marginTop:4}}>{new Date(p.modified).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>}

      {/* NEW CASE FORM */}
      {newProj&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={e=>e.target===e.currentTarget&&setNewProj(null)}>
        <div style={{background:t.surf,border:`1px solid ${t.bdr}`,borderRadius:14,padding:28,width:560,maxWidth:"95vw",maxHeight:"90vh",overflowY:"auto"}}>
          <NewCaseForm t={t} projection={newProj} onCreate={(name,meta)=>{onCreate(newProj,name,meta);setNewProj(null);}} onCancel={()=>setNewProj(null)}/>
        </div>
      </div>}

      {/* FEATURE STRIP */}
      <div style={{borderTop:`1px solid ${t.bdr}`,background:t.surf,padding:"24px 32px"}}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"flex",flexWrap:"wrap",gap:24,justifyContent:"center"}}>
          {[["◉","Landmarks"],["⟋","Lines & Planes"],["⬡","Polygon Areas"],["∠","3-pt & 4-pt Angles"],["⊥","Perp Distances"],["∿","B-Spline Traces"],["⟺","Calibration"],["↓","CSV / .cephx Export"]].map(([icon,label])=>(
            <div key={label} style={{display:"flex",alignItems:"center",gap:8,color:t.tx2,fontSize:13}}>
              <span style={{color:t.acc,fontSize:15}}>{icon}</span>{label}
            </div>
          ))}
        </div>
      </div>

      {/* DISCLAIMER */}
      <div style={{background:t.bg,borderTop:`1px solid ${t.bdr}`,padding:"20px 32px 28px"}}>
        <div style={{maxWidth:1100,margin:"0 auto",textAlign:"center"}}>
          <p style={{fontSize:11,color:t.tx3,lineHeight:1.6,margin:0}}>
            Cephalometry Studio is intended for research and educational purposes only. It is not approved or cleared for clinical diagnosis or treatment planning. <br /> Clinical decisions should not be made solely on the basis of measurements produced by this software.
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW CASE FORM
// ═══════════════════════════════════════════════════════════════════════════════
function NewCaseForm({t,projection,onCreate,onCancel}){
  const[d,setD]=useState({name:"Case 001",patientId:"",patientName:"",dob:"",age:"",gender:"",ethnicity:"",clinician:"",facility:"",referral:"",notes:""});
  const upd=(k,v)=>setD(prev=>({...prev,[k]:v}));
  return(
    <div>
      <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:t.tx,marginBottom:20}}>New {projection} Case</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
        {[["name","Case Name *",""],["patientId","Patient ID",""],["patientName","Patient Name",""],["dob","Date of Birth","date"],["age","Age","number"],["gender","","select-gender"],["ethnicity","Ethnicity",""],["clinician","Clinician",""],["facility","Facility",""],["referral","Referral",""],].map(([k,label,type])=>(
          <div key={k}>
            <div style={{fontSize:11,color:t.tx2,marginBottom:3}}>{label||k.charAt(0).toUpperCase()+k.slice(1)}</div>
            {type==="select-gender"?(
              <select value={d[k]} onChange={e=>upd(k,e.target.value)} style={{background:t.surf3,border:`1px solid ${t.bdr}`,borderRadius:4,padding:"4px 8px",color:t.tx,fontSize:12,width:"100%",fontFamily:"inherit"}}>
                <option value="">Select gender…</option>
                {["Male","Female"].map(g=><option key={g} value={g}>{g}</option>)}
              </select>
            ):(
              <input type={type||"text"} value={d[k]} onChange={e=>upd(k,e.target.value)}
                style={{background:t.surf3,border:`1px solid ${t.bdr}`,borderRadius:4,padding:"4px 8px",color:t.tx,fontSize:12,width:"100%",fontFamily:"inherit",boxSizing:"border-box"}}/>
            )}
          </div>
        ))}
      </div>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:11,color:t.tx2,marginBottom:3}}>Notes</div>
        <textarea value={d.notes} onChange={e=>upd("notes",e.target.value)} rows={2}
          style={{background:t.surf3,border:`1px solid ${t.bdr}`,borderRadius:4,padding:"4px 8px",color:t.tx,fontSize:12,width:"100%",fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}}/>
      </div>
      <div style={{display:"flex",gap:8}}><Btn t={t} onClick={()=>onCreate(d.name||"New Case",d)} disabled={!d.name} style={{flex:1}}>Create Case →</Btn><Btn t={t} onClick={onCancel} style={{flex:1}}>Cancel</Btn></div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE PICKER MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function TemplatePickerModal({t,projection,onPick,onClose}){
  const analyses=PREDEFINED[projection]||[];
  const templateRef=useRef(null);
  const[step,setStep]=useState("choose"); // choose | analysis
  const[selectedAnalysis,setSelectedAnalysis]=useState(null);

  if(projection==="other"){
    const otherData=PREDEFINED.other||[];
    const handleProjectionClick=(p)=>{
      if(p.name.includes("SMV")||p.name.includes("Submentovertex")){
        const analyses=csvToAnalysis(SMV_CSV,"General SMV Analysis",p.color);
        onPick("analysis",analyses[0]);
      }else if(p.name.includes("OPG")||p.name.includes("Panoramic")){
        const analyses=csvToAnalysis(OPG_CSV,"General OPG Analysis",p.color);
        onPick("analysis",analyses[0]);
      }else{
        onPick("projection",{name:p.name,def:p.def,color:p.color});
      }
    };
    return(
      <div>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:t.tx,marginBottom:4}}>Select Projection</div>
        <div style={{fontSize:13,color:t.tx2,marginBottom:20}}>Choose the radiographic projection you're working on.</div>
        {otherData.map(group=>(
          <div key={group.group} style={{marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:700,color:t.tx2,marginBottom:8,textTransform:"uppercase",letterSpacing:0.5}}>{group.group}</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {group.projections.map(p=>(
                <div key={p.name} onClick={()=>handleProjectionClick(p)}
                  style={{padding:"12px 14px",border:`1px solid ${t.bdr}`,borderRadius:10,cursor:"pointer",background:t.surf2,borderLeft:`4px solid ${p.color}`,transition:"all 0.15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=p.color;e.currentTarget.style.background=t.accMuted;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=t.bdr;e.currentTarget.style.background=t.surf2;}}>
                  <div style={{fontWeight:700,fontSize:14,color:t.tx,marginBottom:4}}>{p.name}</div>
                  <div style={{fontSize:11,color:t.tx2,lineHeight:1.5}}>{p.def}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <Btn t={t} onClick={onClose} style={{width:"100%",marginTop:8}}>Cancel</Btn>
      </div>
    );
  }

  const options=[
    {id:"blank",icon:"☐",title:"Blank",desc:"Start with a clean canvas. Place your own landmarks, lines, and measurements."},
    {id:"analysis",icon:"⊛",title:"Analysis Template",desc:"Select a predefined landmark set (Steiner, Ricketts, McNamara…) for guided placement."},
    {id:"complete",icon:"⬡",title:"Complete Analysis",desc:"Load all landmark points + standard measurement planes for the selected analysis."},
    {id:"upload",icon:"↑",title:"Upload Template",desc:"Import a .cepht template file shared by a colleague or from a previous case."},
  ];
  if(step==="analysis") return(
    <div>
      <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16,color:t.tx,marginBottom:4}}>Select Analysis</div>
      <div style={{fontSize:12,color:t.tx2,marginBottom:16}}>Choose the analysis landmark set to load.</div>
      {analyses.map(a=>(
        <div key={a.name} onClick={()=>setSelectedAnalysis(a.name)} style={{padding:"10px 14px",marginBottom:8,border:`1px solid ${selectedAnalysis===a.name?t.acc:t.bdr}`,borderRadius:8,cursor:"pointer",background:selectedAnalysis===a.name?t.accMuted:t.surf2,transition:"all 0.15s"}}>
          <div style={{fontWeight:700,fontSize:13,color:t.tx,marginBottom:4}}>{a.name}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>{a.pts.slice(0,8).map(pt=><Tag key={pt.l} color={pt.color}>{pt.l}</Tag>)}{a.pts.length>8&&<Tag color={t.tx3}>+{a.pts.length-8}</Tag>}</div>
        </div>
      ))}
      <div style={{display:"flex",gap:8,marginTop:12}}>
        <Btn t={t} onClick={()=>onPick("analysis",analyses.find(a=>a.name===selectedAnalysis))} disabled={!selectedAnalysis} style={{flex:1}}>Start Placement →</Btn>
        <Btn t={t} onClick={()=>setStep("choose")} style={{flex:1}}>Back</Btn>
      </div>
    </div>
  );
  return(
    <div>
      <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:t.tx,marginBottom:4}}>Choose a Starting Template</div>
      <div style={{fontSize:13,color:t.tx2,marginBottom:20}}>How do you want to set up this analysis session?</div>
      <input ref={templateRef} type="file" accept=".cepht" style={{display:"none"}} onChange={e=>{if(e.target.files[0])onPick("upload",null,e.target.files[0]);e.target.value="";}}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:8}}>
        {options.map(opt=>(
          <div key={opt.id} onClick={()=>{
            if(opt.id==="upload"){templateRef.current?.click();return;}
            if(opt.id==="analysis"){if(analyses.length===0){onPick("blank");return;}setStep("analysis");return;}
            if(opt.id==="complete"){
              const template=projection==="ap"?analyses.find(a=>a.name==="General PA Analysis")||analyses[0]:
                               projection==="lateral"?analyses.find(a=>a.name==="General Ceph Analysis")||analyses[0]:
                               analyses[0];
              if(template)onPick("complete",template);else onPick("blank");
              return;
            }
            onPick(opt.id);
          }}
            style={{padding:"14px 16px",border:`1px solid ${t.bdr}`,borderRadius:10,cursor:"pointer",background:t.surf2,transition:"all 0.15s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=t.acc;e.currentTarget.style.background=t.accMuted;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=t.bdr;e.currentTarget.style.background=t.surf2;}}>
            <div style={{fontSize:24,marginBottom:8}}>{opt.icon}</div>
            <div style={{fontWeight:700,fontSize:13,color:t.tx,marginBottom:4}}>{opt.title}</div>
            <div style={{fontSize:11,color:t.tx2,lineHeight:1.5}}>{opt.desc}</div>
          </div>
        ))}
      </div>
      <Btn t={t} onClick={onClose} style={{width:"100%",marginTop:4}}>Cancel</Btn>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERSIONS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function VersionsPanel({project,t,onUpdateProject,onUpdateVersion,onExportTemplate}){
  const[lbl,setLbl]=useState("T1");const[nm,setNm]=useState("Follow-up");
  const create=()=>{const v=mkVersion(lbl,nm);const src=project.versions.find(x=>x.id===project.activeVersionId);const nv={...v,calibration:src?.calibration,processing:src?.processing,lutMode:src?.lutMode,lutInvert:src?.lutInvert,analysisTemplate:src?.analysisTemplate,markups:src?.markups||[],formulas:src?.formulas||[],norms:src?.norms||[]};onUpdateProject({activeVersionId:nv.id,versions:[...project.versions,nv]});};
  return(
    <div style={{padding:12}}>
      <PanelHeader t={t}>Version History ({project.versions.length})</PanelHeader>
      {project.versions.map(v=>(
        <div key={v.id} style={{marginBottom:8,padding:10,border:`1px solid ${v.id===project.activeVersionId?t.acc:t.bdr}`,borderRadius:8,background:v.id===project.activeVersionId?t.accMuted:t.surf2}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
            <div><div style={{fontSize:12,fontWeight:700,color:t.tx}}>{v.label}: {v.name}</div><div style={{fontSize:10,color:t.tx3}}>{new Date(v.timestamp).toLocaleDateString()} · {(v.markups||[]).length} markups</div></div>
            <div style={{display:"flex",gap:4}}>
              {v.id!==project.activeVersionId&&<button onClick={()=>onUpdateProject({activeVersionId:v.id})} style={{background:t.acc,border:"none",color:t.id==="light"?"#fff":t.bg,borderRadius:4,padding:"2px 8px",cursor:"pointer",fontSize:10,fontWeight:700}}>Switch</button>}
              {v.id===project.activeVersionId&&<Tag color={t.acc}>Active</Tag>}
            </div>
          </div>
          <Btn t={t} small onClick={()=>onExportTemplate(v)} style={{marginTop:4,width:"100%"}}>↓ Export as .cepht template</Btn>
        </div>
      ))}
      <Divider t={t}/>
      <PanelHeader t={t}>New Version</PanelHeader>
      <div style={{display:"flex",gap:6,marginBottom:6}}>
        <div style={{flex:"0 0 52px"}}><div style={{fontSize:10,color:t.tx2,marginBottom:2}}>Label</div><Inp value={lbl} onChange={setLbl} t={t} placeholder="T1"/></div>
        <div style={{flex:1}}><div style={{fontSize:10,color:t.tx2,marginBottom:2}}>Name</div><Inp value={nm} onChange={setNm} t={t} placeholder="Follow-up"/></div>
      </div>
      <Btn t={t} small onClick={create} style={{width:"100%"}}>+ Create Version</Btn>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════════════════════════════
function Modal({t,title,children,onClose,wide}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:t.surf,border:`1px solid ${t.bdr}`,borderRadius:12,padding:24,width:wide?640:420,maxWidth:"95vw",maxHeight:"90vh",overflowY:"auto",boxShadow:`0 24px 60px rgba(0,0,0,0.4)`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16,color:t.tx}}>{title}</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:t.tx2,cursor:"pointer",fontSize:22}}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CalibModal({t,calibration,onFinish}){
  const[mm,setMm]=useState(String(calibration.knownMm||"10"));const[ppm,setPpm]=useState(String(calibration.pxPerMm||"1"));const[mode,setMode]=useState("ruler");
  return(
    <div>
      <div style={{display:"flex",gap:6,marginBottom:16}}>{["ruler","manual"].map(m=><Btn key={m} t={t} small active={mode===m} onClick={()=>setMode(m)}>{m==="ruler"?"From Ruler":"Manual px/mm"}</Btn>)}</div>
      {mode==="ruler"?<><div style={{fontSize:13,color:t.tx2,marginBottom:16,lineHeight:1.6}}>Draw a ruler on the image (⟺ key), then enter its real-world length.</div><PropRow label="Distance (mm)" t={t}><input type="number" value={mm} onChange={e=>setMm(e.target.value)} min="1" style={{background:t.surf2,border:`1px solid ${t.bdr}`,borderRadius:6,padding:"6px 10px",color:t.tx,fontSize:14,width:"100%",fontFamily:"'DM Mono',monospace"}}/></PropRow><Btn t={t} onClick={()=>onFinish(parseFloat(mm))} style={{width:"100%",marginTop:12}}>Set Calibration</Btn></>
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

function AnonModal({t,project,onUpdateProject,onClose}){
  const[pin,setPin]=useState("");const[requirePin,setRequirePin]=useState(project.accessControl?.requirePin||false);
  const anonymize=async()=>{if(!window.confirm("Remove all patient identifiers permanently?"))return;onUpdateProject({meta:{...project.meta,patientId:"ANON-"+uid().toUpperCase(),patientName:"",dob:"",age:"",clinician:"",facility:"",referral:"",notes:"[Anonymized]",anonymized:true}});};
  const savePin=async()=>{if(pin.length<4){alert("PIN must be ≥4 characters");return;}const hash=await hashPin(pin);onUpdateProject({accessControl:{requirePin,pinHash:hash}});setPin("");alert("PIN saved.");};
  return(
    <div>
      <div style={{marginBottom:16,padding:12,background:t.surf2,borderRadius:8,border:`1px solid ${t.bdr}`}}>
        <div style={{fontSize:12,fontWeight:700,color:t.tx,marginBottom:10}}>Patient Metadata</div>
        {[["patientId","Patient ID"],["patientName","Name"],["dob","DOB"],["age","Age"],["gender","Gender"],["clinician","Clinician"],["facility","Facility"]].map(([k,label])=>(
          <PropRow key={k} label={label} t={t}><input type="text" value={project.meta[k]||""} onChange={e=>onUpdateProject({meta:{...project.meta,[k]:e.target.value}})} style={{background:t.surf3,border:`1px solid ${t.bdr}`,borderRadius:4,padding:"4px 8px",color:t.tx,fontSize:12,width:240,fontFamily:"inherit"}}/></PropRow>
        ))}
      </div>
      {project.meta.anonymized?<div style={{padding:10,background:t.ok+"11",border:`1px solid ${t.ok}33`,borderRadius:6,fontSize:12,color:t.ok,marginBottom:16}}>✓ Case is anonymized.</div>:<Btn t={t} danger onClick={anonymize} style={{width:"100%",marginBottom:16}}>🔏 Anonymize (irreversible)</Btn>}
      <Divider t={t}/>
      <div style={{fontSize:12,fontWeight:700,color:t.tx,marginBottom:8}}>Access Control</div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><input type="checkbox" id="rp" checked={requirePin} onChange={e=>setRequirePin(e.target.checked)} style={{accentColor:t.acc}}/><label htmlFor="rp" style={{fontSize:12,color:t.tx}}>Require PIN to open</label></div>
      {requirePin&&<><PropRow label="New PIN" t={t}><input type="password" value={pin} onChange={e=>setPin(e.target.value)} placeholder="Min 4 chars" style={{background:t.surf3,border:`1px solid ${t.bdr}`,borderRadius:4,padding:"4px 8px",color:t.tx,fontSize:12,width:"100%",fontFamily:"inherit"}}/></PropRow><Btn t={t} onClick={savePin} style={{width:"100%"}}>Save PIN</Btn></>}
    </div>
  );
}

function AlignModal({t,markups,images,onUpdateImages,onClose}){
  const pts=markups.filter(m=>m.type==="point"&&vpts(m)[0]?.x>-9000);
  const[src1,setSrc1]=useState("");const[dst1,setDst1]=useState("");const[src2,setSrc2]=useState("");const[dst2,setDst2]=useState("");
  const[tgtId,setTgtId]=useState(images[1]?.id||"");
  const PtSel=({val,onChange})=>(<select value={val} onChange={e=>onChange(e.target.value)} style={{width:"100%",background:t.surf3,border:`1px solid ${t.bdr}`,borderRadius:4,padding:"4px 8px",color:t.tx,fontSize:12,fontFamily:"inherit"}}><option value="">—</option>{pts.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select>);
  const align=()=>{
    const sp1=vpts(markups.find(m=>m.id===src1)||{})[0],dp1=vpts(markups.find(m=>m.id===dst1)||{})[0];if(!sp1||!dp1)return;
    let tf;if(src2&&dst2){const sp2=vpts(markups.find(m=>m.id===src2)||{})[0],dp2=vpts(markups.find(m=>m.id===dst2)||{})[0];tf=sp2&&dp2?alignTwoPoints(sp1,sp2,dp1,dp2):alignOnePoint(sp1,dp1);}else tf=alignOnePoint(sp1,dp1);
    onUpdateImages(images.map(i=>i.id===tgtId?{...i,transform:{tx:tf.tx,ty:tf.ty,rot:tf.rot,scale:tf.scale}}:i));onClose();
  };
  return(
    <div>
      <div style={{fontSize:12,color:t.tx2,marginBottom:14,lineHeight:1.6}}>1 pair = translation only · 2 pairs = translation + rotation</div>
      <PropRow label="Target" t={t}><select value={tgtId} onChange={e=>setTgtId(e.target.value)} style={{width:"100%",background:t.surf3,border:`1px solid ${t.bdr}`,borderRadius:4,padding:"4px 8px",color:t.tx,fontSize:12,fontFamily:"inherit"}}>{images.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></PropRow>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
        <div><div style={{fontSize:10,color:t.tx2,marginBottom:2}}>Src pt 1</div><PtSel val={src1} onChange={setSrc1}/></div>
        <div><div style={{fontSize:10,color:t.tx2,marginBottom:2}}>Dst pt 1</div><PtSel val={dst1} onChange={setDst1}/></div>
        <div><div style={{fontSize:10,color:t.tx2,marginBottom:2}}>Src pt 2</div><PtSel val={src2} onChange={setSrc2}/></div>
        <div><div style={{fontSize:10,color:t.tx2,marginBottom:2}}>Dst pt 2</div><PtSel val={dst2} onChange={setDst2}/></div>
      </div>
      <div style={{display:"flex",gap:8}}><Btn t={t} onClick={align} style={{flex:1}} disabled={!src1||!dst1}>Apply</Btn><Btn t={t} onClick={onClose} style={{flex:1}}>Cancel</Btn></div>
    </div>
  );
}

function TransformModal({t,images,onUpdateImages,onClose}){
  const[aid,setAid]=useState(images[0]?.id||"");
  const img=images.find(i=>i.id===aid);const tf=img?.transform||{tx:0,ty:0,rot:0,scale:1};
  const upd=p=>onUpdateImages(images.map(i=>i.id===aid?{...i,transform:{...tf,...p}}:i));
  return(
    <div>
      <PropRow label="Image" t={t}><select value={aid} onChange={e=>setAid(e.target.value)} style={{width:"100%",background:t.surf3,border:`1px solid ${t.bdr}`,borderRadius:4,padding:"4px 8px",color:t.tx,fontSize:12,fontFamily:"inherit"}}>{images.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></PropRow>
      {img&&<><Sld label="Translate X" value={tf.tx||0} min={-500} max={500} onChange={v=>upd({tx:v})} t={t} unit=" px"/><Sld label="Translate Y" value={tf.ty||0} min={-500} max={500} onChange={v=>upd({ty:v})} t={t} unit=" px"/><Sld label="Rotation" value={Math.round(((tf.rot||0)*180/Math.PI))} min={-180} max={180} onChange={v=>upd({rot:v*Math.PI/180})} t={t} unit="°"/><Sld label="Scale" value={tf.scale||1} min={0.1} max={3} step={0.01} onChange={v=>upd({scale:v})} t={t}/><Btn t={t} small onClick={()=>upd({tx:0,ty:0,rot:0,scale:1})} style={{marginTop:6}}>Reset</Btn></>}
      <Btn t={t} onClick={onClose} style={{width:"100%",marginTop:12}}>Done</Btn>
    </div>
  );
}

function FormulaEditor({t,formula,scope,onSave,onClose}){
  const[name,setName]=useState(formula?.name||"");const[latex,setLatex]=useState(formula?.latex||"");
  const[expr,setExpr]=useState(formula?.expression||"");const[unit,setUnit]=useState(formula?.unit||"");const[desc,setDesc]=useState(formula?.description||"");
  const[bigLatex,setBigLatex]=useState(null);
  const preview=useMemo(()=>evalFormula(expr,scope),[expr,scope]);
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
        <div style={{fontSize:11,color:t.tx2,marginBottom:3}}>Expression (mathjs)</div>
        <Inp value={expr} onChange={setExpr} t={t} placeholder="SNA_angle - SNB_angle"/>
        <div style={{fontSize:10,color:t.tx3,marginTop:4}}>Vars: {Object.keys(scope).slice(0,6).join(", ")}{Object.keys(scope).length>6?"…":""}</div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",padding:"6px 8px",background:preview!==null?t.ok+"11":expr?t.err+"11":t.surf2,borderRadius:6,marginBottom:8}}>
        <span style={{fontSize:12,color:t.tx2}}>Preview</span>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:700,color:preview!==null?t.ok:expr?t.err:t.tx3}}>{preview!==null?`${preview.toFixed(2)} ${unit}`:expr?"Error":"—"}</span>
      </div>
      <PropRow label="Unit" t={t}><Inp value={unit} onChange={setUnit} t={t} placeholder="°, mm, ratio"/></PropRow>
      <PropRow label="Notes" t={t}><Inp value={desc} onChange={setDesc} t={t} placeholder="Reference"/></PropRow>
      <div style={{display:"flex",gap:8,marginTop:14}}><Btn t={t} onClick={()=>onSave({id:formula?.id||uid(),name,latex,expression:expr,unit,description:desc})} style={{flex:1}} disabled={!name||!expr}>Save</Btn><Btn t={t} onClick={onClose} style={{flex:1}}>Cancel</Btn></div>
      {bigLatex&&<LatexFloatingPanel latex={bigLatex} onClose={()=>setBigLatex(null)}/>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE MODE MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function DatabaseImportModal({t,onImport,onClose}){
  const fileRef=useRef(null);
  const[files,setFiles]=useState([]);

  const handleFileChange=e=>{
    const newFiles=Array.from(e.target.files);
    setFiles(prev=>[...prev,...newFiles]);
  };

  const removeFile=idx=>{
    setFiles(prev=>prev.filter((_,i)=>i!==idx));
  };

  const handleImport=()=>{
    if(files.length===0)return;
    onImport(files);
    onClose();
  };

  return(
    <div>
      <div style={{fontSize:13,color:t.tx2,marginBottom:16,lineHeight:1.5}}>
        Select multiple images to import for batch processing. Each image will have its own markups and calibration.
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={handleFileChange}/>
      <div onClick={()=>fileRef.current?.click()} style={{border:`2px dashed ${t.bdr}`,borderRadius:10,padding:24,textAlign:"center",cursor:"pointer",marginBottom:16}}>
        <div style={{fontSize:24,marginBottom:8}}>📁</div>
        <div style={{fontSize:13,color:t.tx}}>Click to select images</div>
        <div style={{fontSize:11,color:t.tx3}}>or drag and drop</div>
      </div>
      {files.length>0&&(
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:t.tx2,marginBottom:8}}>Selected files ({files.length})</div>
          <div style={{maxHeight:180,overflowY:"auto"}}>
            {files.map((f,idx)=>(
              <div key={idx} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",background:t.surf2,borderRadius:6,marginBottom:4}}>
                <span style={{flex:1,fontSize:11,color:t.tx,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</span>
                <span style={{fontSize:10,color:t.tx3}}>{(f.size/1024).toFixed(1)} KB</span>
                <button onClick={()=>removeFile(idx)} style={{background:"none",border:"none",color:t.tx3,cursor:"pointer",fontSize:14}}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{display:"flex",gap:8}}>
        <Btn t={t} onClick={handleImport} disabled={files.length===0} style={{flex:1}}>Import {files.length} Image{files.length!==1?"s":""}</Btn>
        <Btn t={t} onClick={onClose} style={{flex:1}}>Cancel</Btn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATS DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function mean$1(arr){
  if(!arr.length) return null;
  return arr.reduce((a,b)=>a+b,0)/arr.length;
}

function std$1(arr){
  if(arr.length < 2) return null;
  const m = mean$1(arr);
  return Math.sqrt(arr.reduce((s,x)=>s+(x-m)**2,0)/(arr.length-1));
}

function median$1(arr){
  if(!arr.length) return null;
  const sorted = [...arr].sort((a,b)=>a-b);
  const mid = Math.floor(sorted.length/2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2;
}

function range$1(arr){
  if(!arr.length) return null;
  return { min: Math.min(...arr), max: Math.max(...arr) };
}

function correlation$1(x,y){
  if(x.length !== y.length || x.length < 2) return null;
  const mx = mean$1(x);
  const my = mean$1(y);
  const num = x.reduce((s,xi,i)=>s+(xi-mx)*(y[i]-my),0);
  const den = Math.sqrt(
    x.reduce((s,xi)=>s+(xi-mx)**2,0) *
    y.reduce((s,yi)=>s+(yi-my)**2,0)
  );
  return den === 0 ? null : num/den;
}

function groupBy$1(dataset, key){
  return dataset.reduce((acc, item)=>{
    const k = item[key] || "undefined";
    if(!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

function extractVariable$1(dataset, variable){
  return dataset
    .map(c => c.measurements?.[variable] ?? c.formulas?.[variable])
    .filter(v => typeof v === "number");
}

function descriptiveStats$1(values){
  return {
    n: values.length,
    mean: mean$1(values),
    sd: std$1(values),
    median: median$1(values),
    range: range$1(values)
  };
}

function StatsDashboard({ dataset, t }) {
  const [selectedVar, setSelectedVar] = useState("SNA");
  const [groupKey, setGroupKey] = useState("group");

  const variables = useMemo(()=>{
    if(!dataset.length) return [];
    return Object.keys({
      ...(dataset[0]?.measurements||{}),
      ...(dataset[0]?.formulas||{})
    });
  },[dataset]);

  const values = useMemo(()=> extractVariable$1(dataset, selectedVar), [dataset, selectedVar]);
  const stats = useMemo(()=> descriptiveStats$1(values), [values]);
  const grouped = useMemo(()=> groupBy$1(dataset, groupKey), [dataset, groupKey]);

  return (
    <div style={{padding:16}}>
      <h3 style={{fontSize:14,fontWeight:700,color:"inherit",marginBottom:12}}>Statistical Dashboard</h3>
      <div style={{marginBottom:10}}>
        <label style={{fontSize:11,color:t.tx2,marginRight:8}}>Variable: </label>
        <select value={selectedVar} onChange={e=>setSelectedVar(e.target.value)} style={{padding:"4px 8px",border:`1px solid ${t.bdr}`,borderRadius:4,background:t.surf3,color:t.tx,fontSize:11}}>
          {variables.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>
      <div style={{marginBottom:20, padding:10, border:"1px solid "+t.bdr,borderRadius:8}}>
        <strong style={{fontSize:11,color:t.tx}}>Descriptive Statistics</strong>
        <div style={{fontSize:11,marginTop:6}}>N = {stats.n}</div>
        <div style={{fontSize:11}}>Mean = {stats.mean?.toFixed(2)}</div>
        <div style={{fontSize:11}}>SD = {stats.sd?.toFixed(2)}</div>
        <div style={{fontSize:11}}>Median = {stats.median?.toFixed(2)}</div>
        <div style={{fontSize:11}}>Range = {stats.range ? `${stats.range.min} – ${stats.range.max}` : "-"}</div>
      </div>
      <div style={{marginBottom:20}}>
        <label style={{fontSize:11,color:t.tx2,marginRight:8}}>Group by: </label>
        <select value={groupKey} onChange={e=>setGroupKey(e.target.value)} style={{padding:"4px 8px",border:`1px solid ${t.bdr}`,borderRadius:4,background:t.surf3,color:t.tx,fontSize:11}}>
          <option value="group">Group</option>
          <option value="timepoint">Timepoint</option>
          <option value="operator">Operator</option>
        </select>
        {Object.entries(grouped).map(([g, cases])=>{
          const vals = extractVariable$1(cases, selectedVar);
          const s = descriptiveStats$1(vals);
          return (
            <div key={g} style={{marginTop:8, padding:8, border:"1px solid "+t.bdr,borderRadius:6}}>
              <strong style={{fontSize:11,color:t.tx}}>{g}</strong>
              <div style={{fontSize:10}}>Mean: {s.mean?.toFixed(2)}</div>
              <div style={{fontSize:10}}>SD: {s.sd?.toFixed(2)}</div>
            </div>
          );
        })}
      </div>
      <div style={{marginBottom:20}}>
        <strong style={{fontSize:11,color:t.tx}}>Correlation (Quick)</strong>
        {variables.slice(0,5).map(v=>{
          const arr = extractVariable$1(dataset, v);
          const r = correlation$1(values, arr);
          return (
            <div key={v} style={{fontSize:10,color:t.tx2}}>
              {selectedVar} vs {v}: {r ? r.toFixed(2) : "-"}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKUP TABLES PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function MarkupTablesPanel({databaseImages,currentImageIndex,t,formatAngle}){
  const[activeTable,setActiveTable]=useState("points");

  const exportTableCSV=(type)=>{
    const rows=[["Variable",...databaseImages.map((_,i)=>`Image ${i+1}`)]];
    
    if(type==="points"){
      const maxPoints=Math.max(...databaseImages.map(img=>(img.markups||[]).filter(m=>m.type==="point").length));
      for(let ptIdx=0;ptIdx<maxPoints;ptIdx++){
        rows.push([`P${ptIdx+1}_X`]);
        rows.push([`P${ptIdx+1}_Y`]);
      }
      databaseImages.forEach((img,imgIdx)=>{
        const points=(img.markups||[]).filter(m=>m.type==="point");
        points.forEach((pt,ptIdx)=>{
          const vp=vpts(pt);
          if(vp.length>0){
            rows[ptIdx+1].push(vp[0].x.toFixed(2));
            rows[ptIdx+1+maxPoints].push(vp[0].y.toFixed(2));
          }else{
            rows[ptIdx+1].push("");
            rows[ptIdx+1+maxPoints].push("");
          }
        });
      });
    }else if(type==="lines"){
      const maxLines=Math.max(...databaseImages.map(img=>(img.markups||[]).filter(m=>m.type==="line"||m.type==="parallel").length));
      for(let i=0;i<maxLines;i++)rows.push([`Line${i+1}_length`]);
      databaseImages.forEach((img,imgIdx)=>{
        const lines=(img.markups||[]).filter(m=>m.type==="line"||m.type==="parallel");
        lines.forEach((ln,lnIdx)=>{
          const meas=computeMeasurements(ln,img.calibration);
          rows[lnIdx+1].push(meas.length?.toFixed(2)||"");
        });
      });
    }else if(type==="angles"){
      const maxAngles=Math.max(...databaseImages.map(img=>[...(img.markups||[]).filter(m=>m.type==="angle3"),...(img.markups||[]).filter(m=>m.type==="angle4")].length));
      for(let i=0;i<maxAngles;i++){
        rows.push([`Angle${i+1}_deg`]);
        rows.push([`Angle${i+1}_rad`]);
      }
      databaseImages.forEach((img,imgIdx)=>{
        const angles=[...(img.markups||[]).filter(m=>m.type==="angle3"),...(img.markups||[]).filter(m=>m.type==="angle4")];
        angles.forEach((ang,angIdx)=>{
          const meas=computeMeasurements(ang,img.calibration);
          rows[angIdx*2+1].push(meas.angle?.toFixed(2)||"");
          rows[angIdx*2+2].push(meas.angle?((meas.angle*Math.PI/180).toFixed(4)):"");
        });
      });
    }else if(type==="curves"){
      const maxCurves=Math.max(...databaseImages.map(img=>(img.markups||[]).filter(m=>m.type==="curve").length));
      for(let i=0;i<maxCurves;i++)rows.push([`Curve${i+1}_length`]);
      databaseImages.forEach((img,imgIdx)=>{
        const curves=(img.markups||[]).filter(m=>m.type==="curve");
        curves.forEach((cv,cvIdx)=>{
          const meas=computeMeasurements(cv,img.calibration);
          rows[cvIdx+1].push(meas.length?.toFixed(2)||"");
        });
      });
    }else if(type==="polygons"){
      const maxPolys=Math.max(...databaseImages.map(img=>(img.markups||[]).filter(m=>m.type==="polygon").length));
      for(let i=0;i<maxPolys;i++){
        rows.push([`Polygon${i+1}_area`]);
        rows.push([`Polygon${i+1}_perimeter`]);
      }
      databaseImages.forEach((img,imgIdx)=>{
        const polys=(img.markups||[]).filter(m=>m.type==="polygon");
        polys.forEach((poly,polyIdx)=>{
          const meas=computeMeasurements(poly,img.calibration);
          rows[polyIdx*2+1].push(meas.area?.toFixed(2)||"");
          rows[polyIdx*2+2].push(meas.perimeter?.toFixed(2)||"");
        });
      });
    }

    const csv=rows.map(r=>r.join(",")).join("\n");
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download=`markups_${type}_table.csv`;
    a.click();
  };

  const tableTypes=[
    {id:"points",label:"Points",icon:"◉"},
    {id:"lines",label:"Lines",icon:"⟋"},
    {id:"angles",label:"Angles",icon:"∠"},
    {id:"curves",label:"Curves",icon:"∿"},
    {id:"polygons",label:"Polygons",icon:"⬡"},
  ];

  const getTableData=()=>{
    if(activeTable==="points"){
      const maxPoints=Math.max(...databaseImages.map(img=>(img.markups||[]).filter(m=>m.type==="point").length));
      const allPoints=[];
      for(let ptIdx=0;ptIdx<maxPoints;ptIdx++){
        allPoints[ptIdx]={label:`P${ptIdx+1}`,values:[]};
        databaseImages.forEach((img,imgIdx)=>{
          const points=(img.markups||[]).filter(m=>m.type==="point");
          const pt=points[ptIdx];
          if(pt){
            const vp=vpts(pt);
            allPoints[ptIdx].values[imgIdx]=vp.length>0?{x:vp[0].x,y:vp[0].y}:null;
          }
        });
      }
      return allPoints;
    }else if(activeTable==="lines"){
      const maxLines=Math.max(...databaseImages.map(img=>(img.markups||[]).filter(m=>m.type==="line"||m.type==="parallel").length));
      const allLines=[];
      for(let lnIdx=0;lnIdx<maxLines;lnIdx++){
        allLines[lnIdx]={label:`Line${lnIdx+1}`,values:[]};
        databaseImages.forEach((img,imgIdx)=>{
          const lines=[...(img.markups||[]).filter(m=>m.type==="line"),...(img.markups||[]).filter(m=>m.type==="parallel")];
          const ln=lines[lnIdx];
          if(ln){
            const meas=computeMeasurements(ln,img.calibration);
            allLines[lnIdx].values[imgIdx]=meas.length;
          }
        });
      }
      return allLines;
    }else if(activeTable==="angles"){
      const maxAngles=Math.max(...databaseImages.map(img=>[...(img.markups||[]).filter(m=>m.type==="angle3"),...(img.markups||[]).filter(m=>m.type==="angle4")].length));
      const allAngles=[];
      for(let angIdx=0;angIdx<maxAngles;angIdx++){
        allAngles[angIdx]={label:`Angle${angIdx+1}`,values:[]};
        databaseImages.forEach((img,imgIdx)=>{
          const angles=[...(img.markups||[]).filter(m=>m.type==="angle3"),...(img.markups||[]).filter(m=>m.type==="angle4")];
          const ang=angles[angIdx];
          if(ang){
            const meas=computeMeasurements(ang,img.calibration);
            allAngles[angIdx].values[imgIdx]=meas.angle;
          }
        });
      }
      return allAngles;
    }else if(activeTable==="curves"){
      const maxCurves=Math.max(...databaseImages.map(img=>(img.markups||[]).filter(m=>m.type==="curve").length));
      const allCurves=[];
      for(let cvIdx=0;cvIdx<maxCurves;cvIdx++){
        allCurves[cvIdx]={label:`Curve${cvIdx+1}`,values:[]};
        databaseImages.forEach((img,imgIdx)=>{
          const curves=(img.markups||[]).filter(m=>m.type==="curve");
          const cv=curves[cvIdx];
          if(cv){
            const meas=computeMeasurements(cv,img.calibration);
            allCurves[cvIdx].values[imgIdx]=meas.length;
          }
        });
      }
      return allCurves;
    }else if(activeTable==="polygons"){
      const maxPolys=Math.max(...databaseImages.map(img=>(img.markups||[]).filter(m=>m.type==="polygon").length));
      const allPolys=[];
      for(let polyIdx=0;polyIdx<maxPolys;polyIdx++){
        allPolys[polyIdx]={label:`Polygon${polyIdx+1}`,values:[]};
        databaseImages.forEach((img,imgIdx)=>{
          const polys=(img.markups||[]).filter(m=>m.type==="polygon");
          const poly=polys[polyIdx];
          if(poly){
            const meas=computeMeasurements(poly,img.calibration);
            allPolys[polyIdx].values[imgIdx]={area:meas.area,perimeter:meas.perimeter};
          }
        });
      }
      return allPolys;
    }
    return[];
  };

  const tableData=getTableData();
  const numImages=databaseImages.length;

  return(
    <div>
      <div style={{display:"flex",gap:4,marginBottom:8}}>
        {tableTypes.map(tt=>(
          <button key={tt.id} onClick={()=>setActiveTable(tt.id)} style={{padding:"6px 12px",borderRadius:6,border:`1px solid ${activeTable===tt.id?t.acc:t.bdr}`,background:activeTable===tt.id?t.acc+"22":"transparent",color:activeTable===tt.id?t.acc:t.tx,cursor:"pointer",fontSize:12}}>
            {tt.icon} {tt.label}
          </button>
        ))}
      </div>
      <div style={{marginBottom:12}}>
        <button onClick={()=>exportTableCSV(activeTable)} style={{width:"100%",padding:"8px 12px",borderRadius:6,border:`1px solid ${t.bdr}`,background:t.surf2,color:t.tx,cursor:"pointer",fontSize:12,textAlign:"center"}}>⬇ Export CSV</button>
      </div>
      {tableData.length===0?<div style={{color:t.tx2,textAlign:"center",padding:20}}>No {activeTable} data</div>:(
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"'DM Mono',monospace"}}>
            <thead>
              <tr>
                <th style={{textAlign:"left",padding:"8px 12px",borderBottom:`1px solid ${t.bdr}`,background:t.surf2,color:t.tx2}}>{activeTable}</th>
                {databaseImages.map((img,i)=>(
                  <th key={i} style={{textAlign:"center",padding:"8px 12px",borderBottom:`1px solid ${t.bdr}`,background:t.surf2,color:t.acc}}>Img {i+1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((row,rowIdx)=>(
                <tr key={rowIdx}>
                  <td style={{padding:"8px 12px",borderBottom:`1px solid ${t.bdr}`,color:t.tx,fontWeight:500}}>{row.label}</td>
                  {row.values.map((v,colIdx)=>(
                    <td key={colIdx} style={{padding:"8px 12px",borderBottom:`1px solid ${t.bdr}`,textAlign:"center",color:v!=null?t.tx:t.tx3}}>
                      {v==null?"-":activeTable==="points"?`(${v.x?.toFixed(1)??'-'},${v.y?.toFixed(1)??'-'})`:activeTable==="polygons"?`A:${v.area?.toFixed(1)??'-'} P:${v.perimeter?.toFixed(1)??'-'}`:typeof v==="number"?v.toFixed(2):v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE STATS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function DatabaseStatsPanel({databaseImages,currentImageIndex,t}){
  const[view,setView]=useState("tables");

  const buildDataset=()=>{
    const dataset=[];
    databaseImages.forEach((img,idx)=>{
      const entry={id:`img_${idx}`,measurements:{},formulas:{},group:"default",timepoint:`T${idx+1}`,operator:"default"};
      const angle3Count={current:0};
      const angle4Count={current:0};
      (img.markups||[]).forEach(m=>{
        const meas=computeMeasurements(m,img.calibration);
        let label;
        if(m.type==="angle3"){
          angle3Count.current++;
          label=`Angle_${angle3Count.current}`;
        }else if(m.type==="angle4"){
          angle4Count.current++;
          label=`Inc_Angle_${angle4Count.current}`;
        }else{
          label=m.label||m.type;
        }
        Object.entries(meas).forEach(([k,v])=>{
          entry.measurements[`${label}_${k}`]=v;
        });
      });
      dataset.push(entry);
    });
    return dataset;
  };

  return(
    <div style={{padding:12}}>
      <div style={{display:"flex",gap:6,marginBottom:16}}>
        <Btn t={t} small active={view==="tables"} onClick={()=>setView("tables")}>Registered Markups</Btn>
        <Btn t={t} small active={view==="dashboard"} onClick={()=>setView("dashboard")}>Statistics Dashboard</Btn>
      </div>
      {view==="tables"&&<MarkupTablesPanel databaseImages={databaseImages} currentImageIndex={currentImageIndex} t={t} formatAngle={(v)=>v.toFixed(1)+"°"}/>}
      {view==="dashboard"&&<StatsDashboard dataset={buildDataset()} t={t}/>}
    </div>
  );
}
function PinGate({t,project,onVerified,onCancel}){
  const[pin,setPin]=useState("");const[err,setErr]=useState(false);
  const verify=async()=>{const h=await hashPin(pin);if(h===project.accessControl.pinHash)onVerified();else{setErr(true);setPin("");}};
  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:t.bg}}>
      <div style={{background:t.surf,border:`1px solid ${t.bdr}`,borderRadius:12,padding:32,width:300,boxShadow:`0 16px 48px ${t.shadow}`,textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:12}}>🔒</div>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:t.tx,marginBottom:4}}>{project.name}</div>
        <div style={{fontSize:12,color:t.tx2,marginBottom:20}}>PIN required to open this case.</div>
        <input type="password" value={pin} onChange={e=>setPin(e.target.value)} onKeyDown={e=>e.key==="Enter"&&verify()} placeholder="Enter PIN" autoFocus
          style={{width:"100%",background:t.surf3,border:`1px solid ${err?t.err:t.bdr}`,borderRadius:8,padding:"10px 12px",color:t.tx,fontSize:16,fontFamily:"'DM Mono',monospace",textAlign:"center",marginBottom:12,boxSizing:"border-box"}}/>
        {err&&<div style={{fontSize:12,color:t.err,marginBottom:12}}>Incorrect PIN.</div>}
        <div style={{display:"flex",gap:8}}><Btn t={t} onClick={verify} style={{flex:1}}>Unlock</Btn><Btn t={t} onClick={onCancel} style={{flex:1}}>Back</Btn></div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE
// ═══════════════════════════════════════════════════════════════════════════════
function Workspace({project,onUpdateProject,onUpdateVersion,onHome,t,theme,setTheme}){
  const canvasRef=useRef(null);const containerRef=useRef(null);
  const procCache=useRef(new Map());const imgRefs=useRef({});

  // file input refs
  const openImgRef=useRef(null);const stackImgRef=useRef(null);const importRef=useRef(null);const cephtRef=useRef(null);

  const[zoom,setZoom]=useState(1);const[pan,setPan]=useState({x:40,y:40});
  const[mousePos,setMousePos]=useState(null);const[snapPos,setSnapPos]=useState(null);
  const[selectedId,setSelectedId]=useState(null);const[replacingId,setReplacingId]=useState(null);const[currentDraw,setCurrentDraw]=useState(null);
  const[activeTool,setActiveTool]=useState("select");const[curveMode,setCurveMode]=useState("linear");
  const[snapEnabled,setSnapEnabled]=useState(true);const[showScaleBar,setShowScaleBar]=useState(false);
  const[showLUT,setShowLUT]=useState(false);const[showHistogram,setShowHistogram]=useState(false);
  const[showAnnotations,setShowAnnotations]=useState(true);const[annotationSize,setAnnotationSize]=useState(1);const[showDisplacement,setShowDisplacement]=useState(false);const[compareVersionId,setCompareVersionId]=useState(null);
  const[rightPanel,setRightPanel]=useState("markups");
  const[showCalib,setShowCalib]=useState(false);const[pendingRuler,setPendingRuler]=useState(null);
  const[showExport,setShowExport]=useState(false);const[showAnon,setShowAnon]=useState(false);
  const[showAlign,setShowAlign]=useState(false);const[showTransform,setShowTransform]=useState(false);
  const[pendingTextPos,setPendingTextPos]=useState(null);
  const[showFormulaEditor,setShowFormulaEditor]=useState(false);const[editFormulaId,setEditFormulaId]=useState(null);
  const[placingMode,setPlacingMode]=useState(false);const[placingQueue,setPlacingQueue]=useState([]);const[placingIdx,setPlacingIdx]=useState(0);
  const[showTemplatePicker,setShowTemplatePicker]=useState(true);
  const[isMobile,setIsMobile]=useState(()=>window.innerWidth<768);const[showMobilePanel,setShowMobilePanel]=useState(false);
  const[toolbarFloating,setToolbarFloating]=useState(false);const[toolbarPos,setToolbarPos]=useState({x:70,y:100});
  const[toolbarDragging,setToolbarDragging]=useState(false);const[toolbarDragStart,setToolbarDragStart]=useState(null);
  const[rightPanelWidth,setRightPanelWidth]=useState(320);const[rightPanelResizing,setRightPanelResizing]=useState(false);
  const[reproStudies,setReproStudies]=useState([]);
  const[activeStudyId,setActiveStudyId]=useState(null);
  /** While set, reproducibility landmark points for this session are shown on canvas. */
  const[reproCollecting,setReproCollecting]=useState(null);
  const[spotlightMode,setSpotlightMode]=useState(false);

  // Database mode states
  const[databaseMode,setDatabaseMode]=useState(false); // Default to off
  const[databaseImages,setDatabaseImages]=useState([]); // Array of {id, name, dataUrl, markups:[], calibration:{}, processing:{}}
  const[currentImageIndex,setCurrentImageIndex]=useState(0);
  const[showDatabaseImport,setShowDatabaseImport]=useState(false);

  useEffect(()=>{const fn=()=>setIsMobile(window.innerWidth<768);window.addEventListener("resize",fn);return()=>window.removeEventListener("resize",fn);},[]);

  useEffect(()=>{
    if(!rightPanelResizing)return;
    const onMove=e=>setRightPanelWidth(prev=>Math.max(200,Math.min(500,prev+e.movementX)));
    const onUp=()=>setRightPanelResizing(false);
    window.addEventListener("mousemove",onMove);
    window.addEventListener("mouseup",onUp);
    return()=>{window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};
  },[rightPanelResizing]);

  useEffect(()=>{
    if(!toolbarDragging)return;
    const onMove=e=>setToolbarPos(prev=>({x:prev.x+e.movementX,y:prev.y+e.movementY}));
    const onUp=()=>setToolbarDragging(false);
    window.addEventListener("mousemove",onMove);
    window.addEventListener("mouseup",onUp);
    return()=>{window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};
  },[toolbarDragging]);

  const isPanning=useRef(false);const panStart=useRef(null);
  const isDragging=useRef(false);const dragStart=useRef(null);const dragStartState=useRef(null);
  const dragMid=useRef(null);const dragPtIdx=useRef(null);
  const canvasSize=useRef({w:800,h:600});const lastTouchDist=useRef(null);
  const undoStackRef=useRef([]);
  const redoStackRef=useRef([]);

  const activeVersion=project.versions.find(v=>v.id===project.activeVersionId)||project.versions[0];
  const markups=activeVersion?.markups||[];

  const calibration=activeVersion?.calibration||{done:false,pxPerMm:1};
  const processing=activeVersion?.processing||{brightness:0,contrast:0,windowWidth:0,windowCenter:128,edgeEnhance:0};
  const lutMode=activeVersion?.lutMode||"gray";const lutInvert=activeVersion?.lutInvert||false;
  const formulas=activeVersion?.formulas||[];const norms=activeVersion?.norms||[];
  const selectedMarkup=markups.find(m=>m.id===selectedId);
  const compareVersion=project.versions.find(v=>v.id===compareVersionId);

  const updVer=patch=>onUpdateVersion(activeVersion.id,patch);
  const angleMode=activeVersion?.angleMode||"signed-deg";
  const setAngleMode=m=>updVer({angleMode:m});
  const formatAngle=(v)=>{
    const[sign,unit]=angleMode.split("-");
    let val=v;
    if(sign==="abs")val=Math.abs(v);
    else if(sign==="simple")val=Math.abs(v);
    else if(sign==="reflex")val=Math.abs(v)>180?360-Math.abs(v):360-Math.abs(v);
    if(unit==="rad")return(val*Math.PI/180).toFixed(4)+" rad";
    return val.toFixed(1)+"°";
  };
  const pushUndo=()=>{
    undoStackRef.current.push(JSON.stringify(markups));
    if(undoStackRef.current.length>50)undoStackRef.current.shift();
    redoStackRef.current=[];
  };
  const undo=()=>{
    if(undoStackRef.current.length===0)return;
    redoStackRef.current.push(JSON.stringify(markups));
    const prev=undoStackRef.current.pop();
    if(prev)updVer({markups:JSON.parse(prev)});
  };
  const redo=()=>{
    if(redoStackRef.current.length===0)return;
    undoStackRef.current.push(JSON.stringify(markups));
    const next=redoStackRef.current.pop();
    if(next)updVer({markups:JSON.parse(next)});
  };
  const updMarkups=fn=>{pushUndo();updVer({markups:fn(markups)});};
  const syncReproStudyCoords=(repro,x,y)=>{
    if(!repro?.measurementId)return;
    setReproStudies(prev=>prev.map(s=>{
      if(s.id!==repro.studyId)return s;
      return{...s,operators:s.operators.map(o=>{
        if(o.id!==repro.opId)return o;
        const trials=(o.trials||[]).map((tr,ti)=>{
          if(ti!==repro.trialIdx)return tr;
          return{...tr,measurements:(tr.measurements||[]).map(me=>me.id===repro.measurementId?{...me,x,y}:me)};
        });
        return{...o,trials};
      })};
    }));
  };
  const updMarkup=(id,patch)=>{
    const useDb=databaseMode&&databaseImages.length>0&&!reproCollecting;
    if(useDb){
      const currentDbImg=databaseImages[currentImageIndex];
      const currentMarkups=currentDbImg?.markups||[];
      const prevM=currentMarkups.find(m=>m.id===id);
      const merged=prevM?{...prevM,...patch}:null;
      const newMarkups=currentMarkups.map(m=>m.id===id?{...m,...patch}:m);
      updateDatabaseImage(currentImageIndex,{markups:newMarkups});
      if(merged?.repro?.measurementId&&patch.points){
        const pt=vpts(merged)[0];
        if(pt&&pt.x>-9000)syncReproStudyCoords(merged.repro,pt.x,pt.y);
      }
      return;
    }
    const prevM=markups.find(m=>m.id===id);
    const merged=prevM?{...prevM,...patch}:null;
    updMarkups(ms=>ms.map(m=>m.id===id?{...m,...patch}:m));
    if(merged?.repro?.measurementId&&patch.points){
      const pt=vpts(merged)[0];
      if(pt&&pt.x>-9000)syncReproStudyCoords(merged.repro,pt.x,pt.y);
    }
  };
  const delMarkup=id=>{
    const useDb=databaseMode&&databaseImages.length>0&&!reproCollecting;
    if(useDb){
      const newMarkups=(databaseImages[currentImageIndex]?.markups||[]).filter(mm=>mm.id!==id);
      updateDatabaseImage(currentImageIndex,{markups:newMarkups});
      if(selectedId===id)setSelectedId(null);
      return;
    }
    const m=markups.find(x=>x.id===id);
    updMarkups(ms=>ms.filter(mm=>mm.id!==id));
    if(selectedId===id)setSelectedId(null);
    if(m?.repro?.measurementId){
      setReproStudies(prev=>prev.map(s=>{
        if(s.id!==m.repro.studyId)return s;
        return{...s,operators:s.operators.map(o=>{
          if(o.id!==m.repro.opId)return o;
          const trials=(o.trials||[]).map((tr,ti)=>{
            if(ti!==m.repro.trialIdx)return tr;
            return{...tr,measurements:(tr.measurements||[]).filter(me=>me.id!==m.repro.measurementId)};
          });
          return{...o,trials};
        })};
      }));
    }
  };
  const addMarkup=partial=>{
    const useDb=databaseMode&&databaseImages.length>0&&!reproCollecting;
    const currentDbImg=useDb?databaseImages[currentImageIndex]:null;
    const existingMarkups=useDb?(currentDbImg?.markups||[]):markups;
    const typeCount=(type)=>existingMarkups.filter(m=>m.type===type).length;
    const m={id:uid(),color:t.acc,width:1.5,style:"solid",size:6,label:"",definition:"",showLength:true,strokeColor:t.acc,fillColor:t.acc+"22",strokeWidth:1.5,visible:true,...partial};
    if(partial.type==="point")m.label=`P${typeCount("point")+1}`;
    if(partial.type==="line"||partial.type==="parallel")m.label=partial.label||`Line ${typeCount("line")+typeCount("parallel")+1}`;
    if(partial.type==="curve")m.label=partial.label||`Trace ${typeCount("curve")+1}`;
    if(partial.type==="angle3")m.label=partial.label||`Angle ${typeCount("angle3")+1}`;
    if(partial.type==="angle4")m.label=partial.label||`Inc_Angle ${typeCount("angle4")+1}`;
    if(useDb){
      const newMarkups=[...currentDbImg?.markups||[],m];
      updateDatabaseImage(currentImageIndex,{markups:newMarkups});
      setSelectedId(m.id);
      return m;
    }
    updMarkups(ms=>[...ms,m]);setSelectedId(m.id);return m;
  };
  const finalizeMarkup=draw=>{
    const useDb=databaseMode&&databaseImages.length>0&&!reproCollecting;
    const currentDbImg=useDb?databaseImages[currentImageIndex]:null;
    const existingMarkups=useDb?(currentDbImg?.markups||[]):markups;
    const D={
      line:{color:t.acc,width:1.5,style:"solid",mode:"segment",label:`Line ${existingMarkups.filter(m=>m.type==="line").length+1}`,showLength:true},
      angle3:{color:"#f472b6",width:1.5,label:`Angle ${existingMarkups.filter(m=>m.type==="angle3").length+1}`},
      angle4:{color:"#c084fc",width:1.5,label:`Inc_Angle ${existingMarkups.filter(m=>m.type==="angle4").length+1}`},
      polygon:{strokeColor:t.acc,fillColor:t.acc+"22",strokeWidth:1.5,label:`Polygon ${existingMarkups.filter(m=>m.type==="polygon").length+1}`},
      curve:{color:"#fb923c",width:1.5,label:`Trace ${existingMarkups.filter(m=>m.type==="curve").length+1}`},
      perp:{color:"#a78bfa",width:1.5,label:`Perp ${existingMarkups.filter(m=>m.type==="perp").length+1}`}
    };
    const newMarkup={...D[draw.type]||{},...draw};
    if(draw.replacingId){
      updMarkup(draw.replacingId,{points:draw.points,placed:true,curveStyle:draw.curveStyle});
      setReplacingId(null);
    }else{
      addMarkup(newMarkup);
    }
  };

  // load images
  useEffect(()=>{project.images.forEach(imgE=>{if(!imgRefs.current[imgE.id]&&imgE.dataUrl){const img=new Image();img.onload=()=>{imgRefs.current[imgE.id]=img;redraw();};img.src=imgE.dataUrl;}});},[project.images]);

  const getProcessed=useCallback(imgEntry=>{
    const key=`${imgEntry.id}-${JSON.stringify(processing)}-${lutMode}-${lutInvert}`;
    if(!procCache.current.has(key)){for(const k of procCache.current.keys())if(k.startsWith(imgEntry.id+"-")&&k!==key)procCache.current.delete(k);procCache.current.set(key,processImageToCanvas(imgRefs.current[imgEntry.id],processing,lutMode,lutInvert));}
    return procCache.current.get(key);
  },[processing,lutMode,lutInvert]);

  const toImage=useCallback((sx,sy)=>({x:(sx-pan.x)/zoom,y:(sy-pan.y)/zoom}),[pan,zoom]);
  const getCanvasPos=e=>{const r=canvasRef.current.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};

  useEffect(()=>{
    const obs=new ResizeObserver(()=>{const el=containerRef.current;if(!el)return;const c=canvasRef.current;if(!c)return;c.width=el.clientWidth;c.height=el.clientHeight;canvasSize.current={w:el.clientWidth,h:el.clientHeight};redraw();});
    if(containerRef.current)obs.observe(containerRef.current);return()=>obs.disconnect();
  },[]);

  const redraw=useCallback(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext("2d");ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle=t.bg;ctx.fillRect(0,0,canvas.width,canvas.height);
    
    const currentDbImg=databaseMode&&databaseImages.length>0?databaseImages[currentImageIndex]:null;
    const activeMarkups=currentDbImg?.markups||[];
    const activeCalibration=currentDbImg?.calibration||{done:false,pxPerMm:1};
    const activeProcessing=currentDbImg?.processing||{brightness:0,contrast:0,windowWidth:0,windowCenter:128,edgeEnhance:0};
    const activeLutMode=currentDbImg?.lutMode||"gray";
    const activeLutInvert=currentDbImg?.lutInvert||false;
    
    if(databaseMode&&currentDbImg){
      const src=imgRefs.current[currentDbImg.id];
      if(src){
        const nw=src.naturalWidth||src.width||600,nh=src.naturalHeight||src.height||500;
        ctx.save();
        ctx.globalAlpha=currentDbImg.opacity??1;
        ctx.translate(pan.x,pan.y);
        ctx.scale(zoom,zoom);
        ctx.drawImage(src,0,0,nw,nh);
        ctx.restore();
      }
    }else if(project.images.length===0){
      ctx.fillStyle=t.surf;ctx.fillRect(pan.x,pan.y,600*zoom,500*zoom);ctx.strokeStyle=t.bdr;ctx.lineWidth=1;ctx.strokeRect(pan.x,pan.y,600*zoom,500*zoom);
      ctx.fillStyle=t.tx3;ctx.font=`15px "DM Sans",sans-serif`;ctx.textAlign="center";ctx.fillText("Drop or open a cephalogram image",pan.x+300*zoom,pan.y+240*zoom);ctx.fillText("Open Image  •  drag & drop",pan.x+300*zoom,pan.y+265*zoom);ctx.textAlign="left";
    } else {
      project.images.forEach(imgE=>{
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
    const drawMarkups=databaseMode&&databaseImages.length>0&&!reproCollecting?activeMarkups:markups;
    const drawCalibration=databaseMode&&databaseImages.length>0&&!reproCollecting?activeCalibration:calibration;
    drawMarkups.forEach(m=>drawMarkup(ctx,m,zoom,pan,drawCalibration,selectedId,t,reproCollecting,canvasSize.current,angleMode,showAnnotations,annotationSize));
    if(showDisplacement){
      if(!compareVersion){
        ctx.fillStyle="rgba(0,0,0,0.6)";ctx.fillRect(8,8,220,36);
        ctx.fillStyle="#ffd700";ctx.font="bold 12px 'DM Sans',sans-serif";
        ctx.fillText("⇝ Select a compare version in Layers panel",16,28);
      } else {
        drawDisplacementVectors(ctx,drawMarkups,compareVersion.markups||[],zoom,pan);
      }
    }
    if(currentDraw)drawInProgress(ctx,currentDraw,mousePos,zoom,pan,t);
    if(snapEnabled&&snapPos)drawSnapIndicator(ctx,snapPos,zoom,pan);
    if(showScaleBar)drawScaleBar(ctx,zoom,drawCalibration,canvas.width,canvas.height);
    if(showLUT&&activeLutMode!=="gray")drawLUTLegend(ctx,activeLutMode,activeLutInvert,canvas.width,canvas.height,t);
    if(placingMode&&placingQueue.length>0&&placingIdx<placingQueue.length){
      const m=drawMarkups.find(x=>x.id===placingQueue[placingIdx]);
      if(m){ctx.save();ctx.fillStyle="rgba(0,0,0,0.8)";ctx.fillRect(0,0,canvas.width,36);ctx.fillStyle=t.acc;ctx.font=`bold 13px "DM Sans",sans-serif`;ctx.fillText(`📍 Placing: ${m.label}${m.definition?" — "+m.definition:""} · Click image · Esc to skip`,12,23);ctx.restore();}
    }
  },[markups,selectedId,zoom,pan,project.images,calibration,t,currentDraw,mousePos,snapEnabled,snapPos,showScaleBar,showLUT,showAnnotations,annotationSize,lutMode,lutInvert,placingMode,placingQueue,placingIdx,showDisplacement,compareVersion,getProcessed,reproCollecting,angleMode,databaseMode,databaseImages,currentImageIndex]);

  useEffect(()=>{redraw();},[redraw]);

  const loadImage=(file,addToStack=false)=>{
    if(!file||!file.type.startsWith("image/"))return;
    const reader=new FileReader();
    reader.onload=e=>{
      const dataUrl=e.target.result;const img=new Image();
      img.onload=()=>{
        const id=uid();imgRefs.current[id]=img;
        const entry={id,name:file.name,dataUrl,dx:0,dy:0,opacity:1,blendMode:"normal",visible:true,color:"none",transform:{tx:0,ty:0,rot:0,scale:1}};
        const newImages=addToStack?[...project.images,entry]:[entry];
        onUpdateProject({images:newImages});
        if(!addToStack){const cw=canvasSize.current.w-80,ch=canvasSize.current.h-80;const sc=Math.min(cw/(img.naturalWidth||600),ch/(img.naturalHeight||500),1);setZoom(sc);setPan({x:40,y:40});}
      };img.src=dataUrl;
    };reader.readAsDataURL(file);
  };

  const loadDatabaseImages=async (files)=>{
    const loaded=await Promise.all(files.map(file=>{
      return new Promise((resolve)=>{
        if(!file.type.startsWith("image/")){resolve(null);return;}
        const reader=new FileReader();
        reader.onload=e=>{
          const dataUrl=e.target.result;const img=new Image();
          img.onload=()=>{
            resolve({id:uid(),name:file.name,dataUrl,markups:[],calibration:{done:false,pxPerMm:1,knownMm:""},processing:{brightness:0,contrast:0,windowWidth:0,windowCenter:128,edgeEnhance:0},lutMode:"gray",lutInvert:false});
          };img.src=dataUrl;
        };reader.readAsDataURL(file);
      });
    }));
    const validImages=loaded.filter(Boolean);
    if(validImages.length>0){
      setDatabaseImages(validImages);
      setCurrentImageIndex(0);
      setDatabaseMode(true);
      const firstImg=validImages[0];
      imgRefs.current[firstImg.id]=await new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=firstImg.dataUrl;});
      const cw=canvasSize.current.w-80,ch=canvasSize.current.h-80;
      const img=new Image();img.onload=()=>{const sc=Math.min(cw/(img.naturalWidth||600),ch/(img.naturalHeight||500),1);setZoom(sc);setPan({x:40,y:40});};img.src=firstImg.dataUrl;
    }
  };

  const updateDatabaseImage=(index,patch)=>{
    setDatabaseImages(prev=>prev.map((img,i)=>i===index?{...img,...patch}:img));
  };

  const navigateImage=(direction)=>{
    if(direction==="next"&&currentImageIndex<databaseImages.length-1){
      setCurrentImageIndex(prev=>prev+1);
    }else if(direction==="prev"&&currentImageIndex>0){
      setCurrentImageIndex(prev=>prev-1);
    }
  };

  useEffect(()=>{
    if(!databaseMode||databaseImages.length===0)return;
    const currentDbImg=databaseImages[currentImageIndex];
    if(!currentDbImg)return;
    if(!imgRefs.current[currentDbImg.id]){
      const img=new Image();
      img.onload=()=>{imgRefs.current[currentDbImg.id]=img;redraw();};
      img.src=currentDbImg.dataUrl;
    }else{
      redraw();
    }
  },[currentImageIndex,databaseMode]);

  const handleDrop=e=>{e.preventDefault();loadImage(e.dataTransfer.files[0]);};

  useEffect(()=>{
    const fn=e=>{
      if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA")return;
      if((e.ctrlKey||e.metaKey)&&e.key==="z"){undo();return;}
      if((e.ctrlKey||e.metaKey)&&e.key==="y"){redo();return;}
      if(e.key==="Escape"){setCurrentDraw(null);setSelectedId(null);if(placingMode){if(placingIdx<placingQueue.length-1)setPlacingIdx(i=>i+1);else{setPlacingMode(false);setPlacingQueue([]);setPlacingIdx(0);}}return;}
      const tool=TOOLS.filter(Boolean).find(t2=>t2.key===e.key.toLowerCase());
      if(tool){setActiveTool(tool.id);setCurrentDraw(null);return;}
      if((e.key==="Delete"||e.key==="Backspace")&&selectedId){const m=markups.find(x=>x.id===selectedId);if(!m?.locked)delMarkup(selectedId);return;}
      if(e.key==="+"||e.key==="=")setZoom(z=>clamp(z*1.15,0.05,15));
      if(e.key==="-")setZoom(z=>clamp(z/1.15,0.05,15));
      if(e.key==="0"){setZoom(1);setPan({x:40,y:40});}
    };
    window.addEventListener("keydown",fn);return()=>window.removeEventListener("keydown",fn);
  },[selectedId,placingMode,placingIdx,placingQueue,markups]);

  const handleMouseDown=useCallback(e=>{
    if(e.button!==0)return;
    const currentDbImg=databaseMode&&!reproCollecting&&databaseImages.length>0?databaseImages[currentImageIndex]:null;
    const dbMarkups=currentDbImg?.markups||[];
    const activeMarkupsList=databaseMode&&!reproCollecting?dbMarkups:markups;
    const sp=getCanvasPos(e);let ip=toImage(sp.x,sp.y);
    ip=snapPoint(ip,activeMarkupsList,12/zoom,snapEnabled);
    if(placingMode&&placingQueue.length>0&&placingIdx<placingQueue.length){
      const qid=placingQueue[placingIdx];
      updMarkup(qid,{points:[ip],placed:true});
      if(placingIdx<placingQueue.length-1)setPlacingIdx(i=>i+1);else{setPlacingMode(false);setPlacingQueue([]);setPlacingIdx(0);}
      return;
    }
    if(activeTool==="pan"){isPanning.current=true;panStart.current={mx:e.clientX,my:e.clientY,px:pan.x,py:pan.y};return;}
    if(activeTool==="select"){
      const hit=hitTest(activeMarkupsList,ip,zoom,reproCollecting);
      setSelectedId(hit);
      if(hit){
        const m=activeMarkupsList.find(x=>x.id===hit);
        if(m?.locked){isDragging.current=false;return;}
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
        isDragging.current=true;dragMid.current=hit;dragStartState.current=JSON.stringify(activeMarkupsList);
        let bi=0,bd=Infinity;(m.points||[]).forEach((p,i)=>{const d=dist(p,ip);if(d<bd){bd=d;bi=i;}});
        dragPtIdx.current=bi;dragStart.current=ip;
      }
      return;
    }
    if(activeTool==="text"){setPendingTextPos(ip);return;}
    if(activeTool==="point"){
      if(replacingId){updMarkup(replacingId,{points:[ip],placed:true});setReplacingId(null);return;}
      if(reproCollecting){
        const{studyId,opId,trialIdx}=reproCollecting;
        const study=reproStudies.find(s=>s.id===studyId);
        if(study){
          const n=activeMarkupsList.filter(m=>m.type==="point"&&m.repro&&m.repro.studyId===studyId&&m.repro.opId===opId&&m.repro.trialIdx===trialIdx).length;
          const label=`L${n+1}`;
          const measurementId=uid();
          addMarkup({type:"point",points:[ip],label,color:t.acc,size:6,definition:"",repro:{studyId,opId,trialIdx,measurementId}});
          setReproStudies(prev=>prev.map(s=>{
            if(s.id!==studyId)return s;
            return{...s,operators:s.operators.map(o=>{
              if(o.id!==opId)return o;
              const trials=[...(o.trials||[])];
              while(trials.length<=trialIdx)trials.push({id:uid(),measurements:[]});
              const tr=trials[trialIdx]||{id:uid(),measurements:[]};
              trials[trialIdx]={...tr,measurements:[...(tr.measurements||[]),{id:measurementId,label,x:ip.x,y:ip.y,timestamp:Date.now()}]};
              return{...o,trials};
            })};
          }));
        }
        return;
      }
      const nNon=activeMarkupsList.filter(m=>m.type==="point"&&!m.repro).length;
      addMarkup({type:"point",points:[ip],label:`P${nNon+1}`,color:t.acc,size:6,definition:""});
      return;
    }
    if(activeTool==="ruler"){if(!currentDraw)setCurrentDraw({type:"ruler",points:[ip]});else{const ruler={...currentDraw,type:"ruler",points:[...currentDraw.points,ip],label:"Ruler"};setPendingRuler(ruler);addMarkup(ruler);setCurrentDraw(null);setShowCalib(true);}return;}
    if(activeTool==="parallel"){if(selectedMarkup&&(selectedMarkup.type==="line"||selectedMarkup.type==="parallel")){const vp=vpts(selectedMarkup);if(vp.length>=2){const dx=vp[1].x-vp[0].x,dy=vp[1].y-vp[0].y,len=Math.sqrt(dx*dx+dy*dy)||1,half=len/2;addMarkup({type:"parallel",points:[{x:ip.x-dx/len*half,y:ip.y-dy/len*half},{x:ip.x+dx/len*half,y:ip.y+dy/len*half}],color:"#34d399",width:1.5,style:"solid",label:`∥`,showLength:true});return;}}if(!currentDraw)setCurrentDraw({type:"line",points:[ip]});else{finalizeMarkup({...currentDraw,points:[...currentDraw.points,ip]});setCurrentDraw(null);}return;}
    if(activeTool==="midpoint"){if(!currentDraw)setCurrentDraw({type:"midpoint",points:[ip]});else{const p1=currentDraw.points[0],p2=ip;if(p1.x>-9000&&p2.x>-9000){const mid={x:(p1.x+p2.x)/2,y:(p1.y+p2.y)/2};const n=activeMarkupsList.filter(m=>m.type==="point").length;addMarkup({type:"point",points:[mid],label:`M${n+1}`,color:"#fbbf24",size:6,definition:"Midpoint"});}setCurrentDraw(null);}return;}
    if(activeTool==="perppoint"){if(!currentDraw)setCurrentDraw({type:"perppoint",points:[ip]});else if(currentDraw.points.length===1)setCurrentDraw({type:"perppoint",points:[currentDraw.points[0],ip]});else{const p1=currentDraw.points[0],p2=currentDraw.points[1],p3=ip;if(p1.x>-9000&&p2.x>-9000&&p3.x>-9000){const lx1=p2.x-p1.x,ly1=p2.y-p1.y;const lx2=-ly1,ly2=lx1;const perpPt={x:p3.x+lx2,y:p3.y+ly2};const n=activeMarkupsList.filter(m=>m.type==="line"||m.type==="perp").length+1;addMarkup({type:"line",mode:"segment",points:[perpPt,p3],color:"#f472b6",width:1.5,style:"solid",label:`⊥${n}`,showLength:true});}setCurrentDraw(null);}return;}
    if(activeTool==="arrow"){if(!currentDraw)setCurrentDraw({type:"arrow",points:[ip]});else{const p1=currentDraw.points[0],p2=ip;if(p1.x>-9000&&p2.x>-9000){addMarkup({type:"arrow",points:[p1,p2],color:"#34d399",width:2});}setCurrentDraw(null);}return;}
    if(["line","angle3","angle4","polygon","curve","perp"].includes(activeTool)){
      if(!currentDraw)setCurrentDraw({type:activeTool,points:[ip],curveStyle:["curve","polygon"].includes(activeTool)?curveMode:"linear",replacingId});
      else{const nps=[...currentDraw.points,ip];const need={line:2,angle3:3,angle4:4,perp:3}[activeTool];if(need&&nps.length>=need){finalizeMarkup({...currentDraw,points:nps});setCurrentDraw(null);}else setCurrentDraw({...currentDraw,points:nps});}return;}
  },[activeTool,markups,zoom,pan,snapEnabled,currentDraw,selectedMarkup,curveMode,placingMode,placingQueue,placingIdx,reproCollecting,reproStudies,databaseMode,databaseImages,currentImageIndex,replacingId]);

  const handleMouseMove=useCallback(e=>{
    const currentDbImg=databaseMode&&!reproCollecting&&databaseImages.length>0?databaseImages[currentImageIndex]:null;
    const dbMarkups=currentDbImg?.markups||[];
    const activeMarkupsList=databaseMode&&!reproCollecting?dbMarkups:markups;
    const sp=getCanvasPos(e);setMousePos(sp);
    if(snapEnabled&&activeTool!=="select"&&activeTool!=="pan"){const ip=toImage(sp.x,sp.y);const sn=snapPoint(ip,activeMarkupsList,12/zoom,snapEnabled);setSnapPos((Math.abs(sn.x-ip.x)>0.1||Math.abs(sn.y-ip.y)>0.1)?sn:null);}else setSnapPos(null);
    if(isPanning.current&&panStart.current)setPan({x:panStart.current.px+(e.clientX-panStart.current.mx),y:panStart.current.py+(e.clientY-panStart.current.my)});
    if(isDragging.current&&dragMid.current){const ip=toImage(sp.x,sp.y);const dx=ip.x-dragStart.current.x,dy=ip.y-dragStart.current.y;updMarkup(dragMid.current,{points:(activeMarkupsList.find(m=>m.id===dragMid.current)?.points||[]).map((p,i)=>i===dragPtIdx.current?{x:p.x+dx,y:p.y+dy}:p)});dragStart.current=ip;}
  },[activeTool,markups,zoom,snapEnabled,databaseMode,databaseImages,currentImageIndex,reproCollecting]);

  const handleMouseUp=()=>{
    const currentDbImg=databaseMode&&!reproCollecting&&databaseImages.length>0?databaseImages[currentImageIndex]:null;
    const activeMarkupsList=databaseMode&&!reproCollecting?(currentDbImg?.markups||[]):markups;
    if(isDragging.current&&dragStartState.current){
      const currentState=JSON.stringify(activeMarkupsList);
      if(dragStartState.current!==currentState){
        undoStackRef.current.push(dragStartState.current);
        if(undoStackRef.current.length>50)undoStackRef.current.shift();
        redoStackRef.current=[];
      }
      dragStartState.current=null;
    }
    isPanning.current=false;isDragging.current=false;
  };
  const handleDblClick=()=>{if((activeTool==="polygon"||activeTool==="curve")&&currentDraw?.points.length>=2){finalizeMarkup(currentDraw);setCurrentDraw(null);}};
  useEffect(()=>{const c=canvasRef.current;if(!c)return;const onWheel=e=>{if(Math.abs(e.deltaY)>0.1||Math.abs(e.deltaX)>0.1){e.preventDefault();e.stopPropagation();const sp=getCanvasPos(e),f=e.deltaY>0?0.9:1.1,nz=clamp(zoom*f,0.05,15);setPan(prev=>({x:sp.x-(sp.x-prev.x)*(nz/zoom),y:sp.y-(sp.y-prev.y)*(nz/zoom)}));setZoom(nz);}};c.addEventListener("wheel",onWheel,{passive:false});return()=>c.removeEventListener("wheel",onWheel);},[zoom]);
  const handleTouchStart=e=>{e.preventDefault();if(e.touches.length===1){const t2=e.touches[0];handleMouseDown({button:0,clientX:t2.clientX,clientY:t2.clientY});}if(e.touches.length===2)lastTouchDist.current=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);};
  const handleTouchMove=e=>{e.preventDefault();if(e.touches.length===1){const t2=e.touches[0];handleMouseMove({clientX:t2.clientX,clientY:t2.clientY});}if(e.touches.length===2&&lastTouchDist.current){const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);const f=d/lastTouchDist.current,nz=clamp(zoom*f,0.05,15);const cx=(e.touches[0].clientX+e.touches[1].clientX)/2,cy=(e.touches[0].clientY+e.touches[1].clientY)/2;const r=canvasRef.current.getBoundingClientRect();const sp={x:cx-r.left,y:cy-r.top};setPan(prev=>({x:sp.x-(sp.x-prev.x)*(nz/zoom),y:sp.y-(sp.y-prev.y)*(nz/zoom)}));setZoom(nz);lastTouchDist.current=d;}};
  const handleTouchEnd=()=>{handleMouseUp();lastTouchDist.current=null;};

  const finalizeCalib=(mm,manualPpm)=>{
    const useDb=databaseMode&&databaseImages.length>0&&!reproCollecting;
    if(useDb){
      const currentDbImg=databaseImages[currentImageIndex];
      const currentMarkups=currentDbImg?.markups||[];
      if(manualPpm){
        updateDatabaseImage(currentImageIndex,{calibration:{done:true,pxPerMm:manualPpm,knownMm:mm}});
        setShowCalib(false);
        return;
      }
      const ruler=pendingRuler||currentMarkups.find(m=>m.type==="ruler");if(!ruler)return;const vp=vpts(ruler);if(vp.length<2)return;
      updateDatabaseImage(currentImageIndex,{calibration:{done:true,pxPerMm:dist(vp[0],vp[1])/mm,knownMm:mm}});
      setShowCalib(false);
      return;
    }
    if(manualPpm){updVer({calibration:{done:true,pxPerMm:manualPpm,knownMm:mm}});setShowCalib(false);return;}
    const ruler=pendingRuler||markups.find(m=>m.type==="ruler");if(!ruler)return;const vp=vpts(ruler);if(vp.length<2)return;
    updVer({calibration:{done:true,pxPerMm:dist(vp[0],vp[1])/mm,knownMm:mm}});setShowCalib(false);
  };

  const loadTemplate=(analysis)=>{
    const newMarkups=[];
    const pointIds={};
    analysis.pts.forEach(pt=>{
      const id=uid();
      pointIds[pt.l]=id;
      newMarkups.push({id,type:"point",points:[{x:-99999,y:-99999}],label:pt.l,definition:pt.def,color:pt.color,size:6,visible:true,placed:false});
    });
    updVer({markups:[...markups,...newMarkups],analysisTemplate:analysis.name});
    setPlacingQueue(newMarkups.map(m=>m.id));setPlacingIdx(0);setPlacingMode(true);setRightPanel("markups");
  };

  const handleTemplatePick=(type,analysis,file)=>{
    setShowTemplatePicker(false);
    if(type==="blank")return;
    if(type==="analysis"&&analysis){loadTemplate(analysis);return;}
    if(type==="complete"&&analysis){loadTemplate(analysis);return;}
    if(type==="upload"&&file){
      importCepht(file,d=>{
        if(d.markups){
          const newMarkups=d.markups.map(m=>({...m,id:uid(),points:[{x:-99999,y:-99999}],placed:false}));
          updVer({markups:[...markups,...newMarkups],analysisTemplate:d.name||"Imported"});
          setPlacingQueue(newMarkups.map(m=>m.id));setPlacingIdx(0);setPlacingMode(true);setRightPanel("markups");
        }
      });
    }
  };

  const exportCSV=()=>{
    const rows=[["ID","Type","Label","Definition","Points_px","Measurement","Value","Unit"]];
    markups.forEach(m=>{const meas=computeMeasurements(m,calibration);const ps=vpts(m).map(p=>`(${p.x.toFixed(1)},${p.y.toFixed(1)})`).join(";");if(!Object.keys(meas).length)rows.push([m.id,m.type,m.label||"",m.definition||"",ps,"","",""]);else Object.entries(meas).forEach(([k,v])=>rows.push([m.id,m.type,m.label||"",m.definition||"",ps,k,v.toFixed(2),k==="angle"?formatAngle(v):"mm"]));});
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([rows.map(r=>r.map(c=>`"${c}"`).join(",")).join("\n")],{type:"text/csv"}));a.download=`${project.name}.csv`;a.click();
  };

  const measScope=useMemo(()=>buildScope(markups,calibration),[markups,calibration]);
  const allMeas=useMemo(()=>markups.map(m=>({m,meas:computeMeasurements(m,calibration)})).filter(x=>Object.keys(x.meas).length>0),[markups,calibration]);
  const cursorStyle={select:"default",pan:"grab",point:"crosshair",line:"crosshair",angle3:"crosshair",angle4:"crosshair",polygon:"crosshair",curve:"crosshair",perp:"crosshair",parallel:"crosshair",midpoint:"crosshair",perppoint:"crosshair",arrow:"crosshair",text:"text",ruler:"crosshair"}[activeTool]||"default";
  const availAnalyses=PREDEFINED[project.projection]||[];

  const panelIcons={markups:"◉",measurements:"📏",formulas:"∑",image:"▦",layers:"🗐",versions:"⏲",reproducibility:"↻",statistics:"𝛀",templates:"▤",themes:"◐","repro-stats":"𝛜"};
  const panelTabs=[["markups","Markups"],["measurements","Measure"],["formulas","Formulas"],["image","Image"],["layers","Layers"],["versions","Versions"],["reproducibility","Reproducibility"],["statistics","Statistics"],["repro-stats","Repro Stats"],["templates","Templates"],["themes","Themes"]];

  return(
    <div style={{height:"100vh",display:"flex",flexDirection:"column",background:t.bg,color:t.tx,fontFamily:"'DM Sans',sans-serif",overflow:"hidden"}}>
      {/* hidden file inputs */}
      <input ref={openImgRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{if(e.target.files[0])loadImage(e.target.files[0]);e.target.value="";}}/>
      <input ref={stackImgRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{if(e.target.files[0])loadImage(e.target.files[0],true);e.target.value="";}}/>
      <input ref={importRef} type="file" accept=".cephx" style={{display:"none"}} onChange={e=>{if(e.target.files[0])importCephx(e.target.files[0],p=>{onUpdateProject(p);});e.target.value="";}}/>

      {/* TOP BAR */}
      <div style={{display:"flex",alignItems:"center",gap:6,padding:"0 10px",height:isMobile?42:46,background:t.surf,flexShrink:0,overflowX:"auto"}}>
        <button onClick={onHome} title="Back to Home" style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:4,padding:"4px 8px",borderRadius:6,flexShrink:0,color:t.tx}}>
          <span style={{fontSize:18}}>←</span>
        </button>
        <button onClick={onHome} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:5,padding:"4px 8px",borderRadius:6,flexShrink:0}}>
          <span><img src="\favicon.svg" alt="Website Icon" width="48" height="48" borderTop="25px"/> </span>
          {!isMobile&&<span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:t.tx,fontSize:17}}>Cephalometry Studio</span>}
        </button>
        <div style={{width:1,height:20,background:t.bdr,flexShrink:0}}/>
        <Tag color={t.acc}>{project.projection?.toUpperCase()}</Tag>
        {project.meta?.anonymized&&<Tag color={t.ok}>🔒 Anon</Tag>}
        {calibration.done&&!databaseMode&&<Tag color={t.ok}>⟺ {calibration.pxPerMm.toFixed(2)}px/mm</Tag>}
        {databaseMode&&<div style={{display:"flex",alignItems:"center",gap:4}}>
          <button onClick={()=>navigateImage("prev")} disabled={currentImageIndex===0} style={{background:"none",border:`1px solid ${t.bdr}`,borderRadius:4,padding:"2px 8px",cursor:currentImageIndex===0?"not-allowed":"pointer",color:currentImageIndex===0?t.tx3:t.tx}}>◀</button>
          <span style={{fontSize:11,fontFamily:"'DM Mono',monospace",color:t.acc}}>{currentImageIndex+1} / {databaseImages.length}</span>
          <button onClick={()=>navigateImage("next")} disabled={currentImageIndex>=databaseImages.length-1} style={{background:"none",border:`1px solid ${t.bdr}`,borderRadius:4,padding:"2px 8px",cursor:currentImageIndex>=databaseImages.length-1?"not-allowed":"pointer",color:currentImageIndex>=databaseImages.length-1?t.tx3:t.tx}}>▶</button>
        </div>}
        {placingMode&&<Tag color={t.warn}>📍 {placingIdx+1}/{placingQueue.length}</Tag>}
        <div style={{flex:1}}/>
        {!isMobile&&<>
          <Btn t={t} small active={snapEnabled} onClick={()=>setSnapEnabled(v=>!v)}>⊙ Snap</Btn>
          <Btn t={t} small active={showScaleBar} onClick={()=>setShowScaleBar(v=>!v)}>⟺</Btn>
          <Btn t={t} small active={showAnnotations} onClick={()=>setShowAnnotations(v=>!v)}>Aa</Btn>
          {showAnnotations&&<input type="range" min="0.5" max="2" step="0.1" value={annotationSize} onChange={e=>setAnnotationSize(+e.target.value)} style={{width:60,marginLeft:4,accentColor:t.acc}} title={`Annotation size: ${annotationSize.toFixed(1)}`}/>}
          {project.images.length>1&&<Btn t={t} small active={showDisplacement} onClick={()=>setShowDisplacement(v=>!v)}>⇝ Vec</Btn>}
          <div style={{width:1,height:20,background:t.bdr}}/>
        </>}
        <Btn t={t} small onClick={()=>openImgRef.current?.click()}>Open</Btn>
        {!isMobile&&<Btn t={t} small onClick={()=>stackImgRef.current?.click()}>+ Stack</Btn>}
        <Btn t={t} small onClick={()=>exportCephx(project)}>Save</Btn>
        {!isMobile&&<div style={{display:"flex",alignItems:"center",gap:6}}>
          <Btn t={t} small onClick={()=>setShowDatabaseImport(true)}>DB</Btn>
          <button onClick={()=>{if(!databaseMode&&databaseImages.length===0)setShowDatabaseImport(true);else if(databaseMode){setDatabaseMode(false);setDatabaseImages([]);setCurrentImageIndex(0);}}} title={databaseImages.length===0?"Import images first":"Toggle Database Mode"} style={{background:"none",border:"none",cursor:databaseImages.length===0?"not-allowed":"pointer",padding:4,display:"flex",alignItems:"center",opacity:databaseImages.length===0?0.5:1}}>
            <div style={{width:36,height:20,borderRadius:10,background:databaseMode?t.acc:t.surf3,border:`1px solid ${databaseMode?t.acc:t.bdr}`,position:"relative",transition:"all 0.2s"}}>
              <div style={{width:16,height:16,borderRadius:8,background:databaseMode?(t.id==="light"?"#fff":t.bg):t.tx,position:"absolute",top:1,left:databaseMode?18:2,transition:"all 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,3)"}}/>
            </div>
          </button>
        </div>}
        {!isMobile&&<Btn t={t} small onClick={()=>setShowExport(true)}>Export</Btn>}
        {!isMobile&&<Btn t={t} small onClick={()=>setShowAnon(true)}>Anonymization</Btn>}
        <div style={{width:1,height:20,background:t.bdr,flexShrink:0}}/>
        {Object.values(THEMES).map(th=>(
          <button key={th.id} onClick={()=>setTheme(th.id)} title={th.name} style={{width:22,height:22,borderRadius:6,border:theme===th.id?`2px solid ${t.acc}`:`1px solid ${t.bdr}`,background:th.bg,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{width:10,height:10,borderRadius:3,background:th.acc}}/>
          </button>
        ))}
        {isMobile&&<Btn t={t} small active={showMobilePanel} onClick={()=>setShowMobilePanel(v=>!v)}>≡</Btn>}
      </div>

      {/* BODY */}
      <div style={{flex:1,display:"flex",overflow:"hidden",position:"relative"}}>
        {/* TOOL SIDEBAR */}
        {(!isMobile||!showMobilePanel)&&(
          <div style={isMobile?{position:"fixed",bottom:0,left:0,right:0,height:52,display:"flex",flexDirection:"row",alignItems:"center",justifyContent:"center",borderTop:`1px solid ${t.bdr}`,zIndex:20,background:t.surf,padding:"0 4px",gap:2}:{width:88,background:t.surf,display:"flex",flexDirection:"column",alignItems:"center",padding:"8px 4px",gap:1,flexShrink:0,overflowY:"auto",scrollbarWidth:"thin"}}>
            {/* Two-column tool layout */}
            <div style={{display:"flex",flexDirection:"column",gap:1,width:"100%"}}>
              {/* Row 1: Select | Pan */}
              <div style={{display:"flex",gap:1}}>
                <ToolBtn tool={{id:"select",icon:"⊹",label:"Select/Move"}} active={activeTool==="select"} onClick={()=>{setActiveTool("select");setCurrentDraw(null);}} theme={theme} t={t} style={{flex:1}}/>
                <ToolBtn tool={{id:"pan",icon:"⊕",label:"Pan"}} active={activeTool==="pan"} onClick={()=>{setActiveTool("pan");setCurrentDraw(null);}} theme={theme} t={t} style={{flex:1}}/>
              </div>
              {/* Row 2: Landmark | Midpoint */}
              <div style={{display:"flex",gap:1}}>
                <ToolBtn tool={{id:"point",icon:"◉",label:"Landmark"}} active={activeTool==="point"} onClick={()=>{setActiveTool("point");setCurrentDraw(null);}} theme={theme} t={t} style={{flex:1}}/>
                <ToolBtn tool={{id:"midpoint",icon:"◈",label:"Midpoint"}} active={activeTool==="midpoint"} onClick={()=>{setActiveTool("midpoint");setCurrentDraw(null);}} theme={theme} t={t} style={{flex:1}}/>
              </div>
              {/* Row 3: Line | Parallel */}
              <div style={{display:"flex",gap:1}}>
                <ToolBtn tool={{id:"line",icon:"⟋",label:"Line"}} active={activeTool==="line"} onClick={()=>{setActiveTool("line");setCurrentDraw(null);}} theme={theme} t={t} style={{flex:1}}/>
                <ToolBtn tool={{id:"parallel",icon:"⫿",label:"Parallel"}} active={activeTool==="parallel"} onClick={()=>{setActiveTool("parallel");setCurrentDraw(null);}} theme={theme} t={t} style={{flex:1}}/>
              </div>
              {/* Row 4: Perp Point | Perp Dist */}
              <div style={{display:"flex",gap:1}}>
                <ToolBtn tool={{id:"perppoint",icon:"⊦",label:"Perp Point"}} active={activeTool==="perppoint"} onClick={()=>{setActiveTool("perppoint");setCurrentDraw(null);}} theme={theme} t={t} style={{flex:1}}/>
                <ToolBtn tool={{id:"perp",icon:"⊥",label:"Perp Dist"}} active={activeTool==="perp"} onClick={()=>{setActiveTool("perp");setCurrentDraw(null);}} theme={theme} t={t} style={{flex:1}}/>
              </div>
              {/* Row 5: Angle3pt | Angle4pt */}
              <div style={{display:"flex",gap:1}}>
                <ToolBtn tool={{id:"angle3",icon:"∠",label:"Angle 3-pt"}} active={activeTool==="angle3"} onClick={()=>{setActiveTool("angle3");setCurrentDraw(null);}} theme={theme} t={t} style={{flex:1}}/>
                <ToolBtn tool={{id:"angle4",icon:"∡",label:"Angle 4-pt"}} active={activeTool==="angle4"} onClick={()=>{setActiveTool("angle4");setCurrentDraw(null);}} theme={theme} t={t} style={{flex:1}}/>
              </div>
              {/* Row 6: Polygon | Curve */}
              <div style={{display:"flex",gap:1}}>
                <ToolBtn tool={{id:"polygon",icon:"⬡",label:"Polygon"}} active={activeTool==="polygon"} onClick={()=>{setActiveTool("polygon");setCurrentDraw(null);}} theme={theme} t={t} style={{flex:1}}/>
                <ToolBtn tool={{id:"curve",icon:"∿",label:"Curve"}} active={activeTool==="curve"} onClick={()=>{setActiveTool("curve");setCurrentDraw(null);}} theme={theme} t={t} style={{flex:1}}/>
              </div>
              {/* Row 7: Arrow | Text */}
              <div style={{display:"flex",gap:1}}>
                <ToolBtn tool={{id:"arrow",icon:"→",label:"Arrow"}} active={activeTool==="arrow"} onClick={()=>{setActiveTool("arrow");setCurrentDraw(null);}} theme={theme} t={t} style={{flex:1}}/>
                <ToolBtn tool={{id:"text",icon:"T",label:"Text"}} active={activeTool==="text"} onClick={()=>{setActiveTool("text");setCurrentDraw(null);}} theme={theme} t={t} style={{flex:1}}/>
              </div>
              {/* Row 8: Ruler (centered) */}
              <div style={{display:"flex",justifyContent:"center"}}>
                <ToolBtn tool={{id:"ruler",icon:"⟺",label:"Ruler"}} active={activeTool==="ruler"} onClick={()=>{setActiveTool("ruler");setCurrentDraw(null);}} theme={theme} t={t}/>
              </div>
              {/* Row 8b: Spotlight mode */}
              <div style={{display:"flex",justifyContent:"center"}}>
                <button onClick={()=>{const next=!spotlightMode;setSpotlightMode(next);if(databaseMode){setDatabaseImages(prev=>prev.map(img=>{if(next){return{...img,opacityBeforeSpotlight:img.opacity||1,opacity:0.5};}return{...img,opacity:img.opacityBeforeSpotlight||1};}));}else if(project.images.length>0){const imgs=project.images.map(img=>{if(next){return{...img,opacityBeforeSpotlight:img.opacity||1,opacity:0.5};}return{...img,opacity:img.opacityBeforeSpotlight||1};});onUpdateProject({images:imgs});}}} title="Spotlight (reduce image opacity)" style={{width:42,height:42,borderRadius:8,border:"none",background:spotlightMode?t.acc:t.surf2,color:spotlightMode?(theme==="light"?"#fff":t.bg):t.tx,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:spotlightMode?`0 0 0 2px ${t.acc}`:"none"}}>💡</button>
              </div>
              {/* Separator */}
              <div style={{width:"100%",height:1,background:t.bdr,margin:"4px 0"}}/>
              {/* Row 9: Undo | Redo */}
              <div style={{display:"flex",gap:1}}>
                <button onClick={undo} disabled={undoStackRef.current.length===0} style={{flex:1,height:32,borderRadius:6,border:"none",background:activeTool==="select"?"transparent":"transparent",color:undoStackRef.current.length>0?t.tx2:t.bdr,cursor:undoStackRef.current.length>0?"pointer":"not-allowed",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} title="Undo (Ctrl+Z)">↶</button>
                <button onClick={redo} disabled={redoStackRef.current.length===0} style={{flex:1,height:32,borderRadius:6,border:"none",background:activeTool==="select"?"transparent":"transparent",color:redoStackRef.current.length>0?t.tx2:t.bdr,cursor:redoStackRef.current.length>0?"pointer":"not-allowed",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} title="Redo (Ctrl+Y)">↷</button>
              </div>
              {/* Row 10: Zoom in | Zoom out */}
              <div style={{display:"flex",gap:1}}>
                <button onClick={()=>setZoom(z=>clamp(z*1.3,0.05,15))} style={{flex:1,height:32,borderRadius:6,border:"none",background:"transparent",color:t.tx2,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} title="Zoom In">＋</button>
                <button onClick={()=>setZoom(z=>clamp(z/1.3,0.05,15))} style={{flex:1,height:32,borderRadius:6,border:"none",background:"transparent",color:t.tx2,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} title="Zoom Out">－</button>
              </div>
              {/* Row 11: Fit to Window */}
              <div style={{display:"flex",justifyContent:"center"}}>
                <button onClick={()=>{setZoom(1);setPan({x:40,y:40});}} style={{width:38,height:32,borderRadius:6,border:"none",background:"transparent",color:t.tx2,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} title="Fit to Window (⊙)">⊙</button>
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

        {/* CANVAS */}
        <div ref={containerRef} style={{flex:1,position:"relative",overflow:"hidden",background:t.bg}} onDrop={handleDrop} onDragOver={e=>e.preventDefault()}>
          <canvas ref={canvasRef} style={{display:"block",cursor:cursorStyle,touchAction:"none",background:"transparent"}}
            onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
            onDoubleClick={handleDblClick}
            onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}/>
          {!isMobile&&<div style={{position:"absolute",bottom:isMobile?60:8,left:8,display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            {mousePos&&<div style={{background:t.surf+"ee",border:`1px solid ${t.bdr}`,borderRadius:6,padding:"3px 10px",fontSize:11,color:t.tx2,fontFamily:"'DM Mono',monospace"}}>
              {(()=>{const ip=toImage(mousePos.x,mousePos.y);return`${ip.x.toFixed(1)}, ${ip.y.toFixed(1)} px${calibration.done?` · (${(ip.x/calibration.pxPerMm).toFixed(1)}, ${(ip.y/calibration.pxPerMm).toFixed(1)} mm)`:""}`})()}
            </div>}
            {currentDraw&&<div style={{background:t.acc+"22",border:`1px solid ${t.acc}`,borderRadius:6,padding:"3px 10px",fontSize:11,color:t.acc,fontFamily:"'DM Mono',monospace"}}>
              {["polygon","curve"].includes(activeTool)?`${currentDraw.points.length} pts · dbl-click done`:(()=>{const n={line:2,angle3:3,angle4:4,perp:3,ruler:2}[activeTool];return`${currentDraw.points.length}/${n}`;})()}
            </div>}
          </div>}
        </div>

        {/* RIGHT PANEL — VSCode-style vertical tabs on left */}
        {(!isMobile||(isMobile&&showMobilePanel))&&(
          <div style={{...(isMobile?{position:"fixed",top:42,right:0,bottom:52,width:"85vw",maxWidth:300,zIndex:15,boxShadow:`-4px 0 20px ${t.shadow}`}:{width:rightPanelWidth,flexShrink:0}),background:t.surf,display:"flex",flexDirection:"row",userSelect:rightPanelResizing?"none":"auto",cursor:rightPanelResizing?"col-resize":"auto"}}>
            {/* Vertical tabs on left side */}
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",paddingTop:8,flexShrink:0,background:t.surf2}}>
              {panelTabs.map(([id,label])=>{
                const icons={markups:"◉",measurements:"📏",formulas:"∑",image:"▦",layers:"🗐",versions:"⏲",reproducibility:"↻",statistics:"𝛀",templates:"▤",themes:"◐","repro-stats":"𝛜"};
                return(
                  <button key={id} onClick={()=>setRightPanel(id)} title={label}
                    onMouseEnter={e=>{if(rightPanel!==id)e.currentTarget.style.background=t.accMuted;e.currentTarget.style.color=t.acc;}}
                    onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=rightPanel===id?t.acc:t.tx;}}
                    style={{width:52,minHeight:52,padding:"6px 4px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,border:"none",background:"transparent",color:rightPanel===id?t.acc:t.tx,cursor:"pointer",borderRadius:8,marginBottom:4,transition:"all 0.15s",boxShadow:rightPanel===id?`inset 2px 0 0 ${t.acc}`:"none"}}>
                    <span style={{fontSize:24}}>{icons[id]||"O"}</span>
                  </button>
                );
              })}
            </div>
              {/* Panel content — scrollbar hidden but scrollable */}
            <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
              {/* Panel header */}
              <div style={{padding:"12px 14px 10px",borderBottom:`1px solid ${t.bdr}`,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
                 <span style={{fontSize:18}}>{panelIcons[rightPanel]||"𝛜"}</span>
                  <span style={{fontSize:13,fontWeight:700,color:t.tx,textTransform:"capitalize",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{panelTabs.find(([id])=>id===rightPanel)?.[1]}</span>
                </div>
                <button onClick={()=>setRightPanelWidth(prev=>prev<440?440:320)} style={{background:"none",border:"none",color:t.tx2,cursor:"pointer",fontSize:14,padding:4}} title={rightPanelWidth<440?"Expand panel":"Collapse panel"}>
                  {rightPanelWidth<400?"⤢":"⤥"}
                </button>
              </div>
              <div style={{flex:1,overflowY:"auto",scrollbarWidth:"none"}}>
                <style>{`.panel-scroll::-webkit-scrollbar{display:none}`}</style>
                <div className="panel-scroll">
                  {rightPanel==="markups"&&(databaseMode?
                    <MarkupsPanel 
                      markups={databaseImages[currentImageIndex]?.markups||[]} 
                      t={t} 
                      theme={theme} 
                      selectedId={selectedId} 
                      onSelect={setSelectedId} 
                      onDelete={(id)=>{const newMarkups=(databaseImages[currentImageIndex]?.markups||[]).filter(m=>m.id!==id);updateDatabaseImage(currentImageIndex,{markups:newMarkups});if(selectedId===id)setSelectedId(null);}} 
                      onToggleVisible={(id)=>{const m=(databaseImages[currentImageIndex]?.markups||[]).find(m=>m.id===id);if(m)updateDatabaseImage(currentImageIndex,{markups:(databaseImages[currentImageIndex]?.markups||[]).map(mm=>mm.id===id?{...mm,visible:mm.visible===false}:mm)});}} 
                      onToggleLock={(id)=>{const m=(databaseImages[currentImageIndex]?.markups||[]).find(m=>m.id===id);if(m)updateDatabaseImage(currentImageIndex,{markups:(databaseImages[currentImageIndex]?.markups||[]).map(mm=>mm.id===id?{...mm,locked:!m.locked}:mm)});}} 
                      calibration={databaseImages[currentImageIndex]?.calibration||{done:false,pxPerMm:1}} 
                      placingMode={false} placingQueue={[]} placingIdx={0} 
                      onStopPlacing={()=>{}} onPausePlacing={()=>{}} onResumePlacing={()=>{}} 
                      onClear={()=>updateDatabaseImage(currentImageIndex,{markups:[]})} 
                      onAddPoint={()=>{setActiveTool("point");setCurrentDraw(null);}} 
                      norms={[]} 
                      formatAngle={formatAngle} 
                      angleMode={angleMode} 
                      setAngleMode={setAngleMode}
                    />
                    :<MarkupsPanel markups={markups} t={t} theme={theme} selectedId={selectedId} onSelect={setSelectedId} onDelete={delMarkup} onToggleVisible={id=>updMarkup(id,{visible:markups.find(m=>m.id===id)?.visible===false})} onToggleLock={id=>updMarkup(id,{locked:!markups.find(m=>m.id===id)?.locked})} onToggleLabel={id=>updMarkup(id,{noLabel:!markups.find(m=>m.id===id)?.noLabel})} calibration={calibration} placingMode={placingMode} placingQueue={placingQueue} placingIdx={placingIdx} onStopPlacing={()=>{setPlacingMode(false);setPlacingQueue([]);setPlacingIdx(0);}} onPausePlacing={()=>{setPlacingMode(false);}} onResumePlacing={()=>{setPlacingMode(true);}} onClear={()=>updVer({markups:[]})} onAddPoint={()=>{setActiveTool("point");setCurrentDraw(null);}} norms={norms} formatAngle={formatAngle} angleMode={angleMode} setAngleMode={setAngleMode} onReplace={(type,id)=>{if(replacingId===id){setReplacingId(null);setActiveTool("select");}else{setReplacingId(id);setActiveTool(type);}setCurrentDraw(null);}} replacingId={replacingId}/>)}
                  {rightPanel==="measurements"&&(databaseMode?
                    <MeasurementsPanel 
                      allMeas={(databaseImages[currentImageIndex]?.markups||[]).map(m=>({m,meas:computeMeasurements(m,databaseImages[currentImageIndex]?.calibration||{done:false,pxPerMm:1})})).filter(x=>Object.keys(x.meas).length>0)} 
                      t={t} 
                      calibration={databaseImages[currentImageIndex]?.calibration||{done:false,pxPerMm:1}} 
                      norms={[]} 
                      onUpdateNorms={()=>{}} 
                      onExportCSV={()=>{}} 
                      onOpenCalib={()=>setShowCalib(true)} 
                      formatAngle={formatAngle}
                    />
                    :<MeasurementsPanel allMeas={allMeas} t={t} calibration={calibration} norms={norms} onUpdateNorms={ns=>updVer({norms:ns})} onExportCSV={exportCSV} onOpenCalib={()=>setShowCalib(true)} formatAngle={formatAngle}/>)}
                  {rightPanel==="formulas"&&<FormulasPanel formulas={formulas} t={t} scope={measScope} onAdd={()=>{setEditFormulaId(null);setShowFormulaEditor(true);}} onEdit={id=>{setEditFormulaId(id);setShowFormulaEditor(true);}} onDelete={id=>updVer({formulas:formulas.filter(f=>f.id!==id)})}/>}
                  {rightPanel==="image"&&<ImagePanel t={t} processing={processing} setProcessing={p=>updVer({processing:p})} lutMode={lutMode} setLutMode={m=>updVer({lutMode:m})} lutInvert={lutInvert} setLutInvert={v=>updVer({lutInvert:v})} showLUT={showLUT} setShowLUT={setShowLUT} showScaleBar={showScaleBar} setShowScaleBar={setShowScaleBar} calibration={calibration} onOpenCalib={()=>setShowCalib(true)} onReset={()=>updVer({processing:{brightness:0,contrast:0,windowWidth:0,windowCenter:128,edgeEnhance:0},lutMode:"gray",lutInvert:false})} onShowHist={()=>setShowHistogram(v=>!v)} showHistogram={showHistogram}/>}
                  {rightPanel==="layers"&&<LayersPanel t={t} images={project.images} onUpdateImages={imgs=>onUpdateProject({images:imgs})} onAddImage={e=>{if(e.target.files[0])loadImage(e.target.files[0],true);}} showDisplacement={showDisplacement} setShowDisplacement={setShowDisplacement} compareVersionId={compareVersionId} setCompareVersionId={setCompareVersionId} versions={project.versions} onShowAlign={()=>setShowAlign(true)} onShowTransform={()=>setShowTransform(true)}/>}
                  {rightPanel==="versions"&&<VersionsPanel project={project} t={t} onUpdateProject={onUpdateProject} onUpdateVersion={onUpdateVersion} onExportTemplate={v=>exportCepht({name:`${project.name}`,projection:project.projection,markups:v.markups||[],formulas:v.formulas||[],norms:v.norms||[]})}/>}
                  {rightPanel==="reproducibility"&&<ReproducibilityPanel t={t} markups={markups} studies={reproStudies} onUpdateStudies={setReproStudies} activeStudyId={activeStudyId} setActiveStudyId={setActiveStudyId} reproCollecting={reproCollecting} setReproCollecting={setReproCollecting}/>}
                  {rightPanel==="statistics"&&(databaseMode?<DatabaseStatsPanel databaseImages={databaseImages} currentImageIndex={currentImageIndex} t={t}/>:<div style={{padding:12}}><div style={{fontSize:12,color:t.tx3,textAlign:"center"}}>Enable Database Mode to view statistics</div></div>)}
                  {rightPanel==="repro-stats"&&<StatisticsPanel t={t} studies={reproStudies}/>}
                  {rightPanel==="templates"&&<TemplatesPanel t={t} projection={project.projection} onLoadTemplate={loadTemplate} onImportCepht={data=>{
          if(data.markups){
            const newMarkups=data.markups.map(m=>({...m,id:uid(),points:[{x:-99999,y:-99999}],placed:false}));
            updVer({markups:[...markups,...newMarkups],formulas:[...formulas,...(data.formulas||[])],norms:[...(project.versions[0]?.norms||[]),...(data.norms||[])],analysisTemplate:data.name||"Imported"});
            setPlacingQueue(newMarkups.map(m=>m.id));setPlacingIdx(0);setPlacingMode(true);setRightPanel("markups");
          }
        }}/>}
                  {rightPanel==="themes"&&<ThemesPanel t={t} theme={theme} setTheme={setTheme}/>}
                </div>
              </div>
              {selectedMarkup&&<div style={{borderTop:`1px solid ${t.bdr}`,padding:12,flexShrink:0,maxHeight:isMobile?180:260,overflowY:"auto",scrollbarWidth:"none"}}>
                <MarkupProps m={selectedMarkup} t={t} theme={theme} onUpdate={p=>updMarkup(selectedMarkup.id,p)} onDelete={()=>delMarkup(selectedMarkup.id)} calibration={calibration} onParallel={()=>setActiveTool("parallel")} formatAngle={formatAngle}/>
              </div>}
            </div>
            {/* Resize handle */}
            <div onMouseDown={()=>setRightPanelResizing(true)} style={{width:4,cursor:"col-resize",background: rightPanelResizing ? t.acc : "transparent",transition:"background 0.15s",flexShrink:0}}/>
          </div>
        )}
      </div>

      {/* MODALS */}
      {showDatabaseImport&&<Modal t={t} title="Database Mode - Import Images" onClose={()=>setShowDatabaseImport(false)}><DatabaseImportModal t={t} onImport={loadDatabaseImages} onClose={()=>setShowDatabaseImport(false)}/></Modal>}
      {showTemplatePicker&&<Modal t={t} title="" onClose={()=>setShowTemplatePicker(false)}><TemplatePickerModal t={t} projection={project.projection} onPick={handleTemplatePick} onClose={()=>setShowTemplatePicker(false)}/></Modal>}
      {showCalib&&<Modal t={t} title="Calibration" onClose={()=>setShowCalib(false)}><CalibModal t={t} calibration={calibration} onFinish={finalizeCalib}/></Modal>}
      {showExport&&<Modal t={t} title="Export" onClose={()=>setShowExport(false)}><div style={{display:"flex",flexDirection:"column",gap:10}}><Btn t={t} onClick={()=>{exportCSV();setShowExport(false);}}>Measurements CSV</Btn><Btn t={t} onClick={()=>{exportCephx(project);setShowExport(false);}}>Full Project .cephx</Btn><Btn t={t} onClick={()=>{const name=window.prompt("Template name:",project.name+" Template");if(name){exportTemplateAsCepht(project,name);setShowExport(false);}}}>Template .cepht</Btn></div></Modal>}
      {pendingTextPos&&<Modal t={t} title="Text Annotation" onClose={()=>setPendingTextPos(null)}><TextModal t={t} defaultColor="#fbbf24" onConfirm={(txt,opts)=>{addMarkup({type:"text",points:[pendingTextPos],text:txt,...opts});setPendingTextPos(null);}} onCancel={()=>setPendingTextPos(null)}/></Modal>}
      {showAnon&&<Modal t={t} title="Anonymization & Access" onClose={()=>setShowAnon(false)}><AnonModal t={t} project={project} onUpdateProject={onUpdateProject} onClose={()=>setShowAnon(false)}/></Modal>}
      {showAlign&&<Modal t={t} title="Point-Based Alignment" onClose={()=>setShowAlign(false)}><AlignModal t={t} markups={markups} images={project.images} onUpdateImages={imgs=>onUpdateProject({images:imgs})} onClose={()=>setShowAlign(false)}/></Modal>}
      {showTransform&&<Modal t={t} title="Image Transform" onClose={()=>setShowTransform(false)}><TransformModal t={t} images={project.images} onUpdateImages={imgs=>onUpdateProject({images:imgs})} onClose={()=>setShowTransform(false)}/></Modal>}
      {showFormulaEditor&&<Modal t={t} title={editFormulaId?"Edit Formula":"New Formula"} onClose={()=>setShowFormulaEditor(false)}><FormulaEditor t={t} formula={editFormulaId?formulas.find(f=>f.id===editFormulaId):null} scope={measScope} onSave={f=>{const newFs=editFormulaId?formulas.map(x=>x.id===editFormulaId?f:x):[...formulas,f];updVer({formulas:newFs});setShowFormulaEditor(false);}} onClose={()=>setShowFormulaEditor(false)}/></Modal>}
      {showHistogram&&<FloatingHistogram hist={computeHistogram(project.images[0]?imgRefs.current[project.images[0].id]:null)} t={t} lutMode={lutMode} lutInvert={lutInvert} processing={processing} onProcessingChange={p=>updVer({processing:p})} onClose={()=>setShowHistogram(false)}/>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPRODUCIBILITY PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function ReproducibilityPanel({t,markups,studies,onUpdateStudies,activeStudyId,setActiveStudyId,reproCollecting,setReproCollecting}){
  const landmarkHint=[...new Set(markups.filter(m=>m.type==="point").map(m=>m.label).filter(Boolean))];
  const[expandedId,setExpandedId]=useState(null);
  const[showCreate,setShowCreate]=useState(false);
  const[activeTab,setActiveTab]=useState(null);

  const patchStudy=(id,patch)=>onUpdateStudies(studies.map(s=>s.id===id?{...s,...patch}:s));
  const studyOf=id=>studies.find(s=>s.id===id);

  const deleteStudy=id=>{
    onUpdateStudies(studies.filter(s=>s.id!==id));
    if(reproCollecting?.studyId===id)setReproCollecting(null);
    if(activeStudyId===id)setActiveStudyId(null);
    if(expandedId===id)setExpandedId(null);
  };

  const startIntraCollecting=s=>{
    const op=s.operators[0];
    if(!op)return;
    const trialIdx=s.intraNextTrialIdx??0;
    setActiveStudyId(s.id);
    patchStudy(s.id,{status:"in_progress"});
    setReproCollecting({studyId:s.id,opId:op.id,trialIdx});
  };

  const endIntraTrial=s=>{
    setReproCollecting(null);
    patchStudy(s.id,{intraNextTrialIdx:(s.intraNextTrialIdx??0)+1});
  };

  const finishIntraStudy=s=>{
    setReproCollecting(null);
    patchStudy(s.id,{status:"completed",completedAt:Date.now()});
    setActiveStudyId(null);
  };

  const startInterCollecting=s=>{
    const idx=s.interNextOpIdx??0;
    const op=s.operators[idx];
    if(!op)return;
    setActiveStudyId(s.id);
    patchStudy(s.id,{status:"in_progress"});
    setReproCollecting({studyId:s.id,opId:op.id,trialIdx:0});
  };

  const endInterOperator=s=>{
    setReproCollecting(null);
    patchStudy(s.id,{interNextOpIdx:(s.interNextOpIdx??0)+1});
  };

  const finishInterStudy=s=>{
    setReproCollecting(null);
    patchStudy(s.id,{status:"completed",completedAt:Date.now()});
    setActiveStudyId(null);
  };

  const statusBadge=s=>{
    if(s.status==="completed")return <Tag color={t.ok}>Done</Tag>;
    if(s.status==="in_progress")return <Tag color={t.warn}>Active</Tag>;
    return <Tag color={t.tx3}>Ready</Tag>;
  };

  return(
    <div style={{padding:12}}>
      <div style={{fontSize:11,color:t.tx2,marginBottom:10,lineHeight:1.45}}>
        Use the <strong>Point</strong> tool while a trial or operator session is active. Landmarks are labeled L1, L2… per session and stored in the table below. Points on the image hide when you end a trial or operator so the next session starts clean.
      </div>
      {landmarkHint.length>0&&<div style={{fontSize:10,color:t.tx3,marginBottom:10}}>Trace landmarks: {landmarkHint.slice(0,8).join(", ")}{landmarkHint.length>8?"…":""}</div>}

      {reproCollecting&&studyOf(reproCollecting.studyId)&&(
        <div style={{marginBottom:14,padding:12,borderRadius:8,background:t.accMuted,border:`1px solid ${t.acc}`}}>
          <div style={{fontSize:11,fontWeight:700,color:t.acc,marginBottom:6}}>Session active — place landmarks on the image</div>
          <div style={{fontSize:10,color:t.tx2}}>
            {(()=>{const s=studyOf(reproCollecting.studyId);const op=s.operators.find(o=>o.id===reproCollecting.opId);
              if(s.type==="intra")return`Intra-operator · Trial ${(reproCollecting.trialIdx??0)+1} of ${s.expectedTrials||2}`;
              return`Inter-operator · ${op?.name||"Operator"}`;
            })()}
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}>
            {studyOf(reproCollecting.studyId)?.type==="intra"&&<Btn t={t} small onClick={()=>endIntraTrial(studyOf(reproCollecting.studyId))}>End trial</Btn>}
            {studyOf(reproCollecting.studyId)?.type==="inter"&&<Btn t={t} small onClick={()=>endInterOperator(studyOf(reproCollecting.studyId))}>End operator</Btn>}
            <Btn t={t} small danger onClick={()=>setReproCollecting(null)}>Cancel session</Btn>
          </div>
        </div>
      )}

      <div style={{display:"flex",gap:6,marginBottom:12}}>
        <Btn t={t} small onClick={()=>setShowCreate(true)}>+ Create study</Btn>
      </div>
      {studies.length===0&&<div style={{color:t.tx3,fontSize:12,textAlign:"center",padding:20}}>No studies yet. Create a study, then start trials or operators from the card below.</div>}
      {studies.map(s=>{
        const exp=s.expectedTrials??2;
        const intraNext=s.intraNextTrialIdx??0;
        const interNext=s.interNextOpIdx??0;
        const collectingHere=reproCollecting?.studyId===s.id;
        return(
          <div key={s.id} style={{marginBottom:12,border:`1px solid ${expandedId===s.id||activeStudyId===s.id?t.acc:t.bdr}`,borderRadius:8,background:t.surf2}}>
            <div onClick={()=>{
              if(expandedId===s.id){setExpandedId(null);return;}
              setExpandedId(s.id);
              if(s.operators[0])setActiveTab(s.operators[0].id);
            }} style={{padding:"10px 12px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
              <div style={{minWidth:0}}>
                <div style={{fontWeight:700,fontSize:12,color:t.tx}}>{s.name}</div>
                <div style={{fontSize:10,color:t.tx2}}>{s.type==="intra"?`Intra · ${exp} trials · 1 operator`:`Inter · ${s.operators.length} operators · 1 session each`}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                {statusBadge(s)}
                <button type="button" onClick={e=>{e.stopPropagation();deleteStudy(s.id);}} style={{background:"none",border:"none",color:t.tx3,cursor:"pointer",fontSize:16}}>×</button>
              </div>
            </div>
            {expandedId===s.id&&(
              <div style={{borderTop:`1px solid ${t.bdr}`,padding:12}}>
                {s.type==="intra"&&(
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:10,color:t.tx2,marginBottom:8}}>Intra-operator workflow</div>
                    {!collectingHere&&s.status!=="completed"&&intraNext<exp&&(
                      <Btn t={t} small onClick={()=>startIntraCollecting(s)} style={{marginRight:8}}>{intraNext===0?"Start trials":`Start trial ${intraNext+1}`}</Btn>
                    )}
                    {!collectingHere&&s.status==="in_progress"&&intraNext>=exp&&(
                      <div>
                        <div style={{fontSize:10,color:t.ok,marginBottom:8}}>All trials recorded. End the study to lock results and enable the Statistics panel.</div>
                        <Btn t={t} onClick={()=>finishIntraStudy(s)}>End study</Btn>
                      </div>
                    )}
                    {s.status==="completed"&&<div style={{fontSize:10,color:t.ok}}>Study complete. Open the Statistics tab for ICC, Dahlberg, Bland–Altman, and paired t-test.</div>}
                  </div>
                )}
                {s.type==="inter"&&(
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:10,color:t.tx2,marginBottom:8}}>Inter-operator workflow (one session per operator)</div>
                    {!collectingHere&&s.status!=="completed"&&interNext<s.operators.length&&(
                      <Btn t={t} small onClick={()=>startInterCollecting(s)} style={{marginRight:8}}>{interNext===0?"Start operator 1":`Start ${s.operators[interNext]?.name||`Operator ${interNext+1}`}`}</Btn>
                    )}
                    {!collectingHere&&s.status==="in_progress"&&interNext>=s.operators.length&&(
                      <div>
                        <div style={{fontSize:10,color:t.ok,marginBottom:8}}>All operators recorded. End the study to finalize.</div>
                        <Btn t={t} onClick={()=>finishInterStudy(s)}>End study</Btn>
                      </div>
                    )}
                    {s.status==="completed"&&<div style={{fontSize:10,color:t.ok}}>Study complete. Open the Statistics tab for analysis and CSV export.</div>}
                  </div>
                )}

                <div style={{display:"flex",borderBottom:`1px solid ${t.bdr}`,marginBottom:8}}>
                  {s.operators.map((op,i)=>(
                    <button type="button" key={op.id} onClick={()=>setActiveTab(op.id)} style={{flex:1,padding:"8px",border:"none",background:"transparent",color:activeTab===op.id?t.acc:t.tx2,cursor:"pointer",fontSize:11,fontWeight:activeTab===op.id?700:400,borderBottom:activeTab===op.id?`2px solid ${t.acc}`:"none"}}>
                      {op.name||`Op ${i+1}`}
                    </button>
                  ))}
                </div>
                {s.operators.filter(o=>o.id===activeTab).map(op=>(
                  <div key={op.id} style={{maxHeight:320,overflowY:"auto"}}>
                    <div style={{fontSize:10,color:t.tx2,marginBottom:6}}>Recorded sessions</div>
                    {(op.trials||[]).map((trial,tIdx)=>(
                      <div key={trial.id||tIdx} style={{marginBottom:10,padding:8,borderRadius:6,background:t.surf3}}>
                        <div style={{fontSize:10,fontWeight:700,color:t.acc,marginBottom:4}}>{s.type==="intra"?`Trial ${tIdx+1}`:`Session (operator)`}</div>
                        <table style={{width:"100%",fontSize:9,borderCollapse:"collapse"}}>
                          <thead>
                            <tr style={{borderBottom:`1px solid ${t.bdr}`}}>
                              <th style={{textAlign:"left",padding:"2px 4px",color:t.tx2}}>Label</th>
                              <th style={{textAlign:"right",padding:"2px 4px",color:t.tx2}}>X</th>
                              <th style={{textAlign:"right",padding:"2px 4px",color:t.tx2}}>Y</th>
                              <th style={{width:18}}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {(trial.measurements||[]).map(m=>(
                              <tr key={m.id} style={{borderBottom:`1px solid ${t.bdr}44`}}>
                                <td style={{padding:"2px 4px",color:t.tx,fontWeight:600}}>{m.label}</td>
                                <td style={{padding:"2px",textAlign:"right",fontFamily:"'DM Mono',monospace",color:t.acc}}>{m.x.toFixed(2)}</td>
                                <td style={{padding:"2px",textAlign:"right",fontFamily:"'DM Mono',monospace",color:t.acc}}>{m.y.toFixed(2)}</td>
                                <td>
                                  <button type="button" onClick={()=>{onUpdateStudies(studies.map(st=>st.id===s.id?{...st,operators:st.operators.map(o=>o.id===op.id?{...o,trials:o.trials.map((tr,ti)=>ti===tIdx?{...tr,measurements:tr.measurements.filter(mm=>mm.id!==m.id)}:tr)}:o)}:st));}} style={{background:"none",border:"none",color:t.tx3,cursor:"pointer",fontSize:10}}>×</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                    {(!op.trials||!op.trials.length)&&<div style={{fontSize:10,color:t.tx3}}>No data yet.</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {showCreate&&<Modal t={t} title="New reproducibility study" onClose={()=>setShowCreate(false)}><CreateStudyModal t={t} onCreate={(name,type,operators,expectedTrials)=>{const s={id:uid(),name,type,expectedTrials:type==="intra"?expectedTrials:1,expectedOperators:type==="inter"?operators.length:1,operators:operators.map(o=>({id:uid(),name:o.name,trials:[]})),status:"configured",intraNextTrialIdx:0,interNextOpIdx:0,created:Date.now()};onUpdateStudies([...studies,s]);setShowCreate(false);}} onClose={()=>setShowCreate(false)}/></Modal>}
    </div>
  );
}

function CreateStudyModal({t,onCreate,onClose}){
  const[name,setName]=useState("");
  const[type,setType]=useState("intra");
  const[opCount,setOpCount]=useState(2);
  const[trials,setTrials]=useState(3);
  return(
    <div>
      <PropRow label="Study name" t={t}><Inp value={name} onChange={setName} t={t} placeholder="e.g. Landmark repeatability"/></PropRow>
      <PropRow label="Design" t={t}>
        <div style={{display:"flex",gap:8}}>
          <button type="button" onClick={()=>setType("intra")} style={{flex:1,padding:"6px",border:`1px solid ${type==="intra"?t.acc:t.bdr}`,borderRadius:6,background:type==="intra"?t.accMuted:t.surf3,color:type==="intra"?t.acc:t.tx2,cursor:"pointer",fontSize:11}}>Intra-operator</button>
          <button type="button" onClick={()=>setType("inter")} style={{flex:1,padding:"6px",border:`1px solid ${type==="inter"?t.acc:t.bdr}`,borderRadius:6,background:type==="inter"?t.accMuted:t.surf3,color:type==="inter"?t.acc:t.tx2,cursor:"pointer",fontSize:11}}>Inter-operator</button>
        </div>
      </PropRow>
      {type==="inter"&&<PropRow label="Operators" t={t}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button type="button" onClick={()=>setOpCount(Math.max(2,opCount-1))} style={{padding:"4px 10px",border:`1px solid ${t.bdr}`,borderRadius:4,background:t.surf3,color:t.tx,cursor:"pointer"}}>−</button>
          <span style={{fontFamily:"'DM Mono',monospace",color:t.acc,fontWeight:700}}>{opCount}</span>
          <button type="button" onClick={()=>setOpCount(Math.min(10,opCount+1))} style={{padding:"4px 10px",border:`1px solid ${t.bdr}`,borderRadius:4,background:t.surf3,color:t.tx,cursor:"pointer"}}>+</button>
        </div>
      </PropRow>}
      {type==="intra"&&<PropRow label="Number of trials" t={t}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button type="button" onClick={()=>setTrials(Math.max(2,trials-1))} style={{padding:"4px 10px",border:`1px solid ${t.bdr}`,borderRadius:4,background:t.surf3,color:t.tx,cursor:"pointer"}}>−</button>
          <span style={{fontFamily:"'DM Mono',monospace",color:t.acc,fontWeight:700}}>{trials}</span>
          <button type="button" onClick={()=>setTrials(Math.min(20,trials+1))} style={{padding:"4px 10px",border:`1px solid ${t.bdr}`,borderRadius:4,background:t.surf3,color:t.tx,cursor:"pointer"}}>+</button>
        </div>
      </PropRow>}
      <div style={{fontSize:10,color:t.tx3,marginTop:8,padding:8,background:t.surf3,borderRadius:4,lineHeight:1.45}}>
        {type==="intra"
          ?"One operator repeats landmark placement over several trials. After each trial, landmarks are hidden until the next trial starts."
          :"Each operator places landmarks once. After each operator, points hide until the next operator starts."}
      </div>
      <div style={{display:"flex",gap:8,marginTop:16}}>
        <Btn t={t} onClick={()=>{
          const ops=type==="intra"?[{name:"Operator 1"}]:Array.from({length:opCount},(_,i)=>({name:`Operator ${i+1}`}));
          onCreate(name||"Untitled study",type,ops,trials);
        }} style={{flex:1}}>Create</Btn>
        <Btn t={t} onClick={onClose} style={{flex:1}}>Cancel</Btn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTICS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function reproAllLabels(study){
  const labels=new Set();
  study.operators.forEach(op=>{
    (op.trials||[]).forEach(tr=>{(tr.measurements||[]).forEach(m=>{if(m.label)labels.add(m.label);});});
  });
  return[...labels].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
}

function reproIccMatrix(study,metric){
  if(study.type==="intra"){
    const op=study.operators[0];
    if(!op)return null;
    const trials=(op.trials||[]).filter(tr=>tr.measurements?.length);
    const labels=reproAllLabels(study);
    if(trials.length<2||labels.length<1)return null;
    const rows=trials.map(tr=>labels.map(lab=>{
      const m=(tr.measurements||[]).find(x=>x.label===lab);
      return m?metric==="x"?m.x:m.y:NaN;
    }));
    if(rows.some(r=>r.some(Number.isNaN)))return null;
    return rows;
  }
  const labels=reproAllLabels(study);
  if(labels.length<1)return null;
  const rows=study.operators.map(op=>{
    const tr=op.trials?.[0];
    return labels.map(lab=>{
      const m=(tr?.measurements||[]).find(x=>x.label===lab);
      return m?metric==="x"?m.x:m.y:NaN;
    });
  });
  if(rows.length<2||rows.some(r=>r.some(Number.isNaN)))return null;
  return rows;
}

function reproPairedVectors(study,metric,sessionA,sessionB){
  const labels=reproAllLabels(study);
  if(labels.length<1)return{vals1:[],vals2:[]};
  const pick=(op,trialIdx,lab)=>{
    const tr=op.trials?.[trialIdx];
    const m=(tr?.measurements||[]).find(x=>x.label===lab);
    return m?metric==="x"?m.x:m.y:null;
  };
  if(study.type==="intra"){
    const op=study.operators[0];
    const vals1=[],vals2=[];
    labels.forEach(lab=>{
      const a=pick(op,sessionA,lab),b=pick(op,sessionB,lab);
      if(a!==null&&b!==null){vals1.push(a);vals2.push(b);}
    });
    return{vals1,vals2};
  }
  const opA=study.operators[sessionA],opB=study.operators[sessionB];
  const vals1=[],vals2=[];
  labels.forEach(lab=>{
    const a=pick(opA,0,lab),b=pick(opB,0,lab);
    if(a!==null&&b!==null){vals1.push(a);vals2.push(b);}
  });
  return{vals1,vals2};
}

function exportReproTablesCsv(study){
  const rows=[["study","design","operator","session_index","landmark","x_px","y_px","timestamp"]];
  study.operators.forEach((op,oi)=>{
    (op.trials||[]).forEach((tr,ti)=>{
      (tr.measurements||[]).forEach(m=>{
        rows.push([study.name,study.type,op.name||`Operator_${oi+1}`,ti+1,m.label,m.x,m.y,m.timestamp||""]);
      });
    });
  });
  const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  a.download=`${String(study.name).replace(/\s+/g,"_")}_reproducibility.csv`;
  a.click();
}

function StatisticsPanel({t,studies}){
  const[selectedId,setSelectedId]=useState(null);
  const[metric,setMetric]=useState("x");
  const[pairA,setPairA]=useState(0);
  const[pairB,setPairB]=useState(1);

  const study=studies.find(s=>s.id===selectedId);
  const labels=reproAllLabels(study||{operators:[]});
  const iccMat=reproIccMatrix(study||{operators:[],type:"intra"},metric);
  const icc=iccMat&&iccMat.length>=2?calculateICC(iccMat):null;

  const maxP=study?(study.type==="intra"?Math.max(0,(study.operators[0]?.trials||[]).length-1):Math.max(0,study.operators.length-1)):0;
  const pa=Math.min(Math.max(0,pairA),maxP);
  const pb=Math.min(Math.max(0,pairB),maxP);

  const{vals1,vals2}=study?reproPairedVectors(study,metric,pa,pb):{vals1:[],vals2:[]};
  const dahl=vals1.length>=2&&vals1.length===vals2.length?dahlbergError(vals1,vals2):null;
  const bland=vals1.length>=2&&vals1.length===vals2.length?blandAltman(vals1,vals2):null;
  const tTest=vals1.length>=2&&vals1.length===vals2.length?tTestPaired(vals1,vals2):null;

  const descriptive=!study||!labels.length?[]:labels.map(lab=>{
    const vals=[];
    if(study.type==="intra"){
      (study.operators[0]?.trials||[]).forEach(tr=>{
        const m=(tr.measurements||[]).find(x=>x.label===lab);
        if(m)vals.push(metric==="x"?m.x:m.y);
      });
    }else{
      study.operators.forEach(op=>{
        const m=(op.trials?.[0]?.measurements||[]).find(x=>x.label===lab);
        if(m)vals.push(metric==="x"?m.x:m.y);
      });
    }
    if(!vals.length)return{lab,n:0,mean:null,sd:null,min:null,max:null};
    const m0=mean(vals),s=stdev(vals,m0);
    return{lab,n:vals.length,mean:m0,sd:s,min:Math.min(...vals),max:Math.max(...vals)};
  });

  return(
    <div style={{padding:12}}>
      <div style={{fontSize:11,color:t.tx2,marginBottom:12,lineHeight:1.45}}>
        Select a study with recorded landmark sessions. Descriptive statistics use all sessions for the chosen <strong>X</strong> or <strong>Y</strong> coordinate. ICC uses every session as a rater column; Dahlberg, Bland–Altman, and the paired t-test compare the two sessions you pick below (defaults: trial 1 vs 2, or operator 1 vs 2).
      </div>
      {studies.length===0&&<div style={{color:t.tx3,fontSize:12,textAlign:"center",padding:20}}>No studies yet. Create and complete a study in Reproducibility first.</div>}
      {studies.length>0&&(
        <div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:10,color:t.tx2,marginBottom:4}}>Study</div>
            <select value={selectedId||""} onChange={e=>setSelectedId(e.target.value||null)} style={{width:"100%",padding:"6px 8px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf3,color:t.tx,fontSize:12}}>
              <option value="">— Select —</option>
              {studies.map(s=><option key={s.id} value={s.id}>{s.name}{s.status==="completed"?" ✓":""}</option>)}
            </select>
          </div>
          {study&&(
            <>
              <div style={{marginBottom:12,padding:10,borderRadius:8,background:t.surf2,border:`1px solid ${t.bdr}`}}>
                <div style={{fontSize:10,fontWeight:700,color:t.tx,marginBottom:6}}>Overview</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:10}}>
                  <span style={{color:t.tx2}}>Design</span><span>{study.type==="intra"?"Intra-operator":"Inter-operator"}</span>
                  <span style={{color:t.tx2}}>Status</span><span style={{color:study.status==="completed"?t.ok:t.warn}}>{study.status||"—"}</span>
                  <span style={{color:t.tx2}}>Landmarks</span><span style={{fontFamily:"'DM Mono',monospace",color:t.acc}}>{labels.length}</span>
                </div>
                <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
                  <Btn t={t} small onClick={()=>exportReproTablesCsv(study)}>⬇ Download tables (.csv)</Btn>
                </div>
              </div>
              <div style={{marginBottom:12}}>
                <div style={{fontSize:10,color:t.tx2,marginBottom:4}}>Coordinate for analysis</div>
                <div style={{display:"flex",gap:6}}>
                  <button type="button" onClick={()=>setMetric("x")} style={{flex:1,padding:"6px",border:`1px solid ${metric==="x"?t.acc:t.bdr}`,borderRadius:6,background:metric==="x"?t.accMuted:t.surf3,color:metric==="x"?t.acc:t.tx2,cursor:"pointer",fontSize:11}}>X (px)</button>
                  <button type="button" onClick={()=>setMetric("y")} style={{flex:1,padding:"6px",border:`1px solid ${metric==="y"?t.acc:t.bdr}`,borderRadius:6,background:metric==="y"?t.accMuted:t.surf3,color:metric==="y"?t.acc:t.tx2,cursor:"pointer",fontSize:11}}>Y (px)</button>
                </div>
              </div>
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:700,color:t.tx,marginBottom:6}}>Descriptive statistics ({metric.toUpperCase()}, px)</div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",fontSize:9,borderCollapse:"collapse"}}>
                    <thead>
                      <tr style={{borderBottom:`1px solid ${t.bdr}`}}>
                        <th style={{textAlign:"left",padding:4,color:t.tx2}}>Landmark</th>
                        <th style={{textAlign:"right",padding:4,color:t.tx2}}>n</th>
                        <th style={{textAlign:"right",padding:4,color:t.tx2}}>Mean</th>
                        <th style={{textAlign:"right",padding:4,color:t.tx2}}>SD</th>
                        <th style={{textAlign:"right",padding:4,color:t.tx2}}>Min</th>
                        <th style={{textAlign:"right",padding:4,color:t.tx2}}>Max</th>
                      </tr>
                    </thead>
                    <tbody>
                      {descriptive.map(row=>(
                        <tr key={row.lab} style={{borderBottom:`1px solid ${t.bdr}44`}}>
                          <td style={{padding:4,color:t.tx,fontWeight:600}}>{row.lab}</td>
                          <td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.n}</td>
                          <td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace",color:t.acc}}>{row.mean!==null?row.mean.toFixed(3):"—"}</td>
                          <td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.sd!==null?row.sd.toFixed(3):"—"}</td>
                          <td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.min!==null?row.min.toFixed(2):"—"}</td>
                          <td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.max!==null?row.max.toFixed(2):"—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div style={{marginBottom:12}}>
                <div style={{fontSize:10,color:t.tx2,marginBottom:4}}>Pairwise comparison (Dahlberg, Bland–Altman, paired t)</div>
                {study.type==="intra"&&(
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <div>
                      <div style={{fontSize:9,color:t.tx3,marginBottom:2}}>Trial A</div>
                      <select value={pa} onChange={e=>setPairA(+e.target.value)} style={{width:"100%",padding:"6px 8px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf3,color:t.tx,fontSize:11}}>
                        {(study.operators[0]?.trials||[]).map((tr,i)=>(<option key={i} value={i}>Trial {i+1}</option>))}
                      </select>
                    </div>
                    <div>
                      <div style={{fontSize:9,color:t.tx3,marginBottom:2}}>Trial B</div>
                      <select value={pb} onChange={e=>setPairB(+e.target.value)} style={{width:"100%",padding:"6px 8px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf3,color:t.tx,fontSize:11}}>
                        {(study.operators[0]?.trials||[]).map((tr,i)=>(<option key={i} value={i}>Trial {i+1}</option>))}
                      </select>
                    </div>
                  </div>
                )}
                {study.type==="inter"&&(
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <div>
                      <div style={{fontSize:9,color:t.tx3,marginBottom:2}}>Operator A</div>
                      <select value={pa} onChange={e=>setPairA(+e.target.value)} style={{width:"100%",padding:"6px 8px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf3,color:t.tx,fontSize:11}}>
                        {study.operators.map((op,i)=>(<option key={op.id} value={i}>{op.name||`Operator ${i+1}`}</option>))}
                      </select>
                    </div>
                    <div>
                      <div style={{fontSize:9,color:t.tx3,marginBottom:2}}>Operator B</div>
                      <select value={pb} onChange={e=>setPairB(+e.target.value)} style={{width:"100%",padding:"6px 8px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf3,color:t.tx,fontSize:11}}>
                        {study.operators.map((op,i)=>(<option key={op.id} value={i}>{op.name||`Operator ${i+1}`}</option>))}
                      </select>
                    </div>
                  </div>
                )}
                <div style={{fontSize:9,color:t.tx3,marginTop:6}}>Paired rows: {vals1.length} landmarks with both values</div>
              </div>
              <div style={{border:`1px solid ${t.bdr}`,borderRadius:8,background:t.surf2,padding:12}}>
                <div style={{fontSize:11,fontWeight:700,color:t.acc,marginBottom:10}}>Inferential tests</div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:10,fontWeight:700,color:t.tx2,marginBottom:6}}>Intraclass correlation (ICC)</div>
                  {icc?(
                    <div style={{fontSize:11}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>ICC (absolute agreement)</span><span style={{fontFamily:"'DM Mono',monospace",color:t.acc,fontWeight:700}}>{icc.ICC_Absolute?.toFixed(4)??"—"}</span></div>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>ICC (consistency)</span><span style={{fontFamily:"'DM Mono',monospace",color:t.acc,fontWeight:700}}>{icc.ICC_Consistency?.toFixed(4)??"—"}</span></div>
                      <div style={{padding:"6px 8px",borderRadius:4,background:t.accMuted,color:t.acc,fontWeight:600,textAlign:"center",fontSize:10}}>{icc.interpretation}</div>
                    </div>
                  ):<div style={{color:t.tx3,fontSize:11}}>Need at least two complete sessions and matching landmarks on every session for ICC.</div>}
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:10,fontWeight:700,color:t.tx2,marginBottom:6}}>Dahlberg error</div>
                  {dahl?<div style={{display:"flex",justifyContent:"space-between",fontSize:11}}><span>Random error (paired)</span><span style={{fontFamily:"'DM Mono',monospace",color:t.acc,fontWeight:700}}>{dahl.error.toFixed(4)} px</span></div>:<div style={{color:t.tx3,fontSize:11}}>Need two sessions with the same landmarks.</div>}
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:10,fontWeight:700,color:t.tx2,marginBottom:6}}>Paired t-test</div>
                  {tTest?(
                    <div style={{fontSize:11}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>t</span><span style={{fontFamily:"'DM Mono',monospace",color:t.tx}}>{tTest.t.toFixed(4)}</span></div>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>df</span><span style={{fontFamily:"'DM Mono',monospace",color:t.tx}}>{tTest.df}</span></div>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>p-value</span><span style={{fontFamily:"'DM Mono',monospace",color:tTest.significant?t.err:t.ok,fontWeight:700}}>{tTest.pValue.toFixed(6)}</span></div>
                      <div style={{padding:"6px 8px",borderRadius:4,background:tTest.significant?t.err+"22":t.ok+"22",color:tTest.significant?t.err:t.ok,fontWeight:600,textAlign:"center"}}>{tTest.significant?"Significant (p < 0.05)":"Not significant"}</div>
                    </div>
                  ):<div style={{color:t.tx3,fontSize:11}}>Cannot compute (need paired observations).</div>}
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:t.tx2,marginBottom:6}}>Bland–Altman</div>
                  {bland?(
                    <div style={{fontSize:11}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>Mean difference</span><span style={{fontFamily:"'DM Mono',monospace",color:t.tx}}>{bland.meanDiff.toFixed(4)}</span></div>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>SD of differences</span><span style={{fontFamily:"'DM Mono',monospace",color:t.tx}}>{bland.stdDiff.toFixed(4)}</span></div>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>Lower LoA</span><span style={{fontFamily:"'DM Mono',monospace",color:t.warn}}>{bland.lowerLOA.toFixed(4)}</span></div>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>Upper LoA</span><span style={{fontFamily:"'DM Mono',monospace",color:t.warn}}>{bland.upperLOA.toFixed(4)}</span></div>
                    </div>
                  ):<div style={{color:t.tx3,fontSize:11}}>Cannot compute.</div>}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════════════════
export default function Cephalometry Studio(){
  const[theme,setTheme]=useState("bluish");const t={...THEMES[theme],id:theme};
  const[projects,setProjects]=useState([]);const[activeId,setActiveId]=useState(null);const[pinVerified,setPinVerified]=useState({});

  const activeProject=projects.find(p=>p.id===activeId);
  const needsPin=activeProject&&activeProject.accessControl?.requirePin&&!pinVerified[activeId];

  const updateProject=(id,patch)=>setProjects(prev=>prev.map(p=>p.id===id?{...p,...patch,modified:Date.now()}:p));
  const updateVersion=(projectId,versionId,patch)=>setProjects(prev=>prev.map(p=>{if(p.id!==projectId)return p;return{...p,modified:Date.now(),versions:p.versions.map(v=>v.id===versionId?{...v,...patch}:v)};}));

  const createProject=(projection,name,meta)=>{
    const p={...mkProject(projection),name,meta:{...mkProject(projection).meta,...meta}};
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
    <div style={{background:t.bg,minHeight:"100vh"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap" rel="stylesheet"/>
      {!activeId&&<HomePage t={t} theme={theme} setTheme={setTheme} projects={projects} onOpen={id=>setActiveId(id)} onCreate={createProject} onImport={importCephxFile}/>}
      {activeId&&needsPin&&<PinGate t={t} project={activeProject} onVerified={()=>setPinVerified(prev=>({...prev,[activeId]:true}))} onCancel={()=>setActiveId(null)}/>}
      {activeId&&!needsPin&&activeProject&&(
        <Workspace key={activeId} project={activeProject}
          onUpdateProject={patch=>updateProject(activeId,patch)}
          onUpdateVersion={(versionId,patch)=>updateVersion(activeId,versionId,patch)}
          onHome={()=>setActiveId(null)} t={t} theme={theme} setTheme={setTheme}/>
      )}
    </div>
  );
}
