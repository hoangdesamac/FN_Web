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
function trySnapshotFallback(reason){
  try{
    const snapshotRoot = path.resolve('docs','pc-part-dataset');
    if(fs.existsSync(snapshotRoot)){
      const cand = fs.readdirSync(snapshotRoot).find(d=> fs.existsSync(path.join(snapshotRoot,d,'data','jsonl')));
      if(cand){
        const newBase = path.join(snapshotRoot,cand,'data');
        console.log('[build-dataset] Fallback to snapshot due to', reason, '->', newBase);
        return newBase;
      }
    }
  }catch(e){ console.warn('[build-dataset] snapshot fallback failed', e.message); }
  return null;
}
// If base exists but cpu.csv is empty, attempt fallback
try {
  const cpuCsv = path.join(RAW_BASE,'csv','cpu.csv');
  if(fs.existsSync(cpuCsv) && fs.statSync(cpuCsv).size===0){
    const fb = trySnapshotFallback('empty cpu.csv');
    if(fb) RAW_BASE = fb;
  }
}catch{}
console.log('[build-dataset] RAW_BASE =', RAW_BASE);
const CSV_DIR = path.join(RAW_BASE,'csv');
const JSONL_EXISTS = fs.existsSync(path.join(RAW_BASE,'jsonl'));
console.log('[build-dataset] jsonl dir exists?', JSONL_EXISTS);
let JSONL_DIR = path.join(RAW_BASE,'jsonl');
const OUT_DIR = path.resolve('pc-part-dataset','processed');
const USD_TO_VND = parseFloat(process.env.USD_TO_VND)||25000;
const STRICT_MODE = process.env.STRICT_MODE === '1'; // Khi bật: không suy luận microarch, không ước tính giá, chỉ dùng dữ liệu gốc

fs.mkdirSync(OUT_DIR,{recursive:true});

