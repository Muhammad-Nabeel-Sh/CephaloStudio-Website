import { useState, useEffect, useRef, useCallback, useMemo, useReducer } from "react";
import { THEMES, TOOLS, PREDEFINED, LUT_PRESETS } from "./constants.js";
import { SILHOUETTES } from "./silhouettes.js";
import { uid, clamp, dist, vpts, computeMeasurements, snapPoint, alignOnePoint, alignTwoPoints, buildScope, evalFormula, getMissingVars, mean, stdev, tTestPaired, calculateICC, calculateICC_CI, dahlbergError, blandAltman, median, iqr, coefficientOfVariation, standardError, minimalDetectableChange, spearmanCorrelation, pearsonCorrelation, correlationMatrix, computePerLandmarkError, detectSystematicBias, anovaAcrossSessions, computeNormsComparison, detectOutliers, confidenceInterval, linearRegression } from "./utils.js";
import { processImageToCanvas, computeHistogram, FloatingHistogram } from "./imageUtils.jsx";
import { KatexSpan, LatexFloatingPanel } from "./hooks.jsx";
import { Btn, Tag, Sld, PropRow, Inp } from "./ui.jsx";
import ToolBtn from "./ToolBtn.jsx";
import { drawMarkup, drawInProgress, drawScaleBar, drawLUTLegend, drawSnapIndicator, drawDisplacementVectors, hitTest, getSilhouetteHandlesImage } from "./markups.jsx";
import { MarkupsPanel, MeasurementsPanel, FormulasPanel, ImagePanel, LayersPanel, MarkupProps, TemplatesPanel, SilhouettesPanel } from "./panels.jsx";
import { Modal } from "./panels/Modal.jsx";
import HomePage from "./panels/HomePage.jsx";
import TemplatePickerModal from "./panels/TemplatePickerModal.jsx";
import VersionsPanel from "./panels/VersionsPanel.jsx";
import AnonModal from "./panels/AnonModal.jsx";
import ReproducibilityPanel from "./panels/ReproducibilityPanel.jsx";

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
    activeVersionId:v.id,versions:[v],images:[]};
}

