#!/usr/bin/env node
/**
 * Storage realism updater.
 * Safe adjustments only: no reintroduction of removed endurance fields.
 * Steps per dataset file:
 *  1. Load optional factual map (scripts/known-storage-factual.json)
 *  2. Remove known placeholder / suspect pairs (3500/3000, 7000/6000, 3000/3000, 5000/4000, 12400/12400)
 *  3. Null out obviously unrealistic values (SATA > 600MB/s, HDD > 350MB/s, absurd > 15000MB/s)
 *  4. Apply factual overrides (read/write/iops/interface) when present & current values missing or placeholder
 *  5. Optionally (FILL_DEFAULTS=1) fill conservative defaults for still-null pairs (category + gen heuristic)
 *  6. Recompute pricePerGB & rawPricePerGB if missing
 *  7. Emit per-file stats + master report in temp/storage-realism-report.json
 *
 * Env flags:
 *  FILL_DEFAULTS=0  -> skip default speed fills (leave null for manual entry)
 *  DRY_RUN=1        -> do not persist modifications, only report proposed changes
 */
const fs = require('fs');
const path = require('path');

const DATA_FILES = [
  path.join(__dirname,'..','pc-part-dataset','processed','storage.json'),
  path.join(__dirname,'..','docs','pc-part-dataset','processed','storage.json')
];
const FACTUAL_FILE = path.join(__dirname,'known-storage-factual.json');
const REPORT_FILE = path.join(__dirname,'..','temp','storage-realism-report.json');

// Some constrained sandboxes may present process.env as undefined; guard accordingly.
const envSafe = (typeof process!=='undefined' && process.env) ? process.env : {};
// Support file-based flag to disable defaults: scripts/disable-defaults.flag
let FILL_DEFAULTS = envSafe.FILL_DEFAULTS !== '0';
try {
  const flagPath = path.join(__dirname,'disable-defaults.flag');
  if(fs.existsSync(flagPath)) FILL_DEFAULTS = false;
} catch {}
const DRY_RUN = envSafe.DRY_RUN === '1';

function readJSON(f){ if(!fs.existsSync(f)) return null; return JSON.parse(fs.readFileSync(f,'utf8')); }
function writeJSON(f,obj){ fs.mkdirSync(path.dirname(f),{recursive:true}); fs.writeFileSync(f, JSON.stringify(obj,null,2)); }

function classify(item){
  const t=String(item.type||'').toLowerCase();
  const iface=String(item.interface||'').toLowerCase();
  const form=String(item.form||'').toLowerCase();
  if(/hdd/.test(t)) return 'HDD';
  if(/sata/.test(iface)) return 'SATA_SSD';
  if(/nvme/.test(t) || /m\.2/.test(form) || /pci/.test(iface)) return 'NVME';
  if(/external/.test(t) && /ssd/.test(t)) return 'EXT_SSD';
  return 'OTHER';
}
function detectGen(item){
  const iface=(item.interface||'').toLowerCase(); const name=(item.name||'').toLowerCase(); const r=item.read||0;
  if(/5\.0/.test(iface)||/gen5/.test(name)||r>=11000) return 5;
  if(/4\.0/.test(iface)||/gen4/.test(name)||r>=6500) return 4;
  if(/3\.0/.test(iface)||/gen3/.test(name)||r>=2500) return 3;
  return null;
}
const PLACEHOLDER_PAIRS = new Set(['3500/3000','3000/3000','7000/6000','5000/4000','12400/12400']);
function isPlaceholder(r,w){ if(r==null||w==null) return false; return PLACEHOLDER_PAIRS.has(r+'/'+w); }
function realisticDefault(cat,gen){
  switch(cat){
    case 'HDD': return {r:210,w:200};
    case 'SATA_SSD': return {r:560,w:520};
    case 'EXT_SSD': return {r:1050,w:1000};
    case 'NVME':
      if(gen===5) return {r:10000,w:9500};
      if(gen===4) return {r:7000,w:6500};
      if(gen===3) return {r:3500,w:3000};
      return {r:3200,w:2800};
    default: return null;
  }
}
function capUnrealistic(item, notes){
  const iface=(item.interface||'').toLowerCase();
  const t=(item.type||'').toLowerCase();
  if(item.read!=null && item.read>15000){ item.read=null; notes.push('read>15000->null'); }
  if(item.write!=null && item.write>14000){ item.write=null; notes.push('write>14000->null'); }
  if(/sata/.test(iface) && (item.read>600 || item.write>600)){
    item.read=null; item.write=null; notes.push('sata>600->null');
  }
  if(/hdd/.test(t) && (item.read>350 || item.write>350)){
    item.read=null; item.write=null; notes.push('hdd>350->null');
  }
}
function loadFactualMap(){
  const map={}; const data=readJSON(FACTUAL_FILE); if(Array.isArray(data)) data.forEach(e=>{ if(e&&e.id) map[e.id]=e; }); return map; }
