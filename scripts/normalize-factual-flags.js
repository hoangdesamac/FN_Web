#!/usr/bin/env node
// Normalize _confidence and _specSource for storage items matching known factual mapping.
const fs=require('fs');
const path=require('path');
const FACT_FILE=path.join(__dirname,'known-storage-factual.json');
const FILES=[
  path.join(__dirname,'..','pc-part-dataset','processed','storage.json'),
  path.join(__dirname,'..','docs','pc-part-dataset','processed','storage.json')
];
const facts=JSON.parse(fs.readFileSync(FACT_FILE,'utf8'));
const factMap=new Map(facts.map(f=>[f.id,f]));
FILES.forEach(file=>{
  if(!fs.existsSync(file)) return;
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  let updated=0;
  for(const d of data){
    const f=factMap.get(d.id);
    if(!f) continue;
    if(d.read===f.read && d.write===f.write){
      if(d._confidence!=='factual'){ d._confidence='factual'; updated++; }
      d._specSource='factual-map';
    }
  }
  if(updated){ fs.writeFileSync(file, JSON.stringify(data)); }
  console.log('normalize-factual-flags', path.basename(file), {updated});
});
