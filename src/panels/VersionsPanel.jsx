import { useState, useMemo } from "react";
import { uid, computeMeasurements } from "../utils.js";
import { Btn, Inp, Divider, PanelHeader, Tag } from "../ui.jsx";

function mkVersion(label="T0",name="Initial"){
  return{id:uid(),name,label,timestamp:Date.now(),calibration:{done:false,pxPerMm:1,knownMm:""},
    images:[],markups:[],analysisTemplate:"blank",
    processing:{brightness:0,contrast:0,windowWidth:0,windowCenter:128,edgeEnhance:0},
    lutMode:"gray",lutInvert:false,formulas:[],norms:[]};
}

function formatMeas(k, v, formatAngle){
  if(k==="angle")return formatAngle ? formatAngle(v) : v.toFixed(1)+"°";
  if(k==="x"||k==="y")return v.toFixed(1);
  if(k==="area")return v.toFixed(2)+" mm²";
  if(k==="perimeter"||k==="length"||k==="distance"||k==="lineLength"||k==="projectedDistance")return v.toFixed(2)+" mm";
  if(k==="value")return v.toFixed(3);
  if(k==="projectedDistance")return v.toFixed(2)+" mm";
  return v.toFixed(2);
}

export default function VersionsPanel({project,t,onUpdateProject,onUpdateVersion,onExportTemplate,
  showDisplacement,setShowDisplacement,compareVersionId,setCompareVersionId,
  displacementOverlay,setDisplacementOverlay,refLandmark1,setRefLandmark1,refLandmark2,setRefLandmark2,
  overlayBlend,setOverlayBlend,calibration,formatAngle,onShowAlign}){
  const[lbl,setLbl]=useState("T1");const[nm,setNm]=useState("Follow-up");
  const[editId,setEditId]=useState(null);
  const[editLabel,setEditLabel]=useState("");
  const[editName,setEditName]=useState("");
  const[confirmDeleteId,setConfirmDeleteId]=useState(null);

  const create=()=>{
    const v=mkVersion(lbl,nm);
    const src=project.versions.find(x=>x.id===project.activeVersionId);
    const nv={...v,
      calibration:src?.calibration,
      processing:src?.processing,
      lutMode:src?.lutMode,
      lutInvert:src?.lutInvert,
      analysisTemplate:src?.analysisTemplate,
      markups:(src?.markups||[]).map(m=>({...m,id:uid()})),
      formulas:(src?.formulas||[]).map(f=>({...f,id:uid()})),
      norms:(src?.norms||[]).map(n=>({...n,id:uid()})),
    };
    onUpdateProject({activeVersionId:nv.id,versions:[...project.versions,nv]});
  };

  const duplicate=v=>{
    const nv={...mkVersion(v.label+"c","Copy of "+v.name),
      calibration:v.calibration,
      processing:v.processing,
      lutMode:v.lutMode,
      lutInvert:v.lutInvert,
      analysisTemplate:v.analysisTemplate,
      images:(v.images||[]).map(img=>({...img,id:uid()})),
      markups:(v.markups||[]).map(m=>({...m,id:uid()})),
      formulas:(v.formulas||[]).map(f=>({...f,id:uid()})),
      norms:(v.norms||[]).map(n=>({...n,id:uid()})),
    };
    onUpdateProject({versions:[...project.versions,nv]});
  };

  const remove=v=>{
    if(project.versions.length<=1)return;
    onUpdateProject({
      activeVersionId:project.activeVersionId===v.id
        ?project.versions.find(x=>x.id!==v.id)?.id
        :project.activeVersionId,
      versions:project.versions.filter(x=>x.id!==v.id),
    });
    setConfirmDeleteId(null);
  };

  const revertTo=v=>{
    const active=project.versions.find(x=>x.id===project.activeVersionId);
    if(!active||v.id===active.id)return;
    onUpdateVersion(active.id,{
      markups:(v.markups||[]).map(m=>({...m,id:uid()})),
      formulas:(v.formulas||[]).map(f=>({...f,id:uid()})),
      norms:(v.norms||[]).map(n=>({...n,id:uid()})),
    });
  };

  const startEdit=v=>{
    setEditId(v.id);
    setEditLabel(v.label);
    setEditName(v.name);
  };

  const saveEdit=v=>{
    onUpdateVersion(v.id,{label:editLabel,name:editName});
    setEditId(null);
  };

  const allPointLabels=[...new Set(project.versions.flatMap(v=>(v.markups||[]).filter(m=>m.type==="point").map(m=>m.label)))].sort();

  const compareVersion=useMemo(()=>project.versions.find(v=>v.id===compareVersionId),[project.versions,compareVersionId]);
  const activeVersion=useMemo(()=>project.versions.find(v=>v.id===project.activeVersionId),[project.versions,project.activeVersionId]);

  // Compute measurement comparison
  const measComparison=useMemo(()=>{
    if(!compareVersion||!activeVersion)return[];
    const activeMarkups=activeVersion.markups||[];
    const compareMarkups=compareVersion.markups||[];
    const activeCal=activeVersion.calibration||calibration||{done:false,pxPerMm:1};
    const compareCal=compareVersion.calibration||calibration||{done:false,pxPerMm:1};
    const rows=[];
    const seen=new Set();
    for(const m of activeMarkups){
      const cm=compareMarkups.find(x=>x.label===m.label&&x.type===m.type);
      if(!cm)continue;
      const aMeas=computeMeasurements(m,activeCal);
      const cMeas=computeMeasurements(cm,compareCal);
      for(const[k,av]of Object.entries(aMeas)){
        if(k==="x"||k==="y")continue;
        const cv=cMeas[k];
        if(cv===undefined)continue;
        const key=m.label+":"+k;
        if(seen.has(key))continue;
        seen.add(key);
        rows.push({label:m.label,type:m.type,metric:k,active:av,compare:cv,delta:cv-av});
      }
    }
    return rows;
  },[compareVersion,activeVersion,calibration]);

  return(
    <div style={{padding:12}}>
      <PanelHeader t={t}>Version History ({project.versions.length})</PanelHeader>
      {project.versions.map(v=>{
        const isActive=v.id===project.activeVersionId;
        const editing=editId===v.id;
        return(
        <div key={v.id} style={{marginBottom:8,padding:10,border:`1px solid ${isActive?t.acc:t.bdr}`,borderRadius:8,background:isActive?t.accMuted:t.surf2}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
            <div style={{flex:1,minWidth:0}}>
              {editing?(
                <div style={{display:"flex",gap:4,marginBottom:2}}>
                  <Inp value={editLabel} onChange={setEditLabel} t={t} style={{width:48,fontSize:11,padding:"2px 4px"}}/>
                  <Inp value={editName} onChange={setEditName} t={t} style={{flex:1,fontSize:11,padding:"2px 4px"}}/>
                  <Btn t={t} small onClick={()=>saveEdit(v)} style={{padding:"2px 6px",fontSize:10}}>✓</Btn>
                  <Btn t={t} small onClick={()=>setEditId(null)} style={{padding:"2px 6px",fontSize:10}}>✕</Btn>
                </div>
              ):(
                <div style={{cursor:"pointer",display:"flex",alignItems:"baseline",gap:6}} onClick={()=>startEdit(v)} title="Click to rename">
                  <span style={{fontSize:12,fontWeight:700,color:t.tx}}>{v.label}:</span>
                  <span style={{fontSize:12,fontWeight:700,color:t.tx}}>{v.name}</span>
                  <span style={{fontSize:9,color:t.tx3}}>✎</span>
                </div>
              )}
              <div style={{fontSize:10,color:t.tx3}}>{new Date(v.timestamp).toLocaleDateString()} · {(v.markups||[]).length} markups · {(v.images||[]).length} image{(v.images||[]).length!==1?"s":""}</div>
            </div>
            {(v.images||[]).length>0&&<div style={{marginTop:6,display:"flex",gap:4}}>
              {v.images.slice(0,3).map(img=>(
                <img key={img.id} src={img.dataUrl} alt={img.name||""}
                  style={{width:48,height:36,borderRadius:4,objectFit:"cover",border:`1px solid ${t.bdr}`}}/>
              ))}
              {(v.images||[]).length>3&&<span style={{fontSize:10,color:t.tx3,alignSelf:"center"}}>+{v.images.length-3}</span>}
            </div>}
            <div style={{display:"flex",gap:4,flexShrink:0}}>
              {!isActive&&<button onClick={()=>onUpdateProject({activeVersionId:v.id})} style={{background:t.acc,border:"none",color:t.id==="light"?"#fff":t.bg,borderRadius:4,padding:"2px 8px",cursor:"pointer",fontSize:10,fontWeight:700}}>Switch</button>}
              {isActive&&<Tag color={t.acc}>Active</Tag>}
            </div>
          </div>
          <div style={{display:"flex",gap:4,marginTop:6}}>
            {!isActive&&<Btn t={t} small onClick={()=>revertTo(v)} title="Copy this version's data to the active version" style={{flex:1,padding:"2px 6px",fontSize:10}}>↩ Revert</Btn>}
            <Btn t={t} small onClick={()=>duplicate(v)} style={{flex:1,padding:"2px 6px",fontSize:10}}>⎘ Dup</Btn>
            <Btn t={t} small onClick={()=>onExportTemplate(v)} style={{flex:1,padding:"2px 6px",fontSize:10}}>↓ Tmpl</Btn>
            {project.versions.length>1&&(confirmDeleteId===v.id?(
              <div style={{display:"flex",gap:2}}>
                <Btn t={t} small danger onClick={()=>remove(v)} style={{padding:"2px 6px",fontSize:10}}>✓</Btn>
                <Btn t={t} small onClick={()=>setConfirmDeleteId(null)} style={{padding:"2px 6px",fontSize:10}}>✕</Btn>
              </div>
            ):(
              <Btn t={t} small danger onClick={()=>setConfirmDeleteId(v.id)} style={{padding:"2px 6px",fontSize:10}}>✕</Btn>
            ))}
          </div>
        </div>
      );})}

      <Divider t={t}/>
      <PanelHeader t={t}>New Version</PanelHeader>
      <div style={{display:"flex",gap:6,marginBottom:6}}>
        <div style={{flex:"0 0 52px"}}><div style={{fontSize:10,color:t.tx2,marginBottom:2}}>Label</div><Inp value={lbl} onChange={setLbl} t={t} placeholder="T1"/></div>
        <div style={{flex:1}}><div style={{fontSize:10,color:t.tx2,marginBottom:2}}>Name</div><Inp value={nm} onChange={setNm} t={t} placeholder="Follow-up"/></div>
      </div>
      <Btn t={t} small onClick={create} style={{width:"100%"}}>+ Create Version</Btn>

      {project.versions.length > 1 && <>
        <Divider t={t}/>
        <PanelHeader t={t}>Superimposition</PanelHeader>
        {/* Compare version dropdown */}
        <div style={{marginBottom:8}}>
          <div style={{fontSize:10,color:t.tx2,marginBottom:4}}>Compare landmarks with:</div>
          <select value={compareVersionId || ""} onChange={e => setCompareVersionId(e.target.value || null)} style={{width:"100%",background:t.surf3,border:`1px solid ${t.bdr}`,borderRadius:4,padding:"4px 8px",color:t.tx,fontSize:12,fontFamily:"inherit"}}>
            <option value="">— None —</option>
            {project.versions.map(v => <option key={v.id} value={v.id}>{v.label}: {v.name}</option>)}
          </select>
        </div>
        {/* Action buttons */}
        <div style={{display:"flex",gap:6,marginBottom:8}}>
          <Btn t={t} small active={showDisplacement} onClick={() => setShowDisplacement(v => !v)} style={{flex:1}} disabled={!compareVersionId}>⇝ Vectors</Btn>
          <Btn t={t} small active={displacementOverlay} onClick={() => setDisplacementOverlay(v => !v)} style={{flex:1}} disabled={!compareVersionId}>◎ Overlay</Btn>
          <Btn t={t} small onClick={onShowAlign} style={{flex:1}} disabled={!compareVersionId}>⊕ Align</Btn>
        </div>
        {/* Overlay blend slider */}
        {displacementOverlay && compareVersionId && (
          <div style={{marginBottom:8}}>
            <div style={{fontSize:10,color:t.tx2,marginBottom:2}}>Overlay blend: {Math.round(overlayBlend * 100)}%</div>
            <input type="range" min="0.05" max="1" step="0.05" value={overlayBlend} onChange={e => setOverlayBlend(+e.target.value)} style={{width:"100%",accentColor:t.acc}}/>
          </div>
        )}
        {/* Structural reference landmarks */}
        {displacementOverlay && compareVersionId && allPointLabels.length >= 2 && (
          <div style={{marginBottom:8}}>
            <div style={{fontSize:10,color:t.tx2,marginBottom:4}}>Align using landmarks (optional):</div>
            <div style={{display:"flex",gap:4}}>
              <select value={refLandmark1} onChange={e => setRefLandmark1(e.target.value)} style={{flex:1,background:t.surf3,border:`1px solid ${t.bdr}`,borderRadius:4,padding:"4px 6px",color:t.tx,fontSize:11,fontFamily:"inherit"}}>
                <option value="">— None —</option>
                {allPointLabels.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <span style={{color:t.tx3,fontSize:12,lineHeight:"24px"}}>↔</span>
              <select value={refLandmark2} onChange={e => setRefLandmark2(e.target.value)} style={{flex:1,background:t.surf3,border:`1px solid ${t.bdr}`,borderRadius:4,padding:"4px 6px",color:t.tx,fontSize:11,fontFamily:"inherit"}}>
                <option value="">— None —</option>
                {allPointLabels.filter(l => l !== refLandmark1).map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            {refLandmark1 && refLandmark2 && <div style={{fontSize:9,color:t.tx3,marginTop:4}}>Aligns compare version's {refLandmark1}-{refLandmark2} to current version's {refLandmark1}-{refLandmark2}</div>}
          </div>
        )}

        {/* Measurement comparison table */}
        {compareVersionId && measComparison.length > 0 && (
          <div style={{marginTop:8}}>
            <div style={{fontSize:10,fontWeight:700,color:t.tx,marginBottom:6}}>
              Measurement Comparison ({activeVersion?.label || "Active"} vs {compareVersion?.label || "Compare"})
            </div>
            <div style={{maxHeight:280,overflowY:"auto",border:`1px solid ${t.bdr}`,borderRadius:6,fontSize:10}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{background:t.surf2,position:"sticky",top:0}}>
                    {["Label","Metric","Active","Compare","Δ"].map(h => (
                      <th key={h} style={{padding:"3px 6px",textAlign:"left",color:t.tx2,borderBottom:`1px solid ${t.bdr}`,fontWeight:600,whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {measComparison.map((r,i) => (
                    <tr key={r.label+":"+r.metric} style={{background:i%2===0?t.surf:"transparent"}}>
                      <td style={{padding:"2px 6px",color:t.tx,fontWeight:600,borderBottom:`1px solid ${t.bdr}`}}>{r.label}</td>
                      <td style={{padding:"2px 6px",color:t.tx3,borderBottom:`1px solid ${t.bdr}`,fontFamily:"'DM Mono',monospace"}}>{r.metric}</td>
                      <td style={{padding:"2px 6px",color:t.tx,borderBottom:`1px solid ${t.bdr}`}}>{formatMeas(r.metric,r.active,formatAngle)}</td>
                      <td style={{padding:"2px 6px",color:t.tx,borderBottom:`1px solid ${t.bdr}`}}>{formatMeas(r.metric,r.compare,formatAngle)}</td>
                      <td style={{padding:"2px 6px",borderBottom:`1px solid ${t.bdr}`,color:Math.abs(r.delta)>5?t.err:Math.abs(r.delta)>2?t.warn:t.ok,fontWeight:700}}>
                        {r.metric==="angle"? (r.delta>=0?"+":"")+r.delta.toFixed(1)+"°": (r.delta>=0?"+":"")+r.delta.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>}
    </div>
  );
}
