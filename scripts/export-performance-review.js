#!/usr/bin/env node
/**
 * Export list of storage entries needing performance spec review after placeholder cleanup.
 * Criteria:
 *  - _needsSpecReview true OR
 *  - read/write null for SSD (missingPerf) OR
 *  - generic placeholder 3500/3000 remaining (likely Gen3 generic) OR
 *  - heuristic NVMe with read>6500 and write>6400 but not factual (to consider factual mapping)
 */
const fs=require('fs');
const path=require('path');
const targets=[
  path.join(__dirname,'..','pc-part-dataset','processed','storage.json'),
  path.join(__dirname,'..','docs','pc-part-dataset','processed','storage.json')
];
function cat(o){const iface=(o.interface||'').toLowerCase(); if(/pcie 5\.0/.test(iface)) return 'NVME5'; if(/pcie 4\.0/.test(iface)) return 'NVME4'; if(/pcie 3\.0|pcie 2\.0/.test(iface)) return 'NVME3'; if(/sata/.test(iface)) return 'SATA'; return 'OTHER';}
function isSSD(o){return /(ssd|nvme)/i.test(o.type||'');}
for(const file of targets){
  if(!fs.existsSync(file)) continue; const data=JSON.parse(fs.readFileSync(file,'utf8'));
  const review=[];
  for(const d of data){
    if(!isSSD(d)) continue;
    const placeholder = d.read===3500 && d.write===3000;
    const missing = d.read==null || d.write==null;
    const highHeuristic = (d._confidence!=='factual') && d.read>6500 && d.write>6400;
    if(d._needsSpecReview || missing || placeholder || highHeuristic){
      review.push({id:d.id,name:d.name,interface:d.interface,cat:cat(d),read:d.read,write:d.write,confidence:d._confidence,needsReview:!!d._needsSpecReview,placeholder});
    }
  }
  const outPath=path.join(__dirname,'..','temp',`perf-review-${path.basename(file)}`);
  fs.writeFileSync(outPath, JSON.stringify(review,null,2));
  console.log('Exported review list', path.basename(file), review.length, '->', outPath);
}