function applyFactual(item,f){
  let applied=false;
  if(f.read && (item.read==null || isPlaceholder(item.read,item.write))){ item.read=f.read; applied=true; }
  if(f.write && (item.write==null || isPlaceholder(item.read,item.write))){ item.write=f.write; applied=true; }
  if(f.iopsRead && (item.iopsRead==null)) { item.iopsRead=f.iopsRead; applied=true; }
  if(f.iopsWrite && (item.iopsWrite==null)) { item.iopsWrite=f.iopsWrite; applied=true; }
  if(f.interface && !item.interface) { item.interface=f.interface; applied=true; }
  if(applied){ item._confidence='factual'; item._specSource=(item._specSource||'')+ (item._specSource?'+':'')+'factual-map'; }
  return applied;
}
function process(data,factual){
  const stats={total:data.length, placeholdersRemoved:0,factualApplied:0,defaultsFilled:0,unrealisticCleared:0,stillMissing:0};
  data.forEach(item=>{
    const notes=[];
    if(isPlaceholder(item.read,item.write)){ item.read=null; item.write=null; stats.placeholdersRemoved++; notes.push('placeholder-null'); }
    const before={r:item.read,w:item.write};
    capUnrealistic(item,notes);
    if(before.r!==item.read||before.w!==item.write) stats.unrealisticCleared++;
    if(factual[item.id]){ if(applyFactual(item,factual[item.id])) stats.factualApplied++; }
    if(FILL_DEFAULTS && (item.read==null || item.write==null)){
      const cat=classify(item); const gen=detectGen(item); const def=realisticDefault(cat,gen);
      if(def && item.read==null && item.write==null){ item.read=def.r; item.write=def.w; if(item._confidence!=='factual') item._confidence='default'; stats.defaultsFilled++; }
    }
    if(item.price!=null && item.size && !item.pricePerGB){ item.pricePerGB=Math.round(item.price/item.size); }
    if(item.originalPriceUSD!=null && item.size && !item.rawPricePerGB){ item.rawPricePerGB=+(item.originalPriceUSD/item.size).toFixed(3); }
    if(item.read==null || item.write==null) stats.stillMissing++;
    if(notes.length) item._perfNotes = notes.join(';');
  });
  return stats;
}
function main(){
  const factual = loadFactualMap();
  const report={timestamp:new Date().toISOString(), fillDefaults:FILL_DEFAULTS, dryRun:DRY_RUN, files:[]};
  DATA_FILES.forEach(f=>{
    if(!fs.existsSync(f)) return;
    const arr=readJSON(f); if(!Array.isArray(arr)){ report.files.push({file:f,error:'not-array'}); return; }
    const stats=process(arr,factual);
    report.files.push({file:f,stats});
    if(!DRY_RUN) writeJSON(f,arr); // persist changes unless dry run
  });
  writeJSON(REPORT_FILE, report);
  console.log('[update-storage-realism] Done ->', REPORT_FILE);
  console.log(JSON.stringify(report,null,2));
}
main();