function exportCephx(project){
  const payload={format:"cephx",version:"2.0",exported:Date.now(),project};
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));
  a.download=`${project.name.replace(/\s+/g,"_")}.cephx`;a.click();
}
function importCephx(file,onLoad){
  const reader=new FileReader();
  reader.onload=e=>{try{const d=JSON.parse(e.target.result);if(d.format==="cephx"&&d.project)onLoad(d.project);else alert("Invalid .cephx file");}catch(err){console.error("Cephx import error:",err);alert("Cannot parse file");}};
  reader.readAsText(file);
}
function exportCepht(template){
  const payload={format:"cepht",version:"1.0",exported:Date.now(),...template};
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));
  a.download=`${template.name.replace(/\s+/g,"_")}.cepht`;a.click();
}
function importCepht(file,onLoad){
  const reader=new FileReader();
  reader.onload=e=>{try{const d=JSON.parse(e.target.result);if(d.format==="cepht")onLoad(d);else alert("Invalid .cepht file");}catch(err){console.error("Cepht import error:",err);alert("Cannot parse template");}};
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



// ═══════════════════════════════════════════════════════════════════════════════
// NEW CASE FORM
// ═══════════════════════════════════════════════════════════════════════════════
function NewCaseForm({t,onCreate,onCancel}){
  const[d,setD]=useState({name:"Case 001",patientId:"",patientName:"",dob:"",age:"",gender:"",ethnicity:"",clinician:"",facility:"",referral:"",notes:""});
  const upd=(k,v)=>setD(prev=>({...prev,[k]:v}));
  return(
    <div>
      <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:t.tx,marginBottom:20}}>New Case</div>
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

function PtSel({val,onChange,t,pts}){
  return <select value={val} onChange={e=>onChange(e.target.value)} style={{width:"100%",background:t.surf3,border:`1px solid ${t.bdr}`,borderRadius:4,padding:"4px 8px",color:t.tx,fontSize:12,fontFamily:"inherit"}}><option value="">—</option>{pts.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select>;
}

function AlignModal({t,markups,images,onUpdateImages,onClose}){
  const pts=markups.filter(m=>m.type==="point"&&vpts(m)[0]?.x>-9000);
  const[src1,setSrc1]=useState("");const[dst1,setDst1]=useState("");const[src2,setSrc2]=useState("");const[dst2,setDst2]=useState("");
  const[tgtId,setTgtId]=useState(images[1]?.id||"");
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
        <div><div style={{fontSize:10,color:t.tx2,marginBottom:2}}>Src pt 1</div><PtSel val={src1} onChange={setSrc1} t={t} pts={pts}/></div>
        <div><div style={{fontSize:10,color:t.tx2,marginBottom:2}}>Dst pt 1</div><PtSel val={dst1} onChange={setDst1} t={t} pts={pts}/></div>
        <div><div style={{fontSize:10,color:t.tx2,marginBottom:2}}>Src pt 2</div><PtSel val={src2} onChange={setSrc2} t={t} pts={pts}/></div>
        <div><div style={{fontSize:10,color:t.tx2,marginBottom:2}}>Dst pt 2</div><PtSel val={dst2} onChange={setDst2} t={t} pts={pts}/></div>
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
        {groups.length>0&&<div style={{marginTop:6}}>
          <div style={{fontSize:10,color:t.tx3,marginBottom:4}}>Click a variable to insert:</div>
          {groups.map(([cat,vars])=>(
            <div key={cat} style={{marginBottom:4}}>
              <div style={{fontSize:9,color:t.tx2,fontWeight:700,marginBottom:2,textTransform:"uppercase",letterSpacing:0.5}}>{cat}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                {vars.map(v=><button key={v} type="button" onClick={()=>insertVar(v)} title={`${scope[v]?.toFixed(2)??"?"}`}
                  style={{fontSize:11,padding:"2px 8px",borderRadius:4,border:`1px solid ${t.bdr}`,background:t.surf3,color:t.tx,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=t.acc;e.currentTarget.style.background=t.accMuted;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=t.bdr;e.currentTarget.style.background=t.surf3;}}>
                  {v}
                </button>)}
              </div>
            </div>
          ))}
        </div>}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",padding:"6px 8px",background:preview!==null?t.ok+"11":expr?t.err+"11":t.surf2,borderRadius:6,marginBottom:8}}>
        <span style={{fontSize:12,color:t.tx2}}>Preview</span>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:700,color:preview!==null?t.ok:expr?t.err:t.tx3}}>
          {preview!==null?`${preview.toFixed(2)} ${unit}`:expr?(missing.length>0?`Unknown: ${missing.join(", ")}`:"Error"):"—"}
        </span>
      </div>
      <PropRow label="Unit" t={t}><Inp value={unit} onChange={setUnit} t={t} placeholder="°, mm, ratio"/></PropRow>
      <PropRow label="Notes" t={t}><Inp value={desc} onChange={setDesc} t={t} placeholder="Reference"/></PropRow>
      <div style={{display:"flex",gap:8,marginTop:14}}><Btn t={t} onClick={()=>onSave({id:formula?.id||uid(),name,latex,expression:expr,unit,description:desc})} style={{flex:1}} disabled={!name||!expr}>Save</Btn><Btn t={t} onClick={onClose} style={{flex:1}}>Cancel</Btn></div>
      {bigLatex&&<LatexFloatingPanel latex={bigLatex} onClose={()=>setBigLatex(null)}/>}
    </div>
  );
}

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
// MARKUP TABLES PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function MarkupTablesPanel({databaseImages,t}){
  const[activeTable,setActiveTable]=useState("points");

  const exportTableCSV=(type)=>{
    const rows=[["Variable",...databaseImages.map((_,i)=>`Image ${i+1}`)]];
    
    if(type==="points"){
      const maxPoints=Math.max(...databaseImages.map(img=>(img.markups||[]).filter(m=>m.type==="point").length));
      for(let ptIdx=0;ptIdx<maxPoints;ptIdx++){
        rows.push([`P${ptIdx+1}_X`]);
        rows.push([`P${ptIdx+1}_Y`]);
      }
      databaseImages.forEach(img=>{
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
      databaseImages.forEach(img=>{
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
      databaseImages.forEach(img=>{
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
      databaseImages.forEach(img=>{
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
      databaseImages.forEach(img=>{
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
  const _numImages=databaseImages.length;

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
// WORKSPACE
// ═══════════════════════════════════════════════════════════════════════════════
const INITIAL_WORKSPACE={
  zoom:1,pan:{x:40,y:40},
  mousePos:null,snapPos:null,
  selectedId:null,replacingId:null,currentDraw:null,
  activeTool:"select",
  snapEnabled:true,showScaleBar:false,
  showLUT:false,showHistogram:false,
  showAnnotations:true,annotationSize:1,showDisplacement:false,compareVersionId:null,
  rightPanel:"markups",
  showCalib:false,pendingRuler:null,
  showExport:false,showAnon:false,
  showAlign:false,showTransform:false,
  pendingTextPos:null,
  showFormulaEditor:false,editFormulaId:null,
  placingMode:false,placingQueue:[],placingIdx:0,
  loadingImages:false,
  showTemplatePicker:true,
  isMobile:window.innerWidth<768,showMobilePanel:false,
  toolbarPos:{x:70,y:100},toolbarDragging:false,
  rightPanelWidth:320,rightPanelResizing:false,
  reproStudies:[],activeStudyId:null,reproCollecting:null,
  spotlightMode:false,
  databaseMode:false,databaseImages:[],currentImageIndex:0,showDatabaseImport:false,
};
function wsReducer(state,action){
  if(action.type==="SET"){const n={...state};for(const[k,v]of Object.entries(action.payload))n[k]=typeof v==="function"?v(state[k]):v;return n;}
  return state;
}
function Workspace({project,onUpdateProject,onUpdateVersion,onHome,t,theme,setTheme,onSave}){
  const canvasRef=useRef(null);const containerRef=useRef(null);
  const procCache=useRef(new Map());const imgRefs=useRef({});const rafRef=useRef(null);

  // file input refs
  const openImgRef=useRef(null);const stackImgRef=useRef(null);const importRef=useRef(null);

  const[ws,dispatch]=useReducer(wsReducer,INITIAL_WORKSPACE);
  const{zoom,pan,mousePos,snapPos,selectedId,replacingId,currentDraw,
    activeTool,snapEnabled,showScaleBar,
    showLUT,showHistogram,showAnnotations,annotationSize,showDisplacement,compareVersionId,
    rightPanel,showCalib,pendingRuler,showExport,showAnon,showAlign,showTransform,
    pendingTextPos,showFormulaEditor,editFormulaId,
    placingMode,placingQueue,placingIdx,loadingImages,
    showTemplatePicker,isMobile,showMobilePanel,
    toolbarPos,toolbarDragging,rightPanelWidth,rightPanelResizing,
    reproStudies,activeStudyId,reproCollecting,spotlightMode,
    databaseMode,databaseImages,currentImageIndex,showDatabaseImport}=ws;
  const rightPanelWidthRef=useRef(rightPanelWidth);rightPanelWidthRef.current=rightPanelWidth;
  const toolbarPosRef=useRef(toolbarPos);toolbarPosRef.current=toolbarPos;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const setSelectedId=v=>dispatch({type:"SET",payload:{selectedId:typeof v==="function"?v(selectedId):v}});
  const setShowLUT=v=>dispatch({type:"SET",payload:{showLUT:typeof v==="function"?v(showLUT):v}});
  const setShowScaleBar=v=>dispatch({type:"SET",payload:{showScaleBar:typeof v==="function"?v(showScaleBar):v}});
  const setShowDisplacement=v=>dispatch({type:"SET",payload:{showDisplacement:typeof v==="function"?v(showDisplacement):v}});
  const setCompareVersionId=v=>dispatch({type:"SET",payload:{compareVersionId:typeof v==="function"?v(compareVersionId):v}});
  const setShowHistogram=v=>dispatch({type:"SET",payload:{showHistogram:typeof v==="function"?v(showHistogram):v}});
  const setReproStudies=v=>dispatch({type:"SET",payload:{reproStudies:typeof v==="function"?v(reproStudies):v}});
  const setActiveStudyId=v=>dispatch({type:"SET",payload:{activeStudyId:typeof v==="function"?v(activeStudyId):v}});
  const setReproCollecting=v=>dispatch({type:"SET",payload:{reproCollecting:typeof v==="function"?v(reproCollecting):v}});
  const setPlacingQueue=v=>dispatch({type:"SET",payload:{placingQueue:typeof v==="function"?v(placingQueue):v}});
  const setShowMobilePanel=v=>dispatch({type:"SET",payload:{showMobilePanel:typeof v==="function"?v(showMobilePanel):v}});
  const setActiveTool=v=>dispatch({type:"SET",payload:{activeTool:typeof v==="function"?v(activeTool):v}});
  const setDatabaseImages=v=>dispatch({type:"SET",payload:{databaseImages:typeof v==="function"?v(databaseImages):v}});
  const setRightPanel=v=>dispatch({type:"SET",payload:{rightPanel:typeof v==="function"?v(rightPanel):v}});

  useEffect(()=>{const fn=()=>dispatch({type:"SET",payload:{isMobile:window.innerWidth<768}});window.addEventListener("resize",fn);return()=>window.removeEventListener("resize",fn);},[]);

  useEffect(()=>{
    if(!rightPanelResizing)return;
    const onMove=e=>{const nw=Math.max(200,Math.min(500,rightPanelWidthRef.current+e.movementX));rightPanelWidthRef.current=nw;dispatch({type:"SET",payload:{rightPanelWidth:nw}});};
    const onUp=()=>dispatch({type:"SET",payload:{rightPanelResizing:false}});
    window.addEventListener("mousemove",onMove);
    window.addEventListener("mouseup",onUp);
    return()=>{window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};
  },[rightPanelResizing]);

  useEffect(()=>{
    if(!toolbarDragging)return;
    const onMove=e=>{const np={x:toolbarPosRef.current.x+e.movementX,y:toolbarPosRef.current.y+e.movementY};toolbarPosRef.current=np;dispatch({type:"SET",payload:{toolbarPos:np}});};
    const onUp=()=>dispatch({type:"SET",payload:{toolbarDragging:false}});
    window.addEventListener("mousemove",onMove);
    window.addEventListener("mouseup",onUp);
    return()=>{window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};
  },[toolbarDragging]);

  const isPanning=useRef(false);const panStart=useRef(null);
  const isDragging=useRef(false);const dragStart=useRef(null);const dragStartState=useRef(null);
  const dragMid=useRef(null);const dragPtIdx=useRef(null);
  const silhouetteAction=useRef(null);
  const canvasSize=useRef({w:800,h:600});const lastTouchDist=useRef(null);
  const undoStackRef=useRef([]);
  const redoStackRef=useRef([]);

  const activeVersion=project.versions.find(v=>v.id===project.activeVersionId)||project.versions[0];
  const markups=useMemo(()=>activeVersion?.markups||[],[activeVersion?.markups]);

  const calibration=useMemo(()=>activeVersion?.calibration||{done:false,pxPerMm:1},[activeVersion?.calibration]);
  const processing=useMemo(()=>activeVersion?.processing||{brightness:0,contrast:0,windowWidth:0,windowCenter:128,edgeEnhance:0},[activeVersion?.processing]);
  const lutMode=activeVersion?.lutMode||"gray";const lutInvert=activeVersion?.lutInvert||false;
  const formulas=activeVersion?.formulas||[];const norms=activeVersion?.norms||[];
  const selectedMarkup=markups.find(m=>m.id===selectedId);
  const compareVersion=project.versions.find(v=>v.id===compareVersionId);

  const updVer=patch=>onUpdateVersion(activeVersion.id,patch);
  const angleMode=activeVersion?.angleMode||"abs-deg";
  const setAngleMode=m=>updVer({angleMode:m});
  const formatAngle=(v)=>{
    const[sign,unit]=angleMode.split("-");
    let val=v;
    if(sign==="abs")val=Math.abs(v);
    else if(sign==="simple")val=Math.abs(v);
    else if(sign==="reflex")val=Math.abs(v)>180?Math.abs(v):360-Math.abs(v);
    if(unit==="rad")return(val*Math.PI/180).toFixed(4)+" rad";
    return val.toFixed(1)+"°";
  };
  const pushUndo=()=>{
    undoStackRef.current.push(JSON.stringify(markups));
    if(undoStackRef.current.length>50)undoStackRef.current.shift();
    redoStackRef.current=[];
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const undo=()=>{
    if(undoStackRef.current.length===0)return;
    const prev=undoStackRef.current.pop();
    if(prev)updVer({markups:JSON.parse(prev)});
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const redo=()=>{
    if(redoStackRef.current.length===0)return;
    undoStackRef.current.push(JSON.stringify(markups));
    const next=redoStackRef.current.pop();
    if(next)updVer({markups:JSON.parse(next)});
  };
  const updMarkups=fn=>{pushUndo();updVer({markups:fn(markups)});};
  const syncReproStudyCoords=(repro,x,y)=>{
    if(!repro?.measurementId)return;
    dispatch({type:"SET",payload:{reproStudies:reproStudies.map(s=>{
      if(s.id!==repro.studyId)return s;
      return{...s,operators:s.operators.map(o=>{
        if(o.id!==repro.opId)return o;
        const trials=(o.trials||[]).map((tr,ti)=>{
          if(ti!==repro.trialIdx)return tr;
          return{...tr,measurements:(tr.measurements||[]).map(me=>me.id===repro.measurementId?{...me,x,y}:me)};
        });
        return{...o,trials};
      })};
    })}});
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const delMarkup=id=>{
    const useDb=databaseMode&&databaseImages.length>0&&!reproCollecting;
    if(useDb){
      const newMarkups=(databaseImages[currentImageIndex]?.markups||[]).filter(mm=>mm.id!==id);
      updateDatabaseImage(currentImageIndex,{markups:newMarkups});
      if(selectedId===id)dispatch({type:"SET",payload:{selectedId:null}});
      return;
    }
    const m=markups.find(x=>x.id===id);
    updMarkups(ms=>ms.filter(mm=>mm.id!==id));
    if(selectedId===id)dispatch({type:"SET",payload:{selectedId:null}});
    if(m?.repro?.measurementId){
      dispatch({type:"SET",payload:{reproStudies:reproStudies.map(s=>{
        if(s.id!==m.repro.studyId)return s;
        return{...s,operators:s.operators.map(o=>{
          if(o.id!==m.repro.opId)return o;
          const trials=(o.trials||[]).map((tr,ti)=>{
            if(ti!==m.repro.trialIdx)return tr;
            return{...tr,measurements:(tr.measurements||[]).filter(me=>me.id!==m.repro.measurementId)};
          });
          return{...o,trials};
        })};
      })}});
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      dispatch({type:"SET",payload:{selectedId:m.id}});
      return m;
    }
    updMarkups(ms=>[...ms,m]);dispatch({type:"SET",payload:{selectedId:m.id}});return m;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      dispatch({type:"SET",payload:{replacingId:null}});
    }else{
      addMarkup(newMarkup);
    }
  };

  // load images
  useEffect(()=>{
    const pending=project.images.filter(imgE=>!imgRefs.current[imgE.id]&&imgE.dataUrl);
    if(!pending.length)return;
    dispatch({type:"SET",payload:{loadingImages:true}});
    let loaded=0;
    pending.forEach(imgE=>{const img=new Image();img.onload=()=>{imgRefs.current[imgE.id]=img;loaded++;if(loaded===pending.length)dispatch({type:"SET",payload:{loadingImages:false}});scheduleRedraw();};img.src=imgE.dataUrl;});
  },[project.images]); // eslint-disable-line react-hooks/exhaustive-deps

  const getProcessed=useCallback(imgEntry=>{
    const key=`${imgEntry.id}-${JSON.stringify(processing)}-${lutMode}-${lutInvert}`;
    if(!procCache.current.has(key)){for(const k of procCache.current.keys())if(k.startsWith(imgEntry.id+"-")&&k!==key)procCache.current.delete(k);procCache.current.set(key,processImageToCanvas(imgRefs.current[imgEntry.id],processing,lutMode,lutInvert));}
    return procCache.current.get(key);
  },[processing,lutMode,lutInvert]);

  const toImage=useCallback((sx,sy)=>({x:(sx-pan.x)/zoom,y:(sy-pan.y)/zoom}),[pan,zoom]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const getCanvasPos=e=>{const r=canvasRef.current.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};

  useEffect(()=>{
    const obs=new ResizeObserver(()=>{const el=containerRef.current;if(!el)return;const c=canvasRef.current;if(!c)return;c.width=el.clientWidth;c.height=el.clientHeight;canvasSize.current={w:el.clientWidth,h:el.clientHeight};scheduleRedraw();});
    if(containerRef.current)obs.observe(containerRef.current);return()=>obs.disconnect();
  },[]); // eslint-disable-line react-hooks/exhaustive-deps

  const redraw=useCallback(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext("2d");ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle=t.bg;ctx.fillRect(0,0,canvas.width,canvas.height);
    
    const currentDbImg=databaseMode&&databaseImages.length>0?databaseImages[currentImageIndex]:null;
    const activeMarkups=currentDbImg?.markups||[];
    const activeCalibration=currentDbImg?.calibration||{done:false,pxPerMm:1};
    const _activeProcessing=currentDbImg?.processing||{brightness:0,contrast:0,windowWidth:0,windowCenter:128,edgeEnhance:0};
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
  },[markups,selectedId,zoom,pan,project.images,calibration,t,currentDraw,mousePos,snapEnabled,snapPos,showScaleBar,showLUT,showAnnotations,annotationSize,placingMode,placingQueue,placingIdx,showDisplacement,compareVersion,getProcessed,reproCollecting,angleMode,databaseMode,databaseImages,currentImageIndex]);

  useEffect(()=>{if(!rafRef.current)rafRef.current=requestAnimationFrame(()=>{rafRef.current=null;redraw();});});
  const scheduleRedraw=useCallback(()=>{if(!rafRef.current)rafRef.current=requestAnimationFrame(()=>{rafRef.current=null;redraw();});},[redraw]);

  const loadImage=(file,addToStack=false)=>{
    if(!file||!file.type.startsWith("image/"))return;
    dispatch({type:"SET",payload:{loadingImages:true}});
    const reader=new FileReader();
    reader.onload=e=>{
      const dataUrl=e.target.result;const img=new Image();
      img.onload=()=>{
        const id=uid();imgRefs.current[id]=img;
        const entry={id,name:file.name,dataUrl,dx:0,dy:0,opacity:1,blendMode:"normal",visible:true,color:"none",transform:{tx:0,ty:0,rot:0,scale:1}};
        const newImages=addToStack?[...project.images,entry]:[entry];
        onUpdateProject({images:newImages});
        dispatch({type:"SET",payload:{loadingImages:false}});
        if(!addToStack){const cw=canvasSize.current.w-80,ch=canvasSize.current.h-80;const sc=Math.min(cw/(img.naturalWidth||600),ch/(img.naturalHeight||500),1);dispatch({type:"SET",payload:{zoom:sc}});dispatch({type:"SET",payload:{pan:{x:40,y:40}}});}
      };img.src=dataUrl;
    };reader.readAsDataURL(file);
  };

  const loadDatabaseImages=async (files)=>{
    dispatch({type:"SET",payload:{loadingImages:true}});
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
      dispatch({type:"SET",payload:{databaseImages:validImages}});
      dispatch({type:"SET",payload:{currentImageIndex:0}});
      dispatch({type:"SET",payload:{databaseMode:true}});
      const firstImg=validImages[0];
      imgRefs.current[firstImg.id]=await new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=firstImg.dataUrl;});
      const cw=canvasSize.current.w-80,ch=canvasSize.current.h-80;
      const img=new Image();img.onload=()=>{const sc=Math.min(cw/(img.naturalWidth||600),ch/(img.naturalHeight||500),1);dispatch({type:"SET",payload:{zoom:sc}});dispatch({type:"SET",payload:{pan:{x:40,y:40}}});dispatch({type:"SET",payload:{loadingImages:false}});};img.src=firstImg.dataUrl;
    }else{
      dispatch({type:"SET",payload:{loadingImages:false}});
    }
  };

  const updateDatabaseImage=(index,patch)=>{
    dispatch({type:"SET",payload:{databaseImages:databaseImages.map((img,i)=>i===index?{...img,...patch}:img)}});
  };

  const navigateImage=(direction)=>{
    if(direction==="next"&&currentImageIndex<databaseImages.length-1){
      dispatch({type:"SET",payload:{currentImageIndex:currentImageIndex+1}});
    }else if(direction==="prev"&&currentImageIndex>0){
      dispatch({type:"SET",payload:{currentImageIndex:currentImageIndex-1}});
    }
  };

  useEffect(()=>{
    if(!databaseMode||databaseImages.length===0)return;
    const currentDbImg=databaseImages[currentImageIndex];
    if(!currentDbImg)return;
    if(!imgRefs.current[currentDbImg.id]){
      const img=new Image();
      img.onload=()=>{imgRefs.current[currentDbImg.id]=img;scheduleRedraw();};
      img.src=currentDbImg.dataUrl;
    }else{
      scheduleRedraw();
    }
  },[currentImageIndex,databaseMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDrop=e=>{e.preventDefault();loadImage(e.dataTransfer.files[0]);};

  useEffect(()=>{
    const fn=e=>{
      if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA")return;
      if((e.ctrlKey||e.metaKey)&&e.key==="z"){undo();return;}
      if((e.ctrlKey||e.metaKey)&&e.key==="y"){redo();return;}
      if(e.key==="Escape"){dispatch({type:"SET",payload:{currentDraw:null}});dispatch({type:"SET",payload:{selectedId:null}});if(placingMode){if(placingIdx<placingQueue.length-1)dispatch({type:"SET",payload:{placingIdx:placingIdx+1}});else{dispatch({type:"SET",payload:{placingMode:false}});dispatch({type:"SET",payload:{placingQueue:[]}});dispatch({type:"SET",payload:{placingIdx:0}});}}return;}
      const tool=TOOLS.filter(Boolean).find(t2=>t2.key===e.key.toLowerCase());
      if(tool){dispatch({type:"SET",payload:{activeTool:tool.id}});dispatch({type:"SET",payload:{currentDraw:null}});return;}
      if((e.key==="Delete"||e.key==="Backspace")&&selectedId){const m=markups.find(x=>x.id===selectedId);if(!m?.locked)delMarkup(selectedId);return;}
      if(e.key==="+"||e.key==="=")dispatch({type:"SET",payload:{zoom:z=>clamp(z*1.15,0.05,15)}});
      if(e.key==="-")dispatch({type:"SET",payload:{zoom:z=>clamp(z/1.15,0.05,15)}});
      if(e.key==="0"){dispatch({type:"SET",payload:{zoom:1}});dispatch({type:"SET",payload:{pan:{x:40,y:40}}});}
    };
    window.addEventListener("keydown",fn);return()=>window.removeEventListener("keydown",fn);
  },[selectedId,placingMode,placingIdx,placingQueue,markups,delMarkup,redo,undo]);

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
      if(placingIdx<placingQueue.length-1)dispatch({type:"SET",payload:{placingIdx:placingIdx+1}});else{dispatch({type:"SET",payload:{placingMode:false}});dispatch({type:"SET",payload:{placingQueue:[]}});dispatch({type:"SET",payload:{placingIdx:0}});}
      return;
    }
    if(activeTool==="pan"){isPanning.current=true;panStart.current={mx:e.clientX,my:e.clientY,px:pan.x,py:pan.y};return;}
    if(activeTool==="select"){
      const hit=hitTest(activeMarkupsList,ip,zoom,reproCollecting);
      setSelectedId(hit);
      if(hit){
        const m=activeMarkupsList.find(x=>x.id===hit);
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
              dragStartState.current=JSON.stringify(activeMarkupsList);
              return;
            }
            for (let hi = 0; hi < handles.corners.length; hi++) {
              const c = handles.corners[hi];
              if (isFinite(c.x) && dist(ip, c) < thr) {
                const cx = (handles.bbox.minX + handles.bbox.maxX) / 2;
                const cy = (handles.bbox.minY + handles.bbox.maxY) / 2;
                silhouetteAction.current = {
                  type: "resize", markupId: hit, startIp: ip,
                  initialScale: m.scale || 1,
                  center: { x: cx, y: cy },
                  initialDist: dist(ip, { x: cx, y: cy }),
                };
                dragStartState.current=JSON.stringify(activeMarkupsList);
                return;
              }
            }
          } catch(e) { console.error("Silhouette handle error", e); }
          isDragging.current=true;dragMid.current=hit;dragStartState.current=JSON.stringify(activeMarkupsList);
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
        isDragging.current=true;dragMid.current=hit;dragStartState.current=JSON.stringify(activeMarkupsList);
        let bi=0,bd=Infinity;(m.points||[]).forEach((p,i)=>{const d=dist(p,ip);if(d<bd){bd=d;bi=i;}});
        dragPtIdx.current=bi;dragStart.current=ip;
      }
      return;
    }
    if(activeTool==="text"){dispatch({type:"SET",payload:{pendingTextPos:ip}});return;}
    if(activeTool==="point"){
      if(replacingId){updMarkup(replacingId,{points:[ip],placed:true});dispatch({type:"SET",payload:{replacingId:null}});return;}
      if(reproCollecting){
        const{studyId,opId,trialIdx}=reproCollecting;
        const study=reproStudies.find(s=>s.id===studyId);
        if(study){
          const n=activeMarkupsList.filter(m=>m.type==="point"&&m.repro&&m.repro.studyId===studyId&&m.repro.opId===opId&&m.repro.trialIdx===trialIdx).length;
          const label=`L${n+1}`;
          const measurementId=uid();
          addMarkup({type:"point",points:[ip],label,color:t.acc,size:6,definition:"",repro:{studyId,opId,trialIdx,measurementId}});
          dispatch({type:"SET",payload:{reproStudies:reproStudies.map(s=>{
            if(s.id!==studyId)return s;
            return{...s,operators:s.operators.map(o=>{
              if(o.id!==opId)return o;
              const trials=[...(o.trials||[])];
              while(trials.length<=trialIdx)trials.push({id:uid(),measurements:[]});
              const tr=trials[trialIdx]||{id:uid(),measurements:[]};
              trials[trialIdx]={...tr,measurements:[...(tr.measurements||[]),{id:measurementId,label,x:ip.x,y:ip.y,timestamp:Date.now()}]};
              return{...o,trials};
            })};
          })}});
        }
        return;
      }
      const nNon=activeMarkupsList.filter(m=>m.type==="point"&&!m.repro).length;
      addMarkup({type:"point",points:[ip],label:`P${nNon+1}`,color:t.acc,size:6,definition:""});
      return;
    }
    if(activeTool==="ruler"){if(!currentDraw)dispatch({type:"SET",payload:{currentDraw:{type:"ruler",points:[ip]}}});else{const ruler={...currentDraw,type:"ruler",points:[...currentDraw.points,ip],label:"Ruler"};dispatch({type:"SET",payload:{pendingRuler:ruler}});addMarkup(ruler);dispatch({type:"SET",payload:{currentDraw:null}});dispatch({type:"SET",payload:{showCalib:true}});}return;}
    if(activeTool==="parallel"){if(selectedMarkup&&(selectedMarkup.type==="line"||selectedMarkup.type==="parallel")){const vp=vpts(selectedMarkup);if(vp.length>=2){const dx=vp[1].x-vp[0].x,dy=vp[1].y-vp[0].y,len=Math.sqrt(dx*dx+dy*dy)||1,half=len/2;addMarkup({type:"parallel",points:[{x:ip.x-dx/len*half,y:ip.y-dy/len*half},{x:ip.x+dx/len*half,y:ip.y+dy/len*half}],color:"#34d399",width:1.5,style:"solid",label:`∥`,showLength:true});return;}}if(!currentDraw)dispatch({type:"SET",payload:{currentDraw:{type:"line",points:[ip]}}});else{finalizeMarkup({...currentDraw,points:[...currentDraw.points,ip]});dispatch({type:"SET",payload:{currentDraw:null}});}return;}
    if(activeTool==="midpoint"){if(!currentDraw)dispatch({type:"SET",payload:{currentDraw:{type:"midpoint",points:[ip]}}});else{const p1=currentDraw.points[0],p2=ip;if(p1.x>-9000&&p2.x>-9000){const mid={x:(p1.x+p2.x)/2,y:(p1.y+p2.y)/2};const n=activeMarkupsList.filter(m=>m.type==="point").length;addMarkup({type:"point",points:[mid],label:`M${n+1}`,color:"#fbbf24",size:6,definition:"Midpoint"});}dispatch({type:"SET",payload:{currentDraw:null}});}return;}
    if(activeTool==="perppoint"){if(!currentDraw)dispatch({type:"SET",payload:{currentDraw:{type:"perppoint",points:[ip]}}});else if(currentDraw.points.length===1)dispatch({type:"SET",payload:{currentDraw:{type:"perppoint",points:[currentDraw.points[0],ip]}}});else{const p1=currentDraw.points[0],p2=currentDraw.points[1],p3=ip;if(p1.x>-9000&&p2.x>-9000&&p3.x>-9000){const lx1=p2.x-p1.x,ly1=p2.y-p1.y;const lx2=-ly1,ly2=lx1;const perpPt={x:p3.x+lx2,y:p3.y+ly2};const n=activeMarkupsList.filter(m=>m.type==="line"||m.type==="perp").length+1;addMarkup({type:"line",mode:"segment",points:[perpPt,p3],color:"#f472b6",width:1.5,style:"solid",label:`⊥${n}`,showLength:true});}dispatch({type:"SET",payload:{currentDraw:null}});}return;}
    if(activeTool==="arrow"){if(!currentDraw)dispatch({type:"SET",payload:{currentDraw:{type:"arrow",points:[ip]}}});else{const p1=currentDraw.points[0],p2=ip;if(p1.x>-9000&&p2.x>-9000){addMarkup({type:"arrow",points:[p1,p2],color:"#34d399",width:2});}dispatch({type:"SET",payload:{currentDraw:null}});}return;}
    if(["line","angle3","angle4","polygon","curve","perp"].includes(activeTool)){
      if(!currentDraw)dispatch({type:"SET",payload:{currentDraw:{type:activeTool,points:[ip],curveStyle:"linear",replacingId}}});
      else{const nps=[...currentDraw.points,ip];const need={line:2,angle3:3,angle4:4,perp:3}[activeTool];if(need&&nps.length>=need){finalizeMarkup({...currentDraw,points:nps});dispatch({type:"SET",payload:{currentDraw:null}});}else dispatch({type:"SET",payload:{currentDraw:{...currentDraw,points:nps}}});}return;}
  },[activeTool,markups,zoom,pan,snapEnabled,currentDraw,selectedMarkup,placingMode,placingQueue,placingIdx,reproCollecting,reproStudies,databaseMode,databaseImages,currentImageIndex,replacingId,setSelectedId,updMarkup,addMarkup,finalizeMarkup,toImage,getCanvasPos,t]);

  const handleMouseMove=useCallback(e=>{
    const currentDbImg=databaseMode&&!reproCollecting&&databaseImages.length>0?databaseImages[currentImageIndex]:null;
    const dbMarkups=currentDbImg?.markups||[];
    const activeMarkupsList=databaseMode&&!reproCollecting?dbMarkups:markups;
    const sp=getCanvasPos(e);dispatch({type:"SET",payload:{mousePos:sp}});
    if(snapEnabled&&activeTool!=="select"&&activeTool!=="pan"){const ip=toImage(sp.x,sp.y);const sn=snapPoint(ip,activeMarkupsList,12/zoom,snapEnabled);dispatch({type:"SET",payload:{snapPos:(Math.abs(sn.x-ip.x)>0.1||Math.abs(sn.y-ip.y)>0.1)?sn:null}});}else dispatch({type:"SET",payload:{snapPos:null}});
    if(isPanning.current&&panStart.current)dispatch({type:"SET",payload:{pan:{x:panStart.current.px+(e.clientX-panStart.current.mx),y:panStart.current.py+(e.clientY-panStart.current.my)}}});
    if(isDragging.current&&dragMid.current){const ip=toImage(sp.x,sp.y);const dx=ip.x-dragStart.current.x,dy=ip.y-dragStart.current.y;const m=activeMarkupsList.find(x=>x.id===dragMid.current);if(!m)return;if(m.type==="silhouette"){updMarkup(dragMid.current,{position:{x:(m.position?.x||0)+dx,y:(m.position?.y||0)+dy}});}else{updMarkup(dragMid.current,{points:(m.points||[]).map((p,i)=>i===dragPtIdx.current?{x:p.x+dx,y:p.y+dy}:p)});}dragStart.current=ip;}
    if(silhouetteAction.current){
      try {
        const ip=toImage(sp.x,sp.y);const sa=silhouetteAction.current;
        const m=activeMarkupsList.find(x=>x.id===sa.markupId);
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
      } catch { silhouetteAction.current=null; /*silent*/ }
    }
  },[activeTool,markups,zoom,snapEnabled,databaseMode,databaseImages,currentImageIndex,reproCollecting,updMarkup,toImage,getCanvasPos]);

  const handleMouseUp=()=>{
    const currentDbImg=databaseMode&&!reproCollecting&&databaseImages.length>0?databaseImages[currentImageIndex]:null;
    const activeMarkupsList=databaseMode&&!reproCollecting?(currentDbImg?.markups||[]):markups;
    if((isDragging.current||silhouetteAction.current)&&dragStartState.current){
      const currentState=JSON.stringify(activeMarkupsList);
      if(dragStartState.current!==currentState){
        undoStackRef.current.push(dragStartState.current);
        if(undoStackRef.current.length>50)undoStackRef.current.shift();
        redoStackRef.current=[];
      }
      dragStartState.current=null;
    }
    isPanning.current=false;isDragging.current=false;silhouetteAction.current=null;
  };
  const handleDblClick=()=>{if((activeTool==="polygon"||activeTool==="curve")&&currentDraw?.points.length>=2){finalizeMarkup(currentDraw);dispatch({type:"SET",payload:{currentDraw:null}});}};
  useEffect(()=>{const c=canvasRef.current;if(!c)return;const onWheel=e=>{if(Math.abs(e.deltaY)>0.1||Math.abs(e.deltaX)>0.1){e.preventDefault();e.stopPropagation();const sp=getCanvasPos(e),f=e.deltaY>0?0.9:1.1,nz=clamp(zoom*f,0.05,15);dispatch({type:"SET",payload:{pan:prev=>({x:sp.x-(sp.x-prev.x)*(nz/zoom),y:sp.y-(sp.y-prev.y)*(nz/zoom)})}});dispatch({type:"SET",payload:{zoom:nz}});}};c.addEventListener("wheel",onWheel,{passive:false});return()=>c.removeEventListener("wheel",onWheel);},[zoom]);
  const handleTouchStart=e=>{e.preventDefault();if(e.touches.length===1){const t2=e.touches[0];handleMouseDown({button:0,clientX:t2.clientX,clientY:t2.clientY});}if(e.touches.length===2)lastTouchDist.current=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);};
  const handleTouchMove=e=>{e.preventDefault();if(e.touches.length===1){const t2=e.touches[0];handleMouseMove({clientX:t2.clientX,clientY:t2.clientY});}if(e.touches.length===2&&lastTouchDist.current){const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);const f=d/lastTouchDist.current,nz=clamp(zoom*f,0.05,15);const cx=(e.touches[0].clientX+e.touches[1].clientX)/2,cy=(e.touches[0].clientY+e.touches[1].clientY)/2;const r=canvasRef.current.getBoundingClientRect();const sp={x:cx-r.left,y:cy-r.top};dispatch({type:"SET",payload:{pan:prev=>({x:sp.x-(sp.x-prev.x)*(nz/zoom),y:sp.y-(sp.y-prev.y)*(nz/zoom)})}});dispatch({type:"SET",payload:{zoom:nz}});lastTouchDist.current=d;}};
  const handleTouchEnd=()=>{handleMouseUp();lastTouchDist.current=null;};

  const finalizeCalib=(mm,manualPpm)=>{
    const useDb=databaseMode&&databaseImages.length>0&&!reproCollecting;
    if(useDb){
      const currentDbImg=databaseImages[currentImageIndex];
      const currentMarkups=currentDbImg?.markups||[];
      if(manualPpm){
        updateDatabaseImage(currentImageIndex,{calibration:{done:true,pxPerMm:manualPpm,knownMm:mm}});
        dispatch({type:"SET",payload:{showCalib:false}});
        return;
      }
      const ruler=pendingRuler||currentMarkups.find(m=>m.type==="ruler");if(!ruler)return;const vp=vpts(ruler);if(vp.length<2)return;
      updateDatabaseImage(currentImageIndex,{calibration:{done:true,pxPerMm:dist(vp[0],vp[1])/mm,knownMm:mm}});
      dispatch({type:"SET",payload:{showCalib:false}});
      return;
    }
    if(manualPpm){updVer({calibration:{done:true,pxPerMm:manualPpm,knownMm:mm}});dispatch({type:"SET",payload:{showCalib:false}});return;}
    const ruler=pendingRuler||markups.find(m=>m.type==="ruler");if(!ruler)return;const vp=vpts(ruler);if(vp.length<2)return;
    updVer({calibration:{done:true,pxPerMm:dist(vp[0],vp[1])/mm,knownMm:mm}});dispatch({type:"SET",payload:{showCalib:false}});
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
    setPlacingQueue(newMarkups.map(m=>m.id));dispatch({type:"SET",payload:{placingIdx:0}});dispatch({type:"SET",payload:{placingMode:true}});dispatch({type:"SET",payload:{rightPanel:"markups"}});
  };

  const projectionKeyMap={
    "Submentovertex (SMV)":"smv",
    "Panoramic Radiograph (OPG)":"opg",
  };
  const handleTemplatePick=(type,analysis,file)=>{
    dispatch({type:"SET",payload:{showTemplatePicker:false}});
    if(type==="blank")return;
    if(type==="analysis"&&analysis){loadTemplate(analysis);return;}
    if(type==="complete"&&analysis){loadTemplate(analysis);return;}
    if(type==="projection"&&analysis){
      const key=projectionKeyMap[analysis.name];
      if(key&&PREDEFINED[key]&&PREDEFINED[key].length>0){
        const template=PREDEFINED[key][0];
        const projData={...analysis,pts:template?.pts||[]};
        if(projData.pts.length>0){loadTemplate(projData);return;}
      }
    }
    if(type==="upload"&&file){
      importCepht(file,d=>{
        if(d.markups){
          const newMarkups=d.markups.map(m=>({...m,id:uid(),points:[{x:-99999,y:-99999}],placed:false}));
          updVer({markups:[...markups,...newMarkups],analysisTemplate:d.name||"Imported"});
          setPlacingQueue(newMarkups.map(m=>m.id));dispatch({type:"SET",payload:{placingIdx:0}});dispatch({type:"SET",payload:{placingMode:true}});dispatch({type:"SET",payload:{rightPanel:"markups"}});
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
  const _availAnalyses=PREDEFINED[project.projection]||[];

  const panelIcons={markups:"◉",measurements:"📏",formulas:"∑",image:"▦",layers:"🗐",versions:"⏲",reproducibility:"↻",statistics:"𝛀",templates:"▤",silhouettes:"⊡"};
  const panelTabs=[["markups","Markups"],["measurements","Measure"],["formulas","Formulas"],["image","Image"],["layers","Layers"],["versions","Versions"],["reproducibility","Reproducibility"],["statistics","Statistics"],["templates","Templates"],["silhouettes","Silhouettes"]];

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
          <span><img src="/favicon.svg" alt="Website Icon" width="48" height="48"/> </span>
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
          <Btn t={t} small active={snapEnabled} onClick={()=>dispatch({type:"SET",payload:{snapEnabled:!snapEnabled}})}>⊙ Snap</Btn>
          <Btn t={t} small active={showScaleBar} onClick={()=>dispatch({type:"SET",payload:{showScaleBar:!showScaleBar}})}>⟺</Btn>
          <Btn t={t} small active={showAnnotations} onClick={()=>dispatch({type:"SET",payload:{showAnnotations:!showAnnotations}})}>Aa</Btn>
          {showAnnotations&&<input type="range" min="0.5" max="2" step="0.1" value={annotationSize} onChange={e=>dispatch({type:"SET",payload:{annotationSize:+e.target.value}})} style={{width:60,marginLeft:4,accentColor:t.acc}} title={`Annotation size: ${annotationSize.toFixed(1)}`}/>}
          {project.images.length>1&&<Btn t={t} small active={showDisplacement} onClick={()=>dispatch({type:"SET",payload:{showDisplacement:!showDisplacement}})}>⇝ Vec</Btn>}
          <div style={{width:1,height:20,background:t.bdr}}/>
        </>}
        <Btn t={t} small onClick={()=>openImgRef.current?.click()}>Open</Btn>
        {!isMobile&&<Btn t={t} small onClick={()=>stackImgRef.current?.click()}>+ Stack</Btn>}
        <Btn t={t} small onClick={()=>onSave?.(project)}>Save</Btn>
        {!isMobile&&<div style={{display:"flex",alignItems:"center",gap:6}}>
          <Btn t={t} small onClick={()=>dispatch({type:"SET",payload:{showDatabaseImport:true}})}>DB</Btn>
          <button onClick={()=>{if(!databaseMode&&databaseImages.length===0)dispatch({type:"SET",payload:{showDatabaseImport:true}});else if(databaseMode){if(!window.confirm("Turn off Database Mode? This will clear all imported database images."))return;dispatch({type:"SET",payload:{databaseMode:false}});dispatch({type:"SET",payload:{databaseImages:[]}});dispatch({type:"SET",payload:{currentImageIndex:0}});}}} title={databaseImages.length===0?"Import images first":"Toggle Database Mode"} style={{background:"none",border:"none",cursor:databaseImages.length===0?"not-allowed":"pointer",padding:4,display:"flex",alignItems:"center",opacity:databaseImages.length===0?0.5:1}}>
            <div style={{width:36,height:20,borderRadius:10,background:databaseMode?t.acc:t.surf3,border:`1px solid ${databaseMode?t.acc:t.bdr}`,position:"relative",transition:"all 0.2s"}}>
              <div style={{width:16,height:16,borderRadius:8,background:databaseMode?(t.id==="light"?"#fff":t.bg):t.tx,position:"absolute",top:1,left:databaseMode?18:2,transition:"all 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,3)"}}/>
            </div>
          </button>
        </div>}
        {!isMobile&&<Btn t={t} small onClick={()=>dispatch({type:"SET",payload:{showExport:true}})}>Export</Btn>}
        {!isMobile&&<Btn t={t} small onClick={()=>dispatch({type:"SET",payload:{showAnon:true}})}>Anonymization</Btn>}
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
                <button onClick={()=>{const next=!spotlightMode;dispatch({type:"SET",payload:{spotlightMode:next}});if(databaseMode){setDatabaseImages(prev=>prev.map(img=>{if(next){return{...img,opacityBeforeSpotlight:img.opacity||1,opacity:0.5};}return{...img,opacity:img.opacityBeforeSpotlight||1};}));}else if(project.images.length>0){const imgs=project.images.map(img=>{if(next){return{...img,opacityBeforeSpotlight:img.opacity||1,opacity:0.5};}return{...img,opacity:img.opacityBeforeSpotlight||1};});onUpdateProject({images:imgs});}}} title="Spotlight (reduce image opacity)" style={{width:42,height:42,borderRadius:8,border:"none",background:spotlightMode?t.acc:t.surf2,color:spotlightMode?(theme==="light"?"#fff":t.bg):t.tx,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:spotlightMode?`0 0 0 2px ${t.acc}`:"none"}}>💡</button>
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
                <button onClick={()=>dispatch({type:"SET",payload:{zoom:z=>clamp(z*1.3,0.05,15)}})} style={{flex:1,height:32,borderRadius:6,border:"none",background:"transparent",color:t.tx2,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} title="Zoom In">＋</button>
                <button onClick={()=>dispatch({type:"SET",payload:{zoom:z=>clamp(z/1.3,0.05,15)}})} style={{flex:1,height:32,borderRadius:6,border:"none",background:"transparent",color:t.tx2,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} title="Zoom Out">－</button>
              </div>
              {/* Row 11: Fit to Window */}
              <div style={{display:"flex",justifyContent:"center"}}>
                <button onClick={()=>{dispatch({type:"SET",payload:{zoom:1}});dispatch({type:"SET",payload:{pan:{x:40,y:40}}});}} style={{width:38,height:32,borderRadius:6,border:"none",background:"transparent",color:t.tx2,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} title="Fit to Window (⊙)">⊙</button>
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
          {loadingImages&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:t.bg+"cc",zIndex:10}}>
            <div style={{textAlign:"center"}}><div style={{width:28,height:28,border:`3px solid ${t.bdr}`,borderTopColor:t.acc,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 10px"}}/><div style={{fontSize:13,color:t.tx2}}>Loading images…</div></div>
          </div>}
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
                const icons={markups:"◉",measurements:"📏",formulas:"∑",image:"▦",layers:"🗐",versions:"⏲",reproducibility:"↻",statistics:"𝛀",templates:"▤",silhouettes:"⊡",themes:"◐"};
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
                <button onClick={()=>dispatch({type:"SET",payload:{rightPanelWidth:rightPanelWidth<440?440:320}})} style={{background:"none",border:"none",color:t.tx2,cursor:"pointer",fontSize:14,padding:4}} title={rightPanelWidth<440?"Expand panel":"Collapse panel"}>
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
                      onDelete={(id)=>{const newMarkups=(databaseImages[currentImageIndex]?.markups||[]).filter(m=>m.id!==id);updateDatabaseImage(currentImageIndex,{markups:newMarkups});if(selectedId===id)dispatch({type:"SET",payload:{selectedId:null}});}} 
                      onToggleVisible={(id)=>{const m=(databaseImages[currentImageIndex]?.markups||[]).find(m=>m.id===id);if(m)updateDatabaseImage(currentImageIndex,{markups:(databaseImages[currentImageIndex]?.markups||[]).map(mm=>mm.id===id?{...mm,visible:mm.visible===false}:mm)});}} 
                      onToggleLock={(id)=>{const m=(databaseImages[currentImageIndex]?.markups||[]).find(m=>m.id===id);if(m)updateDatabaseImage(currentImageIndex,{markups:(databaseImages[currentImageIndex]?.markups||[]).map(mm=>mm.id===id?{...mm,locked:!m.locked}:mm)});}} 
                      calibration={databaseImages[currentImageIndex]?.calibration||{done:false,pxPerMm:1}} 
                      placingMode={false} placingQueue={[]} placingIdx={0} 
                      onStopPlacing={()=>{}} onPausePlacing={()=>{}} onResumePlacing={()=>{}} 
                      onClear={()=>updateDatabaseImage(currentImageIndex,{markups:[]})} 
                      onAddPoint={()=>{dispatch({type:"SET",payload:{activeTool:"point"}});dispatch({type:"SET",payload:{currentDraw:null}});}} 
                      norms={[]} 
                      formatAngle={formatAngle} 
                      angleMode={angleMode} 
                      setAngleMode={setAngleMode}
                    />
                    :<MarkupsPanel markups={markups} t={t} theme={theme} selectedId={selectedId} onSelect={setSelectedId} onDelete={delMarkup} onToggleVisible={id=>updMarkup(id,{visible:markups.find(m=>m.id===id)?.visible===false})} onToggleLock={id=>updMarkup(id,{locked:!markups.find(m=>m.id===id)?.locked})} onToggleLabel={id=>updMarkup(id,{noLabel:!markups.find(m=>m.id===id)?.noLabel})} calibration={calibration} placingMode={placingMode} placingQueue={placingQueue} placingIdx={placingIdx} onStopPlacing={()=>{dispatch({type:"SET",payload:{placingMode:false}});dispatch({type:"SET",payload:{placingQueue:[]}});dispatch({type:"SET",payload:{placingIdx:0}});}} onPausePlacing={()=>{dispatch({type:"SET",payload:{placingMode:false}});}} onResumePlacing={()=>{dispatch({type:"SET",payload:{placingMode:true}});}} onClear={()=>updVer({markups:[]})} onAddPoint={()=>{dispatch({type:"SET",payload:{activeTool:"point"}});dispatch({type:"SET",payload:{currentDraw:null}});}} norms={norms} formatAngle={formatAngle} angleMode={angleMode} setAngleMode={setAngleMode} onReplace={(type,id)=>{if(replacingId===id){dispatch({type:"SET",payload:{replacingId:null}});dispatch({type:"SET",payload:{activeTool:"select"}});}else{dispatch({type:"SET",payload:{replacingId:id}});dispatch({type:"SET",payload:{activeTool:type}});}dispatch({type:"SET",payload:{currentDraw:null}});}} replacingId={replacingId}/>)}
                  {rightPanel==="measurements"&&(databaseMode?
                    <MeasurementsPanel 
                      allMeas={(databaseImages[currentImageIndex]?.markups||[]).map(m=>({m,meas:computeMeasurements(m,databaseImages[currentImageIndex]?.calibration||{done:false,pxPerMm:1})})).filter(x=>Object.keys(x.meas).length>0)} 
                      t={t} 
                      calibration={databaseImages[currentImageIndex]?.calibration||{done:false,pxPerMm:1}} 
                      norms={[]} 
                      onUpdateNorms={()=>{}} 
                      onExportCSV={()=>{}} 
                      onOpenCalib={()=>dispatch({type:"SET",payload:{showCalib:true}})} 
                      formatAngle={formatAngle}
                    />
                    :<MeasurementsPanel allMeas={allMeas} t={t} calibration={calibration} norms={norms} onUpdateNorms={ns=>updVer({norms:ns})} onExportCSV={exportCSV} onOpenCalib={()=>dispatch({type:"SET",payload:{showCalib:true}})} formatAngle={formatAngle}/>)}
                  {rightPanel==="formulas"&&<FormulasPanel formulas={formulas} t={t} scope={measScope} onAdd={()=>{dispatch({type:"SET",payload:{editFormulaId:null}});dispatch({type:"SET",payload:{showFormulaEditor:true}});}} onEdit={id=>{dispatch({type:"SET",payload:{editFormulaId:id}});dispatch({type:"SET",payload:{showFormulaEditor:true}});}} onDelete={id=>updVer({formulas:formulas.filter(f=>f.id!==id)})}/>}
                  {rightPanel==="image"&&<ImagePanel t={t} processing={processing} setProcessing={p=>updVer({processing:p})} lutMode={lutMode} setLutMode={m=>updVer({lutMode:m})} lutInvert={lutInvert} setLutInvert={v=>updVer({lutInvert:v})} showLUT={showLUT} setShowLUT={setShowLUT} showScaleBar={showScaleBar} setShowScaleBar={setShowScaleBar} calibration={calibration} onOpenCalib={()=>dispatch({type:"SET",payload:{showCalib:true}})} onReset={()=>updVer({processing:{brightness:0,contrast:0,windowWidth:0,windowCenter:128,edgeEnhance:0},lutMode:"gray",lutInvert:false})} onShowHist={()=>setShowHistogram(v=>!v)} showHistogram={showHistogram}/>}
                  {rightPanel==="layers"&&<LayersPanel t={t} images={project.images} onUpdateImages={imgs=>onUpdateProject({images:imgs})} onAddImage={e=>{if(e.target.files[0])loadImage(e.target.files[0],true);}} showDisplacement={showDisplacement} setShowDisplacement={setShowDisplacement} compareVersionId={compareVersionId} setCompareVersionId={setCompareVersionId} versions={project.versions} onShowAlign={()=>dispatch({type:"SET",payload:{showAlign:true}})} onShowTransform={()=>dispatch({type:"SET",payload:{showTransform:true}})}/>}
                  {rightPanel==="versions"&&<VersionsPanel project={project} t={t} onUpdateProject={onUpdateProject} onUpdateVersion={onUpdateVersion} onExportTemplate={v=>exportCepht({name:`${project.name}`,projection:project.projection,markups:v.markups||[],formulas:v.formulas||[],norms:v.norms||[]})}/>}
                  {rightPanel==="reproducibility"&&<ReproducibilityPanel t={t} markups={markups} studies={reproStudies} onUpdateStudies={setReproStudies} activeStudyId={activeStudyId} setActiveStudyId={setActiveStudyId} reproCollecting={reproCollecting} setReproCollecting={setReproCollecting}/>}
                  {rightPanel==="statistics"&&<StatisticsPanel t={t} studies={reproStudies} databaseMode={databaseMode} databaseImages={databaseImages} formatAngle={formatAngle}/>}
                  {rightPanel==="silhouettes"&&<SilhouettesPanel t={t} onInsert={(silhouetteType) => {
                    try {
                      const def = SILHOUETTES[silhouetteType];
                      if (!def) return;
                      const cw = canvasSize.current?.w || 800, ch = canvasSize.current?.h || 600;
                      const center = toImage(cw / 2, ch / 2);
                      addMarkup({
                        type: "silhouette",
                        silhouetteType,
                        position: center,
                        scale: 1,
                        rotation: 0,
                        color: def.color,
                        fillColor: def.color + "22",
                        width: 1.5,
                        label: def.name,
                      });
                    } catch(e) { console.error("Silhouette insert error:", e); }
                  }}/>}
                  {rightPanel==="templates"&&<TemplatesPanel t={t} projection={project.projection} onLoadTemplate={loadTemplate} onImportCepht={data=>{
          if(data.markups){
            const newMarkups=data.markups.map(m=>({...m,id:uid(),placed:false,points:m.type==="silhouette"?m.points:[{x:-99999,y:-99999}]}));
            updVer({markups:[...markups,...newMarkups],formulas:[...formulas,...(data.formulas||[])],norms:[...(project.versions[0]?.norms||[]),...(data.norms||[])],analysisTemplate:data.name||"Imported"});
            setPlacingQueue(newMarkups.map(m=>m.id));dispatch({type:"SET",payload:{placingIdx:0}});dispatch({type:"SET",payload:{placingMode:true}});dispatch({type:"SET",payload:{rightPanel:"markups"}});
          }
        }        }/>}
                </div>
              </div>
              {selectedMarkup&&<div style={{borderTop:`1px solid ${t.bdr}`,padding:12,flexShrink:0,maxHeight:isMobile?180:260,overflowY:"auto",scrollbarWidth:"none"}}>
                <MarkupProps m={selectedMarkup} t={t} theme={theme} onUpdate={p=>updMarkup(selectedMarkup.id,p)} onDelete={()=>delMarkup(selectedMarkup.id)} calibration={calibration} onParallel={()=>dispatch({type:"SET",payload:{activeTool:"parallel"}})} formatAngle={formatAngle}/>
              </div>}
            </div>
            {/* Resize handle */}
            <div onMouseDown={()=>dispatch({type:"SET",payload:{rightPanelResizing:true}})} style={{width:4,cursor:"col-resize",background: rightPanelResizing ? t.acc : "transparent",transition:"background 0.15s",flexShrink:0}}/>
          </div>
        )}
      </div>

      {/* MODALS */}
      {showDatabaseImport&&<Modal t={t} title="Database Mode - Import Images" onClose={()=>dispatch({type:"SET",payload:{showDatabaseImport:false}})}><DatabaseImportModal t={t} onImport={loadDatabaseImages} onClose={()=>dispatch({type:"SET",payload:{showDatabaseImport:false}})}/></Modal>}
      {showTemplatePicker&&<Modal t={t} title="" onClose={()=>dispatch({type:"SET",payload:{showTemplatePicker:false}})}><TemplatePickerModal t={t} projection={project.projection} onPick={handleTemplatePick} onClose={()=>dispatch({type:"SET",payload:{showTemplatePicker:false}})}/></Modal>}
      {showCalib&&<Modal t={t} title="Calibration" onClose={()=>dispatch({type:"SET",payload:{showCalib:false}})}><CalibModal t={t} calibration={calibration} onFinish={finalizeCalib}/></Modal>}
      {showExport&&<Modal t={t} title="Export" onClose={()=>dispatch({type:"SET",payload:{showExport:false}})}><div style={{display:"flex",flexDirection:"column",gap:10}}><Btn t={t} onClick={()=>{exportCSV();dispatch({type:"SET",payload:{showExport:false}});}}>Measurements CSV</Btn><Btn t={t} onClick={()=>{onSave?.(project);dispatch({type:"SET",payload:{showExport:false}});}}>Full Project .cephx</Btn><Btn t={t} onClick={()=>{const name=window.prompt("Template name:",project.name+" Template");if(name){exportTemplateAsCepht(project,name);dispatch({type:"SET",payload:{showExport:false}});}}}>Template .cepht</Btn></div></Modal>}
      {pendingTextPos&&<Modal t={t} title="Text Annotation" onClose={()=>dispatch({type:"SET",payload:{pendingTextPos:null}})}><TextModal t={t} defaultColor="#fbbf24" onConfirm={(txt,opts)=>{addMarkup({type:"text",points:[pendingTextPos],text:txt,...opts});dispatch({type:"SET",payload:{pendingTextPos:null}});}} onCancel={()=>dispatch({type:"SET",payload:{pendingTextPos:null}})}/></Modal>}
      {showAnon&&<Modal t={t} title="Anonymization" onClose={()=>dispatch({type:"SET",payload:{showAnon:false}})}><AnonModal t={t} project={project} onUpdateProject={onUpdateProject} onClose={()=>dispatch({type:"SET",payload:{showAnon:false}})}/></Modal>}
      {showAlign&&<Modal t={t} title="Point-Based Alignment" onClose={()=>dispatch({type:"SET",payload:{showAlign:false}})}><AlignModal t={t} markups={markups} images={project.images} onUpdateImages={imgs=>onUpdateProject({images:imgs})} onClose={()=>dispatch({type:"SET",payload:{showAlign:false}})}/></Modal>}
      {showTransform&&<Modal t={t} title="Image Transform" onClose={()=>dispatch({type:"SET",payload:{showTransform:false}})}><TransformModal t={t} images={project.images} onUpdateImages={imgs=>onUpdateProject({images:imgs})} onClose={()=>dispatch({type:"SET",payload:{showTransform:false}})}/></Modal>}
      {showFormulaEditor&&<Modal t={t} title={editFormulaId?"Edit Formula":"New Formula"} onClose={()=>dispatch({type:"SET",payload:{showFormulaEditor:false}})}><FormulaEditor t={t} formula={editFormulaId?formulas.find(f=>f.id===editFormulaId):null} scope={measScope} onSave={f=>{const newFs=editFormulaId?formulas.map(x=>x.id===editFormulaId?f:x):[...formulas,f];updVer({formulas:newFs});dispatch({type:"SET",payload:{showFormulaEditor:false}});}} onClose={()=>dispatch({type:"SET",payload:{showFormulaEditor:false}})}/></Modal>}
      {showHistogram&&<FloatingHistogram hist={computeHistogram(project.images[0]?imgRefs.current[project.images[0].id]:null)} t={t} lutMode={lutMode} lutInvert={lutInvert} processing={processing} onProcessingChange={p=>updVer({processing:p})} onClose={()=>dispatch({type:"SET",payload:{showHistogram:false}})}/>}
    </div>
  );
}





function reproAllLabels(study){
  const labels=new Set();
  study.operators.forEach(op=>{(op.trials||[]).forEach(tr=>{(tr.measurements||[]).forEach(m=>{if(m.label)labels.add(m.label);});});});
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

function exportCsv(type, opts){
  const {study,metric,descriptive,perLandmark,biases,icc,iccCI,dahl,bland,tTest,anovaRes,sem,mdc} = opts||{};
  let rows=[], filename="export.csv";
  if(type==="reproTables"){
    rows=[["study","design","operator","session_index","landmark","x_px","y_px","timestamp"]];
    study.operators.forEach((op,oi)=>{
      (op.trials||[]).forEach((tr,ti)=>{
        (tr.measurements||[]).forEach(m=>{
          rows.push([study.name,study.type,op.name||`Operator_${oi+1}`,ti+1,m.label,m.x,m.y,m.timestamp||""]);
        });
      });
    });
    filename=`${String(study.name).replace(/\s+/g,"_")}_reproducibility.csv`;
  }else if(type==="descriptive"){
    rows=[["Landmark","n","Mean","SD","Median","CV%","Min","Max"]];
    descriptive.forEach(r=>{rows.push([r.lab,r.n,r.mean!==null?r.mean.toFixed(4):"",r.sd!==null?r.sd.toFixed(4):"",r.median!==null?r.median.toFixed(4):"",r.cv!==null?r.cv.toFixed(4):"",r.min!==null?r.min.toFixed(2):"",r.max!==null?r.max.toFixed(2):""]);});
    filename=`${String(study.name).replace(/\s+/g,"_")}_descriptive.csv`;
  }else if(type==="errorMetrics"){
    rows=[["Landmark","n","Mean_Diff","SD_Diff","Dahlberg","Abs_Mean","CV%"]];
    perLandmark.forEach(r=>{rows.push([r.lab,r.n,r.meanDiff.toFixed(4),r.sdDiff.toFixed(4),r.dahlberg.toFixed(4),r.absMean.toFixed(4),r.cv!==null?r.cv.toFixed(4):""]);});
    filename="error_metrics.csv";
  }else if(type==="fullReport"){
    rows.push(["CephaloStudio Statistical Report"]);
    rows.push(["Study",study.name]);
    rows.push(["Design",study.type==="intra"?"Intra-operator":"Inter-operator"]);
    rows.push(["Metric",metric.toUpperCase()]);
    rows.push(["Date",new Date().toISOString()]);
    rows.push([]);
    rows.push(["=== DESCRIPTIVE STATISTICS ==="]);
    rows.push(["Landmark","n","Mean","SD","Median","CV%","Min","Max"]);
    descriptive.forEach(r=>{rows.push([r.lab,r.n,r.mean?.toFixed(4),r.sd?.toFixed(4),r.median?.toFixed(4),r.cv?.toFixed(4),r.min?.toFixed(4),r.max?.toFixed(4)]);});
    rows.push([]);
    rows.push(["=== RELIABILITY ==="]);
    rows.push(["ICC (Absolute)",icc?.ICC_Absolute?.toFixed(4)]);
    rows.push(["ICC (Consistency)",icc?.ICC_Consistency?.toFixed(4)]);
    rows.push(["ICC 95% CI lower",iccCI?.lower?.toFixed(4)]);
    rows.push(["ICC 95% CI upper",iccCI?.upper?.toFixed(4)]);
    rows.push(["Interpretation",icc?.interpretation]);
    rows.push(["SEM",sem?.toFixed(4)]);
    rows.push(["MDC (95%)",mdc?.toFixed(4)]);
    rows.push([]);
    rows.push(["=== ERROR METRICS ==="]);
    rows.push(["Dahlberg Error",dahl?.error?.toFixed(4)]);
    rows.push(["Bland-Altman Mean Diff",bland?.meanDiff?.toFixed(4)]);
    rows.push(["Bland-Altman SD",bland?.stdDiff?.toFixed(4)]);
    rows.push(["Bland-Altman Lower LoA",bland?.lowerLOA?.toFixed(4)]);
    rows.push(["Bland-Altman Upper LoA",bland?.upperLOA?.toFixed(4)]);
    rows.push([]);
    rows.push(["=== PAIRED T-TEST ==="]);
    rows.push(["t",tTest?.t?.toFixed(4)]);
    rows.push(["df",tTest?.df]);
    rows.push(["p-value",tTest?.pValue?.toFixed(6)]);
    rows.push(["Significant",tTest?.significant?"Yes":"No"]);
    rows.push([]);
    rows.push(["=== ANOVA ==="]);
    rows.push(["F",anovaRes?.F?.toFixed(4)]);
    rows.push(["p-value",anovaRes?.pValue?.toFixed(6)]);
    rows.push(["Significant",anovaRes?.significant?"Yes":"No"]);
    rows.push([]);
    rows.push(["=== PER-LANDMARK ERRORS ==="]);
    rows.push(["Landmark","n","Mean Diff","SD Diff","Dahlberg","Abs Mean","CV%"]);
    perLandmark.forEach(r=>{rows.push([r.lab,r.n,r.meanDiff.toFixed(4),r.sdDiff.toFixed(4),r.dahlberg.toFixed(4),r.absMean.toFixed(4),r.cv?.toFixed(4)]);});
    rows.push([]);
    rows.push(["=== SYSTEMATIC BIAS ==="]);
    rows.push(["Comparison","t","p-value","Significant"]);
    biases.forEach(b=>{rows.push([b.pair,b.t.toFixed(4),b.pValue.toFixed(6),b.significant?"Yes":"No"]);});
    filename=`${String(study.name).replace(/\s+/g,"_")}_full_report.csv`;
  }
  const csv=rows.map(r=>r.map(c=>`"${String(c??'').replace(/"/g,'""')}"`).join(",")).join("\n");
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  a.download=filename;a.click();
}

function StatisticsPanel({t,studies,databaseImages,formatAngle}){
  const[source,setSource]=useState(studies?.length>0?"study":"database");
  const[mainTab,setMainTab]=useState("tables");

  const showDatabase=source==="database"&&databaseImages?.length>0;
  const showStudy=source==="study";

  return(
    <div style={{padding:12,maxWidth:"100%",overflow:"hidden"}}>
      <div style={{display:"flex",gap:6,marginBottom:12,alignItems:"center",flexWrap:"wrap"}}>
        <button onClick={()=>setSource(showStudy?"database":"study")} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${t.bdr}`,background:showStudy?"transparent":t.acc+"18",color:showStudy?t.tx2:t.acc,cursor:"pointer",fontSize:10,fontWeight:600}}>{showStudy?"Database Mode →":"← Study Mode"}</button>
        <span style={{fontSize:10,color:t.tx3}}>{showStudy?"Study Mode":"Database Mode"} — {showStudy?(studies?.length||0)+" studies":(databaseImages?.length||0)+" images"}</span>
      </div>
      <div style={{display:"flex",gap:4,marginBottom:16}}>
        <button onClick={()=>setMainTab("tables")} style={{padding:"6px 14px",borderRadius:6,border:`1px solid ${mainTab==="tables"?t.acc:t.bdr}`,background:mainTab==="tables"?t.acc+"18":"transparent",color:mainTab==="tables"?t.acc:t.tx2,cursor:"pointer",fontSize:11,fontWeight:600}}>Registered Markups</button>
        <button onClick={()=>setMainTab("dashboard")} style={{padding:"6px 14px",borderRadius:6,border:`1px solid ${mainTab==="dashboard"?t.acc:t.bdr}`,background:mainTab==="dashboard"?t.acc+"18":"transparent",color:mainTab==="dashboard"?t.acc:t.tx2,cursor:"pointer",fontSize:11,fontWeight:600}}>Statistics Dashboard</button>
      </div>
      {mainTab==="tables"&&(
        showDatabase?
          <MarkupTablesPanel databaseImages={databaseImages} t={t} formatAngle={formatAngle}/>:
          <StudyMarkupTables t={t} studies={studies||[]}/>
      )}
      {mainTab==="dashboard"&&(
        showDatabase?
          <DatabaseDashboard t={t} databaseImages={databaseImages}/>:
          <StudyDashboard t={t} studies={studies||[]}/>
      )}
    </div>
  );
}

function StudyMarkupTables({t,studies}){
  const[selectedId,setSelectedId]=useState(null);
  const study=studies.find(s=>s.id===selectedId);
  const labels=reproAllLabels(study||{operators:[]});
  if(!studies.length)return(<div style={{color:t.tx3,fontSize:12,textAlign:"center",padding:20}}>No studies yet.</div>);
  return(
    <div>
      <div style={{marginBottom:12}}>
        <div style={{fontSize:10,color:t.tx2,marginBottom:4}}>Study</div>
        <select value={selectedId||""} onChange={e=>setSelectedId(e.target.value||null)} style={{width:"100%",padding:"6px 8px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf3,color:t.tx,fontSize:12}}>
          <option value="">— Select —</option>
          {studies.map(s=><option key={s.id} value={s.id}>{s.name}{s.status==="completed"?" ✓":""}</option>)}
        </select>
      </div>
      {!study&&<div style={{color:t.tx3,fontSize:12,textAlign:"center",padding:20}}>Select a study to view registered markups.</div>}
      {study&&(
        <div>
          <div style={{marginBottom:8,display:"flex",gap:6}}>
            <Tag color={t.acc}>{study.type==="intra"?"Intra":"Inter"}</Tag>
            <Tag color={study.status==="completed"?t.ok:t.warn}>{study.status}</Tag>
            <Tag color={t.tx2}>{labels.length} landmarks</Tag>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"'DM Mono',monospace"}}>
              <thead>
                <tr style={{borderBottom:`1px solid ${t.bdr}`}}>
                  <th style={{textAlign:"left",padding:6,color:t.tx2,background:t.surf2}}>Landmark</th>
                  {study.type==="intra"&&(study.operators[0]?.trials||[]).map((tr,i)=><th key={i} style={{textAlign:"center",padding:6,color:t.acc,background:t.surf2}}>Trial {i+1}</th>)}
                  {study.type==="inter"&&study.operators.map((op,i)=><th key={op.id} style={{textAlign:"center",padding:6,color:t.acc,background:t.surf2}}>{op.name||`Op ${i+1}`}</th>)}
                </tr>
              </thead>
              <tbody>
                {labels.map(lab=>{
                  const cells=[];
                  if(study.type==="intra"){
                    (study.operators[0]?.trials||[]).forEach(tr=>{
                      const m=(tr.measurements||[]).find(x=>x.label===lab);
                      cells.push(m?`(${m.x?.toFixed(1)}, ${m.y?.toFixed(1)})`:"—");
                    });
                  }else{
                    study.operators.forEach(op=>{
                      const m=(op.trials?.[0]?.measurements||[]).find(x=>x.label===lab);
                      cells.push(m?`(${m.x?.toFixed(1)}, ${m.y?.toFixed(1)})`:"—");
                    });
                  }
                  return(<tr key={lab} style={{borderBottom:`1px solid ${t.bdr}44`}}><td style={{padding:6,color:t.tx,fontWeight:600}}>{lab}</td>{cells.map((c,i)=><td key={i} style={{padding:6,textAlign:"center",color:c==="—"?t.tx3:t.tx}}>{c}</td>)}</tr>);
                })}
              </tbody>
            </table>
          </div>
          <div style={{marginTop:10}}>
            <Btn t={t} small onClick={()=>exportCsv("reproTables",{study})}>⬇ Download raw data (.csv)</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function StudyDashboard({t,studies}){
  const[selectedId,setSelectedId]=useState(null);
  const[metric,setMetric]=useState("x");
  const[pairA,setPairA]=useState(0);
  const[pairB,setPairB]=useState(1);
  const[tab,setTab]=useState("overview");
  const[usePx,setUsePx]=useState(true);
  const[ppm,setPpm]=useState(1);
  const blandCanvasRef=useRef(null);
  const errorChartRef=useRef(null);

  const unit=usePx?"px":"mm";

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
  const spearman=spearmanCorrelation(vals1,vals2);

  const descriptive=!study||!labels.length?[]:labels.map(lab=>{
    const vals=[];
    if(study.type==="intra"){
      (study.operators[0]?.trials||[]).forEach(tr=>{const m=(tr.measurements||[]).find(x=>x.label===lab);if(m)vals.push(metric==="x"?m.x:m.y);});
    }else{
      study.operators.forEach(op=>{const m=(op.trials?.[0]?.measurements||[]).find(x=>x.label===lab);if(m)vals.push(metric==="x"?m.x:m.y);});
    }
    if(!vals.length)return{lab,n:0,mean:null,sd:null,min:null,max:null,median:null,iqrVal:null,cv:null};
    const m0=mean(vals),s=stdev(vals,m0),md=median(vals),iq=iqr(vals);
    const cv=coefficientOfVariation(vals);
    return{lab,n:vals.length,mean:m0,sd:s,min:Math.min(...vals),max:Math.max(...vals),median:md,iqrVal:iq.iqr,cv};
  });

  const perLandmark=study?computePerLandmarkError(study,metric,labels):[];
  const biases=study?detectSystematicBias(study,metric,labels):[];
  const anovaRes=study?anovaAcrossSessions(study,metric,labels):null;
  const sem=icc?standardError(vals1,icc.ICC_Absolute):null;
  const mdc=sem?minimalDetectableChange(sem):null;
  const iccCI=icc?calculateICC_CI(icc.ICC_Absolute,iccMat[0]?.length||0,iccMat.length):null;
  const normsComp=computeNormsComparison(descriptive,study?.norms||[],{pxPerMm:1});

  const tabs=[["overview","Overview"],["descriptive","Descriptive"],["errors","Per-Landmark"],["inferential","Inferential"],["norms","Norms"],["export","Export"]];

  useEffect(()=>{
    if(!bland||!blandCanvasRef.current)return;
    const canvas=blandCanvasRef.current;
    const W=400,H=280,padL=50,padR=30,padT=30,padB=50;
    const cw=W-padL-padR,ch=H-padT-padB;
    const dpr=window.devicePixelRatio||1;
    canvas.width=W*dpr;canvas.height=H*dpr;
    canvas.style.width=W+"px";canvas.style.height=H+"px";
    const ctx=canvas.getContext("2d");
    ctx.scale(dpr,dpr);
    ctx.fillStyle=t.bg;ctx.fillRect(0,0,W,H);
    const pts=bland.means.map((m,i)=>({x:m,y:bland.meanDiff+(vals1[i]-vals2[i]-bland.meanDiff)}));
    const minM=bland.minMean,maxM=bland.maxMean,padM=(maxM-minM)*0.1||1;
    const mnM=minM-padM,mxM=maxM+padM;
    const dMax=Math.max(Math.abs(bland.upperLOA),Math.abs(bland.lowerLOA),Math.max(...pts.map(p=>Math.abs(p.y))))*1.15;
    const xScale=cw/(mxM-mnM||1),yScale=ch/(2*dMax||1);
    const tx=x=>padL+(x-mnM)*xScale,ty=y=>padT+ch/2-y*yScale;
    ctx.strokeStyle=t.bdr;ctx.lineWidth=0.5;
    for(let i=0;i<=4;i++){const y=padT+(i/4)*ch;ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(padL+cw,y);ctx.stroke();}
    for(let i=0;i<=4;i++){const x=padL+(i/4)*cw;ctx.beginPath();ctx.moveTo(x,padT);ctx.lineTo(x,padT+ch);ctx.stroke();}
    ctx.fillStyle=t.tx2;ctx.font="9px 'DM Mono',monospace";ctx.textAlign="center";
    ctx.fillText("Mean of paired values",padL+cw/2,H-4);
    ctx.save();ctx.translate(12,padT+ch/2);ctx.rotate(-Math.PI/2);ctx.textAlign="center";ctx.fillText("Difference",0,0);ctx.restore();
    pts.forEach(p=>{ctx.fillStyle=p.y>bland.upperLOA||p.y<bland.lowerLOA?t.err:t.acc;ctx.beginPath();ctx.arc(tx(p.x),ty(p.y),3,0,Math.PI*2);ctx.fill();});
    ctx.strokeStyle=t.tx;ctx.lineWidth=1.5;ctx.setLineDash([]);
    ctx.beginPath();ctx.moveTo(padL,ty(bland.meanDiff));ctx.lineTo(padL+cw,ty(bland.meanDiff));ctx.stroke();
    ctx.fillStyle=t.tx;ctx.font="bold 9px 'DM Sans',sans-serif";ctx.textAlign="left";
    ctx.fillText(`Bias: ${bland.meanDiff.toFixed(2)}`,padL+4,padT+12);
    ctx.strokeStyle=t.warn;ctx.lineWidth=1;ctx.setLineDash([4,4]);
    ctx.beginPath();ctx.moveTo(padL,ty(bland.upperLOA));ctx.lineTo(padL+cw,ty(bland.upperLOA));ctx.stroke();
    ctx.beginPath();ctx.moveTo(padL,ty(bland.lowerLOA));ctx.lineTo(padL+cw,ty(bland.lowerLOA));ctx.stroke();
    ctx.fillStyle=t.warn;ctx.font="8px 'DM Mono',monospace";ctx.textAlign="left";
    ctx.fillText(`+1.96 SD: ${bland.upperLOA.toFixed(2)}`,padL+4,ty(bland.upperLOA)-4);
    ctx.fillText(`-1.96 SD: ${bland.lowerLOA.toFixed(2)}`,padL+4,ty(bland.lowerLOA)+12);
  },[bland,t,vals1,vals2]);

  useEffect(()=>{
    if(!perLandmark.length||!errorChartRef.current)return;
    const canvas=errorChartRef.current;
    const W=500,H=220,padL=50,padR=20,padT=25,padB=60;
    const cw=W-padL-padR,ch=H-padT-padB;
    const dpr=window.devicePixelRatio||1;
    canvas.width=W*dpr;canvas.height=H*dpr;
    canvas.style.width=W+"px";canvas.style.height=H+"px";
    const ctx=canvas.getContext("2d");
    ctx.scale(dpr,dpr);
    ctx.fillStyle=t.bg;ctx.fillRect(0,0,W,H);
    const labs=perLandmark.map(r=>r.lab);
    const allDiffs=perLandmark.flatMap(r=>[r.meanDiff+r.sdDiff,r.meanDiff-r.sdDiff,0]);
    const yMax=Math.max(...allDiffs.map(Math.abs))*1.2||1;
    const yScale=ch/(2*yMax);
    const gap=cw/labs.length;
    const ty2=y=>padT+ch/2-y*yScale;
    ctx.strokeStyle=t.bdr;ctx.lineWidth=0.5;
    for(let i=0;i<=4;i++){const y=padT+(i/4)*ch;ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(padL+cw,y);ctx.stroke();ctx.fillStyle=t.tx2;ctx.font="8px 'DM Mono',monospace";ctx.textAlign="right";ctx.textBaseline="middle";ctx.fillText((yMax*(1-i/2)).toFixed(1),padL-4,y);}
    ctx.strokeStyle=t.tx;ctx.lineWidth=1;ctx.setLineDash([]);
    ctx.beginPath();ctx.moveTo(padL,ty2(0));ctx.lineTo(padL+cw,ty2(0));ctx.stroke();
    ctx.fillStyle=t.tx2;ctx.font="9px 'DM Sans',sans-serif";ctx.textAlign="center";ctx.textBaseline="top";
    labs.forEach((lab,i)=>{
      const r=perLandmark[i],cx=padL+i*gap+gap/2;
      ctx.fillStyle=t.tx;ctx.font="8px 'DM Mono',monospace";ctx.textAlign="center";ctx.textBaseline="top";
      ctx.save();ctx.translate(cx,padT+ch+4);ctx.rotate(Math.PI/4);ctx.fillText(lab,0,0);ctx.restore();
      ctx.strokeStyle=t.acc;ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(cx,ty2(r.meanDiff-r.sdDiff));ctx.lineTo(cx,ty2(r.meanDiff+r.sdDiff));ctx.stroke();
      ctx.fillStyle=t.acc;ctx.beginPath();ctx.arc(cx,ty2(r.meanDiff),4,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=t.acc;ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(cx-4,ty2(r.meanDiff-r.sdDiff));ctx.lineTo(cx+4,ty2(r.meanDiff-r.sdDiff));ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx-4,ty2(r.meanDiff+r.sdDiff));ctx.lineTo(cx+4,ty2(r.meanDiff+r.sdDiff));ctx.stroke();
    });
    ctx.fillStyle=t.tx;ctx.font="bold 9px 'DM Sans',sans-serif";ctx.textAlign="center";ctx.textBaseline="bottom";
    ctx.fillText(`Mean difference ± SD by landmark`,padL+cw/2,padT-4);
  },[perLandmark,t]);

  if(!studies.length)return(<div style={{color:t.tx3,fontSize:12,textAlign:"center",padding:20}}>No studies yet. Create and complete a study in Reproducibility first.</div>);

  return(
    <div style={{maxWidth:"100%",overflow:"hidden"}}>
      <div style={{marginBottom:12}}>
        <div style={{fontSize:10,color:t.tx2,marginBottom:4}}>Study</div>
        <select value={selectedId||""} onChange={e=>setSelectedId(e.target.value||null)} style={{width:"100%",padding:"6px 8px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf3,color:t.tx,fontSize:12}}>
          <option value="">— Select —</option>
          {studies.map(s=><option key={s.id} value={s.id}>{s.name}{s.status==="completed"?" ✓":""}</option>)}
        </select>
      </div>
      {!study&&<div style={{color:t.tx3,fontSize:12,textAlign:"center",padding:20}}>Select a study to view statistics.</div>}
      {study&&(
        <>
          <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
            <button type="button" onClick={()=>setMetric("x")} style={{padding:"4px 10px",border:`1px solid ${metric==="x"?t.acc:t.bdr}`,borderRadius:6,background:metric==="x"?t.accMuted:t.surf3,color:metric==="x"?t.acc:t.tx2,cursor:"pointer",fontSize:10,fontWeight:600}}>X ({unit})</button>
            <button type="button" onClick={()=>setMetric("y")} style={{padding:"4px 10px",border:`1px solid ${metric==="y"?t.acc:t.bdr}`,borderRadius:6,background:metric==="y"?t.accMuted:t.surf3,color:metric==="y"?t.acc:t.tx2,cursor:"pointer",fontSize:10,fontWeight:600}}>Y ({unit})</button>
            <span style={{width:1,height:20,background:t.bdr,margin:"0 4px"}}/>
            <button type="button" onClick={()=>setUsePx(p=>!p)} style={{padding:"4px 10px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf3,color:usePx?t.tx2:t.acc,cursor:"pointer",fontSize:10,fontWeight:600}}>mm</button>
            {!usePx&&<input value={ppm} onChange={e=>{const v=parseFloat(e.target.value);if(v>0)setPpm(v);}} type="number" step="0.01" min="0.01" placeholder="px/mm" style={{width:60,padding:"4px 6px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf3,color:t.tx,fontSize:10}}/>}
          </div>
          <div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>
            {tabs.map(([id,label])=>(<button key={id} onClick={()=>setTab(id)} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${tab===id?t.acc:t.bdr}`,background:tab===id?t.acc+"18":"transparent",color:tab===id?t.acc:t.tx2,cursor:"pointer",fontSize:10,fontWeight:600,whiteSpace:"nowrap"}}>{label}</button>))}
          </div>

          {tab==="overview"&&(
            <div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:10,marginBottom:16}}>
                <div style={{padding:12,borderRadius:8,background:t.surf2,border:`1px solid ${t.bdr}`}}>
                  <div style={{fontSize:9,color:t.tx2,marginBottom:2}}>Design</div>
                  <div style={{fontSize:13,fontWeight:700,color:t.tx}}>{study.type==="intra"?"Intra-operator":"Inter-operator"}</div>
                </div>
                <div style={{padding:12,borderRadius:8,background:t.surf2,border:`1px solid ${t.bdr}`}}>
                  <div style={{fontSize:9,color:t.tx2,marginBottom:2}}>Status</div>
                  <div style={{fontSize:13,fontWeight:700,color:study.status==="completed"?t.ok:t.warn}}>{study.status||"—"}</div>
                </div>
                <div style={{padding:12,borderRadius:8,background:t.surf2,border:`1px solid ${t.bdr}`}}>
                  <div style={{fontSize:9,color:t.tx2,marginBottom:2}}>Landmarks</div>
                  <div style={{fontSize:18,fontWeight:700,color:t.acc}}>{labels.length}</div>
                </div>
                <div style={{padding:12,borderRadius:8,background:t.surf2,border:`1px solid ${t.bdr}`}}>
                  <div style={{fontSize:9,color:t.tx2,marginBottom:2}}>Sessions</div>
                  <div style={{fontSize:18,fontWeight:700,color:t.tx}}>{study.type==="intra"?(study.operators[0]?.trials||[]).length:study.operators.length}</div>
                </div>
                {icc&&<div style={{padding:12,borderRadius:8,background:t.accMuted,border:`1px solid ${t.acc}44`}}>
                  <div style={{fontSize:9,color:t.tx2,marginBottom:2}}>ICC (absolute)</div>
                  <div style={{fontSize:18,fontWeight:700,color:t.acc}}>{icc.ICC_Absolute?.toFixed(4)}</div>
                  <div style={{fontSize:9,fontWeight:600,color:icc.ICC_Absolute>=0.9?t.ok:icc.ICC_Absolute>=0.75?t.warn:t.err}}>{icc.interpretation}</div>
                  {iccCI&&<div style={{fontSize:8,color:t.tx3,marginTop:2}}>95% CI: [{iccCI.lower.toFixed(4)}, {iccCI.upper.toFixed(4)}]</div>}
                </div>}
                {sem!==null&&<div style={{padding:12,borderRadius:8,background:t.surf2,border:`1px solid ${t.bdr}`}}>
                  <div style={{fontSize:9,color:t.tx2,marginBottom:2}}>SEM</div>
                  <div style={{fontSize:15,fontWeight:700,color:t.tx}}>{(usePx?sem:sem/ppm).toFixed(4)} {unit}</div>
                </div>}
                {mdc!==null&&<div style={{padding:12,borderRadius:8,background:t.surf2,border:`1px solid ${t.bdr}`}}>
                  <div style={{fontSize:9,color:t.tx2,marginBottom:2}}>MDC (95%)</div>
                  <div style={{fontSize:15,fontWeight:700,color:t.warn}}>{(usePx?mdc:mdc/ppm).toFixed(4)} {unit}</div>
                </div>}
                {dahl&&<div style={{padding:12,borderRadius:8,background:t.surf2,border:`1px solid ${t.bdr}`}}>
                  <div style={{fontSize:9,color:t.tx2,marginBottom:2}}>Dahlberg error</div>
                  <div style={{fontSize:15,fontWeight:700,color:t.acc}}>{(usePx?dahl.error:dahl.error/ppm).toFixed(4)} {unit}</div>
                </div>}
                {vals1.length>0&&<div style={{padding:12,borderRadius:8,background:t.surf2,border:`1px solid ${t.bdr}`}}>
                  <div style={{fontSize:9,color:t.tx2,marginBottom:2}}>Paired pairs</div>
                  <div style={{fontSize:15,fontWeight:700,color:t.tx}}>{vals1.length}</div>
                </div>}
                {anovaRes&&<div style={{padding:12,borderRadius:8,background:t.surf2,border:`1px solid ${t.bdr}`}}>
                  <div style={{fontSize:9,color:t.tx2,marginBottom:2}}>ANOVA</div>
                  <div style={{fontSize:13,fontWeight:700,color:t.tx}}>F={anovaRes.F.toFixed(2)}</div>
                  <div style={{fontSize:9,color:anovaRes.significant?t.err:t.ok}}>p={anovaRes.pValue.toFixed(4)} {anovaRes.significant?"(bias)":"(ok)"}</div>
                </div>}
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <Btn t={t} small onClick={()=>exportCsv("reproTables",{study})}>⬇ Download tables (.csv)</Btn>
                <Btn t={t} small onClick={()=>exportCsv("fullReport",{study,metric,labels,descriptive,perLandmark,biases,icc,iccCI,dahl,bland,tTest,anovaRes,sem,mdc})}>⬇ Full report</Btn>
              </div>
            </div>
          )}

          {tab==="descriptive"&&(
            <div>
              <div style={{fontSize:11,fontWeight:700,color:t.tx,marginBottom:6}}>Descriptive Statistics ({metric.toUpperCase()}, {unit})</div>
              <div style={{overflowX:"auto",marginBottom:12}}>
                <table style={{width:"100%",fontSize:9,borderCollapse:"collapse"}}>
                  <thead><tr style={{borderBottom:`1px solid ${t.bdr}`}}><th style={{textAlign:"left",padding:4,color:t.tx2}}>Landmark</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>n</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Mean</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>SD</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Median</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>CV%</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Min</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Max</th></tr></thead>
                  <tbody>{descriptive.map(row=>(<tr key={row.lab} style={{borderBottom:`1px solid ${t.bdr}44`}}><td style={{padding:4,color:t.tx,fontWeight:600}}>{row.lab}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.n}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace",color:t.acc}}>{row.mean!==null?row.mean.toFixed(3):"—"}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.sd!==null?row.sd.toFixed(3):"—"}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.median!==null?row.median.toFixed(3):"—"}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.cv!==null?row.cv.toFixed(2):"—"}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.min!==null?row.min.toFixed(2):"—"}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.max!==null?row.max.toFixed(2):"—"}</td></tr>))}</tbody>
                </table>
              </div>
            </div>
          )}

          {tab==="errors"&&(
            <div>
              <div style={{fontSize:11,fontWeight:700,color:t.tx,marginBottom:6}}>Per-Landmark Error Metrics</div>
              {perLandmark.length===0?<div style={{color:t.tx3,fontSize:11,textAlign:"center",padding:12}}>Need at least two sessions for per-landmark errors.</div>:(
                <div>
                  <div style={{display:"flex",justifyContent:"center",marginBottom:12}}>
                    <canvas ref={errorChartRef} style={{borderRadius:6,border:`1px solid ${t.bdr}`,maxWidth:"100%"}}/>
                  </div>
                  <div style={{overflowX:"auto",marginBottom:12}}>
                    <table style={{width:"100%",fontSize:9,borderCollapse:"collapse"}}>
                      <thead><tr style={{borderBottom:`1px solid ${t.bdr}`}}><th style={{textAlign:"left",padding:4,color:t.tx2}}>Landmark</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>n</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Mean Diff</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>SD Diff</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Dahlberg</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Abs Mean</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>CV%</th></tr></thead>
                      <tbody>{perLandmark.map(row=>(<tr key={row.lab} style={{borderBottom:`1px solid ${t.bdr}44`}}><td style={{padding:4,color:t.tx,fontWeight:600}}>{row.lab}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.n}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.meanDiff.toFixed(4)}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.sdDiff.toFixed(4)}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace",color:t.acc,fontWeight:600}}>{row.dahlberg.toFixed(4)}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.absMean.toFixed(4)}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.cv!==null?row.cv.toFixed(2):"—"}</td></tr>))}</tbody>
                    </table>
                  </div>
                </div>
              )}
              <div style={{fontSize:11,fontWeight:700,color:t.tx,marginBottom:6}}>Systematic Bias Detection</div>
              {biases.length===0?<div style={{color:t.tx3,fontSize:11,textAlign:"center",padding:12}}>Insufficient data for bias detection.</div>:(
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",fontSize:9,borderCollapse:"collapse"}}>
                    <thead><tr style={{borderBottom:`1px solid ${t.bdr}`}}><th style={{textAlign:"left",padding:4,color:t.tx2}}>Comparison</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>t</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>p-value</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Significant?</th></tr></thead>
                    <tbody>{biases.map((b,i)=>(<tr key={i} style={{borderBottom:`1px solid ${t.bdr}44`}}><td style={{padding:4,color:t.tx,fontWeight:600}}>{b.pair}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{b.t.toFixed(4)}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace",color:b.significant?t.err:t.ok}}>{b.pValue.toFixed(6)}</td><td style={{padding:4,textAlign:"right",color:b.significant?t.err:t.ok,fontWeight:600}}>{b.significant?"Yes (bias)":"No"}</td></tr>))}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab==="inferential"&&(
            <div>
              <div style={{marginBottom:12}}>
                <div style={{fontSize:10,color:t.tx2,marginBottom:4}}>Pairwise comparison</div>
                {study.type==="intra"&&(
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8}}>
                    <div><div style={{fontSize:9,color:t.tx3,marginBottom:2}}>Trial A</div><select value={pa} onChange={e=>setPairA(+e.target.value)} style={{width:"100%",padding:"6px 8px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf3,color:t.tx,fontSize:11}}>{(study.operators[0]?.trials||[]).map((tr,i)=>(<option key={i} value={i}>Trial {i+1}</option>))}</select></div>
                    <div><div style={{fontSize:9,color:t.tx3,marginBottom:2}}>Trial B</div><select value={pb} onChange={e=>setPairB(+e.target.value)} style={{width:"100%",padding:"6px 8px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf3,color:t.tx,fontSize:11}}>{(study.operators[0]?.trials||[]).map((tr,i)=>(<option key={i} value={i}>Trial {i+1}</option>))}</select></div>
                  </div>
                )}
                {study.type==="inter"&&(
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8}}>
                    <div><div style={{fontSize:9,color:t.tx3,marginBottom:2}}>Operator A</div><select value={pa} onChange={e=>setPairA(+e.target.value)} style={{width:"100%",padding:"6px 8px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf3,color:t.tx,fontSize:11}}>{study.operators.map((op,i)=>(<option key={op.id} value={i}>{op.name||`Operator ${i+1}`}</option>))}</select></div>
                    <div><div style={{fontSize:9,color:t.tx3,marginBottom:2}}>Operator B</div><select value={pb} onChange={e=>setPairB(+e.target.value)} style={{width:"100%",padding:"6px 8px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf3,color:t.tx,fontSize:11}}>{study.operators.map((op,i)=>(<option key={op.id} value={i}>{op.name||`Operator ${i+1}`}</option>))}</select></div>
                  </div>
                )}
                <div style={{fontSize:9,color:t.tx3,marginTop:6}}>Paired rows: {vals1.length} landmarks with both values</div>
              </div>
              <div style={{border:`1px solid ${t.bdr}`,borderRadius:8,background:t.surf2,padding:12}}>
                <div style={{fontSize:11,fontWeight:700,color:t.acc,marginBottom:10}}>Inferential tests</div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:10,fontWeight:700,color:t.tx2,marginBottom:6}}>Intraclass correlation (ICC)</div>
                  {icc?(<div style={{fontSize:11}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>ICC (absolute agreement)</span><span style={{fontFamily:"'DM Mono',monospace",color:t.acc,fontWeight:700}}>{icc.ICC_Absolute?.toFixed(4)??"—"}</span></div>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>ICC (consistency)</span><span style={{fontFamily:"'DM Mono',monospace",color:t.acc,fontWeight:700}}>{icc.ICC_Consistency?.toFixed(4)??"—"}</span></div>
                    {iccCI&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>95% CI (absolute)</span><span style={{fontFamily:"'DM Mono',monospace",color:t.tx2,fontSize:10}}>[{iccCI.lower.toFixed(4)}, {iccCI.upper.toFixed(4)}]</span></div>}
                    {sem!==null&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>SEM</span><span style={{fontFamily:"'DM Mono',monospace",color:t.tx}}>{(usePx?sem:sem/ppm).toFixed(4)} {unit}</span></div>}
                    {mdc!==null&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>MDC (95%)</span><span style={{fontFamily:"'DM Mono',monospace",color:t.tx}}>{(usePx?mdc:mdc/ppm).toFixed(4)} {unit}</span></div>}
                    <div style={{padding:"6px 8px",borderRadius:4,background:t.accMuted,color:t.acc,fontWeight:600,textAlign:"center",fontSize:10}}>{icc.interpretation}</div>
                  </div>):<div style={{color:t.tx3,fontSize:11}}>Need at least two complete sessions and matching landmarks on every session for ICC.</div>}
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:10,fontWeight:700,color:t.tx2,marginBottom:6}}>Dahlberg error</div>
                  {dahl?<div style={{display:"flex",justifyContent:"space-between",fontSize:11}}><span>Random error (paired)</span><span style={{fontFamily:"'DM Mono',monospace",color:t.acc,fontWeight:700}}>{(usePx?dahl.error:dahl.error/ppm).toFixed(4)} {unit}</span></div>:<div style={{color:t.tx3,fontSize:11}}>Need two sessions with the same landmarks.</div>}
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:10,fontWeight:700,color:t.tx2,marginBottom:6}}>Paired t-test</div>
                  {tTest?(<div style={{fontSize:11}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>t</span><span style={{fontFamily:"'DM Mono',monospace",color:t.tx}}>{tTest.t.toFixed(4)}</span></div>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>df</span><span style={{fontFamily:"'DM Mono',monospace",color:t.tx}}>{tTest.df}</span></div>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>p-value</span><span style={{fontFamily:"'DM Mono',monospace",color:tTest.significant?t.err:t.ok,fontWeight:700}}>{tTest.pValue.toFixed(6)}</span></div>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>Spearman ρ</span><span style={{fontFamily:"'DM Mono',monospace",color:t.acc}}>{spearman!==null?spearman.toFixed(4):"—"}</span></div>
                    <div style={{padding:"6px 8px",borderRadius:4,background:tTest.significant?t.err+"22":t.ok+"22",color:tTest.significant?t.err:t.ok,fontWeight:600,textAlign:"center"}}>{tTest.significant?"Significant (p < 0.05)":"Not significant"}</div>
                  </div>):<div style={{color:t.tx3,fontSize:11}}>Cannot compute (need paired observations).</div>}
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:t.tx2,marginBottom:6}}>Bland–Altman</div>
                  {bland?(<div style={{fontSize:11}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>Mean difference</span><span style={{fontFamily:"'DM Mono',monospace",color:t.tx}}>{(usePx?bland.meanDiff:bland.meanDiff/ppm).toFixed(4)} {unit}</span></div>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>SD of differences</span><span style={{fontFamily:"'DM Mono',monospace",color:t.tx}}>{(usePx?bland.stdDiff:bland.stdDiff/ppm).toFixed(4)} {unit}</span></div>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>Lower LoA</span><span style={{fontFamily:"'DM Mono',monospace",color:t.warn}}>{(usePx?bland.lowerLOA:bland.lowerLOA/ppm).toFixed(4)} {unit}</span></div>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>Upper LoA</span><span style={{fontFamily:"'DM Mono',monospace",color:t.warn}}>{(usePx?bland.upperLOA:bland.upperLOA/ppm).toFixed(4)} {unit}</span></div>
                    <div style={{display:"flex",justifyContent:"center",marginTop:8}}>
                      <canvas ref={blandCanvasRef} style={{borderRadius:6,border:`1px solid ${t.bdr}`,maxWidth:"100%"}}/>
                    </div>
                  </div>):<div style={{color:t.tx3,fontSize:11}}>Cannot compute.</div>}
                </div>
              </div>
            </div>
          )}

          {tab==="norms"&&(
            <div>
              <div style={{fontSize:11,fontWeight:700,color:t.tx,marginBottom:6}}>Clinical Norms Comparison</div>
              {(!study?.norms||study.norms.length===0)?(<div style={{color:t.tx3,fontSize:11,textAlign:"center",padding:20}}>No norms defined for this study. Add norms in the Markups panel first.</div>):(
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",fontSize:9,borderCollapse:"collapse"}}>
                    <thead><tr style={{borderBottom:`1px solid ${t.bdr}`}}><th style={{textAlign:"left",padding:4,color:t.tx2}}>Landmark</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Mean (mm)</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Norm (mm)</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Deviation</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Z-score</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Within ±2SD?</th></tr></thead>
                    <tbody>{normsComp.filter(r=>r.normMean!==null).map(row=>(<tr key={row.lab} style={{borderBottom:`1px solid ${t.bdr}44`}}><td style={{padding:4,color:t.tx,fontWeight:600}}>{row.lab}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.statMm?.toFixed(2)??(row.mean?(row.mean.toFixed(2)):"—")}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace",color:t.acc}}>{row.normMean?.toFixed(2)}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace",color:row.deviation!==null&&(Math.abs(row.deviation)>row.normSD*2)?t.err:t.tx}}>{row.deviation!==null?row.deviation.toFixed(2):"—"}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace",color:row.normZ!==null?(Math.abs(row.normZ)>2?t.err:Math.abs(row.normZ)>1?t.warn:t.ok):t.tx3}}>{row.normZ!==null?row.normZ.toFixed(2):"—"}</td><td style={{padding:4,textAlign:"right",color:row.withinNorm?t.ok:t.err,fontWeight:600}}>{row.withinNorm!==null?(row.withinNorm?"Yes":"No"):"—"}</td></tr>))}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab==="export"&&(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <Btn t={t} onClick={()=>exportCsv("reproTables",{study})}>⬇ Raw data tables (.csv)</Btn>
              <Btn t={t} onClick={()=>exportCsv("descriptive",{study,metric,descriptive})}>⬇ Descriptive statistics (.csv)</Btn>
              <Btn t={t} onClick={()=>exportCsv("errorMetrics",{perLandmark})}>⬇ Per-landmark error metrics (.csv)</Btn>
              <Btn t={t} onClick={()=>exportCsv("fullReport",{study,metric,labels,descriptive,perLandmark,biases,icc,iccCI,dahl,bland,tTest,anovaRes,sem,mdc})}>⬇ Full statistical report (.csv)</Btn>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DatabaseDashboard({t,databaseImages}){
  const[tab,setTab]=useState("overview");
  const[corrModalOpen,setCorrModalOpen]=useState(false);
  const corrCanvasRef=useRef(null);

  const dataset=useMemo(()=>{
    const ds=[];
    databaseImages.forEach((img,idx)=>{
      const entry={id:`img_${idx}`,measurements:{},group:"default",timepoint:`T${idx+1}`,operator:"default"};
      const angle3Count={current:0};const angle4Count={current:0};
      (img.markups||[]).forEach(m=>{
        if(m.type==="ruler")return;
        const meas=computeMeasurements(m,img.calibration);
        let label;
        if(m.type==="angle3"){angle3Count.current++;label=`Angle_${angle3Count.current}`;}
        else if(m.type==="angle4"){angle4Count.current++;label=`Inc_Angle_${angle4Count.current}`;}
        else{label=m.label||m.type;}
        Object.entries(meas).forEach(([k,v])=>{entry.measurements[`${label}_${k}`]=v;});
        const pts=m.points||[];
        if(m.type==="point"&&pts.length===1){
          entry.measurements[`${label}_x`]=pts[0].x;
          entry.measurements[`${label}_y`]=pts[0].y;
        }else if(pts.length>0){
          pts.forEach((p,i)=>{
            entry.measurements[`${label}_P${i+1}_x`]=p.x;
            entry.measurements[`${label}_P${i+1}_y`]=p.y;
          });
        }
      });
      ds.push(entry);
    });
    return ds;
  },[databaseImages]);

  const variables=useMemo(()=>{
    if(!dataset.length)return[];
    return[...new Set(dataset.flatMap(c=>Object.keys(c.measurements||{})))];
  },[dataset]);

  const extractVar=useCallback((v)=>dataset.map(c=>c.measurements?.[v]).filter(x=>typeof x==="number"),[dataset]);

  const descriptive=useMemo(()=>{
    if(!variables.length)return[];
    return variables.map(v=>{
      const vals=extractVar(v);
      if(!vals.length)return{var:v,n:0,mean:null,sd:null,min:null,max:null,median:null,iqrVal:null,skew:null,kurt:null,cv:null};
      const m0=mean(vals),s=stdev(vals,m0),md=median(vals),iq=iqr(vals);
      const cv=coefficientOfVariation(vals);
      return{var:v,n:vals.length,mean:m0,sd:s,min:Math.min(...vals),max:Math.max(...vals),median:md,iqrVal:iq.iqr,cv};
    });
  },[variables,extractVar]);

  const grouped=useMemo(()=>{
    const g={};
    dataset.forEach(c=>{const k=c.timepoint||c.group||"all";if(!g[k])g[k]=[];g[k].push(c);});
    const result={};
    Object.entries(g).forEach(([k,cases])=>{
      result[k]={};
      variables.forEach(v=>{
        const vals=cases.map(c=>c.measurements?.[v]).filter(x=>typeof x==="number");
        if(vals.length){const m=mean(vals);result[k][v]={n:vals.length,mean:m,sd:stdev(vals,m),min:Math.min(...vals),max:Math.max(...vals)};}
      });
    });
    return result;
  },[dataset,variables]);

  const corrVarsAll=useMemo(()=>{
    return variables.filter(v=>{let c=0;dataset.forEach(d=>{if(typeof d.measurements?.[v]==="number")c++;});return c>=3;});
  },[dataset,variables]);
  const[corrSelected,setCorrSelected]=useState([]);
  const corrVars=useMemo(()=>{
    const selected=corrSelected.filter(v=>corrVarsAll.includes(v));
    return selected.length>=2?selected:corrVarsAll.slice(0,8);
  },[corrVarsAll,corrSelected]);
  const corrMatrix=useMemo(()=>{
    if(corrVars.length<2)return null;
    const paired=dataset.filter(c=>corrVars.every(v=>typeof c.measurements?.[v]==="number"));
    if(paired.length<2)return null;
    return correlationMatrix(corrVars.map(v=>paired.map(c=>c.measurements[v])));
  },[corrVars,dataset]);

  const selectAll=()=>setCorrSelected([...corrVarsAll]);
  const clearAll=()=>setCorrSelected([]);

  const[analyticsTab,setAnalyticsTab]=useState("outliers");
  const[outlierVar,setOutlierVar]=useState("");
  const[outlierMethod,setOutlierMethod]=useState("iqr");
  const[ciVar,setCiVar]=useState("");
  const[ciConf,setCiConf]=useState(0.95);
  const[regX,setRegX]=useState("");
  const[regY,setRegY]=useState("");
  const[histVar,setHistVar]=useState("");
  const[histModalOpen,setHistModalOpen]=useState(false);
  const histCanvasRef=useRef(null);
  const[norms,setNorms]=useState([]);
  const[newNorm,setNewNorm]=useState({label:"",mean:"",sd:""});

  const outlierResult=useMemo(()=>{
    if(!outlierVar)return null;
    const vals=extractVar(outlierVar);
    if(vals.length<4)return null;
    return detectOutliers(vals,outlierMethod);
  },[outlierVar,outlierMethod,extractVar]);

  const ciResult=useMemo(()=>{
    if(!ciVar)return null;
    const vals=extractVar(ciVar);
    if(vals.length<2)return null;
    return confidenceInterval(vals,ciConf);
  },[ciVar,ciConf,extractVar]);

  const regResult=useMemo(()=>{
    if(!regX||!regY)return null;
    const xVals=[],yVals=[];
    dataset.forEach(c=>{const xv=c.measurements?.[regX],yv=c.measurements?.[regY];if(typeof xv==="number"&&typeof yv==="number"){xVals.push(xv);yVals.push(yv);}});
    if(xVals.length<3)return null;
    return linearRegression(xVals,yVals);
  },[regX,regY,dataset]);

  useEffect(()=>{
    if(!histModalOpen||!histCanvasRef.current||!histVar)return;
    const canvas=histCanvasRef.current;
    const vals=extractVar(histVar);
    if(!vals.length||vals.length<3)return;
    const W=560,H=360,padL=60,padR=20,padT=30,padB=50;
    const cw=W-padL-padR,ch=H-padT-padB;
    const dpr=window.devicePixelRatio||1;
    canvas.width=W*dpr;canvas.height=H*dpr;
    canvas.style.width=W+"px";canvas.style.height=H+"px";
    const ctx=canvas.getContext("2d");
    ctx.scale(dpr,dpr);
    ctx.fillStyle=t.bg;ctx.fillRect(0,0,W,H);
    const mn=Math.min(...vals),mx=Math.max(...vals);
    const numBins=Math.max(5,Math.min(20,Math.ceil(Math.sqrt(vals.length))));
    const binW=(mx-mn)/numBins||1;
    const bins=Array(numBins).fill(0);
    vals.forEach(v=>{let b=Math.floor((v-mn)/binW);if(b>=numBins)b=numBins-1;if(b<0)b=0;bins[b]++;});
    const maxBin=Math.max(...bins);
    ctx.strokeStyle=t.bdr;ctx.lineWidth=0.5;
    for(let i=0;i<=4;i++){
      const y=padT+ch-(i/4)*ch;
      ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(padL+cw,y);ctx.stroke();
      ctx.fillStyle=t.tx2;ctx.font="9px 'DM Mono',monospace";ctx.textAlign="right";ctx.textBaseline="middle";
      ctx.fillText(Math.round(maxBin*i/4),padL-6,y);
    }
    const barW=cw/numBins;
    bins.forEach((count,i)=>{
      const x=padL+i*barW,h=maxBin>0?(count/maxBin)*ch:0;
      const ratio=count/maxBin;
      ctx.fillStyle=`rgba(59,130,246,${(0.3+ratio*0.5).toFixed(2)})`;
      ctx.fillRect(x+1,padT+ch-h,barW-2,h);
      ctx.strokeStyle=t.bdr;ctx.lineWidth=0.5;ctx.strokeRect(x+1,padT+ch-h,barW-2,h);
      const binStart=mn+i*binW;
      ctx.fillStyle=t.tx2;ctx.font="7px 'DM Mono',monospace";ctx.textAlign="center";ctx.textBaseline="top";
      if(numBins<=12||i%2===0)ctx.fillText(binStart.toFixed(1),x+barW/2,padT+ch+4);
    });
    ctx.fillStyle=t.tx;ctx.font="bold 9px 'DM Sans',sans-serif";ctx.textAlign="center";ctx.textBaseline="bottom";
    ctx.fillText(`${histVar} — n=${vals.length}, ${numBins} bins`,padL+cw/2,padT-6);
    const m=mean(vals),s=stdev(vals,m);
    ctx.fillStyle=t.acc;ctx.font="8px 'DM Mono',monospace";ctx.textAlign="left";
    ctx.fillText(`μ=${m.toFixed(2)} σ=${s.toFixed(2)}`,padL+4,padT+10);
  },[histModalOpen,histVar,t,extractVar]);

  const downloadHistPNG=()=>{
    if(!histCanvasRef.current)return;
    const link=document.createElement("a");
    link.download=`histogram_${histVar}.png`;
    link.href=histCanvasRef.current.toDataURL("image/png");
    link.click();
  };

  const addNorm=()=>{
    if(!newNorm.label||!newNorm.mean||!newNorm.sd)return;
    setNorms(prev=>[...prev,{...newNorm,mean:parseFloat(newNorm.mean),sd:parseFloat(newNorm.sd)}]);
    setNewNorm({label:"",mean:"",sd:""});
  };
  const removeNorm=(idx)=>setNorms(prev=>prev.filter((_,i)=>i!==idx));

  useEffect(()=>{
    if(!corrModalOpen||!corrCanvasRef.current||!corrMatrix)return;
    const canvas=corrCanvasRef.current;
    const n=corrVars.length;
    const cellSize=58,labelW=130,topPad=40,bottomPad=30,rightPad=20,legendW=20;
    const W=labelW+n*cellSize+rightPad+legendW+30;
    const H=topPad+n*cellSize+bottomPad;
    const dpr=window.devicePixelRatio||1;
    canvas.width=W*dpr;canvas.height=H*dpr;
    canvas.style.width=W+"px";canvas.style.height=H+"px";
    const ctx=canvas.getContext("2d");
    ctx.scale(dpr,dpr);
    ctx.fillStyle=t.bg;ctx.fillRect(0,0,W,H);
    for(let i=0;i<n;i++){
      for(let j=0;j<n;j++){
        const v=corrMatrix[i]?.[j]??0;
        const x=labelW+j*cellSize,y=topPad+i*cellSize;
        if(v>0){ctx.fillStyle=`rgba(59,130,246,${(Math.abs(v)*0.8).toFixed(2)})`;}
        else{ctx.fillStyle=`rgba(239,68,68,${(Math.abs(v)*0.8).toFixed(2)})`;}
        ctx.fillRect(x+1,y+1,cellSize-2,cellSize-2);
        ctx.fillStyle=Math.abs(v)>0.5?"#fff":t.tx;
        ctx.font="10px 'DM Mono',monospace";ctx.textAlign="center";ctx.textBaseline="middle";
        ctx.fillText(v.toFixed(2),x+cellSize/2,y+cellSize/2);
      }
    }
    ctx.fillStyle=t.tx;ctx.font="bold 10px 'DM Mono',monospace";
    for(let i=0;i<n;i++){
      ctx.save();
      const x=labelW+i*cellSize+cellSize/2,y=topPad+n*cellSize+8;
      ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.textAlign="left";ctx.textBaseline="top";
      ctx.fillStyle=t.tx;ctx.fillText(corrVars[i],0,0);ctx.restore();
      ctx.fillStyle=t.tx;ctx.font="10px 'DM Mono',monospace";
      ctx.textAlign="right";ctx.textBaseline="middle";
      ctx.fillText(corrVars[i],labelW-6,topPad+i*cellSize+cellSize/2);
    }
    const lx=labelW+n*cellSize+10;
    ctx.font="bold 9px 'DM Sans',sans-serif";ctx.fillStyle=t.tx;ctx.textAlign="left";
    ctx.fillText("Legend",lx,topPad);
    for(let k=0;k<=8;k++){
      const val=-1+k*0.25;
      const ly=topPad+18+k*12;
      if(val>0){ctx.fillStyle=`rgba(59,130,246,${(Math.abs(val)*0.8).toFixed(2)})`;}
      else{ctx.fillStyle=`rgba(239,68,68,${(Math.abs(val)*0.8).toFixed(2)})`;}
      ctx.fillRect(lx,ly,14,10);
      ctx.fillStyle=t.tx2;ctx.font="8px 'DM Mono',monospace";ctx.textAlign="left";ctx.textBaseline="middle";
      ctx.fillText(val.toFixed(2),lx+18,ly+5);
    }
  },[corrModalOpen,corrMatrix,corrVars,t]);

  const downloadCorrPNG=()=>{
    if(!corrCanvasRef.current)return;
    const link=document.createElement("a");
    link.download="correlation_matrix.png";
    link.href=corrCanvasRef.current.toDataURL("image/png");
    link.click();
  };

  const tabs=[["overview","Overview"],["descriptive","Descriptive"],["grouping","Grouping"],["correlation","Correlation"],["analytics","Analytics"],["export","Export"]];

  const landmarkVars=useMemo(()=>variables.filter(v=>/_x$/.test(v)),[variables]);
  const measVars=useMemo(()=>variables.filter(v=>!/_x$/.test(v)&&!/_y$/.test(v)),[variables]);

  if(!databaseImages.length)return(<div style={{color:t.tx3,fontSize:12,textAlign:"center",padding:20}}>No images in database mode.</div>);

  return(
    <div style={{maxWidth:"100%",overflow:"hidden"}}>
      <div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>
        {tabs.map(([id,label])=>(<button key={id} onClick={()=>setTab(id)} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${tab===id?t.acc:t.bdr}`,background:tab===id?t.acc+"18":"transparent",color:tab===id?t.acc:t.tx2,cursor:"pointer",fontSize:10,fontWeight:600,whiteSpace:"nowrap"}}>{label}</button>))}
      </div>

      {tab==="overview"&&(
        <div>
          <table style={{width:"100%",fontSize:10,borderCollapse:"collapse"}}>
            <tbody>
              <tr><td style={{padding:"5px 6px",color:t.tx2,width:160}}>Images</td><td style={{padding:"5px 6px",fontFamily:"'DM Mono',monospace",color:t.acc}}>{databaseImages.length}</td></tr>
              <tr style={{borderTop:`1px solid ${t.bdr}66`}}><td style={{padding:"5px 6px",color:t.tx2}}>Total variables</td><td style={{padding:"5px 6px",fontFamily:"'DM Mono',monospace"}}>{variables.length}</td></tr>
              <tr style={{borderTop:`1px solid ${t.bdr}66`}}><td style={{padding:"5px 6px",color:t.tx2}}>Landmark coords</td><td style={{padding:"5px 6px",fontFamily:"'DM Mono',monospace"}}>{landmarkVars.length} pts</td></tr>
              <tr style={{borderTop:`1px solid ${t.bdr}66`}}><td style={{padding:"5px 6px",color:t.tx2}}>Measurements</td><td style={{padding:"5px 6px",fontFamily:"'DM Mono',monospace"}}>{measVars.length}</td></tr>
            </tbody>
          </table>
          {descriptive.length>0&&(
            <div style={{marginTop:14,paddingTop:10,borderTop:`1px solid ${t.bdr}`}}>
              <div style={{fontSize:10,fontWeight:700,color:t.tx,marginBottom:6}}>Quick Summary</div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",fontSize:9,borderCollapse:"collapse"}}>
                  <thead><tr style={{borderBottom:`1px solid ${t.bdr}`}}><th style={{textAlign:"left",padding:4,color:t.tx2}}>Variable</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>N</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Mean</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>SD</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Range</th></tr></thead>
                  <tbody>{descriptive.filter(d=>d.n>0).map(row=>(<tr key={row.var} style={{borderBottom:`1px solid ${t.bdr}44`}}><td style={{padding:4,color:t.tx,fontWeight:600}}>{row.var}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.n}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace",color:t.acc}}>{row.mean?.toFixed(2)}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.sd?.toFixed(2)}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.min?.toFixed(2)} – {row.max?.toFixed(2)}</td></tr>))}</tbody>
                </table>
              </div>
            </div>
          )}
          {landmarkVars.length>0&&(
            <div style={{marginTop:14,paddingTop:10,borderTop:`1px solid ${t.bdr}`}}>
              <div style={{fontSize:10,fontWeight:700,color:t.tx,marginBottom:6}}>Registered Landmark Coordinates</div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",fontSize:9,borderCollapse:"collapse"}}>
                  <thead><tr style={{borderBottom:`1px solid ${t.bdr}`}}><th style={{textAlign:"left",padding:4,color:t.tx2}}>Landmark</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>X mean±SD</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Y mean±SD</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>X range</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Y range</th></tr></thead>
                  <tbody>{landmarkVars.map(lx=>{
                    const ly=lx.replace(/_x$/,"_y");
                    const xr=descriptive.find(d=>d.var===lx);
                    const yr=descriptive.find(d=>d.var===ly);
                    if(!xr||!yr||!xr.n||!yr.n)return null;
                    return(<tr key={lx} style={{borderBottom:`1px solid ${t.bdr}44`}}><td style={{padding:4,color:t.tx,fontWeight:600}}>{lx.replace(/_x$/,"")}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace",color:t.acc}}>{xr.mean?.toFixed(1)} ± {xr.sd?.toFixed(1)}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{yr.mean?.toFixed(1)} ± {yr.sd?.toFixed(1)}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:8}}>{xr.min?.toFixed(1)}–{xr.max?.toFixed(1)}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:8}}>{yr.min?.toFixed(1)}–{yr.max?.toFixed(1)}</td></tr>);
                  }).filter(Boolean)}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab==="descriptive"&&(
        <div>
          <div style={{fontSize:11,fontWeight:700,color:t.tx,marginBottom:6}}>Landmark Coordinate Statistics</div>
          {landmarkVars.length===0?<div style={{color:t.tx3,fontSize:11,padding:8,textAlign:"center"}}>No landmark coordinates registered.</div>:(
            <div style={{overflowX:"auto",marginBottom:16}}>
              <table style={{width:"100%",fontSize:9,borderCollapse:"collapse"}}>
                <thead><tr style={{borderBottom:`1px solid ${t.bdr}`}}><th style={{textAlign:"left",padding:4,color:t.tx2}}>Landmark</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Coord</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>N</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Mean</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>SD</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Median</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Min</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Max</th></tr></thead>
                <tbody>{descriptive.filter(d=>d.n>0&&/_x$|_y$/.test(d.var)).map(row=>(<tr key={row.var} style={{borderBottom:`1px solid ${t.bdr}44`}}><td style={{padding:4,color:t.tx,fontWeight:600}}>{row.var.replace(/_x$/,"").replace(/_y$/,"")}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace",color:t.acc}}>{row.var.match(/_x$/)?'X':'Y'}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.n}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.mean?.toFixed(3)}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.sd?.toFixed(3)}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.median?.toFixed(3)}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.min?.toFixed(2)}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.max?.toFixed(2)}</td></tr>))}</tbody>
              </table>
            </div>
          )}
          <div style={{fontSize:11,fontWeight:700,color:t.tx,marginBottom:6}}>Measurement Statistics</div>
          {measVars.length===0?<div style={{color:t.tx3,fontSize:11,padding:8,textAlign:"center"}}>No measurements found.</div>:(
            <>
              <div style={{overflowX:"auto",marginBottom:12}}>
                <table style={{width:"100%",fontSize:9,borderCollapse:"collapse"}}>
                  <thead><tr style={{borderBottom:`1px solid ${t.bdr}`}}><th style={{textAlign:"left",padding:4,color:t.tx2}}>Variable</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>N</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Mean</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>SD</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Median</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>CV%</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Min</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Max</th></tr></thead>
                  <tbody>{descriptive.filter(d=>d.n>0&&!/_x$|_y$/.test(d.var)).map(row=>(<tr key={row.var} style={{borderBottom:`1px solid ${t.bdr}44`}}><td style={{padding:4,color:t.tx,fontWeight:600}}>{row.var}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.n}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace",color:t.acc}}>{row.mean?.toFixed(3)}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.sd?.toFixed(3)}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.median?.toFixed(3)}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.cv?.toFixed(2)}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.min?.toFixed(2)}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.max?.toFixed(2)}</td></tr>))}</tbody>
                </table>
              </div>

            </>
          )}
        </div>
      )}

      {tab==="grouping"&&(
        <div>
          <div style={{fontSize:11,fontWeight:700,color:t.tx,marginBottom:6}}>Grouped Statistics (by Image)</div>
          {Object.entries(grouped).map(([g,data])=>(
            <div key={g} style={{marginBottom:12,padding:10,borderRadius:8,background:t.surf2,border:`1px solid ${t.bdr}`}}>
              <div style={{fontSize:10,fontWeight:700,color:t.tx,marginBottom:6}}>{g}</div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",fontSize:9,borderCollapse:"collapse"}}>
                  <thead><tr style={{borderBottom:`1px solid ${t.bdr}`}}><th style={{textAlign:"left",padding:4,color:t.tx2}}>Variable</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>N</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Mean</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>SD</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Min</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Max</th></tr></thead>
                  <tbody>{Object.entries(data).map(([v,s])=>(<tr key={v} style={{borderBottom:`1px solid ${t.bdr}44`}}><td style={{padding:4,color:t.tx,fontWeight:600}}>{v}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{s.n}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace",color:t.acc}}>{s.mean?.toFixed(2)}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{s.sd?.toFixed(2)}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{s.min?.toFixed(2)}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{s.max?.toFixed(2)}</td></tr>))}</tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==="correlation"&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:11,fontWeight:700,color:t.tx}}>Correlation Matrix</div>
            {corrMatrix&&<button onClick={()=>setCorrModalOpen(true)} style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${t.bdr}`,background:"transparent",color:t.tx2,cursor:"pointer",fontSize:10,fontWeight:600}} title="Enlarge">⛶ Enlarge</button>}
          </div>
          <div style={{marginBottom:10,padding:10,borderRadius:8,background:t.surf2,border:`1px solid ${t.bdr}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{fontSize:10,fontWeight:600,color:t.tx2}}>Select Variables ({corrSelected.length}/{corrVarsAll.length})</div>
              <div style={{display:"flex",gap:4}}>
                <button onClick={selectAll} style={{padding:"2px 6px",borderRadius:4,border:`1px solid ${t.bdr}`,background:"transparent",color:t.tx2,cursor:"pointer",fontSize:9}}>All</button>
                <button onClick={clearAll} style={{padding:"2px 6px",borderRadius:4,border:`1px solid ${t.bdr}`,background:"transparent",color:t.tx2,cursor:"pointer",fontSize:9}}>None</button>
              </div>
            </div>
            <div style={{maxHeight:140,overflowY:"auto",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:"2px 10px"}}>
              {corrVarsAll.map(v=>(
                <label key={v} style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer",padding:"2px 4px",borderRadius:4,fontSize:9,color:corrSelected.includes(v)?t.tx:t.tx3,transition:"color .15s"}}>
                  <input type="checkbox" checked={corrSelected.includes(v)} onChange={e=>setCorrSelected(prev=>e.target.checked?[...new Set([...prev,v])]:prev.filter(x=>x!==v))} style={{accentColor:t.acc,width:12,height:12}}/>
                  <span style={{fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{v}</span>
                </label>
              ))}
              {corrVarsAll.length===0&&<div style={{color:t.tx3,fontSize:9,padding:6}}>No variables with 3+ data points.</div>}
            </div>
          </div>
          {!corrMatrix?<div style={{color:t.tx3,fontSize:11,textAlign:"center",padding:12}}>Need at least 2 selected variables with 3+ values each.</div>:(
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",fontSize:8,borderCollapse:"collapse"}}>
                <thead><tr><th style={{padding:3,color:t.tx2}}></th>{corrVars.map(v=><th key={v} style={{padding:3,color:t.acc,fontFamily:"'DM Mono',monospace",writingMode:"vertical-lr",textAlign:"left"}}>{v}</th>)}</tr></thead>
                <tbody>{corrMatrix.map((row,i)=>(<tr key={i}><td style={{padding:3,color:t.tx,fontWeight:600}}>{corrVars[i]}</td>{row.map((v,j)=>{
                  const abs=v!=null?Math.abs(v):0;
                  let bg="transparent",clr=t.tx3;
                  if(v!=null){if(v>0){clr=t.acc;bg=`rgba(59,130,246,${(abs*0.3).toFixed(2)})`;}else{clr=t.err;bg=`rgba(239,68,68,${(abs*0.3).toFixed(2)})`;}}
                  return<td key={j} style={{padding:3,textAlign:"center",fontFamily:"'DM Mono',monospace",background:bg,color:clr}}>{v!=null?v.toFixed(2):"-"}</td>;
                })}</tr>))}</tbody>
              </table>
            </div>
          )}
          <div style={{marginTop:16}}>
            <div style={{fontSize:10,fontWeight:700,color:t.tx2,marginBottom:6}}>Quick Correlations</div>
            {corrVars.slice(0,6).map((v,i)=>{
              if(i===0)return null;
              const a1=[],a2=[];
              dataset.forEach(c=>{const xv=c.measurements?.[corrVars[0]],yv=c.measurements?.[v];if(typeof xv==="number"&&typeof yv==="number"){a1.push(xv);a2.push(yv);}});
              const r=pearsonCorrelation(a1,a2);
              const sp=spearmanCorrelation(a1,a2);
              return(<div key={v} style={{fontSize:10,color:t.tx2,display:"flex",justifyContent:"space-between"}}><span>{corrVars[0]||"—"} vs {v}</span><span>r={r?r.toFixed(2):"-"} | ρ={sp!=null?sp.toFixed(2):"-"}</span></div>);
            })}
          </div>
        </div>
      )}

      {tab==="analytics"&&(
        <div>
          <div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>
            {[["outliers","Outliers"],["ci","Confidence Intervals"],["regression","Linear Regression"],["histogram","Histogram"],["norms","Normative Comparison"]].map(([id,label])=>(<button key={id} onClick={()=>setAnalyticsTab(id)} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${analyticsTab===id?t.acc:t.bdr}`,background:analyticsTab===id?t.acc+"18":"transparent",color:analyticsTab===id?t.acc:t.tx2,cursor:"pointer",fontSize:10,fontWeight:600,whiteSpace:"nowrap"}}>{label}</button>))}
          </div>

          {analyticsTab==="outliers"&&(
            <div>
              <div style={{fontSize:11,fontWeight:700,color:t.tx,marginBottom:8}}>Outlier Detection</div>
              <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"flex-end",flexWrap:"wrap"}}>
                <div style={{flex:"1 1 180px",minWidth:140}}><div style={{fontSize:9,color:t.tx2,marginBottom:3}}>Variable</div>
                  <select value={outlierVar} onChange={e=>setOutlierVar(e.target.value)} style={{width:"100%",padding:"5px 6px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf3,color:t.tx,fontSize:11}}>
                    <option value="">— Select —</option>
                    {corrVarsAll.map(v=><option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div style={{flex:"1 1 140px",minWidth:100}}><div style={{fontSize:9,color:t.tx2,marginBottom:3}}>Method</div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    <button onClick={()=>setOutlierMethod("iqr")} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${outlierMethod==="iqr"?t.acc:t.bdr}`,background:outlierMethod==="iqr"?t.acc+"18":"transparent",color:outlierMethod==="iqr"?t.acc:t.tx2,cursor:"pointer",fontSize:10,fontWeight:600}}>IQR</button>
                    <button onClick={()=>setOutlierMethod("zscore")} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${outlierMethod==="zscore"?t.acc:t.bdr}`,background:outlierMethod==="zscore"?t.acc+"18":"transparent",color:outlierMethod==="zscore"?t.acc:t.tx2,cursor:"pointer",fontSize:10,fontWeight:600}}>Z-Score</button>
                  </div>
                </div>
              </div>
              {outlierResult?(
                <div>
                  <div style={{padding:10,borderRadius:8,background:t.surf2,border:`1px solid ${t.bdr}`,marginBottom:8}}>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:6,fontSize:10}}>
                      <span style={{color:t.tx2}}>Total values</span><span style={{fontFamily:"'DM Mono',monospace",color:t.acc}}>{outlierResult.values.length}</span>
                      <span style={{color:t.tx2}}>Outliers found</span><span style={{fontFamily:"'DM Mono',monospace",color:outlierResult.outliers.length>0?t.err:t.ok}}>{outlierResult.outliers.length}</span>
                      {outlierMethod==="zscore"?(<>
                        <span style={{color:t.tx2}}>Mean ± SD</span><span style={{fontFamily:"'DM Mono',monospace"}}>{outlierResult.mean?.toFixed(3)} ± {outlierResult.sd?.toFixed(3)}</span>
                      </>):(<>
                        <span style={{color:t.tx2}}>Q1 / Q3</span><span style={{fontFamily:"'DM Mono',monospace"}}>{outlierResult.q1?.toFixed(2)} / {outlierResult.q3?.toFixed(2)}</span>
                        <span style={{color:t.tx2}}>IQR</span><span style={{fontFamily:"'DM Mono',monospace"}}>{outlierResult.iqr?.toFixed(3)}</span>
                        <span style={{color:t.tx2}}>Bounds</span><span style={{fontFamily:"'DM Mono',monospace"}}>{outlierResult.bounds?.[0]?.toFixed(2)} – {outlierResult.bounds?.[1]?.toFixed(2)}</span>
                      </>)}
                    </div>
                  </div>
                  {outlierResult.outliers.length>0&&(
                    <div style={{padding:10,borderRadius:8,background:t.surf2,border:`1px solid ${t.bdr}`}}>
                      <div style={{fontSize:10,fontWeight:700,color:t.err,marginBottom:6}}>Flagged Outliers</div>
                      <div style={{overflowX:"auto"}}>
                        <table style={{width:"100%",fontSize:9,borderCollapse:"collapse"}}>
                          <thead><tr style={{borderBottom:`1px solid ${t.bdr}`}}><th style={{textAlign:"left",padding:4,color:t.tx2}}>Image</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Value</th>{outlierMethod==="zscore"&&<th style={{textAlign:"right",padding:4,color:t.tx2}}>Z-Score</th>}<th style={{textAlign:"right",padding:4,color:t.tx2}}>Deviation</th></tr></thead>
                          <tbody>{outlierResult.outliers.map(o=>{
                            const img=databaseImages[o.i];
                            const dev=mean&&outlierResult.values?((o.v-mean(outlierResult.values))/stdev(outlierResult.values,mean(outlierResult.values))*100):null;
                            return(<tr key={o.i} style={{borderBottom:`1px solid ${t.bdr}44`}}><td style={{padding:4,color:t.tx}}>{img?img.name||`Image ${o.i+1}`:`#${o.i}`}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace",color:t.err}}>{o.v.toFixed(3)}</td>{outlierMethod==="zscore"&&<td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace",color:t.err}}>{o.zScore?.toFixed(2)}</td>}<td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{dev!=null?`${dev>0?"+":""}${dev.toFixed(1)}%`:"—"}</td></tr>);
                          })}</tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ):<div style={{color:t.tx3,fontSize:11,textAlign:"center",padding:12}}>{!outlierVar?"Select a variable.":"Need 4+ data points."}</div>}
            </div>
          )}

          {analyticsTab==="ci"&&(
            <div>
              <div style={{fontSize:11,fontWeight:700,color:t.tx,marginBottom:8}}>Confidence Intervals</div>
              <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"flex-end",flexWrap:"wrap"}}>
                <div style={{flex:"1 1 180px",minWidth:140}}><div style={{fontSize:9,color:t.tx2,marginBottom:3}}>Variable</div>
                  <select value={ciVar} onChange={e=>setCiVar(e.target.value)} style={{width:"100%",padding:"5px 6px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf3,color:t.tx,fontSize:11}}>
                    <option value="">— Select —</option>
                    {corrVarsAll.map(v=><option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div style={{flex:"1 1 180px",minWidth:140}}><div style={{fontSize:9,color:t.tx2,marginBottom:3}}>Confidence</div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    {[0.90,0.95,0.99].map(c=>(<button key={c} onClick={()=>setCiConf(c)} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${ciConf===c?t.acc:t.bdr}`,background:ciConf===c?t.acc+"18":"transparent",color:ciConf===c?t.acc:t.tx2,cursor:"pointer",fontSize:10,fontWeight:600}}>{(c*100).toFixed(0)}%</button>))}
                  </div>
                </div>
              </div>
              {ciResult?(
                <div style={{padding:12,borderRadius:8,background:t.surf2,border:`1px solid ${t.bdr}`}}>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,fontSize:10}}>
                    <span style={{color:t.tx2}}>Sample mean</span><span style={{fontFamily:"'DM Mono',monospace",color:t.acc,fontWeight:600}}>{ciResult.mean.toFixed(4)}</span>
                    <span style={{color:t.tx2}}>Standard deviation</span><span style={{fontFamily:"'DM Mono',monospace"}}>{ciResult.sd.toFixed(4)}</span>
                    <span style={{color:t.tx2}}>Standard error</span><span style={{fontFamily:"'DM Mono',monospace"}}>{ciResult.se.toFixed(4)}</span>
                    <span style={{color:t.tx2}}>Sample size</span><span style={{fontFamily:"'DM Mono',monospace"}}>{ciResult.n}</span>
                    <div style={{gridColumn:"1/-1",marginTop:8,paddingTop:8,borderTop:`1px solid ${t.bdr}`}}><span style={{color:t.tx2,fontWeight:600}}>{(ciConf*100).toFixed(0)}% CI: </span><span style={{fontFamily:"'DM Mono',monospace",color:t.acc,fontWeight:700,fontSize:12}}>[{ciResult.lower.toFixed(4)}, {ciResult.upper.toFixed(4)}]</span><span style={{color:t.tx3,fontSize:9,marginLeft:8}}>±{ciResult.margin.toFixed(4)}</span></div>
                  </div>
                </div>
              ):<div style={{color:t.tx3,fontSize:11,textAlign:"center",padding:12}}>{!ciVar?"Select a variable.":"Need 2+ data points."}</div>}
            </div>
          )}

          {analyticsTab==="regression"&&(
            <div>
              <div style={{fontSize:11,fontWeight:700,color:t.tx,marginBottom:8}}>Linear Regression</div>
              <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"flex-end",flexWrap:"wrap"}}>
                <div style={{flex:"1 1 180px",minWidth:140}}><div style={{fontSize:9,color:t.tx2,marginBottom:3}}>X Variable (Predictor)</div>
                  <select value={regX} onChange={e=>setRegX(e.target.value)} style={{width:"100%",padding:"5px 6px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf3,color:t.tx,fontSize:11}}>
                    <option value="">— Select —</option>
                    {corrVarsAll.map(v=><option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div style={{flex:"1 1 180px",minWidth:140}}><div style={{fontSize:9,color:t.tx2,marginBottom:3}}>Y Variable (Outcome)</div>
                  <select value={regY} onChange={e=>setRegY(e.target.value)} style={{width:"100%",padding:"5px 6px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf3,color:t.tx,fontSize:11}}>
                    <option value="">— Select —</option>
                    {corrVarsAll.map(v=><option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              {regResult?(
                <div>
                  <div style={{padding:12,borderRadius:8,background:t.surf2,border:`1px solid ${t.bdr}`,marginBottom:10}}>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:6,fontSize:10}}>
                      <span style={{color:t.tx2}}>Equation</span><span style={{fontFamily:"'DM Mono',monospace",color:t.acc,fontWeight:700,gridColumn:"1/-1"}}>{regResult.equation}</span>
                      <span style={{color:t.tx2}}>R²</span><span style={{fontFamily:"'DM Mono',monospace",color:regResult.r2>0.7?t.ok:regResult.r2>0.4?t.warn:t.err,fontWeight:600}}>{regResult.r2.toFixed(4)}</span>
                      <span style={{color:t.tx2}}>Pearson r</span><span style={{fontFamily:"'DM Mono',monospace"}}>{regResult.r.toFixed(4)}</span>
                      <span style={{color:t.tx2}}>Slope</span><span style={{fontFamily:"'DM Mono',monospace"}}>{regResult.slope.toFixed(4)} ± {regResult.seSlope?.toFixed(4)}</span>
                      <span style={{color:t.tx2}}>Intercept</span><span style={{fontFamily:"'DM Mono',monospace"}}>{regResult.intercept.toFixed(4)} ± {regResult.seIntercept?.toFixed(4)}</span>
                      <span style={{color:t.tx2}}>p-value</span><span style={{fontFamily:"'DM Mono',monospace",color:regResult.significant?t.ok:t.err,fontWeight:600}}>{regResult.pValue.toFixed(6)}</span>
                      <span style={{color:t.tx2}}>Significant?</span><span style={{fontWeight:600,color:regResult.significant?t.ok:t.err}}>{regResult.significant?"Yes (p<0.05)":"No"}</span>
                      <span style={{color:t.tx2}}>Residual SE</span><span style={{fontFamily:"'DM Mono',monospace"}}>{regResult.seResidual?.toFixed(4)}</span>
                      <span style={{color:t.tx2}}>Sample size</span><span style={{fontFamily:"'DM Mono',monospace"}}>{regResult.n}</span>
                    </div>
                  </div>
                </div>
              ):<div style={{color:t.tx3,fontSize:11,textAlign:"center",padding:12}}>{!regX||!regY?"Select X and Y variables.":"Need 3+ paired data points."}</div>}
            </div>
          )}

          {analyticsTab==="histogram"&&(
            <div>
              <div style={{fontSize:11,fontWeight:700,color:t.tx,marginBottom:8}}>Distribution Histogram</div>
              <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"flex-end",flexWrap:"wrap"}}>
                <div style={{flex:"1 1 180px",minWidth:140}}><div style={{fontSize:9,color:t.tx2,marginBottom:3}}>Variable</div>
                  <select value={histVar} onChange={e=>setHistVar(e.target.value)} style={{width:"100%",padding:"5px 6px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf3,color:t.tx,fontSize:11}}>
                    <option value="">— Select —</option>
                    {corrVarsAll.map(v=><option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                {histVar&&<button onClick={()=>setHistModalOpen(true)} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${t.bdr}`,background:"transparent",color:t.tx2,cursor:"pointer",fontSize:10,fontWeight:600}}>⛶ Enlarge</button>}
                {histVar&&<button onClick={downloadHistPNG} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${t.bdr}`,background:"transparent",color:t.tx2,cursor:"pointer",fontSize:10,fontWeight:600}}>⬇ PNG</button>}
              </div>
              {histVar&&(
                <div style={{display:"flex",justifyContent:"center"}}>
                  <canvas ref={histCanvasRef} style={{borderRadius:8,border:`1px solid ${t.bdr}`,maxWidth:"100%"}} width={560} height={360}/>
                </div>
              )}
              {!histVar&&<div style={{color:t.tx3,fontSize:11,textAlign:"center",padding:12}}>Select a variable to see its distribution.</div>}
            </div>
          )}

          {analyticsTab==="norms"&&(
            <div>
              <div style={{fontSize:11,fontWeight:700,color:t.tx,marginBottom:6}}>Normative Comparison</div>
              <div style={{fontSize:10,color:t.tx3,marginBottom:10}}>Add published cephalometric norms (mean ± SD in mm). The system will compare your sample mean against each norm.</div>
              <div style={{display:"flex",gap:6,marginBottom:10,alignItems:"flex-end",flexWrap:"wrap"}}>
                <div style={{flex:"1 1 70px",minWidth:60}}><div style={{fontSize:9,color:t.tx2,marginBottom:3}}>Label</div>
                  <input value={newNorm.label} onChange={e=>setNewNorm(p=>({...p,label:e.target.value}))} placeholder="e.g. SNA" style={{width:"100%",padding:"5px 6px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf3,color:t.tx,fontSize:11}}/>
                </div>
                <div style={{flex:"1 1 70px",minWidth:60}}><div style={{fontSize:9,color:t.tx2,marginBottom:3}}>Mean (mm)</div>
                  <input value={newNorm.mean} onChange={e=>setNewNorm(p=>({...p,mean:e.target.value}))} placeholder="82.0" style={{width:"100%",padding:"5px 6px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf3,color:t.tx,fontSize:11}}/>
                </div>
                <div style={{flex:"1 1 70px",minWidth:60}}><div style={{fontSize:9,color:t.tx2,marginBottom:3}}>SD (mm)</div>
                  <input value={newNorm.sd} onChange={e=>setNewNorm(p=>({...p,sd:e.target.value}))} placeholder="3.0" style={{width:"100%",padding:"5px 6px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf3,color:t.tx,fontSize:11}}/>
                </div>
                <button onClick={addNorm} style={{padding:"5px 12px",borderRadius:6,border:"none",background:t.acc,color:"#fff",cursor:"pointer",fontSize:11,fontWeight:600}}>+ Add</button>
              </div>
              {norms.length>0&&(
                <div style={{marginBottom:12}}>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",fontSize:9,borderCollapse:"collapse"}}>
                      <thead><tr style={{borderBottom:`1px solid ${t.bdr}`}}><th style={{textAlign:"left",padding:4,color:t.tx2}}>Label</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Norm Mean</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Norm SD</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Action</th></tr></thead>
                      <tbody>{norms.map((n,i)=>(<tr key={i} style={{borderBottom:`1px solid ${t.bdr}44`}}><td style={{padding:4,color:t.tx,fontWeight:600}}>{n.label}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{n.mean.toFixed(1)} mm</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{n.sd.toFixed(1)} mm</td><td style={{padding:4,textAlign:"right"}}><button onClick={()=>removeNorm(i)} style={{padding:"2px 6px",borderRadius:4,border:"none",background:t.err+"22",color:t.err,cursor:"pointer",fontSize:9}}>✕</button></td></tr>))}</tbody>
                    </table>
                  </div>
                </div>
              )}
              {norms.length>0&&(
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:t.tx,marginBottom:6}}>Comparison Results</div>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",fontSize:9,borderCollapse:"collapse"}}>
                      <thead><tr style={{borderBottom:`1px solid ${t.bdr}`}}><th style={{textAlign:"left",padding:4,color:t.tx2}}>Norm</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Sample Mean</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Norm Mean</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Deviation</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Z-Score</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Within ±2SD?</th></tr></thead>
                      <tbody>{norms.map((n,i)=>{
                        const match=descriptive.find(d=>d.var.toLowerCase().includes(n.label.toLowerCase()));
                        if(!match||!match.mean)return(<tr key={i} style={{borderBottom:`1px solid ${t.bdr}44`}}><td style={{padding:4,color:t.tx,fontWeight:600}}>{n.label}</td><td colSpan={5} style={{padding:4,textAlign:"center",color:t.tx3}}>No matching measurement in sample</td></tr>);
                        const ppm=1;
                        const z=n.sd>0?(match.mean/ppm-n.mean)/n.sd:null;
                        const within=z!==null&&Math.abs(z)<=2;
                        return(<tr key={i} style={{borderBottom:`1px solid ${t.bdr}44`}}><td style={{padding:4,color:t.tx,fontWeight:600}}>{n.label}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{match.mean?.toFixed(2)}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{n.mean.toFixed(1)}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{z!==null?(match.mean/ppm-n.mean).toFixed(2):"-"}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace",color:z!=null?z>0?t.acc:t.err:t.tx3}}>{z!=null?z.toFixed(2):"-"}</td><td style={{padding:4,textAlign:"right",fontWeight:600,color:within?t.ok:t.err}}>{within?"Yes":"No"}</td></tr>);
                      })}</tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {corrModalOpen&&corrMatrix&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,backdropFilter:"blur(4px)"}} onClick={()=>setCorrModalOpen(false)}>
          <div style={{background:t.bg,borderRadius:12,border:`1px solid ${t.bdr}`,padding:20,maxWidth:"95vw",maxHeight:"95vh",overflow:"auto",boxShadow:`0 24px 64px ${t.shadow}40`}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:700,color:t.tx}}>Correlation Matrix — Heatmap</div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={downloadCorrPNG} style={{padding:"4px 10px",borderRadius:6,border:`1px solid ${t.bdr}`,background:t.acc+"18",color:t.acc,cursor:"pointer",fontSize:10,fontWeight:600}} title="Download as PNG">⬇ PNG</button>
                <button onClick={()=>setCorrModalOpen(false)} style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${t.bdr}`,background:"transparent",color:t.tx2,cursor:"pointer",fontSize:12}}>✕</button>
              </div>
            </div>
            <canvas ref={corrCanvasRef} style={{borderRadius:8,border:`1px solid ${t.bdr}`}}/>
          </div>
        </div>
      )}

      {tab==="export"&&(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <Btn t={t} onClick={()=>{
            const rows=[["Variable","N","Mean","SD","Median","CV%","Min","Max"]];
            descriptive.filter(d=>d.n>0).forEach(r=>{rows.push([r.var,r.n,r.mean?.toFixed(4),r.sd?.toFixed(4),r.median?.toFixed(4),r.cv?.toFixed(4),r.min?.toFixed(4),r.max?.toFixed(4)]);});
            const csv=rows.map(r=>r.map(c=>`"${String(c??'').replace(/"/g,'""')}"`).join(",")).join("\n");
            const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="database_descriptive.csv";a.click();
          }}>⬇ Descriptive statistics (.csv)</Btn>
          <Btn t={t} onClick={()=>{
            const rows=[["Image","Landmark","X","Y"]];
            databaseImages.forEach((img,idx)=>{
              (img.markups||[]).forEach(m=>{
                const label=m.label||m.type;
                (m.points||[]).forEach((p,i)=>{
                  const ptLabel=m.type==="point"?label:`${label}_P${i+1}`;
                  rows.push([`img_${idx}`,ptLabel,p.x,p.y]);
                });
              });
            });
            const csv=rows.map(r=>r.map(c=>`"${String(c??'').replace(/"/g,'""')}"`).join(",")).join("\n");
            const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="database_landmark_coordinates.csv";a.click();
          }}>⬇ Landmark coordinates (.csv)</Btn>
          <Btn t={t} onClick={()=>{
            const rows=[["Image","Variable","Value"]];
            dataset.forEach(entry=>{
              Object.entries(entry.measurements||{}).forEach(([k,v])=>{rows.push([entry.id,k,v.toFixed(4)]);});
            });
            const csv=rows.map(r=>r.map(c=>`"${String(c??'').replace(/"/g,'""')}"`).join(",")).join("\n");
            const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="database_all_measurements.csv";a.click();
          }}>⬇ All measurements + coords (.csv)</Btn>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════════════════
export default function CephalometryStudio(){
  const[theme,setTheme]=useState("bluish");const t=useMemo(()=>({...THEMES[theme],id:theme}),[theme]);
  const[projects,setProjects]=useState([]);const[activeId,setActiveId]=useState(null);
  const dirtyRef=useRef(false);

  useEffect(()=>{
    const handler=e=>{if(dirtyRef.current){e.preventDefault();e.returnValue="";}};
    window.addEventListener("beforeunload",handler);
    return ()=>window.removeEventListener("beforeunload",handler);
  },[]);

  const activeProject=projects.find(p=>p.id===activeId);

  const updateProject=(id,patch)=>{dirtyRef.current=true;setProjects(prev=>prev.map(p=>p.id===id?{...p,...patch,modified:Date.now()}:p));};
  const updateVersion=(projectId,versionId,patch)=>{dirtyRef.current=true;setProjects(prev=>prev.map(p=>{if(p.id!==projectId)return p;return{...p,modified:Date.now(),versions:p.versions.map(v=>v.id===versionId?{...v,...patch}:v)};}));};

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
      {activeId&&activeProject&&(
        <Workspace key={activeId} project={activeProject}
          onUpdateProject={patch=>updateProject(activeId,patch)}
          onUpdateVersion={(versionId,patch)=>updateVersion(activeId,versionId,patch)}
          onHome={()=>setActiveId(null)} t={t} theme={theme} setTheme={setTheme}
          onSave={proj=>{exportCephx(proj);dirtyRef.current=false;}}/>
      )}
    </div>
  );
}
