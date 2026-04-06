import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as math from "mathjs";

const SMV_CSV = `Analysis,View,Markup type,Landmark,Definition
General SMV Analysis,SMV,Point,Ang-L - Angulare (Left),The point of intersection between the posterior border of the ramus and the inferior border of the mandibular body on the left side.
General SMV Analysis,SMV,Point,Ang-R - Angulare (Right),The point of intersection between the posterior border of the ramus and the inferior border of the mandibular body on the right side.
General SMV Analysis,SMV,Point,ANS - Anterior nasal spine,The tip of the anterior nasal spine in the midline.
General SMV Analysis,SMV,Point,Ba - Basion,The median point of the anterior margin of the foramen magnum.
General SMV Analysis,SMV,Point,CdA-L - Condylion Anterioris (Left),The most anterior point on the contour of the left mandibular condylar head.
General SMV Analysis,SMV,Point,CdA-R - Condylion Anterioris (Right),The most anterior point on the contour of the right mandibular condylar head.
General SMV Analysis,SMV,Point,CdL-L - Condylion Lateral (Left),The most lateral point on the left mandibular condyle.
General SMV Analysis,SMV,Point,CdL-R - Condylion Lateral (Right),The most lateral point on the right mandibular condyle.
General SMV Analysis,SMV,Point,CdM-L - Condylion Medial (Left),The most medial point on the left mandibular condyle.
General SMV Analysis,SMV,Point,CdM-R - Condylion Medial (Right),The most medial point on the right mandibular condyle.
General SMV Analysis,SMV,Point,CdP-L - Condylion Posterioris (Left),The most posterior point on the contour of the left mandibular condylar head.
General SMV Analysis,SMV,Point,CdP-R - Condylion Posterioris (Right),The most posterior point on the contour of the right mandibular condylar head.
General SMV Analysis,SMV,Point,Cg - Crista galli,The most anterior point of the crista galli.
General SMV Analysis,SMV,Point,Cor-L - Coronoid (Left),The most anterior projection of the left coronoid process.
General SMV Analysis,SMV,Point,Cor-R - Coronoid (Right),The most anterior projection of the right coronoid process.
General SMV Analysis,SMV,Point,Go-L - Gonion (Left),The most lateral point at the angle of the left mandible.
General SMV Analysis,SMV,Point,Go-R - Gonion (Right),The most lateral point at the angle of the right mandible.
General SMV Analysis,SMV,Point,Jug-L - Jugale (Left),The intersection of the maxillary tuberosity and zygomatic buttress on the left side.
General SMV Analysis,SMV,Point,Jug-R - Jugale (Right),The intersection of the maxillary tuberosity and zygomatic buttress on the right side.
General SMV Analysis,SMV,Point,L1M - Lower dental midline,The dental midline point of the mandibular central incisors.
General SMV Analysis,SMV,Point,L6-L - Lower first molar (Left),The most prominent lateral point on the buccal surface of the left mandibular first molar.
General SMV Analysis,SMV,Point,L6-R - Lower first molar (Right),The most prominent lateral point on the buccal surface of the right mandibular first molar.
General SMV Analysis,SMV,Point,Ma-L - Mastoid (Left),The most inferior and lateral point of the left mastoid process.
General SMV Analysis,SMV,Point,Ma-R - Mastoid (Right),The most inferior and lateral point of the right mastoid process.
General SMV Analysis,SMV,Point,MCF-L - Middle Cranial Fossa (Left),The most lateral or inferior prominent point on the outline of the left middle cranial fossa.
General SMV Analysis,SMV,Point,MCF-R - Middle Cranial Fossa (Right),The most lateral or inferior prominent point on the outline of the right middle cranial fossa.
General SMV Analysis,SMV,Point,MdABM - Mandibular Apical Base Midline,The geometric midline point of the mandibular apical base in the transverse plane.
General SMV Analysis,SMV,Point,Me - Menton,The most anterior point on the symphysis of the mandible in the SMV projection.
General SMV Analysis,SMV,Point,MxABM - Maxillary Apical Base Midline,The geometric midline point of the maxillary apical base in the transverse plane.
General SMV Analysis,SMV,Point,Od - Odontoid,The most superior point on the tip of the odontoid process (dens) of the second cervical vertebra (axis).
General SMV Analysis,SMV,Point,Op - Opisthion,The median point of the posterior margin of the foramen magnum.
General SMV Analysis,SMV,Point,PCV-L - Posterior Cranial Vault (Left),The most posterior point on the bony outline of the left posterior cranial vault.
General SMV Analysis,SMV,Point,PCV-R - Posterior Cranial Vault (Right),The most posterior point on the bony outline of the right posterior cranial vault.
General SMV Analysis,SMV,Point,Ptm-L - Pterygomaxillary Fissure (Left),The most inferior point of the teardrop-shaped radiolucency representing the pterygomaxillary fissure on the left side.
General SMV Analysis,SMV,Point,Ptm-R - Pterygomaxillary Fissure (Right),The most inferior point of the teardrop-shaped radiolucency representing the pterygomaxillary fissure on the right side.
General SMV Analysis,SMV,Point,Sp-L - Foramen Spinosum (Left),The center of the left foramen spinosum, often used as a reliable bilateral cranial base reference structure.
General SMV Analysis,SMV,Point,Sp-R - Foramen Spinosum (Right),The center of the right foramen spinosum, often used as a reliable bilateral cranial base reference structure.
General SMV Analysis,SMV,Point,U1M - Upper dental midline,The dental midline point of the maxillary central incisors.
General SMV Analysis,SMV,Point,U6-L - Upper first molar (Left),The most prominent lateral point on the buccal surface of the left maxillary first molar.
General SMV Analysis,SMV,Point,U6-R - Upper first molar (Right),The most prominent lateral point on the buccal surface of the right maxillary first molar.
General SMV Analysis,SMV,Point,V - Vomer,The most posterior point on the bony nasal septum (vomer).
General SMV Analysis,SMV,Point,ZA-L - Zygomatic Arch (Left),The most lateral point on the left zygomatic arch.
General SMV Analysis,SMV,Point,ZA-R - Zygomatic Arch (Right),The most lateral point on the right zygomatic arch.`;

const OPG_CSV = `Analysis,View,Markup type,Landmark,Definition
General OPG Analysis,OPG,Point,Ag-L - Antegonion (Left),The deepest point of the antegonial notch on the lower border of the left mandible.
General OPG Analysis,OPG,Point,Ag-R - Antegonion (Right),The deepest point of the antegonial notch on the lower border of the right mandible.
General OPG Analysis,OPG,Point,Ar-L - Articulare (Left),The point of intersection of the posterior border of the left condylar neck and the inferior border of the cranial base.
General OPG Analysis,OPG,Point,Ar-R - Articulare (Right),The point of intersection of the posterior border of the right condylar neck and the inferior border of the cranial base.
General OPG Analysis,OPG,Point,Co-L - Condylion (Left),The most superior point on the contour of the left mandibular condylar head.
General OPG Analysis,OPG,Point,Co-R - Condylion (Right),The most superior point on the contour of the right mandibular condylar head.
General OPG Analysis,OPG,Point,Cor-L - Coronoid (Left),The most superior point of the left coronoid process.
General OPG Analysis,OPG,Point,Cor-R - Coronoid (Right),The most superior point of the right coronoid process.
General OPG Analysis,OPG,Point,Go-L - Gonion (Left),The most inferior and posterior point at the angle of the left mandible.
General OPG Analysis,OPG,Point,Go-R - Gonion (Right),The most inferior and posterior point at the angle of the right mandible.
General OPG Analysis,OPG,Point,MdF-L - Mandibular Foramen (Left),The geometric center of the left mandibular foramen.
General OPG Analysis,OPG,Point,MdF-R - Mandibular Foramen (Right),The geometric center of the right mandibular foramen.
General OPG Analysis,OPG,Point,Me - Menton,The most inferior point on the outline of the mandibular symphysis.
General OPG Analysis,OPG,Point,Mf-L - Mental Foramen (Left),The geometric center of the left mental foramen.
General OPG Analysis,OPG,Point,Mf-R - Mental Foramen (Right),The geometric center of the right mental foramen.
General OPG Analysis,OPG,Point,Or-L - Orbitale (Left),The lowest point on the left infraorbital margin.
General OPG Analysis,OPG,Point,Or-R - Orbitale (Right),The lowest point on the right infraorbital margin.
General OPG Analysis,OPG,Point,Ptm-L - Pterygomaxillary Fissure (Left),The lowest point of the teardrop-shaped radiolucency of the pterygomaxillary fissure on the left side.
General OPG Analysis,OPG,Point,Ptm-R - Pterygomaxillary Fissure (Right),The lowest point of the teardrop-shaped radiolucency of the pterygomaxillary fissure on the right side.
General OPG Analysis,OPG,Point,Sig-L - Sigmoid Notch (Left),The deepest point of the mandibular (sigmoid) notch between the coronoid process and the condyle on the left side.
General OPG Analysis,OPG,Point,Sig-R - Sigmoid Notch (Right),The deepest point of the mandibular (sigmoid) notch between the coronoid process and the condyle on the right side.
General Analysis,Multi-view,Point,Inc-L - Incisura Mandibulae (Left),The deepest point of the mandibular (sigmoid) notch between the coronoid process and the condyle on the left side.
General Analysis,Multi-view,Point,Inc-R - Incisura Mandibulae (Right),The deepest point of the mandibular (sigmoid) notch between the coronoid process and the condyle on the right side.`;

function parseCSV(csv){
  const lines=csv.trim().split("\n");
  const headers=lines[0].split(",").map(h=>h.trim());
  const result=[];
  for(let i=1;i<lines.length;i++){
    let line=lines[i],row=[],inQuote=false,current="";
    for(let j=0;j<line.length;j++){
      const ch=line[j];
      if(ch==='"'){inQuote=!inQuote;continue;}
      if(ch===","&&!inQuote){row.push(current.trim());current="";continue;}
      current+=ch;
    }
    row.push(current.trim());
    if(row.length>0){
      const obj={};
      headers.forEach((h,idx)=>obj[h]=row[idx]||"");
      result.push(obj);
    }
  }
  return result;
}

function csvToAnalysis(csv,name,color){
  const data=parseCSV(csv);
  const analyses={};
  data.forEach(row=>{
    const aname=row.Analysis||"General";
    if(!analyses[aname])analyses[aname]=[];
    const label=row.Landmark.split(" - ")[0].trim();
    analyses[aname].push({l:label,def:row.Definition||"",color:color});
  });
  return Object.entries(analyses).map(([aname,pts])=>({name:aname,pts}));
}

// ═══════════════════════════════════════════════════════════════════════════════
// KATEX LOADER
// ═══════════════════════════════════════════════════════════════════════════════
function useKatex() {
  const [loaded, setLoaded] = useState(!!window.katex);
  useEffect(() => {
    if (window.katex) { setLoaded(true); return; }
    if (!document.getElementById("katex-css")) {
      const l = document.createElement("link");
      l.id = "katex-css"; l.rel = "stylesheet";
      l.href = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.8/katex.min.css";
      document.head.appendChild(l);
    }
    if (!document.getElementById("katex-js")) {
      const s = document.createElement("script");
      s.id = "katex-js";
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.8/katex.min.js";
      s.onload = () => setLoaded(true);
      document.head.appendChild(s);
    }
  }, []);
  return loaded;
}

function KatexSpan({ latex, block = false, large = false, fontSize }) {
  const loaded = useKatex();
  const ref = useRef(null);
  useEffect(() => {
    if (!loaded || !ref.current || !window.katex) return;
    try {
      window.katex.render(latex, ref.current, {
        throwOnError: false, displayMode: block,
        output: "html",
      });
    } catch {}
  }, [latex, block, loaded]);
  const size = fontSize ? `${fontSize}pt` : (large ? "2.4rem" : "inherit");
  return (
    <span ref={ref}
      style={{ fontSize: size, fontFamily: "inherit", display: block ? "block" : "inline" }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GEOMETRY
// ═══════════════════════════════════════════════════════════════════════════════
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist = (a, b) => Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
const angle3pt = (p1, vtx, p2) => {
  const u={x:p1.x-vtx.x,y:p1.y-vtx.y}, w={x:p2.x-vtx.x,y:p2.y-vtx.y};
  const cross=u.x*w.y-u.y*w.x;
  return Math.atan2(cross,u.x*w.x+u.y*w.y)*180/Math.PI;
};
const angle4pt = (p1,p2,p3,p4) => {
  const d1={x:p2.x-p1.x,y:p2.y-p1.y}, d2={x:p4.x-p3.x,y:p4.y-p3.y};
  const cross=d1.x*d2.y-d1.y*d2.x;
  return Math.atan2(cross,d1.x*d2.x+d1.y*d2.y)*180/Math.PI;
};
const perpDist=(pt,a,b)=>{const num=Math.abs((b.y-a.y)*pt.x-(b.x-a.x)*pt.y+b.x*a.y-b.y*a.x),den=dist(a,b);return den<1e-9?0:num/den;};
const polyArea=pts=>{let a=0;for(let i=0,j=pts.length-1;i<pts.length;j=i++)a+=(pts[j].x+pts[i].x)*(pts[j].y-pts[i].y);return Math.abs(a/2);};
const polyLen=(pts,closed=true)=>{let p=0;for(let i=1;i<pts.length;i++)p+=dist(pts[i-1],pts[i]);if(closed&&pts.length>2)p+=dist(pts[pts.length-1],pts[0]);return p;};
const vpts=m=>(m.points||[]).filter(p=>p.x>-9000);

// Catmull-Rom sampled points for area/length
function sampleSpline(pts, closed=false, samplesPer=24) {
  if (pts.length < 2) return pts;
  const ext = closed ? [pts[pts.length-1],...pts,pts[0],pts[1]] : [pts[0],...pts,pts[pts.length-1]];
  const out = [];
  const N = closed ? pts.length : pts.length-1;
  for (let i=1; i<=N; i++) {
    const p0=ext[i-1], p1=ext[i], p2=ext[i+1]||ext[ext.length-1], p3=ext[i+2]||ext[ext.length-1];
    for (let j=0; j<samplesPer; j++) {
      const t=j/samplesPer, t2=t*t, t3=t2*t;
      out.push({
        x: 0.5*((2*p1.x)+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
        y: 0.5*((2*p1.y)+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3),
      });
    }
  }
  if (!closed) out.push(pts[pts.length-1]);
  return out;
}
const splineArea=(pts)=>polyArea(sampleSpline(pts,true));
const splineLen=(pts,closed=false)=>polyLen(sampleSpline(pts,closed),false);
const getInfiniteLinePoints=(p1,p2,w,h)=>{
  const dx=p2.x-p1.x,dy=p2.y-p1.y,len=Math.sqrt(dx*dx+dy*dy);
  if(len<1e-9)return[p1,p1];
  const nx=dx/len,ny=dy/len,dist=Math.max(w,h)*4;
  return[{x:p1.x-nx*dist,y:p1.y-ny*dist},{x:p1.x+nx*dist,y:p1.y+ny*dist}];
};

// ═══════════════════════════════════════════════════════════════════════════════
// MEASUREMENTS (spline-aware)
// ═══════════════════════════════════════════════════════════════════════════════
function computeMeasurements(m, cal) {
  const ppm=cal?.pxPerMm||1, meas={}, vp=vpts(m);
  if((m.type==="line"||m.type==="parallel")&&vp.length>=2&&m.mode!=="infinite") meas.length=dist(vp[0],vp[1])/ppm;
  if(m.type==="angle3"&&vp.length>=3) meas.angle=angle3pt(vp[0],vp[1],vp[2]);
  if(m.type==="angle4"&&vp.length>=4) meas.angle=angle4pt(vp[0],vp[1],vp[2],vp[3]);
  if(m.type==="polygon"&&vp.length>=3) {
    const useSpline = m.curveStyle==="bspline" && vp.length>=3;
    meas.area=(useSpline?splineArea(vp):polyArea(vp))/ppm**2;
    meas.perimeter=(useSpline?splineLen(vp,true):polyLen(vp,true))/ppm;
  }
  if(m.type==="curve"&&vp.length>=2) {
    const useSpline = m.curveStyle==="bspline" && vp.length>=3;
    meas.length=(useSpline?splineLen(vp,false):polyLen(vp,false))/ppm;
  }
  if(m.type==="perp"&&vp.length>=3){meas.distance=perpDist(vp[2],vp[0],vp[1])/ppm; meas.lineLength=dist(vp[0],vp[1])/ppm;}
  return meas;
}

// ═══════════════════════════════════════════════════════════════════════════════
// IMAGE PROCESSING + LUT
// ═══════════════════════════════════════════════════════════════════════════════
function getLUTColor(v,mode,invert=false){
  v=clamp(Math.round(v),0,255); if(invert)v=255-v;
  switch(mode){
    case"hot":if(v<85)return[v*3,0,0];if(v<170)return[255,(v-85)*3,0];return[255,255,(v-170)*3];
    case"cool":return[v,255-v,255];
    case"jet":{const n=v/255;let r=0,g=0,b=0;if(n<0.125)b=0.5+4*n;else if(n<0.375){g=4*(n-0.125);b=1;}else if(n<0.625){r=4*(n-0.375);g=1;b=1-4*(n-0.375);}else if(n<0.875){r=1;g=1-4*(n-0.625);}else{r=1-4*(n-0.875);}return[r*255,g*255,b*255];}
    case"viridis":{const stops=[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]];const n=v/255*4,i=Math.min(3,Math.floor(n)),f=n-i,c0=stops[i],c1=stops[i+1];return[c0[0]+(c1[0]-c0[0])*f,c0[1]+(c1[1]-c0[1])*f,c0[2]+(c1[2]-c0[2])*f];}
    case"bone":{const n=v/255;return[clamp(n*210,0,255),clamp(n*210,0,255),clamp(v*1.08,0,255)];}
    case"rainbow":{const h=v/255*300;let r=0,g=0,b=0;if(h<60){r=0.5;g=h/60*0.5;}else if(h<120){r=0.5-(h-60)/60*0.5;g=0.5;}else if(h<180){g=0.5;b=(h-120)/60*0.5;}else if(h<240){g=0.5-(h-180)/60*0.5;b=0.5;}else if(h<300){r=(h-240)/60*0.5;b=0.5;}else{r=0.5;b=0.5-(h-300)/60*0.5;}return[(r+0.2)*255,(g+0.2)*255,(b+0.2)*255];}
    default:return[v,v,v];
  }
}
const LUT_PRESETS=[
  {id:"gray",name:"Grayscale",stops:["#000","#fff"]},
  {id:"hot",name:"Hot",stops:["#000","#f00","#ff0","#fff"]},
  {id:"cool",name:"Cool",stops:["#0ff","#00f","#f0f"]},
  {id:"jet",name:"Jet",stops:["#00f","#0ff","#0f0","#ff0","#f00"]},
  {id:"viridis",name:"Viridis",stops:["#440154","#3b528b","#21918c","#5ec962","#fde725"]},
  {id:"bone",name:"Bone",stops:["#000","#5e7ba0","#fff"]},
  {id:"rainbow",name:"Rainbow",stops:["#f00","#ff0","#0f0","#0ff","#00f","#f0f"]},
];

function applyEdgeKernel(idata,strength){
  const{data,width,height}=idata,out=new Uint8ClampedArray(data),k=clamp(strength/100*2.5,0,3);
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){const ci=(y*width+x)*4;for(let c=0;c<3;c++){
    const v=data[ci+c]*(1+4*k)-data[((y-1)*width+x)*4+c]*k-data[((y+1)*width+x)*4+c]*k-data[(y*width+x-1)*4+c]*k-data[(y*width+x+1)*4+c]*k;
    out[ci+c]=clamp(v,0,255);}}
  return new ImageData(out,width,height);
}

function processImageToCanvas(img,proc,lutMode,lutInvert){
  if(!img)return null;
  const nw=img.naturalWidth||img.width||600,nh=img.naturalHeight||img.height||500;
  const oc=document.createElement("canvas");oc.width=nw;oc.height=nh;
  const ctx=oc.getContext("2d");ctx.drawImage(img,0,0);
  const{brightness=0,contrast=0,windowWidth=0,windowCenter=128,edgeEnhance=0}=proc;
  if(!brightness&&!contrast&&!windowWidth&&!edgeEnhance&&lutMode==="gray"&&!lutInvert)return oc;
  let idata=ctx.getImageData(0,0,nw,nh);
  if(edgeEnhance>0)idata=applyEdgeKernel(idata,edgeEnhance);
  const d=idata.data,cf=(contrast+100)/100;
  for(let i=0;i<d.length;i+=4){
    let v=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
    if(windowWidth>0){const lo=windowCenter-windowWidth/2,hi=windowCenter+windowWidth/2;v=clamp((v-lo)/Math.max(hi-lo,1)*255,0,255);}
    v=clamp(v+brightness,0,255);v=clamp((v-128)*cf+128,0,255);
    const[lr,lg,lb]=getLUTColor(v,lutMode,lutInvert);d[i]=lr;d[i+1]=lg;d[i+2]=lb;
  }
  ctx.putImageData(idata,0,0);return oc;
}

function computeHistogram(img){
  const hist=new Array(256).fill(0);if(!img)return hist;
  const oc=document.createElement("canvas"),sc=Math.min(1,500/Math.max(img.naturalWidth||1,1));
  oc.width=Math.round((img.naturalWidth||600)*sc);oc.height=Math.round((img.naturalHeight||500)*sc);
  const ctx=oc.getContext("2d");ctx.drawImage(img,0,0,oc.width,oc.height);
  const d=ctx.getImageData(0,0,oc.width,oc.height).data;
  for(let i=0;i<d.length;i+=4)hist[clamp(Math.round(0.299*d[i]+0.587*d[i+1]+0.114*d[i+2]),0,255)]++;
  return hist;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPLINE DRAW
// ═══════════════════════════════════════════════════════════════════════════════
function catmullRom(ctx,pts,closed=false){
  if(pts.length<2)return;
  const ext=closed?[pts[pts.length-1],...pts,pts[0],pts[1]]:[pts[0],...pts,pts[pts.length-1]];
  ctx.moveTo(pts[0].x,pts[0].y);
  const N=closed?pts.length:pts.length-1;
  for(let i=1;i<=N;i++){
    const p0=ext[i-1],p1=ext[i],p2=ext[i+1]||ext[ext.length-1],p3=ext[i+2]||ext[ext.length-1];
    for(let j=1;j<=24;j++){
      const t=j/24,t2=t*t,t3=t2*t;
      ctx.lineTo(0.5*((2*p1.x)+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
        0.5*((2*p1.y)+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3));
    }
  }
  if(closed)ctx.closePath();
}

// ═══════════════════════════════════════════════════════════════════════════════
// SNAP
// ═══════════════════════════════════════════════════════════════════════════════
function perpPoint(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy;
  if(len2<1e-12)return a;
  const t=((p.x-a.x)*dx+(p.y-a.y)*dy)/len2;
  return{x:a.x+t*dx,y:a.y+t*dy};
}
function snapPoint(ip,markups,r,enabled){
  if(!enabled)return ip;
  let best=ip,bestD=r;
  for(const m of markups){
    if(m.visible===false)continue;
    for(const p of m.points){if(p.x<-9000)continue;const d=dist(p,ip);if(d<bestD){bestD=d;best=p;}}
  }
  return{...best};
}
function snapToLine(ip,markups,r){
  let bestPt=ip,bestD=r;
  for(const m of markups){
    if(m.visible===false)continue;
    if(m.type==="line"||m.type==="parallel"){
      const vp=m.points.filter(p=>p.x>-9000);
      if(vp.length>=2){
        const pr=perpPoint(ip,vp[0],vp[1]);
        const d=dist(pr,ip);
        if(d<bestD){bestD=d;bestPt=pr;}
      }
    }
  }
  return{...bestPt};
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALIGNMENT
// ═══════════════════════════════════════════════════════════════════════════════
function alignOnePoint(src,dst){return{tx:dst.x-src.x,ty:dst.y-src.y,rot:0,scale:1};}
function alignTwoPoints(s1,s2,d1,d2){
  const srcA=Math.atan2(s2.y-s1.y,s2.x-s1.x),dstA=Math.atan2(d2.y-d1.y,d2.x-d1.x);
  const rot=dstA-srcA,srcLen=dist(s1,s2),dstLen=dist(d1,d2),scale=srcLen>1e-9?dstLen/srcLen:1;
  const cos=Math.cos(rot)*scale,sin=Math.sin(rot)*scale;
  return{tx:d1.x-(cos*s1.x-sin*s1.y),ty:d1.y-(sin*s1.x+cos*s1.y),rot,scale};
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORMULA ENGINE
// ═══════════════════════════════════════════════════════════════════════════════
function buildScope(markups,calibration){
  const scope={};
  markups.forEach(m=>{
    const meas=computeMeasurements(m,calibration);
    const lbl=(m.label||m.type).replace(/[^a-zA-Z0-9]/g,"_");
    Object.entries(meas).forEach(([k,v])=>{scope[lbl]=v;scope[`${lbl}_${k}`]=v;});
  });
  return scope;
}
function evalFormula(expr,scope){
  try{const r=math.evaluate(expr,{...scope});return typeof r==="number"?r:null;}catch{return null;}
}

// ═══════════════════════════════════════════════════════════════════════════════
// NORMS
// ═══════════════════════════════════════════════════════════════════════════════
function normDeviation(value,norm){
  const delta=value-norm.mean,sdUnits=norm.sd>0?delta/norm.sd:0;
  return{delta,sdUnits,within1SD:Math.abs(sdUnits)<=1,within2SD:Math.abs(sdUnits)<=2};
}
const deviationColor=(sdUnits,t)=>{const a=Math.abs(sdUnits);if(a<=1)return t.ok;if(a<=2)return t.warn;return t.err;};

// ═══════════════════════════════════════════════════════════════════════════════
// REPRODUCIBILITY STATISTICS
// ═══════════════════════════════════════════════════════════════════════════════
function mean(arr){return arr.reduce((a,b)=>a+b,0)/arr.length;}
function variance(arr,m){return arr.reduce((s,x)=>s+(x-m)**2,0)/arr.length;}
function stdev(arr,m){return Math.sqrt(variance(arr,m));}
function gammaLn(x){
  const g=7,c=[0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
  if(x<0.5)return Math.log(Math.PI/Math.sin(Math.PI*x))-gammaLn(1-x);
  x-=1;let a=c[0];
  for(let i=1;i<g+2;i++)a+=c[i]/(x+i);
  const t=x+g+0.5;
  return 0.5*Math.log(2*Math.PI)+(x+0.5)*Math.log(t)-t+Math.log(a);
}
function betaIncomplete(a,b,x){
  if(x<0||x>1)return 0;
  if(x===0||x===1)return x;
  const bt=Math.exp(gammaLn(a+b)-gammaLn(a)-gammaLn(b)+a*Math.log(x)+b*Math.log(1-x));
  if(x<(a+1)/(a+b+2))return bt*betaCF(a,b,x)/a;
  return 1-bt*betaCF(b,a,1-x)/b;
}
function betaCF(a,b,x){
  const maxIter=100,eps=3e-14;
  let m,m2,aa,c,d,del,h;
  const qab=a+b,qap=a+1,qam=a-1;
  c=1;d=1;h=1-qab*x/(a+1);
  for(m=1;m<=maxIter;m++){
    m2=2*m;
    aa=m*(b-m)*x/((qam+m2)*(a+m2));
    d=1+aa*d;if(Math.abs(d)<1e-30)d=1e-30;
    c=1+aa/c;if(Math.abs(c)<1e-30)c=1e-30;
    d=1/d;h*=d*c;
    aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2));
    d=1+aa*d;c=1+aa/c;
    if(Math.abs(d)<1e-30)d=1e-30;
    if(Math.abs(c)<1e-30)c=1e-30;
    d=1/d;del=d*h;
    h*=del;
    if(Math.abs(del-1)<eps)break;
  }
  return h;
}
function tDistributeCDF(t,df){
  const x=df/(df+t*t);
  return 1-0.5*betaIncomplete(df/2,0.5,x);
}
function tTestPaired(arr1,arr2){
  if(arr1.length!==arr2.length||arr1.length<2)return null;
  const n=arr1.length;
  const diffs=arr1.map((v,i)=>v-arr2[i]);
  const m=mean(diffs);
  const s=stdev(diffs,m);
  if(s===0)return null;
  const tStat=m/(s/Math.sqrt(n));
  const df=n-1;
  const pValue=2*(1-tDistributeCDF(Math.abs(tStat),df));
  return{t:tStat,df,pValue,significant:pValue<0.05};
}
function calculateICC(values){
  const k=values.length;
  if(k<2)return null;
  const n=values[0].length;
  if(n<2)return null;
  const grandMean=mean(values.flat());
  const rowMeans=values.map(row=>mean(row));
  const colMeans=Array(n).fill(0).map((_,j)=>mean(values.map(row=>row[j])));
  const SSB=k*mean(rowMeans.map((rm)=>(rm-grandMean)**2));
  const SSC=n*mean(colMeans.map((cm)=>(cm-grandMean)**2));
  const SST=values.flat().reduce((s,x)=>s+(x-grandMean)**2,0);
  const SSW=SST-SSB-SSC;
  const MSB=SSB/(k-1);
  const MSC=SSC/(n-1);
  const MSW=SSW/((k-1)*(n-1));
  if(MSW===0)return null;
  const rA=(MSB-MSW)/(MSB+(n-1)*MSW);
  const rC=(MSC-MSW)/(MSC+(k-1)*MSW);
  const rK=(MSB-MSW)/MSB;
  const rM=(MSC-MSW)/MSC;
  return{ICC_Absolute:rA,ICC_Consistency:rC,ICC_Average:rK,ICC_Consistency_Avg:rM,interpretation:getICCInterpretation(rA||rC)};
}
function getICCInterpretation(icc){
  if(icc<0)return"Poor";
  if(icc<0.5)return"Poor";
  if(icc<0.75)return"Moderate";
  if(icc<0.9)return"Good";
  return"Excellent";
}
function dahlbergError(arr1,arr2){
  if(arr1.length!==arr2.length)return null;
  const n=arr1.length;
  if(n<2)return null;
  const sumSq=arr1.reduce((s,v,i)=>s+(v-arr2[i])**2,0);
  return{error:Math.sqrt(sumSq/(2*n)),n};
}
function blandAltman(arr1,arr2){
  if(arr1.length!==arr2.length||arr1.length<2)return null;
  const diffs=arr1.map((v,i)=>v-arr2[i]);
  const means=arr1.map((v,i)=>(v+arr2[i])/2);
  const m=mean(diffs);
  const s=stdev(diffs,m);
  const loa=m-1.96*s;
  const loa2=m+1.96*s;
  return{meanDiff:m,stdDiff:s,lowerLOA:loa,upperLOA:loa2,means,minMean:Math.min(...means),maxMean:Math.max(...means)};
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROJECT MODEL
// ═══════════════════════════════════════════════════════════════════════════════
function mkVersion(label="T0",name="Initial"){
  return{id:uid(),name,label,timestamp:Date.now(),calibration:{done:false,pxPerMm:1,knownMm:""},
    markups:[],analysisTemplate:"blank",
    processing:{brightness:0,contrast:0,windowWidth:0,windowCenter:128,edgeEnhance:0},
    lutMode:"gray",lutInvert:false,formulas:[],norms:[]};
}
function mkProject(projection){
  const v=mkVersion();
  return{id:uid(),name:"New Case",projection,created:Date.now(),modified:Date.now(),
    meta:{patientId:"",name:"",dob:"",age:"",gender:"",ethnicity:"",clinician:"",facility:"",referral:"",notes:"",anonymized:false},
    accessControl:{requirePin:false,pinHash:""},
    activeVersionId:v.id,versions:[v],images:[]};
}

async function hashPin(pin){
  const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
}

function exportCephx(project){
  const payload={format:"cephx",version:"2.0",exported:Date.now(),project};
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));
  a.download=`${project.name.replace(/\s+/g,"_")}.cephx`;a.click();
}
function importCephx(file,onLoad){
  const reader=new FileReader();
  reader.onload=e=>{try{const d=JSON.parse(e.target.result);if(d.format==="cephx"&&d.project)onLoad(d.project);else alert("Invalid .cephx file");}catch{alert("Cannot parse file");}};
  reader.readAsText(file);
}
function exportCepht(template){
  const payload={format:"cepht",version:"1.0",exported:Date.now(),...template};
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));
  a.download=`${template.name.replace(/\s+/g,"_")}.cepht`;a.click();
}
function importCepht(file,onLoad){
  const reader=new FileReader();
  reader.onload=e=>{try{const d=JSON.parse(e.target.result);if(d.format==="cepht")onLoad(d);else alert("Invalid .cepht file");}catch{alert("Cannot parse template");}};
  reader.readAsText(file);
}
function exportThemeAsCepht(currentTheme){
  const theme=THEMES[currentTheme];
  const template={name:`${theme.name} Theme`,projection:"lateral",markups:[],formulas:[],norms:[]};
  const payload={format:"cepht",version:"1.0",exported:Date.now(),theme,isThemeExport:true,...template};
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));
  a.download=`${theme.name.replace(/\s+/g,"_")}_theme.cepht`;a.click();
}

