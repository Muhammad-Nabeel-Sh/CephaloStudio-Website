import { useState } from "react";
import { hashPin } from "./utils.js";
import { Btn } from "./ui.jsx";

export default function PinGate({t,project,onVerified,onCancel}){
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
