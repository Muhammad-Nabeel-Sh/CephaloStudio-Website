import { useState, useRef } from "react";
import { PREDEFINED } from "../constants.js";
import { Btn, Tag } from "../ui.jsx";

export default function TemplatePickerModal({t,projection,onPick,onClose}){
  const analyses=PREDEFINED[projection]||[];
  const templateRef=useRef(null);
  const[step,setStep]=useState("choose");
  const[selectedAnalysis,setSelectedAnalysis]=useState(null);

  if(projection==="other"){
    const otherData=PREDEFINED.other||[];
    const handleProjectionClick=(p)=>{
      onPick("projection",{name:p.name,def:p.def,color:p.color});
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
