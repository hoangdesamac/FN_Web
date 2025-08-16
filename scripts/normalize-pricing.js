#!/usr/bin/env node
/**
 * Normalize pricing for extreme pricePerGB outliers while preserving original values in _pricing.originalPricePerGB if needed.
 * Strategy:
 *  - Compute median pricePerGB per category (HDD, SATA, NVME3, NVME4, NVME5, OTHER)
 *  - For any item flagged _pricingOutlier or exceeding median*3 (SATA*2.5), reduce pricePerGB to cap = median* (3 or 2.5)
 *  - Adjust price proportionally (price = pricePerGB * size) and update _pricing.finalVnd/baseVnd if structure exists.
 *  - Record original values in _pricingOriginal object at top-level for traceability.
 */
const fs=require('fs');
const path=require('path');
const targets=[
  path.join(__dirname,'..','pc-part-dataset','processed','storage.json'),
  path.join(__dirname,'..','docs','pc-part-dataset','processed','storage.json')
];
function median(a){a=[...a].sort((x,y)=>x-y);const n=a.length;return n? (n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2):null;}
function cat(o){ const iface=o.interface||''; if(/HDD/i.test(o.type)) return 'HDD'; if(/SATA/i.test(iface)) return 'SATA'; if(/PCIe 5\.0/i.test(iface)) return 'NVME5'; if(/PCIe 4\.0/i.test(iface)) return 'NVME4'; if(/PCIe 3\.0|PCIe 2\.0/i.test(iface)) return 'NVME3'; return 'OTHER'; }
for(const file of targets){
  if(!fs.existsSync(file)) continue; const data=JSON.parse(fs.readFileSync(file,'utf8'));
  const byCat={};
  for(const d of data){ if(d.pricePerGB!=null){ (byCat[cat(d)] = byCat[cat(d)]||[]).push(d.pricePerGB);} }
  const medians={}; for(const k of Object.keys(byCat)){ medians[k]=median(byCat[k]); }
  let adjusted=0;
  for(const d of data){
    if(d.size>0 && d.pricePerGB!=null){
      const c=cat(d); const m=medians[c]; if(!m) continue; const limit = c==='SATA'? m*2.5 : m*3;
      if(d._pricingOutlier || d.pricePerGB>limit){
        const original={price:d.price, pricePerGB:d.pricePerGB};
        const newPricePerGB=Math.round(limit);
        const newPrice=newPricePerGB*d.size;
        d._pricingOriginal=original;
        d.pricePerGB=newPricePerGB;
        d.price=newPrice;
        if(d._pricing && d._pricing.finalVnd){
          d._pricing.baseVnd=newPrice; // assume baseVnd=price
          d._pricing.finalVnd=newPrice; // no discount recalculation
        }
        adjusted++; d._pricingOutlierCapped=true;
      }
    }
  }
  fs.writeFileSync(file, JSON.stringify(data));
  console.log(path.basename(file), {adjusted, medians});
}
