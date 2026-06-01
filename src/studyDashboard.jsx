/* eslint-disable react-refresh/only-export-components */
// ═══════════════════════════════════════════════════════════════════════════════
// STUDY & DATABASE DASHBOARDS
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useMemo, useCallback } from "react";
import { mean, stdev, median, iqr, skewness, kurtosis, coefficientOfVariation, shapiroWilk, calculateICC, dahlbergError, blandAltman, tTestPaired, spearmanCorrelation, computePerLandmarkError, detectSystematicBias, anovaAcrossSessions, standardError, minimalDetectableChange, computeNormsComparison, computeMeasurements, correlationMatrix, detectOutliers, confidenceInterval, linearRegression } from "./utils.js";
import { Btn, Tag } from "./ui.jsx";

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function reproAllLabels(study){
  const labels=new Set();
  study.operators.forEach(op=>{(op.trials||[]).forEach(tr=>{(tr.measurements||[]).forEach(m=>{if(m.label)labels.add(m.label);});});});
  return[...labels].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
}

function reproIccMatrix(study,metric){
  if(study.type==="intra"){
    const op=study.operators[0];if(!op)return null;
    const trials=(op.trials||[]).filter(tr=>tr.measurements?.length);
    const labels=reproAllLabels(study);
    if(trials.length<2||labels.length<1)return null;
    const rows=trials.map(tr=>labels.map(lab=>{const m=(tr.measurements||[]).find(x=>x.label===lab);return m?metric==="x"?m.x:m.y:NaN;}));
    if(rows.some(r=>r.some(Number.isNaN)))return null;
    return rows;
  }
  const labels=reproAllLabels(study);
  if(labels.length<1)return null;
  const rows=study.operators.map(op=>{const tr=op.trials?.[0];return labels.map(lab=>{const m=(tr?.measurements||[]).find(x=>x.label===lab);return m?metric==="x"?m.x:m.y:NaN;});});
  if(rows.length<2||rows.some(r=>r.some(Number.isNaN)))return null;
  return rows;
}

function reproPairedVectors(study,metric,sessionA,sessionB){
  const labels=reproAllLabels(study);
  if(labels.length<1)return{vals1:[],vals2:[]};
  const pick=(op,trialIdx,lab)=>{const tr=op.trials?.[trialIdx];const m=(tr?.measurements||[]).find(x=>x.label===lab);return m?metric==="x"?m.x:m.y:null;};
  if(study.type==="intra"){
    const op=study.operators[0],vals1=[],vals2=[];
    labels.forEach(lab=>{const a=pick(op,sessionA,lab),b=pick(op,sessionB,lab);if(a!==null&&b!==null){vals1.push(a);vals2.push(b);}});
    return{vals1,vals2};
  }
  const opA=study.operators[sessionA],opB=study.operators[sessionB],vals1=[],vals2=[];
  labels.forEach(lab=>{const a=pick(opA,0,lab),b=pick(opB,0,lab);if(a!==null&&b!==null){vals1.push(a);vals2.push(b);}});
  return{vals1,vals2};
}

function exportReproTablesCsv(study){
  const rows=[["study","design","operator","session_index","landmark","x_px","y_px","timestamp"]];
  study.operators.forEach((op,oi)=>{(op.trials||[]).forEach((tr,ti)=>{(tr.measurements||[]).forEach(m=>{rows.push([study.name,study.type,op.name||`Operator_${oi+1}`,ti+1,m.label,m.x,m.y,m.timestamp||""]);});});});
  const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  a.download=`${String(study.name).replace(/\s+/g,"_")}_reproducibility.csv`;
  a.click();
}

function exportDescriptiveCsv(study,metric,descriptive){
  const rows=[["Landmark","n","Mean","SD","Median","CV%","Min","Max","Skewness","Kurtosis","Shapiro_W","Shapiro_p","Normal"]];
  descriptive.forEach(r=>{rows.push([r.lab,r.n,r.mean!==null?r.mean.toFixed(4):"",r.sd!==null?r.sd.toFixed(4):"",r.median!==null?r.median.toFixed(4):"",r.cv!==null?r.cv.toFixed(4):"",r.min!==null?r.min.toFixed(4):"",r.max!==null?r.max.toFixed(4):"",r.skew!==null?r.skew.toFixed(4):"",r.kurt!==null?r.kurt.toFixed(4):"",r.shapiro?r.shapiro.W.toFixed(4):"",r.shapiro?r.shapiro.pValue.toFixed(4):"",r.shapiro?String(r.shapiro.normal):""]);});
  const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  a.download=`${String(study.name).replace(/\s+/g,"_")}_descriptive.csv`;a.click();
}

function exportErrorMetricsCsv(perLandmark){
  const rows=[["Landmark","n","Mean_Diff","SD_Diff","Dahlberg","Abs_Mean","CV%"]];
  perLandmark.forEach(r=>{rows.push([r.lab,r.n,r.meanDiff.toFixed(4),r.sdDiff.toFixed(4),r.dahlberg.toFixed(4),r.absMean.toFixed(4),r.cv!==null?r.cv.toFixed(4):""]);});
  const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  a.download="error_metrics.csv";a.click();
}

