// Dataset build script: reads raw csv/jsonl -> outputs processed per-category JSON + manifest
const fs = require('fs');
const path = require('path');

// Allow overriding the raw dataset directory (so we can point to an external clone like docyx/pc-part-dataset)
// Usage (PowerShell): $env:PART_DATASET_DIR="external/pc-part-dataset"; node scripts/build-dataset.js
// Expected structure under PART_DATASET_DIR: ./data/{csv,jsonl,json}
let RAW_BASE = process.env.PART_DATASET_DIR ? path.resolve(process.env.PART_DATASET_DIR,'data') : path.resolve('pc-part-dataset','data');
// Fallback: if RAW_BASE doesn't exist (likely because submodule/vendor folder missing) try to auto-detect a snapshot under docs/pc-part-dataset/*/data
if(!fs.existsSync(RAW_BASE)){
  try{
    const snapshotRoot = path.resolve('docs','pc-part-dataset');
    if(fs.existsSync(snapshotRoot)){
      const cand = fs.readdirSync(snapshotRoot).find(d=> fs.existsSync(path.join(snapshotRoot,d,'data','jsonl')));
      if(cand){
        RAW_BASE = path.join(snapshotRoot,cand,'data');
        console.log('[build-dataset] Using snapshot raw base:', RAW_BASE);
      }
    }
  }catch(e){ console.warn('[build-dataset] snapshot detection failed', e.message); }
}
const CSV_DIR = path.join(RAW_BASE,'csv');
let JSONL_DIR = path.join(RAW_BASE,'jsonl');
const OUT_DIR = path.resolve('pc-part-dataset','processed');
const USD_TO_VND = 25000;

fs.mkdirSync(OUT_DIR,{recursive:true});

function readFileSafe(p){ try { return fs.readFileSync(p,'utf8'); } catch { return ''; } }
function slug(s){ return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').slice(0,60); }
function normPrice(v){ if(v===null||v===undefined||v==='') return 0; if(typeof v==='number') return Math.round(v*USD_TO_VND); const n=parseFloat(String(v).replace(/[^0-9.]/g,'')); return isNaN(n)?0:Math.round(n*USD_TO_VND); }
// Robust CSV parser handling multiline rows (unbalanced quotes) & stray newline splits
function parseCSV(text){
  if(!text.trim()) return [];
  const rawLines = text.replace(/\r/g,'').split('\n');
  const headerLine = rawLines.shift();
  if(!headerLine) return [];
  const headers = headerLine.split(',');

  function splitCSVLine(line){
    const fields=[]; let cur="", q=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch==='"'){
        if(q && line[i+1]==='"'){ cur+='"'; i++; }
        else q=!q;
      } else if(ch===',' && !q){ fields.push(cur); cur=''; }
      else cur+=ch;
    }
    fields.push(cur);
    return {fields, open:q};
  }

  const merged=[]; let buffer="";
  for(const line of rawLines){
    if(!buffer) buffer=line; else buffer += "\n" + line; // preserve embedded newline inside a quoted field
    const {fields, open} = splitCSVLine(buffer);
    // If quotes still open or we have fewer columns than headers, continue accumulating
    if(open || fields.length < headers.length){
      continue;
    }
    merged.push(fields);
    buffer="";
  }
  // If leftover buffer forms valid line
  if(buffer){
    const {fields, open} = splitCSVLine(buffer);
    if(!open && fields.length === headers.length) merged.push(fields);
  }

  const rows=[];
  for(const fields of merged){
    const obj={};
    headers.forEach((h,idx)=> obj[h.trim()]=(fields[idx]||'').trim());
    rows.push(obj);
  }
  return rows;
}
function parseJsonl(text){ return text.split(/\r?\n/).filter(l=>l.trim()).map(l=>{ try {return JSON.parse(l);} catch { return null; } }).filter(Boolean); }

// Track categories loaded from JSONL so we can skip CSV fallbacks (avoid duplicate & malformed names)
const jsonlLoaded = new Set();

