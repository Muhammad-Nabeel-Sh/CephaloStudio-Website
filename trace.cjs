const fs=require('fs');
const f=fs.readFileSync('src/App.jsx','utf8');
const lines=f.split('\n');

let brace=0,paren=0,bracket=0,str=null;
let inWorkspace=false;
let workspaceStart=-1;

for(let i=0;i<lines.length;i++){
  const line=lines[i];
  for(let j=0;j<line.length;j++){
    const c=line[j];
    if(str==='//'){if(c==='\n')str=null;}
    else if(str==='/*'){if(c==='*'&&line[j+1]==='/'){j++;str=null;}}
    else if(c==='/'&&line[j+1]==='/'){str='//';j++;}
    else if(c==='/'&&line[j+1]==='*'){str='/*';j++;}
    else if(c==='"'||c==="'"||c===String.fromCharCode(96)){
      if(j===0||line[j-1]!=='\\'){
        if(str===c)str=null;
        else if(!str)str=c;
      }
    }else if(!str){
      if(c==='{'){brace++;if(workspaceStart===-1&&line.includes('function Workspace'))workspaceStart=i+1;}
      if(c==='}')brace--;
      if(c==='(')paren++;
      if(c===')')paren--;
      if(c==='[')bracket++;
      if(c===']')bracket--;
    }
  }
  if(brace===0&&paren===0&&workspaceStart>0&&i>workspaceStart){
    console.log('Workspace function ends at line',i+1);
    break;
  }
}
console.log('Final: brace='+brace+' paren='+paren+' bracket='+bracket);