// ═══════════════════════════════════════════════════════════════════════════════
// THEMES
// ═══════════════════════════════════════════════════════════════════════════════
const THEMES={
  dark:{name:"GitHub Dark",id:"dark",bg:"#0d1117",surf:"#161b22",surf2:"#21262d",surf3:"#30363d",bdr:"#30363d",tx:"#c9d1d9",tx2:"#8b949e",tx3:"#6e7681",acc:"#58a6ff",acc2:"#388bfd",accMuted:"rgba(88,166,255,0.1)",err:"#f85149",ok:"#3fb950",warn:"#d29922",shadow:"rgba(0,0,0,0.4)",inHeader:true},
  light:{name:"GitHub Light",id:"light",bg:"#e8eaed",surf:"#f6f8fa",surf2:"#ffffff",surf3:"#d0d7de",bdr:"#d0d7de",tx:"#24292f",tx2:"#57606a",tx3:"#8c959f",acc:"#0969da",acc2:"#0550ae",accMuted:"rgba(9,105,218,0.1)",err:"#cf222e",ok:"#1a7f37",warn:"#9a6700",shadow:"rgba(0,0,0,0.08)",inHeader:true},
  bluish:{name:"Plasticity",id:"bluish",bg:"#0f0f12",surf:"#1a1a22",surf2:"#252530",surf3:"#323242",bdr:"#404058",tx:"#e4e4ef",tx2:"#9999ad",tx3:"#6a6a80",acc:"#a855f7",acc2:"#9333ea",accMuted:"rgba(168,85,247,0.15)",err:"#f87171",ok:"#4ade80",warn:"#fbbf24",shadow:"rgba(0,0,0,0.6)",inHeader:true},
  mocha:{name:"Mocha",id:"mocha",bg:"#37353e",surf:"#44444e",surf2:"#38383f",surf3:"#555560",bdr:"#555560",tx:"#d3dad9",tx2:"#a0a5a8",tx3:"#6e7476",acc:"#715a5a",acc2:"#8a6a6a",accMuted:"rgba(113,90,90,0.15)",err:"#e57373",ok:"#81c784",warn:"#ffb74d",shadow:"rgba(0,0,0,0.5)",inHeader:false},
  sage:{name:"Sage",id:"sage",bg:"#d6dac8",surf:"#e8eadd",surf2:"#fbf3d5",surf3:"#c4cbb8",bdr:"#b8c0ad",tx:"#3a3a35",tx2:"#5c5c58",tx3:"#8a8a85",acc:"#9cafaa",acc2:"#7a9188",accMuted:"rgba(156,175,170,0.15)",err:"#d4847c",ok:"#7a9e7a",warn:"#c9a855",shadow:"rgba(0,0,0,0.1)",inHeader:false},
};

// ═══════════════════════════════════════════════════════════════════════════════
// TOOLS
// ═══════════════════════════════════════════════════════════════════════════════
const TOOLS=[
  {id:"select",icon:"⊹",label:"Select/Move",key:"v"},
  {id:"pan",icon:"⊕",label:"Pan",key:"h"},
  null,
  {id:"point",icon:"◉",label:"Landmark",key:"p"},
  {id:"line",icon:"⟋",label:"Line/Plane",key:"l"},
  {id:"perppoint",icon:"⊦",label:"Perp Point",key:"j"},
  {id:"midpoint",icon:"◈",label:"Midpoint",key:"m"},
  {id:"arrow",icon:"→",label:"Arrow",key:"a"},
  {id:"angle3",icon:"∠",label:"Angle 3-pt",key:"3"},
  {id:"angle4",icon:"∡",label:"Angle 4-pt",key:"4"},
  {id:"perp",icon:"⊥",label:"Perp Dist",key:"d"},
  {id:"parallel",icon:"⫿",label:"Parallel",key:"q"},
  {id:"polygon",icon:"⬡",label:"Polygon",key:"g"},
  {id:"curve",icon:"∿",label:"Curve",key:"c"},
  {id:"text",icon:"T",label:"Text",key:"t"},
  null,
  {id:"ruler",icon:"⟺",label:"Ruler/Cal",key:"r"},
];

