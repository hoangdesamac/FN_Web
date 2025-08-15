#!/usr/bin/env node
const fs=require('fs');
const path=require('path');

const PROC_DIR = path.join(__dirname,'..','pc-part-dataset','processed');
const files = ['cpu','mainboard','ram','gpu','storage','psu','monitor','case','cooler','keyboard','mouse','headphones','speakers','os','soundcard','network'];

function load(name){
  const p=path.join(PROC_DIR, name + '.json');
  if(!fs.existsSync(p)) return [];
  try{ const raw=fs.readFileSync(p,'utf8'); if(!raw.trim()) return []; return JSON.parse(raw); }catch(e){ return { __error:e.message }; }
}

const report = { timestamp:new Date().toISOString(), categories:{}, errors:[] };

// Required / key fields per category for deeper validation
const REQUIRED = {
  cpu: ['name','socket','cores'],
  mainboard: ['name','socket','form'],
  ram: ['name','type','size','speed'],
  gpu: ['name','vram'],
  storage: ['name','type','size'],
  psu: ['name','watt'],
  monitor: ['name','res','hz'],
  case: ['name','type'],
  cooler: ['name','type'],
  keyboard: ['name'],
  mouse: ['name'],
  headphones: ['name'],
  speakers: ['name'],
  os: ['name'],
  soundcard: ['name'],
  network: ['name']
};

function pct(n,d){ return d? +( (n*100/d).toFixed(2) ) : 0; }

files.forEach(cat=>{
  const data = load(cat);
  if(Array.isArray(data)){
    const total=data.length;
    const catRep={ total };
    function countPred(msg, pred){ const c=data.filter(pred).length; catRep[msg]=c; return c; }
    // Generic validations
    catRep.missingPrice = countPred('missingPrice', it=> !(it.price>0));
    catRep.missingName = countPred('missingName', it=> !it.name);
    // Required field presence counts
    const req = REQUIRED[cat]||[];
    if(req.length){
      catRep.requiredMissing = {};
      req.forEach(f=>{ const miss = data.filter(it=> it[f]===undefined || it[f]===null || it[f]==='' ).length; if(miss) catRep.requiredMissing[f]=miss; });
    }
    // Category-specific
    if(cat==='storage'){
      catRep.typeBreakdown = data.reduce((acc,it)=>{ acc[it.type]= (acc[it.type]||0)+1; return acc; },{});
      catRep.misclassified = data.filter(it=> /nvme/i.test(it.name||'') && !/nvme/i.test(it.type||'')).length;
      catRep.zeroSize = data.filter(it=> !it.size || it.size<=0).length;
      catRep.missingInterface = data.filter(it=> !it.interface).length;
    }
    if(cat==='cpu'){
      catRep.noSocket = data.filter(it=> !it.socket).length;
      catRep.noCores = data.filter(it=> !(it.cores>0)).length;
    }
    if(cat==='gpu'){
      catRep.noVram = data.filter(it=> !(it.vram>0)).length;
      catRep.badVramType = data.filter(it=> it.memoryType && !/gddr|hbm/i.test(it.memoryType)).length;
    }
    if(cat==='ram'){
      catRep.noSize = data.filter(it=> !(it.size>0)).length;
      catRep.noSpeed = data.filter(it=> !(it.speed>0)).length;
    }
    if(cat==='monitor'){
      catRep.noRes = data.filter(it=> !it.res).length;
      catRep.noHz = data.filter(it=> !(it.hz>0)).length;
      catRep.aspectMissing = data.filter(it=> !it.aspect).length;
    }
    report.categories[cat]=catRep;
  } else {
    report.categories[cat]={ error:data.__error || 'Parse failure' };
    report.errors.push(cat+': '+(data.__error||'parse failure'));
  }
});

// Output concise summary to console
console.log('=== DATASET VALIDATION SUMMARY ===');
Object.entries(report.categories).forEach(([cat,r])=>{
  if(r.error){ console.log(cat.toUpperCase()+': ERROR '+r.error); return; }
  const parts=[`${cat} total=${r.total}`];
  if(r.missingPrice) parts.push('missingPrice='+r.missingPrice);
  if(r.missingName) parts.push('missingName='+r.missingName);
  if(r.typeBreakdown){ parts.push('types='+Object.entries(r.typeBreakdown).map(([k,v])=>k+':'+v).join(',')); if(r.misclassified) parts.push('misclassified='+r.misclassified); if(r.zeroSize) parts.push('zeroSize='+r.zeroSize); }
  if(r.requiredMissing && Object.keys(r.requiredMissing).length){ parts.push('requiredMissing='+Object.entries(r.requiredMissing).map(([k,v])=>k+':'+v).join(',')); }
  if(r.noSocket) parts.push('noSocket='+r.noSocket);
  if(r.noCores) parts.push('noCores='+r.noCores);
  if(r.noVram) parts.push('noVram='+r.noVram);
  if(r.badVramType) parts.push('badMemType='+r.badVramType);
  if(r.noSize) parts.push('noSize='+r.noSize);
  if(r.noSpeed) parts.push('noSpeed='+r.noSpeed);
  if(r.missingInterface) parts.push('noInterface='+r.missingInterface);
  if(r.noRes) parts.push('noRes='+r.noRes);
  if(r.noHz) parts.push('noHz='+r.noHz);
  if(r.aspectMissing) parts.push('noAspect='+r.aspectMissing);
  console.log(parts.join(' | '));
});

// Write JSON report
fs.writeFileSync(path.join(PROC_DIR,'validation-report.json'), JSON.stringify(report,null,2));
console.log('\nFull report written to processed/validation-report.json');
