#!/usr/bin/env node
/**
 * Deep health analysis for storage dataset focusing on factual risk zones.
 * Outputs JSON summary + detailed review arrays for manual/factual sourcing.
 *
 * Categories:
 *  - missingPerf: NVMe/SATA SSD entries missing read or write.
 *  - genericPlaceholder: Patterns of obsolete placeholder speeds (3500/3000 etc) still present.
 *  - lowSata: SATA SSD with read<480 or write<420 (allowing value if vendor officially lower -> flagged but kept).
 *  - suspiciousNVMe4: PCIe 4.0 with read<4500 or write<3500 or read>8000 or write>7500.
 *  - gen5Missing: PCIe 5.0 entries missing perf OR outside plausible band (8500-15000 read, 8000-13500 write).
 *  - cappedPrices: Entries where _pricingOutlierCapped true.
 *  - extremePriceResidual: Still above trimmed cap ( > trimmedMedian*3 (SATA*2.5) after capping ).
 *  - heuristicDominant: Entries with _confidence=heuristic (sample list) to prioritize factual sourcing.
 *  - duplicateNames (case-insensitive collisions).
 * Also computes trimmed medians (10% trim) per category for better pricing baselines.
 */
const fs=require('fs');
const path=require('path');
const targets=[
  path.join(__dirname,'..','pc-part-dataset','processed','storage.json'),
  path.join(__dirname,'..','docs','pc-part-dataset','processed','storage.json')
];
function cat(o){
  const iface=(o.interface||'').toLowerCase();
  const type=(o.type||'').toLowerCase();
  const name=(o.name||'').toLowerCase();
  if(/hdd/.test(type)) return 'HDD';
  if(/external/.test(type)){
    if(/aegis|fortress|padlock|ironkey/.test(name)) return 'SECURE_EXT';
    return 'EXT';
  }
  if(/sata/.test(iface))return 'SATA';
  if(/pci[e ]5\.0/.test(iface))return 'NVME5';
  if(/pci[e ]4\.0/.test(iface))return 'NVME4';
  if(/pci[e ]3\.0|pci[e ]2\.0/.test(iface))return 'NVME3';
  return 'OTHER';
}
function trimmedMedian(arr,trim=0.1){ if(!arr.length) return null; const a=[...arr].sort((x,y)=>x-y); const cut=Math.floor(a.length*trim); const sliced=a.slice(cut,a.length-cut||a.length); const n=sliced.length; if(!n) return null; return n%2? sliced[(n-1)/2] : (sliced[n/2-1]+sliced[n/2])/2; }
for(const file of targets){ if(!fs.existsSync(file)) continue; const data=JSON.parse(fs.readFileSync(file,'utf8'));
  const missingPerf=[], genericPlaceholder=[], lowSata=[], suspiciousNVMe4=[], gen5Missing=[], cappedPrices=[], extremePriceResidual=[], heuristicDominant=[], duplicateNames=[]; const nameMap={};
  const priceByCat={};
  for(const d of data){ if(d.pricePerGB!=null){ (priceByCat[cat(d)]=priceByCat[cat(d)]||[]).push(d.pricePerGB); }
    const c=cat(d);
    const isSSD=/ssd/i.test(d.type||'')||/nvme/i.test(d.type||'');
    if(isSSD && (d.read==null||d.write==null)) missingPerf.push(d.id);
  // Treat 3500/3000 as placeholder ONLY if not already validated factual.
  if(d.read===3500 && d.write===3000 && d._confidence!=='factual') genericPlaceholder.push(d.id);
    if(c==='SATA' && d.read!=null && d.write!=null && (d.read<480 || d.write<420)) lowSata.push({id:d.id,read:d.read,write:d.write});
    if(c==='NVME4' && d.read!=null && d.write!=null && (d.read<4500 || d.write<3500 || d.read>8000 || d.write>7500)) suspiciousNVMe4.push({id:d.id,read:d.read,write:d.write});
    if(c==='NVME5' && (d.read==null || d.write==null || d.read<8500 || d.read>15000 || d.write<8000 || d.write>13500)) gen5Missing.push({id:d.id,read:d.read,write:d.write});
    if(d._pricingOutlierCapped) cappedPrices.push(d.id);
    if(!d._pricingOutlierCapped && d.pricePerGB!=null) { /* later after medians */ }
    if(d._confidence==='heuristic' && heuristicDominant.length<200) heuristicDominant.push(d.id);
    const ln=(d.name||'').toLowerCase(); if(nameMap[ln]){ if(!duplicateNames.includes(ln)) duplicateNames.push(ln);} else nameMap[ln]=true;
  }
  const trimmedMedians={}; for(const k of Object.keys(priceByCat)){ trimmedMedians[k]=Math.round(trimmedMedian(priceByCat[k])); }
  for(const d of data){ const c=cat(d); const base=trimmedMedians[c]; if(base && !d._pricingOutlierCapped && d.pricePerGB!=null){ const limit=c==='SATA'? base*2.5: base*3; if(d.pricePerGB>limit) extremePriceResidual.push({id:d.id,ppg:d.pricePerGB,limit:Math.round(limit)}); }}
  const summary={ file:path.basename(file), counts:{ total:data.length, missingPerf:missingPerf.length, genericPlaceholder:genericPlaceholder.length, lowSata:lowSata.length, suspiciousNVMe4:suspiciousNVMe4.length, gen5Missing:gen5Missing.length, cappedPrices:cappedPrices.length, extremePriceResidual:extremePriceResidual.length, heuristicEntries:data.filter(d=>d._confidence==='heuristic').length }, trimmedMedians };
  const out={ summary, missingPerf, genericPlaceholder, lowSata:lowSata.slice(0,50), suspiciousNVMe4, gen5Missing, cappedPrices:cappedPrices.slice(0,100), extremePriceResidual:extremePriceResidual.slice(0,50), heuristicSample:heuristicDominant, duplicateNames };
  const outPath=path.join(__dirname,'..','temp',`storage-health-${path.basename(file)}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out,null,2));
  console.log('HEALTH', path.basename(file), JSON.stringify(summary,null,2));
}
