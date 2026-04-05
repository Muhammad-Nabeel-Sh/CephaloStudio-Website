const fs=require('fs');
const f=fs.readFileSync('src/App.jsx','utf8');
let brace=0,paren=0,bracket=0,str=null;
let line=1;
for(let i=0;i<f.length;i++){
  const c=f[i];
  if(c==='\n')line++;
  if(str==='//'){if(c==='\n')str=null;}
  else if(str==='/*'){if(c==='*'&&f[i+1]==='/'){i++;str=null;}}
  else if(c==='/'&&f[i+1]==='/'){str='//';i++;}
  else if(c==='/'&&f[i+1]==='*'){str='/*';i++;}
  else if(c==='"'||c==="'"||c===String.fromCharCode(96)){
    if(f[i-1]!=='\\'){
      if(str===c)str=null;
      else if(!str)str=c;
    }
  }else if(!str){
    if(c==='{')brace++;
    if(c==='}')brace--;
    if(c==='(')paren++;
    if(c===')')paren--;
    if(c==='[')bracket++;
    if(c===']')bracket--;
  }
  if(paren>1)console.log('Paren='+paren+' at line',line);
}
console.log('Final: brace='+brace+' paren='+paren+' bracket='+bracket);