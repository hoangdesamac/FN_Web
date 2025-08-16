#!/usr/bin/env node
// Export list of storage items still missing read or write AFTER realism pass.
const fs=require('fs');
const path=require('path');
const FILES=[
  path.join(__dirname,'..','pc-part-dataset','processed','storage.json'),
  path.join(__dirname,'..','docs','pc-part-dataset','processed','storage.json')
];
function collect(file){
  if(!fs.existsSync(file)) return {file, missing:[]};
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  const missing=data.filter(d=>{ const isSSD=/(ssd|nvme)/i.test(d.type||''); return isSSD && (d.read==null || d.write==null); });
  return {file, missing: missing.map(m=>({id:m.id,name:m.name,interface:m.interface,type:m.type,read:m.read,write:m.write,_confidence:m._confidence}))};
}
const out=FILES.map(collect);
const outPath=path.join(__dirname,'..','temp','storage-missing-perf.json');
fs.mkdirSync(path.dirname(outPath),{recursive:true});
fs.writeFileSync(outPath, JSON.stringify(out,null,2));
console.log('Exported missing performance list ->', outPath);