function exportFullStatsReport(study,metric,labels,descriptive,perLandmark,biases,icc,dahl,bland,tTest,anovaRes,sem,mdc){
  const rows=[["CephaloStudio Statistical Report"]];
  rows.push(["Study",study.name]);rows.push(["Design",study.type==="intra"?"Intra-operator":"Inter-operator"]);rows.push(["Metric",metric.toUpperCase()]);rows.push(["Date",new Date().toISOString()]);rows.push([]);
  rows.push(["=== DESCRIPTIVE STATISTICS ==="]);rows.push(["Landmark","n","Mean","SD","Median","CV%","Min","Max"]);
  descriptive.forEach(r=>{rows.push([r.lab,r.n,r.mean?.toFixed(4),r.sd?.toFixed(4),r.median?.toFixed(4),r.cv?.toFixed(4),r.min?.toFixed(4),r.max?.toFixed(4)]);});
  rows.push([]);rows.push(["=== RELIABILITY ==="]);rows.push(["ICC (Absolute)",icc?.ICC_Absolute?.toFixed(4)]);rows.push(["ICC (Consistency)",icc?.ICC_Consistency?.toFixed(4)]);rows.push(["Interpretation",icc?.interpretation]);rows.push(["SEM",sem?.toFixed(4)]);rows.push(["MDC (95%)",mdc?.toFixed(4)]);rows.push([]);
  rows.push(["=== ERROR METRICS ==="]);rows.push(["Dahlberg Error",dahl?.error?.toFixed(4)]);rows.push(["Bland-Altman Mean Diff",bland?.meanDiff?.toFixed(4)]);rows.push(["Bland-Altman SD",bland?.stdDiff?.toFixed(4)]);rows.push(["Bland-Altman Lower LoA",bland?.lowerLOA?.toFixed(4)]);rows.push(["Bland-Altman Upper LoA",bland?.upperLOA?.toFixed(4)]);rows.push([]);
  rows.push(["=== PAIRED T-TEST ==="]);rows.push(["t",tTest?.t?.toFixed(4)]);rows.push(["df",tTest?.df]);rows.push(["p-value",tTest?.pValue?.toFixed(6)]);rows.push(["Significant",tTest?.significant?"Yes":"No"]);rows.push([]);
  rows.push(["=== ANOVA ==="]);rows.push(["F",anovaRes?.F?.toFixed(4)]);rows.push(["p-value",anovaRes?.pValue?.toFixed(6)]);rows.push(["Significant",anovaRes?.significant?"Yes":"No"]);rows.push([]);
  rows.push(["=== PER-LANDMARK ERRORS ==="]);rows.push(["Landmark","n","Mean Diff","SD Diff","Dahlberg","Abs Mean","CV%"]);
  perLandmark.forEach(r=>{rows.push([r.lab,r.n,r.meanDiff.toFixed(4),r.sdDiff.toFixed(4),r.dahlberg.toFixed(4),r.absMean.toFixed(4),r.cv?.toFixed(4)]);});rows.push([]);
  rows.push(["=== SYSTEMATIC BIAS ==="]);rows.push(["Comparison","t","p-value","Significant"]);
  biases.forEach(b=>{rows.push([b.pair,b.t.toFixed(4),b.pValue.toFixed(6),b.significant?"Yes":"No"]);});
  const csv=rows.map(r=>r.map(c=>`"${String(c??'').replace(/"/g,'""')}"`).join(",")).join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  a.download=`${String(study.name).replace(/\s+/g,"_")}_full_report.csv`;a.click();
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTICS PANEL (toggles between study & database)
// ═══════════════════════════════════════════════════════════════════════════════

export function StatisticsPanel({t,studies,databaseImages,formatAngle,MarkupTablesPanel: MTP}){
  const[source,setSource]=useState(studies?.length>0?"study":"database");
  const[mainTab,setMainTab]=useState("tables");

  const showDatabase=source==="database"&&databaseImages?.length>0;
  const showStudy=source==="study";

  return(
    <div style={{padding:12,maxWidth:"100%",overflow:"hidden"}}>
      <div style={{display:"flex",gap:6,marginBottom:12,alignItems:"center",flexWrap:"wrap"}}>
        <button onClick={()=>setSource(showStudy?"database":"study")} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${t.bdr}`,background:showStudy?"transparent":t.acc+"18",color:showStudy?t.tx2:t.acc,cursor:"pointer",fontSize:10,fontWeight:600}}>{showStudy?"Database Mode \u2192":"\u2190 Study Mode"}</button>
        <span style={{fontSize:10,color:t.tx3}}>{showStudy?"Study Mode":"Database Mode"} — {showStudy?(studies?.length||0)+" studies":(databaseImages?.length||0)+" images"}</span>
      </div>
      <div style={{display:"flex",gap:4,marginBottom:16}}>
        <button onClick={()=>setMainTab("tables")} style={{padding:"6px 14px",borderRadius:6,border:`1px solid ${mainTab==="tables"?t.acc:t.bdr}`,background:mainTab==="tables"?t.acc+"18":"transparent",color:mainTab==="tables"?t.acc:t.tx2,cursor:"pointer",fontSize:11,fontWeight:600}}>Registered Markups</button>
        <button onClick={()=>setMainTab("dashboard")} style={{padding:"6px 14px",borderRadius:6,border:`1px solid ${mainTab==="dashboard"?t.acc:t.bdr}`,background:mainTab==="dashboard"?t.acc+"18":"transparent",color:mainTab==="dashboard"?t.acc:t.tx2,cursor:"pointer",fontSize:11,fontWeight:600}}>Statistics Dashboard</button>
      </div>
      {mainTab==="tables"&&(
        <>
          {MTP&&<MTP databaseImages={databaseImages} currentImageIndex={0} t={t} formatAngle={formatAngle}/>}
          <StudyMarkupTables t={t} studies={studies||[]}/>
        </>
      )}
      {mainTab==="dashboard"&&(showDatabase?
        <DatabaseDashboard t={t} databaseImages={databaseImages}/>:
        <StudyDashboard t={t} studies={studies||[]}/>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STUDY MARKUP TABLES
// ═══════════════════════════════════════════════════════════════════════════════

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
                  {study.type==="intra"&&(study.operators[0]?.trials||[]).map((_,i)=><th key={i} style={{textAlign:"center",padding:6,color:t.acc,background:t.surf2}}>Trial {i+1}</th>)}
                  {study.type==="inter"&&study.operators.map((op,i)=><th key={op.id} style={{textAlign:"center",padding:6,color:t.acc,background:t.surf2}}>{op.name||`Op ${i+1}`}</th>)}
                </tr>
              </thead>
              <tbody>
                {labels.map(lab=>{
                  const cells=[];
                  if(study.type==="intra"){(study.operators[0]?.trials||[]).forEach(tr=>{const m=(tr.measurements||[]).find(x=>x.label===lab);cells.push(m?`(${m.x?.toFixed(1)}, ${m.y?.toFixed(1)})`:"—");});}
                  else{study.operators.forEach(op=>{const m=(op.trials?.[0]?.measurements||[]).find(x=>x.label===lab);cells.push(m?`(${m.x?.toFixed(1)}, ${m.y?.toFixed(1)})`:"—");});}
                  return(<tr key={lab} style={{borderBottom:`1px solid ${t.bdr}44`}}><td style={{padding:6,color:t.tx,fontWeight:600}}>{lab}</td>{cells.map((c,i)=><td key={i} style={{padding:6,textAlign:"center",color:c==="—"?t.tx3:t.tx}}>{c}</td>)}</tr>);
                })}
              </tbody>
            </table>
          </div>
          <div style={{marginTop:10}}><Btn t={t} small onClick={()=>exportReproTablesCsv(study)}>⬇ Download raw data (.csv)</Btn></div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STUDY DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

export function StudyDashboard({t,studies}){
  const[selectedId,setSelectedId]=useState(null);
  const[metric,setMetric]=useState("x");
  const[pairA,setPairA]=useState(0);
  const[pairB,setPairB]=useState(1);
  const[tab,setTab]=useState("overview");

  const study=studies.find(s=>s.id===selectedId);

  const computedStats=useMemo(()=>{
    if(!study)return{labels:[],iccMat:null,icc:null,vals1:[],vals2:[],dahl:null,bland:null,tTest:null,shapiro:null,shapiro2:null,spearman:null,descriptive:[],perLandmark:[],biases:[],anovaRes:null,sem:null,mdc:null,normsComp:[]};
    const labels=reproAllLabels(study);
    const iccMat=reproIccMatrix(study,metric);
    const icc=iccMat&&iccMat.length>=2?calculateICC(iccMat):null;
    const maxP=study.type==="intra"?Math.max(0,(study.operators[0]?.trials||[]).length-1):Math.max(0,study.operators.length-1);
    const pa0=Math.min(Math.max(0,pairA),maxP),pb0=Math.min(Math.max(0,pairB),maxP);
    const{vals1,vals2}=reproPairedVectors(study,metric,pa0,pb0);
    const dahl=vals1.length>=2&&vals1.length===vals2.length?dahlbergError(vals1,vals2):null;
    const bland=vals1.length>=2&&vals1.length===vals2.length?blandAltman(vals1,vals2):null;
    const tTest=vals1.length>=2&&vals1.length===vals2.length?tTestPaired(vals1,vals2):null;
    const shapiro=vals1.length>=3?shapiroWilk(vals1):null;
    const shapiro2=vals2.length>=3?shapiroWilk(vals2):null;
    const spearman=spearmanCorrelation(vals1,vals2);
    const descriptive=labels.length?labels.map(lab=>{
      const vls=[];
      if(study.type==="intra"){(study.operators[0]?.trials||[]).forEach(tr=>{const m=(tr.measurements||[]).find(x=>x.label===lab);if(m)vls.push(metric==="x"?m.x:m.y);});}
      else{study.operators.forEach(op=>{const m=(op.trials?.[0]?.measurements||[]).find(x=>x.label===lab);if(m)vls.push(metric==="x"?m.x:m.y);});}
      if(!vls.length)return{lab,n:0,mean:null,sd:null,min:null,max:null,median:null,iqrVal:null,skew:null,kurt:null,cv:null};
      const m0=mean(vls),s=stdev(vls,m0),md=median(vls),iq=iqr(vls);
      return{lab,n:vls.length,mean:m0,sd:s,min:Math.min(...vls),max:Math.max(...vls),median:md,iqrVal:iq.iqr,skew:vls.length>=3?skewness(vls):null,kurt:vls.length>=4?kurtosis(vls):null,cv:coefficientOfVariation(vls),shapiro:vls.length>=3?shapiroWilk(vls):null};
    }):[];
    const perLandmark=computePerLandmarkError(study,metric,labels);
    const biases=detectSystematicBias(study,metric,labels);
    const anovaRes=anovaAcrossSessions(study,metric,labels);
    const sem=icc?standardError(vals1,icc.ICC_Absolute):null;
    const mdc=sem?minimalDetectableChange(sem):null;
    const normsComp=computeNormsComparison(descriptive,study?.norms||[],{pxPerMm:1});
    return{labels,iccMat,icc,vals1,vals2,dahl,bland,tTest,shapiro,shapiro2,spearman,descriptive,perLandmark,biases,anovaRes,sem,mdc,normsComp};
  },[study,metric,pairA,pairB]);

  const{labels,icc,vals1,vals2,dahl,bland,tTest,shapiro,shapiro2,spearman,descriptive,perLandmark,biases,anovaRes,sem,mdc,normsComp}=computedStats;

  const tabs=[["overview","Overview"],["descriptive","Descriptive"],["errors","Per-Landmark"],["inferential","Inferential"],["norms","Norms"],["export","Export"]];
  const study2=study;
  const maxP=study2?(study2.type==="intra"?Math.max(0,(study2.operators[0]?.trials||[]).length-1):Math.max(0,study2.operators.length-1)):0;
  const pa=Math.min(Math.max(0,pairA),maxP);
  const pb=Math.min(Math.max(0,pairB),maxP);

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
      {!study2&&<div style={{color:t.tx3,fontSize:12,textAlign:"center",padding:20}}>Select a study to view statistics.</div>}
      {study2&&(
        <>
          <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
            <button type="button" onClick={()=>setMetric("x")} style={{padding:"4px 10px",border:`1px solid ${metric==="x"?t.acc:t.bdr}`,borderRadius:6,background:metric==="x"?t.accMuted:t.surf3,color:metric==="x"?t.acc:t.tx2,cursor:"pointer",fontSize:10,fontWeight:600}}>X (px)</button>
            <button type="button" onClick={()=>setMetric("y")} style={{padding:"4px 10px",border:`1px solid ${metric==="y"?t.acc:t.bdr}`,borderRadius:6,background:metric==="y"?t.accMuted:t.surf3,color:metric==="y"?t.acc:t.tx2,cursor:"pointer",fontSize:10,fontWeight:600}}>Y (px)</button>
          </div>
          <div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>
            {tabs.map(([id,label])=>(<button key={id} onClick={()=>setTab(id)} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${tab===id?t.acc:t.bdr}`,background:tab===id?t.acc+"18":"transparent",color:tab===id?t.acc:t.tx2,cursor:"pointer",fontSize:10,fontWeight:600,whiteSpace:"nowrap"}}>{label}</button>))}
          </div>

          {tab==="overview"&&(
            <div>
              <table style={{width:"100%",fontSize:10,borderCollapse:"collapse"}}>
                <tbody>
                  <tr><td style={{padding:"5px 6px",color:t.tx2,width:160}}>Design</td><td style={{padding:"5px 6px"}}>{study2.type==="intra"?"Intra-operator":"Inter-operator"}</td></tr>
                  <tr style={{borderTop:`1px solid ${t.bdr}66`}}><td style={{padding:"5px 6px",color:t.tx2}}>Status</td><td style={{padding:"5px 6px",color:study2.status==="completed"?t.ok:t.warn}}>{study2.status||"—"}</td></tr>
                  <tr style={{borderTop:`1px solid ${t.bdr}66`}}><td style={{padding:"5px 6px",color:t.tx2}}>Landmarks</td><td style={{padding:"5px 6px",fontFamily:"'DM Mono',monospace",color:t.acc}}>{labels.length}</td></tr>
                  <tr style={{borderTop:`1px solid ${t.bdr}66`}}><td style={{padding:"5px 6px",color:t.tx2}}>Sessions</td><td style={{padding:"5px 6px",fontFamily:"'DM Mono',monospace"}}>{study2.type==="intra"?(study2.operators[0]?.trials||[]).length:study2.operators.length}</td></tr>
                  {icc&&(<tr style={{borderTop:`1px solid ${t.bdr}66`}}><td style={{padding:"5px 6px",color:t.tx2,fontWeight:600}}>ICC (absolute)</td><td style={{padding:"5px 6px",fontFamily:"'DM Mono',monospace",color:t.acc,fontWeight:700}}>{icc.ICC_Absolute?.toFixed(4)}</td></tr>)}
                  {icc&&(<tr style={{borderTop:`1px solid ${t.bdr}66`}}><td style={{padding:"5px 6px",color:t.tx2,fontWeight:600}}>ICC interpretation</td><td style={{padding:"5px 6px",fontWeight:600,color:icc.ICC_Absolute>=0.9?t.ok:icc.ICC_Absolute>=0.75?t.warn:t.err}}>{icc.interpretation}</td></tr>)}
                  {icc&&sem!==null&&(<tr style={{borderTop:`1px solid ${t.bdr}66`}}><td style={{padding:"5px 6px",color:t.tx2,fontWeight:600}}>SEM</td><td style={{padding:"5px 6px",fontFamily:"'DM Mono',monospace"}}>{sem.toFixed(4)} px</td></tr>)}
                  {icc&&mdc!==null&&(<tr style={{borderTop:`1px solid ${t.bdr}66`}}><td style={{padding:"5px 6px",color:t.tx2,fontWeight:600}}>MDC (95%)</td><td style={{padding:"5px 6px",fontFamily:"'DM Mono',monospace"}}>{mdc.toFixed(4)} px</td></tr>)}
                  {anovaRes&&(<tr style={{borderTop:`1px solid ${t.bdr}66`}}><td style={{padding:"5px 6px",color:t.tx2,fontWeight:600}}>ANOVA F</td><td style={{padding:"5px 6px",fontFamily:"'DM Mono',monospace"}}>{anovaRes.F.toFixed(4)}</td></tr>)}
                  {anovaRes&&(<tr style={{borderTop:`1px solid ${t.bdr}66`}}><td style={{padding:"5px 6px",color:t.tx2,fontWeight:600}}>ANOVA p-value</td><td style={{padding:"5px 6px",fontFamily:"'DM Mono',monospace",color:anovaRes.significant?t.err:t.ok,fontWeight:700}}>{anovaRes.pValue.toFixed(6)}</td></tr>)}
                  {anovaRes&&(<tr style={{borderTop:`1px solid ${t.bdr}66`}}><td style={{padding:"5px 6px",color:t.tx2,fontWeight:600}}>ANOVA result</td><td style={{padding:"5px 6px",fontWeight:600,color:anovaRes.significant?t.err:t.ok}}>{anovaRes.significant?"Significant bias":"No significant bias"}</td></tr>)}
                  {dahl&&(<tr style={{borderTop:`1px solid ${t.bdr}66`}}><td style={{padding:"5px 6px",color:t.tx2,fontWeight:600}}>Dahlberg error</td><td style={{padding:"5px 6px",fontFamily:"'DM Mono',monospace",color:t.acc,fontWeight:700}}>{dahl.error.toFixed(4)} px</td></tr>)}
                  {dahl&&(<tr style={{borderTop:`1px solid ${t.bdr}66`}}><td style={{padding:"5px 6px",color:t.tx2,fontWeight:600}}>Paired landmarks</td><td style={{padding:"5px 6px",fontFamily:"'DM Mono',monospace"}}>{vals1.length}</td></tr>)}
                </tbody>
              </table>
              <div style={{display:"flex",gap:8,marginTop:14,paddingTop:10,borderTop:`1px solid ${t.bdr}`,flexWrap:"wrap"}}>
                <Btn t={t} small onClick={()=>exportReproTablesCsv(study2)}>⬇ Download tables (.csv)</Btn>
                <Btn t={t} small onClick={()=>exportFullStatsReport(study2,metric,labels,descriptive,perLandmark,biases,icc,dahl,bland,tTest,anovaRes,sem,mdc)}>⬇ Full report</Btn>
              </div>
            </div>
          )}

          {tab==="descriptive"&&(
            <div>
              <div style={{fontSize:11,fontWeight:700,color:t.tx,marginBottom:6}}>Descriptive Statistics ({metric.toUpperCase()}, px)</div>
              <div style={{overflowX:"auto",marginBottom:12}}>
                <table style={{width:"100%",fontSize:9,borderCollapse:"collapse"}}>
                  <thead><tr style={{borderBottom:`1px solid ${t.bdr}`}}><th style={{textAlign:"left",padding:4,color:t.tx2}}>Landmark</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>n</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Mean</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>SD</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Median</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>CV%</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Min</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Max</th></tr></thead>
                  <tbody>{descriptive.map(row=>(<tr key={row.lab} style={{borderBottom:`1px solid ${t.bdr}44`}}><td style={{padding:4,color:t.tx,fontWeight:600}}>{row.lab}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.n}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace",color:t.acc}}>{row.mean!==null?row.mean.toFixed(3):"—"}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.sd!==null?row.sd.toFixed(3):"—"}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.median!==null?row.median.toFixed(3):"—"}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.cv!==null?row.cv.toFixed(2):"—"}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.min!==null?row.min.toFixed(2):"—"}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.max!==null?row.max.toFixed(2):"—"}</td></tr>))}</tbody>
                </table>
              </div>
              <div style={{fontSize:11,fontWeight:700,color:t.tx,marginBottom:6}}>Normality (Shapiro–Wilk)</div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",fontSize:9,borderCollapse:"collapse"}}>
                  <thead><tr style={{borderBottom:`1px solid ${t.bdr}`}}><th style={{textAlign:"left",padding:4,color:t.tx2}}>Landmark</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>W</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>p-value</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Normal?</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Skew</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Kurtosis</th></tr></thead>
                  <tbody>{descriptive.filter(r=>r.shapiro).map(row=>(<tr key={row.lab} style={{borderBottom:`1px solid ${t.bdr}44`}}><td style={{padding:4,color:t.tx,fontWeight:600}}>{row.lab}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.shapiro.W.toFixed(4)}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.shapiro.pValue.toFixed(4)}</td><td style={{padding:4,textAlign:"right",color:row.shapiro.normal?t.ok:t.err,fontWeight:600}}>{row.shapiro.normal?"Yes":"No"}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.skew!==null?row.skew.toFixed(3):"—"}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.kurt!==null?row.kurt.toFixed(3):"—"}</td></tr>))}</tbody>
                </table>
              </div>
            </div>
          )}

          {tab==="errors"&&(
            <div>
              <div style={{fontSize:11,fontWeight:700,color:t.tx,marginBottom:6}}>Per-Landmark Error Metrics</div>
              {perLandmark.length===0?<div style={{color:t.tx3,fontSize:11,textAlign:"center",padding:12}}>Need at least two sessions for per-landmark errors.</div>:(
                <div style={{overflowX:"auto",marginBottom:12}}>
                  <table style={{width:"100%",fontSize:9,borderCollapse:"collapse"}}>
                    <thead><tr style={{borderBottom:`1px solid ${t.bdr}`}}><th style={{textAlign:"left",padding:4,color:t.tx2}}>Landmark</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>n</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Mean Diff</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>SD Diff</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Dahlberg</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Abs Mean</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>CV%</th></tr></thead>
                    <tbody>{perLandmark.map(row=>(<tr key={row.lab} style={{borderBottom:`1px solid ${t.bdr}44`}}><td style={{padding:4,color:t.tx,fontWeight:600}}>{row.lab}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.n}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.meanDiff.toFixed(4)}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.sdDiff.toFixed(4)}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace",color:t.acc,fontWeight:600}}>{row.dahlberg.toFixed(4)}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.absMean.toFixed(4)}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.cv!==null?row.cv.toFixed(2):"—"}</td></tr>))}</tbody>
                  </table>
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
                {study2.type==="intra"&&(
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8}}>
                    <div><div style={{fontSize:9,color:t.tx3,marginBottom:2}}>Trial A</div><select value={pa} onChange={e=>setPairA(+e.target.value)} style={{width:"100%",padding:"6px 8px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf3,color:t.tx,fontSize:11}}>{(study2.operators[0]?.trials||[]).map((tr,i)=>(<option key={i} value={i}>Trial {i+1}</option>))}</select></div>
                    <div><div style={{fontSize:9,color:t.tx3,marginBottom:2}}>Trial B</div><select value={pb} onChange={e=>setPairB(+e.target.value)} style={{width:"100%",padding:"6px 8px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf3,color:t.tx,fontSize:11}}>{(study2.operators[0]?.trials||[]).map((tr,i)=>(<option key={i} value={i}>Trial {i+1}</option>))}</select></div>
                  </div>
                )}
                {study2.type==="inter"&&(
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8}}>
                    <div><div style={{fontSize:9,color:t.tx3,marginBottom:2}}>Operator A</div><select value={pa} onChange={e=>setPairA(+e.target.value)} style={{width:"100%",padding:"6px 8px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf3,color:t.tx,fontSize:11}}>{study2.operators.map((op,i)=>(<option key={op.id} value={i}>{op.name||`Operator ${i+1}`}</option>))}</select></div>
                    <div><div style={{fontSize:9,color:t.tx3,marginBottom:2}}>Operator B</div><select value={pb} onChange={e=>setPairB(+e.target.value)} style={{width:"100%",padding:"6px 8px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf3,color:t.tx,fontSize:11}}>{study2.operators.map((op,i)=>(<option key={op.id} value={i}>{op.name||`Operator ${i+1}`}</option>))}</select></div>
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
                    {sem!==null&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>SEM</span><span style={{fontFamily:"'DM Mono',monospace",color:t.tx}}>{sem.toFixed(4)} px</span></div>}
                    {mdc!==null&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>MDC (95%)</span><span style={{fontFamily:"'DM Mono',monospace",color:t.tx}}>{mdc.toFixed(4)} px</span></div>}
                    <div style={{padding:"6px 8px",borderRadius:4,background:t.accMuted,color:t.acc,fontWeight:600,textAlign:"center",fontSize:10}}>{icc.interpretation}</div>
                  </div>):<div style={{color:t.tx3,fontSize:11}}>Need at least two complete sessions and matching landmarks on every session for ICC.</div>}
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:10,fontWeight:700,color:t.tx2,marginBottom:6}}>Dahlberg error</div>
                  {dahl?<div style={{display:"flex",justifyContent:"space-between",fontSize:11}}><span>Random error (paired)</span><span style={{fontFamily:"'DM Mono',monospace",color:t.acc,fontWeight:700}}>{dahl.error.toFixed(4)} px</span></div>:<div style={{color:t.tx3,fontSize:11}}>Need two sessions with the same landmarks.</div>}
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
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:10,fontWeight:700,color:t.tx2,marginBottom:6}}>Normality (paired data)</div>
                  {shapiro?(<div style={{fontSize:11}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>W (session A)</span><span style={{fontFamily:"'DM Mono',monospace"}}>{shapiro.W.toFixed(4)}</span></div>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>p-value</span><span style={{fontFamily:"'DM Mono',monospace",color:shapiro.normal?t.ok:t.err}}>{shapiro.pValue.toFixed(4)}</span></div>
                    {shapiro2&&<><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>W (session B)</span><span style={{fontFamily:"'DM Mono',monospace"}}>{shapiro2.W.toFixed(4)}</span></div><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>p-value</span><span style={{fontFamily:"'DM Mono',monospace",color:shapiro2.normal?t.ok:t.err}}>{shapiro2.pValue.toFixed(4)}</span></div></>}
                    <div style={{padding:"6px 8px",borderRadius:4,background:(shapiro.normal&&(!shapiro2||shapiro2.normal))?t.ok+"22":t.err+"22",color:shapiro.normal&&(!shapiro2||shapiro2.normal)?t.ok:t.err,fontWeight:600,textAlign:"center"}}>{shapiro.normal&&(!shapiro2||shapiro2.normal)?"Approximately normal":"Non-normal distribution"}</div>
                  </div>):<div style={{color:t.tx3,fontSize:11}}>Need at least 3 paired observations.</div>}
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:t.tx2,marginBottom:6}}>Bland–Altman</div>
                  {bland?(<div style={{fontSize:11}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>Mean difference</span><span style={{fontFamily:"'DM Mono',monospace",color:t.tx}}>{bland.meanDiff.toFixed(4)}</span></div>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>SD of differences</span><span style={{fontFamily:"'DM Mono',monospace",color:t.tx}}>{bland.stdDiff.toFixed(4)}</span></div>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>Lower LoA</span><span style={{fontFamily:"'DM Mono',monospace",color:t.warn}}>{bland.lowerLOA.toFixed(4)}</span></div>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>Upper LoA</span><span style={{fontFamily:"'DM Mono',monospace",color:t.warn}}>{bland.upperLOA.toFixed(4)}</span></div>
                  </div>):<div style={{color:t.tx3,fontSize:11}}>Cannot compute.</div>}
                </div>
              </div>
            </div>
          )}

          {tab==="norms"&&(
            <div>
              <div style={{fontSize:11,fontWeight:700,color:t.tx,marginBottom:6}}>Clinical Norms Comparison</div>
              {(!study2?.norms||study2.norms.length===0)?(<div style={{color:t.tx3,fontSize:11,textAlign:"center",padding:20}}>No norms defined for this study. Add norms in the Markups panel first.</div>):(
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
              <Btn t={t} onClick={()=>exportReproTablesCsv(study2)}>⬇ Raw data tables (.csv)</Btn>
              <Btn t={t} onClick={()=>exportDescriptiveCsv(study2,metric,descriptive)}>⬇ Descriptive statistics (.csv)</Btn>
              <Btn t={t} onClick={()=>exportErrorMetricsCsv(perLandmark)}>⬇ Per-landmark error metrics (.csv)</Btn>
              <Btn t={t} onClick={()=>exportFullStatsReport(study2,metric,labels,descriptive,perLandmark,biases,icc,dahl,bland,tTest,anovaRes,sem,mdc)}>⬇ Full statistical report (.csv)</Btn>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

export function DatabaseDashboard({t,databaseImages}){
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
          pts.forEach((p,i)=>{entry.measurements[`${label}_P${i+1}_x`]=p.x;entry.measurements[`${label}_P${i+1}_y`]=p.y;});
        }
      });
      ds.push(entry);
    });
    return ds;
  },[databaseImages]);

  const variables=useMemo(()=>{
    if(!dataset.length)return[];
    const v=new Set();
    dataset.forEach(d=>Object.keys(d.measurements).forEach(k=>v.add(k)));
    return[...v].sort();
  },[dataset]);

  const extractVar=useCallback((dataset, variable)=>{
    return dataset.map(c=>c.measurements?.[variable]).filter(v=>typeof v==="number");
  },[]);

  const descriptive=useMemo(()=>{
    if(!variables.length)return[];
    return variables.map(v=>{
      const vals=extractVar(dataset,v);
      if(vals.length<2)return{var:v,n:vals.length,mean:null,sd:null,median:null,min:null,max:null,skewness:null,kurtosis:null,cv:null,sw:null};
      const m0=mean(vals),s=stdev(vals,m0),md=median(vals),min=Math.min(...vals),max=Math.max(...vals);
      return{var:v,n:vals.length,mean:m0,sd:s,median:md,min,max,skewness:vals.length>=3?skewness(vals):null,kurtosis:vals.length>=4?kurtosis(vals):null,cv:coefficientOfVariation(vals),sw:vals.length>=3?shapiroWilk(vals):null};
    });
  },[dataset,variables,extractVar]);

  const grouped=useMemo(()=>{
    const g={};
    dataset.forEach(d=>{const k=d.group||"default";if(!g[k])g[k]=[];g[k].push(d);});
    return g;
  },[dataset]);

  const corrVars=useMemo(()=>{
    return variables.filter(v=>extractVar(dataset,v).filter(x=>x!=null).length>=3).slice(0,12);
  },[dataset,variables,extractVar]);

  const corrMatrix=useMemo(()=>{
    if(corrVars.length<2)return null;
    const varDatasets=corrVars.map(v=>extractVar(dataset,v).filter(x=>x!=null));
    return correlationMatrix(varDatasets);
  },[dataset,corrVars,extractVar]);

  const outlierResult=useMemo(()=>{
    return variables.map(v=>{
      const vals=extractVar(dataset,v);
      return{var:v,outliers:detectOutliers(vals),count:detectOutliers(vals).length};
    });
  },[dataset,variables,extractVar]);

  const ciResult=useMemo(()=>{
    return variables.slice(0,20).map(v=>{
      const vals=extractVar(dataset,v);
      return{var:v,ci:vals.length>=3?confidenceInterval(vals):null};
    });
  },[dataset,variables,extractVar]);

  const regResult=useMemo(()=>{
    if(variables.length<2)return null;
    return{vars:variables.slice(0,12).map(v=>{
      const vals=extractVar(dataset,v);
      return{var:v,vals};
    })};
  },[dataset,variables,extractVar]);

  const tabs=[["overview","Overview"],["descriptive","Descriptive"],["correlation","Correlation"],["outliers","Outliers"],["regression","Regression"],["export","Export"]];

  if(!databaseImages.length)return(<div style={{color:t.tx3,fontSize:12,textAlign:"center",padding:20}}>No images in database. Import images first.</div>);

  return(
    <div style={{maxWidth:"100%",overflow:"hidden"}}>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        <span style={{fontSize:10,color:t.tx2,padding:"4px 0"}}>{databaseImages.length} images · {variables.length} variables</span>
      </div>
      <div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>
        {tabs.map(([id,label])=>(<button key={id} onClick={()=>setTab(id)} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${tab===id?t.acc:t.bdr}`,background:tab===id?t.acc+"18":"transparent",color:tab===id?t.acc:t.tx2,cursor:"pointer",fontSize:10,fontWeight:600,whiteSpace:"nowrap"}}>{label}</button>))}
      </div>

      {tab==="overview"&&(
        <div>
          <table style={{width:"100%",fontSize:10,borderCollapse:"collapse"}}>
            <thead><tr style={{borderBottom:`1px solid ${t.bdr}`}}><th style={{textAlign:"left",padding:6,color:t.tx2}}>Image</th><th style={{textAlign:"right",padding:6,color:t.tx2}}>Markups</th><th style={{textAlign:"right",padding:6,color:t.tx2}}>Group</th><th style={{textAlign:"right",padding:6,color:t.tx2}}>Calibrated?</th></tr></thead>
            <tbody>{databaseImages.map((img,i)=>(<tr key={img.id||i} style={{borderBottom:`1px solid ${t.bdr}44`}}><td style={{padding:6,fontWeight:600}}>{img.name||`Image ${i+1}`}</td><td style={{padding:6,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{(img.markups||[]).length}</td><td style={{padding:6,textAlign:"right"}}>{dataset[i]?.group||"—"}</td><td style={{padding:6,textAlign:"right",color:img.calibration?.done?t.ok:t.tx3}}>{img.calibration?.done?"✓":"No"}</td></tr>))}</tbody>
          </table>
        </div>
      )}

      {tab==="descriptive"&&(
        <div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",fontSize:9,borderCollapse:"collapse"}}>
              <thead><tr style={{borderBottom:`1px solid ${t.bdr}`}}><th style={{textAlign:"left",padding:4,color:t.tx2}}>Variable</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>n</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Mean</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>SD</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Median</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Min</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Max</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>CV%</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Skew</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Kurt</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Shapiro_p</th></tr></thead>
              <tbody>{descriptive.map(r=>(<tr key={r.var} style={{borderBottom:`1px solid ${t.bdr}44`}}><td style={{padding:4,fontWeight:600,color:t.tx}}>{r.var}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{r.n}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{r.mean!==null?r.mean.toFixed(3):"—"}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{r.sd!==null?r.sd.toFixed(3):"—"}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace",color:t.acc}}>{r.median!==null?r.median.toFixed(3):"—"}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{r.min!==null?r.min.toFixed(2):"—"}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{r.max!==null?r.max.toFixed(2):"—"}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{r.cv!==null?r.cv.toFixed(2):"—"}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{r.skewness!==null?r.skewness.toFixed(3):"—"}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{r.kurtosis!==null?r.kurtosis.toFixed(3):"—"}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{r.sw?r.sw.pValue.toFixed(4):"—"}</td></tr>))}</tbody>
            </table>
          </div>
          <div style={{marginTop:12,padding:12,border:`1px solid ${t.bdr}`,borderRadius:8}}>
            <div style={{fontSize:10,fontWeight:700,color:t.tx2,marginBottom:8}}>Group Statistics</div>
            {Object.entries(grouped).map(([g,cases])=>{
              const vals=extractVar(cases,descriptive[0]?.var);
              const m0=mean(vals),s=stdev(vals,m0);
              return(<div key={g} style={{marginBottom:6,fontSize:10}}><span style={{color:t.tx2}}>{g}</span><span style={{float:"right",fontFamily:"'DM Mono',monospace"}}>n={vals.length} · mean={m0?.toFixed(2)}</span></div>);
            })}
          </div>
        </div>
      )}

      {tab==="correlation"&&corrMatrix&&corrVars.length>=2&&(
        <div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",fontSize:8,borderCollapse:"collapse"}}>
              <thead><tr><th style={{padding:3,color:t.tx2}}></th>{corrVars.map(v=><th key={v} style={{padding:3,color:t.acc,fontFamily:"'DM Mono',monospace",writingMode:"vertical-lr",textAlign:"left",height:80}}>{v}</th>)}</tr></thead>
              <tbody>{corrMatrix.map((row,i)=>(<tr key={i}><td style={{padding:3,fontWeight:600,fontSize:9,color:t.tx,whiteSpace:"nowrap"}}>{corrVars[i]}</td>{row.map((v,j)=>{
                const abs=v!=null?Math.abs(v):0;let bg="transparent",clr=t.tx3;
                if(v!=null){if(v>0){clr=t.acc;bg=`rgba(59,130,246,${(abs*0.3).toFixed(2)})`;}else{clr=t.err;bg=`rgba(239,68,68,${(abs*0.3).toFixed(2)})`;}}
                return <td key={j} style={{padding:3,textAlign:"center",fontFamily:"'DM Mono',monospace",background:bg,color:clr,fontSize:8}}>{v!=null?v.toFixed(2):"-"}</td>;
              })}</tr>))}</tbody>
            </table>
          </div>
          {corrModalOpen&&corrCanvasRef.current&&(
            <div style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setCorrModalOpen(false)}>
              <canvas ref={corrCanvasRef} style={{maxWidth:"90vw",maxHeight:"90vh"}}/>
            </div>
          )}
        </div>
      )}

      {tab==="outliers"&&(
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",fontSize:9,borderCollapse:"collapse"}}>
            <thead><tr style={{borderBottom:`1px solid ${t.bdr}`}}><th style={{textAlign:"left",padding:4,color:t.tx2}}>Variable</th><th style={{textAlign:"right",padding:4,color:t.tx2}}>Outliers</th><th style={{textAlign:"left",padding:4,color:t.tx2}}>Values</th></tr></thead>
            <tbody>{outlierResult.filter(r=>r.count>0).map(r=>(<tr key={r.var} style={{borderBottom:`1px solid ${t.bdr}44`}}><td style={{padding:4,fontWeight:600,color:t.tx}}>{r.var}</td><td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace",color:t.err}}>{r.count}</td><td style={{padding:4,fontFamily:"'DM Mono',monospace",fontSize:8,color:t.tx3}}>{r.outliers.slice(0,5).map(o=>o.toFixed(2)).join(", ")}{r.outliers.length>5?", …":""}</td></tr>))}</tbody>
          </table>
        </div>
      )}

      {tab==="regression"&&regResult&&(
        <div>
          <div style={{fontSize:11,fontWeight:700,color:t.tx,marginBottom:6}}>Linear Regression Summary</div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",fontSize:9,borderCollapse:"collapse"}}>
              <thead><tr style={{borderBottom:`1px solid ${t.bdr}`}}><th style={{textAlign:"left",padding:4,color:t.tx2}}>X / Y</th>{regResult.vars.map(v=><th key={v.var} style={{textAlign:"right",padding:4,color:t.tx2}}>{v.var}</th>)}</tr></thead>
              <tbody>{regResult.vars.map(xv=>{
                const row=[<td key="label" style={{padding:4,fontWeight:600,color:t.tx}}>{xv.var}</td>];
                regResult.vars.forEach(yv=>{
                  if(xv.var===yv.var){row.push(<td key={yv.var} style={{padding:4,textAlign:"center",color:t.tx3}}>—</td>);return;}
                  const reg=linearRegression(xv.vals,yv.vals);
                  row.push(<td key={yv.var} style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:8}}>{reg?`R²=${reg.r2.toFixed(3)}`:""}</td>);
                });
                return <tr key={xv.var} style={{borderBottom:`1px solid ${t.bdr}44`}}>{row}</tr>;
              })}</tbody>
            </table>
          </div>
        </div>
      )}

      {tab==="export"&&(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <button onClick={()=>{
            const vars=variables;const rows=[["Image","Group","Timepoint","Operator",...vars]];
            dataset.forEach(d=>{rows.push([d.id,d.group,d.timepoint,d.operator,...vars.map(v=>d.measurements[v]??"")]);});
            const csv=rows.map(r=>r.map(c=>`"${String(c??"").replace(/"/g,'""')}"`).join(",")).join("\n");
            const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="database_descriptive.csv";a.click();
          }} style={{padding:"8px 12px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf2,color:t.tx,cursor:"pointer",fontSize:11}}>⬇ Full dataset (.csv)</button>
          <button onClick={()=>{
            const rows=[["Image","Landmark","X","Y"]];
            databaseImages.forEach((img,i)=>{(img.markups||[]).filter(m=>m.type==="point").forEach(m=>{(m.points||[]).forEach(p=>{rows.push([img.name||`Image ${i+1}`,m.label||"point",p.x,p.y]);});});});
            const csv=rows.map(r=>r.map(c=>`"${String(c??"").replace(/"/g,'""')}"`).join(",")).join("\n");
            const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="database_landmark_coordinates.csv";a.click();
          }} style={{padding:"8px 12px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf2,color:t.tx,cursor:"pointer",fontSize:11}}>⬇ Landmark coordinates (.csv)</button>
          <button onClick={()=>{
            const vars=variables;const rows=[["Image","Group",...vars]];
            dataset.forEach(d=>{rows.push([d.id,d.group,...vars.map(v=>d.measurements[v]??"")]);});
            const csv=rows.map(r=>r.map(c=>`"${String(c??"").replace(/"/g,'""')}"`).join(",")).join("\n");
            const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="database_all_measurements.csv";a.click();
          }} style={{padding:"8px 12px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf2,color:t.tx,cursor:"pointer",fontSize:11}}>⬇ All measurements (.csv)</button>
        </div>
      )}
    </div>
  );
}
