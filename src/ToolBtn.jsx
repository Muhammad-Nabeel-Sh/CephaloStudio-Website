import { useState } from "react";

export default function ToolBtn({tool,active,onClick,theme,t,style}){
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