const PREDEFINED={
  lateral:[
    {name:"General Ceph Analysis",pts:[
      {l:"N",def:"Nasion - the most anterior point of the frontonasal suture in the middle.",color:"#f59e0b"},
      {l:"S",def:"Sella - the geometric center of the pituitary fossa (sella turcica).",color:"#f59e0b"},
      {l:"Ba",def:"Basion - most inferior posterior point of the occipital bone.",color:"#f59e0b"},
      {l:"Or",def:"Orbitale - the lowest point on the inferior margin of the orbit.",color:"#60a5fa"},
      {l:"Po",def:"Porion - the superior point of the external auditory meatus.",color:"#60a5fa"},
      {l:"Ar",def:"Articulare - the point of intersection of the posterior border of the condylar process and the inferior border of the basilar part of the occipital bone.",color:"#60a5fa"},
      {l:"A",def:"Point A - the deepest point on the curve of the maxilla.",color:"#34d399"},
      {l:"B",def:"Point B - the deepest midline point on the mandible.",color:"#34d399"},
      {l:"ANS",def:"Anterior nasal spine - tip of the bony anterior nasal spine.",color:"#34d399"},
      {l:"PNS",def:"Posterior nasal spine - intersection of palatum posterior and fossa pterygopalatina.",color:"#34d399"},
      {l:"Pog",def:"Pogonion - the most anterior point on the chin.",color:"#a78bfa"},
      {l:"Gn",def:"Gnathion - a point on the chin determined by bisecting the facial and mandibular planes.",color:"#a78bfa"},
      {l:"Me",def:"Menton - the most inferior midline point on the mandibular symphysis.",color:"#a78bfa"},
      {l:"Go",def:"Gonion - the point of intersection of the ramus plane and the mandibular plane.",color:"#a78bfa"},
      {l:"Co",def:"Condylion - the most superior point of the mandibular condyle.",color:"#34d399"},
      {l:"Is",def:"Incision superius - the incisal point of the most prominent maxillary central incisor.",color:"#fb923c"},
      {l:"Ii",def:"Incision inferius - the incisal point of the most prominent mandibular central incisor.",color:"#f472b6"},
      {l:"Prn",def:"Pronasale - the most protruded point of the apex nasi.",color:"#f472b6"},
      {l:"Sn",def:"Subnasale - midpoint of the columella base at the apex of the nasolabial angle.",color:"#f472b6"},
      {l:"Ss",def:"Superior sulcus - the deepest midline point between subnasion and the vermilion border.",color:"#f472b6"},
      {l:"Stms",def:"Stomion superius - the lowermost point on the vermilion of the upper lip.",color:"#f472b6"},
      {l:"Stmi",def:"Stomion inferius - the uppermost point on the vermilion of the lower lip.",color:"#f472b6"},
      {l:"Si",def:"Sulpion - the point of greatest concavity in the midline between the lower lip and chin.",color:"#f472b6"},
      {l:"TMJ",def:"Temporomandibular joint point - on the contour of the glenoid fossa.",color:"#60a5fa"},
      {l:"Ids",def:"Infradentale superius - the highest point on the alveolar crest between the mandibular central incisors.",color:"#f472b6"},
      {l:"Pr",def:"Prosthion - the most anterior point on the maxillary alveolar process.",color:"#34d399"},
    ],
    lines:[
      {l:"Sella-Nasion line",def:"Line connecting Sella to Nasion.",color:"#f59e0b"},
      {l:"Frankfort Horizontal",def:"Plane connecting Porion to Orbitale.",color:"#60a5fa"},
      {l:"NBa plane",def:"Plane connecting Nasion to Basion.",color:"#f59e0b"},
      {l:"Mandibular plane",def:"Plane connecting Gonion to Menton.",color:"#a78bfa"},
    ]},
    {name:"Steiner Analysis",pts:[
      {l:"N",def:"Nasion is the most anterior point of the frontonasal suture in the middle.",color:"#f59e0b"},
      {l:"S",def:"The center of sella turcica (the midpoint of the horizontal diameter).",color:"#f59e0b"},
      {l:"A",def:"The deepest midline point on the premaxilla between the anterior nasal spine and prosthion.",color:"#60a5fa"},
      {l:"B",def:"The deepest midline point on the mandible between infradentale and pogonion.",color:"#60a5fa"},
      {l:"ANS",def:"Anterior nasal spine is the tip of bony anterior nasal spine in the midline or median plane.",color:"#34d399"},
      {l:"PNS",def:"Posterior nasal spine is the intersection of a continuation of the anterior wall of the pterygopalatine fossa and the floor of the nose.",color:"#34d399"},
      {l:"Pog",def:"The most anterior point on the chin.",color:"#a78bfa"},
      {l:"Gn",def:"A point on the chin determined by bisecting the angle formed by the facial and mandibular planes.",color:"#a78bfa"},
      {l:"Me",def:"The most inferior midline point on the mandibular symphysis.",color:"#a78bfa"},
      {l:"Go",def:"The point of intersection of the ramus plane and the mandibular plane.",color:"#a78bfa"},
      {l:"Is",def:"The incisal point of the most prominent medial maxillary incisor.",color:"#fb923c"},
      {l:"Ii",def:"The incisal point of the most prominent medial mandibular incisor.",color:"#f472b6"},
    ]},
    {name:"Ricketts Analysis",pts:[
      {l:"N",def:"Nasion is the most anterior point of the frontonasal suture in the middle.",color:"#f59e0b"},
      {l:"S",def:"The point representing the geometric center of the pituitary fossa (sella turcica).",color:"#f59e0b"},
      {l:"Ba",def:"Most inferior posterior point of the occipital bone.",color:"#f59e0b"},
      {l:"Or",def:"The lowest point on the inferior margin of the orbit.",color:"#60a5fa"},
      {l:"Po",def:"The superior point of the external auditory meatus (superior margin of temporomandibular fossa).",color:"#60a5fa"},
      {l:"Ar",def:"The point of intersection of the images of the posterior border of the condylar process of the mandible and the inferior border of the basilar part of the occipital bone.",color:"#60a5fa"},
      {l:"A",def:"The deepest point on the curve of the maxilla between the anterior nasal spine and the dental alveolus.",color:"#34d399"},
      {l:"B",def:"The deepest midline point on the mandible between infradentale and pogonion.",color:"#34d399"},
      {l:"ANS",def:"Tip of the anterior nasal spine.",color:"#34d399"},
      {l:"PNS",def:"The intersection of palatum posterior durum, palatum molle and fossa pterygopalatina.",color:"#34d399"},
      {l:"Pog",def:"Most anterior point on the midsagittal symphysis tangent to the facial plane.",color:"#a78bfa"},
      {l:"Gn",def:"The most inferior point on the contour of the chin.",color:"#a78bfa"},
      {l:"Me",def:"The most inferior midline point on the mandibular symphysis.",color:"#a78bfa"},
      {l:"Go",def:"The point of intersection of the ramus plane and the mandibular plane.",color:"#a78bfa"},
    ]},
    {name:"McNamara Analysis",pts:[
      {l:"N",def:"Nasion is the most anterior point of the frontonasal suture in the middle.",color:"#f59e0b"},
      {l:"A",def:"The deepest point on the curve of the maxilla between the anterior nasal spine and the dental alveolus.",color:"#60a5fa"},
      {l:"B",def:"The deepest midline point on the mandible between infradentale and pogonion.",color:"#60a5fa"},
      {l:"Pog",def:"The most anterior point on the mandible in the midline.",color:"#a78bfa"},
      {l:"Me",def:"The most inferior midline point on the mandibular symphysis.",color:"#a78bfa"},
      {l:"Co",def:"The most superior point of the mandibular condyle.",color:"#34d399"},
      {l:"ANS",def:"Tip of the anterior nasal spine.",color:"#34d399"},
      {l:"PNS",def:"The intersection of palatum posterior durum, palatum molle and fossa pterygopalatina.",color:"#34d399"},
    ]},
    {name:"Downs Analysis",pts:[
      {l:"N",def:"Nasion is the most anterior point of the frontonasal suture in the middle.",color:"#f59e0b"},
      {l:"S",def:"Located by inspection of the profile image of the fossa.",color:"#f59e0b"},
      {l:"Or",def:"The lowest point on the left infraorbital margin.",color:"#60a5fa"},
      {l:"Po",def:"The highest point on the superior surface of the soft tissue of the external auditory meati.",color:"#60a5fa"},
      {l:"A",def:"The deepest midline point on the premaxilla between the anterior nasal spine and prosthion.",color:"#34d399"},
      {l:"B",def:"The deepest midline point on the mandible between infradentale and pogonion.",color:"#34d399"},
      {l:"Pog",def:"The most anterior point on the mandible in the midline.",color:"#a78bfa"},
      {l:"Gn",def:"A point on the chin determined by bisecting the angle formed by the facial and mandibular planes.",color:"#a78bfa"},
      {l:"Me",def:"The most inferior midline point on the mandibular symphysis.",color:"#a78bfa"},
      {l:"Go",def:"The point of intersection of the ramus plane and the mandibular plane.",color:"#a78bfa"},
    ]},
    {name:"Bjork Analysis",pts:[
      {l:"Ar",def:"The point of intersection of the dorsal contours of processus articularis mandibulae and os temporale. The midpoint is used where double projection gives rise to two articulare points.",color:"#60a5fa"},
      {l:"N",def:"Nasion is the most anterior point of the frontonasal suture in the middle.",color:"#f59e0b"},
      {l:"S",def:"The center of sella turcica (the midpoint of the horizontal diameter).",color:"#f59e0b"},
      {l:"Or",def:"The deepest point on the infraorbital margin. The midpoint is used where double projection gives rise to two points.",color:"#60a5fa"},
      {l:"Po",def:"Porion is the most superior point of the external auditory meatus (the superior margin of the TMJ fossa, which lies at the same level may be substitute in the construction of the FH).",color:"#60a5fa"},
      {l:"A",def:"The deepest point on the contour of the alveolar projection, between the spinal point and prosthion.",color:"#34d399"},
      {l:"B",def:"The deepest point on the contour of the alveolar projection, between infradentale and pogonion.",color:"#34d399"},
      {l:"ANS",def:"The apex of spina nasalis anterior.",color:"#34d399"},
      {l:"PNS",def:"Posterior spine of palatum durum.",color:"#34d399"},
      {l:"Pog",def:"The most anterior point on the chin.",color:"#a78bfa"},
      {l:"Gn",def:"A point on the chin determined by bisecting the angle formed by the facial and mandibular planes.",color:"#a78bfa"},
      {l:"Me",def:"The most inferior midline point on the mandibular symphysis.",color:"#a78bfa"},
      {l:"Go",def:"The point of intersection of the ramus plane and the mandibular plane.",color:"#a78bfa"},
    ]},
    {name:"Tweed Analysis",pts:[
      {l:"N",def:"Nasion is the most anterior point of the frontonasal suture in the middle.",color:"#f59e0b"},
      {l:"Or",def:"The lowest point on the left infraorbital margin.",color:"#60a5fa"},
      {l:"Po",def:"The highest point on the superior surface of the soft tissue of the external auditory meati.",color:"#60a5fa"},
      {l:"Me",def:"The most inferior midline point on the mandibular symphysis.",color:"#a78bfa"},
      {l:"Go",def:"The point of intersection of the ramus plane and the mandibular plane.",color:"#a78bfa"},
      {l:"Xi",def:"The midpoint of the Xi path (a small round radiopacity representing the intersection of the ramus plane with the posterior border of the mandibular canal).",color:"#34d399"},
      {l:"Pog",def:"The most anterior point on the chin.",color:"#a78bfa"},
    ]},
    {name:"Jarv-Bjork",pts:[
      {l:"N",def:"Nasion is the most anterior point of the frontonasal suture in the middle.",color:"#f59e0b"},
      {l:"S",def:"The center of sella turcica (the midpoint of the horizontal diameter).",color:"#f59e0b"},
      {l:"Ba",def:"Most inferior posterior point of the occipital bone.",color:"#f59e0b"},
      {l:"Ar",def:"The point of intersection of the dorsal contours of processus articularis mandibulae and os temporale.",color:"#60a5fa"},
      {l:"Or",def:"The deepest point on the infraorbital margin.",color:"#60a5fa"},
      {l:"Po",def:"Porion is the most superior point of the external auditory meatus.",color:"#60a5fa"},
      {l:"PNS",def:"Posterior spine of palatum durum.",color:"#34d399"},
      {l:"ANS",def:"The apex of spina nasalis anterior.",color:"#34d399"},
      {l:"A",def:"The deepest point on the contour of the alveolar projection.",color:"#34d399"},
      {l:"B",def:"The deepest point on the contour of the alveolar projection.",color:"#34d399"},
      {l:"Pog",def:"The most anterior point on the chin.",color:"#a78bfa"},
      {l:"Gn",def:"A point on the chin determined by bisecting the angle formed by the facial and mandibular planes.",color:"#a78bfa"},
      {l:"Me",def:"The most inferior midline point on the mandibular symphysis.",color:"#a78bfa"},
      {l:"Go",def:"The point of intersection of the ramus plane and the mandibular plane.",color:"#a78bfa"},
    ]},
    {name:"Wits Analysis",pts:[
      {l:"A",def:"The deepest point on the contour of the alveolar projection.",color:"#34d399"},
      {l:"B",def:"The deepest point on the contour of the mandibular symphysis.",color:"#34d399"},
      {l:"Po",def:"The highest point on the superior surface of the soft tissue of the external auditory meati.",color:"#60a5fa"},
      {l:"Or",def:"The lowest point on the left infraorbital margin.",color:"#60a5fa"},
      {l:"Ba",def:"Most inferior posterior point of the occipital bone.",color:"#f59e0b"},
      {l:"N",def:"Nasion is the most anterior point of the frontonasal suture in the middle.",color:"#f59e0b"},
    ]},
  ],
  ap:[
    {name:"Ricketts",pts:[
      {l:"Crg",def:"Crista galli - the most superior point of the Crista galli.",color:"#f59e0b"},
      {l:"ANS",def:"Anterior nasal spine - tip of the anterior nasal spine.",color:"#60a5fa"},
      {l:"A",def:"Point A - the deepest point on the curve of the maxilla.",color:"#60a5fa"},
      {l:"Me",def:"Menton - the most inferior midline point on the mandibular symphysis.",color:"#a78bfa"},
      {l:"Z-R",def:"The most internal (medial) point of the frontozygomatic suture on the right side.",color:"#fb923c"},
      {l:"Z-L",def:"The most internal (medial) point of the frontozygomatic suture on the left side.",color:"#fb923c"},
      {l:"ZA-R",def:"The most external (lateral) border of the zygomatic arch on the right side.",color:"#fb923c"},
      {l:"ZA-L",def:"The most external (lateral) border of the zygomatic arch on the left side.",color:"#fb923c"},
      {l:"J-R",def:"The deepest point of the lateral contour of the maxillary alveolar process on the right side.",color:"#60a5fa"},
      {l:"J-L",def:"The deepest point of the lateral contour of the maxillary alveolar process on the left side.",color:"#60a5fa"},
      {l:"AG-R",def:"The deepest point of the antegonial notch on the lower border of the right mandible.",color:"#a78bfa"},
      {l:"AG-L",def:"The deepest point of the antegonial notch on the lower border of the left mandible.",color:"#a78bfa"},
      {l:"NC-R",def:"The widest lateral point of the nasal cavity on the right side.",color:"#f472b6"},
      {l:"NC-L",def:"The widest lateral point of the nasal cavity on the left side.",color:"#f472b6"},
    ]},
    {name:"General PA Analysis",pts:[
      {l:"ag-R",def:"The highest point in the antegonial notch on the right side.",color:"#a78bfa"},
      {l:"ag-L",def:"The highest point in the antegonial notch on the left side.",color:"#a78bfa"},
      {l:"ANS",def:"The center of the intersection of the nasal septum and the palate.",color:"#60a5fa"},
      {l:"cd/Con-R",def:"The most superior and the middle point on the contour of the right condyle head.",color:"#34d399"},
      {l:"cd/Con-L",def:"The most superior and the middle point on the contour of the left condyle head.",color:"#34d399"},
      {l:"Cg",def:"The most superior and anterior points on the median ridge of the bone that projects upward from the cribriform plate of the ethmoid bone.",color:"#f59e0b"},
      {l:"cor-R",def:"The most superior point of the coronoid process on the right side.",color:"#fb923c"},
      {l:"cor-L",def:"The most superior point of the coronoid process on the left side.",color:"#fb923c"},
      {l:"Go-R",def:"The most posterior inferior point of the right mandibular angle.",color:"#a78bfa"},
      {l:"Go-L",def:"The most posterior inferior point of the left mandibular angle.",color:"#a78bfa"},
      {l:"iif/L1M",def:"The dental midline point of the incisal edge of the mandibular central incisor.",color:"#f472b6"},
      {l:"isf/U1M",def:"The dental midline point of the incisal edge of the maxillary central incisor.",color:"#fb923c"},
      {l:"Jug-R",def:"The right intersection of the tuberosity of maxilla and zygomatic buttress.",color:"#60a5fa"},
      {l:"Jug-L",def:"The left intersection of the tuberosity of maxilla and zygomatic buttress.",color:"#60a5fa"},
      {l:"lm/L6MC-R",def:"The most lateral cusp point of the right mandibular first molar crown.",color:"#f472b6"},
      {l:"lm/L6MC-L",def:"The most lateral cusp point of the left mandibular first molar crown.",color:"#f472b6"},
      {l:"lo-R",def:"The intersection of the lateral orbital contour with the innominate line on the right side.",color:"#60a5fa"},
      {l:"lo-L",def:"The intersection of the lateral orbital contour with the innominate line on the left side.",color:"#60a5fa"},
      {l:"lpa-R",def:"The most lateral aspect of the piriform aperture on the right side.",color:"#f472b6"},
      {l:"lpa-L",def:"The most lateral aspect of the piriform aperture on the left side.",color:"#f472b6"},
      {l:"m",def:"Located by projecting the mental spine on the lower mandibular border, perpendicular to the line ag-ag.",color:"#a78bfa"},
      {l:"ma/Mst-R",def:"The most inferior point of the right mastoid process.",color:"#34d399"},
      {l:"ma/Mst-L",def:"The most inferior point of the left mastoid process.",color:"#34d399"},
      {l:"Me",def:"The most inferior point of the symphysis of the mandible.",color:"#a78bfa"},
      {l:"mf-R",def:"The centre of the mental foramen on the right side.",color:"#a78bfa"},
      {l:"mf-L",def:"The centre of the mental foramen on the left side.",color:"#a78bfa"},
      {l:"mo-R",def:"The point on the medial orbital margin that is closest to the median plane on the right side.",color:"#60a5fa"},
      {l:"mo-L",def:"The point on the medial orbital margin that is closest to the median plane on the left side.",color:"#60a5fa"},
      {l:"mx-R",def:"The intersection of the lateral contour of the maxillary alveolar process and the lower contour of the maxillozygomatic process of the maxilla on the right side.",color:"#60a5fa"},
      {l:"mx-L",def:"The intersection of the lateral contour of the maxillary alveolar process and the lower contour of the maxillozygomatic process of the maxilla on the left side.",color:"#60a5fa"},
      {l:"mzmf-R",def:"Point at the medial margin of the zygomaticofrontal suture on the right side.",color:"#f59e0b"},
      {l:"mzmf-L",def:"Point at the medial margin of the zygomaticofrontal suture on the left side.",color:"#f59e0b"},
      {l:"lzmf-R",def:"Point at the lateral margin of the zygomaticofrontal suture on the right side.",color:"#f59e0b"},
      {l:"lzmf-L",def:"Point at the lateral margin of the zygomaticofrontal suture on the left side.",color:"#f59e0b"},
      {l:"om",def:"The projection on the line lo-lo of the top of the nasal septum at the base of the crista galli.",color:"#f59e0b"},
      {l:"Sph-R",def:"The right intersection of sphenoid bone greater and lesser wing.",color:"#f59e0b"},
      {l:"Sph-L",def:"The left intersection of sphenoid bone greater and lesser wing.",color:"#f59e0b"},
      {l:"tns",def:"The highest point on the superior aspect of the nasal septum.",color:"#f59e0b"},
      {l:"um/U6MC-R",def:"The most lateral cusp point of the right maxillary first molar crown.",color:"#fb923c"},
      {l:"um/U6MC-L",def:"The most lateral cusp point of the left maxillary first molar crown.",color:"#fb923c"},
      {l:"za-R",def:"Point at the most lateral border of the centre of the zygomatic arch on the right side.",color:"#fb923c"},
      {l:"za-L",def:"Point at the most lateral border of the centre of the zygomatic arch on the left side.",color:"#fb923c"},
    ]},
    {name:"Grummons Frontal Asymmetry",pts:[
      {l:"Cg",def:"The most superior point of the crista galli, used to construct the mid-sagittal reference (MSR) line.",color:"#f59e0b"},
      {l:"ANS",def:"The tip of the anterior nasal spine, used with Cg to establish the mid-sagittal reference (MSR) line.",color:"#60a5fa"},
      {l:"Co-R",def:"The most superior point on the condylar head of the right mandible.",color:"#34d399"},
      {l:"Co-L",def:"The most superior point on the condylar head of the left mandible.",color:"#34d399"},
      {l:"Z-R",def:"The medial margin of the zygomaticofrontal suture on the right side.",color:"#fb923c"},
      {l:"Z-L",def:"The medial margin of the zygomaticofrontal suture on the left side.",color:"#fb923c"},
      {l:"J-R",def:"The intersection of the outline of the maxillary tuberosity and the zygomatic buttress on the right side.",color:"#60a5fa"},
      {l:"J-L",def:"The intersection of the outline of the maxillary tuberosity and the zygomatic buttress on the left side.",color:"#60a5fa"},
      {l:"Ag-R",def:"The highest point of the antegonial notch on the right side.",color:"#a78bfa"},
      {l:"Ag-L",def:"The highest point of the antegonial notch on the left side.",color:"#a78bfa"},
      {l:"Me",def:"The lowest point on the symphyseal shadow of the mandible.",color:"#a78bfa"},
    ]},
    {name:"Hewitt",pts:[
      {l:"N",def:"The most anterior point of the frontonasal suture, used to assess upper facial symmetry.",color:"#f59e0b"},
      {l:"ANS",def:"The tip of the anterior nasal spine, used as a central point for mid-face symmetry triangulation.",color:"#60a5fa"},
      {l:"Me",def:"The most inferior point on the mandibular symphysis, used for lower facial triangulation.",color:"#a78bfa"},
      {l:"Cd-R",def:"The most superior point of the condylar head on the right side.",color:"#34d399"},
      {l:"Cd-L",def:"The most superior point of the condylar head on the left side.",color:"#34d399"},
      {l:"Go-R",def:"The most lateral and inferior point of the mandibular angle on the right side.",color:"#a78bfa"},
      {l:"Go-L",def:"The most lateral and inferior point of the mandibular angle on the left side.",color:"#a78bfa"},
    ]},
    {name:"Svanholt-Solow",pts:[
      {l:"Mx-R",def:"The deepest point on the lateral contour of the right maxilla.",color:"#60a5fa"},
      {l:"Mx-L",def:"The deepest point on the lateral contour of the left maxilla.",color:"#60a5fa"},
      {l:"Lo-R",def:"The intersection of the lateral orbital contour with the innominate line on the right side.",color:"#60a5fa"},
      {l:"Lo-L",def:"The intersection of the lateral orbital contour with the innominate line on the left side.",color:"#60a5fa"},
      {l:"Upper dental midline",def:"The midpoint between the central incisors on the maxillary arch.",color:"#fb923c"},
      {l:"Lower dental midline",def:"The midpoint between the central incisors on the mandibular arch.",color:"#f472b6"},
    ]},
    {name:"Grayson Multiplane",pts:[
      {l:"N",def:"The most anterior point of the frontonasal suture in the midline.",color:"#f59e0b"},
      {l:"ANS",def:"The most anterior point of the anterior nasal spine.",color:"#60a5fa"},
      {l:"Pr",def:"The most inferior anterior point on the maxillary alveolar process between the central incisors.",color:"#fb923c"},
      {l:"Id",def:"The highest and most anterior point on the mandibular alveolar process between the central incisors.",color:"#f472b6"},
      {l:"Me",def:"The lowest point on the mandibular symphysis.",color:"#a78bfa"},
      {l:"Zf-R",def:"The junction of the zygomatic and frontal bones at the lateral orbital rim on the right side.",color:"#fb923c"},
      {l:"Zf-L",def:"The junction of the zygomatic and frontal bones at the lateral orbital rim on the left side.",color:"#fb923c"},
    ]},
  ],
  other:[
    {group:"Standard Orthodontic & Orthognathic",projections:[
      {name:"Submentovertex (SMV)",def:"Evaluating cranial base symmetry, condylar angulation, and transverse discrepancies from a bottom-up angle.",color:"#f59e0b"},
      {name:"Panoramic Radiograph (OPG)",def:"Providing a broad overview of the dentition, jaws, and vertical ramal/condylar asymmetries.",color:"#60a5fa"},
    ]},
    {group:"TMJ-Specific",projections:[
      {name:"Transcranial View (Schüller)",def:"Evaluating the lateral aspect of the TMJ and condylar position/translation.",color:"#34d399"},
      {name:"Transpharyngeal View (Parma)",def:"Providing a clear view of the condylar head and neck across the pharynx.",color:"#a78bfa"},
      {name:"Transorbital View (Zimmer)",def:"Viewing the TMJ from an anterior-to-posterior perspective through the orbit.",color:"#fb923c"},
    ]},
    {group:"Specialized Cranial & Midface",projections:[
      {name:"Waters View",def:"Examining the midface, maxillary sinuses, and zygomatic arches.",color:"#f472b6"},
      {name:"Caldwell View",def:"Evaluating the frontal and ethmoid sinuses, as well as lateral orbital walls.",color:"#c084fc"},
      {name:"Towne's View",def:"Checking for medial/lateral condylar displacement and evaluating the occipital bone.",color:"#22d3ee"},
    ]},
    {group:"Growth & Skeletal Maturation",projections:[
      {name:"Hand-Wrist Radiograph",def:"Assessing skeletal bone age and pubertal growth stages.",color:"#fbbf24"},
    ]},
    {group:"Modern 3D Imaging",projections:[
      {name:"CBCT Derived Views",def:"A single 3D volumetric scan that digitally recreates 2D views without superimposition or magnification.",color:"#34d399"},
    ]},
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED UI
// ═══════════════════════════════════════════════════════════════════════════════
function Btn({onClick,children,style,active,small,danger,t,disabled,title}){
  const[hov,setHov]=useState(false);
  return(
    <button onClick={onClick} disabled={disabled} title={title}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{background:active?t.acc:hov?"rgba(255,255,255,0.07)":"transparent",
        color:active?(t.id==="light"?"#fff":t.bg):danger?t.err:hov?t.tx:t.tx2,
        border:`1px solid ${active?t.acc:hov?t.bdr+"cc":t.bdr}`,
        borderRadius:6,padding:small?"6px 10px":"8px 16px",fontSize:small?13:15,cursor:disabled?"not-allowed":"pointer",
        fontFamily:"inherit",fontWeight:500,transition:"all 0.15s",opacity:disabled?0.5:1,
        boxShadow:hov&&!disabled?`0 2px 8px ${t.shadow}`:"none",...style}}>
      {children}
    </button>
  );
}

const Tag=({color,children})=>(<span style={{background:color+"22",color,border:`1px solid ${color}44`,borderRadius:4,padding:"2px 8px",fontSize:12,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{children}</span>);
const Sld=({label,value,min,max,step=1,onChange,t,unit=""})=>(
  <div style={{marginBottom:8}}>
    <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:t.tx2,marginBottom:3}}>
      <span>{label}</span><span style={{fontFamily:"'DM Mono',monospace",color:t.acc}}>{typeof value==="number"?value.toFixed(step<1?1:0):value}{unit}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(+e.target.value)} style={{width:"100%",accentColor:t.acc}}/>
  </div>
);
const PropRow=({label,children,t})=>(<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}><div style={{width:64,fontSize:11,color:t.tx2,flexShrink:0}}>{label}</div><div style={{flex:1}}>{children}</div></div>);
const Inp=({value,onChange,t,type="text",placeholder=""})=>(<input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{background:t.surf3,border:`1px solid ${t.bdr}`,borderRadius:4,padding:"4px 8px",color:t.tx,fontSize:12,width:"100%",fontFamily:"inherit"}}/>);
const Divider=({t})=><div style={{height:1,background:t.bdr,margin:"12px 0"}}/>;
const PanelHeader=({t,children})=><div style={{fontSize:10,fontWeight:700,color:t.tx2,textTransform:"uppercase",letterSpacing:0.8,marginBottom:8,paddingTop:4}}>{children}</div>;

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL BUTTON WITH HOVER EFFECT
// ═══════════════════════════════════════════════════════════════════════════════
function ToolBtn({tool,active,onClick,theme,t,style}){
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

// ═══════════════════════════════════════════════════════════════════════════════
// FLOATING HISTOGRAM
// ═══════════════════════════════════════════════════════════════════════════════
function FloatingHistogram({hist,t,lutMode,lutInvert,processing,onProcessingChange,onClose}){
  const[pos,setPos]=useState({x:60,y:60});const[size,setSize]=useState({w:380,h:280});
  const[dragging,setDragging]=useState(false);const[resizing,setResizing]=useState(false);
  const dragRef=useRef(null);const histCanvas=useRef(null);

  useEffect(()=>{
    const c=histCanvas.current;if(!c)return;
    const ctx=c.getContext("2d"),W=c.width,H=c.height;
    ctx.clearRect(0,0,W,H);ctx.fillStyle=t.surf3;ctx.fillRect(0,0,W,H);
    const max=Math.max(...hist,1);
    for(let i=0;i<256;i++){
      const h=hist[i]/max*H,x=i/256*W,bw=Math.max(1,W/256);
      const[r,g,b]=getLUTColor(i,lutMode,lutInvert);
      ctx.fillStyle=`rgba(${r},${g},${b},0.8)`;ctx.fillRect(x,H-h,bw+0.5,h);
    }
    if(processing.windowWidth>0){
      const lo=processing.windowCenter-processing.windowWidth/2,hi=processing.windowCenter+processing.windowWidth/2;
      const x0=lo/255*W,x1=hi/255*W;
      ctx.fillStyle="rgba(255,255,255,0.07)";ctx.fillRect(x0,0,x1-x0,H);
      ctx.strokeStyle="#ffffff66";ctx.lineWidth=1;ctx.setLineDash([3,3]);
      ctx.beginPath();ctx.moveTo(x0,0);ctx.lineTo(x0,H);ctx.moveTo(x1,0);ctx.lineTo(x1,H);ctx.stroke();ctx.setLineDash([]);
    }
    ctx.strokeStyle=t.bdr;ctx.lineWidth=1;ctx.strokeRect(0,0,W,H);
  },[hist,lutMode,lutInvert,processing,t,size]);

  const onHeaderMD=e=>{setDragging(true);dragRef.current={mx:e.clientX,my:e.clientY,px:pos.x,py:pos.y};};
  useEffect(()=>{
    if(!dragging&&!resizing)return;
    const mm=e=>{
      if(dragging&&dragRef.current)setPos({x:dragRef.current.px+(e.clientX-dragRef.current.mx),y:dragRef.current.py+(e.clientY-dragRef.current.my)});
      if(resizing&&dragRef.current)setSize({w:Math.max(260,dragRef.current.pw+(e.clientX-dragRef.current.mx)),h:Math.max(200,dragRef.current.ph+(e.clientY-dragRef.current.my))});
    };
    const mu=()=>{setDragging(false);setResizing(false);};
    window.addEventListener("mousemove",mm);window.addEventListener("mouseup",mu);
    return()=>{window.removeEventListener("mousemove",mm);window.removeEventListener("mouseup",mu);};
  },[dragging,resizing]);

  const hh=Math.max(80,size.h-140);
  return(
    <div style={{position:"fixed",left:pos.x,top:pos.y,width:size.w,background:t.surf,border:`1px solid ${t.bdr}`,borderRadius:10,boxShadow:`0 8px 32px ${t.shadow}`,zIndex:200,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div onMouseDown={onHeaderMD} style={{padding:"8px 12px",background:t.surf2,borderBottom:`1px solid ${t.bdr}`,cursor:"move",display:"flex",justifyContent:"space-between",alignItems:"center",userSelect:"none"}}>
        <span style={{fontSize:12,fontWeight:700,color:t.tx}}>Histogram</span>
        <button onClick={onClose} style={{background:"none",border:"none",color:t.tx2,cursor:"pointer",fontSize:16,lineHeight:1}}>×</button>
      </div>
      <div style={{padding:"10px 12px",flex:1,overflowY:"auto"}}>
        <canvas ref={histCanvas} width={size.w-24} height={hh} style={{width:"100%",borderRadius:4,display:"block",marginBottom:10}}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
          <Sld label="Win Center" value={processing.windowCenter} min={0} max={255} onChange={v=>onProcessingChange({...processing,windowCenter:v})} t={t}/>
          <Sld label="Win Width" value={processing.windowWidth} min={0} max={255} onChange={v=>onProcessingChange({...processing,windowWidth:v})} t={t}/>
          <Sld label="Brightness" value={processing.brightness} min={-128} max={128} onChange={v=>onProcessingChange({...processing,brightness:v})} t={t}/>
          <Sld label="Contrast" value={processing.contrast} min={-100} max={200} onChange={v=>onProcessingChange({...processing,contrast:v})} t={t}/>
        </div>
      </div>
      <div onMouseDown={e=>{setResizing(true);dragRef.current={mx:e.clientX,my:e.clientY,pw:size.w,ph:size.h};}}
        style={{position:"absolute",right:0,bottom:0,width:16,height:16,cursor:"se-resize",background:`linear-gradient(135deg,transparent 50%,${t.bdr} 50%)`,borderBottomRightRadius:10}}/>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LATEX FLOATING PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function LatexFloatingPanel({latex,onClose}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#ffffff",borderRadius:16,padding:"48px 60px",maxWidth:"80vw",minWidth:360,boxShadow:"0 32px 80px rgba(0,0,0,0.5)",position:"relative"}}>
        <button onClick={onClose} style={{position:"absolute",top:12,right:16,background:"none",border:"none",color:"#666",cursor:"pointer",fontSize:22,lineHeight:1}}>×</button>
        <div style={{color:"#111",fontSize:"40pt",fontFamily:"'KaTeX_Main',serif",textAlign:"center",lineHeight:1.4}}>
          <KatexSpan latex={latex} block fontSize={40}/>
        </div>
        <div style={{marginTop:24,padding:"8px 12px",background:"#f5f5f5",borderRadius:6,fontFamily:"monospace",fontSize:12,color:"#555",textAlign:"center",wordBreak:"break-all"}}>{latex}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CANVAS DRAWING
// ═══════════════════════════════════════════════════════════════════════════════
/** Reproducibility trial points: only visible while that trial/operator session is actively collecting. */
function isReproPointVisible(m,reproCollecting){
  if(m.type!=="point"||!m.repro)return true;
  if(!reproCollecting)return false;
  return m.repro.studyId===reproCollecting.studyId&&m.repro.opId===reproCollecting.opId&&m.repro.trialIdx===reproCollecting.trialIdx;
}

function drawMeasLabel(ctx,text,x,y,color){
  ctx.shadowColor="rgba(0,0,0,0.9)";ctx.shadowBlur=5;ctx.fillText(text,x,y);ctx.shadowBlur=0;
}

function drawMarkup(ctx,m,zoom,pan,cal,sel,t,reproCollecting,canvasSize,angleMode){
  if(m.visible===false)return;
  if(m.type==="point"&&m.repro&&!isReproPointVisible(m,reproCollecting))return;
  const sc=p=>({x:p.x*zoom+pan.x,y:p.y*zoom+pan.y});
  const fmtAngle=(v)=>{const[sign,unit]=angleMode?.split("-")||["signed","deg"];if(sign==="abs")v=Math.abs(v);else if(sign==="simple")v=Math.abs(v);else if(sign==="reflex")v=Math.abs(v)>180?360-Math.abs(v):360-Math.abs(v);if(unit==="rad")return(v*Math.PI/180).toFixed(4)+" rad";return v.toFixed(1)+"°";};
  const sp=vpts(m).map(sc);if(!sp.length)return;
  const isSel=sel===m.id;
  ctx.save();

  if(m.type==="point"){
    const p=sp[0],r=(m.size||6)*Math.sqrt(zoom);
    if(m.arrowFrom&&m.arrowFrom.x>-9000){
      const ap={x:m.arrowFrom.x*zoom+pan.x,y:m.arrowFrom.y*zoom+pan.y};
      ctx.strokeStyle=m.color||t.acc;ctx.lineWidth=2*Math.sqrt(zoom);
      ctx.beginPath();ctx.moveTo(ap.x,ap.y);ctx.lineTo(p.x,p.y);ctx.stroke();
      const angle=Math.atan2(p.y-ap.y,p.x-ap.x);
      const arrowSize=10*Math.sqrt(zoom);
      ctx.beginPath();
      ctx.moveTo(p.x,p.y);
      ctx.lineTo(p.x-arrowSize*Math.cos(angle-Math.PI/6),p.y-arrowSize*Math.sin(angle-Math.PI/6));
      ctx.lineTo(p.x-arrowSize*Math.cos(angle+Math.PI/6),p.y-arrowSize*Math.sin(angle+Math.PI/6));
      ctx.closePath();ctx.fillStyle=m.color||t.acc;ctx.fill();
    }
    ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fillStyle=m.color||t.acc;ctx.fill();
    if(isSel){ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.stroke();}
    ctx.strokeStyle=m.color||t.acc;ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(p.x-r*1.9,p.y);ctx.lineTo(p.x+r*1.9,p.y);ctx.stroke();
    ctx.beginPath();ctx.moveTo(p.x,p.y-r*1.9);ctx.lineTo(p.x,p.y+r*1.9);ctx.stroke();
    if(m.label){const fs=clamp(11*Math.sqrt(zoom),9,16);ctx.font=`bold ${fs}px "DM Mono",monospace`;ctx.fillStyle=m.color||t.acc;drawMeasLabel(ctx,m.label,p.x+r+3,p.y-r-1);}
  }
  else if(m.type==="arrow"){
    if(sp.length<2){ctx.restore();return;}
    const p1=sp[0],p2=sp[1];
    ctx.strokeStyle=m.color||t.acc;ctx.lineWidth=(m.width||2)*Math.sqrt(zoom);ctx.setLineDash([]);
    ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke();
    const angle=Math.atan2(p2.y-p1.y,p2.x-p1.x);
    const arrowSize=12*Math.sqrt(zoom);
    ctx.beginPath();
    ctx.moveTo(p2.x,p2.y);
    ctx.lineTo(p2.x-arrowSize*Math.cos(angle-Math.PI/6),p2.y-arrowSize*Math.sin(angle-Math.PI/6));
    ctx.lineTo(p2.x-arrowSize*Math.cos(angle+Math.PI/6),p2.y-arrowSize*Math.sin(angle+Math.PI/6));
    ctx.closePath();ctx.fillStyle=m.color||t.acc;ctx.fill();
  }
  else if(m.type==="line"||m.type==="parallel"){
    if(sp.length<2){ctx.restore();return;}
    const isInfinite=m.mode==="infinite";
    const cw=canvasSize?.w||800,ch=canvasSize?.h||600;
    const linePts=isInfinite?getInfiniteLinePoints(sp[0],sp[1],cw,ch):[sp[0],sp[1]];
    ctx.strokeStyle=m.color||t.acc;ctx.lineWidth=(m.width||1.5)*Math.sqrt(zoom);
    if(m.style==="dashed")ctx.setLineDash([8*zoom,4*zoom]);
    else if(m.style==="dotted")ctx.setLineDash([2*zoom,4*zoom]);
    else ctx.setLineDash([]);
    ctx.beginPath();ctx.moveTo(linePts[0].x,linePts[0].y);ctx.lineTo(linePts[1].x,linePts[1].y);ctx.stroke();ctx.setLineDash([]);
    if(isSel){ctx.strokeStyle="rgba(255,255,255,0.25)";ctx.lineWidth=(m.width||1.5)*Math.sqrt(zoom)+4;ctx.beginPath();ctx.moveTo(linePts[0].x,linePts[0].y);ctx.lineTo(linePts[1].x,linePts[1].y);ctx.stroke();}
    if(cal?.done&&m.showLength&&!isInfinite){const ip=vpts(m);if(ip.length>=2){const d=dist(ip[0],ip[1])/cal.pxPerMm,mid={x:(sp[0].x+sp[1].x)/2,y:(sp[0].y+sp[1].y)/2};ctx.font=`${clamp(10*Math.sqrt(zoom),8,14)}px "DM Mono",monospace`;ctx.fillStyle=m.color||t.acc;drawMeasLabel(ctx,d.toFixed(1)+" mm",mid.x+5,mid.y-5);}}
    if(m.label){const mid={x:(sp[0].x+sp[1].x)/2,y:(sp[0].y+sp[1].y)/2};ctx.font=`bold ${clamp(10*Math.sqrt(zoom),8,14)}px "DM Mono",monospace`;ctx.fillStyle=m.color||t.acc;drawMeasLabel(ctx,m.label,mid.x+5,mid.y+14);}
    if(isSel&&m.locked){const mid={x:(sp[0].x+sp[1].x)/2,y:(sp[0].y+sp[1].y)/2};ctx.font=`${clamp(10*Math.sqrt(zoom),8,14)}px "DM Mono",monospace`;ctx.fillStyle="#f59e0b";drawMeasLabel(ctx,"🔒",mid.x+5,mid.y+28);}
  }
  else if(m.type==="angle3"){
    if(sp.length<3){ctx.restore();return;}
    ctx.strokeStyle=m.color||"#f472b6";ctx.lineWidth=(m.width||1.5)*Math.sqrt(zoom);ctx.setLineDash([]);
    ctx.lineJoin="round";ctx.lineCap="round";
    ctx.beginPath();ctx.moveTo(sp[0].x,sp[0].y);ctx.lineTo(sp[1].x,sp[1].y);ctx.lineTo(sp[2].x,sp[2].y);ctx.stroke();
    const ip=vpts(m);const v1={x:ip[0].x-ip[1].x,y:ip[0].y-ip[1].y},v2={x:ip[2].x-ip[1].x,y:ip[2].y-ip[1].y};
    const a1=Math.atan2(v1.y,v1.x),a2=Math.atan2(v2.y,v2.x),arcR=24*Math.sqrt(zoom);
    let startA=a1,endA=a2;
    if(endA<startA){const tmp=startA;startA=endA;endA=tmp;}
    if(endA-startA>Math.PI){startA+=Math.PI*2;}
    ctx.beginPath();ctx.arc(sp[1].x,sp[1].y,arcR,startA,endA);ctx.strokeStyle=(m.color||"#f472b6")+"99";ctx.lineWidth=(m.width||1.5)*0.8*Math.sqrt(zoom);ctx.stroke();
    const ang=angle3pt(ip[0],ip[1],ip[2]),midA=(startA+endA)/2;
    ctx.font=`bold ${clamp(11*Math.sqrt(zoom),9,15)}px "DM Mono",monospace`;ctx.fillStyle=m.color||"#f472b6";
    drawMeasLabel(ctx,fmtAngle(ang),sp[1].x+Math.cos(midA)*(arcR+16),sp[1].y+Math.sin(midA)*(arcR+16));
  }
  else if(m.type==="angle4"){
    if(sp.length<4){ctx.restore();return;}
    ctx.strokeStyle=m.color||"#c084fc";ctx.lineWidth=(m.width||1.5)*Math.sqrt(zoom);ctx.setLineDash([]);
    ctx.beginPath();ctx.moveTo(sp[0].x,sp[0].y);ctx.lineTo(sp[1].x,sp[1].y);ctx.stroke();
    ctx.beginPath();ctx.moveTo(sp[2].x,sp[2].y);ctx.lineTo(sp[3].x,sp[3].y);ctx.stroke();
    const ip=vpts(m);const ang=angle4pt(ip[0],ip[1],ip[2],ip[3]);
    const cx=(sp[0].x+sp[1].x+sp[2].x+sp[3].x)/4,cy=(sp[0].y+sp[1].y+sp[2].y+sp[3].y)/4;
    ctx.font=`bold ${clamp(11*Math.sqrt(zoom),9,15)}px "DM Mono",monospace`;ctx.fillStyle=m.color||"#c084fc";
    drawMeasLabel(ctx,fmtAngle(ang),cx,cy-8);
  }
  else if(m.type==="polygon"){
    if(sp.length<2){ctx.restore();return;}
    ctx.beginPath();
    if(m.curveStyle==="bspline"&&sp.length>=3)catmullRom(ctx,sp,true);
    else{ctx.moveTo(sp[0].x,sp[0].y);sp.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.closePath();}
    ctx.fillStyle=m.fillColor||"rgba(56,189,248,0.12)";ctx.fill();
    if(m.style==="dashed")ctx.setLineDash([8*zoom,4*zoom]);
    else if(m.style==="dotted")ctx.setLineDash([2*zoom,4*zoom]);
    else ctx.setLineDash([]);
    ctx.strokeStyle=m.strokeColor||t.acc;ctx.lineWidth=(m.strokeWidth||1.5)*Math.sqrt(zoom);ctx.stroke();ctx.setLineDash([]);
    if(isSel)sp.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fillStyle="#fff";ctx.fill();});
    if(cal?.done&&sp.length>=3){const ip=vpts(m);const cx=sp.reduce((s,p)=>s+p.x,0)/sp.length,cy=sp.reduce((s,p)=>s+p.y,0)/sp.length;
      const area=(m.curveStyle==="bspline"?splineArea(ip):polyArea(ip))/cal.pxPerMm**2;
      ctx.font=`${clamp(10*Math.sqrt(zoom),8,14)}px "DM Mono",monospace`;ctx.fillStyle=m.strokeColor||t.acc;
      drawMeasLabel(ctx,area.toFixed(1)+" mm²",cx-20,cy);}
    if(m.label){const cx=sp.reduce((s,p)=>s+p.x,0)/sp.length,cy=sp.reduce((s,p)=>s+p.y,0)/sp.length;ctx.font=`bold ${clamp(10*Math.sqrt(zoom),8,14)}px "DM Mono",monospace`;ctx.fillStyle=m.strokeColor||t.acc;drawMeasLabel(ctx,m.label,cx-20,cy+16);}
  }
  else if(m.type==="curve"){
    if(sp.length<2){ctx.restore();return;}
    if(m.style==="dashed")ctx.setLineDash([8*zoom,4*zoom]);
    else if(m.style==="dotted")ctx.setLineDash([2*zoom,4*zoom]);
    else ctx.setLineDash([]);
    ctx.strokeStyle=m.color||"#fb923c";ctx.lineWidth=(m.width||1.5)*Math.sqrt(zoom);
    ctx.beginPath();
    if(m.curveStyle==="bspline"&&sp.length>=3)catmullRom(ctx,sp,false);
    else{ctx.moveTo(sp[0].x,sp[0].y);sp.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));}
    ctx.stroke();ctx.setLineDash([]);
    if(isSel)sp.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fillStyle="#fff";ctx.fill();});
    if(cal?.done){const ip=vpts(m);const lp=sp[Math.floor(sp.length/2)];
      const len=(m.curveStyle==="bspline"&&ip.length>=3?splineLen(ip,false):polyLen(ip,false))/cal.pxPerMm;
      ctx.font=`${clamp(10*Math.sqrt(zoom),8,14)}px "DM Mono",monospace`;ctx.fillStyle=m.color||"#fb923c";
      drawMeasLabel(ctx,len.toFixed(1)+" mm",lp.x+5,lp.y-8);}
  }
  else if(m.type==="perp"){
    if(sp.length<2){ctx.restore();return;}
    ctx.strokeStyle=m.color||"#a78bfa";ctx.lineWidth=(m.width||1.5)*Math.sqrt(zoom);ctx.setLineDash([]);
    ctx.beginPath();ctx.moveTo(sp[0].x,sp[0].y);ctx.lineTo(sp[1].x,sp[1].y);ctx.stroke();
    if(sp.length>=3){const ip=vpts(m);if(ip.length>=3){
      const ax=ip[0].x,ay=ip[0].y,bx=ip[1].x,by=ip[1].y,px=ip[2].x,py=ip[2].y;
      const t2=((px-ax)*(bx-ax)+(py-ay)*(by-ay))/Math.max(dist(ip[0],ip[1])**2,1e-9);
      const fx=ax+t2*(bx-ax),fy=ay+t2*(by-ay);const fs={x:fx*zoom+pan.x,y:fy*zoom+pan.y};
      ctx.setLineDash([4*zoom,4*zoom]);ctx.strokeStyle=(m.color||"#a78bfa")+"cc";
      ctx.beginPath();ctx.moveTo(sp[2].x,sp[2].y);ctx.lineTo(fs.x,fs.y);ctx.stroke();ctx.setLineDash([]);
      const d2=dist(ip[0],ip[1]);if(d2>1e-6){const dx=(bx-ax)/d2*8*Math.sqrt(zoom),dy=(by-ay)/d2*8*Math.sqrt(zoom);ctx.strokeStyle=m.color||"#a78bfa";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(fs.x+dx,fs.y+dy);ctx.lineTo(fs.x+dx-dy,fs.y+dy+dx);ctx.lineTo(fs.x-dy,fs.y+dx);ctx.stroke();}
      if(cal?.done){const pd=perpDist(ip[2],ip[0],ip[1])/cal.pxPerMm,lx=(sp[2].x+fs.x)/2,ly=(sp[2].y+fs.y)/2;ctx.font=`bold ${clamp(10*Math.sqrt(zoom),8,14)}px "DM Mono",monospace`;ctx.fillStyle=m.color||"#a78bfa";drawMeasLabel(ctx,pd.toFixed(1)+" mm",lx+5,ly);}
    }}
  }
  else if(m.type==="text"){
    if(!sp.length){ctx.restore();return;}
    const p=sp[0],fs=clamp((m.fontSize||14)*Math.sqrt(zoom),8,48);
    ctx.font=`${m.bold?"bold ":""}${fs}px "DM Sans",sans-serif`;ctx.fillStyle=m.color||t.acc;
    ctx.shadowColor="rgba(0,0,0,0.9)";ctx.shadowBlur=5;ctx.fillText(m.text||"Text",p.x,p.y);ctx.shadowBlur=0;
    if(isSel){const mtr=ctx.measureText(m.text||"Text");ctx.strokeStyle=t.acc+"88";ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.strokeRect(p.x-2,p.y-fs,mtr.width+4,fs+6);ctx.setLineDash([]);}
  }
  else if(m.type==="ruler"){
    if(sp.length<2){ctx.restore();return;}
    ctx.strokeStyle="#facc15";ctx.lineWidth=2*Math.sqrt(zoom);ctx.setLineDash([6*zoom,3*zoom]);
    ctx.beginPath();ctx.moveTo(sp[0].x,sp[0].y);ctx.lineTo(sp[1].x,sp[1].y);ctx.stroke();ctx.setLineDash([]);
    [sp[0],sp[1]].forEach(p=>{ctx.beginPath();ctx.moveTo(p.x,p.y-8*Math.sqrt(zoom));ctx.lineTo(p.x,p.y+8*Math.sqrt(zoom));ctx.stroke();});
    const mid={x:(sp[0].x+sp[1].x)/2,y:(sp[0].y+sp[1].y)/2};ctx.font=`bold ${clamp(11*Math.sqrt(zoom),9,15)}px "DM Mono",monospace`;ctx.fillStyle="#facc15";drawMeasLabel(ctx,m.label||"ruler",mid.x+5,mid.y-8);
  }
  ctx.restore();
}

