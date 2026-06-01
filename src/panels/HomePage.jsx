import { useState, useRef } from "react";
import { THEMES } from "../constants.js";
import { Btn, Tag } from "../ui.jsx";

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

export default function HomePage({t,theme,setTheme,projects,onOpen,onCreate,onImport}){
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
      <header style={{padding:"18px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"absolute",top:0,left:0,right:0,zIndex:10}} className="home-header">
        <style>{`@media (max-width: 767px) {.home-header {position:relative !important;padding:12px 16px !important; display:block !important;}}`}</style>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:50,height:50,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}><img src="/favicon.svg" alt="Website Icon" width="48" height="48"/> </div>
          <div><div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,letterSpacing:-0.5,color:t.tx}}>Cephalometry Studio</div><div style={{fontSize:10,color:t.tx2,letterSpacing:1,textTransform:"uppercase",fontWeight:600}}>Advanced Cephalometric Analysis</div></div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {Object.values(THEMES).map(th=>(
            <button key={th.id} onClick={()=>setTheme(th.id)} title={th.name}
              style={{width:30,height:30,borderRadius:8,border:0,background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0,position:"relative"}}>
              <div style={{width:28,height:28,borderRadius:7,background:th.bg,border:theme===th.id?`2px solid ${t.acc}`:`1px solid ${t.bdr}`,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",transition:"all 0.15s",boxShadow:theme===th.id?`0 0 0 2px ${t.acc}33, 0 2px 8px ${t.shadow}`:`0 1px 3px ${t.shadow}`}}>
                <div style={{width:12,height:12,borderRadius:4,background:th.acc,opacity:0.9,boxShadow:`0 0 6px ${th.acc}66`}}/>
                {theme===th.id&&<div style={{position:"absolute",inset:-3,borderRadius:9,border:`2px solid ${t.acc}`,opacity:0.5}}/>}
              </div>
            </button>
          ))}
          <div style={{width:1,height:20,background:t.bdr,margin:"0 4px"}}/>
          <input ref={fileRef} type="file" accept=".cephx" style={{display:"none"}} onChange={e=>{if(e.target.files[0])onImport(e.target.files[0]);e.target.value="";}}/>
          <Btn t={t} small onClick={()=>fileRef.current?.click()}>↑ Import .cephx</Btn>
        </div>
      </header>

      {/* HERO */}
      <div style={{textAlign:"center",padding:"64px 32px 48px"}}>
        <div style={{display:"inline-block",background:t.accMuted,border:`1px solid ${t.acc}44`,borderRadius:20,padding:"5px 16px",fontSize:12,color:t.acc,fontWeight:600,letterSpacing:0.5,marginBottom:24}}>IN SILICO CEPHALOMETRY</div>
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
