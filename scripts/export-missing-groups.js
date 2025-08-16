#!/usr/bin/env node
// Group missing perf SSD entries by category & interface for prioritization.
const fs=require('fs');
const path=require('path');
const FILE=path.join(__dirname,'..','pc-part-dataset','processed','storage.json');
if(!fs.existsSync(FILE)){ console.error('Missing storage file'); process.exit(1);} 
const data=JSON.parse(fs.readFileSync(FILE,'utf8'));
function cat(o){ const iface=(o.interface||'').toLowerCase(); if(/pci[e ]5/.test(iface)) return 'NVME5'; if(/pci[e ]4/.test(iface)) return 'NVME4'; if(/pci[e ]3/.test(iface)) return 'NVME3'; if(/sata/.test(iface)) return 'SATA'; return 'OTHER'; }
const missing=data.filter(d=>/(ssd|nvme)/i.test(d.type||'') && (d.read==null || d.write==null));
const groups={};
missing.forEach(m=>{ const c=cat(m); (groups[c]=groups[c]||[]).push(m); });
const summary=Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.length]));
const out={ summary, samples:{} };
Object.keys(groups).forEach(k=>{ out.samples[k]=groups[k].slice(0,15).map(x=>({id:x.id,name:x.name,interface:x.interface,read:x.read,write:x.write,_confidence:x._confidence})); });
const outPath=path.join(__dirname,'..','temp','storage-missing-groups.json');
fs.mkdirSync(path.dirname(outPath),{recursive:true});
fs.writeFileSync(outPath, JSON.stringify(out,null,2));
console.log('Exported grouped missing list ->', outPath, summary);
