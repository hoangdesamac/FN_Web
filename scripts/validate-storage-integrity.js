#!/usr/bin/env node
// Comprehensive integrity & accuracy checks for storage dataset.
// Produces a report with: invalidSpeedRanges, missingCriticalFields, inconsistentConfidence, suspiciousPriceAlignment, categorySummaries.

const fs=require('fs');
const path=require('path');
const FILES=[
  path.join(__dirname,'..','pc-part-dataset','processed','storage.json'),
  path.join(__dirname,'..','docs','pc-part-dataset','processed','storage.json')
];

function classify(o){
  const iface=(o.interface||'').toLowerCase();
  const type=(o.type||'').toLowerCase();
  if(/external/.test(type)) return 'EXT';
  if(/hdd/.test(type)) return 'HDD';
  if(/sata/.test(iface)) return 'SATA';
  if(/pci[e ]5/.test(iface)) return 'NVME5';
  if(/pci[e ]4/.test(iface)) return 'NVME4';
  if(/pci[e ]3|pci[e ]2/.test(iface)) return 'NVME3';
  return 'OTHER';
}

function run(file){
  if(!fs.existsSync(file)) return {file,error:'missing'};
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  const invalidSpeedRanges=[]; const missingCritical=[]; const inconsistentConfidence=[]; const suspiciousPrice=[];
  const catStats={};
  function pushCat(c, obj){ (catStats[c]=catStats[c]||{count:0,missingPerf:0,factual:0,heuristic:0,default:0}); catStats[c].count++; if(obj.read==null||obj.write==null) catStats[c].missingPerf++; if(obj._confidence==='factual') catStats[c].factual++; if(obj._confidence==='heuristic') catStats[c].heuristic++; if(obj._confidence==='default') catStats[c].default++; }

  for(const d of data){
    const c=classify(d); pushCat(c,d);
    const both=d.read!=null && d.write!=null;
    if(both){
      if(d.read<d.write && d._confidence==='factual') invalidSpeedRanges.push({id:d.id,read:d.read,write:d.write});
      if(d.read>15000||d.write>14000) invalidSpeedRanges.push({id:d.id,read:d.read,write:d.write,reason:'exceedsHardCap'});
      if(/sata/i.test(d.interface||'') && (d.read>600||d.write>600)) invalidSpeedRanges.push({id:d.id,read:d.read,write:d.write,reason:'sataOver600'});
    }
    if(d.type==null || d.size==null || d.pricePerGB==null) missingCritical.push(d.id);
    if(d._confidence==='factual' && (d.read==null||d.write==null)) inconsistentConfidence.push(d.id);
    if(d.pricePerGB!=null){
      // rough heuristic: > 12x median SATA speed per GB for SATA (should not happen) -> price anomaly simplistic check
      if(/sata/i.test(d.interface||'') && d.pricePerGB>12000) suspiciousPrice.push({id:d.id,ppg:d.pricePerGB});
    }
  }
  return {file, counts:{total:data.length, invalidSpeedRanges:invalidSpeedRanges.length, missingCritical:missingCritical.length, inconsistentConfidence:inconsistentConfidence.length, suspiciousPrice:suspiciousPrice.length}, invalidSpeedRanges, missingCritical, inconsistentConfidence, suspiciousPrice, catStats};
}

const report={timestamp:new Date().toISOString(), files:FILES.map(run)};
const out=path.join(__dirname,'..','temp','storage-integrity-report.json');
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out, JSON.stringify(report,null,2));
console.log('validate-storage-integrity ->', out);
