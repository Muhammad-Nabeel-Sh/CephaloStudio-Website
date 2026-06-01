import { useState } from "react";
import { uid } from "../utils.js";
import { Btn, Tag, Inp, PropRow } from "../ui.jsx";
import { Modal } from "./Modal.jsx";

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

export default function ReproducibilityPanel({t,markups,studies,onUpdateStudies,activeStudyId,setActiveStudyId,reproCollecting,setReproCollecting}){
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
