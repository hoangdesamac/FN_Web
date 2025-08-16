#!/usr/bin/env node
// Annotate historical/legacy SATA SSDs with high pricePerGB so UI can explain anomaly instead of raw flag.
// Adds _pricingNote and optionally reclassifies _pricingOutlier if already capped.

const fs=require('fs');
const path=require('path');
const FILES=[
  path.join(__dirname,'..','pc-part-dataset','processed','storage.json'),
  path.join(__dirname,'..','docs','pc-part-dataset','processed','storage.json')
];

const LEGACY_PATTERNS=[/x25\-/i,/vertex/i,/agility/i,/hyperx/i,/readycache/i,/e50/i,/intel 3\d\d\b/i,/intel 5\d\d\b/i,/ocz/i,/x25_m/i,/x25_v/i];

function legacy(name){return LEGACY_PATTERNS.some(r=>r.test(name));}

function process(file){
  if(!fs.existsSync(file)) return {file,annotated:0};
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  let annotated=0;
  for(const d of data){
    if(d.pricePerGB!=null && d.pricePerGB>12000 && /sata/i.test(d.interface||'') ){
      if(legacy(d.name||'')){
        d._pricingNote='legacy_sata_high_cost';
        annotated++;
      } else {
        d._pricingNote='sata_price_review';
        annotated++;
      }
    }
  }
  if(annotated) fs.writeFileSync(file, JSON.stringify(data));
  return {file,annotated};
}

console.log('annotate-pricing-anomalies', FILES.map(process));