function readFileSafe(p){ try { return fs.readFileSync(p,'utf8'); } catch { return ''; } }
function slug(s){ return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').slice(0,60); }
function extractUSD(v){ if(v===null||v===undefined||v==='') return undefined; if(typeof v==='number') return v; const n=parseFloat(String(v).replace(/[^0-9.]/g,'')); return isNaN(n)?undefined:n; }
function normPrice(v){ const usd = extractUSD(v); return usd===undefined? 0 : Math.round(usd*USD_TO_VND); }
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
// --- CPU ingest + attempt to keep accurate fields ---
addFromJsonl('cpu', 'cpu', r=>{
  const rawArch = r.microarchitecture || r.microarch;
  const inferred = !rawArch && !STRICT_MODE ? inferMicroArch(r.name) : undefined;
  const baseClock = r.core_clock;
  const boostClock = r.boost_clock;
  const cores = r.core_count;
  return {
    originalPriceUSD: extractUSD(r.price||r.cost),
    price:normPrice(r.price||r.cost),
    socket:r.socket_type||r.socket,
    cores,
    baseClock,
    boostClock,
    tdp:r.tdp,
    graphics:r.graphics,
    microarch: rawArch || inferred,
    microarchSource: rawArch? 'source': (inferred?'inferred': undefined),
    rating: r.rating || r.stars || undefined, // only if present in source
    perfScore: (cores && (boostClock||baseClock))? (cores * (boostClock||baseClock)) : undefined
  };
}, 'cpu');
addFromJsonl('motherboard','mainboard', r=>({ originalPriceUSD: extractUSD(r.price), price:normPrice(r.price), socket:r.socket, chipset:r.chipset, form:(r.form_factor||'').toLowerCase(), maxMemory: r.max_memory, color:r.color }), 'mb');
addFromJsonl('memory','ram', r=>{
  // Raw memory jsonl: speed:[gen,mhz], modules:[count, sizePerModule]
  let ddrType; let mhz; let size; let sticks; let latency;
  if(Array.isArray(r.speed)){ ddrType = r.speed[0]; mhz = r.speed[1]; }
  if(Array.isArray(r.modules)){ sticks = r.modules[0]; const per = r.modules[1]; if(sticks && per) size = sticks * per; }
  latency = r.cas_latency;
  const type = r.type || r.memory_type || (ddrType? ('DDR'+ddrType): undefined);
  return { originalPriceUSD: extractUSD(r.price), price:normPrice(r.price), type, size, speed:mhz, sticks, latency };
}, 'ram');
addFromJsonl('video-card','gpu', r=>({ originalPriceUSD: extractUSD(r.price), price:normPrice(r.price), chipset:r.chipset, vram:r.memory, core:r.core_clock, boost:r.boost_clock, length:r.length, estPower: r.memory? 50 + r.memory*10: undefined }), 'gpu');
addFromJsonl('power-supply','psu', r=>({ originalPriceUSD: extractUSD(r.price), price:normPrice(r.price), type:r.type, efficiency:r.efficiency, watt:r.wattage, modular:r.modular }), 'psu');
addFromJsonl('monitor','monitor', r=>({ originalPriceUSD: extractUSD(r.price), price:normPrice(r.price), size:r.screen_size, res:String(r.resolution||'').replace(/"|,/g,'x'), hz:r.refresh_rate, panel:r.panel_type, aspect:r.aspect_ratio }), 'mon');
addFromJsonl('case','case', r=>({ originalPriceUSD: extractUSD(r.price), price:normPrice(r.price), type:r.type||r.form_factor }), 'case');
addFromJsonl('cpu-cooler','cooler', r=>({ originalPriceUSD: extractUSD(r.price), price:normPrice(r.price), type:r.type, tdp:r.tdp }), 'cool');
// Internal storage classification (was incorrectly forcing all to HDD)
addFromJsonl('internal-hard-drive','storage', r=>{
  const cap = r.capacity_gb || r.capacity; // raw jsonl uses capacity
  const rawType = r.type;
  const iface = r.interface || '';
  const form = r.form_factor || '';
  const cache = r.cache;
  let typeNorm;
  // Determine spindle speed numeric (e.g. 5400 / 7200) -> HDD
  if(typeof rawType === 'number'){ typeNorm = 'HDD'; }
  else if(typeof rawType === 'string'){
    if(/ssd/i.test(rawType)) {
      if(/pci|nvme|m\.2|gen[2-5]|express/i.test(iface) || /m\.2/i.test(form)) typeNorm='NVMe SSD';
      else if(/sata/i.test(iface)) typeNorm='SATA SSD';
      else typeNorm='SSD';
    } else if(/hdd|hard/i.test(rawType) || /(5400|7200|rpm)/i.test(rawType)) {
      typeNorm='HDD';
    }
  }
  // If still unknown, infer from interface
  if(!typeNorm){
    if(/pci|nvme|m\.2/i.test(iface)) typeNorm='NVMe SSD';
    else if(/sata/i.test(iface)) typeNorm='SATA SSD';
  }
  if(!typeNorm) typeNorm='HDD'; // fallback
  let rpm;
  if(typeof rawType === 'number') rpm = rawType; else {
    const m = String(rawType).match(/(5400|7200|10000)/); if(m) rpm=+m[1];
  }
  return { originalPriceUSD: extractUSD(r.price), price:normPrice(r.price), type:typeNorm, size:cap, rpm, interface: iface||undefined, form: form||undefined, cache: cache||undefined };
}, 'stor_i');
addFromJsonl('external-hard-drive','storage', r=>({ originalPriceUSD: extractUSD(r.price), price:normPrice(r.price), type:'External', size:r.capacity_gb }), 'stor_e');
addFromJsonl('operating-system','os', r=>({ originalPriceUSD: extractUSD(r.price), price:normPrice(r.price) }), 'os');
addFromJsonl('sound-card','soundcard', r=>({ originalPriceUSD: extractUSD(r.price), price:normPrice(r.price) }), 'sc');
addFromJsonl('wired-network-card','network', r=>({ originalPriceUSD: extractUSD(r.price), price:normPrice(r.price) }), 'net');
addFromJsonl('wireless-network-card','network', r=>({ originalPriceUSD: extractUSD(r.price), price:normPrice(r.price) }), 'net');
addFromJsonl('keyboard','keyboard', r=>({ originalPriceUSD: extractUSD(r.price), price:normPrice(r.price) }), 'kb');
addFromJsonl('mouse','mouse', r=>({ originalPriceUSD: extractUSD(r.price), price:normPrice(r.price) }), 'mouse');
addFromJsonl('headphones','headphones', r=>({ originalPriceUSD: extractUSD(r.price), price:normPrice(r.price) }), 'hp');
addFromJsonl('speakers','speakers', r=>({ originalPriceUSD: extractUSD(r.price), price:normPrice(r.price) }), 'spk');

// --- CPU from JSONL (legacy specific path) then CSV fallback (kept for backward compatibility if JSONL missing) ---
const cpuJsonlPath = path.join(JSONL_DIR,'cpu.jsonl');
if(!jsonlLoaded.has('cpu') && fs.existsSync(cpuJsonlPath)){
  jsonlLoaded.add('cpu');
  parseJsonl(readFileSafe(cpuJsonlPath)).forEach(r=>{
    if(!r.name) return; const nm=cleanName(r.name); const rawArch=r.microarchitecture||r.microarch; const inferred= !rawArch && !STRICT_MODE ? inferMicroArch(r.name): undefined; const baseClock=r.core_clock; const boostClock=r.boost_clock; const cores=r.core_count;
    add('cpu', { id:'cpu_'+slug(nm), name:nm, originalPriceUSD: extractUSD(r.price||r.cost), price:normPrice(r.price||r.cost),
      socket:r.socket_type||r.socket, cores, baseClock, boostClock,
      tdp:r.tdp, graphics:r.graphics, microarch: rawArch||inferred, microarchSource: rawArch? 'source': (inferred?'inferred':undefined), rating: r.rating || r.stars,
      perfScore: (cores && (boostClock||baseClock))? cores*(boostClock||baseClock): undefined
    });
  });
}
if(!jsonlLoaded.has('cpu')) loadCsvFile('cpu.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='cpu_'+slug(nm); if(categories.cpu && categories.cpu.some(x=>x.id===id)) return; const inferred = STRICT_MODE? undefined : inferMicroArch(nm); add('cpu', { id, name:nm, originalPriceUSD: extractUSD(r.price), price:normPrice(r.price), socket:r.socket_type||r.socket, cores: +r.core_count||undefined, baseClock: +r.core_clock||undefined, boostClock: +r.boost_clock||undefined, tdp:+r.tdp||undefined, microarch: inferred, microarchSource: inferred? 'inferred': undefined }); });

// Motherboard
if(!jsonlLoaded.has('mainboard')) loadCsvFile('motherboard.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='mb_'+slug(nm); if(categories.mainboard && categories.mainboard.some(x=>x.id===id)) return; add('mainboard',{ id, name:nm, originalPriceUSD: extractUSD(r.price), price:normPrice(r.price), socket:r.socket, chipset: r.chipset, form: (r.form_factor||'').toLowerCase(), maxMemory: +r.max_memory||undefined, color:r.color }); });
// Memory
if(!jsonlLoaded.has('ram')) loadCsvFile('memory.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='ram_'+slug(nm); if(categories.ram && categories.ram.some(x=>x.id===id)) return; add('ram',{ id, name:nm, originalPriceUSD: extractUSD(r.price), price:normPrice(r.price), type:r.type||r.memory_type, size:+r.capacity_gb||undefined, speed:r.speed||r.frequency, sticks: +r.modules||undefined }); });
// GPU
if(!jsonlLoaded.has('gpu')) loadCsvFile('video-card.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='gpu_'+slug(nm); if(categories.gpu && categories.gpu.some(x=>x.id===id)) return; const vram=+r.memory||undefined; const power = vram? 50 + vram*10 : undefined; add('gpu',{ id, name:nm, originalPriceUSD: extractUSD(r.price), price:normPrice(r.price), chipset:r.chipset, vram, core:+r.core_clock||undefined, boost:+r.boost_clock||undefined, length:+r.length||undefined, estPower: power }); });
// PSU
if(!jsonlLoaded.has('psu')) loadCsvFile('power-supply.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='psu_'+slug(nm); if(categories.psu && categories.psu.some(x=>x.id===id)) return; add('psu',{ id, name:nm, originalPriceUSD: extractUSD(r.price), price:normPrice(r.price), type:r.type, efficiency:r.efficiency, watt:+r.wattage||undefined, modular:r.modular }); });
// Monitor
if(!jsonlLoaded.has('monitor')) loadCsvFile('monitor.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='mon_'+slug(nm); if(categories.monitor && categories.monitor.some(x=>x.id===id)) return; add('monitor',{ id, name:nm, originalPriceUSD: extractUSD(r.price), price:normPrice(r.price), size:+r.screen_size||undefined, res:(r.resolution||'').replace(/"|,/g,'x'), hz:+r.refresh_rate||undefined, panel:r.panel_type, aspect:r.aspect_ratio }); });
// Storage
if(!jsonlLoaded.has('storage')){
  // CSV fallback with classification similar to JSONL
  loadCsvFile('internal-hard-drive.csv', r=>{ 
    if(!r.name) return; const nm=cleanName(r.name); const id='stor_i_'+slug(nm); if(categories.storage && categories.storage.some(x=>x.id===id)) return; 
    const cap= +r.capacity_gb || undefined; const rawType=r.type; const iface=r.interface||''; const form=r.form_factor||''; const cache=r.cache; let typeNorm;
    if(typeof rawType === 'number'){ typeNorm='HDD'; }
    else if(typeof rawType === 'string'){
      if(/ssd/i.test(rawType)) { if(/pci|nvme|m\.2|gen[2-5]|express/i.test(iface) || /m\.2/i.test(form)) typeNorm='NVMe SSD'; else if(/sata/i.test(iface)) typeNorm='SATA SSD'; else typeNorm='SSD'; }
      else if(/hdd|hard/i.test(rawType) || /(5400|7200|rpm)/i.test(rawType)) typeNorm='HDD'; }
    if(!typeNorm){ if(/pci|nvme|m\.2/i.test(iface)) typeNorm='NVMe SSD'; else if(/sata/i.test(iface)) typeNorm='SATA SSD'; }
    if(!typeNorm) typeNorm='HDD';
    let rpm; if(typeof rawType === 'number') rpm=rawType; else { const m=String(rawType).match(/(5400|7200|10000)/); if(m) rpm=+m[1]; }
    add('storage',{ id, name:nm, originalPriceUSD: extractUSD(r.price), price:normPrice(r.price), type:typeNorm, size:cap, rpm, interface: iface||undefined, form: form||undefined, cache: cache||undefined });
  });
  loadCsvFile('external-hard-drive.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='stor_e_'+slug(nm); if(categories.storage && categories.storage.some(x=>x.id===id)) return; add('storage',{ id, name:nm, originalPriceUSD: extractUSD(r.price), price:normPrice(r.price), type:'External', size:+r.capacity_gb||undefined }); });
}
// Case & Cooler
if(!jsonlLoaded.has('case')) loadCsvFile('case.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='case_'+slug(nm); if(categories.case && categories.case.some(x=>x.id===id)) return; add('case',{ id, name:nm, originalPriceUSD: extractUSD(r.price), price:normPrice(r.price), type:r.type||r.form_factor }); });
if(!jsonlLoaded.has('cooler')) loadCsvFile('cpu-cooler.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='cool_'+slug(nm); if(categories.cooler && categories.cooler.some(x=>x.id===id)) return; add('cooler',{ id, name:nm, originalPriceUSD: extractUSD(r.price), price:normPrice(r.price), type:r.type, tdp:+r.tdp||undefined }); });
// Peripherals
if(!jsonlLoaded.has('keyboard')) loadCsvFile('keyboard.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='kb_'+slug(nm); if(categories.keyboard && categories.keyboard.some(x=>x.id===id)) return; add('keyboard',{ id, name:nm, originalPriceUSD: extractUSD(r.price), price:normPrice(r.price) }); });
if(!jsonlLoaded.has('mouse')) loadCsvFile('mouse.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='mouse_'+slug(nm); if(categories.mouse && categories.mouse.some(x=>x.id===id)) return; add('mouse',{ id, name:nm, originalPriceUSD: extractUSD(r.price), price:normPrice(r.price) }); });
if(!jsonlLoaded.has('headphones')) loadCsvFile('headphones.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='hp_'+slug(nm); if(categories.headphones && categories.headphones.some(x=>x.id===id)) return; add('headphones',{ id, name:nm, originalPriceUSD: extractUSD(r.price), price:normPrice(r.price) }); });
if(!jsonlLoaded.has('speakers')) loadCsvFile('speakers.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='spk_'+slug(nm); if(categories.speakers && categories.speakers.some(x=>x.id===id)) return; add('speakers',{ id, name:nm, originalPriceUSD: extractUSD(r.price), price:normPrice(r.price) }); });
if(!jsonlLoaded.has('os')) loadCsvFile('os.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='os_'+slug(nm); if(categories.os && categories.os.some(x=>x.id===id)) return; add('os',{ id, name:nm, originalPriceUSD: extractUSD(r.price), price:normPrice(r.price) }); });
if(!jsonlLoaded.has('soundcard')) loadCsvFile('sound-card.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='sc_'+slug(nm); if(categories.soundcard && categories.soundcard.some(x=>x.id===id)) return; add('soundcard',{ id, name:nm, originalPriceUSD: extractUSD(r.price), price:normPrice(r.price) }); });
if(!jsonlLoaded.has('network')){
  loadCsvFile('wired-network-card.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='net_'+slug(nm); if(categories.network && categories.network.some(x=>x.id===id)) return; add('network',{ id, name:nm, originalPriceUSD: extractUSD(r.price), price:normPrice(r.price) }); });
  loadCsvFile('wireless-network-card.csv', r=>{ if(!r.name) return; const nm=cleanName(r.name); const id='net_'+slug(nm)+'_w'; if(categories.network && categories.network.some(x=>x.id===id)) return; add('network',{ id, name:nm, originalPriceUSD: extractUSD(r.price), price:normPrice(r.price) }); });
}

// Derive additional metrics
console.log('[build-dataset] Categories after ingest keys =', Object.keys(categories));
if(categories.gpu){ categories.gpu.forEach(g=>{ if(!g.tier){ const name=(g.chipset||'').toLowerCase(); if(/5090|4090|7900/.test(name)) g.tier='enthusiast'; else if(/5070|4070|7800|7900/.test(name)) g.tier='high'; else if(/3060|4060|6600|7600/.test(name)) g.tier='mid'; else g.tier='entry'; }}); }
if(categories.cpu){ categories.cpu.forEach(c=>{ if(!c.perfScore){ if(c.cores && (c.boostClock||c.baseClock)) c.perfScore=c.cores*(c.boostClock||c.baseClock); } }); }

// ---- Deterministic enrichment (no external guesses) ----
function gcd(a,b){ while(b){ const t=b; b=a%b; a=t; } return a; }
function computeAspect(res){ if(!res) return undefined; const m=res.match(/(\d{3,5})x(\d{3,5})/i); if(!m) return undefined; let w=+m[1], h=+m[2]; if(!w||!h) return undefined; const g=gcd(w,h); w=Math.round(w/g); h=Math.round(h/g); const ratio = w+':'+h; return ratio; }
// Monitor aspect fallback
if(categories.monitor){ categories.monitor.forEach(m=>{ if(!m.aspect){ const a=computeAspect(m.res); if(a) m.aspect=a; } }); }
// Price per unit metrics
if(categories.ram){ categories.ram.forEach(r=>{ if(r.price && r.size) r.pricePerGB = Math.round(r.price/ r.size); }); }
if(categories.storage){ categories.storage.forEach(s=>{ if(s.price && s.size) s.pricePerGB = Math.round(s.price / s.size); }); }
if(categories.cpu){ categories.cpu.forEach(c=>{ if(c.price && c.cores) c.pricePerCore = Math.round(c.price / c.cores); }); }
if(categories.psu){ categories.psu.forEach(p=>{ if(p.price && p.watt) p.pricePerWatt = Math.round(p.price / p.watt); }); }
// PSU efficiency rank for sorting
const effOrder={ 'white':0,'standard':0,'bronze':1,'silver':2,'gold':3,'platinum':4,'titanium':5 };
if(categories.psu){ categories.psu.forEach(p=>{ if(p.efficiency){ const key=p.efficiency.toLowerCase(); const m=key.match(/(bronze|silver|gold|platinum|titanium)/); if(m) p.effRank = effOrder[m[1]]; } }); }

// Infer microarchitecture (deterministic mapping) only when field missing
function inferMicroArch(name){
  if(!name) return undefined;
  const n = name.toLowerCase();
  // AMD Ryzen pattern with 4/5-digit model number
  if(n.includes('ryzen')){
    const codeMatch = n.match(/\b(\d{4,5})x?3?d?\b/);
    if(codeMatch){
      const code = parseInt(codeMatch[1],10);
      if(code>=9000) return 'Zen 5';
      if(code>=7000) return 'Zen 4';
      if(code>=5000) return 'Zen 3';
      if(code>=3000) return 'Zen 2';
      if(code>=2000) return 'Zen+';
      if(code>=1000) return 'Zen 1';
    }
    return 'Zen';
  }
  if(n.includes('threadripper')) return 'Zen HEDT';
  // Intel Core generations
  if(/core\s+i[3579]/.test(n)){
    const genMatch = n.match(/\b(\d{4,5})[a-z]{0,2}\b/);
    if(genMatch){
      const num = parseInt(genMatch[1],10); const gen=Math.floor(num/1000);
      const intelMap={14:'Raptor Lake R',13:'Raptor Lake',12:'Alder Lake',11:'Rocket Lake',10:'Comet Lake',9:'Coffee Lake R',8:'Coffee Lake',7:'Kaby Lake',6:'Skylake'};
      if(intelMap[gen]) return intelMap[gen];
      return gen+ 'th Gen';
    }
    return 'Intel Core';
  }
  return undefined;
}

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
let estimationSummary = {};
if(!STRICT_MODE){
  estimationSummary = estimateMissingPrices();
} else {
  // Đánh dấu bao nhiêu mục bị bỏ qua do thiếu giá (không ước tính)
  Object.keys(categories).forEach(cat=>{
    const arr=categories[cat]; if(!arr) return;
    const missing=arr.filter(it=> !it.price).length;
    estimationSummary[cat] = { skippedForMissingPrice: missing };
    // Trong STRICT_MODE giữ nguyên price = 0 hoặc undefined để frontend hiển thị 'Liên hệ'
  });
}

// ---- Optional integration of scraped CPU data (from puppeteer script) ----
integrateScrapedCpu();

// ---- Fallback parsing & field recovery for required fields ----
function parseSizeFromName(name){
  if(!name) return undefined;
  const m = name.toLowerCase().match(/\b(\d+(?:\.\d+)?)\s*(tb|gb)\b/);
  if(!m) return undefined;
  const num = parseFloat(m[1]);
  if(isNaN(num)) return undefined;
  return m[2]==='tb'? Math.round(num*1024) : Math.round(num);
}
function parseRamSpeed(name){ if(!name) return undefined; const m=name.toUpperCase().match(/(?:DDR\d|PC)\w*[^0-9](\d{3,5})\s*MHZ/); if(m) return +m[1]; const m2=name.toUpperCase().match(/@(\d{3,5})\s*MHZ/); return m2? +m2[1]: undefined; }
function parseMonitorHz(name){ if(!name) return undefined; const m=name.toLowerCase().match(/(\d{2,3})\s*hz/); return m? +m[1]: undefined; }
function parseMonitorSize(name){ if(!name) return undefined; const m=name.match(/\b(\d{2}(?:\.\d)?)\s*(?:"|inch)\b/i); return m? parseFloat(m[1]): undefined; }
function parseCpuSocketName(name){ if(!name) return undefined; const n=name.toLowerCase(); const m=n.match(/(am5|am4|am3\+?|lga\d{3,5}|1151|1200|1700|2011-3|2011)/); return m? m[1].toUpperCase(): undefined; }
function classifyCaseType(name){ if(!name) return undefined; const n=name.toLowerCase(); if(/mini\s*itx/.test(n)) return 'Mini-ITX'; if(/micro\s*atx|m-atx/.test(n)) return 'Micro-ATX'; if(/mid\s*tower/.test(n)) return 'Mid Tower'; if(/full\s*tower/.test(n)) return 'Full Tower'; return undefined; }
function classifyCoolerType(name){
  if(!name) return undefined; const n=name.toLowerCase();
  // AIO indicators
  if(/aio|liquid|kraken|freezer iii|galahad|loop|elite 360|water/.test(n)){ const r=n.match(/(120|240|280|360|420)\b/); return 'AIO'+(r? ' '+r[1]:''); }
  // Radiator size pattern (240/360 etc) indicates AIO if not obviously air cooler keywords
  if(/\b(120|240|280|360|420)\b/.test(n) && /rgb|argb|corsair|nzxt|arctic|liquid/.test(n)) return 'AIO';
  // Air cooler brand / model cues
  if(/noctua|assassin|peerless|phantom spirit|hyper 212|dark rock|nh-d15|nh-l9|be quiet|freezer 36|assassin x|thermalright/.test(n)) return 'Air';
  if(/tower/.test(n)) return 'Air';
  return undefined;
}

// CPU socket fallback if missing (avoid overriding existing)
if(categories.cpu){ categories.cpu.forEach(c=>{ if(!c.socket){ const s=parseCpuSocketName(c.name); if(s) c.socket=s; } }); }
// RAM recover size/type/speed
if(categories.ram){ categories.ram.forEach(r=>{ if(!r.size){ const s=parseSizeFromName(r.name); if(s) r.size=s; } if(!r.type){ const t=(r.name||'').toUpperCase().match(/DDR[2345]/); if(t) r.type=t[0]; } if(!r.speed){ const sp=parseRamSpeed(r.name); if(sp) r.speed=sp; } }); }
// Storage size fallback
if(categories.storage){ categories.storage.forEach(s=>{ if(!s.size){ const sz=parseSizeFromName(s.name); if(sz) s.size=sz; } }); }
// Monitor size/Hz/aspect fallback
if(categories.monitor){ categories.monitor.forEach(m=>{ if(!m.hz){ const hz=parseMonitorHz(m.name); if(hz) m.hz=hz; } if(!m.size){ const sz=parseMonitorSize(m.name); if(sz) m.size=sz; } if(!m.aspect){ const a=computeAspect(m.res); if(a) m.aspect=a; } }); }
// Case type fallback
if(categories.case){ categories.case.forEach(c=>{ if(!c.type){ const t=classifyCaseType(c.name); if(t) c.type=t; } }); }
// Cooler type fallback
if(categories.cooler){ categories.cooler.forEach(c=>{ if(!c.type){ const t=classifyCoolerType(c.name); if(t) c.type=t; } }); }
// --- Second pass heuristic enrichments ---
// Monitor: capture patterns like "27@165" or "27"@165Hz" where '@' precedes refresh rate
if(categories.monitor){
  categories.monitor.forEach(m=>{
    if(!m.hz){
      const atMatch = m.name && m.name.match(/@(\d{2,3})\b/);
      if(atMatch){ const v=+atMatch[1]; if(v>=30 && v<=600) m.hz=v; }
    }
  });
}
// External storage: ensure interface / size fallback (capacity field) & classify into SSD vs HDD when possible
if(categories.storage){
  categories.storage.forEach(s=>{
    if(s.type==='External'){
      // If size missing but capacity present in original (stored as size? already handled) attempt parse
      if(!s.size){ const sz=parseSizeFromName(s.name); if(sz) s.size=sz; }
      // Interface cleanup / default
      if(!s.interface){
        if(/usb\s*c|type-c|usb\s*4|thunderbolt/i.test(s.name)) s.interface='USB Type-C';
        else if(/usb/i.test(s.name)) s.interface='USB';
      }
      // Try to refine type: portable SSD vs external HDD
      if(s.type==='External'){
        if(/\bssd\b|t5|t7|t9|extreme portable|x10|x10 pro|shield/i.test(s.name)) s.type='External SSD';
        else if(/elements|expansion|backup|my passport|my book|easystore|desktop|p10|d10/i.test(s.name)) s.type='External HDD';
      }
    }
  });
}
// Cooler second-pass: if still missing type, infer from fan size (120/140mm) -> Air; if 'rgb' and radiator size -> AIO.
if(categories.cooler){
  categories.cooler.forEach(c=>{
    if(!c.type){
      const n=(c.name||'').toLowerCase();
      if(/(120|140|150|92)mm/.test(n) && /(fan|cooler)/.test(n)) c.type='Air';
      if(!c.type && /@(120|240|280|360|420)\b/.test(n)) c.type='AIO';
      if(!c.type && /(240|280|360|420)\b.*rgb/.test(n)) c.type='AIO';
    }
  });
}
// Recompute pricePerGB for storage after new size fills
if(categories.storage){ categories.storage.forEach(s=>{ if(s.price && s.size) s.pricePerGB=Math.round(s.price/s.size); }); }
// Recompute price per metrics after filling size
if(categories.ram){ categories.ram.forEach(r=>{ if(r.price && r.size && !r.pricePerGB) r.pricePerGB=Math.round(r.price/r.size); }); }
if(categories.storage){ categories.storage.forEach(s=>{ if(s.price && s.size && !s.pricePerGB) s.pricePerGB=Math.round(s.price/s.size); }); }

// ---- Category-specific pruning ----
// OS: keep only Windows 10 / 11 variants as requested
if(categories.os){
  categories.os = categories.os.filter(o=> /windows\s*1[01]\b|win\s*1[01]\b/i.test(o.name));
}

// Write out
const manifest = { generated: new Date().toISOString(), strict: STRICT_MODE, usdToVnd: USD_TO_VND, counts: {}, estimated: estimationSummary, sources: { rawBase: RAW_BASE, cpuScraped: !!process.env.CPU_SCRAPED } };
const estimatedFlags = {};
Object.keys(categories).forEach(cat=>{
  const arr = categories[cat];
  manifest.counts[cat]=arr.length;
  if(!STRICT_MODE){
    estimatedFlags[cat] = arr.filter(it=> it._estimated).map(it=> it.id);
  }
  fs.writeFileSync(path.join(OUT_DIR, cat + '.json'), JSON.stringify(arr, null, 0));
});
if(!STRICT_MODE){ fs.writeFileSync(path.join(OUT_DIR,'estimated-flags.json'), JSON.stringify(estimatedFlags,null,2)); }
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

// -------- Functions --------
function integrateScrapedCpu(){
  try{
    const scrapedPath = path.resolve('temp','cpu_pcpartpicker.json');
    if(!fs.existsSync(scrapedPath)) return; // nothing to integrate
    const raw = JSON.parse(fs.readFileSync(scrapedPath,'utf8'));
    if(!raw || !Array.isArray(raw.items) || !raw.items.length) return;
  const mapped=[]; const seen=new Set();
    raw.items.forEach(item=>{
      if(!item || !item.name) return;
      const name = cleanName(item.name);
      const id = 'cpu_'+slug(name);
      if(seen.has(id)) return; seen.add(id);
      // Parse numeric fields
      const base = parseFloat(String(item.baseClock||'').replace(/[^0-9.]/g,'')) || undefined;
      const boost = parseFloat(String(item.boostClock||'').replace(/[^0-9.]/g,'')) || undefined;
      const cores = parseInt(item.cores,10) || undefined;
      const tdp = parseInt(item.tdp,10) || undefined;
      // Rating numeric (strip stars or parentheses)
      let rating = undefined;
      if(item.rating){
        const r = parseFloat(String(item.rating).replace(/[^0-9.]/g,''));
        if(!isNaN(r)) rating = r;
      }
      const rawArch = item.microarch; const inferred = !rawArch && !STRICT_MODE ? inferMicroArch(name): undefined;
      const obj={ id, name, originalPriceUSD: item.priceUSD, price: normPrice(item.priceUSD), socket: undefined,
        cores, baseClock: base, boostClock: boost, tdp, graphics: item.igpu || undefined,
        microarch: rawArch || inferred, microarchSource: rawArch? 'source': (inferred?'inferred':undefined), rating };
      if(obj.cores && (obj.boostClock||obj.baseClock)) obj.perfScore = obj.cores*(obj.boostClock||obj.baseClock);
      mapped.push(obj);
    });
  if(mapped.length){
      // Merge: prefer existing socket/tdp if scraped missing; match by id
      const byId = new Map();
      if(categories.cpu){ categories.cpu.forEach(c=> byId.set(c.id,c)); }
      mapped.forEach(nc=>{
        const ex = byId.get(nc.id);
        if(ex){
          // Merge selective fields without erasing existing
          ['price','originalPriceUSD','cores','baseClock','boostClock','tdp','graphics','microarch','microarchSource','rating','perfScore'].forEach(k=>{ if(nc[k]!==undefined) ex[k]=nc[k]; });
          if(!ex.socket) ex.socket = parseCpuSocketName(ex.name) || nc.socket;
        } else {
          if(!nc.socket) nc.socket = parseCpuSocketName(nc.name);
          categories.cpu.push(nc);
        }
      });
      console.log('[build-dataset] Integrated scraped CPU list (merged):', mapped.length);
    }
  }catch(e){ console.warn('[build-dataset] integrateScrapedCpu failed:', e.message); }
}