function drawInProgress(ctx,draw,mp,zoom,pan,t){
  if(!draw)return;const sc=p=>({x:p.x*zoom+pan.x,y:p.y*zoom+pan.y});
  const sp=draw.points.filter(p=>p.x>-9000).map(sc);
  ctx.save();ctx.strokeStyle=t.acc+"cc";ctx.lineWidth=1.5;ctx.setLineDash([5,5]);
  if(draw.type==="midpoint"&&sp.length===1&&mp){
    const mid={x:(sp[0].x+mp.x)/2,y:(sp[0].y+mp.y)/2};
    ctx.beginPath();ctx.moveTo(sp[0].x,sp[0].y);ctx.lineTo(mp.x,mp.y);ctx.stroke();
    ctx.beginPath();ctx.arc(mid.x,mid.y,6,0,Math.PI*2);ctx.fillStyle="#fbbf24";ctx.fill();
    ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.stroke();
  }
  else if(draw.type==="perppoint"&&sp.length===2&&mp){
    const p1=sp[0],p2=sp[1];
    ctx.strokeStyle="#f472b6"+"cc";ctx.lineWidth=1.5;ctx.setLineDash([5,5]);
    ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke();
    const lx1=p2.x-p1.x,ly1=p2.y-p1.y;
    const lx2=-ly1,ly2=lx1;
    const len=200;
    ctx.setLineDash([]);
    ctx.strokeStyle="#f472b6";ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(mp.x-lx2*2,mp.y-ly2*2);ctx.lineTo(mp.x+lx2*2,mp.y+ly2*2);ctx.stroke();
  }
  else if(draw.type==="arrow"&&sp.length===1&&mp){
    ctx.strokeStyle="#34d399";ctx.lineWidth=2;ctx.setLineDash([]);
    ctx.beginPath();ctx.moveTo(sp[0].x,sp[0].y);ctx.lineTo(mp.x,mp.y);ctx.stroke();
    const angle=Math.atan2(mp.y-sp[0].y,mp.x-sp[0].x);
    const arrowSize=12;
    ctx.beginPath();
    ctx.moveTo(mp.x,mp.y);
    ctx.lineTo(mp.x-arrowSize*Math.cos(angle-Math.PI/6),mp.y-arrowSize*Math.sin(angle-Math.PI/6));
    ctx.lineTo(mp.x-arrowSize*Math.cos(angle+Math.PI/6),mp.y-arrowSize*Math.sin(angle+Math.PI/6));
    ctx.closePath();ctx.fillStyle="#34d399";ctx.fill();
  }
  else if(sp.length===1&&mp){ctx.beginPath();ctx.moveTo(sp[0].x,sp[0].y);ctx.lineTo(mp.x,mp.y);ctx.stroke();}
  else if(sp.length>=2){
    ctx.beginPath();
    if((draw.type==="curve"||draw.type==="polygon")&&draw.curveStyle==="bspline"&&sp.length>=3)catmullRom(ctx,sp,false);
    else{ctx.moveTo(sp[0].x,sp[0].y);sp.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));}
    if(mp)ctx.lineTo(mp.x,mp.y);
    if(draw.type==="polygon"&&mp)ctx.lineTo(sp[0].x,sp[0].y);
    ctx.stroke();
  }
  if(draw.type!=="arrowpoint")sp.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fillStyle=t.acc;ctx.fill();});
  ctx.setLineDash([]);ctx.restore();
}

