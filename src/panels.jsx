// ═══════════════════════════════════════════════════════════════════════════════
// PANELS - Side panel components
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from "react";
import { uid, vpts, computeMeasurements, normDeviation, deviationColor, mean, stdev, calculateICC, dahlbergError, blandAltman, tTestPaired } from "./utils.js";
import { PREDEFINED, LUT_PRESETS } from "./constants.js";
import { Btn, Tag, Sld, PropRow, Inp, Divider, PanelHeader } from "./ui.jsx";
import { KatexSpan, LatexFloatingPanel } from "./hooks.jsx";

// ═══════════════════════════════════════════════════════════════════════════════
// MARKUPS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
export function MarkupsPanel({markups,t,theme,selectedId,onSelect,onDelete,onToggleVisible,onToggleLock,calibration,placingMode,placingQueue,placingIdx,onStopPlacing,onPausePlacing,onResumePlacing,onClear,onAddPoint,norms,formatAngle,angleMode,setAngleMode}){
  const[collapsed,setCollapsed]=useState({});
  const[showClearConfirm,setShowClearConfirm]=useState(false);
  const[sign,unit]=angleMode?.split("-")||["signed","deg"];
  const sections=[
    {id:"point",label:"Landmarks",types:["point"],icon:"◉",color:t.acc},
    {id:"line",label:"Lines & Planes",types:["line","parallel","ruler"],icon:"⟋",color:"#38bdf8"},
    {id:"angle",label:"Angles",types:["angle3","angle4"],icon:"∠",color:"#f472b6"},
    {id:"curve",label:"Open Curves",types:["curve"],icon:"∿",color:"#fb923c"},
    {id:"polygon",label:"Polygons",types:["polygon"],icon:"⬡",color:"#4ade80"},
    {id:"other",label:"Measurements",types:["perp"],icon:"⊥",color:"#a78bfa"},
    {id:"annotation",label:"Annotations",types:["arrow","text"],icon:"📝",color:"#fbbf24"},
  ];
  const toggle=id=>setCollapsed(c=>({...c,[id]:!c[id]}));

  const handleClear=()=>{
    if(markups.length===0){
      setShowClearConfirm(false);
      return;
    }
    setShowClearConfirm(true);
  };

  const confirmClear=()=>{
    onClear();
    setShowClearConfirm(false);
  };

  return(
    <div>
      {showClearConfirm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
          <div style={{background:t.surf,border:`1px solid ${t.bdr}`,borderRadius:12,padding:24,maxWidth:320}}>
            <div style={{fontSize:14,fontWeight:600,color:t.tx,marginBottom:8}}>Clear All Markups?</div>
            <div style={{fontSize:12,color:t.tx2,marginBottom:20}}>This will remove all {markups.length} markups from the workspace. This action cannot be undone.</div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <Btn t={t} small onClick={()=>setShowClearConfirm(false)}>Cancel</Btn>
              <Btn t={t} small danger onClick={confirmClear}>Clear All</Btn>
            </div>
          </div>
        </div>
      )}
      <div style={{padding:"8px 10px",display:"flex",gap:4,borderBottom:`1px solid ${t.bdr}`,flexShrink:0,flexWrap:"nowrap",overflowX:"auto"}}>
        <Btn t={t} small onClick={onAddPoint} style={{whiteSpace:"nowrap",flexShrink:0}}>+ Point</Btn>
        {!placingMode&&placingQueue.length===0&&<Btn t={t} small onClick={onResumePlacing} style={{whiteSpace:"nowrap",flexShrink:0}}>▶ Start</Btn>}
        {!placingMode&&placingQueue.length>0&&<Btn t={t} small onClick={onResumePlacing} style={{whiteSpace:"nowrap",flexShrink:0}}>▶ Resume</Btn>}
        {placingMode&&<Btn t={t} small onClick={onPausePlacing} style={{whiteSpace:"nowrap",flexShrink:0,background:t.warn+"22",color:t.warn,border:`1px solid ${t.warn}`}}>⏸</Btn>}
        {(placingMode||placingQueue.length>0)&&<Btn t={t} small danger onClick={onStopPlacing} style={{whiteSpace:"nowrap",flexShrink:0}}>⏹ End</Btn>}
        <Btn t={t} small danger onClick={handleClear} style={{whiteSpace:"nowrap",flexShrink:0}}>Clear</Btn>
      </div>
      <div style={{padding:"8px 10px",display:"flex",gap:4,borderBottom:`1px solid ${t.bdr}`,flexShrink:0,flexWrap:"nowrap",overflowX:"auto",alignItems:"center"}}>
        <span style={{fontSize:10,color:t.tx2,flexShrink:0}}>∠</span>
        <button onClick={()=>setAngleMode(`${sign}-${unit==="deg"?"rad":"deg"}`)} style={{padding:"2px 6px",fontSize:10,border:`1px solid ${t.bdr}`,borderRadius:4,background:unit==="deg"?t.acc:"transparent",color:unit==="deg"?(theme==="light"?"#fff":t.bg):t.tx,cursor:"pointer",fontWeight:600,fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0}}>{unit==="deg"?"°":"rad"}</button>
        <select value={sign} onChange={e=>setAngleMode(`${e.target.value}-${unit}`)} style={{background:t.surf2,border:`1px solid ${t.bdr}`,borderRadius:4,padding:"2px 4px",color:t.tx,fontSize:10,fontFamily:"inherit",cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
          <option value="signed">signed</option>
          <option value="abs">abs</option>
          <option value="simple">simple</option>
          <option value="reflex">reflex</option>
        </select>
      </div>
      {sections.map(sec=>{
        const items=markups.filter(m=>sec.types.includes(m.type));
        if(items.length===0)return null;
        const isCollapsed=collapsed[sec.id];
        return(
          <div key={sec.id}>
            <div onClick={()=>toggle(sec.id)} style={{padding:"6px 10px",display:"flex",alignItems:"center",gap:6,cursor:"pointer",background:t.surf2,borderBottom:`1px solid ${t.bdr}`,borderTop:`1px solid ${t.bdr}`,userSelect:"none"}}>
              <span style={{color:sec.color,fontSize:12}}>{sec.icon}</span>
              <span style={{fontSize:11,fontWeight:700,color:t.tx,flex:1,textTransform:"uppercase",letterSpacing:0.5}}>{sec.label}</span>
              <span style={{fontSize:10,color:t.tx3,fontFamily:"'DM Mono',monospace"}}>{items.length}</span>
              <span style={{color:t.tx3,fontSize:10,transition:"transform 0.15s",transform:isCollapsed?"rotate(-90deg)":"rotate(0deg)"}}>▾</span>
            </div>
            {!isCollapsed&&items.map(m=>{
              const meas=computeMeasurements(m,calibration);
              const ms=Object.entries(meas).map(([k,v])=>k==="angle"?formatAngle(v):v.toFixed(1)+(k==="area"?" mm²":" mm")).join("  ");
              const isHidden=m.visible===false,isPlacing=placingMode&&placingQueue[placingIdx]===m.id,isLocked=m.locked;
              const unplaced=m.type==="point"&&!m.placed;
              const relNorms=(norms||[]).filter(n=>n.markupLabel===m.label);
              return(
                <div key={m.id} style={{borderBottom:`1px solid ${t.bdr+"66"}`,background:isPlacing?t.acc+"11":selectedId===m.id?t.accMuted:"transparent"}}>
                  <div style={{padding:"5px 10px",display:"flex",alignItems:"center",gap:6}}>
                    <button onClick={()=>onToggleVisible(m.id)} style={{background:"none",border:"none",cursor:"pointer",padding:2,flexShrink:0}} title={isHidden?"Show":"Hide"}>
                      <div style={{width:10,height:10,borderRadius:"50%",background:isHidden?"transparent":m.color||m.strokeColor||t.acc,border:`2px solid ${m.color||m.strokeColor||t.acc}`,opacity:isHidden?0.35:1,transition:"all 0.15s"}}/>
                    </button>
                    <button onClick={()=>onToggleLock(m.id)} style={{background:"none",border:"none",cursor:"pointer",padding:2,flexShrink:0}} title={isLocked?"Unlock":"Lock"}>
                      <span style={{fontSize:11,color:isLocked?t.warn:t.tx3}}>{isLocked?"🔒":"🔓"}</span>
                    </button>
                    <div onClick={()=>onSelect(m.id===selectedId?null:m.id)} style={{flex:1,minWidth:0,cursor:"pointer"}}>
                      <div style={{fontSize:12,fontWeight:600,color:isHidden?t.tx3:t.tx,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                        {isPlacing&&<span style={{color:t.warn,marginRight:4}}>📍</span>}
                        {unplaced&&!isPlacing&&<span style={{color:t.tx3,marginRight:4}}>○</span>}
                        {m.label||m.type}
                        {m.type==="curve"&&m.curveStyle==="bspline"&&<span style={{fontSize:9,color:t.tx3,marginLeft:4}}>[spline]</span>}
                        {m.type==="polygon"&&m.curveStyle==="bspline"&&<span style={{fontSize:9,color:t.tx3,marginLeft:4}}>[spline]</span>}
                        {m.type==="text"&&m.text&&<span style={{fontSize:9,color:t.tx3,marginLeft:4}}>"{m.text.slice(0,15)}{m.text.length>15?"…":""}"</span>}
                        {m.type==="arrow"&&<span style={{fontSize:9,color:t.tx3,marginLeft:4}}>→</span>}
                        {isLocked&&<span style={{fontSize:9,color:t.warn,marginLeft:4}}>[locked]</span>}
                      </div>
                      {ms&&!isHidden&&<div style={{fontSize:10,color:t.acc,fontFamily:"'DM Mono',monospace"}}>{ms}</div>}
                      {relNorms.length>0&&!isHidden&&ms&&<NormBadges norms={relNorms} meas={meas} t={t}/>}
                    </div>
                    <button onClick={()=>onDelete(m.id)} style={{background:"none",border:"none",color:t.tx3,cursor:"pointer",fontSize:14,flexShrink:0}}>×</button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      {markups.length===0&&<div style={{padding:24,textAlign:"center",color:t.tx3,fontSize:12}}>No markups yet.<br/>Select a tool and click on the image.</div>}
    </div>
  );
}

function NormBadges({norms,meas,t}){
  return(
    <div style={{display:"flex",flexWrap:"wrap",gap:3,marginTop:2}}>
      {norms.map(n=>{
        const val=meas[n.measureType];if(val===undefined)return null;
        const dev=normDeviation(val,n);const col=deviationColor(dev.sdUnits,t);
        return(<span key={n.id} style={{background:col+"22",color:col,border:`1px solid ${col}44`,borderRadius:3,padding:"0px 4px",fontSize:9,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>
          {dev.sdUnits>0?"+":""}{dev.sdUnits.toFixed(1)}SD
        </span>);
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEASUREMENTS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
export function MeasurementsPanel({allMeas,t,calibration,norms,onUpdateNorms,onExportCSV,onOpenCalib,formatAngle}){
  const[editingNorm,setEditingNorm]=useState(null);
  return(
    <div style={{padding:12}}>
      {!calibration.done&&<div style={{background:t.warn+"22",border:`1px solid ${t.warn}44`,borderRadius:8,padding:12,marginBottom:12,fontSize:12,color:t.warn}}>⚠ Calibrate for mm values.<button onClick={onOpenCalib} style={{display:"block",marginTop:6,background:t.warn,color:"#000",border:"none",borderRadius:4,padding:"3px 8px",cursor:"pointer",fontSize:11,fontWeight:700}}>Open Calibration</button></div>}
      {calibration.done&&<div style={{background:t.ok+"11",border:`1px solid ${t.ok}33`,borderRadius:6,padding:8,marginBottom:10,fontSize:11,color:t.ok,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span>⟺ {calibration.pxPerMm.toFixed(3)} px/mm</span><button onClick={onOpenCalib} style={{background:"none",border:`1px solid ${t.ok}55`,color:t.ok,borderRadius:4,padding:"2px 8px",cursor:"pointer",fontSize:10}}>Edit</button>
      </div>}

      {allMeas.length===0?<div style={{color:t.tx3,fontSize:12,textAlign:"center",paddingTop:20}}>Place lines, angles, or polygons.</div>
        :allMeas.map(({m,meas})=>{
          const relNorms=(norms||[]).filter(n=>n.markupLabel===m.label);
          return(
            <div key={m.id} style={{marginBottom:10,padding:10,background:t.surf2,borderRadius:8,border:`1px solid ${t.bdr}`}}>
              <div style={{fontSize:12,fontWeight:700,color:m.color||t.acc,marginBottom:6,display:"flex",justifyContent:"space-between"}}><span>{m.label||m.type}</span><Tag color={m.color||t.acc}>{m.type}</Tag></div>
              {Object.entries(meas).map(([k,v])=>{
                const norm=relNorms.find(n=>n.measureType===k);const dev=norm?normDeviation(v,norm):null;
                return(
                  <div key={k} style={{marginBottom:dev?10:4}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:t.tx2,alignItems:"center"}}>
                      <span>{k}</span>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                         <span style={{fontFamily:"'DM Mono',monospace",color:t.tx,fontWeight:600}}>{k==="angle"?formatAngle(v):v.toFixed(2)+(k==="area"?" mm²":" mm")}</span>
                        <button onClick={()=>setEditingNorm({markupLabel:m.label,measureType:k,existing:norm})}
                          style={{background:"none",border:`1px solid ${norm?t.ok+"55":t.bdr}`,color:norm?t.ok:t.tx3,borderRadius:3,padding:"0 4px",cursor:"pointer",fontSize:9,fontWeight:700,lineHeight:"16px"}}>
                          {norm?"N":"±N"}
                        </button>
                      </div>
                    </div>
                    {dev&&<div style={{marginTop:4,padding:"5px 8px",borderRadius:5,background:deviationColor(dev.sdUnits,t)+"18",border:`1px solid ${deviationColor(dev.sdUnits,t)}44`}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:10}}>
                        <span style={{color:t.tx2}}>Norm: {norm.mean} ± {norm.sd}</span>
                        <span style={{fontWeight:700,color:deviationColor(dev.sdUnits,t)}}>{dev.delta>0?"+":""}{dev.delta.toFixed(2)} ({dev.sdUnits>0?"+":""}{dev.sdUnits.toFixed(1)} SD)</span>
                      </div>
                      {norm.source&&<div style={{fontSize:9,color:t.tx3,marginTop:2}}>{norm.source}</div>}
                    </div>}
                  </div>
                );
              })}
            </div>
          );
        })}

      {editingNorm&&<InlineNormEditor t={t} {...editingNorm} onSave={(n)=>{const filtered=(norms||[]).filter(x=>!(x.markupLabel===editingNorm.markupLabel&&x.measureType===editingNorm.measureType));onUpdateNorms([...filtered,{id:editingNorm.existing?.id||uid(),...n}]);setEditingNorm(null);}} onDelete={()=>{onUpdateNorms((norms||[]).filter(x=>!(x.markupLabel===editingNorm.markupLabel&&x.measureType===editingNorm.measureType)));setEditingNorm(null);}} onClose={()=>setEditingNorm(null)}/>}

      {allMeas.length>0&&<Btn t={t} small onClick={onExportCSV} style={{width:"100%",marginTop:8}}>⬇ Export CSV</Btn>}
    </div>
  );
}

function InlineNormEditor({t,markupLabel,measureType,existing,onSave,onDelete,onClose}){
  const[mean,setMean]=useState(String(existing?.mean||""));const[sd,setSd]=useState(String(existing?.sd||""));const[source,setSource]=useState(existing?.source||"");
  return(
    <div style={{background:t.surf3,border:`1px solid ${t.bdr}`,borderRadius:8,padding:12,marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:700,color:t.acc,marginBottom:8}}>Norm for {markupLabel} · {measureType}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
        <div><div style={{fontSize:10,color:t.tx2,marginBottom:2}}>Mean</div><Inp value={mean} onChange={setMean} t={t} type="number" placeholder="e.g. 82"/></div>
        <div><div style={{fontSize:10,color:t.tx2,marginBottom:2}}>SD</div><Inp value={sd} onChange={setSd} t={t} type="number" placeholder="e.g. 3"/></div>
      </div>
      <div style={{marginBottom:8}}><div style={{fontSize:10,color:t.tx2,marginBottom:2}}>Source</div><Inp value={source} onChange={setSource} t={t} placeholder="e.g. Steiner 1953, Caucasian adults"/></div>
      <div style={{display:"flex",gap:6}}>
        <Btn t={t} small onClick={()=>onSave({markupLabel,measureType,mean:parseFloat(mean),sd:parseFloat(sd),source})} disabled={!mean||!sd} style={{flex:1}}>Save</Btn>
        {existing&&<Btn t={t} small danger onClick={onDelete}>Del</Btn>}
        <Btn t={t} small onClick={onClose}>✕</Btn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORMULAS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
export function FormulasPanel({formulas,t,scope,onAdd,onEdit,onDelete}){
  const[bigLatex,setBigLatex]=useState(null);
  return(
    <div style={{padding:12}}>
      <PanelHeader t={t}>Custom Formulas</PanelHeader>
      <div style={{fontSize:11,color:t.tx2,marginBottom:12,lineHeight:1.5}}>Define derived measurements. Variables use landmark label names.</div>
      {formulas.map(f=>{
        const val=evalFormula(f.expression,scope);
        return(
          <div key={f.id} style={{marginBottom:10,padding:10,background:t.surf2,borderRadius:8,border:`1px solid ${t.bdr}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <div><div style={{fontSize:12,fontWeight:700,color:t.acc}}>{f.name}</div>{f.unit&&<div style={{fontSize:10,color:t.tx3}}>{f.unit}</div>}</div>
              <div style={{display:"flex",gap:4}}><button onClick={()=>onEdit(f.id)} style={{background:"none",border:`1px solid ${t.bdr}`,color:t.tx2,borderRadius:4,padding:"2px 6px",cursor:"pointer",fontSize:10}}>Edit</button><button onClick={()=>onDelete(f.id)} style={{background:"none",border:"none",color:t.tx3,cursor:"pointer",fontSize:14}}>×</button></div>
            </div>
            {f.latex&&<div onClick={()=>setBigLatex(f.latex)} style={{background:t.surf3,borderRadius:4,padding:"6px 10px",marginBottom:8,cursor:"pointer",border:`1px solid ${t.bdr}`,minHeight:28,display:"flex",alignItems:"center"}}>
              <KatexSpan latex={f.latex} block={false} fontSize={10}/>
              <span style={{fontSize:9,color:t.tx3,marginLeft:"auto",paddingLeft:8}}>click to enlarge</span>
            </div>}
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}>
              <span style={{color:t.tx2}}>Result</span>
              <span style={{fontFamily:"'DM Mono',monospace",fontWeight:700,color:val!==null?t.acc:t.err}}>{val!==null?`${val.toFixed(2)} ${f.unit||""}`:"N/A"}</span>
            </div>
          </div>
        );
      })}
      <Btn t={t} small onClick={onAdd} style={{width:"100%",marginTop:4}}>+ New Formula</Btn>
      {bigLatex&&<LatexFloatingPanel latex={bigLatex} onClose={()=>setBigLatex(null)}/>}
    </div>
  );
}

import { evalFormula } from "./utils.js";

// ═══════════════════════════════════════════════════════════════════════════════
// IMAGE PANEL
// ═══════════════════════════════════════════════════════════════════════════════
export function ImagePanel({t,processing,setProcessing,lutMode,setLutMode,lutInvert,setLutInvert,showLUT,setShowLUT,showScaleBar,setShowScaleBar,calibration,onOpenCalib,onReset,onShowHist,showHistogram}){
  return(
    <div style={{padding:12}}>
      <PanelHeader t={t}>Window & Level</PanelHeader>
      <Sld label="W Center" value={processing.windowCenter} min={0} max={255} onChange={v=>{const p={...processing,windowCenter:v};setProcessing(p);}} t={t}/>
      <Sld label="W Width" value={processing.windowWidth} min={0} max={255} onChange={v=>{const p={...processing,windowWidth:v};setProcessing(p);}} t={t}/>
      <Divider t={t}/>
      <PanelHeader t={t}>Brightness & Contrast</PanelHeader>
      <Sld label="Brightness" value={processing.brightness} min={-128} max={128} onChange={v=>{const p={...processing,brightness:v};setProcessing(p);}} t={t}/>
      <Sld label="Contrast" value={processing.contrast} min={-100} max={200} onChange={v=>{const p={...processing,contrast:v};setProcessing(p);}} t={t} unit="%"/>
      <Sld label="Edge Enhance" value={processing.edgeEnhance} min={0} max={100} onChange={v=>{const p={...processing,edgeEnhance:v};setProcessing(p);}} t={t} unit="%"/>
      <div style={{display:"flex",gap:6,marginBottom:4}}><Btn t={t} small onClick={onReset} style={{flex:1}}>↺ Reset</Btn><Btn t={t} small active={showHistogram} onClick={onShowHist} style={{flex:1}}>▦ Histogram</Btn></div>
      <Divider t={t}/>
      <PanelHeader t={t}>LUT Colorization</PanelHeader>
      <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
        <Btn t={t} small active={showLUT} onClick={()=>setShowLUT(v=>!v)}>Legend</Btn>
        <Btn t={t} small active={lutInvert} onClick={()=>setLutInvert(v=>!v)}>⇅ Invert</Btn>
        <Btn t={t} small onClick={()=>{setLutMode("gray");setLutInvert(false);}}>Revert</Btn>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:4}}>
        {LUT_PRESETS.map(lut=>(
          <button key={lut.id} onClick={()=>setLutMode(lut.id)}
            style={{padding:"6px 8px",borderRadius:6,border:`1px solid ${lutMode===lut.id?t.acc:t.bdr}`,background:lutMode===lut.id?t.accMuted:t.surf2,cursor:"pointer",fontSize:11,color:lutMode===lut.id?t.acc:t.tx,fontWeight:lutMode===lut.id?700:400}}>
            <div style={{height:8,borderRadius:2,marginBottom:4,background:`linear-gradient(90deg,${(lutInvert?[...lut.stops].reverse():lut.stops).join(",")})`}}/>
            {lut.name}
          </button>
        ))}
      </div>
      <Divider t={t}/>
      <PanelHeader t={t}>Scale & Calibration</PanelHeader>
      {calibration.done?<div style={{fontSize:12,color:t.ok,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span>⟺ {calibration.pxPerMm.toFixed(3)} px/mm</span><button onClick={onOpenCalib} style={{background:"none",border:`1px solid ${t.ok}55`,color:t.ok,borderRadius:4,padding:"2px 8px",cursor:"pointer",fontSize:10}}>Edit</button></div>:<div style={{fontSize:12,color:t.tx2,marginBottom:8}}>Not calibrated. Use ruler tool (R).</div>}
      <Btn t={t} small active={showScaleBar} onClick={()=>setShowScaleBar(v=>!v)}>On-Screen Scale Bar</Btn>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYERS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
export function LayersPanel({t,images,onUpdateImages,onAddImage,showDisplacement,setShowDisplacement,compareVersionId,setCompareVersionId,versions,onShowAlign,onShowTransform}){
  const updImg=(id,patch)=>onUpdateImages(images.map(i=>i.id===id?{...i,...patch}:i));
  const move=(idx,dir)=>{const imgs=[...images];[imgs[idx],imgs[idx+dir]]=[imgs[idx+dir],imgs[idx]];onUpdateImages(imgs);};
  const SCOLS=["none","#3b82f6","#ef4444","#22c55e","#f59e0b","#a855f7"];
  return(
    <div style={{padding:12}}>
      <PanelHeader t={t}>Image Stack ({images.length})</PanelHeader>
      <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
        <Btn t={t} small active={showDisplacement} onClick={()=>setShowDisplacement(v=>!v)}>⇝ Displacement</Btn>
        <Btn t={t} small onClick={onShowAlign}>⊕ Align</Btn>
        <Btn t={t} small onClick={onShowTransform}>⟲ Transform</Btn>
      </div>
      {versions.length>1&&<div style={{marginBottom:10}}>
        <div style={{fontSize:10,color:t.tx2,marginBottom:4}}>Compare landmarks with:</div>
        <select value={compareVersionId||""} onChange={e=>setCompareVersionId(e.target.value||null)} style={{width:"100%",background:t.surf3,border:`1px solid ${t.bdr}`,borderRadius:4,padding:"4px 8px",color:t.tx,fontSize:12,fontFamily:"inherit"}}>
          <option value="">— None —</option>
          {versions.map(v=><option key={v.id} value={v.id}>{v.label}: {v.name}</option>)}
        </select>
      </div>}
      {images.length===0&&<div style={{color:t.tx3,fontSize:12}}>No images loaded.</div>}
      {images.map((img,idx)=>(
        <div key={img.id} style={{marginBottom:10,border:`1px solid ${t.bdr}`,borderRadius:8,padding:10,background:t.surf2}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
            <button onClick={()=>updImg(img.id,{visible:!img.visible})} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:img.visible?t.acc:t.tx3}}>{img.visible?"◎":"○"}</button>
            <span style={{flex:1,fontSize:12,fontWeight:600,color:t.tx,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{img.name||`Img ${idx+1}`}</span>
            <div style={{display:"flex",gap:2}}>
              {idx>0&&<button onClick={()=>move(idx,-1)} style={{background:"none",border:`1px solid ${t.bdr}`,color:t.tx2,borderRadius:3,padding:"1px 4px",cursor:"pointer",fontSize:10}}>↑</button>}
              {idx<images.length-1&&<button onClick={()=>move(idx,1)} style={{background:"none",border:`1px solid ${t.bdr}`,color:t.tx2,borderRadius:3,padding:"1px 4px",cursor:"pointer",fontSize:10}}>↓</button>}
            </div>
            <button onClick={()=>onUpdateImages(images.filter(i=>i.id!==img.id))} style={{background:"none",border:"none",color:t.tx3,cursor:"pointer",fontSize:14}}>×</button>
          </div>
          <Sld label="Opacity" value={Math.round((img.opacity||1)*100)} min={0} max={100} onChange={v=>updImg(img.id,{opacity:v/100})} t={t} unit="%"/>
          <div style={{marginBottom:6}}>
            <div style={{fontSize:10,color:t.tx2,marginBottom:3}}>Blend mode</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:3}}>{["normal","multiply","screen","overlay","difference","luminosity"].map(bm=>(<button key={bm} onClick={()=>updImg(img.id,{blendMode:bm})} style={{padding:"2px 4px",fontSize:9,border:`1px solid ${t.bdr}`,borderRadius:4,background:img.blendMode===bm?t.acc:t.surf3,color:img.blendMode===bm?(t.id==="light"?"#fff":t.bg):t.tx2,cursor:"pointer",fontWeight:600}}>{bm}</button>))}</div>
          </div>
          <div style={{marginBottom:6}}>
            <div style={{fontSize:10,color:t.tx2,marginBottom:3}}>Serial color</div>
            <div style={{display:"flex",gap:4}}>{SCOLS.map(c=>(<button key={c} onClick={()=>updImg(img.id,{color:c})} style={{width:20,height:20,borderRadius:4,background:c==="none"?"transparent":c,border:`2px solid ${img.color===c?t.acc:t.bdr}`,cursor:"pointer",fontSize:8,color:t.tx3,display:"flex",alignItems:"center",justifyContent:"center"}}>{c==="none"?"✕":""}</button>))}</div>
          </div>
          <div style={{display:"flex",gap:4}}>
            {["X","Y"].map((ax,ai)=>(<div key={ax} style={{flex:1}}><div style={{fontSize:9,color:t.tx3,marginBottom:2}}>{ax} offset</div><input type="number" value={ai===0?img.dx||0:img.dy||0} onChange={e=>updImg(img.id,{[ai===0?"dx":"dy"]:+e.target.value})} style={{width:"100%",background:t.surf3,border:`1px solid ${t.bdr}`,borderRadius:4,padding:"3px 5px",color:t.tx,fontSize:11,fontFamily:"'DM Mono',monospace",boxSizing:"border-box"}}/></div>))}
            <button onClick={()=>updImg(img.id,{dx:0,dy:0})} style={{alignSelf:"flex-end",background:"none",border:`1px solid ${t.bdr}`,color:t.tx2,borderRadius:4,padding:"3px 5px",cursor:"pointer",fontSize:10,height:24}}>⊙</button>
          </div>
        </div>
      ))}
      <label style={{cursor:"pointer",display:"block"}} onChange={onAddImage}><input type="file" accept="image/*" style={{display:"none"}}/><div style={{border:`2px dashed ${t.bdr}`,borderRadius:8,padding:12,textAlign:"center",color:t.tx2,fontSize:12,cursor:"pointer"}}>+ Add to stack</div></label>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERSIONS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
export function VersionsPanel({project,t,onUpdateProject,onUpdateVersion,onExportTemplate}){
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

function mkVersion(label,name){
  return{id:uid(),label,name,timestamp:Date.now(),markups:[],formulas:[],norms:[],processing:{brightness:0,contrast:0,windowWidth:0,windowCenter:128,edgeEnhance:0},lutMode:"gray",lutInvert:false,calibration:{done:false,pxPerMm:1,knownMm:""}};
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKUP PROPERTIES
// ═══════════════════════════════════════════════════════════════════════════════
export function MarkupProps({m,t,theme,onUpdate,onDelete,calibration,onParallel,formatAngle}){
  const meas=computeMeasurements(m,calibration);
  return(
    <div>
      <div style={{fontWeight:700,fontSize:12,color:t.tx,marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span>Properties</span><Btn t={t} small danger onClick={onDelete}>Delete</Btn></div>
      <PropRow label="Label" t={t}><Inp value={m.label||""} onChange={v=>onUpdate({label:v})} t={t}/></PropRow>
      {m.type==="point"&&<><PropRow label="Definition" t={t}><Inp value={m.definition||""} onChange={v=>onUpdate({definition:v})} t={t}/></PropRow><PropRow label="Size" t={t}><input type="range" min="3" max="14" value={m.size||6} onChange={e=>onUpdate({size:+e.target.value})} style={{width:"100%",accentColor:t.acc}}/></PropRow></>}
      {m.type==="text"&&<><PropRow label="Text" t={t}><Inp value={m.text||""} onChange={v=>onUpdate({text:v})} t={t}/></PropRow><PropRow label="Size" t={t}><input type="range" min="8" max="48" value={m.fontSize||14} onChange={e=>onUpdate({fontSize:+e.target.value})} style={{width:"100%",accentColor:t.acc}}/></PropRow><PropRow label="Bold" t={t}><input type="checkbox" checked={!!m.bold} onChange={e=>onUpdate({bold:e.target.checked})} style={{accentColor:t.acc}}/></PropRow></>}
      {(m.type==="curve"||m.type==="polygon")&&<PropRow label="Dash" t={t}><select value={m.style||"solid"} onChange={e=>onUpdate({style:e.target.value})} style={{background:t.surf3,border:`1px solid ${t.bdr}`,borderRadius:4,padding:"3px 6px",color:t.tx,fontSize:12,width:"100%",fontFamily:"inherit"}}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></PropRow>}
      {(m.type==="curve"||m.type==="polygon")&&<PropRow label="Style" t={t}><div style={{display:"flex",gap:4}}>{["linear","bspline"].map(s=><button key={s} onClick={()=>onUpdate({curveStyle:s})} style={{padding:"2px 8px",fontSize:10,border:`1px solid ${t.bdr}`,borderRadius:4,background:m.curveStyle===s?t.acc:"transparent",color:m.curveStyle===s?(theme==="light"?"#fff":t.bg):t.tx,cursor:"pointer",fontWeight:600}}>{s==="linear"?"Linear":"B-Spline"}</button>)}</div></PropRow>}
      {(m.type==="curve"||m.type==="polygon")&&<PropRow label="Points" t={t}><div style={{display:"flex",gap:6,alignItems:"center"}}><span style={{fontSize:11,color:t.tx2}}>{m.points?.length||0} pts</span><span style={{fontSize:9,color:t.tx3}}>Ctrl+click add • Shift+click remove</span></div></PropRow>}
      <PropRow label="Color" t={t}><input type="color" value={m.color||m.strokeColor||"#38bdf8"} onChange={e=>onUpdate(m.type==="polygon"?{strokeColor:e.target.value}:{color:e.target.value})} style={{width:40,height:24,padding:0,border:"none",cursor:"pointer",borderRadius:4}}/></PropRow>
      {m.type==="polygon"&&<PropRow label="Fill" t={t}><input type="color" value={(m.fillColor||"#38bdf8aa").slice(0,7)} onChange={e=>onUpdate({fillColor:e.target.value+"33"})} style={{width:40,height:24,padding:0,border:"none",cursor:"pointer",borderRadius:4}}/></PropRow>}
      {["line","angle3","angle4","curve","perp","parallel"].includes(m.type)&&<PropRow label="Width" t={t}><input type="range" min="0.5" max="6" step="0.5" value={m.width||1.5} onChange={e=>onUpdate({width:+e.target.value})} style={{width:"100%",accentColor:t.acc}}/></PropRow>}
      {(m.type==="line"||m.type==="parallel")&&<><PropRow label="Dash" t={t}><select value={m.style||"solid"} onChange={e=>onUpdate({style:e.target.value})} style={{background:t.surf3,border:`1px solid ${t.bdr}`,borderRadius:4,padding:"3px 6px",color:t.tx,fontSize:12,width:"100%",fontFamily:"inherit"}}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></PropRow><PropRow label="Type" t={t}><div style={{display:"flex",gap:4}}>{["segment","infinite"].map(s=><button key={s} onClick={()=>onUpdate({mode:s})} style={{padding:"2px 8px",fontSize:10,border:`1px solid ${t.bdr}`,borderRadius:4,background:m.mode===s?t.acc:"transparent",color:m.mode===s?(theme==="light"?"#fff":t.bg):t.tx,cursor:"pointer",fontWeight:600}}>{s==="segment"?"2-Point":"Infinite"}</button>)}</div></PropRow><PropRow label="∥ Clone" t={t}><Btn t={t} small onClick={onParallel} style={{fontSize:10}}>Create Parallel</Btn></PropRow></>}
      {Object.keys(meas).length>0&&<div style={{marginTop:10,padding:8,background:t.surf3,borderRadius:6}}>{Object.entries(meas).map(([k,v])=><div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:11,color:t.tx2}}><span style={{textTransform:"capitalize"}}>{k}</span><span style={{fontFamily:"'DM Mono',monospace",color:t.acc}}>{k==="angle"?formatAngle(v):v.toFixed(2)+(k==="area"?" mm²":" mm")}</span></div>)}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPRODUCIBILITY PANEL
// ═══════════════════════════════════════════════════════════════════════════════
export function ReproducibilityPanel({t,markups,studies,onUpdateStudies,activeStudyId,setActiveStudyId,reproCollecting,setReproCollecting}){
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
    if(idx>=s.operators.length)return;
    setActiveStudyId(s.id);
    patchStudy(s.id,{status:"in_progress"});
    setReproCollecting({studyId:s.id,opId:s.operators[idx].id,trialIdx:0});
  };

  const finishInterTrial=s=>{
    setReproCollecting(null);
    patchStudy(s.id,{interNextOpIdx:(s.interNextOpIdx??0)+1});
    if((s.interNextOpIdx??0)+1>=s.operators.length){
      patchStudy(s.id,{status:"completed",completedAt:Date.now()});
      setActiveStudyId(null);
    }
  };

  return(
    <div style={{padding:12}}>
      <div style={{marginBottom:12,display:"flex",gap:6}}>
        <Btn t={t} small active={activeTab===null} onClick={()=>setActiveTab(null)}>All</Btn>
        <Btn t={t} small active={activeTab==="in_progress"} onClick={()=>setActiveTab("in_progress")}>Active</Btn>
        <Btn t={t} small active={activeTab==="completed"} onClick={()=>setActiveTab("completed")}>Done</Btn>
        <Btn t={t} small onClick={()=>setShowCreate(true)} style={{marginLeft:"auto"}}>+ New</Btn>
      </div>
      {studies.filter(s=>activeTab?s.status===activeTab:true).map(s=>(
        <div key={s.id} style={{marginBottom:8,padding:10,borderRadius:8,border:`1px solid ${s.id===activeStudyId?t.acc:t.bdr}`,background:s.id===activeStudyId?t.accMuted:t.surf2}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:t.tx}}>{s.name}</div>
              <div style={{fontSize:10,color:t.tx2}}>{s.type==="intra"?"Intra-operator":"Inter-operator"} · {s.status||"draft"}</div>
            </div>
            <button onClick={()=>deleteStudy(s.id)} style={{background:"none",border:"none",color:t.tx3,cursor:"pointer",fontSize:16}}>×</button>
          </div>
          {s.status==="in_progress"&&s.type==="intra"&&<div style={{marginBottom:8}}>
            {s.operators[0]?.trials?.length>0&&<div style={{fontSize:10,color:t.tx2,marginBottom:4}}>Trial {(s.intraNextTrialIdx??0)+1} of {s.operators[0].trials.length}</div>}
            {!reproCollecting?<Btn t={t} small onClick={()=>startIntraCollecting(s)}>▶ Start Trial</Btn>:(reproCollecting.studyId===s.id?<Btn t={t} small danger onClick={()=>endIntraTrial(s)}>⏹ End Trial</Btn>:<div style={{fontSize:10,color:t.warn}}>Another study collecting</div>)}
          </div>}
          {s.status==="completed"&&<div style={{fontSize:10,color:t.ok,marginBottom:8}}>✓ Study completed</div>}
          {s.type==="inter"&&s.status!=="completed"&&<div style={{marginBottom:8}}>
            <div style={{fontSize:10,color:t.tx2,marginBottom:4}}>Operator {(s.interNextOpIdx??0)+1} of {s.operators.length}</div>
            {!reproCollecting?<Btn t={t} small onClick={()=>startInterCollecting(s)}>▶ Start</Btn>:(reproCollecting.studyId===s.id?<Btn t={t} small danger onClick={()=>finishInterTrial(s)}>⏹ Next Operator</Btn>:<div style={{fontSize:10,color:t.warn}}>Another study collecting</div>)}
          </div>}
        </div>
      ))}
      {showCreate&&<CreateStudyModal t={t} onClose={()=>setShowCreate(false)} onSave={study=>{onUpdateStudies([...studies,{id:uid(),...study,createdAt:Date.now()}]);setShowCreate(false);}} landmarkHint={landmarkHint}/>}
    </div>
  );
}

function CreateStudyModal({t,onClose,onSave,landmarkHint}){
  const[name,setName]=useState("");const[type,setType]=useState("intra");const[opCount,setOpCount]=useState(2);const[trialCount,setTrialCount]=useState(2);const[landmark,setLandmark]=useState("");
  return(
    <div style={{background:t.surf,border:`1px solid ${t.bdr}`,borderRadius:12,padding:20}}>
      <div style={{fontSize:14,fontWeight:700,color:t.tx,marginBottom:16}}>New Reproducibility Study</div>
      <PropRow label="Study Name" t={t}><Inp value={name} onChange={setName} t={t} placeholder="e.g. Intra-operator repeatability"/></PropRow>
      <div style={{marginBottom:12}}><div style={{fontSize:10,color:t.tx2,marginBottom:4}}>Study Type</div><div style={{display:"flex",gap:4}}>{["intra","inter"].map(ty=><button key={ty} onClick={()=>setType(ty)} style={{padding:"4px 10px",fontSize:11,borderRadius:4,border:`1px solid ${t.bdr}`,background:type===ty?t.acc:"transparent",color:type===ty?(t.id==="light"?"#fff":t.bg):t.tx,cursor:"pointer",fontWeight:600}}>{ty==="intra"?"Intra-operator":"Inter-operator"}</button>)}</div></div>
      {type==="intra"&&<PropRow label="Operators" t={t}><input type="number" min={1} max={10} value={1} disabled style={{width:"100%",background:t.surf3,border:`1px solid ${t.bdr}`,borderRadius:4,padding:"6px 8px",color:t.tx2,fontFamily:"inherit"}}/></PropRow>}
      {type==="inter"&&<PropRow label="Operators" t={t}><input type="number" min={2} max={20} value={opCount} onChange={e=>setOpCount(+e.target.value)} style={{width:"100%",background:t.surf3,border:`1px solid ${t.bdr}`,borderRadius:4,padding:"6px 8px",color:t.tx,fontFamily:"inherit"}}/></PropRow>}
      {type==="intra"&&<PropRow label="Trials per landmark" t={t}><input type="number" min={2} max={50} value={trialCount} onChange={e=>setTrialCount(+e.target.value)} style={{width:"100%",background:t.surf3,border:`1px solid ${t.bdr}`,borderRadius:4,padding:"6px 8px",color:t.tx,fontFamily:"inherit"}}/></PropRow>}
      <PropRow label="Landmark (optional)" t={t}><select value={landmark} onChange={e=>setLandmark(e.target.value)} style={{width:"100%",background:t.surf3,border:`1px solid ${t.bdr}`,borderRadius:4,padding:"6px 8px",color:t.tx,fontSize:12}}><option value="">— All landmarks —</option>{landmarkHint.map(l=><option key={l} value={l}>{l}</option>)}</select></PropRow>
      <div style={{display:"flex",gap:8,marginTop:16}}>
        <Btn t={t} onClick={()=>onSave({name,type,landmark,operators:type==="intra"?[{id:uid(),name:"Operator 1",trials:Array.from({length:trialCount},()=>({id:uid(),measurements:[]}))}]:Array.from({length:opCount},(_,i)=>({id:uid(),name:`Operator ${i+1}`,trials:[{id:uid(),measurements:[]}]}))})} disabled={!name} style={{flex:1}}>Create</Btn>
        <Btn t={t} onClick={onClose}>Cancel</Btn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTICS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function reproAllLabels(study){
  const labels=new Set();
  if(!study||!study.operators)return[];
  study.operators.forEach(op=>{
    (op.trials||[]).forEach(tr=>{
      (tr.measurements||[]).forEach(m=>labels.add(m.label));
    });
  });
  return[...labels].sort();
}

function reproIccMatrix(study,metric){
  const labels=reproAllLabels(study);
  if(!labels.length||!study.operators)return null;
  const data=[];
  if(study.type==="intra"){
    const op=study.operators[0];
    if(!op)return null;
    const trials=op.trials||[];
    labels.forEach(lab=>{
      const col=trials.map(tr=>{const m=(tr.measurements||[]).find(x=>x.label===lab);return m?(metric==="x"?m.x:m.y):null;});
      if(col.some(v=>v!==null))data.push(col);
    });
  }else{
    labels.forEach(lab=>{
      const col=study.operators.map(op=>{const m=(op.trials?.[0]?.measurements||[]).find(x=>x.label===lab);return m?(metric==="x"?m.x:m.y):null;});
      if(col.some(v=>v!==null))data.push(col);
    });
  }
  return data.length>0?data:null;
}

function reproPairedVectors(study,metric,a,b){
  const vals1=[],vals2=[];
  if(study.type==="intra"){
    const op=study.operators[0];
    const t1=op?.trials?.[a],t2=op?.trials?.[b];
    if(t1&&t2){
      reproAllLabels(study).forEach(lab=>{
        const m1=t1.measurements?.find(x=>x.label===lab),m2=t2.measurements?.find(x=>x.label===lab);
        if(m1&&m2){vals1.push(metric==="x"?m1.x:m1.y);vals2.push(metric==="x"?m2.x:m2.y);}
      });
    }
  }else{
    const op1=study.operators?.[a],op2=study.operators?.[b];
    if(op1&&op2){
      reproAllLabels(study).forEach(lab=>{
        const m1=op1.trials?.[0]?.measurements?.find(x=>x.label===lab),m2=op2.trials?.[0]?.measurements?.find(x=>x.label===lab);
        if(m1&&m2){vals1.push(metric==="x"?m1.x:m1.y);vals2.push(metric==="x"?m2.x:m2.y);}
      });
    }
  }
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

export function StatisticsPanel({t,studies}){
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
                  <span style={{color:t.tx2}}>Landmarks</span><span>{labels.length}</span>
                  <span style={{color:t.tx2}}>Operators</span><span>{(study.operators||[]).length}</span>
                </div>
              </div>
              <div style={{marginBottom:12}}>
                <div style={{fontSize:10,color:t.tx2,marginBottom:4}}>Metric</div>
                <div style={{display:"flex",gap:4}}>{["x","y"].map(m=><button key={m} onClick={()=>setMetric(m)} style={{padding:"4px 10px",fontSize:11,borderRadius:4,border:`1px solid ${t.bdr}`,background:metric===m?t.acc:"transparent",color:metric===m?(t.id==="light"?"#fff":t.bg):t.tx,cursor:"pointer",fontWeight:600}}>{metric===m?"X":"x"} coord</button>)}</div>
              </div>
              {icc&&<div style={{marginBottom:12,padding:10,borderRadius:8,background:t.surf2,border:`1px solid ${t.bdr}`}}>
                <div style={{fontSize:10,fontWeight:700,color:t.tx,marginBottom:6}}>Intraclass Correlation (ICC)</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:10}}>
                  <span style={{color:t.tx2}}>ICC</span><span style={{fontFamily:"'DM Mono',monospace",fontWeight:700,color:t.acc}}>{icc.icc.toFixed(3)}</span>
                  <span style={{color:t.tx2}}>Interpretation</span><span>{getICCInterpretation(icc.icc)}</span>
                  <span style={{color:t.tx2}}>95% CI</span><span style={{fontFamily:"'DM Mono',monospace"}}>{icc.ciLower?.toFixed(3)||"—"} – {icc.ciUpper?.toFixed(3)||"—"}</span>
                </div>
              </div>}
              <div style={{marginBottom:12}}>
                <div style={{fontSize:10,color:t.tx2,marginBottom:4}}>Session Pair</div>
                <div style={{display:"flex",gap:6}}>
                  <select value={pairA} onChange={e=>setPairA(+e.target.value)} style={{flex:1,padding:"4px 6px",border:`1px solid ${t.bdr}`,borderRadius:4,background:t.surf3,color:t.tx,fontSize:11}}>
                    {Array.from({length:maxP+1},(_,i)=><option key={i} value={i}>{study.type==="intra"?`Trial ${i+1}`:`Op ${i+1}`}</option>)}
                  </select>
                  <select value={pairB} onChange={e=>setPairB(+e.target.value)} style={{flex:1,padding:"4px 6px",border:`1px solid ${t.bdr}`,borderRadius:4,background:t.surf3,color:t.tx,fontSize:11}}>
                    {Array.from({length:maxP+1},(_,i)=><option key={i} value={i}>{study.type==="intra"?`Trial ${i+1}`:`Op ${i+1}`}</option>)}
                  </select>
                </div>
              </div>
              {vals1.length>=2&&<div style={{marginBottom:12,padding:10,borderRadius:8,background:t.surf2,border:`1px solid ${t.bdr}`}}>
                <div style={{fontSize:10,fontWeight:700,color:t.tx,marginBottom:6}}>Comparison: Session {pairA+1} vs {pairB+1}</div>
                {dahl!==null&&<div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:4}}><span style={{color:t.tx2}}>Dahlberg Error</span><span style={{fontFamily:"'DM Mono',monospace",fontWeight:700,color:t.acc}}>{dahl.toFixed(2)} px</span></div>}
                {bland&&<>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:4}}><span style={{color:t.tx2}}>Mean Diff</span><span style={{fontFamily:"'DM Mono',monospace"}}>{bland.meanDiff.toFixed(2)} px</span></div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:4}}><span style={{color:t.tx2}}>95% Limits</span><span style={{fontFamily:"'DM Mono',monospace"}}>{bland.lower.toFixed(2)} to {bland.upper.toFixed(2)} px</span></div>
                </>}
                {tTest&&<div style={{display:"flex",justifyContent:"space-between",fontSize:10}}><span style={{color:t.tx2}}>t-test p</span><span style={{fontFamily:"'DM Mono',monospace",color:tTest.pValue<0.05?t.err:t.tx}}>{tTest.pValue<0.001?"<0.001":tTest.pValue.toFixed(3)}</span></div>}
              </div>}
              <div style={{marginBottom:12}}>
                <div style={{fontSize:10,fontWeight:700,color:t.tx,marginBottom:6}}>Descriptive Statistics ({metric.toUpperCase()})</div>
                <div style={{fontSize:9,color:t.tx2,marginBottom:8}}>N, Mean, SD, Min, Max across all {study.type==="intra"?"trials":"operators"}</div>
                {descriptive.map(d=>(<div key={d.lab} style={{display:"flex",justifyContent:"space-between",fontSize:10,borderBottom:`1px solid ${t.bdr}44`,padding:"4px 0"}}><span style={{fontFamily:"'DM Mono',monospace",color:t.tx}}>{d.lab}</span><span style={{fontFamily:"'DM Mono',monospace",color:t.tx2}}>{d.n?`${d.n} ${d.mean?.toFixed(1)}±${d.sd?.toFixed(1)} ${d.min?.toFixed(0)}–${d.max?.toFixed(0)}`:"—no data"}</span></div>))}
              </div>
              <Btn t={t} small onClick={()=>exportReproTablesCsv(study)} style={{width:"100%"}}>⬇ Export CSV</Btn>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATES PANEL
// ═══════════════════════════════════════════════════════════════════════════════
export function TemplatesPanel({t,projection,onLoadTemplate}){
  const allTemplates=PREDEFINED[projection]||[];
  const uniqueTemplates=allTemplates.filter((tmpl,idx,self)=>idx===self.findIndex(t=>t.name===tmpl.name));
  const [selectedTemplate,setSelectedTemplate]=useState(null);

  const handleLoad=(tmpl,e)=>{
    e?.stopPropagation();
    onLoadTemplate(tmpl);
  };

  if(selectedTemplate){
    const sections=[];
    if(selectedTemplate.pts?.length>0)sections.push({type:"Landmarks",icon:"◉",items:selectedTemplate.pts.map(pt=>({label:pt.l,def:pt.def,color:pt.color,type:"point"}))});
    if(selectedTemplate.lines?.length>0)sections.push({type:"Lines",icon:"⟋",items:selectedTemplate.lines.map(ln=>({label:ln.l,def:ln.def,color:ln.color,type:"line"}))});
    if(selectedTemplate.angles?.length>0)sections.push({type:"Angles",icon:"∠",items:selectedTemplate.angles.map(ang=>({label:ang.l,def:ang.def,color:ang.color,type:"angle"}))});
    if(selectedTemplate.distances?.length>0)sections.push({type:"Distances",icon:"↔",items:selectedTemplate.distances.map(dist=>({label:dist.l,def:dist.def,color:dist.color,type:"distance"}))});
    if(selectedTemplate.planes?.length>0)sections.push({type:"Planes",icon:"▭",items:selectedTemplate.planes.map(pl=>({label:pl.l,def:pl.def,color:pl.color,type:"plane"}))});

    const totalItems=sections.reduce((sum,s)=>sum+s.items.length,0);

    return(
      <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
        <div style={{padding:"10px 12px",borderBottom:`1px solid ${t.bdr}`,display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <button onClick={()=>setSelectedTemplate(null)} style={{background:"none",border:"none",color:t.tx2,cursor:"pointer",fontSize:18,padding:4,display:"flex",alignItems:"center"}}>←</button>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:700,color:t.tx,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{selectedTemplate.name}</div>
            <div style={{fontSize:10,color:t.tx2}}>{totalItems} items</div>
          </div>
          <button onClick={(e)=>handleLoad(selectedTemplate,e)} style={{padding:"6px 12px",borderRadius:6,border:"none",background:t.acc,color:t.bg,fontSize:11,fontWeight:700,cursor:"pointer"}}>Load</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:12}}>
          {sections.map(sec=>(
            <div key={sec.type} style={{marginBottom:20}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
                <span style={{fontSize:14,color:t.acc}}>{sec.icon}</span>
                <span style={{fontSize:11,fontWeight:700,color:t.tx,textTransform:"uppercase",letterSpacing:0.5}}>{sec.type}</span>
                <span style={{fontSize:9,color:t.tx3,background:t.surf2,padding:"1px 6px",borderRadius:4}}>{sec.items.length}</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {sec.items.map((item,i)=>(
                  <div key={i} style={{padding:12,borderRadius:8,background:t.surf2,border:`1px solid ${item.color||t.bdr}44`}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                      <div style={{width:10,height:10,borderRadius:item.type==="angle"?"2px":"50%",background:item.color||t.acc,flexShrink:0}}/>
                      <div style={{fontSize:13,fontWeight:700,color:t.tx,fontFamily:"'DM Mono',monospace"}}>{item.label}</div>
                    </div>
                    <div style={{fontSize:11,color:t.tx2,lineHeight:1.5}}>{item.def||"—"}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return(
    <div style={{padding:12}}>
      <div style={{fontSize:11,color:t.tx2,marginBottom:12,lineHeight:1.45}}>
        Browse cephalometric analysis templates. Click a template to view landmarks with definitions. Click <strong>Load</strong> to add points to your workspace.
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {uniqueTemplates.map(tmpl=>{
          const totalPts=tmpl.pts?.length||0;
          return(
            <div key={tmpl.name} onClick={()=>setSelectedTemplate(tmpl)} style={{padding:"12px",borderRadius:8,background:t.surf2,border:`1px solid ${t.bdr}`,cursor:"pointer",display:"flex",alignItems:"center",gap:10,transition:"border-color 0.15s"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:t.tx,marginBottom:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{tmpl.name}</div>
                <div style={{fontSize:10,color:t.tx2}}>{totalPts} landmarks</div>
              </div>
              <button onClick={(e)=>handleLoad(tmpl,e)} style={{padding:"4px 10px",borderRadius:6,border:"none",background:t.acc,color:t.bg,fontSize:10,fontWeight:700,cursor:"pointer",flexShrink:0}}>Load</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { getICCInterpretation } from "./utils.js";