function cleanName(name){
  if(!name) return name;
  let n = name.replace(/\b(\d{3,4}x\d{3,4})\b(\s+\1)+/gi,'$1'); // collapse repeated resolutions
  n = n.replace(/\s+/g,' ').trim();
  return n;
}

const categories = {};
function add(cat, item){ if(!categories[cat]) categories[cat]=[]; categories[cat].push(item); }

// CSV Loaders
function loadCsvFile(file, handler){ const p=path.join(CSV_DIR,file); const data=parseCSV(readFileSafe(p)); data.forEach(r=> handler(r)); }

// --- Helpers to prefer JSONL (richer, avoids CSV name line breaks) when available ---
function addFromJsonl(srcName, targetCat, mapFn, idPrefix){
  const p = path.join(JSONL_DIR, srcName + '.jsonl');
  if(!fs.existsSync(p)) return;
  jsonlLoaded.add(targetCat);
  parseJsonl(readFileSafe(p)).forEach(r=>{
    if(!r || !r.name) return;
    const rawName = cleanName(r.name);
    const id = (idPrefix||targetCat)+'_'+slug(rawName);
    if(categories[targetCat] && categories[targetCat].some(x=>x.id===id)) return; // avoid duplicates if CSV later
    const mapped = mapFn(r);
    if(!mapped) return;
    mapped.id = id;
    mapped.name = rawName;
    if(mapped.price===undefined) mapped.price = normPrice(r.price||r.cost);
    add(targetCat, mapped);
  });
}

