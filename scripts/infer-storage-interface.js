#!/usr/bin/env node
// Infer missing or generic interface values for storage items based on name, form factor, and existing hints.
// Only fills when interface is null/empty OR obviously generic (e.g., "M.2" alone) and we can infer more specific.
// Writes changes back to both dataset copies.

const fs=require('fs');
const path=require('path');
const FILES=[
  path.join(__dirname,'..','pc-part-dataset','processed','storage.json'),
  path.join(__dirname,'..','docs','pc-part-dataset','processed','storage.json')
];

// Simple pattern dictionaries
const sataNamePatterns=[/\b870 evo\b/i,/\b870 qvo\b/i,/mx500/i,/a400/i,/\bblue 870\b/i];
const nvmeGen5=[/\bmp700 pro/i,/t700/i,/mp700 elite/i,/gen ?5/i];
const nvmeGen4=[/sn850x/i,/sn850p/i,/sn850\b/i,/sn770/i,/kc3000/i,/rocket 4 plus g/i,/rocket 4 plus\b/i,/rocket 4\.0/i,/p5 plus/i,/seagate firecuda 530/i,/mp700\b/i,/gen ?4/i];
const nvmeGen3=[/970 evo plus/i,/980\b(?! pro)/i,/870 evo m\.2/i,/sn570/i,/sn580/i,/p3 plus/i,/p3\b/i,/nv2/i,/nv3/i,/sx8200 pro/i,/intel 670p/i,/netac nv2000/i,/a2000/i,/teamgroup mp34/i,/gen ?3/i];

function decide(item){
  const name=(item.name||'').toLowerCase();
  const iface=(item.interface||'').toLowerCase();
  const formRaw=item.form;
  const form= typeof formRaw==='string' ? formRaw.toLowerCase() : '';
  const needs= !iface || iface==='m.2' || iface==='m.2 nvme' || iface==='m2' || iface==='m.2 slot';
  if(!needs) return null; // don't override specific

  // SATA 2.5" or names
  if(/2\.5/.test(form) || /sata/.test(iface) || sataNamePatterns.some(r=>r.test(name))){
    return 'SATA III 6Gb/s';
  }
  // M.2 suggests NVMe, refine generation
  if(/m\.2/.test(form) || /nvme/.test(item.type||'')){
    if(nvmeGen5.some(r=>r.test(name))) return 'PCIe 5.0 x4';
    if(nvmeGen4.some(r=>r.test(name))) return 'PCIe 4.0 x4';
    if(nvmeGen3.some(r=>r.test(name))) return 'PCIe 3.0 x4';
    return 'PCIe 3.0 x4'; // conservative default when unsure
  }
  return null;
}

function processFile(file){
  if(!fs.existsSync(file)) return {file,updated:0};
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  let updated=0;
  for(const d of data){
    const inf=decide(d);
    if(inf){ d.interface=inf; if(d._confidence!=='factual') d._confidence = d._confidence||'heuristic'; d._specSource=(d._specSource||'')+(d._specSource?'+':'')+'iface-inferred'; updated++; }
  }
  if(updated) fs.writeFileSync(file, JSON.stringify(data));
  return {file,updated};
}

const results=FILES.map(processFile);
console.log('infer-storage-interface results:', results);