function drawScaleBar(ctx,zoom,cal,cw,ch,t){
  if(!cal?.done)return;
  const pxPerMm=cal.pxPerMm*zoom;const nice=[1,2,5,10,20,50,100,200,500];const mm=nice.find(v=>v*pxPerMm>=70)||100;
  const bw=mm*pxPerMm,x0=cw-bw-16,y0=ch-28;
  ctx.save();ctx.fillStyle="rgba(0,0,0,0.7)";ctx.fillRect(x0-8,y0-20,bw+36,28);
  ctx.strokeStyle="#fff";ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x0+bw,y0);ctx.moveTo(x0,y0-7);ctx.lineTo(x0,y0+4);ctx.moveTo(x0+bw,y0-7);ctx.lineTo(x0+bw,y0+4);ctx.stroke();
  ctx.fillStyle="#fff";ctx.font=`bold 10px "DM Mono",monospace`;ctx.textAlign="center";ctx.fillText(`${mm} mm`,x0+bw/2,y0-8);ctx.textAlign="left";ctx.restore();
}
function drawLUTLegend(ctx,lutMode,lutInvert,cw,ch,t){
  const preset=LUT_PRESETS.find(l=>l.id===lutMode);if(!preset||lutMode==="gray")return;
  const bx=cw-58,by=20,bh=Math.min(ch*0.4,180),bw=18;
  const stops=lutInvert?[...preset.stops].reverse():preset.stops;
  ctx.save();ctx.fillStyle="rgba(0,0,0,0.75)";ctx.fillRect(bx-10,by-8,bw+56,bh+36);
  const grad=ctx.createLinearGradient(0,by,0,by+bh);stops.forEach((s,i)=>grad.addColorStop(i/(stops.length-1),s));
  ctx.fillStyle=grad;ctx.fillRect(bx,by,bw,bh);ctx.strokeStyle="rgba(255,255,255,0.3)";ctx.lineWidth=1;ctx.strokeRect(bx,by,bw,bh);
  ctx.fillStyle="#fff";ctx.font=`9px "DM Mono",monospace`;ctx.textAlign="left";
  for(let i=0;i<=4;i++){const y=by+bh*i/4;ctx.fillText(Math.round(255*(1-i/4)),bx+bw+4,y+3);}
  ctx.fillStyle=t.acc;ctx.font=`bold 9px "DM Mono",monospace`;ctx.textAlign="center";ctx.fillText(`${preset.name}${lutInvert?" ⇅":""}`,bx+bw/2,by+bh+16);ctx.textAlign="left";ctx.restore();
}
function drawSnapIndicator(ctx,sn,zoom,pan){
  const sx=sn.x*zoom+pan.x,sy=sn.y*zoom+pan.y;
  ctx.save();ctx.strokeStyle="#ffd700";ctx.lineWidth=2;ctx.beginPath();ctx.arc(sx,sy,12,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle="#ffd70066";ctx.beginPath();ctx.moveTo(sx-18,sy);ctx.lineTo(sx+18,sy);ctx.moveTo(sx,sy-18);ctx.lineTo(sx,sy+18);ctx.stroke();ctx.restore();
}
function drawDisplacementVectors(ctx,m1arr,m2arr,zoom,pan){
  ctx.save();
  m1arr.filter(m=>m.type==="point").forEach(m1=>{
    const m2=m2arr.find(m=>m.type==="point"&&m.label===m1.label);if(!m2)return;
    const vp1=vpts(m1),vp2=vpts(m2);if(!vp1.length||!vp2.length)return;
    const p1={x:vp1[0].x*zoom+pan.x,y:vp1[0].y*zoom+pan.y},p2={x:vp2[0].x*zoom+pan.x,y:vp2[0].y*zoom+pan.y};
    const dx=p2.x-p1.x,dy=p2.y-p1.y,len=Math.sqrt(dx*dx+dy*dy);if(len<1)return;
    ctx.strokeStyle="#ffd700";ctx.lineWidth=2;ctx.setLineDash([]);
    ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke();
    ctx.beginPath();ctx.arc(p1.x,p1.y,4,0,Math.PI*2);ctx.fillStyle="#38bdf8";ctx.fill();
    ctx.beginPath();ctx.arc(p2.x,p2.y,4,0,Math.PI*2);ctx.fillStyle="#f472b6";ctx.fill();
    const angle=Math.atan2(dy,dx),hl=Math.min(len*0.3,14);
    ctx.beginPath();ctx.moveTo(p2.x,p2.y);ctx.lineTo(p2.x-hl*Math.cos(angle-0.4),p2.y-hl*Math.sin(angle-0.4));ctx.moveTo(p2.x,p2.y);ctx.lineTo(p2.x-hl*Math.cos(angle+0.4),p2.y-hl*Math.sin(angle+0.4));ctx.stroke();
    ctx.fillStyle="#ffd700";ctx.font=`${clamp(9*Math.sqrt(zoom),7,12)}px "DM Mono",monospace`;ctx.fillText(len.toFixed(1)+"px",(p1.x+p2.x)/2+4,(p1.y+p2.y)/2-4);
  });
  ctx.restore();
}

// HIT TEST
function hitTest(markups,ip,zoom,reproCollecting){
  const thr=8/zoom;
  for(let i=markups.length-1;i>=0;i--){
    const m=markups[i];if(m.visible===false)continue;
    if(m.type==="point"&&m.repro&&!isReproPointVisible(m,reproCollecting))continue;
    if(m.type==="point"){const vp=vpts(m);if(vp.length&&dist(vp[0],ip)<thr+(m.size||6)/zoom)return m.id;}
  }
  for(let i=markups.length-1;i>=0;i--){
    const m=markups[i];if(m.visible===false)continue;
    if(m.type==="point")continue;
    if(m.type==="point"&&m.repro&&!isReproPointVisible(m,reproCollecting))continue;
    const vp=vpts(m);
    if((m.type==="line"||m.type==="parallel"||m.type==="ruler")&&vp.length>=2&&perpDist(ip,vp[0],vp[1])<thr)return m.id;
    if((m.type==="angle3"||m.type==="angle4")&&vp.some(p=>dist(p,ip)<thr*2))return m.id;
    if((m.type==="polygon"||m.type==="curve")&&vp.length>=2){for(let j=1;j<vp.length;j++){if(perpDist(ip,vp[j-1],vp[j])<thr&&dist(ip,vp[j-1])<dist(vp[j-1],vp[j])+thr)return m.id;}}
    if(m.type==="perp"&&vp.length>=2&&perpDist(ip,vp[0],vp[1])<thr)return m.id;
    if(m.type==="perp"&&vp.length>=3&&dist(vp[2],ip)<thr*2)return m.id;
    if(m.type==="text"&&vp.length&&dist(vp[0],ip)<thr*4)return m.id;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOME PAGE (V1 design restored)
// ═══════════════════════════════════════════════════════════════════════════════
function HomePage({t,theme,setTheme,projects,onOpen,onCreate,onImport}){
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
      <header style={{padding:"18px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"absolute",top:0,left:0,right:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:36,height:36,borderRadius:8,background:t.acc,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>⊛</div>
          <div><div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,letterSpacing:-0.5,color:t.tx}}>CephaloStudio</div><div style={{fontSize:10,color:t.tx2,letterSpacing:1,textTransform:"uppercase",fontWeight:600}}>Advanced Cephalometric Analysis</div></div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {Object.values(THEMES).filter(th=>th.inHeader).map(th=>(<button key={th.id} onClick={()=>setTheme(th.id)} title={th.name} style={{width:28,height:28,borderRadius:6,border:theme===th.id?`2px solid ${t.acc}`:`1px solid ${t.bdr}`,background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:12,height:12,borderRadius:3,background:th.bg,border:`1px solid ${th.acc}`,boxShadow:theme===th.id?`0 0 0 2px ${t.acc}`:"none"}}/></button>))}
          <div style={{width:1,height:20,background:t.bdr,margin:"0 4px"}}/>
          <input ref={fileRef} type="file" accept=".cephx" style={{display:"none"}} onChange={e=>{if(e.target.files[0])onImport(e.target.files[0]);e.target.value="";}}/>
          <Btn t={t} small onClick={()=>fileRef.current?.click()}>↑ Import .cephx</Btn>
        </div>
      </header>

      {/* HERO */}
      <div style={{textAlign:"center",padding:"64px 32px 48px"}}>
        <div style={{display:"inline-block",background:t.accMuted,border:`1px solid ${t.acc}44`,borderRadius:20,padding:"5px 16px",fontSize:12,color:t.acc,fontWeight:600,letterSpacing:0.5,marginBottom:24}}>RESEARCH-GRADE IN SILICO CEPHALOMETRY</div>
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
            CephaloStudio is intended for research and educational purposes only. It is not approved or cleared for clinical diagnosis or treatment planning. <br /> Clinical decisions should not be made solely on the basis of measurements produced by this software.
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW CASE FORM
// ═══════════════════════════════════════════════════════════════════════════════
function NewCaseForm({t,projection,onCreate,onCancel}){
  const[d,setD]=useState({name:"Case 001",patientId:"",patientName:"",dob:"",age:"",gender:"",ethnicity:"",clinician:"",facility:"",referral:"",notes:""});
  const upd=(k,v)=>setD(prev=>({...prev,[k]:v}));
  return(
    <div>
      <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:t.tx,marginBottom:20}}>New {projection} Case</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
        {[["name","Case Name *",""],["patientId","Patient ID",""],["patientName","Patient Name",""],["dob","Date of Birth","date"],["age","Age","number"],["gender","","select-gender"],["ethnicity","Ethnicity",""],["clinician","Clinician",""],["facility","Facility",""],["referral","Referral",""],].map(([k,label,type])=>(
          <div key={k}>
            <div style={{fontSize:11,color:t.tx2,marginBottom:3}}>{label||k.charAt(0).toUpperCase()+k.slice(1)}</div>
            {type==="select-gender"?(
              <select value={d[k]} onChange={e=>upd(k,e.target.value)} style={{background:t.surf3,border:`1px solid ${t.bdr}`,borderRadius:4,padding:"4px 8px",color:t.tx,fontSize:12,width:"100%",fontFamily:"inherit"}}>
                <option value="">Select gender…</option>
                {["Male","Female","Non-binary","Other","Prefer not to say"].map(g=><option key={g} value={g}>{g}</option>)}
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

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE PICKER MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function TemplatePickerModal({t,projection,onPick,onClose}){
  const analyses=PREDEFINED[projection]||[];
  const templateRef=useRef(null);
  const[step,setStep]=useState("choose"); // choose | analysis
  const[selectedAnalysis,setSelectedAnalysis]=useState(null);

  if(projection==="other"){
    const otherData=PREDEFINED.other||[];
    const handleProjectionClick=(p)=>{
      if(p.name.includes("SMV")||p.name.includes("Submentovertex")){
        const analyses=csvToAnalysis(SMV_CSV,"General SMV Analysis",p.color);
        onPick("analysis",analyses[0]);
      }else if(p.name.includes("OPG")||p.name.includes("Panoramic")){
        const analyses=csvToAnalysis(OPG_CSV,"General OPG Analysis",p.color);
        onPick("analysis",analyses[0]);
      }else{
        onPick("projection",{name:p.name,def:p.def,color:p.color});
      }
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

// ═══════════════════════════════════════════════════════════════════════════════
// MARKUPS PANEL (sectioned by type)
// ═══════════════════════════════════════════════════════════════════════════════
function MarkupsPanel({markups,t,theme,selectedId,onSelect,onDelete,onToggleVisible,onToggleLock,calibration,placingMode,placingQueue,placingIdx,onStopPlacing,onPausePlacing,onResumePlacing,onClear,onAddPoint,norms,formatAngle,angleMode,setAngleMode}){
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
// MEASUREMENTS PANEL (with integrated norms)
// ═══════════════════════════════════════════════════════════════════════════════
function MeasurementsPanel({allMeas,t,calibration,norms,onUpdateNorms,onExportCSV,onOpenCalib,formatAngle}){
  const[editingNorm,setEditingNorm]=useState(null);// {markupId,markupLabel,measureType}
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
function FormulasPanel({formulas,t,scope,onAdd,onEdit,onDelete}){
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

// ═══════════════════════════════════════════════════════════════════════════════
// IMAGE PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function ImagePanel({t,processing,setProcessing,lutMode,setLutMode,lutInvert,setLutInvert,showLUT,setShowLUT,showScaleBar,setShowScaleBar,calibration,onOpenCalib,onReset,onShowHist,showHistogram}){
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
function LayersPanel({t,images,onUpdateImages,onAddImage,showDisplacement,setShowDisplacement,compareVersionId,setCompareVersionId,versions,onShowAlign,onShowTransform}){
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
function VersionsPanel({project,t,onUpdateProject,onUpdateVersion,onExportTemplate}){
  const[lbl,setLbl]=useState("T1");const[nm,setNm]=useState("Follow-up");
  const create=()=>{const v=mkVersion(lbl,nm);const src=project.versions.find(x=>x.id===project.activeVersionId);const nv={...v,calibration:src?.calibration,processing:src?.processing,lutMode:src?.lutMode,lutInvert:src?.lutInvert,analysisTemplate:src?.analysisTemplate};onUpdateProject({activeVersionId:nv.id,versions:[...project.versions,nv]});};
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

// ═══════════════════════════════════════════════════════════════════════════════
// MARKUP PROPERTIES
// ═══════════════════════════════════════════════════════════════════════════════
function MarkupProps({m,t,theme,onUpdate,onDelete,calibration,onParallel,formatAngle}){
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
// MODALS
// ═══════════════════════════════════════════════════════════════════════════════
function Modal({t,title,children,onClose,wide}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:t.surf,border:`1px solid ${t.bdr}`,borderRadius:12,padding:24,width:wide?640:420,maxWidth:"95vw",maxHeight:"90vh",overflowY:"auto",boxShadow:`0 24px 60px rgba(0,0,0,0.4)`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16,color:t.tx}}>{title}</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:t.tx2,cursor:"pointer",fontSize:22}}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CalibModal({t,calibration,onFinish}){
  const[mm,setMm]=useState(String(calibration.knownMm||"10"));const[ppm,setPpm]=useState(String(calibration.pxPerMm||"1"));const[mode,setMode]=useState("ruler");
  return(
    <div>
      <div style={{display:"flex",gap:6,marginBottom:16}}>{["ruler","manual"].map(m=><Btn key={m} t={t} small active={mode===m} onClick={()=>setMode(m)}>{m==="ruler"?"From Ruler":"Manual px/mm"}</Btn>)}</div>
      {mode==="ruler"?<><div style={{fontSize:13,color:t.tx2,marginBottom:16,lineHeight:1.6}}>Draw a ruler on the image (⟺ key), then enter its real-world length.</div><PropRow label="Distance (mm)" t={t}><input type="number" value={mm} onChange={e=>setMm(e.target.value)} min="1" style={{background:t.surf2,border:`1px solid ${t.bdr}`,borderRadius:6,padding:"6px 10px",color:t.tx,fontSize:14,width:"100%",fontFamily:"'DM Mono',monospace"}}/></PropRow><Btn t={t} onClick={()=>onFinish(parseFloat(mm))} style={{width:"100%",marginTop:12}}>Set Calibration</Btn></>
      :<><div style={{fontSize:13,color:t.tx2,marginBottom:16}}>Enter px/mm directly (from DICOM metadata).</div>{calibration.done&&<div style={{fontSize:12,color:t.ok,marginBottom:10}}>Current: {calibration.pxPerMm.toFixed(4)} px/mm</div>}<PropRow label="px / mm" t={t}><input type="number" value={ppm} onChange={e=>setPpm(e.target.value)} step="0.001" min="0.001" style={{background:t.surf2,border:`1px solid ${t.bdr}`,borderRadius:6,padding:"6px 10px",color:t.tx,fontSize:14,width:"100%",fontFamily:"'DM Mono',monospace"}}/></PropRow><Btn t={t} onClick={()=>onFinish(parseFloat(mm),parseFloat(ppm))} style={{width:"100%",marginTop:12}}>Apply</Btn></>}
    </div>
  );
}

function TextModal({t,onConfirm,onCancel,defaultColor}){
  const[txt,setTxt]=useState("Label");const[fontSize,setFontSize]=useState(14);const[bold,setBold]=useState(false);const[color,setColor]=useState(defaultColor||"#38bdf8");
  return(
    <div>
      <PropRow label="Text" t={t}><Inp value={txt} onChange={setTxt} t={t}/></PropRow>
      <PropRow label="Size" t={t}><div style={{display:"flex",gap:8,alignItems:"center"}}><input type="range" min={8} max={48} value={fontSize} onChange={e=>setFontSize(+e.target.value)} style={{flex:1,accentColor:t.acc}}/><span style={{fontSize:11,color:t.tx2,fontFamily:"'DM Mono',monospace",width:30}}>{fontSize}px</span></div></PropRow>
      <PropRow label="Bold" t={t}><input type="checkbox" checked={bold} onChange={e=>setBold(e.target.checked)} style={{accentColor:t.acc}}/></PropRow>
      <PropRow label="Color" t={t}><input type="color" value={color} onChange={e=>setColor(e.target.value)} style={{width:40,height:28,border:"none",cursor:"pointer",borderRadius:4}}/></PropRow>
      <div style={{marginTop:16,display:"flex",gap:8}}><Btn t={t} onClick={()=>onConfirm(txt,{fontSize,bold,color})} style={{flex:1}}>Add</Btn><Btn t={t} onClick={onCancel} style={{flex:1}}>Cancel</Btn></div>
    </div>
  );
}

function AnonModal({t,project,onUpdateProject,onClose}){
  const[pin,setPin]=useState("");const[requirePin,setRequirePin]=useState(project.accessControl?.requirePin||false);
  const anonymize=async()=>{if(!window.confirm("Remove all patient identifiers permanently?"))return;onUpdateProject({meta:{...project.meta,patientId:"ANON-"+uid().toUpperCase(),patientName:"",dob:"",age:"",clinician:"",facility:"",referral:"",notes:"[Anonymized]",anonymized:true}});};
  const savePin=async()=>{if(pin.length<4){alert("PIN must be ≥4 characters");return;}const hash=await hashPin(pin);onUpdateProject({accessControl:{requirePin,pinHash:hash}});setPin("");alert("PIN saved.");};
  return(
    <div>
      <div style={{marginBottom:16,padding:12,background:t.surf2,borderRadius:8,border:`1px solid ${t.bdr}`}}>
        <div style={{fontSize:12,fontWeight:700,color:t.tx,marginBottom:10}}>Patient Metadata</div>
        {[["patientId","Patient ID"],["patientName","Name"],["dob","DOB"],["age","Age"],["gender","Gender"],["clinician","Clinician"],["facility","Facility"]].map(([k,label])=>(
          <PropRow key={k} label={label} t={t}><Inp value={project.meta[k]||""} onChange={v=>onUpdateProject({meta:{...project.meta,[k]:v}})} t={t}/></PropRow>
        ))}
      </div>
      {project.meta.anonymized?<div style={{padding:10,background:t.ok+"11",border:`1px solid ${t.ok}33`,borderRadius:6,fontSize:12,color:t.ok,marginBottom:16}}>✓ Case is anonymized.</div>:<Btn t={t} danger onClick={anonymize} style={{width:"100%",marginBottom:16}}>🔏 Anonymize (irreversible)</Btn>}
      <Divider t={t}/>
      <div style={{fontSize:12,fontWeight:700,color:t.tx,marginBottom:8}}>Access Control</div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><input type="checkbox" id="rp" checked={requirePin} onChange={e=>setRequirePin(e.target.checked)} style={{accentColor:t.acc}}/><label htmlFor="rp" style={{fontSize:12,color:t.tx}}>Require PIN to open</label></div>
      {requirePin&&<><PropRow label="New PIN" t={t}><input type="password" value={pin} onChange={e=>setPin(e.target.value)} placeholder="Min 4 chars" style={{background:t.surf3,border:`1px solid ${t.bdr}`,borderRadius:4,padding:"4px 8px",color:t.tx,fontSize:12,width:"100%",fontFamily:"inherit"}}/></PropRow><Btn t={t} onClick={savePin} style={{width:"100%"}}>Save PIN</Btn></>}
    </div>
  );
}

function AlignModal({t,markups,images,onUpdateImages,onClose}){
  const pts=markups.filter(m=>m.type==="point"&&vpts(m)[0]?.x>-9000);
  const[src1,setSrc1]=useState("");const[dst1,setDst1]=useState("");const[src2,setSrc2]=useState("");const[dst2,setDst2]=useState("");
  const[tgtId,setTgtId]=useState(images[1]?.id||"");
  const PtSel=({val,onChange})=>(<select value={val} onChange={e=>onChange(e.target.value)} style={{width:"100%",background:t.surf3,border:`1px solid ${t.bdr}`,borderRadius:4,padding:"4px 8px",color:t.tx,fontSize:12,fontFamily:"inherit"}}><option value="">—</option>{pts.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select>);
  const align=()=>{
    const sp1=vpts(markups.find(m=>m.id===src1)||{})[0],dp1=vpts(markups.find(m=>m.id===dst1)||{})[0];if(!sp1||!dp1)return;
    let tf;if(src2&&dst2){const sp2=vpts(markups.find(m=>m.id===src2)||{})[0],dp2=vpts(markups.find(m=>m.id===dst2)||{})[0];tf=sp2&&dp2?alignTwoPoints(sp1,sp2,dp1,dp2):alignOnePoint(sp1,dp1);}else tf=alignOnePoint(sp1,dp1);
    onUpdateImages(images.map(i=>i.id===tgtId?{...i,transform:{tx:tf.tx,ty:tf.ty,rot:tf.rot,scale:tf.scale}}:i));onClose();
  };
  return(
    <div>
      <div style={{fontSize:12,color:t.tx2,marginBottom:14,lineHeight:1.6}}>1 pair = translation only · 2 pairs = translation + rotation</div>
      <PropRow label="Target" t={t}><select value={tgtId} onChange={e=>setTgtId(e.target.value)} style={{width:"100%",background:t.surf3,border:`1px solid ${t.bdr}`,borderRadius:4,padding:"4px 8px",color:t.tx,fontSize:12,fontFamily:"inherit"}}>{images.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></PropRow>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
        <div><div style={{fontSize:10,color:t.tx2,marginBottom:2}}>Src pt 1</div><PtSel val={src1} onChange={setSrc1}/></div>
        <div><div style={{fontSize:10,color:t.tx2,marginBottom:2}}>Dst pt 1</div><PtSel val={dst1} onChange={setDst1}/></div>
        <div><div style={{fontSize:10,color:t.tx2,marginBottom:2}}>Src pt 2</div><PtSel val={src2} onChange={setSrc2}/></div>
        <div><div style={{fontSize:10,color:t.tx2,marginBottom:2}}>Dst pt 2</div><PtSel val={dst2} onChange={setDst2}/></div>
      </div>
      <div style={{display:"flex",gap:8}}><Btn t={t} onClick={align} style={{flex:1}} disabled={!src1||!dst1}>Apply</Btn><Btn t={t} onClick={onClose} style={{flex:1}}>Cancel</Btn></div>
    </div>
  );
}

function TransformModal({t,images,onUpdateImages,onClose}){
  const[aid,setAid]=useState(images[0]?.id||"");
  const img=images.find(i=>i.id===aid);const tf=img?.transform||{tx:0,ty:0,rot:0,scale:1};
  const upd=p=>onUpdateImages(images.map(i=>i.id===aid?{...i,transform:{...tf,...p}}:i));
  return(
    <div>
      <PropRow label="Image" t={t}><select value={aid} onChange={e=>setAid(e.target.value)} style={{width:"100%",background:t.surf3,border:`1px solid ${t.bdr}`,borderRadius:4,padding:"4px 8px",color:t.tx,fontSize:12,fontFamily:"inherit"}}>{images.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></PropRow>
      {img&&<><Sld label="Translate X" value={tf.tx||0} min={-500} max={500} onChange={v=>upd({tx:v})} t={t} unit=" px"/><Sld label="Translate Y" value={tf.ty||0} min={-500} max={500} onChange={v=>upd({ty:v})} t={t} unit=" px"/><Sld label="Rotation" value={Math.round(((tf.rot||0)*180/Math.PI))} min={-180} max={180} onChange={v=>upd({rot:v*Math.PI/180})} t={t} unit="°"/><Sld label="Scale" value={tf.scale||1} min={0.1} max={3} step={0.01} onChange={v=>upd({scale:v})} t={t}/><Btn t={t} small onClick={()=>upd({tx:0,ty:0,rot:0,scale:1})} style={{marginTop:6}}>Reset</Btn></>}
      <Btn t={t} onClick={onClose} style={{width:"100%",marginTop:12}}>Done</Btn>
    </div>
  );
}

function FormulaEditor({t,formula,scope,onSave,onClose}){
  const[name,setName]=useState(formula?.name||"");const[latex,setLatex]=useState(formula?.latex||"");
  const[expr,setExpr]=useState(formula?.expression||"");const[unit,setUnit]=useState(formula?.unit||"");const[desc,setDesc]=useState(formula?.description||"");
  const[bigLatex,setBigLatex]=useState(null);
  const preview=useMemo(()=>evalFormula(expr,scope),[expr,scope]);
  return(
    <div>
      <PropRow label="Name" t={t}><Inp value={name} onChange={setName} t={t} placeholder="e.g. ANB Angle"/></PropRow>
      <div style={{marginBottom:8}}>
        <div style={{fontSize:11,color:t.tx2,marginBottom:3}}>LaTeX display</div>
        <Inp value={latex} onChange={setLatex} t={t} placeholder="\angle ANB = \angle SNA - \angle SNB"/>
        {latex&&<div onClick={()=>setBigLatex(latex)} style={{background:t.surf2,border:`1px solid ${t.bdr}`,borderRadius:6,padding:"8px 12px",marginTop:6,cursor:"pointer",minHeight:36,display:"flex",alignItems:"center",gap:8}}>
          <KatexSpan latex={latex}/>
          <span style={{fontSize:9,color:t.tx3,marginLeft:"auto"}}>click to enlarge ↗</span>
        </div>}
      </div>
      <div style={{marginBottom:8}}>
        <div style={{fontSize:11,color:t.tx2,marginBottom:3}}>Expression (mathjs)</div>
        <Inp value={expr} onChange={setExpr} t={t} placeholder="SNA_angle - SNB_angle"/>
        <div style={{fontSize:10,color:t.tx3,marginTop:4}}>Vars: {Object.keys(scope).slice(0,6).join(", ")}{Object.keys(scope).length>6?"…":""}</div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",padding:"6px 8px",background:preview!==null?t.ok+"11":expr?t.err+"11":t.surf2,borderRadius:6,marginBottom:8}}>
        <span style={{fontSize:12,color:t.tx2}}>Preview</span>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:700,color:preview!==null?t.ok:expr?t.err:t.tx3}}>{preview!==null?`${preview.toFixed(2)} ${unit}`:expr?"Error":"—"}</span>
      </div>
      <PropRow label="Unit" t={t}><Inp value={unit} onChange={setUnit} t={t} placeholder="°, mm, ratio"/></PropRow>
      <PropRow label="Notes" t={t}><Inp value={desc} onChange={setDesc} t={t} placeholder="Reference"/></PropRow>
      <div style={{display:"flex",gap:8,marginTop:14}}><Btn t={t} onClick={()=>onSave({id:formula?.id||uid(),name,latex,expression:expr,unit,description:desc})} style={{flex:1}} disabled={!name||!expr}>Save</Btn><Btn t={t} onClick={onClose} style={{flex:1}}>Cancel</Btn></div>
      {bigLatex&&<LatexFloatingPanel latex={bigLatex} onClose={()=>setBigLatex(null)}/>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE MODE MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function DatabaseImportModal({t,onImport,onClose}){
  const fileRef=useRef(null);
  const[files,setFiles]=useState([]);

  const handleFileChange=e=>{
    const newFiles=Array.from(e.target.files);
    setFiles(prev=>[...prev,...newFiles]);
  };

  const removeFile=idx=>{
    setFiles(prev=>prev.filter((_,i)=>i!==idx));
  };

  const handleImport=()=>{
    if(files.length===0)return;
    onImport(files);
    onClose();
  };

  return(
    <div>
      <div style={{fontSize:13,color:t.tx2,marginBottom:16,lineHeight:1.5}}>
        Select multiple images to import for batch processing. Each image will have its own markups and calibration.
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={handleFileChange}/>
      <div onClick={()=>fileRef.current?.click()} style={{border:`2px dashed ${t.bdr}`,borderRadius:10,padding:24,textAlign:"center",cursor:"pointer",marginBottom:16}}>
        <div style={{fontSize:24,marginBottom:8}}>📁</div>
        <div style={{fontSize:13,color:t.tx}}>Click to select images</div>
        <div style={{fontSize:11,color:t.tx3}}>or drag and drop</div>
      </div>
      {files.length>0&&(
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:t.tx2,marginBottom:8}}>Selected files ({files.length})</div>
          <div style={{maxHeight:180,overflowY:"auto"}}>
            {files.map((f,idx)=>(
              <div key={idx} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",background:t.surf2,borderRadius:6,marginBottom:4}}>
                <span style={{flex:1,fontSize:11,color:t.tx,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</span>
                <span style={{fontSize:10,color:t.tx3}}>{(f.size/1024).toFixed(1)} KB</span>
                <button onClick={()=>removeFile(idx)} style={{background:"none",border:"none",color:t.tx3,cursor:"pointer",fontSize:14}}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{display:"flex",gap:8}}>
        <Btn t={t} onClick={handleImport} disabled={files.length===0} style={{flex:1}}>Import {files.length} Image{files.length!==1?"s":""}</Btn>
        <Btn t={t} onClick={onClose} style={{flex:1}}>Cancel</Btn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATS DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function mean$1(arr){
  if(!arr.length) return null;
  return arr.reduce((a,b)=>a+b,0)/arr.length;
}

function std$1(arr){
  if(arr.length < 2) return null;
  const m = mean$1(arr);
  return Math.sqrt(arr.reduce((s,x)=>s+(x-m)**2,0)/(arr.length-1));
}

function median$1(arr){
  if(!arr.length) return null;
  const sorted = [...arr].sort((a,b)=>a-b);
  const mid = Math.floor(sorted.length/2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2;
}

function range$1(arr){
  if(!arr.length) return null;
  return { min: Math.min(...arr), max: Math.max(...arr) };
}

function correlation$1(x,y){
  if(x.length !== y.length || x.length < 2) return null;
  const mx = mean$1(x);
  const my = mean$1(y);
  const num = x.reduce((s,xi,i)=>s+(xi-mx)*(y[i]-my),0);
  const den = Math.sqrt(
    x.reduce((s,xi)=>s+(xi-mx)**2,0) *
    y.reduce((s,yi)=>s+(yi-my)**2,0)
  );
  return den === 0 ? null : num/den;
}

function groupBy$1(dataset, key){
  return dataset.reduce((acc, item)=>{
    const k = item[key] || "undefined";
    if(!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

function extractVariable$1(dataset, variable){
  return dataset
    .map(c => c.measurements?.[variable] ?? c.formulas?.[variable])
    .filter(v => typeof v === "number");
}

function descriptiveStats$1(values){
  return {
    n: values.length,
    mean: mean$1(values),
    sd: std$1(values),
    median: median$1(values),
    range: range$1(values)
  };
}

function StatsDashboard({ dataset, t }) {
  const [selectedVar, setSelectedVar] = useState("");
  const [selectedVar2, setSelectedVar2] = useState("");
  const [groupKey, setGroupKey] = useState("group");
  const [vizType, setVizType] = useState("stats");
  const scatterRef = useRef(null);
  const boxRef = useRef(null);

  const variables = useMemo(()=>{
    if(!dataset.length) return [];
    const allVars = new Set();
    dataset.forEach(entry => {
      Object.keys(entry.measurements||{}).forEach(v => allVars.add(v));
      Object.keys(entry.formulas||{}).forEach(v => allVars.add(v));
    });
    return Array.from(allVars).sort();
  },[dataset]);

  useEffect(()=>{
    if(variables.length > 0 && !selectedVar) setSelectedVar(variables[0]);
  },[variables, selectedVar]);

  const values = useMemo(()=> extractVariable$1(dataset, selectedVar), [dataset, selectedVar]);
  const values2 = useMemo(()=> extractVariable$1(dataset, selectedVar2), [dataset, selectedVar2]);
  const stats = useMemo(()=> descriptiveStats$1(values), [values]);
  const grouped = useMemo(()=> groupBy$1(dataset, groupKey), [dataset, groupKey]);
  const correlation = useMemo(()=>{
    if(!selectedVar2 || values.length !== values2.length || values.length < 2) return null;
    return correlation$1(values, values2);
  },[values, values2]);

  const linearReg = useMemo(()=>{
    if(values.length !== values2.length || values.length < 2) return null;
    const n = values.length;
    const sumX = values.reduce((a,b)=>a+b,0);
    const sumY = values2.reduce((a,b)=>a+b,0);
    const sumXY = values.reduce((s,x,i)=>s+x*values2[i],0);
    const sumX2 = values.reduce((s,x)=>s+x*x,0);
    const slope = (n*sumXY - sumX*sumY)/(n*sumX2 - sumX*sumX);
    const intercept = (sumY - slope*sumX)/n;
    return {slope, intercept};
  },[values, values2]);

  useEffect(()=>{
    if(vizType === "scatter" && scatterRef.current && values.length > 0 && values2.length > 0){
      const canvas = scatterRef.current;
      const ctx = canvas.getContext("2d");
      const w = canvas.width;
      const h = canvas.height;
      const pad = 40;
      ctx.clearRect(0,0,w,h);
      ctx.fillStyle = t.surf2;
      ctx.fillRect(0,0,w,h);
      const xMin = Math.min(...values);
      const xMax = Math.max(...values);
      const yMin = Math.min(...values2);
      const yMax = Math.max(...values2);
      const xRange = xMax - xMin || 1;
      const yRange = yMax - yMin || 1;
      const sx = (x) => pad + ((x - xMin)/xRange)*(w - 2*pad);
      const sy = (y) => h - pad - ((y - yMin)/yRange)*(h - 2*pad);
      ctx.strokeStyle = t.bdr;
      ctx.lineWidth = 1;
      for(let i=0;i<=4;i++){
        const xi = sx(xMin + (xRange*i)/4);
        const yi = sy(yMin + (yRange*i)/4);
        ctx.beginPath();
        ctx.moveTo(xi, pad);
        ctx.lineTo(xi, h-pad);
        ctx.moveTo(pad, yi);
        ctx.lineTo(w-pad, yi);
        ctx.stroke();
      }
      ctx.strokeStyle = t.tx3;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad, h-pad);
      ctx.lineTo(w-pad, h-pad);
      ctx.lineTo(w-pad, pad);
      ctx.stroke();
      if(linearReg){
        const x1 = xMin, x2 = xMax;
        const y1 = linearReg.slope*x1 + linearReg.intercept;
        const y2 = linearReg.slope*x2 + linearReg.intercept;
        ctx.strokeStyle = t.err;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx(x1), sy(y1));
        ctx.lineTo(sx(x2), sy(y2));
        ctx.stroke();
      }
      ctx.fillStyle = t.acc;
      values.forEach((x,i)=>{
        ctx.beginPath();
        ctx.arc(sx(x), sy(values2[i]), 4, 0, Math.PI*2);
        ctx.fill();
      });
      ctx.fillStyle = t.tx;
      ctx.font = "10px 'DM Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(selectedVar, w/2, h-5);
      ctx.save();
      ctx.translate(12, h/2);
      ctx.rotate(-Math.PI/2);
      ctx.fillText(selectedVar2, 0, 0);
      ctx.restore();
    }
  },[vizType, values, values2, linearReg, selectedVar, selectedVar2, t]);

  useEffect(()=>{
    if(vizType === "boxplot" && boxRef.current && values.length > 0){
      const canvas = boxRef.current;
      const ctx = canvas.getContext("2d");
      const w = canvas.width;
      const h = canvas.height;
      const pad = 50;
      ctx.clearRect(0,0,w,h);
      ctx.fillStyle = t.surf2;
      ctx.fillRect(0,0,w,h);
      const sorted = [...values].sort((a,b)=>a-b);
      const n = sorted.length;
      const q1 = sorted[Math.floor(n*0.25)];
      const med = sorted[Math.floor(n*0.5)];
      const q3 = sorted[Math.floor(n*0.75)];
      const iqr = q3 - q1;
      const minVal = Math.max(sorted[0], q1 - 1.5*iqr);
      const maxVal = Math.min(sorted[n-1], q3 + 1.5*iqr);
      const range = maxVal - minVal || 1;
      const scale = (v) => h - pad - ((v - minVal)/range)*(h - 2*pad);
      const boxX = pad;
      const boxW = w - 2*pad;
      const boxY = Math.min(scale(q3), scale(q1));
      const boxH = Math.abs(scale(q1) - scale(q3));
      ctx.strokeStyle = t.tx;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(boxX + boxW/2, scale(minVal));
      ctx.lineTo(boxX + boxW/2, boxY);
      ctx.moveTo(boxX + boxW/2, boxY + boxH);
      ctx.lineTo(boxX + boxW/2, scale(maxVal));
      ctx.stroke();
      ctx.strokeStyle = t.acc;
      ctx.lineWidth = 2;
      ctx.strokeRect(boxX, boxY, boxW, boxH);
      ctx.strokeStyle = t.err;
      ctx.lineWidth = 2;
      const midY = boxY + boxH/2;
      ctx.beginPath();
      ctx.moveTo(boxX, midY);
      ctx.lineTo(boxX + boxW, midY);
      ctx.stroke();
      ctx.fillStyle = t.tx;
      ctx.font = "10px 'DM Mono', monospace";
      ctx.textAlign = "right";
      [maxVal, q3, med, q1, minVal].forEach((v,i)=>{
        const labels = ["Max", "Q3", "Median", "Q1", "Min"];
        ctx.fillText(`${labels[i]}: ${v.toFixed(2)}`, boxX - 5, scale(v) + 3);
      });
      ctx.textAlign = "center";
      ctx.fillStyle = t.tx;
      ctx.fillText(selectedVar, w/2, 15);
    }
  },[vizType, values, selectedVar, t]);

  return (
    <div style={{padding:16}}>
      <h3 style={{fontSize:14,fontWeight:700,color:"inherit",marginBottom:12}}>Statistical Dashboard</h3>
      <div style={{display:"flex",gap:4,marginBottom:12}}>
        <button onClick={()=>setVizType("stats")} style={{flex:1,padding:"6px 8px",borderRadius:6,border:`1px solid ${vizType==="stats"?t.acc:t.bdr}`,background:vizType==="stats"?t.acc+"22":"transparent",color:vizType==="stats"?t.acc:t.tx,cursor:"pointer",fontSize:11}}>Stats</button>
        <button onClick={()=>setVizType("scatter")} style={{flex:1,padding:"6px 8px",borderRadius:6,border:`1px solid ${vizType==="scatter"?t.acc:t.bdr}`,background:vizType==="scatter"?t.acc+"22":"transparent",color:vizType==="scatter"?t.acc:t.tx,cursor:"pointer",fontSize:11}}>Scatter</button>
        <button onClick={()=>setVizType("boxplot")} style={{flex:1,padding:"6px 8px",borderRadius:6,border:`1px solid ${vizType==="boxplot"?t.acc:t.bdr}`,background:vizType==="boxplot"?t.acc+"22":"transparent",color:vizType==="boxplot"?t.acc:t.tx,cursor:"pointer",fontSize:11}}>Box Plot</button>
      </div>
      <div style={{marginBottom:10}}>
        <label style={{fontSize:11,color:t.tx2,marginRight:8}}>Variable: </label>
        <select value={selectedVar} onChange={e=>setSelectedVar(e.target.value)} style={{padding:"4px 8px",border:`1px solid ${t.bdr}`,borderRadius:4,background:t.surf3,color:t.tx,fontSize:11}}>
          {variables.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>
      {vizType==="stats"&&(<>
        <div style={{marginBottom:20, padding:10, border:"1px solid "+t.bdr,borderRadius:8}}>
          <strong style={{fontSize:11,color:t.tx}}>Descriptive Statistics</strong>
          <div style={{fontSize:11,marginTop:6}}>N = {stats.n}</div>
          <div style={{fontSize:11}}>Mean = {stats.mean?.toFixed(2)}</div>
          <div style={{fontSize:11}}>SD = {stats.sd?.toFixed(2)}</div>
          <div style={{fontSize:11}}>Median = {stats.median?.toFixed(2)}</div>
          <div style={{fontSize:11}}>Range = {stats.range ? `${stats.range.min.toFixed(2)} – ${stats.range.max.toFixed(2)}` : "-"}</div>
        </div>
        <div style={{marginBottom:20}}>
          <label style={{fontSize:11,color:t.tx2,marginRight:8}}>Group by: </label>
          <select value={groupKey} onChange={e=>setGroupKey(e.target.value)} style={{padding:"4px 8px",border:`1px solid ${t.bdr}`,borderRadius:4,background:t.surf3,color:t.tx,fontSize:11}}>
            <option value="group">Group</option>
            <option value="timepoint">Timepoint</option>
            <option value="operator">Operator</option>
          </select>
          {Object.entries(grouped).map(([g, cases])=>{
            const vals = extractVariable$1(cases, selectedVar);
            const s = descriptiveStats$1(vals);
            return (
              <div key={g} style={{marginTop:8, padding:8, border:"1px solid "+t.bdr,borderRadius:6}}>
                <strong style={{fontSize:11,color:t.tx}}>{g}</strong>
                <div style={{fontSize:10}}>N: {s.n} | Mean: {s.mean?.toFixed(2)} | SD: {s.sd?.toFixed(2)}</div>
              </div>
            );
          })}
        </div>
      </>)}
      {vizType==="scatter"&&(<>
        <div style={{marginBottom:10}}>
          <label style={{fontSize:11,color:t.tx2,marginRight:8}}>X Variable: </label>
          <select value={selectedVar} onChange={e=>setSelectedVar(e.target.value)} style={{padding:"4px 8px",border:`1px solid ${t.bdr}`,borderRadius:4,background:t.surf3,color:t.tx,fontSize:11}}>
            {variables.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div style={{marginBottom:10}}>
          <label style={{fontSize:11,color:t.tx2,marginRight:8}}>Y Variable: </label>
          <select value={selectedVar2} onChange={e=>setSelectedVar2(e.target.value)} style={{padding:"4px 8px",border:`1px solid ${t.bdr}`,borderRadius:4,background:t.surf3,color:t.tx,fontSize:11}}>
            <option value="">-- Select --</option>
            {variables.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        {correlation !== null && (
          <div style={{marginBottom:10, padding:8, border:"1px solid "+t.bdr,borderRadius:6,background:t.surf2}}>
            <div style={{fontSize:11,color:t.tx}}><strong>r = {correlation.toFixed(4)}</strong></div>
            <div style={{fontSize:10,color:t.tx2}}>r² = {(correlation*correlation).toFixed(4)}</div>
            {linearReg && <div style={{fontSize:10,color:t.tx2}}>y = {linearReg.slope.toFixed(4)}x + {linearReg.intercept.toFixed(4)}</div>}
          </div>
        )}
        <canvas ref={scatterRef} width={280} height={220} style={{border:"1px solid "+t.bdr,borderRadius:6,width:"100%",maxWidth:280}}/>
      </>)}
      {vizType==="boxplot"&&(<>
        <div style={{marginBottom:10}}>
          <label style={{fontSize:11,color:t.tx2,marginRight:8}}>Variable: </label>
          <select value={selectedVar} onChange={e=>setSelectedVar(e.target.value)} style={{padding:"4px 8px",border:`1px solid ${t.bdr}`,borderRadius:4,background:t.surf3,color:t.tx,fontSize:11}}>
            {variables.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <canvas ref={boxRef} width={280} height={200} style={{border:"1px solid "+t.bdr,borderRadius:6,width:"100%",maxWidth:280}}/>
      </>)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKUP TABLES PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function MarkupTablesPanel({databaseImages,currentImageIndex,t,formatAngle}){
  const[activeTable,setActiveTable]=useState("points");

  const exportTableCSV=(type)=>{
    const rows=[["Variable",...databaseImages.map((_,i)=>`Image ${i+1}`)]];
    
    if(type==="points"){
      const maxPoints=Math.max(...databaseImages.map(img=>(img.markups||[]).filter(m=>m.type==="point").length));
      for(let ptIdx=0;ptIdx<maxPoints;ptIdx++){
        rows.push([`P${ptIdx+1}_X`]);
        rows.push([`P${ptIdx+1}_Y`]);
      }
      databaseImages.forEach((img,imgIdx)=>{
        const points=(img.markups||[]).filter(m=>m.type==="point");
        points.forEach((pt,ptIdx)=>{
          const vp=vpts(pt);
          if(vp.length>0){
            rows[ptIdx+1].push(vp[0].x.toFixed(2));
            rows[ptIdx+1+maxPoints].push(vp[0].y.toFixed(2));
          }else{
            rows[ptIdx+1].push("");
            rows[ptIdx+1+maxPoints].push("");
          }
        });
      });
    }else if(type==="lines"){
      const maxLines=Math.max(...databaseImages.map(img=>(img.markups||[]).filter(m=>m.type==="line"||m.type==="parallel").length));
      for(let i=0;i<maxLines;i++)rows.push([`Line${i+1}_length`]);
      databaseImages.forEach((img,imgIdx)=>{
        const lines=(img.markups||[]).filter(m=>m.type==="line"||m.type==="parallel");
        lines.forEach((ln,lnIdx)=>{
          const meas=computeMeasurements(ln,img.calibration);
          rows[lnIdx+1].push(meas.length?.toFixed(2)||"");
        });
      });
    }else if(type==="angles"){
      const maxAngles=Math.max(...databaseImages.map(img=>[...(img.markups||[]).filter(m=>m.type==="angle3"),...(img.markups||[]).filter(m=>m.type==="angle4")].length));
      for(let i=0;i<maxAngles;i++){
        rows.push([`Angle${i+1}_deg`]);
        rows.push([`Angle${i+1}_rad`]);
      }
      databaseImages.forEach((img,imgIdx)=>{
        const angles=[...(img.markups||[]).filter(m=>m.type==="angle3"),...(img.markups||[]).filter(m=>m.type==="angle4")];
        angles.forEach((ang,angIdx)=>{
          const meas=computeMeasurements(ang,img.calibration);
          rows[angIdx*2+1].push(meas.angle?.toFixed(2)||"");
          rows[angIdx*2+2].push(meas.angle?((meas.angle*Math.PI/180).toFixed(4)):"");
        });
      });
    }else if(type==="curves"){
      const maxCurves=Math.max(...databaseImages.map(img=>(img.markups||[]).filter(m=>m.type==="curve").length));
      for(let i=0;i<maxCurves;i++)rows.push([`Curve${i+1}_length`]);
      databaseImages.forEach((img,imgIdx)=>{
        const curves=(img.markups||[]).filter(m=>m.type==="curve");
        curves.forEach((cv,cvIdx)=>{
          const meas=computeMeasurements(cv,img.calibration);
          rows[cvIdx+1].push(meas.length?.toFixed(2)||"");
        });
      });
    }else if(type==="polygons"){
      const maxPolys=Math.max(...databaseImages.map(img=>(img.markups||[]).filter(m=>m.type==="polygon").length));
      for(let i=0;i<maxPolys;i++){
        rows.push([`Polygon${i+1}_area`]);
        rows.push([`Polygon${i+1}_perimeter`]);
      }
      databaseImages.forEach((img,imgIdx)=>{
        const polys=(img.markups||[]).filter(m=>m.type==="polygon");
        polys.forEach((poly,polyIdx)=>{
          const meas=computeMeasurements(poly,img.calibration);
          rows[polyIdx*2+1].push(meas.area?.toFixed(2)||"");
          rows[polyIdx*2+2].push(meas.perimeter?.toFixed(2)||"");
        });
      });
    }

    const csv=rows.map(r=>r.join(",")).join("\n");
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download=`markups_${type}_table.csv`;
    a.click();
  };

  const tableTypes=[
    {id:"points",label:"Points",icon:"◉"},
    {id:"lines",label:"Lines",icon:"⟋"},
    {id:"angles",label:"Angles",icon:"∠"},
    {id:"curves",label:"Curves",icon:"∿"},
    {id:"polygons",label:"Polygons",icon:"⬡"},
  ];

  const getTableData=()=>{
    if(activeTable==="points"){
      const maxPoints=Math.max(...databaseImages.map(img=>(img.markups||[]).filter(m=>m.type==="point").length));
      const allPoints=[];
      for(let ptIdx=0;ptIdx<maxPoints;ptIdx++){
        allPoints[ptIdx]={label:`P${ptIdx+1}`,values:[]};
        databaseImages.forEach((img,imgIdx)=>{
          const points=(img.markups||[]).filter(m=>m.type==="point");
          const pt=points[ptIdx];
          if(pt){
            const vp=vpts(pt);
            allPoints[ptIdx].values[imgIdx]=vp.length>0?{x:vp[0].x,y:vp[0].y}:null;
          }
        });
      }
      return allPoints;
    }else if(activeTable==="lines"){
      const maxLines=Math.max(...databaseImages.map(img=>(img.markups||[]).filter(m=>m.type==="line"||m.type==="parallel").length));
      const allLines=[];
      for(let lnIdx=0;lnIdx<maxLines;lnIdx++){
        allLines[lnIdx]={label:`Line${lnIdx+1}`,values:[]};
        databaseImages.forEach((img,imgIdx)=>{
          const lines=[...(img.markups||[]).filter(m=>m.type==="line"),...(img.markups||[]).filter(m=>m.type==="parallel")];
          const ln=lines[lnIdx];
          if(ln){
            const meas=computeMeasurements(ln,img.calibration);
            allLines[lnIdx].values[imgIdx]=meas.length;
          }
        });
      }
      return allLines;
    }else if(activeTable==="angles"){
      const maxAngles=Math.max(...databaseImages.map(img=>[...(img.markups||[]).filter(m=>m.type==="angle3"),...(img.markups||[]).filter(m=>m.type==="angle4")].length));
      const allAngles=[];
      for(let angIdx=0;angIdx<maxAngles;angIdx++){
        allAngles[angIdx]={label:`Angle${angIdx+1}`,values:[]};
        databaseImages.forEach((img,imgIdx)=>{
          const angles=[...(img.markups||[]).filter(m=>m.type==="angle3"),...(img.markups||[]).filter(m=>m.type==="angle4")];
          const ang=angles[angIdx];
          if(ang){
            const meas=computeMeasurements(ang,img.calibration);
            allAngles[angIdx].values[imgIdx]=meas.angle;
          }
        });
      }
      return allAngles;
    }else if(activeTable==="curves"){
      const maxCurves=Math.max(...databaseImages.map(img=>(img.markups||[]).filter(m=>m.type==="curve").length));
      const allCurves=[];
      for(let cvIdx=0;cvIdx<maxCurves;cvIdx++){
        allCurves[cvIdx]={label:`Curve${cvIdx+1}`,values:[]};
        databaseImages.forEach((img,imgIdx)=>{
          const curves=(img.markups||[]).filter(m=>m.type==="curve");
          const cv=curves[cvIdx];
          if(cv){
            const meas=computeMeasurements(cv,img.calibration);
            allCurves[cvIdx].values[imgIdx]=meas.length;
          }
        });
      }
      return allCurves;
    }else if(activeTable==="polygons"){
      const maxPolys=Math.max(...databaseImages.map(img=>(img.markups||[]).filter(m=>m.type==="polygon").length));
      const allPolys=[];
      for(let polyIdx=0;polyIdx<maxPolys;polyIdx++){
        allPolys[polyIdx]={label:`Polygon${polyIdx+1}`,values:[]};
        databaseImages.forEach((img,imgIdx)=>{
          const polys=(img.markups||[]).filter(m=>m.type==="polygon");
          const poly=polys[polyIdx];
          if(poly){
            const meas=computeMeasurements(poly,img.calibration);
            allPolys[polyIdx].values[imgIdx]={area:meas.area,perimeter:meas.perimeter};
          }
        });
      }
      return allPolys;
    }
    return[];
  };

  const tableData=getTableData();
  const numImages=databaseImages.length;

  return(
    <div>
      <div style={{display:"flex",gap:4,marginBottom:8}}>
        {tableTypes.map(tt=>(
          <button key={tt.id} onClick={()=>setActiveTable(tt.id)} style={{padding:"6px 12px",borderRadius:6,border:`1px solid ${activeTable===tt.id?t.acc:t.bdr}`,background:activeTable===tt.id?t.acc+"22":"transparent",color:activeTable===tt.id?t.acc:t.tx,cursor:"pointer",fontSize:12}}>
            {tt.icon} {tt.label}
          </button>
        ))}
      </div>
      <div style={{marginBottom:12}}>
        <button onClick={()=>exportTableCSV(activeTable)} style={{width:"100%",padding:"8px 12px",borderRadius:6,border:`1px solid ${t.bdr}`,background:t.surf2,color:t.tx,cursor:"pointer",fontSize:12,textAlign:"center"}}>⬇ Export CSV</button>
      </div>
      {tableData.length===0?<div style={{color:t.tx2,textAlign:"center",padding:20}}>No {activeTable} data</div>:(
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"'DM Mono',monospace"}}>
            <thead>
              <tr>
                <th style={{textAlign:"left",padding:"8px 12px",borderBottom:`1px solid ${t.bdr}`,background:t.surf2,color:t.tx2}}>{activeTable}</th>
                {databaseImages.map((img,i)=>(
                  <th key={i} style={{textAlign:"center",padding:"8px 12px",borderBottom:`1px solid ${t.bdr}`,background:t.surf2,color:t.acc}}>Img {i+1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((row,rowIdx)=>(
                <tr key={rowIdx}>
                  <td style={{padding:"8px 12px",borderBottom:`1px solid ${t.bdr}`,color:t.tx,fontWeight:500}}>{row.label}</td>
                  {row.values.map((v,colIdx)=>(
                    <td key={colIdx} style={{padding:"8px 12px",borderBottom:`1px solid ${t.bdr}`,textAlign:"center",color:v!=null?t.tx:t.tx3}}>
                      {v==null?"-":activeTable==="points"?`(${v.x?.toFixed(1)??'-'},${v.y?.toFixed(1)??'-'})`:activeTable==="polygons"?`A:${v.area?.toFixed(1)??'-'} P:${v.perimeter?.toFixed(1)??'-'}`:typeof v==="number"?v.toFixed(2):v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE STATS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function DatabaseStatsPanel({databaseImages,currentImageIndex,t}){
  const[view,setView]=useState("tables");

  const buildDataset=()=>{
    const dataset=[];
    databaseImages.forEach((img,idx)=>{
      const entry={id:`img_${idx}`,measurements:{},formulas:{},group:"default",timepoint:`T${idx+1}`,operator:"default"};
      (img.markups||[]).forEach(m=>{
        const meas=computeMeasurements(m,img.calibration);
        const label=m.label||m.type;
        Object.entries(meas).forEach(([k,v])=>{
          entry.measurements[`${label}_${k}`]=v;
        });
      });
      dataset.push(entry);
    });
    return dataset;
  };

  return(
    <div style={{padding:12}}>
      <div style={{display:"flex",gap:6,marginBottom:16}}>
        <Btn t={t} small active={view==="tables"} onClick={()=>setView("tables")}>Registered Markups</Btn>
        <Btn t={t} small active={view==="dashboard"} onClick={()=>setView("dashboard")}>Statistics Dashboard</Btn>
      </div>
      {view==="tables"&&<MarkupTablesPanel databaseImages={databaseImages} currentImageIndex={currentImageIndex} t={t} formatAngle={(v)=>v.toFixed(1)+"°"}/>}
      {view==="dashboard"&&<StatsDashboard dataset={buildDataset()} t={t}/>}
    </div>
  );
}
function PinGate({t,project,onVerified,onCancel}){
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

// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE
// ═══════════════════════════════════════════════════════════════════════════════
function Workspace({project,onUpdateProject,onUpdateVersion,onHome,t,theme,setTheme}){
  const canvasRef=useRef(null);const containerRef=useRef(null);
  const procCache=useRef(new Map());const imgRefs=useRef({});

  // file input refs
  const openImgRef=useRef(null);const stackImgRef=useRef(null);const importRef=useRef(null);const cephtRef=useRef(null);

  const[zoom,setZoom]=useState(1);const[pan,setPan]=useState({x:40,y:40});
  const[mousePos,setMousePos]=useState(null);const[snapPos,setSnapPos]=useState(null);
  const[selectedId,setSelectedId]=useState(null);const[currentDraw,setCurrentDraw]=useState(null);
  const[activeTool,setActiveTool]=useState("select");const[curveMode,setCurveMode]=useState("linear");
  const[snapEnabled,setSnapEnabled]=useState(true);const[showScaleBar,setShowScaleBar]=useState(false);
  const[showLUT,setShowLUT]=useState(false);const[showHistogram,setShowHistogram]=useState(false);
  const[showDisplacement,setShowDisplacement]=useState(false);const[compareVersionId,setCompareVersionId]=useState(null);
  const[rightPanel,setRightPanel]=useState("markups");
  const[showCalib,setShowCalib]=useState(false);const[pendingRuler,setPendingRuler]=useState(null);
  const[showExport,setShowExport]=useState(false);const[showAnon,setShowAnon]=useState(false);
  const[showAlign,setShowAlign]=useState(false);const[showTransform,setShowTransform]=useState(false);
  const[pendingTextPos,setPendingTextPos]=useState(null);
  const[showFormulaEditor,setShowFormulaEditor]=useState(false);const[editFormulaId,setEditFormulaId]=useState(null);
  const[placingMode,setPlacingMode]=useState(false);const[placingQueue,setPlacingQueue]=useState([]);const[placingIdx,setPlacingIdx]=useState(0);
  const[showTemplatePicker,setShowTemplatePicker]=useState(true);
  const[isMobile,setIsMobile]=useState(()=>window.innerWidth<768);const[showMobilePanel,setShowMobilePanel]=useState(false);
  const[toolbarFloating,setToolbarFloating]=useState(false);const[toolbarPos,setToolbarPos]=useState({x:70,y:100});
  const[toolbarDragging,setToolbarDragging]=useState(false);const[toolbarDragStart,setToolbarDragStart]=useState(null);
  const[rightPanelWidth,setRightPanelWidth]=useState(320);const[rightPanelResizing,setRightPanelResizing]=useState(false);
  const[reproStudies,setReproStudies]=useState([]);
  const[activeStudyId,setActiveStudyId]=useState(null);
  /** While set, reproducibility landmark points for this session are shown on canvas. */
  const[reproCollecting,setReproCollecting]=useState(null);

  // Database mode states
  const[databaseMode,setDatabaseMode]=useState(false); // Default to off
  const[databaseImages,setDatabaseImages]=useState([]); // Array of {id, name, dataUrl, markups:[], calibration:{}, processing:{}}
  const[currentImageIndex,setCurrentImageIndex]=useState(0);
  const[showDatabaseImport,setShowDatabaseImport]=useState(false);

  useEffect(()=>{const fn=()=>setIsMobile(window.innerWidth<768);window.addEventListener("resize",fn);return()=>window.removeEventListener("resize",fn);},[]);

  useEffect(()=>{
    if(!rightPanelResizing)return;
    const onMove=e=>setRightPanelWidth(prev=>Math.max(200,Math.min(500,prev+e.movementX)));
    const onUp=()=>setRightPanelResizing(false);
    window.addEventListener("mousemove",onMove);
    window.addEventListener("mouseup",onUp);
    return()=>{window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};
  },[rightPanelResizing]);

  useEffect(()=>{
    if(!toolbarDragging)return;
    const onMove=e=>setToolbarPos(prev=>({x:prev.x+e.movementX,y:prev.y+e.movementY}));
    const onUp=()=>setToolbarDragging(false);
    window.addEventListener("mousemove",onMove);
    window.addEventListener("mouseup",onUp);
    return()=>{window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};
  },[toolbarDragging]);

  const isPanning=useRef(false);const panStart=useRef(null);
  const isDragging=useRef(false);const dragStart=useRef(null);const dragStartState=useRef(null);
  const dragMid=useRef(null);const dragPtIdx=useRef(null);
  const canvasSize=useRef({w:800,h:600});const lastTouchDist=useRef(null);
  const undoStackRef=useRef([]);
  const redoStackRef=useRef([]);

  const activeVersion=project.versions.find(v=>v.id===project.activeVersionId)||project.versions[0];
  const markups=activeVersion?.markups||[];

  const calibration=activeVersion?.calibration||{done:false,pxPerMm:1};
  const processing=activeVersion?.processing||{brightness:0,contrast:0,windowWidth:0,windowCenter:128,edgeEnhance:0};
  const lutMode=activeVersion?.lutMode||"gray";const lutInvert=activeVersion?.lutInvert||false;
  const formulas=activeVersion?.formulas||[];const norms=activeVersion?.norms||[];
  const selectedMarkup=markups.find(m=>m.id===selectedId);
  const compareVersion=project.versions.find(v=>v.id===compareVersionId);

  const updVer=patch=>onUpdateVersion(activeVersion.id,patch);
  const angleMode=activeVersion?.angleMode||"signed-deg";
  const setAngleMode=m=>updVer({angleMode:m});
  const formatAngle=(v)=>{
    const[sign,unit]=angleMode.split("-");
    let val=v;
    if(sign==="abs")val=Math.abs(v);
    else if(sign==="simple")val=Math.abs(v);
    else if(sign==="reflex")val=Math.abs(v)>180?360-Math.abs(v):360-Math.abs(v);
    if(unit==="rad")return(val*Math.PI/180).toFixed(4)+" rad";
    return val.toFixed(1)+"°";
  };
  const pushUndo=()=>{
    undoStackRef.current.push(JSON.stringify(markups));
    if(undoStackRef.current.length>50)undoStackRef.current.shift();
    redoStackRef.current=[];
  };
  const undo=()=>{
    if(undoStackRef.current.length===0)return;
    redoStackRef.current.push(JSON.stringify(markups));
    const prev=undoStackRef.current.pop();
    if(prev)updVer({markups:JSON.parse(prev)});
  };
  const redo=()=>{
    if(redoStackRef.current.length===0)return;
    undoStackRef.current.push(JSON.stringify(markups));
    const next=redoStackRef.current.pop();
    if(next)updVer({markups:JSON.parse(next)});
  };
  const updMarkups=fn=>{pushUndo();updVer({markups:fn(markups)});};
  const syncReproStudyCoords=(repro,x,y)=>{
    if(!repro?.measurementId)return;
    setReproStudies(prev=>prev.map(s=>{
      if(s.id!==repro.studyId)return s;
      return{...s,operators:s.operators.map(o=>{
        if(o.id!==repro.opId)return o;
        const trials=(o.trials||[]).map((tr,ti)=>{
          if(ti!==repro.trialIdx)return tr;
          return{...tr,measurements:(tr.measurements||[]).map(me=>me.id===repro.measurementId?{...me,x,y}:me)};
        });
        return{...o,trials};
      })};
    }));
  };
  const updMarkup=(id,patch)=>{
    const useDb=databaseMode&&databaseImages.length>0&&!reproCollecting;
    if(useDb){
      const currentDbImg=databaseImages[currentImageIndex];
      const currentMarkups=currentDbImg?.markups||[];
      const prevM=currentMarkups.find(m=>m.id===id);
      const merged=prevM?{...prevM,...patch}:null;
      const newMarkups=currentMarkups.map(m=>m.id===id?{...m,...patch}:m);
      updateDatabaseImage(currentImageIndex,{markups:newMarkups});
      if(merged?.repro?.measurementId&&patch.points){
        const pt=vpts(merged)[0];
        if(pt&&pt.x>-9000)syncReproStudyCoords(merged.repro,pt.x,pt.y);
      }
      return;
    }
    const prevM=markups.find(m=>m.id===id);
    const merged=prevM?{...prevM,...patch}:null;
    updMarkups(ms=>ms.map(m=>m.id===id?{...m,...patch}:m));
    if(merged?.repro?.measurementId&&patch.points){
      const pt=vpts(merged)[0];
      if(pt&&pt.x>-9000)syncReproStudyCoords(merged.repro,pt.x,pt.y);
    }
  };
  const delMarkup=id=>{
    const useDb=databaseMode&&databaseImages.length>0&&!reproCollecting;
    if(useDb){
      const newMarkups=(databaseImages[currentImageIndex]?.markups||[]).filter(mm=>mm.id!==id);
      updateDatabaseImage(currentImageIndex,{markups:newMarkups});
      if(selectedId===id)setSelectedId(null);
      return;
    }
    const m=markups.find(x=>x.id===id);
    updMarkups(ms=>ms.filter(mm=>mm.id!==id));
    if(selectedId===id)setSelectedId(null);
    if(m?.repro?.measurementId){
      setReproStudies(prev=>prev.map(s=>{
        if(s.id!==m.repro.studyId)return s;
        return{...s,operators:s.operators.map(o=>{
          if(o.id!==m.repro.opId)return o;
          const trials=(o.trials||[]).map((tr,ti)=>{
            if(ti!==m.repro.trialIdx)return tr;
            return{...tr,measurements:(tr.measurements||[]).filter(me=>me.id!==m.repro.measurementId)};
          });
          return{...o,trials};
        })};
      }));
    }
  };
  const addMarkup=partial=>{
    const useDb=databaseMode&&databaseImages.length>0&&!reproCollecting;
    const currentDbImg=useDb?databaseImages[currentImageIndex]:null;
    const existingMarkups=useDb?(currentDbImg?.markups||[]):markups;
    const typeCount=(type)=>existingMarkups.filter(m=>m.type===type).length;
    const m={id:uid(),color:t.acc,width:1.5,style:"solid",size:6,label:"",definition:"",showLength:true,strokeColor:t.acc,fillColor:t.acc+"22",strokeWidth:1.5,visible:true,...partial};
    if(partial.type==="point")m.label=`P${typeCount("point")+1}`;
    if(partial.type==="line"||partial.type==="parallel")m.label=partial.label||`Line ${typeCount("line")+typeCount("parallel")+1}`;
    if(partial.type==="curve")m.label=partial.label||`Trace ${typeCount("curve")+1}`;
    if(partial.type==="angle3"||partial.type==="angle4")m.label=partial.label||`Angle ${typeCount("angle3")+typeCount("angle4")+1}`;
    if(useDb){
      const newMarkups=[...currentDbImg?.markups||[],m];
      updateDatabaseImage(currentImageIndex,{markups:newMarkups});
      setSelectedId(m.id);
      return m;
    }
    updMarkups(ms=>[...ms,m]);setSelectedId(m.id);return m;
  };
  const finalizeMarkup=draw=>{
    const useDb=databaseMode&&databaseImages.length>0&&!reproCollecting;
    const currentDbImg=useDb?databaseImages[currentImageIndex]:null;
    const existingMarkups=useDb?(currentDbImg?.markups||[]):markups;
    const D={
      line:{color:t.acc,width:1.5,style:"solid",mode:"segment",label:`Line ${existingMarkups.filter(m=>m.type==="line").length+1}`,showLength:true},
      angle3:{color:"#f472b6",width:1.5,label:`Angle ${existingMarkups.filter(m=>m.type==="angle3").length+1}`},
      angle4:{color:"#c084fc",width:1.5,label:`Angle ${existingMarkups.filter(m=>m.type==="angle4").length+1}`},
      polygon:{strokeColor:t.acc,fillColor:t.acc+"22",strokeWidth:1.5,label:`Polygon ${existingMarkups.filter(m=>m.type==="polygon").length+1}`},
      curve:{color:"#fb923c",width:1.5,label:`Trace ${existingMarkups.filter(m=>m.type==="curve").length+1}`},
      perp:{color:"#a78bfa",width:1.5,label:`Perp ${existingMarkups.filter(m=>m.type==="perp").length+1}`}
    };
    addMarkup({...D[draw.type]||{},...draw});
  };

  // load images
  useEffect(()=>{project.images.forEach(imgE=>{if(!imgRefs.current[imgE.id]&&imgE.dataUrl){const img=new Image();img.onload=()=>{imgRefs.current[imgE.id]=img;redraw();};img.src=imgE.dataUrl;}});},[project.images]);

  const getProcessed=useCallback(imgEntry=>{
    const key=`${imgEntry.id}-${JSON.stringify(processing)}-${lutMode}-${lutInvert}`;
    if(!procCache.current.has(key)){for(const k of procCache.current.keys())if(k.startsWith(imgEntry.id+"-")&&k!==key)procCache.current.delete(k);procCache.current.set(key,processImageToCanvas(imgRefs.current[imgEntry.id],processing,lutMode,lutInvert));}
    return procCache.current.get(key);
  },[processing,lutMode,lutInvert]);

  const toImage=useCallback((sx,sy)=>({x:(sx-pan.x)/zoom,y:(sy-pan.y)/zoom}),[pan,zoom]);
  const getCanvasPos=e=>{const r=canvasRef.current.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};

  useEffect(()=>{
    const obs=new ResizeObserver(()=>{const el=containerRef.current;if(!el)return;const c=canvasRef.current;if(!c)return;c.width=el.clientWidth;c.height=el.clientHeight;canvasSize.current={w:el.clientWidth,h:el.clientHeight};redraw();});
    if(containerRef.current)obs.observe(containerRef.current);return()=>obs.disconnect();
  },[]);

  const redraw=useCallback(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext("2d");ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle=t.bg;ctx.fillRect(0,0,canvas.width,canvas.height);
    
    const currentDbImg=databaseMode&&databaseImages.length>0?databaseImages[currentImageIndex]:null;
    const activeMarkups=currentDbImg?.markups||[];
    const activeCalibration=currentDbImg?.calibration||{done:false,pxPerMm:1};
    const activeProcessing=currentDbImg?.processing||{brightness:0,contrast:0,windowWidth:0,windowCenter:128,edgeEnhance:0};
    const activeLutMode=currentDbImg?.lutMode||"gray";
    const activeLutInvert=currentDbImg?.lutInvert||false;
    
    if(databaseMode&&currentDbImg){
      const src=imgRefs.current[currentDbImg.id];
      if(src){
        const nw=src.naturalWidth||src.width||600,nh=src.naturalHeight||src.height||500;
        ctx.save();
        ctx.translate(pan.x,pan.y);
        ctx.scale(zoom,zoom);
        ctx.drawImage(src,0,0,nw,nh);
        ctx.restore();
      }
    }else if(project.images.length===0){
      ctx.fillStyle=t.surf;ctx.fillRect(pan.x,pan.y,600*zoom,500*zoom);ctx.strokeStyle=t.bdr;ctx.lineWidth=1;ctx.strokeRect(pan.x,pan.y,600*zoom,500*zoom);
      ctx.fillStyle=t.tx3;ctx.font=`15px "DM Sans",sans-serif`;ctx.textAlign="center";ctx.fillText("Drop or open a cephalogram image",pan.x+300*zoom,pan.y+240*zoom);ctx.fillText("Open Image  •  drag & drop",pan.x+300*zoom,pan.y+265*zoom);ctx.textAlign="left";
    } else {
      project.images.forEach(imgE=>{
        if(!imgE.visible)return;const src=getProcessed(imgE)||imgRefs.current[imgE.id];if(!src)return;
        const tf=imgE.transform||{tx:0,ty:0,rot:0,scale:1};const nw=src.naturalWidth||src.width||600,nh=src.naturalHeight||src.height||500;
        ctx.save();ctx.globalAlpha=imgE.opacity??1;ctx.globalCompositeOperation=imgE.blendMode||"normal";
        ctx.translate(pan.x+(imgE.dx||0)*zoom,pan.y+(imgE.dy||0)*zoom);
        ctx.translate((nw/2+tf.tx)*zoom,(nh/2+tf.ty)*zoom);ctx.rotate(tf.rot||0);ctx.scale((tf.scale||1)*zoom,(tf.scale||1)*zoom);
        ctx.drawImage(src,-nw/2,-nh/2);
        if(imgE.color&&imgE.color!=="none"){ctx.globalCompositeOperation="color";ctx.fillStyle=imgE.color+"77";ctx.fillRect(-nw/2,-nh/2,nw,nh);}
        ctx.restore();
      });
    }
    const drawMarkups=databaseMode&&databaseImages.length>0&&!reproCollecting?activeMarkups:markups;
    const drawCalibration=databaseMode&&databaseImages.length>0&&!reproCollecting?activeCalibration:calibration;
    drawMarkups.forEach(m=>drawMarkup(ctx,m,zoom,pan,drawCalibration,selectedId,t,reproCollecting,canvasSize.current,angleMode));
    if(showDisplacement){
      if(!compareVersion){
        ctx.fillStyle="rgba(0,0,0,0.6)";ctx.fillRect(8,8,220,36);
        ctx.fillStyle="#ffd700";ctx.font="bold 12px 'DM Sans',sans-serif";
        ctx.fillText("⇝ Select a compare version in Layers panel",16,28);
      } else {
        drawDisplacementVectors(ctx,drawMarkups,compareVersion.markups||[],zoom,pan);
      }
    }
    if(currentDraw)drawInProgress(ctx,currentDraw,mousePos,zoom,pan,t);
    if(snapEnabled&&snapPos)drawSnapIndicator(ctx,snapPos,zoom,pan);
    if(showScaleBar)drawScaleBar(ctx,zoom,drawCalibration,canvas.width,canvas.height,t);
    if(showLUT&&activeLutMode!=="gray")drawLUTLegend(ctx,activeLutMode,activeLutInvert,canvas.width,canvas.height,t);
    if(placingMode&&placingQueue.length>0&&placingIdx<placingQueue.length){
      const m=drawMarkups.find(x=>x.id===placingQueue[placingIdx]);
      if(m){ctx.save();ctx.fillStyle="rgba(0,0,0,0.8)";ctx.fillRect(0,0,canvas.width,36);ctx.fillStyle=t.acc;ctx.font=`bold 13px "DM Sans",sans-serif`;ctx.fillText(`📍 Placing: ${m.label}${m.definition?" — "+m.definition:""} · Click image · Esc to skip`,12,23);ctx.restore();}
    }
  },[markups,selectedId,zoom,pan,project.images,calibration,t,currentDraw,mousePos,snapEnabled,snapPos,showScaleBar,showLUT,lutMode,lutInvert,placingMode,placingQueue,placingIdx,showDisplacement,compareVersion,getProcessed,reproCollecting,angleMode,databaseMode,databaseImages,currentImageIndex]);

  useEffect(()=>{redraw();},[redraw]);

  const loadImage=(file,addToStack=false)=>{
    if(!file||!file.type.startsWith("image/"))return;
    const reader=new FileReader();
    reader.onload=e=>{
      const dataUrl=e.target.result;const img=new Image();
      img.onload=()=>{
        const id=uid();imgRefs.current[id]=img;
        const entry={id,name:file.name,dataUrl,dx:0,dy:0,opacity:1,blendMode:"normal",visible:true,color:"none",transform:{tx:0,ty:0,rot:0,scale:1}};
        const newImages=addToStack?[...project.images,entry]:[entry];
        onUpdateProject({images:newImages});
        if(!addToStack){const cw=canvasSize.current.w-80,ch=canvasSize.current.h-80;const sc=Math.min(cw/(img.naturalWidth||600),ch/(img.naturalHeight||500),1);setZoom(sc);setPan({x:40,y:40});}
      };img.src=dataUrl;
    };reader.readAsDataURL(file);
  };

  const loadDatabaseImages=async (files)=>{
    const loaded=await Promise.all(files.map(file=>{
      return new Promise((resolve)=>{
        if(!file.type.startsWith("image/")){resolve(null);return;}
        const reader=new FileReader();
        reader.onload=e=>{
          const dataUrl=e.target.result;const img=new Image();
          img.onload=()=>{
            resolve({id:uid(),name:file.name,dataUrl,markups:[],calibration:{done:false,pxPerMm:1,knownMm:""},processing:{brightness:0,contrast:0,windowWidth:0,windowCenter:128,edgeEnhance:0},lutMode:"gray",lutInvert:false});
          };img.src=dataUrl;
        };reader.readAsDataURL(file);
      });
    }));
    const validImages=loaded.filter(Boolean);
    if(validImages.length>0){
      setDatabaseImages(validImages);
      setCurrentImageIndex(0);
      setDatabaseMode(true);
      const firstImg=validImages[0];
      imgRefs.current[firstImg.id]=await new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=firstImg.dataUrl;});
      const cw=canvasSize.current.w-80,ch=canvasSize.current.h-80;
      const img=new Image();img.onload=()=>{const sc=Math.min(cw/(img.naturalWidth||600),ch/(img.naturalHeight||500),1);setZoom(sc);setPan({x:40,y:40});};img.src=firstImg.dataUrl;
    }
  };

  const updateDatabaseImage=(index,patch)=>{
    setDatabaseImages(prev=>prev.map((img,i)=>i===index?{...img,...patch}:img));
  };

  const navigateImage=(direction)=>{
    if(direction==="next"&&currentImageIndex<databaseImages.length-1){
      setCurrentImageIndex(prev=>prev+1);
    }else if(direction==="prev"&&currentImageIndex>0){
      setCurrentImageIndex(prev=>prev-1);
    }
  };

  useEffect(()=>{
    if(!databaseMode||databaseImages.length===0)return;
    const currentDbImg=databaseImages[currentImageIndex];
    if(!currentDbImg)return;
    if(!imgRefs.current[currentDbImg.id]){
      const img=new Image();
      img.onload=()=>{imgRefs.current[currentDbImg.id]=img;redraw();};
      img.src=currentDbImg.dataUrl;
    }else{
      redraw();
    }
  },[currentImageIndex,databaseMode]);

  const handleDrop=e=>{e.preventDefault();loadImage(e.dataTransfer.files[0]);};

  useEffect(()=>{
    const fn=e=>{
      if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA")return;
      if((e.ctrlKey||e.metaKey)&&e.key==="z"){undo();return;}
      if((e.ctrlKey||e.metaKey)&&e.key==="y"){redo();return;}
      if(e.key==="Escape"){setCurrentDraw(null);setSelectedId(null);if(placingMode){if(placingIdx<placingQueue.length-1)setPlacingIdx(i=>i+1);else{setPlacingMode(false);setPlacingQueue([]);setPlacingIdx(0);}}return;}
      const tool=TOOLS.filter(Boolean).find(t2=>t2.key===e.key.toLowerCase());
      if(tool){setActiveTool(tool.id);setCurrentDraw(null);return;}
      if((e.key==="Delete"||e.key==="Backspace")&&selectedId){const m=markups.find(x=>x.id===selectedId);if(!m?.locked)delMarkup(selectedId);return;}
      if(e.key==="+"||e.key==="=")setZoom(z=>clamp(z*1.15,0.05,15));
      if(e.key==="-")setZoom(z=>clamp(z/1.15,0.05,15));
      if(e.key==="0"){setZoom(1);setPan({x:40,y:40});}
    };
    window.addEventListener("keydown",fn);return()=>window.removeEventListener("keydown",fn);
  },[selectedId,placingMode,placingIdx,placingQueue,markups]);

  const handleMouseDown=useCallback(e=>{
    if(e.button!==0)return;
    const currentDbImg=databaseMode&&!reproCollecting&&databaseImages.length>0?databaseImages[currentImageIndex]:null;
    const dbMarkups=currentDbImg?.markups||[];
    const activeMarkupsList=databaseMode&&!reproCollecting?dbMarkups:markups;
    const sp=getCanvasPos(e);let ip=toImage(sp.x,sp.y);
    ip=snapPoint(ip,activeMarkupsList,12/zoom,snapEnabled);
    if(placingMode&&placingQueue.length>0&&placingIdx<placingQueue.length){
      const qid=placingQueue[placingIdx];
      updMarkup(qid,{points:[ip],placed:true});
      if(placingIdx<placingQueue.length-1)setPlacingIdx(i=>i+1);else{setPlacingMode(false);setPlacingQueue([]);setPlacingIdx(0);}
      return;
    }
    if(activeTool==="pan"){isPanning.current=true;panStart.current={mx:e.clientX,my:e.clientY,px:pan.x,py:pan.y};return;}
    if(activeTool==="select"){
      const hit=hitTest(activeMarkupsList,ip,zoom,reproCollecting);
      setSelectedId(hit);
      if(hit){
        const m=activeMarkupsList.find(x=>x.id===hit);
        if(m?.locked){isDragging.current=false;return;}
        if(e.ctrlKey&&(m.type==="curve"||m.type==="polygon")){
          const vp=vpts(m);
          let bestIdx=-1,bestDist=Infinity;
          for(let i=0;i<vp.length;i++){const d=dist(ip,vp[i]);if(d<bestDist){bestDist=d;bestIdx=i;}}
          const newPoints=[...m.points];
          newPoints.splice(bestIdx+1,0,ip);
          updMarkup(hit,{points:newPoints});
          return;
        }
        if(e.shiftKey&&(m.type==="curve"||m.type==="polygon")){
          const vp=vpts(m);
          let bestIdx=-1,bestDist=Infinity;
          for(let i=0;i<vp.length;i++){const d=dist(ip,vp[i]);if(d<bestDist){bestDist=d;bestIdx=i;}}
          if(bestIdx>=0&&vp.length>2){const newPoints=m.points.filter((_,i)=>i!==bestIdx);updMarkup(hit,{points:newPoints});}
          return;
        }
        isDragging.current=true;dragMid.current=hit;dragStartState.current=JSON.stringify(activeMarkupsList);
        let bi=0,bd=Infinity;(m.points||[]).forEach((p,i)=>{const d=dist(p,ip);if(d<bd){bd=d;bi=i;}});
        dragPtIdx.current=bi;dragStart.current=ip;
      }
      return;
    }
    if(activeTool==="text"){setPendingTextPos(ip);return;}
    if(activeTool==="point"){
      if(reproCollecting){
        const{studyId,opId,trialIdx}=reproCollecting;
        const study=reproStudies.find(s=>s.id===studyId);
        if(study){
          const n=activeMarkupsList.filter(m=>m.type==="point"&&m.repro&&m.repro.studyId===studyId&&m.repro.opId===opId&&m.repro.trialIdx===trialIdx).length;
          const label=`L${n+1}`;
          const measurementId=uid();
          addMarkup({type:"point",points:[ip],label,color:t.acc,size:6,definition:"",repro:{studyId,opId,trialIdx,measurementId}});
          setReproStudies(prev=>prev.map(s=>{
            if(s.id!==studyId)return s;
            return{...s,operators:s.operators.map(o=>{
              if(o.id!==opId)return o;
              const trials=[...(o.trials||[])];
              while(trials.length<=trialIdx)trials.push({id:uid(),measurements:[]});
              const tr=trials[trialIdx]||{id:uid(),measurements:[]};
              trials[trialIdx]={...tr,measurements:[...(tr.measurements||[]),{id:measurementId,label,x:ip.x,y:ip.y,timestamp:Date.now()}]};
              return{...o,trials};
            })};
          }));
        }
        return;
      }
      const nNon=activeMarkupsList.filter(m=>m.type==="point"&&!m.repro).length;
      addMarkup({type:"point",points:[ip],label:`P${nNon+1}`,color:t.acc,size:6,definition:""});
      return;
    }
    if(activeTool==="ruler"){if(!currentDraw)setCurrentDraw({type:"ruler",points:[ip]});else{const ruler={...currentDraw,type:"ruler",points:[...currentDraw.points,ip],label:"Ruler"};setPendingRuler(ruler);addMarkup(ruler);setCurrentDraw(null);setShowCalib(true);}return;}
    if(activeTool==="parallel"){if(selectedMarkup&&(selectedMarkup.type==="line"||selectedMarkup.type==="parallel")){const vp=vpts(selectedMarkup);if(vp.length>=2){const dx=vp[1].x-vp[0].x,dy=vp[1].y-vp[0].y,len=Math.sqrt(dx*dx+dy*dy)||1,half=len/2;addMarkup({type:"parallel",points:[{x:ip.x-dx/len*half,y:ip.y-dy/len*half},{x:ip.x+dx/len*half,y:ip.y+dy/len*half}],color:"#34d399",width:1.5,style:"solid",label:`∥`,showLength:true});return;}}if(!currentDraw)setCurrentDraw({type:"line",points:[ip]});else{finalizeMarkup({...currentDraw,points:[...currentDraw.points,ip]});setCurrentDraw(null);}return;}
    if(activeTool==="midpoint"){if(!currentDraw)setCurrentDraw({type:"midpoint",points:[ip]});else{const p1=currentDraw.points[0],p2=ip;if(p1.x>-9000&&p2.x>-9000){const mid={x:(p1.x+p2.x)/2,y:(p1.y+p2.y)/2};const n=activeMarkupsList.filter(m=>m.type==="point").length;addMarkup({type:"point",points:[mid],label:`M${n+1}`,color:"#fbbf24",size:6,definition:"Midpoint"});}setCurrentDraw(null);}return;}
    if(activeTool==="perppoint"){if(!currentDraw)setCurrentDraw({type:"perppoint",points:[ip]});else if(currentDraw.points.length===1)setCurrentDraw({type:"perppoint",points:[currentDraw.points[0],ip]});else{const p1=currentDraw.points[0],p2=currentDraw.points[1],p3=ip;if(p1.x>-9000&&p2.x>-9000&&p3.x>-9000){const lx1=p2.x-p1.x,ly1=p2.y-p1.y;const lx2=-ly1,ly2=lx1;const perpPt={x:p3.x+lx2,y:p3.y+ly2};const n=activeMarkupsList.filter(m=>m.type==="line"||m.type==="perp").length+1;addMarkup({type:"line",mode:"segment",points:[perpPt,p3],color:"#f472b6",width:1.5,style:"solid",label:`⊥${n}`,showLength:true});}setCurrentDraw(null);}return;}
    if(activeTool==="arrow"){if(!currentDraw)setCurrentDraw({type:"arrow",points:[ip]});else{const p1=currentDraw.points[0],p2=ip;if(p1.x>-9000&&p2.x>-9000){addMarkup({type:"arrow",points:[p1,p2],color:"#34d399",width:2});}setCurrentDraw(null);}return;}
    if(["line","angle3","angle4","polygon","curve","perp"].includes(activeTool)){
      if(!currentDraw)setCurrentDraw({type:activeTool,points:[ip],curveStyle:["curve","polygon"].includes(activeTool)?curveMode:"linear"});
      else{const nps=[...currentDraw.points,ip];const need={line:2,angle3:3,angle4:4,perp:3}[activeTool];if(need&&nps.length>=need){finalizeMarkup({...currentDraw,points:nps});setCurrentDraw(null);}else setCurrentDraw({...currentDraw,points:nps});}return;}
  },[activeTool,markups,zoom,pan,snapEnabled,currentDraw,selectedMarkup,curveMode,placingMode,placingQueue,placingIdx,reproCollecting,reproStudies,databaseMode,databaseImages,currentImageIndex]);

  const handleMouseMove=useCallback(e=>{
    const currentDbImg=databaseMode&&!reproCollecting&&databaseImages.length>0?databaseImages[currentImageIndex]:null;
    const dbMarkups=currentDbImg?.markups||[];
    const activeMarkupsList=databaseMode&&!reproCollecting?dbMarkups:markups;
    const sp=getCanvasPos(e);setMousePos(sp);
    if(snapEnabled&&activeTool!=="select"&&activeTool!=="pan"){const ip=toImage(sp.x,sp.y);const sn=snapPoint(ip,activeMarkupsList,12/zoom,snapEnabled);setSnapPos((Math.abs(sn.x-ip.x)>0.1||Math.abs(sn.y-ip.y)>0.1)?sn:null);}else setSnapPos(null);
    if(isPanning.current&&panStart.current)setPan({x:panStart.current.px+(e.clientX-panStart.current.mx),y:panStart.current.py+(e.clientY-panStart.current.my)});
    if(isDragging.current&&dragMid.current){const ip=toImage(sp.x,sp.y);const dx=ip.x-dragStart.current.x,dy=ip.y-dragStart.current.y;updMarkup(dragMid.current,{points:(activeMarkupsList.find(m=>m.id===dragMid.current)?.points||[]).map((p,i)=>i===dragPtIdx.current?{x:p.x+dx,y:p.y+dy}:p)});dragStart.current=ip;}
  },[activeTool,markups,zoom,snapEnabled,databaseMode,databaseImages,currentImageIndex,reproCollecting]);

  const handleMouseUp=()=>{
    const currentDbImg=databaseMode&&!reproCollecting&&databaseImages.length>0?databaseImages[currentImageIndex]:null;
    const activeMarkupsList=databaseMode&&!reproCollecting?(currentDbImg?.markups||[]):markups;
    if(isDragging.current&&dragStartState.current){
      const currentState=JSON.stringify(activeMarkupsList);
      if(dragStartState.current!==currentState){
        undoStackRef.current.push(dragStartState.current);
        if(undoStackRef.current.length>50)undoStackRef.current.shift();
        redoStackRef.current=[];
      }
      dragStartState.current=null;
    }
    isPanning.current=false;isDragging.current=false;
  };
  const handleDblClick=()=>{if((activeTool==="polygon"||activeTool==="curve")&&currentDraw?.points.length>=2){finalizeMarkup(currentDraw);setCurrentDraw(null);}};
  useEffect(()=>{const c=canvasRef.current;if(!c)return;const onWheel=e=>{if(Math.abs(e.deltaY)>0.1||Math.abs(e.deltaX)>0.1){e.preventDefault();e.stopPropagation();const sp=getCanvasPos(e),f=e.deltaY>0?0.9:1.1,nz=clamp(zoom*f,0.05,15);setPan(prev=>({x:sp.x-(sp.x-prev.x)*(nz/zoom),y:sp.y-(sp.y-prev.y)*(nz/zoom)}));setZoom(nz);}};c.addEventListener("wheel",onWheel,{passive:false});return()=>c.removeEventListener("wheel",onWheel);},[zoom]);
  const handleTouchStart=e=>{e.preventDefault();if(e.touches.length===1){const t2=e.touches[0];handleMouseDown({button:0,clientX:t2.clientX,clientY:t2.clientY});}if(e.touches.length===2)lastTouchDist.current=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);};
  const handleTouchMove=e=>{e.preventDefault();if(e.touches.length===1){const t2=e.touches[0];handleMouseMove({clientX:t2.clientX,clientY:t2.clientY});}if(e.touches.length===2&&lastTouchDist.current){const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);const f=d/lastTouchDist.current,nz=clamp(zoom*f,0.05,15);const cx=(e.touches[0].clientX+e.touches[1].clientX)/2,cy=(e.touches[0].clientY+e.touches[1].clientY)/2;const r=canvasRef.current.getBoundingClientRect();const sp={x:cx-r.left,y:cy-r.top};setPan(prev=>({x:sp.x-(sp.x-prev.x)*(nz/zoom),y:sp.y-(sp.y-prev.y)*(nz/zoom)}));setZoom(nz);lastTouchDist.current=d;}};
  const handleTouchEnd=()=>{handleMouseUp();lastTouchDist.current=null;};

  const finalizeCalib=(mm,manualPpm)=>{
    const useDb=databaseMode&&databaseImages.length>0&&!reproCollecting;
    if(useDb){
      const currentDbImg=databaseImages[currentImageIndex];
      const currentMarkups=currentDbImg?.markups||[];
      if(manualPpm){
        updateDatabaseImage(currentImageIndex,{calibration:{done:true,pxPerMm:manualPpm,knownMm:mm}});
        setShowCalib(false);
        return;
      }
      const ruler=pendingRuler||currentMarkups.find(m=>m.type==="ruler");if(!ruler)return;const vp=vpts(ruler);if(vp.length<2)return;
      updateDatabaseImage(currentImageIndex,{calibration:{done:true,pxPerMm:dist(vp[0],vp[1])/mm,knownMm:mm}});
      setShowCalib(false);
      return;
    }
    if(manualPpm){updVer({calibration:{done:true,pxPerMm:manualPpm,knownMm:mm}});setShowCalib(false);return;}
    const ruler=pendingRuler||markups.find(m=>m.type==="ruler");if(!ruler)return;const vp=vpts(ruler);if(vp.length<2)return;
    updVer({calibration:{done:true,pxPerMm:dist(vp[0],vp[1])/mm,knownMm:mm}});setShowCalib(false);
  };

  const loadTemplate=(analysis)=>{
    const newMarkups=[];
    const pointIds={};
    analysis.pts.forEach(pt=>{
      const id=uid();
      pointIds[pt.l]=id;
      newMarkups.push({id,type:"point",points:[{x:-99999,y:-99999}],label:pt.l,definition:pt.def,color:pt.color,size:6,visible:true,placed:false});
    });
    updVer({markups:[...markups,...newMarkups],analysisTemplate:analysis.name});
    setPlacingQueue(newMarkups.map(m=>m.id));setPlacingIdx(0);setPlacingMode(true);setRightPanel("markups");
  };

  const handleTemplatePick=(type,analysis,file)=>{
    setShowTemplatePicker(false);
    if(type==="blank")return;
    if(type==="analysis"&&analysis){loadTemplate(analysis);return;}
    if(type==="complete"&&analysis){loadTemplate(analysis);return;}
    if(type==="upload"&&file){
      importCepht(file,d=>{if(d.markups)updVer({markups:d.markups,analysisTemplate:d.name||"Imported"});});
    }
  };

  const exportCSV=()=>{
    const rows=[["ID","Type","Label","Definition","Points_px","Measurement","Value","Unit"]];
    markups.forEach(m=>{const meas=computeMeasurements(m,calibration);const ps=vpts(m).map(p=>`(${p.x.toFixed(1)},${p.y.toFixed(1)})`).join(";");if(!Object.keys(meas).length)rows.push([m.id,m.type,m.label||"",m.definition||"",ps,"","",""]);else Object.entries(meas).forEach(([k,v])=>rows.push([m.id,m.type,m.label||"",m.definition||"",ps,k,v.toFixed(2),k==="angle"?formatAngle(v):"mm"]));});
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([rows.map(r=>r.map(c=>`"${c}"`).join(",")).join("\n")],{type:"text/csv"}));a.download=`${project.name}.csv`;a.click();
  };

  const measScope=useMemo(()=>buildScope(markups,calibration),[markups,calibration]);
  const allMeas=useMemo(()=>markups.map(m=>({m,meas:computeMeasurements(m,calibration)})).filter(x=>Object.keys(x.meas).length>0),[markups,calibration]);
  const cursorStyle={select:"default",pan:"grab",point:"crosshair",line:"crosshair",angle3:"crosshair",angle4:"crosshair",polygon:"crosshair",curve:"crosshair",perp:"crosshair",parallel:"crosshair",midpoint:"crosshair",perppoint:"crosshair",arrow:"crosshair",text:"text",ruler:"crosshair"}[activeTool]||"default";
  const availAnalyses=PREDEFINED[project.projection]||[];

  const panelIcons={markups:"◉",measurements:"📏",formulas:"∑",image:"▦",layers:"⊞",versions:"☰",reproducibility:"↻",statistics:"σ",templates:"▤",themes:"◐","repro-stats":"≋"};
  const panelTabs=[["markups","Markups"],["measurements","Measure"],["formulas","Formulas"],["image","Image"],["layers","Layers"],["versions","Versions"],["reproducibility","Reproducibility"],["statistics","Statistics"],["repro-stats","Repro Stats"],["templates","Templates"],["themes","Themes"]];

  return(
    <div style={{height:"100vh",display:"flex",flexDirection:"column",background:t.bg,color:t.tx,fontFamily:"'DM Sans',sans-serif",overflow:"hidden"}}>
      {/* hidden file inputs */}
      <input ref={openImgRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{if(e.target.files[0])loadImage(e.target.files[0]);e.target.value="";}}/>
      <input ref={stackImgRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{if(e.target.files[0])loadImage(e.target.files[0],true);e.target.value="";}}/>
      <input ref={importRef} type="file" accept=".cephx" style={{display:"none"}} onChange={e=>{if(e.target.files[0])importCephx(e.target.files[0],p=>{onUpdateProject(p);});e.target.value="";}}/>

      {/* TOP BAR */}
      <div style={{display:"flex",alignItems:"center",gap:6,padding:"0 10px",height:isMobile?42:46,background:t.surf,flexShrink:0,overflowX:"auto"}}>
        <button onClick={onHome} title="Back to Home" style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:4,padding:"4px 8px",borderRadius:6,flexShrink:0,color:t.tx}}>
          <span style={{fontSize:18}}>←</span>
        </button>
        <button onClick={onHome} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:5,padding:"4px 8px",borderRadius:6,flexShrink:0}}>
          <span style={{fontSize:18}}>⊛</span>
          {!isMobile&&<span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:t.tx,fontSize:17}}>CephaloStudio</span>}
        </button>
        <div style={{width:1,height:20,background:t.bdr,flexShrink:0}}/>
        <Tag color={t.acc}>{project.projection?.toUpperCase()}</Tag>
        {project.meta?.anonymized&&<Tag color={t.ok}>🔒 Anon</Tag>}
        {calibration.done&&!databaseMode&&<Tag color={t.ok}>⟺ {calibration.pxPerMm.toFixed(2)}px/mm</Tag>}
        {databaseMode&&<div style={{display:"flex",alignItems:"center",gap:4}}>
          <button onClick={()=>navigateImage("prev")} disabled={currentImageIndex===0} style={{background:"none",border:`1px solid ${t.bdr}`,borderRadius:4,padding:"2px 8px",cursor:currentImageIndex===0?"not-allowed":"pointer",color:currentImageIndex===0?t.tx3:t.tx}}>◀</button>
          <span style={{fontSize:11,fontFamily:"'DM Mono',monospace",color:t.acc}}>{currentImageIndex+1} / {databaseImages.length}</span>
          <button onClick={()=>navigateImage("next")} disabled={currentImageIndex>=databaseImages.length-1} style={{background:"none",border:`1px solid ${t.bdr}`,borderRadius:4,padding:"2px 8px",cursor:currentImageIndex>=databaseImages.length-1?"not-allowed":"pointer",color:currentImageIndex>=databaseImages.length-1?t.tx3:t.tx}}>▶</button>
        </div>}
        {placingMode&&<Tag color={t.warn}>📍 {placingIdx+1}/{placingQueue.length}</Tag>}
        <div style={{flex:1}}/>
        {!isMobile&&<>
          <Btn t={t} small active={snapEnabled} onClick={()=>setSnapEnabled(v=>!v)}>⊙ Snap</Btn>
          <Btn t={t} small active={showScaleBar} onClick={()=>setShowScaleBar(v=>!v)}>⟺</Btn>
          {project.images.length>1&&<Btn t={t} small active={showDisplacement} onClick={()=>setShowDisplacement(v=>!v)}>⇝ Vec</Btn>}
          <div style={{width:1,height:20,background:t.bdr}}/>
        </>}
        <Btn t={t} small onClick={()=>openImgRef.current?.click()}>Open</Btn>
        {!isMobile&&<Btn t={t} small onClick={()=>stackImgRef.current?.click()}>+ Stack</Btn>}
        <Btn t={t} small onClick={()=>exportCephx(project)}>Save</Btn>
        {!isMobile&&<div style={{display:"flex",alignItems:"center",gap:6}}>
          <Btn t={t} small onClick={()=>setShowDatabaseImport(true)}>DB</Btn>
          <button onClick={()=>{if(!databaseMode&&databaseImages.length===0)setShowDatabaseImport(true);else if(databaseMode){setDatabaseMode(false);setDatabaseImages([]);setCurrentImageIndex(0);}}} title={databaseImages.length===0?"Import images first":"Toggle Database Mode"} style={{background:"none",border:"none",cursor:databaseImages.length===0?"not-allowed":"pointer",padding:4,display:"flex",alignItems:"center",opacity:databaseImages.length===0?0.5:1}}>
            <div style={{width:36,height:20,borderRadius:10,background:databaseMode?t.acc:t.surf3,border:`1px solid ${databaseMode?t.acc:t.bdr}`,position:"relative",transition:"all 0.2s"}}>
              <div style={{width:16,height:16,borderRadius:8,background:databaseMode?(t.id==="light"?"#fff":t.bg):t.tx,position:"absolute",top:1,left:databaseMode?18:2,transition:"all 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,3)"}}/>
            </div>
          </button>
        </div>}
        {!isMobile&&<Btn t={t} small onClick={()=>setShowExport(true)}>Export</Btn>}
        {!isMobile&&<Btn t={t} small onClick={()=>setShowAnon(true)}>Anonymization</Btn>}
        <div style={{width:1,height:20,background:t.bdr,flexShrink:0}}/>
        {Object.values(THEMES).map(th=>(
          <button key={th.id} onClick={()=>setTheme(th.id)} title={th.name} style={{width:22,height:22,borderRadius:6,border:theme===th.id?`2px solid ${t.acc}`:`1px solid ${t.bdr}`,background:th.bg,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{width:10,height:10,borderRadius:3,background:th.acc}}/>
          </button>
        ))}
        {isMobile&&<Btn t={t} small active={showMobilePanel} onClick={()=>setShowMobilePanel(v=>!v)}>≡</Btn>}
      </div>

      {/* BODY */}
      <div style={{flex:1,display:"flex",overflow:"hidden",position:"relative"}}>
        {/* TOOL SIDEBAR */}
        {(!isMobile||!showMobilePanel)&&(
          <div style={isMobile?{position:"fixed",bottom:0,left:0,right:0,height:52,display:"flex",flexDirection:"row",alignItems:"center",justifyContent:"center",borderTop:`1px solid ${t.bdr}`,zIndex:20,background:t.surf,padding:"0 4px",gap:2}:{width:88,background:t.surf,display:"flex",flexDirection:"column",alignItems:"center",padding:"8px 4px",gap:1,flexShrink:0,overflowY:"auto",scrollbarWidth:"thin"}}>
            {/* Two-column tool layout */}
            <div style={{display:"flex",flexDirection:"column",gap:1,width:"100%"}}>
              {/* Row 1: Select | Pan */}
              <div style={{display:"flex",gap:1}}>
                <ToolBtn tool={{id:"select",icon:"⊹",label:"Select/Move"}} active={activeTool==="select"} onClick={()=>{setActiveTool("select");setCurrentDraw(null);}} theme={theme} t={t} style={{flex:1}}/>
                <ToolBtn tool={{id:"pan",icon:"⊕",label:"Pan"}} active={activeTool==="pan"} onClick={()=>{setActiveTool("pan");setCurrentDraw(null);}} theme={theme} t={t} style={{flex:1}}/>
              </div>
              {/* Row 2: Landmark | Midpoint */}
              <div style={{display:"flex",gap:1}}>
                <ToolBtn tool={{id:"point",icon:"◉",label:"Landmark"}} active={activeTool==="point"} onClick={()=>{setActiveTool("point");setCurrentDraw(null);}} theme={theme} t={t} style={{flex:1}}/>
                <ToolBtn tool={{id:"midpoint",icon:"◈",label:"Midpoint"}} active={activeTool==="midpoint"} onClick={()=>{setActiveTool("midpoint");setCurrentDraw(null);}} theme={theme} t={t} style={{flex:1}}/>
              </div>
              {/* Row 3: Line | Parallel */}
              <div style={{display:"flex",gap:1}}>
                <ToolBtn tool={{id:"line",icon:"⟋",label:"Line"}} active={activeTool==="line"} onClick={()=>{setActiveTool("line");setCurrentDraw(null);}} theme={theme} t={t} style={{flex:1}}/>
                <ToolBtn tool={{id:"parallel",icon:"⫿",label:"Parallel"}} active={activeTool==="parallel"} onClick={()=>{setActiveTool("parallel");setCurrentDraw(null);}} theme={theme} t={t} style={{flex:1}}/>
              </div>
              {/* Row 4: Perp Point | Perp Dist */}
              <div style={{display:"flex",gap:1}}>
                <ToolBtn tool={{id:"perppoint",icon:"⊦",label:"Perp Point"}} active={activeTool==="perppoint"} onClick={()=>{setActiveTool("perppoint");setCurrentDraw(null);}} theme={theme} t={t} style={{flex:1}}/>
                <ToolBtn tool={{id:"perp",icon:"⊥",label:"Perp Dist"}} active={activeTool==="perp"} onClick={()=>{setActiveTool("perp");setCurrentDraw(null);}} theme={theme} t={t} style={{flex:1}}/>
              </div>
              {/* Row 5: Angle3pt | Angle4pt */}
              <div style={{display:"flex",gap:1}}>
                <ToolBtn tool={{id:"angle3",icon:"∠",label:"Angle 3-pt"}} active={activeTool==="angle3"} onClick={()=>{setActiveTool("angle3");setCurrentDraw(null);}} theme={theme} t={t} style={{flex:1}}/>
                <ToolBtn tool={{id:"angle4",icon:"∡",label:"Angle 4-pt"}} active={activeTool==="angle4"} onClick={()=>{setActiveTool("angle4");setCurrentDraw(null);}} theme={theme} t={t} style={{flex:1}}/>
              </div>
              {/* Row 6: Polygon | Curve */}
              <div style={{display:"flex",gap:1}}>
                <ToolBtn tool={{id:"polygon",icon:"⬡",label:"Polygon"}} active={activeTool==="polygon"} onClick={()=>{setActiveTool("polygon");setCurrentDraw(null);}} theme={theme} t={t} style={{flex:1}}/>
                <ToolBtn tool={{id:"curve",icon:"∿",label:"Curve"}} active={activeTool==="curve"} onClick={()=>{setActiveTool("curve");setCurrentDraw(null);}} theme={theme} t={t} style={{flex:1}}/>
              </div>
              {/* Row 7: Arrow | Text */}
              <div style={{display:"flex",gap:1}}>
                <ToolBtn tool={{id:"arrow",icon:"→",label:"Arrow"}} active={activeTool==="arrow"} onClick={()=>{setActiveTool("arrow");setCurrentDraw(null);}} theme={theme} t={t} style={{flex:1}}/>
                <ToolBtn tool={{id:"text",icon:"T",label:"Text"}} active={activeTool==="text"} onClick={()=>{setActiveTool("text");setCurrentDraw(null);}} theme={theme} t={t} style={{flex:1}}/>
              </div>
              {/* Row 8: Ruler (centered) */}
              <div style={{display:"flex",justifyContent:"center"}}>
                <ToolBtn tool={{id:"ruler",icon:"⟺",label:"Ruler"}} active={activeTool==="ruler"} onClick={()=>{setActiveTool("ruler");setCurrentDraw(null);}} theme={theme} t={t}/>
              </div>
              {/* Separator */}
              <div style={{width:"100%",height:1,background:t.bdr,margin:"4px 0"}}/>
              {/* Row 9: Undo | Redo */}
              <div style={{display:"flex",gap:1}}>
                <button onClick={undo} disabled={undoStackRef.current.length===0} style={{flex:1,height:32,borderRadius:6,border:"none",background:activeTool==="select"?"transparent":"transparent",color:undoStackRef.current.length>0?t.tx2:t.bdr,cursor:undoStackRef.current.length>0?"pointer":"not-allowed",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} title="Undo (Ctrl+Z)">↶</button>
                <button onClick={redo} disabled={redoStackRef.current.length===0} style={{flex:1,height:32,borderRadius:6,border:"none",background:activeTool==="select"?"transparent":"transparent",color:redoStackRef.current.length>0?t.tx2:t.bdr,cursor:redoStackRef.current.length>0?"pointer":"not-allowed",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} title="Redo (Ctrl+Y)">↷</button>
              </div>
              {/* Row 10: Zoom in | Zoom out */}
              <div style={{display:"flex",gap:1}}>
                <button onClick={()=>setZoom(z=>clamp(z*1.3,0.05,15))} style={{flex:1,height:32,borderRadius:6,border:"none",background:"transparent",color:t.tx2,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} title="Zoom In">＋</button>
                <button onClick={()=>setZoom(z=>clamp(z/1.3,0.05,15))} style={{flex:1,height:32,borderRadius:6,border:"none",background:"transparent",color:t.tx2,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} title="Zoom Out">－</button>
              </div>
              {/* Row 11: Fit to Window */}
              <div style={{display:"flex",justifyContent:"center"}}>
                <button onClick={()=>{setZoom(1);setPan({x:40,y:40});}} style={{width:38,height:32,borderRadius:6,border:"none",background:"transparent",color:t.tx2,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} title="Fit to Window (⊙)">⊙</button>
              </div>
              {/* Separator */}
              <div style={{width:"100%",height:1,background:t.bdr,margin:"4px 0"}}/>
              {/* Cal indicator */}
              {calibration.done&&<div style={{display:"flex",justifyContent:"center"}}><div style={{fontSize:8,color:t.ok,fontFamily:"'DM Mono',monospace",fontWeight:700,textAlign:"center",padding:"2px 0"}}>⟺{calibration.pxPerMm.toFixed(1)}</div></div>}
              {/* Zoom % */}
              <div style={{display:"flex",justifyContent:"center"}}><div style={{fontSize:9,color:t.tx3,fontFamily:"'DM Mono',monospace",textAlign:"center",padding:"2px 0"}}>{(zoom*100).toFixed(0)}%</div></div>
            </div>
          </div>
        )}

        {/* CANVAS */}
        <div ref={containerRef} style={{flex:1,position:"relative",overflow:"hidden",background:t.bg}} onDrop={handleDrop} onDragOver={e=>e.preventDefault()}>
          <canvas ref={canvasRef} style={{display:"block",cursor:cursorStyle,touchAction:"none",background:"transparent"}}
            onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
            onDoubleClick={handleDblClick}
            onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}/>
          {!isMobile&&<div style={{position:"absolute",bottom:isMobile?60:8,left:8,display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            {mousePos&&<div style={{background:t.surf+"ee",border:`1px solid ${t.bdr}`,borderRadius:6,padding:"3px 10px",fontSize:11,color:t.tx2,fontFamily:"'DM Mono',monospace"}}>
              {(()=>{const ip=toImage(mousePos.x,mousePos.y);return`${ip.x.toFixed(1)}, ${ip.y.toFixed(1)} px${calibration.done?` · (${(ip.x/calibration.pxPerMm).toFixed(1)}, ${(ip.y/calibration.pxPerMm).toFixed(1)} mm)`:""}`})()}
            </div>}
            {currentDraw&&<div style={{background:t.acc+"22",border:`1px solid ${t.acc}`,borderRadius:6,padding:"3px 10px",fontSize:11,color:t.acc,fontFamily:"'DM Mono',monospace"}}>
              {["polygon","curve"].includes(activeTool)?`${currentDraw.points.length} pts · dbl-click done`:(()=>{const n={line:2,angle3:3,angle4:4,perp:3,ruler:2}[activeTool];return`${currentDraw.points.length}/${n}`;})()}
            </div>}
          </div>}
        </div>

        {/* RIGHT PANEL — VSCode-style vertical tabs on left */}
        {(!isMobile||(isMobile&&showMobilePanel))&&(
          <div style={{...(isMobile?{position:"fixed",top:42,right:0,bottom:52,width:"85vw",maxWidth:300,zIndex:15,boxShadow:`-4px 0 20px ${t.shadow}`}:{width:rightPanelWidth,flexShrink:0}),background:t.surf,display:"flex",flexDirection:"row",userSelect:rightPanelResizing?"none":"auto",cursor:rightPanelResizing?"col-resize":"auto"}}>
            {/* Vertical tabs on left side */}
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",paddingTop:8,flexShrink:0,background:t.surf2}}>
              {panelTabs.map(([id,label])=>{
                const icons={markups:"◉",measurements:"📏",formulas:"∑",image:"▦",layers:"⊞",versions:"☰",reproducibility:"↻",statistics:"σ",templates:"▤",themes:"◐"};
                return(
                  <button key={id} onClick={()=>setRightPanel(id)} title={label}
                    onMouseEnter={e=>{if(rightPanel!==id)e.currentTarget.style.background=t.accMuted;e.currentTarget.style.color=t.acc;}}
                    onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=rightPanel===id?t.acc:t.tx;}}
                    style={{width:52,minHeight:52,padding:"6px 4px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,border:"none",background:"transparent",color:rightPanel===id?t.acc:t.tx,cursor:"pointer",borderRadius:8,marginBottom:4,transition:"all 0.15s",boxShadow:rightPanel===id?`inset 2px 0 0 ${t.acc}`:"none"}}>
                    <span style={{fontSize:24}}>{icons[id]||"○"}</span>
                  </button>
                );
              })}
            </div>
              {/* Panel content — scrollbar hidden but scrollable */}
            <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
              {/* Panel header */}
              <div style={{padding:"12px 14px 10px",borderBottom:`1px solid ${t.bdr}`,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
                  <span style={{fontSize:18}}>{panelIcons[rightPanel]||"○"}</span>
                  <span style={{fontSize:13,fontWeight:700,color:t.tx,textTransform:"capitalize",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{panelTabs.find(([id])=>id===rightPanel)?.[1]}</span>
                </div>
                <button onClick={()=>setRightPanelWidth(prev=>prev<440?440:320)} style={{background:"none",border:"none",color:t.tx2,cursor:"pointer",fontSize:14,padding:4}} title={rightPanelWidth<440?"Expand panel":"Collapse panel"}>
                  {rightPanelWidth<400?"⤢":"⤥"}
                </button>
              </div>
              <div style={{flex:1,overflowY:"auto",scrollbarWidth:"none"}}>
                <style>{`.panel-scroll::-webkit-scrollbar{display:none}`}</style>
                <div className="panel-scroll">
                  {rightPanel==="markups"&&(databaseMode?
                    <MarkupsPanel 
                      markups={databaseImages[currentImageIndex]?.markups||[]} 
                      t={t} 
                      theme={theme} 
                      selectedId={selectedId} 
                      onSelect={setSelectedId} 
                      onDelete={(id)=>{const newMarkups=(databaseImages[currentImageIndex]?.markups||[]).filter(m=>m.id!==id);updateDatabaseImage(currentImageIndex,{markups:newMarkups});if(selectedId===id)setSelectedId(null);}} 
                      onToggleVisible={(id)=>{const m=(databaseImages[currentImageIndex]?.markups||[]).find(m=>m.id===id);if(m)updateDatabaseImage(currentImageIndex,{markups:(databaseImages[currentImageIndex]?.markups||[]).map(mm=>mm.id===id?{...mm,visible:mm.visible===false}:mm)});}} 
                      onToggleLock={(id)=>{const m=(databaseImages[currentImageIndex]?.markups||[]).find(m=>m.id===id);if(m)updateDatabaseImage(currentImageIndex,{markups:(databaseImages[currentImageIndex]?.markups||[]).map(mm=>mm.id===id?{...mm,locked:!m.locked}:mm)});}} 
                      calibration={databaseImages[currentImageIndex]?.calibration||{done:false,pxPerMm:1}} 
                      placingMode={false} placingQueue={[]} placingIdx={0} 
                      onStopPlacing={()=>{}} onPausePlacing={()=>{}} onResumePlacing={()=>{}} 
                      onClear={()=>updateDatabaseImage(currentImageIndex,{markups:[]})} 
                      onAddPoint={()=>{setActiveTool("point");setCurrentDraw(null);}} 
                      norms={[]} 
                      formatAngle={formatAngle} 
                      angleMode={angleMode} 
                      setAngleMode={setAngleMode}
                    />
                    :<MarkupsPanel markups={markups} t={t} theme={theme} selectedId={selectedId} onSelect={setSelectedId} onDelete={delMarkup} onToggleVisible={id=>updMarkup(id,{visible:markups.find(m=>m.id===id)?.visible===false})} onToggleLock={id=>updMarkup(id,{locked:!markups.find(m=>m.id===id)?.locked})} calibration={calibration} placingMode={placingMode} placingQueue={placingQueue} placingIdx={placingIdx} onStopPlacing={()=>{setPlacingMode(false);setPlacingQueue([]);setPlacingIdx(0);}} onPausePlacing={()=>{setPlacingMode(false);}} onResumePlacing={()=>{setPlacingMode(true);}} onClear={()=>updVer({markups:[]})} onAddPoint={()=>{setActiveTool("point");setCurrentDraw(null);}} norms={norms} formatAngle={formatAngle} angleMode={angleMode} setAngleMode={setAngleMode}/>)}
                  {rightPanel==="measurements"&&(databaseMode?
                    <MeasurementsPanel 
                      allMeas={(databaseImages[currentImageIndex]?.markups||[]).map(m=>({m,meas:computeMeasurements(m,databaseImages[currentImageIndex]?.calibration||{done:false,pxPerMm:1})})).filter(x=>Object.keys(x.meas).length>0)} 
                      t={t} 
                      calibration={databaseImages[currentImageIndex]?.calibration||{done:false,pxPerMm:1}} 
                      norms={[]} 
                      onUpdateNorms={()=>{}} 
                      onExportCSV={()=>{}} 
                      onOpenCalib={()=>setShowCalib(true)} 
                      formatAngle={formatAngle}
                    />
                    :<MeasurementsPanel allMeas={allMeas} t={t} calibration={calibration} norms={norms} onUpdateNorms={ns=>updVer({norms:ns})} onExportCSV={exportCSV} onOpenCalib={()=>setShowCalib(true)} formatAngle={formatAngle}/>)}
                  {rightPanel==="formulas"&&<FormulasPanel formulas={formulas} t={t} scope={measScope} onAdd={()=>{setEditFormulaId(null);setShowFormulaEditor(true);}} onEdit={id=>{setEditFormulaId(id);setShowFormulaEditor(true);}} onDelete={id=>updVer({formulas:formulas.filter(f=>f.id!==id)})}/>}
                  {rightPanel==="image"&&<ImagePanel t={t} processing={processing} setProcessing={p=>updVer({processing:p})} lutMode={lutMode} setLutMode={m=>updVer({lutMode:m})} lutInvert={lutInvert} setLutInvert={v=>updVer({lutInvert:v})} showLUT={showLUT} setShowLUT={setShowLUT} showScaleBar={showScaleBar} setShowScaleBar={setShowScaleBar} calibration={calibration} onOpenCalib={()=>setShowCalib(true)} onReset={()=>updVer({processing:{brightness:0,contrast:0,windowWidth:0,windowCenter:128,edgeEnhance:0},lutMode:"gray",lutInvert:false})} onShowHist={()=>setShowHistogram(v=>!v)} showHistogram={showHistogram}/>}
                  {rightPanel==="layers"&&<LayersPanel t={t} images={project.images} onUpdateImages={imgs=>onUpdateProject({images:imgs})} onAddImage={e=>{if(e.target.files[0])loadImage(e.target.files[0],true);}} showDisplacement={showDisplacement} setShowDisplacement={setShowDisplacement} compareVersionId={compareVersionId} setCompareVersionId={setCompareVersionId} versions={project.versions} onShowAlign={()=>setShowAlign(true)} onShowTransform={()=>setShowTransform(true)}/>}
                  {rightPanel==="versions"&&<VersionsPanel project={project} t={t} onUpdateProject={onUpdateProject} onUpdateVersion={onUpdateVersion} onExportTemplate={v=>exportCepht({name:`${project.name}-${v.label}`,projection:project.projection,markups:v.markups||[],formulas:v.formulas||[],norms:v.norms||[]})}/>}
                  {rightPanel==="reproducibility"&&<ReproducibilityPanel t={t} markups={markups} studies={reproStudies} onUpdateStudies={setReproStudies} activeStudyId={activeStudyId} setActiveStudyId={setActiveStudyId} reproCollecting={reproCollecting} setReproCollecting={setReproCollecting}/>}
                  {rightPanel==="statistics"&&(databaseMode?<DatabaseStatsPanel databaseImages={databaseImages} currentImageIndex={currentImageIndex} t={t}/>:<div style={{padding:12}}><div style={{fontSize:12,color:t.tx3,textAlign:"center"}}>Enable Database Mode to view statistics</div></div>)}
                  {rightPanel==="repro-stats"&&<StatisticsPanel t={t} studies={reproStudies}/>}
                  {rightPanel==="templates"&&<TemplatesPanel t={t} projection={project.projection} onLoadTemplate={loadTemplate}/>}
                  {rightPanel==="themes"&&(
                    <div style={{padding:12}}>
                      <div style={{fontSize:11,color:t.tx2,marginBottom:12,lineHeight:1.45}}>
                        Choose a color theme for the interface.
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {Object.values(THEMES).map(th=>(
                          <div key={th.id} onClick={()=>setTheme(th.id)} style={{padding:12,borderRadius:8,background:theme===th.id?t.accMuted:t.surf2,border:`1px solid ${theme===th.id?t.acc:t.bdr}`,cursor:"pointer",display:"flex",alignItems:"center",gap:12,transition:"all 0.15s"}}>
                            <div style={{width:48,height:32,borderRadius:6,background:th.bg,border:`1px solid ${th.bdr}`,display:"flex",flexDirection:"column",gap:2,padding:4,flexShrink:0}}>
                              <div style={{flex:1,display:"flex",gap:2}}><div style={{flex:1,background:th.surf,borderRadius:2}}/><div style={{flex:1,background:th.surf2,borderRadius:2}}/></div>
                              <div style={{height:6,background:`linear-gradient(90deg, ${th.acc} 0%, ${th.err} 50%, ${th.ok} 100%)`,borderRadius:2}}/>
                            </div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:12,fontWeight:600,color:t.tx,marginBottom:2}}>{th.name}</div>
                              <div style={{fontSize:10,color:t.tx2}}>Click to apply</div>
                            </div>
                            {theme===th.id&&<div style={{color:t.acc,fontSize:16}}>✓</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {selectedMarkup&&<div style={{borderTop:`1px solid ${t.bdr}`,padding:12,flexShrink:0,maxHeight:isMobile?180:260,overflowY:"auto",scrollbarWidth:"none"}}>
                <MarkupProps m={selectedMarkup} t={t} theme={theme} onUpdate={p=>updMarkup(selectedMarkup.id,p)} onDelete={()=>delMarkup(selectedMarkup.id)} calibration={calibration} onParallel={()=>setActiveTool("parallel")} formatAngle={formatAngle}/>
              </div>}
            </div>
            {/* Resize handle */}
            <div onMouseDown={()=>setRightPanelResizing(true)} style={{width:4,cursor:"col-resize",background: rightPanelResizing ? t.acc : "transparent",transition:"background 0.15s",flexShrink:0}}/>
          </div>
        )}
      </div>

      {/* MODALS */}
      {showDatabaseImport&&<Modal t={t} title="Database Mode - Import Images" onClose={()=>setShowDatabaseImport(false)}><DatabaseImportModal t={t} onImport={loadDatabaseImages} onClose={()=>setShowDatabaseImport(false)}/></Modal>}
      {showTemplatePicker&&<Modal t={t} title="" onClose={()=>setShowTemplatePicker(false)}><TemplatePickerModal t={t} projection={project.projection} onPick={handleTemplatePick} onClose={()=>setShowTemplatePicker(false)}/></Modal>}
      {showCalib&&<Modal t={t} title="Calibration" onClose={()=>setShowCalib(false)}><CalibModal t={t} calibration={calibration} onFinish={finalizeCalib}/></Modal>}
      {showExport&&<Modal t={t} title="Export" onClose={()=>setShowExport(false)}><div style={{display:"flex",flexDirection:"column",gap:10}}><Btn t={t} onClick={()=>{exportCSV();setShowExport(false);}}>Measurements CSV</Btn><Btn t={t} onClick={()=>{exportCephx(project);setShowExport(false);}}>Full Project .cephx</Btn><Btn t={t} onClick={()=>{exportThemeAsCepht(theme);setShowExport(false);}}>Theme .cepht</Btn></div></Modal>}
      {pendingTextPos&&<Modal t={t} title="Text Annotation" onClose={()=>setPendingTextPos(null)}><TextModal t={t} defaultColor="#fbbf24" onConfirm={(txt,opts)=>{addMarkup({type:"text",points:[pendingTextPos],text:txt,...opts});setPendingTextPos(null);}} onCancel={()=>setPendingTextPos(null)}/></Modal>}
      {showAnon&&<Modal t={t} title="Anonymization & Access" onClose={()=>setShowAnon(false)}><AnonModal t={t} project={project} onUpdateProject={onUpdateProject} onClose={()=>setShowAnon(false)}/></Modal>}
      {showAlign&&<Modal t={t} title="Point-Based Alignment" onClose={()=>setShowAlign(false)}><AlignModal t={t} markups={markups} images={project.images} onUpdateImages={imgs=>onUpdateProject({images:imgs})} onClose={()=>setShowAlign(false)}/></Modal>}
      {showTransform&&<Modal t={t} title="Image Transform" onClose={()=>setShowTransform(false)}><TransformModal t={t} images={project.images} onUpdateImages={imgs=>onUpdateProject({images:imgs})} onClose={()=>setShowTransform(false)}/></Modal>}
      {showFormulaEditor&&<Modal t={t} title={editFormulaId?"Edit Formula":"New Formula"} onClose={()=>setShowFormulaEditor(false)}><FormulaEditor t={t} formula={editFormulaId?formulas.find(f=>f.id===editFormulaId):null} scope={measScope} onSave={f=>{const newFs=editFormulaId?formulas.map(x=>x.id===editFormulaId?f:x):[...formulas,f];updVer({formulas:newFs});setShowFormulaEditor(false);}} onClose={()=>setShowFormulaEditor(false)}/></Modal>}
      {showHistogram&&<FloatingHistogram hist={computeHistogram(project.images[0]?imgRefs.current[project.images[0].id]:null)} t={t} lutMode={lutMode} lutInvert={lutInvert} processing={processing} onProcessingChange={p=>updVer({processing:p})} onClose={()=>setShowHistogram(false)}/>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPRODUCIBILITY PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function ReproducibilityPanel({t,markups,studies,onUpdateStudies,activeStudyId,setActiveStudyId,reproCollecting,setReproCollecting}){
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

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTICS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function reproAllLabels(study){
  const labels=new Set();
  study.operators.forEach(op=>{
    (op.trials||[]).forEach(tr=>{(tr.measurements||[]).forEach(m=>{if(m.label)labels.add(m.label);});});
  });
  return[...labels].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
}

function reproIccMatrix(study,metric){
  if(study.type==="intra"){
    const op=study.operators[0];
    if(!op)return null;
    const trials=(op.trials||[]).filter(tr=>tr.measurements?.length);
    const labels=reproAllLabels(study);
    if(trials.length<2||labels.length<1)return null;
    const rows=trials.map(tr=>labels.map(lab=>{
      const m=(tr.measurements||[]).find(x=>x.label===lab);
      return m?metric==="x"?m.x:m.y:NaN;
    }));
    if(rows.some(r=>r.some(Number.isNaN)))return null;
    return rows;
  }
  const labels=reproAllLabels(study);
  if(labels.length<1)return null;
  const rows=study.operators.map(op=>{
    const tr=op.trials?.[0];
    return labels.map(lab=>{
      const m=(tr?.measurements||[]).find(x=>x.label===lab);
      return m?metric==="x"?m.x:m.y:NaN;
    });
  });
  if(rows.length<2||rows.some(r=>r.some(Number.isNaN)))return null;
  return rows;
}

function reproPairedVectors(study,metric,sessionA,sessionB){
  const labels=reproAllLabels(study);
  if(labels.length<1)return{vals1:[],vals2:[]};
  const pick=(op,trialIdx,lab)=>{
    const tr=op.trials?.[trialIdx];
    const m=(tr?.measurements||[]).find(x=>x.label===lab);
    return m?metric==="x"?m.x:m.y:null;
  };
  if(study.type==="intra"){
    const op=study.operators[0];
    const vals1=[],vals2=[];
    labels.forEach(lab=>{
      const a=pick(op,sessionA,lab),b=pick(op,sessionB,lab);
      if(a!==null&&b!==null){vals1.push(a);vals2.push(b);}
    });
    return{vals1,vals2};
  }
  const opA=study.operators[sessionA],opB=study.operators[sessionB];
  const vals1=[],vals2=[];
  labels.forEach(lab=>{
    const a=pick(opA,0,lab),b=pick(opB,0,lab);
    if(a!==null&&b!==null){vals1.push(a);vals2.push(b);}
  });
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

function StatisticsPanel({t,studies}){
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
                  <span style={{color:t.tx2}}>Landmarks</span><span style={{fontFamily:"'DM Mono',monospace",color:t.acc}}>{labels.length}</span>
                </div>
                <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
                  <Btn t={t} small onClick={()=>exportReproTablesCsv(study)}>⬇ Download tables (.csv)</Btn>
                </div>
              </div>
              <div style={{marginBottom:12}}>
                <div style={{fontSize:10,color:t.tx2,marginBottom:4}}>Coordinate for analysis</div>
                <div style={{display:"flex",gap:6}}>
                  <button type="button" onClick={()=>setMetric("x")} style={{flex:1,padding:"6px",border:`1px solid ${metric==="x"?t.acc:t.bdr}`,borderRadius:6,background:metric==="x"?t.accMuted:t.surf3,color:metric==="x"?t.acc:t.tx2,cursor:"pointer",fontSize:11}}>X (px)</button>
                  <button type="button" onClick={()=>setMetric("y")} style={{flex:1,padding:"6px",border:`1px solid ${metric==="y"?t.acc:t.bdr}`,borderRadius:6,background:metric==="y"?t.accMuted:t.surf3,color:metric==="y"?t.acc:t.tx2,cursor:"pointer",fontSize:11}}>Y (px)</button>
                </div>
              </div>
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:700,color:t.tx,marginBottom:6}}>Descriptive statistics ({metric.toUpperCase()}, px)</div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",fontSize:9,borderCollapse:"collapse"}}>
                    <thead>
                      <tr style={{borderBottom:`1px solid ${t.bdr}`}}>
                        <th style={{textAlign:"left",padding:4,color:t.tx2}}>Landmark</th>
                        <th style={{textAlign:"right",padding:4,color:t.tx2}}>n</th>
                        <th style={{textAlign:"right",padding:4,color:t.tx2}}>Mean</th>
                        <th style={{textAlign:"right",padding:4,color:t.tx2}}>SD</th>
                        <th style={{textAlign:"right",padding:4,color:t.tx2}}>Min</th>
                        <th style={{textAlign:"right",padding:4,color:t.tx2}}>Max</th>
                      </tr>
                    </thead>
                    <tbody>
                      {descriptive.map(row=>(
                        <tr key={row.lab} style={{borderBottom:`1px solid ${t.bdr}44`}}>
                          <td style={{padding:4,color:t.tx,fontWeight:600}}>{row.lab}</td>
                          <td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.n}</td>
                          <td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace",color:t.acc}}>{row.mean!==null?row.mean.toFixed(3):"—"}</td>
                          <td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.sd!==null?row.sd.toFixed(3):"—"}</td>
                          <td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.min!==null?row.min.toFixed(2):"—"}</td>
                          <td style={{padding:4,textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{row.max!==null?row.max.toFixed(2):"—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div style={{marginBottom:12}}>
                <div style={{fontSize:10,color:t.tx2,marginBottom:4}}>Pairwise comparison (Dahlberg, Bland–Altman, paired t)</div>
                {study.type==="intra"&&(
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <div>
                      <div style={{fontSize:9,color:t.tx3,marginBottom:2}}>Trial A</div>
                      <select value={pa} onChange={e=>setPairA(+e.target.value)} style={{width:"100%",padding:"6px 8px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf3,color:t.tx,fontSize:11}}>
                        {(study.operators[0]?.trials||[]).map((tr,i)=>(<option key={i} value={i}>Trial {i+1}</option>))}
                      </select>
                    </div>
                    <div>
                      <div style={{fontSize:9,color:t.tx3,marginBottom:2}}>Trial B</div>
                      <select value={pb} onChange={e=>setPairB(+e.target.value)} style={{width:"100%",padding:"6px 8px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf3,color:t.tx,fontSize:11}}>
                        {(study.operators[0]?.trials||[]).map((tr,i)=>(<option key={i} value={i}>Trial {i+1}</option>))}
                      </select>
                    </div>
                  </div>
                )}
                {study.type==="inter"&&(
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <div>
                      <div style={{fontSize:9,color:t.tx3,marginBottom:2}}>Operator A</div>
                      <select value={pa} onChange={e=>setPairA(+e.target.value)} style={{width:"100%",padding:"6px 8px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf3,color:t.tx,fontSize:11}}>
                        {study.operators.map((op,i)=>(<option key={op.id} value={i}>{op.name||`Operator ${i+1}`}</option>))}
                      </select>
                    </div>
                    <div>
                      <div style={{fontSize:9,color:t.tx3,marginBottom:2}}>Operator B</div>
                      <select value={pb} onChange={e=>setPairB(+e.target.value)} style={{width:"100%",padding:"6px 8px",border:`1px solid ${t.bdr}`,borderRadius:6,background:t.surf3,color:t.tx,fontSize:11}}>
                        {study.operators.map((op,i)=>(<option key={op.id} value={i}>{op.name||`Operator ${i+1}`}</option>))}
                      </select>
                    </div>
                  </div>
                )}
                <div style={{fontSize:9,color:t.tx3,marginTop:6}}>Paired rows: {vals1.length} landmarks with both values</div>
              </div>
              <div style={{border:`1px solid ${t.bdr}`,borderRadius:8,background:t.surf2,padding:12}}>
                <div style={{fontSize:11,fontWeight:700,color:t.acc,marginBottom:10}}>Inferential tests</div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:10,fontWeight:700,color:t.tx2,marginBottom:6}}>Intraclass correlation (ICC)</div>
                  {icc?(
                    <div style={{fontSize:11}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>ICC (absolute agreement)</span><span style={{fontFamily:"'DM Mono',monospace",color:t.acc,fontWeight:700}}>{icc.ICC_Absolute?.toFixed(4)??"—"}</span></div>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>ICC (consistency)</span><span style={{fontFamily:"'DM Mono',monospace",color:t.acc,fontWeight:700}}>{icc.ICC_Consistency?.toFixed(4)??"—"}</span></div>
                      <div style={{padding:"6px 8px",borderRadius:4,background:t.accMuted,color:t.acc,fontWeight:600,textAlign:"center",fontSize:10}}>{icc.interpretation}</div>
                    </div>
                  ):<div style={{color:t.tx3,fontSize:11}}>Need at least two complete sessions and matching landmarks on every session for ICC.</div>}
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:10,fontWeight:700,color:t.tx2,marginBottom:6}}>Dahlberg error</div>
                  {dahl?<div style={{display:"flex",justifyContent:"space-between",fontSize:11}}><span>Random error (paired)</span><span style={{fontFamily:"'DM Mono',monospace",color:t.acc,fontWeight:700}}>{dahl.error.toFixed(4)} px</span></div>:<div style={{color:t.tx3,fontSize:11}}>Need two sessions with the same landmarks.</div>}
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:10,fontWeight:700,color:t.tx2,marginBottom:6}}>Paired t-test</div>
                  {tTest?(
                    <div style={{fontSize:11}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>t</span><span style={{fontFamily:"'DM Mono',monospace",color:t.tx}}>{tTest.t.toFixed(4)}</span></div>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>df</span><span style={{fontFamily:"'DM Mono',monospace",color:t.tx}}>{tTest.df}</span></div>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>p-value</span><span style={{fontFamily:"'DM Mono',monospace",color:tTest.significant?t.err:t.ok,fontWeight:700}}>{tTest.pValue.toFixed(6)}</span></div>
                      <div style={{padding:"6px 8px",borderRadius:4,background:tTest.significant?t.err+"22":t.ok+"22",color:tTest.significant?t.err:t.ok,fontWeight:600,textAlign:"center"}}>{tTest.significant?"Significant (p < 0.05)":"Not significant"}</div>
                    </div>
                  ):<div style={{color:t.tx3,fontSize:11}}>Cannot compute (need paired observations).</div>}
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:t.tx2,marginBottom:6}}>Bland–Altman</div>
                  {bland?(
                    <div style={{fontSize:11}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>Mean difference</span><span style={{fontFamily:"'DM Mono',monospace",color:t.tx}}>{bland.meanDiff.toFixed(4)}</span></div>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>SD of differences</span><span style={{fontFamily:"'DM Mono',monospace",color:t.tx}}>{bland.stdDiff.toFixed(4)}</span></div>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>Lower LoA</span><span style={{fontFamily:"'DM Mono',monospace",color:t.warn}}>{bland.lowerLOA.toFixed(4)}</span></div>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>Upper LoA</span><span style={{fontFamily:"'DM Mono',monospace",color:t.warn}}>{bland.upperLOA.toFixed(4)}</span></div>
                    </div>
                  ):<div style={{color:t.tx3,fontSize:11}}>Cannot compute.</div>}
                </div>
              </div>
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
function TemplatesPanel({t,projection,onLoadTemplate}){
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

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════════════════
export default function CephaloStudio(){
  const[theme,setTheme]=useState("bluish");const t={...THEMES[theme],id:theme};
  const[projects,setProjects]=useState([]);const[activeId,setActiveId]=useState(null);const[pinVerified,setPinVerified]=useState({});

  const activeProject=projects.find(p=>p.id===activeId);
  const needsPin=activeProject&&activeProject.accessControl?.requirePin&&!pinVerified[activeId];

  const updateProject=(id,patch)=>setProjects(prev=>prev.map(p=>p.id===id?{...p,...patch,modified:Date.now()}:p));
  const updateVersion=(projectId,versionId,patch)=>setProjects(prev=>prev.map(p=>{if(p.id!==projectId)return p;return{...p,modified:Date.now(),versions:p.versions.map(v=>v.id===versionId?{...v,...patch}:v)};}));

  const createProject=(projection,name,meta)=>{
    const p={...mkProject(projection),name,meta:{...mkProject(projection).meta,...meta}};
    setProjects(prev=>[...prev,p]);setActiveId(p.id);
  };

  const importCephxFile=(file)=>{
    importCephx(file,proj=>{
      const existing=projects.find(p=>p.id===proj.id);
      if(existing&&!window.confirm("A case with this ID already exists. Overwrite?"))return;
      setProjects(prev=>[...prev.filter(p=>p.id!==proj.id),proj]);setActiveId(proj.id);
    });
  };

  return(
    <div style={{background:t.bg,minHeight:"100vh"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap" rel="stylesheet"/>
      {!activeId&&<HomePage t={t} theme={theme} setTheme={setTheme} projects={projects} onOpen={id=>setActiveId(id)} onCreate={createProject} onImport={importCephxFile}/>}
      {activeId&&needsPin&&<PinGate t={t} project={activeProject} onVerified={()=>setPinVerified(prev=>({...prev,[activeId]:true}))} onCancel={()=>setActiveId(null)}/>}
      {activeId&&!needsPin&&activeProject&&(
        <Workspace key={activeId} project={activeProject}
          onUpdateProject={patch=>updateProject(activeId,patch)}
          onUpdateVersion={(versionId,patch)=>updateVersion(activeId,versionId,patch)}
          onHome={()=>setActiveId(null)} t={t} theme={theme} setTheme={setTheme}/>
      )}
    </div>
  );
}
