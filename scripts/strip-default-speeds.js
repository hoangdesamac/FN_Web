#!/usr/bin/env node
/**
 * Strip speeds that were auto-filled as generic defaults (confidence==='default')
 * so we can re-run realism in FILL_DEFAULTS=0 mode and only keep factual.
 */
const fs=require('fs');
const path=require('path');
const FILES=[
  path.join(__dirname,'..','pc-part-dataset','processed','storage.json'),
  path.join(__dirname,'..','docs','pc-part-dataset','processed','storage.json')
];
FILES.forEach(file=>{
  if(!fs.existsSync(file)) return;
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  let stripped=0;
  for(const d of data){
    if(d._confidence==='default'){
      d.read=null; d.write=null; d._confidence='missing'; stripped++;
    }
  }
  fs.writeFileSync(file, JSON.stringify(data));
  console.log('Stripped default speeds', path.basename(file), {stripped});
});
