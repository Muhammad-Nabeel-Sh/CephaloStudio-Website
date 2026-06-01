import { useState } from "react";
import { uid } from "../utils.js";
import { Btn, Inp, Divider, PanelHeader, Tag } from "../ui.jsx";

function mkVersion(label="T0",name="Initial"){
  return{id:uid(),name,label,timestamp:Date.now(),calibration:{done:false,pxPerMm:1,knownMm:""},
    markups:[],analysisTemplate:"blank",
    processing:{brightness:0,contrast:0,windowWidth:0,windowCenter:128,edgeEnhance:0},
    lutMode:"gray",lutInvert:false,formulas:[],norms:[]};
}

export default function VersionsPanel({project,t,onUpdateProject,onExportTemplate}){
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
