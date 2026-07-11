import { useEffect, useCallback, useRef } from "react";

export function Modal({t,title,children,onClose,wide}){
  const contentRef=useRef(null);
  const closeRef=useRef(null);
  const previousFocus=useRef(null);
  useEffect(()=>{previousFocus.current=document.activeElement;closeRef.current?.focus();return()=>previousFocus.current?.focus();},[]);
  const handleKey=useCallback(e=>{
    if(e.key==="Escape"){onClose?.();return;}
    if(e.key==="Tab"&&contentRef.current){
      const focusable=contentRef.current.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
      if(!focusable.length)return;
      const first=focusable[0],last=focusable[focusable.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  },[onClose]);
  useEffect(()=>{document.addEventListener("keydown",handleKey);return()=>document.removeEventListener("keydown",handleKey);},[handleKey]);
  return(
    <div role="dialog" aria-modal="true" aria-label={title} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div ref={contentRef} style={{background:t.surf,border:`1px solid ${t.bdr}`,borderRadius:12,padding:24,width:wide?900:420,maxWidth:"95vw",maxHeight:"90vh",overflowY:"auto",boxShadow:`0 24px 60px rgba(0,0,0,0.4)`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16,color:t.tx}}>{title}</div>
          <button ref={closeRef} onClick={onClose} title="Close" aria-label="Close" style={{background:"none",border:"none",color:t.tx2,cursor:"pointer",fontSize:22}}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