// JSONL category ingest (only if files exist)
addFromJsonl('cpu', 'cpu', r=>({ price:normPrice(r.price||r.cost), socket:r.socket_type||r.socket, cores:r.core_count, baseClock:r.core_clock, boostClock:r.boost_clock, tdp:r.tdp, graphics:r.graphics, perfScore: (r.core_count||0) * (r.boost_clock||r.core_clock||0) }), 'cpu');
addFromJsonl('motherboard','mainboard', r=>({ price:normPrice(r.price), socket:r.socket, chipset:r.chipset, form:(r.form_factor||'').toLowerCase(), maxMemory: r.max_memory, color:r.color }), 'mb');
addFromJsonl('memory','ram', r=>({ price:normPrice(r.price), type:r.type||r.memory_type, size:r.capacity_gb, speed:r.speed||r.frequency, sticks:r.modules }), 'ram');
addFromJsonl('video-card','gpu', r=>({ price:normPrice(r.price), chipset:r.chipset, vram:r.memory, core:r.core_clock, boost:r.boost_clock, length:r.length, estPower: r.memory? 50 + r.memory*10: undefined }), 'gpu');
addFromJsonl('power-supply','psu', r=>({ price:normPrice(r.price), type:r.type, efficiency:r.efficiency, watt:r.wattage, modular:r.modular }), 'psu');
addFromJsonl('monitor','monitor', r=>({ price:normPrice(r.price), size:r.screen_size, res:String(r.resolution||'').replace(/"|,/g,'x'), hz:r.refresh_rate, panel:r.panel_type, aspect:r.aspect_ratio }), 'mon');
addFromJsonl('case','case', r=>({ price:normPrice(r.price), type:r.type||r.form_factor }), 'case');
addFromJsonl('cpu-cooler','cooler', r=>({ price:normPrice(r.price), type:r.type, tdp:r.tdp }), 'cool');
addFromJsonl('internal-hard-drive','storage', r=>({ price:normPrice(r.price), type:'HDD', size:r.capacity_gb }), 'stor_i');
addFromJsonl('external-hard-drive','storage', r=>({ price:normPrice(r.price), type:'External', size:r.capacity_gb }), 'stor_e');
addFromJsonl('operating-system','os', r=>({ price:normPrice(r.price) }), 'os');
addFromJsonl('sound-card','soundcard', r=>({ price:normPrice(r.price) }), 'sc');
addFromJsonl('wired-network-card','network', r=>({ price:normPrice(r.price) }), 'net');
addFromJsonl('wireless-network-card','network', r=>({ price:normPrice(r.price) }), 'net');
addFromJsonl('keyboard','keyboard', r=>({ price:normPrice(r.price) }), 'kb');
addFromJsonl('mouse','mouse', r=>({ price:normPrice(r.price) }), 'mouse');
addFromJsonl('headphones','headphones', r=>({ price:normPrice(r.price) }), 'hp');
addFromJsonl('speakers','speakers', r=>({ price:normPrice(r.price) }), 'spk');

// --- CPU from JSONL (legacy specific path) then CSV fallback (kept for backward compatibility if JSONL missing) ---
const cpuJsonlPath = path.join(JSONL_DIR,'cpu.jsonl');
if(!jsonlLoaded.has('cpu') && fs.existsSync(cpuJsonlPath)){
  jsonlLoaded.add('cpu');
  parseJsonl(readFileSafe(cpuJsonlPath)).forEach(r=>{
    if(!r.name) return; const nm=cleanName(r.name); add('cpu', {
      id:'cpu_'+slug(nm), name:nm, price:normPrice(r.price||r.cost),
      socket:r.socket_type||r.socket, cores:r.core_count, baseClock:r.core_clock, boostClock:r.boost_clock,
      tdp:r.tdp, graphics:r.graphics, perfScore: (r.core_count||0) * (r.boost_clock||r.core_clock||0)
    });
  });
}
if(!jsonlLoaded.has('cpu')) loadCsvFile('cpu.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='cpu_'+slug(nm); if(categories.cpu && categories.cpu.some(x=>x.id===id)) return; add('cpu', { id, name:nm, price:normPrice(r.price), socket:r.socket_type||r.socket, cores: +r.core_count||undefined, baseClock: +r.core_clock||undefined, boostClock: +r.boost_clock||undefined, tdp:+r.tdp||undefined }); });

// Motherboard
if(!jsonlLoaded.has('mainboard')) loadCsvFile('motherboard.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='mb_'+slug(nm); if(categories.mainboard && categories.mainboard.some(x=>x.id===id)) return; add('mainboard',{ id, name:nm, price:normPrice(r.price), socket:r.socket, chipset: r.chipset, form: (r.form_factor||'').toLowerCase(), maxMemory: +r.max_memory||undefined, color:r.color }); });
// Memory
if(!jsonlLoaded.has('ram')) loadCsvFile('memory.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='ram_'+slug(nm); if(categories.ram && categories.ram.some(x=>x.id===id)) return; add('ram',{ id, name:nm, price:normPrice(r.price), type:r.type||r.memory_type, size:+r.capacity_gb||undefined, speed:r.speed||r.frequency, sticks: +r.modules||undefined }); });
// GPU
if(!jsonlLoaded.has('gpu')) loadCsvFile('video-card.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='gpu_'+slug(nm); if(categories.gpu && categories.gpu.some(x=>x.id===id)) return; const vram=+r.memory||undefined; const power = vram? 50 + vram*10 : undefined; add('gpu',{ id, name:nm, price:normPrice(r.price), chipset:r.chipset, vram, core:+r.core_clock||undefined, boost:+r.boost_clock||undefined, length:+r.length||undefined, estPower: power }); });
// PSU
if(!jsonlLoaded.has('psu')) loadCsvFile('power-supply.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='psu_'+slug(nm); if(categories.psu && categories.psu.some(x=>x.id===id)) return; add('psu',{ id, name:nm, price:normPrice(r.price), type:r.type, efficiency:r.efficiency, watt:+r.wattage||undefined, modular:r.modular }); });
// Monitor
if(!jsonlLoaded.has('monitor')) loadCsvFile('monitor.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='mon_'+slug(nm); if(categories.monitor && categories.monitor.some(x=>x.id===id)) return; add('monitor',{ id, name:nm, price:normPrice(r.price), size:+r.screen_size||undefined, res:(r.resolution||'').replace(/"|,/g,'x'), hz:+r.refresh_rate||undefined, panel:r.panel_type, aspect:r.aspect_ratio }); });
// Storage
if(!jsonlLoaded.has('storage')){
  loadCsvFile('internal-hard-drive.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='stor_i_'+slug(nm); if(categories.storage && categories.storage.some(x=>x.id===id)) return; add('storage',{ id, name:nm, price:normPrice(r.price), type:'HDD', size:+r.capacity_gb||undefined }); });
  loadCsvFile('external-hard-drive.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='stor_e_'+slug(nm); if(categories.storage && categories.storage.some(x=>x.id===id)) return; add('storage',{ id, name:nm, price:normPrice(r.price), type:'External', size:+r.capacity_gb||undefined }); });
}
// Case & Cooler
if(!jsonlLoaded.has('case')) loadCsvFile('case.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='case_'+slug(nm); if(categories.case && categories.case.some(x=>x.id===id)) return; add('case',{ id, name:nm, price:normPrice(r.price), type:r.type||r.form_factor }); });
if(!jsonlLoaded.has('cooler')) loadCsvFile('cpu-cooler.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='cool_'+slug(nm); if(categories.cooler && categories.cooler.some(x=>x.id===id)) return; add('cooler',{ id, name:nm, price:normPrice(r.price), type:r.type, tdp:+r.tdp||undefined }); });
// Peripherals
if(!jsonlLoaded.has('keyboard')) loadCsvFile('keyboard.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='kb_'+slug(nm); if(categories.keyboard && categories.keyboard.some(x=>x.id===id)) return; add('keyboard',{ id, name:nm, price:normPrice(r.price) }); });
if(!jsonlLoaded.has('mouse')) loadCsvFile('mouse.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='mouse_'+slug(nm); if(categories.mouse && categories.mouse.some(x=>x.id===id)) return; add('mouse',{ id, name:nm, price:normPrice(r.price) }); });
if(!jsonlLoaded.has('headphones')) loadCsvFile('headphones.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='hp_'+slug(nm); if(categories.headphones && categories.headphones.some(x=>x.id===id)) return; add('headphones',{ id, name:nm, price:normPrice(r.price) }); });
if(!jsonlLoaded.has('speakers')) loadCsvFile('speakers.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='spk_'+slug(nm); if(categories.speakers && categories.speakers.some(x=>x.id===id)) return; add('speakers',{ id, name:nm, price:normPrice(r.price) }); });
if(!jsonlLoaded.has('os')) loadCsvFile('os.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='os_'+slug(nm); if(categories.os && categories.os.some(x=>x.id===id)) return; add('os',{ id, name:nm, price:normPrice(r.price) }); });
if(!jsonlLoaded.has('soundcard')) loadCsvFile('sound-card.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='sc_'+slug(nm); if(categories.soundcard && categories.soundcard.some(x=>x.id===id)) return; add('soundcard',{ id, name:nm, price:normPrice(r.price) }); });
if(!jsonlLoaded.has('network')){
  loadCsvFile('wired-network-card.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='net_'+slug(nm); if(categories.network && categories.network.some(x=>x.id===id)) return; add('network',{ id, name:nm, price:normPrice(r.price) }); });
  loadCsvFile('wireless-network-card.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='net_'+slug(nm)+'_w'; if(categories.network && categories.network.some(x=>x.id===id)) return; add('network',{ id, name:nm, price:normPrice(r.price) }); });
}

// Derive additional metrics
if(categories.gpu){ categories.gpu.forEach(g=>{ if(!g.tier){ const name=(g.chipset||'').toLowerCase(); if(/5090|4090|7900/.test(name)) g.tier='enthusiast'; else if(/5070|4070|7800|7900/.test(name)) g.tier='high'; else if(/3060|4060|6600|7600/.test(name)) g.tier='mid'; else g.tier='entry'; }}); }
if(categories.cpu){ categories.cpu.forEach(c=>{ if(!c.perfScore) c.perfScore=(c.cores||0)*(c.boostClock||c.baseClock||0); }); }

// ---- Price estimation for missing prices (value 0) ----
function median(nums){ if(!nums.length) return 0; nums=[...nums].sort((a,b)=>a-b); const m=Math.floor(nums.length/2); return nums.length%2? nums[m] : Math.round((nums[m-1]+nums[m])/2); }
function groupBy(arr, keyFn){ const m=new Map(); arr.forEach(it=>{ const k=keyFn(it); if(!m.has(k)) m.set(k,[]); m.get(k).push(it); }); return m; }
function estimateForCategory(list, groupKeyFns){
  const priceList=list.filter(i=> (i.price||0)>0).map(i=>i.price);
  const globalMedian=median(priceList);
  let estimatedCount=0;
  list.forEach(it=>{
    if((it.price||0)>0) return; // already has price
    let candidatePrices=[];
    for(const fn of groupKeyFns){
      const key=fn(it);
      if(!key) continue;
      const group=list.filter(x=> (x.price||0)>0 && fn(x)===key);
      if(group.length>=2){ candidatePrices=group.map(g=>g.price); break; }
    }
    if(!candidatePrices.length) candidatePrices=priceList; // fallback
    const est=median(candidatePrices)||globalMedian||0;
    if(est>0){ it.price=est; it._estimated=true; estimatedCount++; }
  });
  return estimatedCount;
}
function estimateMissingPrices(){
  const summary={};
  if(categories.cpu) summary.cpu=estimateForCategory(categories.cpu,[it=>it.socket, it=> (it.cores? 'c'+it.cores: '')]);
  if(categories.gpu) summary.gpu=estimateForCategory(categories.gpu,[it=> (it.vram? it.vram+'GB': ''), it=> (it.tier||'')]);
  if(categories.ram) summary.ram=estimateForCategory(categories.ram,[it=> (it.type||'')+'_'+(it.size||'')+'_'+(it.speed? Math.round(it.speed/400)*400: '')]);
  if(categories.mainboard) summary.mainboard=estimateForCategory(categories.mainboard,[it=> (it.socket||'')+'_'+(it.chipset||''), it=> (it.socket||'')+'_'+(it.form||''), it=> it.socket]);
  if(categories.storage) summary.storage=estimateForCategory(categories.storage,[it=> (it.size? (it.size>=1000? Math.round(it.size/500)*500: it.size): '' )]);
  if(categories.psu) summary.psu=estimateForCategory(categories.psu,[it=> (it.watt? Math.round(it.watt/100)*100: '')]);
  if(categories.monitor) summary.monitor=estimateForCategory(categories.monitor,[it=> (it.res||'')+'_'+(it.hz||'')]);
  // simple categories fallback
  ['case','cooler','keyboard','mouse','headphones','speakers','os','soundcard','network'].forEach(cat=>{ if(categories[cat]) summary[cat]=estimateForCategory(categories[cat],[()=>null]); });
  return summary;
}
const estimationSummary = estimateMissingPrices();

// Write out
const manifest = { generated: new Date().toISOString(), counts: {}, estimated: estimationSummary };
Object.keys(categories).forEach(cat=>{
  const arr = categories[cat];
  manifest.counts[cat]=arr.length;
  fs.writeFileSync(path.join(OUT_DIR, cat + '.json'), JSON.stringify(arr, null, 0));
});
fs.writeFileSync(path.join(OUT_DIR,'manifest.json'), JSON.stringify(manifest,null,2));

// Mirror processed output into docs/ for static hosting (GitHub Pages) so frontend fetch('pc-part-dataset/processed/*.json') works.
try {
  const DOCS_PROCESSED = path.resolve('docs','pc-part-dataset','processed');
  fs.mkdirSync(DOCS_PROCESSED,{recursive:true});
  for(const f of fs.readdirSync(OUT_DIR)){
    const src = path.join(OUT_DIR,f);
    const dest = path.join(DOCS_PROCESSED,f);
    fs.copyFileSync(src,dest);
  }
  console.log('[build-dataset] Mirrored processed dataset to', DOCS_PROCESSED);
} catch(e){ console.warn('[build-dataset] Mirror to docs failed:', e.message); }

console.log('Dataset built:', manifest);
