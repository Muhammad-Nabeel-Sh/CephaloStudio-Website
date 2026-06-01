import { uid } from "../utils.js";
import { PropRow, Btn } from "../ui.jsx";

export default function AnonModal({t,project,onUpdateProject}){
  const anonymize=async()=>{if(!window.confirm("Remove all patient identifiers permanently?"))return;onUpdateProject({meta:{...project.meta,patientId:"ANON-"+uid().toUpperCase(),patientName:"",dob:"",age:"",clinician:"",facility:"",referral:"",notes:"[Anonymized]",anonymized:true}});};
  return(
    <div>
      <div style={{marginBottom:16,padding:12,background:t.surf2,borderRadius:8,border:`1px solid ${t.bdr}`}}>
        <div style={{fontSize:12,fontWeight:700,color:t.tx,marginBottom:10}}>Patient Metadata</div>
        {[["patientId","Patient ID"],["patientName","Name"],["dob","DOB"],["age","Age"],["gender","Gender"],["clinician","Clinician"],["facility","Facility"]].map(([k,label])=>(
          <PropRow key={k} label={label} t={t}><input type="text" value={project.meta[k]||""} onChange={e=>onUpdateProject({meta:{...project.meta,[k]:e.target.value}})} style={{background:t.surf3,border:`1px solid ${t.bdr}`,borderRadius:4,padding:"4px 8px",color:t.tx,fontSize:12,width:240,fontFamily:"inherit"}}/></PropRow>
        ))}
      </div>
      {project.meta.anonymized?<div style={{padding:10,background:t.ok+"11",border:`1px solid ${t.ok}33`,borderRadius:6,fontSize:12,color:t.ok,marginBottom:16}}>✓ Case is anonymized.</div>:<Btn t={t} danger onClick={anonymize} style={{width:"100%"}}>🔏 Anonymize (irreversible)</Btn>}
    </div>
  );
}
