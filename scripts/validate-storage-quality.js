// Comprehensive quality validation for storage dataset.
// Produces a JSON summary of schema completeness, value consistency, and anomalies.
const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'..','pc-part-dataset','processed','storage.json');
const data=JSON.parse(fs.readFileSync(file,'utf8'));

const summary={ total:data.length };

// Expected fields (current reduced schema after removals)
const expected=['id','name','type','interface','form','size','read','write','rpm','cache','iopsRead','iopsWrite','warranty','dimensions','weight','price','pricePerGB','originalPriceUSD','rawPricePerGB','_pricing','_specSource','_estimated'];

// Presence stats
summary.fieldPresence={};
for(const f of expected){ let filled=0; for(const o of data){ if(o[f]!==undefined && o[f]!==null && o[f]!=='' ) filled++; } summary.fieldPresence[f]={filled,percent:+(filled*100/data.length).toFixed(2)}; }

// Uniqueness of id
const ids=new Set(); const dup=[]; for(const o of data){ if(ids.has(o.id)) dup.push(o.id); else ids.add(o.id);} summary.duplicateIds=dup;

// Helper classification
function cls(o){ const iface=(o.interface||'').toLowerCase(); return {
  isNVMe:/pci|nvme|m\.2 pci/.test(iface) || /nvme/i.test(o.type||''),
  isSATA:/sata/.test(iface) && !/pci/.test(iface),
  isExternal:/external/.test((o.type||'').toLowerCase()),
  isHDD:/hdd/.test((o.type||'').toLowerCase()),
  isSSD:/ssd/.test((o.type||'').toLowerCase()) || /nvme/.test((o.type||''))
}; }

// Anomaly collectors
const anomalies={ pricePerGBMismatch:[], rawPricePerGBMismatch:[], sizeInvalid:[], readWriteSuspicious:[], iopsSuspicious:[], warrantyOutOfRange:[], negativeValues:[], missingCritical:[] };

function pushLimited(arr,obj,max=50){ if(arr.length<max) arr.push(obj); }

for(const o of data){
  // size
  if(!(o.size>0)) pushLimited(anomalies.sizeInvalid,{id:o.id,size:o.size});
  // pricePerGB consistency
  if(o.price!=null && o.size>0 && o.pricePerGB!=null){
    const calc=Math.round(o.price/o.size);
    if(Math.abs(calc-o.pricePerGB)/ (calc||1) >0.02){ pushLimited(anomalies.pricePerGBMismatch,{id:o.id,stored:o.pricePerGB,calc}); }
  }
  if(o.originalPriceUSD!=null && o.size>0 && o.rawPricePerGB!=null){
    const calcRaw=+(o.originalPriceUSD/o.size).toFixed(3);
    if(Math.abs(calcRaw-o.rawPricePerGB)/ (calcRaw||1) >0.05){ pushLimited(anomalies.rawPricePerGBMismatch,{id:o.id,stored:o.rawPricePerGB,calc:calcRaw}); }
  }
  // read/write sanity
  const c=cls(o);
  if(o.read!=null && o.write!=null){
    const r=o.read,w=o.write;
    if(r<0||w<0) pushLimited(anomalies.negativeValues,{id:o.id,read:r,write:w});
    if(c.isSATA && (r>620||w>620||r<50||w<50)) pushLimited(anomalies.readWriteSuspicious,{id:o.id,type:o.type,iface:o.interface,read:r,write:w});
    if(c.isNVMe && (r>15000||w>15000||r<200||w<100)) pushLimited(anomalies.readWriteSuspicious,{id:o.id,type:o.type,iface:o.interface,read:r,write:w});
    if(c.isHDD && (r>350||w>350||r<50||w<50)) pushLimited(anomalies.readWriteSuspicious,{id:o.id,type:o.type,iface:o.interface,read:r,write:w});
  }
  // iops sanity (heuristic bands)
  if(o.iopsRead!=null){ if(o.iopsRead<0 || o.iopsRead>2000000) pushLimited(anomalies.iopsSuspicious,{id:o.id,iopsRead:o.iopsRead}); }
  if(o.iopsWrite!=null){ if(o.iopsWrite<0 || o.iopsWrite>2000000) pushLimited(anomalies.iopsSuspicious,{id:o.id,iopsWrite:o.iopsWrite}); }
  // warranty
  if(o.warranty!=null && (o.warranty<0 || o.warranty>10)) pushLimited(anomalies.warrantyOutOfRange,{id:o.id,warranty:o.warranty});
  // Missing critical (core display fields)
  const critical=['id','name','type','interface','form','size','read','write','price'];
  for(const f of critical){ if(o[f]==null) { pushLimited(anomalies.missingCritical,{id:o.id,field:f}); break; } }
}

summary.anomaliesCount={}; for(const k of Object.keys(anomalies)){ summary.anomaliesCount[k]=anomalies[k].length; }
summary.sampleAnomalies=anomalies;

// Output summary JSON to stdout (truncated anomalies retained up to limits)
fs.writeFileSync(path.join(__dirname,'..','temp','storage-quality-report.json'), JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary.anomaliesCount,null,2));
