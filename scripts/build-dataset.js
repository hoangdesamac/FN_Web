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
// Exchange & pricing policy
// 1 USD = 25,000 VND (default) then apply 20% discount -> effective multiplier 25,000 * 0.8 unless overridden by env vars
const USD_TO_VND = parseFloat(process.env.USD_TO_VND)||25000; // base conversion
const DISCOUNT_RATE = (process.env.DISCOUNT_RATE!==undefined)? parseFloat(process.env.DISCOUNT_RATE): 0.20; // 0.20 => 20% off
const STRICT_MODE = process.env.STRICT_MODE === '1'; // Khi bật: không suy luận microarch, không ước tính giá, chỉ dùng dữ liệu gốc

fs.mkdirSync(OUT_DIR,{recursive:true});

function readFileSafe(p){ try { return fs.readFileSync(p,'utf8'); } catch { return ''; } }
function slug(s){ return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').slice(0,60); }
function extractUSD(v){ if(v===null||v===undefined||v==='') return undefined; if(typeof v==='number') return v; const n=parseFloat(String(v).replace(/[^0-9.]/g,'')); return isNaN(n)?undefined:n; }
function normPrice(v){
  const usd = extractUSD(v);
  if(usd===undefined) return 0;
  const base = usd * USD_TO_VND;
  const final = DISCOUNT_RATE>0 ? base * (1-DISCOUNT_RATE) : base;
  return Math.round(final);
}
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
addFromJsonl('external-hard-drive','storage', r=>({ originalPriceUSD: extractUSD(r.price), price:normPrice(r.price), type:'External', size: r.capacity_gb || r.capacity, rawPricePerGB: r.price_per_gb }), 'stor_e');
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
// Extended CPU socket inference
function deriveCpuSocket(name){
  if(!name) return undefined; const n=name.toLowerCase();
  if(/ryzen/.test(n)){
    if(/threadripper/.test(n)){
      if(/pro/.test(n) || /5995wx|5975wx|5965wx/.test(n)) return 'sWRX8';
      return 'sTRX4';
    }
    const m=n.match(/\b(\d{4,5})x?3?d?\b/); if(m){ const num=+m[1]; if(num>=7000) return 'AM5'; if(num>=1000) return 'AM4'; }
  }
  if(/core\s+i[3579]/.test(n)){
    const genMatch=n.match(/\b(\d{4,5})[a-z]{0,2}\b/); if(genMatch){ const code=+genMatch[1]; const gen=Math.floor(code/1000); if(gen>=12) return 'LGA1700'; if(gen===11||gen===10) return 'LGA1200'; if(gen>=6) return 'LGA1151'; }
  }
  if(/lga1700/.test(n)) return 'LGA1700'; if(/lga1200/.test(n)) return 'LGA1200'; if(/lga1151/.test(n)) return 'LGA1151'; if(/am5/.test(n)) return 'AM5'; if(/am4/.test(n)) return 'AM4';
  return undefined;
}

// CPU socket fallback if missing (avoid overriding existing)
if(categories.cpu){ categories.cpu.forEach(c=>{ if(!c.socket){ const s=parseCpuSocketName(c.name); if(s) c.socket=s; } }); }
if(categories.cpu){ categories.cpu.forEach(c=>{ if(!c.socket){ const d=deriveCpuSocket(c.name); if(d) c.socket=d; } }); }
// RAM recover size/type/speed
if(categories.ram){ categories.ram.forEach(r=>{ if(!r.size){ const s=parseSizeFromName(r.name); if(s) r.size=s; } if(!r.type){ const t=(r.name||'').toUpperCase().match(/DDR[2345]/); if(t) r.type=t[0]; } if(!r.speed){ const sp=parseRamSpeed(r.name); if(sp) r.speed=sp; } }); }
// Storage size fallback
if(categories.storage){ categories.storage.forEach(s=>{ if(!s.size){ const sz=parseSizeFromName(s.name); if(sz) s.size=sz; } }); }
// Monitor size/Hz/aspect fallback
if(categories.monitor){ categories.monitor.forEach(m=>{ if(!m.hz){ const hz=parseMonitorHz(m.name); if(hz) m.hz=hz; } if(!m.size){ const sz=parseMonitorSize(m.name); if(sz) m.size=sz; } if(!m.aspect){ const a=computeAspect(m.res); if(a) m.aspect=a; } }); }
// Monitor Hz second pass: infer from common refresh numbers with display context words
if(categories.monitor){
  const hzCommon=new Set([60,65,75,90,100,120,125,130,135,138,140,144,150,155,160,165,170,175,180,185,190,195,200,204,210,220,230,240,250,260,270,280,300,310,320,325,330,340,350,355,360]);
  categories.monitor.forEach(m=>{
    if(m.hz) return; const txt=m.name||''; if(!/(hz|ips|va|oled|fhd|qhd|uhd|hdr|curved|wqhd|4k|1080|1440|2160)/i.test(txt)) return;
    const nums=[...txt.matchAll(/\b(\d{2,3})\b/g)].map(x=>+x[1]);
    for(const v of nums){ if(hzCommon.has(v)){ m.hz=v; break; } }
  });
}
// Additional conservative monitor Hz fallbacks
if(categories.monitor){
  categories.monitor.forEach(m=>{
    if(m.hz) return; const txt=(m.name||'').toLowerCase();
    const has4K=/2160|4k|uhd/.test(txt);
    if(!m.hz && has4K && !/(120|144|165|180|200|240|280|300|360)/.test(txt)) m.hz=60; // typical 4K 60Hz office panel
    if(!m.hz && /\b75\b/.test(txt)) m.hz=75; // common 75Hz office monitor
  });
}
// Case type fallback
if(categories.case){ categories.case.forEach(c=>{ if(!c.type){ const t=classifyCaseType(c.name); if(t) c.type=t; } }); }
// Cooler type fallback
if(categories.cooler){ categories.cooler.forEach(c=>{ if(!c.type){ const t=classifyCoolerType(c.name); if(t) c.type=t; } }); }
if(categories.cooler){ categories.cooler.forEach(c=>{ if(!c.type){ const n=(c.name||'').toLowerCase(); if(/deepcool|gammaxx|vetroo|silverstone|scythe|fuma|ninja|id-cooling|thermalright|dark rock|pure rock|gammax|iceberg/.test(n)) c.type='Air'; if(!c.type && /(masterliquid|castle|aquafusion|levante|liquid freezer|elite capellix|h100|h115|h150|h170|kraken|galahad|infinity|liquid)/.test(n)) c.type='AIO'; } }); }
// Cooler extra enrichment: treat brand-specific lines
if(categories.cooler){
  categories.cooler.forEach(c=>{
    if(c.type) return; const n=(c.name||'').toLowerCase();
    if(/(ryujin|hydroshift|glacier one|proart lc|freezer liquid|liquid freezer|castle|aquafusion|levante|galahad|kraken|elite capellix|masterliquid|seidon|water 3\.0|arctic liquid)/.test(n)) c.type='AIO';
    if(!c.type && /(wraith|alpine|intel e973|gravity|t120|pure rock|freezer [0-9]|assassin|phantom spirit|peerless|nh-|dark rock|mugen|fuma|ninja|bk00|hyper 212)/.test(n)) c.type='Air';
  if(!c.type && /(icemyst|neptwin|neptune|iceberg 360|iceberg 240)/.test(n)) c.type='AIO';
  if(!c.type && /(ak400|ak500|ak620)/.test(n)) c.type='Air';
  });
}

// Extended CPU socket mapping pass using regex table
if(categories.cpu){
  const rules=[
    {re:/ryzen\s+([579]|threadripper)?\s*9\d{3}/i, socket:'AM5'},
    {re:/ryzen\s+([579]|threadripper)?\s*7\d{3}/i, socket:'AM5'},
    {re:/ryzen\s+([345679])\d{3}/i, socket:'AM4'},
    {re:/threadripper.*(pro)?\b(wx)?/i, socket:'sTRX4'},
    {re:/threadripper\s+pro/i, socket:'sWRX8'},
    {re:/core\s+i[3579]-1[234].../i, socket:'LGA1700'},
    {re:/core\s+i[3579]-11.../i, socket:'LGA1200'},
    {re:/core\s+i[3579]-10.../i, socket:'LGA1200'},
    {re:/core\s+i[3579]-9.../i, socket:'LGA1151'},
    {re:/core\s+i[3579]-8.../i, socket:'LGA1151'},
    {re:/pentium\s+g[45].../i, socket:'LGA1200'},
    {re:/pentium\s+g4.../i, socket:'LGA1151'},
    {re:/celeron\s+g[45].../i, socket:'LGA1200'},
    {re:/celeron\s+g4.../i, socket:'LGA1151'},
    {re:/fx-9\d{3}/i, socket:'AM3+'},
    {re:/fx-8\d{3}/i, socket:'AM3+'},
    {re:/athlon\s+x4/i, socket:'FM2+'}
  ];
  categories.cpu.forEach(c=>{ if(c.socket) return; const nm=c.name; for(const r of rules){ if(r.re.test(nm)){ c.socket=r.socket; break; } } });
}

// Deeper CPU socket inference (legacy + new gens: Core Ultra, EPYC, FX, APUs, Core2, Xeon)
if(categories.cpu){
  categories.cpu.forEach(c=>{
    if(c.socket) return; const n=c.name.toLowerCase();
    // Intel Core Ultra (Arrow Lake) tentative mapping
    if(/core\s+ultra/.test(n)) c.socket='LGA1851';
    // Intel Core legacy gen numeric refinement
    const coreMatch = n.match(/core\s+i[3579]-([0-9]{3,5})/);
    if(coreMatch){
      const digits=coreMatch[1];
      if(digits.length===4){ const gen=Math.floor(parseInt(digits,10)/1000); if(gen===5||gen===4) c.socket='LGA1150'; else if(gen===3||gen===2) c.socket='LGA1155'; }
      if(!c.socket && /-(7[5-9][0-9]|8[0-9][0-9])/.test(n)) c.socket='LGA1156'; // 1st gen Lynnfield
    }
    // HEDT families
    if(!c.socket && /i7-58(20|30|40)k|i7-59(30|40)k|i7-69(00|50)x/i.test(n)) c.socket='LGA2011-3';
    if(!c.socket && /i7-68(00|50)k|i7-69(00|50)x/i.test(n)) c.socket='LGA2011-3';
    if(!c.socket && /i7-39(30|60|70)k|i7-49(30|60|70)k/i.test(n)) c.socket='LGA2011';
    if(!c.socket && /i[79]-7[89]\d{2}x|i9-99\d{2}x/i.test(n)) c.socket='LGA2066';
    // Xeon E3 generations
    if(!c.socket && /xeon\s+e3-12\d{2}\s*v[56]\b/.test(n)) c.socket='LGA1151';
    if(!c.socket && /xeon\s+e3-12\d{2}\s*v[34]\b/.test(n)) c.socket='LGA1150';
    if(!c.socket && /xeon\s+e3-12\d{2}(\s*v[12])?\b/.test(n)) c.socket='LGA1155';
    // Xeon E5 versions
    if(!c.socket && /xeon\s+e5-26\d{2}\s*v[34]/.test(n)) c.socket='LGA2011-3';
    if(!c.socket && /xeon\s+e5-26\d{2}(\s*v[12])?/.test(n)) c.socket='LGA2011';
    // Xeon E5 generic v4/v3/v2/v1 already partly handled; extra broad E5-16xx patterns
    if(!c.socket && /xeon\s+e5-16\d{2}\s*v4/.test(n)) c.socket='LGA2011-3';
    if(!c.socket && /xeon\s+e5-16\d{2}\s*v3/.test(n)) c.socket='LGA2011-3';
    if(!c.socket && /xeon\s+e5-16\d{2}\s*v2/.test(n)) c.socket='LGA2011';
    if(!c.socket && /xeon\s+e5-16\d{2}\b/.test(n)) c.socket='LGA2011';
    // Core i7-9xx Bloomfield
    if(!c.socket && /core\s+i7-9[0-9]{2}\b/.test(n)) c.socket='LGA1366';
    // Core i7-8xx / i5-7xx Lynnfield
    if(!c.socket && /core\s+i7-8[0-9]{2}\b/.test(n)) c.socket='LGA1156';
    if(!c.socket && /core\s+i5-7[0-9]{2}\b/.test(n)) c.socket='LGA1156';
    // Core 2 series
    if(!c.socket && /core\s+2\s+(quad|duo)/.test(n)) c.socket='LGA775';
    // Pentium / Celeron legacy
    if(!c.socket && /pentium\s+e\d{4}/.test(n)) c.socket='LGA775';
    if(!c.socket && /celeron\s+e\d{4}/.test(n)) c.socket='LGA775';
    if(!c.socket && /pentium\s+g6[0-9]{2}/.test(n)) c.socket='LGA1156';
    if(!c.socket && /celeron\s+g4[0-9]{2}/.test(n)) c.socket='LGA1155';
    // AMD families
    if(!c.socket && /epyc/.test(n)) c.socket='SP3';
    if(!c.socket && /phenom\s+ii/.test(n)) c.socket='AM3';
    if(!c.socket && /\bfx-\d{4}\b/.test(n)) c.socket='AM3+';
    if(!c.socket && /athlon\s+ii/.test(n)) c.socket='AM3';
    if(!c.socket && /athlon\s+3\d{3}g|athlon\s+2\d{2}ge|athlon\s+200ge/.test(n)) c.socket='AM4';
    if(!c.socket && /\ba(6|8|10|12)-7\d{3}/.test(n)) c.socket='FM2+';
    if(!c.socket && /\ba(4|6|8|10|12)-6\d{3}/.test(n)) c.socket='FM2';
    if(!c.socket && /ryzen\s+\d\s*8[0-9]{3}(g|f)?/.test(n)) c.socket='AM5'; // 8000G/F desktop
    if(!c.socket && /ryzen\s+\d\s*(5|4|3)\d{3}g/.test(n)) c.socket='AM4'; // 5000G/4000G/3000G APUs
  });
}

// Monitor additional Hz inference (resolution context) if still missing
if(categories.monitor){
  categories.monitor.forEach(m=>{
    if(m.hz) return; const txt=(m.name||'').toLowerCase();
    const hasFHD=/1080|fhd/.test(txt); const hasQHD=/1440|qhd|wqhd/.test(txt); const has4K=/2160|4k|uhd/.test(txt);
    if(/360/.test(txt)) m.hz=360; else if(/300|320|325|330|340|350|355/.test(txt)) m.hz= (txt.match(/3(00|10|20|25|30|40|50|55)/)? parseInt(txt.match(/3(00|10|20|25|30|40|50|55)/)[0],10): undefined);
    if(!m.hz && /280/.test(txt)) m.hz=280; if(!m.hz && /270/.test(txt)) m.hz=270;
    if(!m.hz && /240/.test(txt)) m.hz=240;
    if(!m.hz && /200/.test(txt)) m.hz=200;
    if(!m.hz && /180/.test(txt)) m.hz=180;
    if(!m.hz && /175/.test(txt)) m.hz=175;
    if(!m.hz && /170/.test(txt)) m.hz=170;
    if(!m.hz && /165/.test(txt)) m.hz=165;
    if(!m.hz && /160/.test(txt)) m.hz=160;
    if(!m.hz && /155/.test(txt)) m.hz=155;
    if(!m.hz && /150/.test(txt)) m.hz=150;
    if(!m.hz && /149/.test(txt)) m.hz=149; // rare
    if(!m.hz && /144/.test(txt)) m.hz=144;
    if(!m.hz && hasQHD && /165/.test(txt)) m.hz=165;
    if(!m.hz && hasFHD && /144/.test(txt)) m.hz=144;
    if(!m.hz && has4K && /144/.test(txt)) m.hz=144;
  });
}

// RAM overrides for legacy 1GB modules (assume DDR / very low MHz not provided)
if(categories.ram){ categories.ram.forEach(r=>{ if(!r.type && r.size===1) r.type='DDR'; if(!r.speed && r.size===1) r.speed=400; }); }

// External storage: if size still missing but capacity field existed (raw ingest stored in size), nothing to do; else attempt parse again.
if(categories.storage){ categories.storage.forEach(s=>{ if(s.type==='External' && !s.size){ const p=parseSizeFromName(s.name); if(p) s.size=p; } }); }

// --- Storage enrichment heuristics (conservative) ---
if(categories.storage){
  categories.storage.forEach(s=>{
    const name=(s.name||'').toLowerCase();
    // Interface inference
    if(!s.interface){
      if(/pci|nvme|gen4|gen 4|gen3|gen 3|gen5|gen 5|m\.2|m2/.test(name)) s.interface='PCIe';
      else if(/sata\s*iii|sata 3|sata iii/.test(name)) s.interface='SATA III';
      else if(/sata/.test(name)) s.interface='SATA';
      else if(/usb\s*3\.2|usb\s*3\.1|usb\s*3\.0|type-c|usb-c|usb4|thunderbolt/.test(name) && /external|portable|usb/.test(name)) s.interface='USB';
    }
    // Form factor
    if(!s.form){
      if(/m\.2|m2/.test(name)) s.form='M.2';
      else if(/2\.5\"|2.5\s*inch|2\.5inch|2\.5 in/.test(name)) s.form='2.5"';
      else if(/3\.5\"|3.5\s*inch|3\.5inch|3\.5 in/.test(name)) s.form='3.5"';
      else if(/portable|external|usb/.test(name)) s.form='External';
    }
    // RPM only for HDD
    if(!s.rpm && /hdd|hard drive|harddisk|desktop drive|enterprise|nas/.test(name) && /\b(5400|7200|10000)\b/.test(name)){
      const m=name.match(/\b(5400|7200|10000)\b/); if(m) s.rpm=parseInt(m[1],10);
    }
    // Sequential read/write (very conservative): pick highest plausible numbers if explicitly stated
    if((!s.read || !s.write) && /ssd|nvme/.test(name)){
      const speeds=[...name.matchAll(/(\d{3,5})\s*mb\/?s/g)].map(m=>parseInt(m[1],10)).filter(v=>v>=200 && v<=15000);
      if(speeds.length){
        const sorted=speeds.sort((a,b)=>b-a);
        if(!s.read) s.read=sorted[0];
        if(!s.write) s.write=sorted.find(v=>v<=s.read) || sorted[0];
      } else {
        // Generic tier defaults (only if nothing captured)
        if(!s.read){
          if(/gen5|gen 5/.test(name)) s.read=10000; else if(/gen4|gen 4/.test(name)) s.read=7000; else if(/gen3|gen 3/.test(name)) s.read=3500; else if(/sata/.test(name)) s.read=560;
        }
        if(!s.write){
          if(/gen5|gen 5/.test(name)) s.write=9000; else if(/gen4|gen 4/.test(name)) s.write=6000; else if(/gen3|gen 3/.test(name)) s.write=3000; else if(/sata/.test(name)) s.write=530;
        }
      }
    }
    // NAND type
    if(!s.nand){
      if(/qlc/.test(name)) s.nand='QLC';
      else if(/tlc/.test(name)) s.nand='TLC';
      else if(/mlc/.test(name)) s.nand='MLC';
      else if(/slc/.test(name)) s.nand='SLC';
    }
    // DRAM presence hints
    if(!s.dram && /dram-?less|dramless/.test(name)) s.dram='No';
    if(!s.dram && /\b(hmb|host memory buffer)\b/.test(name)) s.dram='HMB';
    if(!s.dram && /cache/.test(name) && /nvme|ssd/.test(name)) s.dram='Yes';
    // Cache MB for HDD if pattern like 64MB / 256MB
    if(!s.cache){
      const cm=name.match(/\b(8|16|32|64|128|256|512) ?mb\b/);
      if(cm) s.cache=parseInt(cm[1],10);
    }
    // Recompute pricePerGB if still missing
    if(!s.pricePerGB && s.price && s.size) s.pricePerGB=Math.round(s.price/s.size);
  });
}

    // --- Known storage specs mapping (authoritative fill) ---
    try{
      const knownPath = path.resolve('pc-part-dataset','known-storage-specs.json');
      if(fs.existsSync(knownPath) && categories.storage){
        const specList = JSON.parse(fs.readFileSync(knownPath,'utf8'));
        const patterns = specList.map(s=>({raw:s, re: new RegExp(s.match.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&'),'i')}));
    categories.storage.forEach(it=>{
          const n=(it.name||'').toLowerCase();
          for(const p of patterns){
            if(p.re.test(n)){
              const sp=p.raw;
              if(it.read===undefined && sp.read!==undefined) it.read=sp.read;
              if(it.write===undefined && sp.write!==undefined) it.write=sp.write;
              if(it.nand===undefined && sp.nand) it.nand=sp.nand;
              if(it.dram===undefined && sp.dram) it.dram=sp.dram;
              if(it.interface===undefined && sp.interface) it.interface=sp.interface;
              if(it.form===undefined && sp.form) it.form=sp.form;
      if(sp.rpm && it.rpm===undefined) it.rpm=sp.rpm;
      if(!it._specSource) it._specSource='known';
              break;
            }
          }
          if(!it.pricePerGB && it.price && it.size) it.pricePerGB=Math.round(it.price/it.size);
        });
      }
    }catch(e){ console.warn('[build-dataset] known-storage-specs mapping failed', e.message); }

// ---- CPU final enrichment: fill remaining socket, boostClock (safe families), and graphics (iGPU) ----
if(categories.cpu){
  categories.cpu.forEach(c=>{
    const name = c.name||''; const low = name.toLowerCase();
    // Socket for Ryzen XT / GT / T variants not previously caught
    if(!c.socket && /ryzen/.test(low)){
      const m = low.match(/ryzen\s+\d\s*(\d{4})/); if(m){ const code=+m[1]; if(code>=7000) c.socket='AM5'; else if(code>=1000) c.socket='AM4'; }
    }
    // Boost clock safe assumptions: families without turbo feature historically
    if(!c.boostClock && c.baseClock){
      if(/celeron|pentium|core 2 duo|core 2 quad|sempron|athlon ii|athlon x2|athlon 3|athlon x4|athlon 3000g|a4-|a6-|a8-|a10-|a12-/.test(low)){
        c.boostClock = c.baseClock;
      } else {
        // Core i3 pre-11th gen (<=10xxx) had no turbo
        const i3 = low.match(/core\s+i3-([0-9]{4,5})/);
        if(i3){ const num=+i3[1]; if(num<11000) c.boostClock=c.baseClock; }
      }
    }
    // Integrated graphics inference if missing
    if(!c.graphics){
      if(/threadripper|epyc|fx-|opteron|sempron/.test(low)) c.graphics='None';
      else if(/xeon/.test(low)){
        if(/\b(e-\d{4,5}g)\b/.test(low)) c.graphics='Intel UHD'; else c.graphics='None';
      } else if(/ryzen/.test(low)){
        const m = low.match(/ryzen\s+\d\s*(\d{4})/); let code = m? +m[1]:0;
        if(/g\b/.test(low) || / g /.test(low)) c.graphics='Radeon';
        else if(code>=7000) c.graphics='RDNA2';
        else c.graphics='None';
      } else if(/athlon|a4-|a6-|a8-|a10-|a12-/.test(low)){
        c.graphics='Radeon';
      } else if(/core\s+i[3579]/.test(low)){
        if(/kf\b|\bkf\b|\bf\b| f /i.test(name)) c.graphics='None';
        else c.graphics='Intel UHD';
      } else if(/core 2/.test(low)){
        c.graphics='None';
      } else if(/celeron|pentium/.test(low)){
        c.graphics='Intel UHD';
      }
    }
    // F variants ensure None
    if(c.graphics && /\bkf\b|\bf\b/.test(low) && !/xeon/.test(low) && /core\s+i[3579]/.test(low)) c.graphics='None';
  });
  // Recompute pricePerCore if cores & price present
  categories.cpu.forEach(c=>{ if(c.price && c.cores) c.pricePerCore = Math.round(c.price/c.cores); });
}
// External storage interface refinement additions
if(categories.storage){
  categories.storage.forEach(s=>{
    if(s.type && s.type.startsWith('External')){
      if(!s.interface){
        const n=(s.name||'').toLowerCase();
        if(/t5 |t7 |t9 |t5$|t7$|t9$|extreme portable|x10|x10 pro|shield|portable ssd|pssd|nvme|x6|x8/.test(n)) s.interface='USB Type-C';
        else if(/my passport|elements|expansion|backup plus|easystore|my book|p10|d10/.test(n)) s.interface='USB Type-A';
      }
    }
  });
}

// Support optional overrides file (manual corrections)
try{
  const overridesPath=path.resolve('pc-part-dataset','overrides.json');
  if(fs.existsSync(overridesPath)){
    const ov=JSON.parse(fs.readFileSync(overridesPath,'utf8'));
    if(ov && typeof ov==='object'){
      Object.keys(ov).forEach(cat=>{
        const list=categories[cat]; if(!list) return; const byId=new Map(list.map(x=>[x.id,x]));
        Object.entries(ov[cat]).forEach(([id,fields])=>{ const item=byId.get(id); if(item){ Object.entries(fields).forEach(([k,v])=>{ item[k]=v; }); }});
      });
    }
  }
  else {
    const tmpl={ cpu:{}, monitor:{}, cooler:{}, storage:{}, ram:{} };
    fs.writeFileSync(overridesPath, JSON.stringify(tmpl,null,2));
  }
}catch(e){ console.warn('[build-dataset] overrides load failed', e.message); }
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

// ---- Storage detailed enrichment (only fill when missing) ----
if(categories.storage){
  const patternSpecs = [
    {re:/\b980\s*pro\b/i, read:7000, write:5000, nand:'TLC', dram:'Yes'},
    {re:/\b990\s*pro\b/i, read:7450, write:6900, nand:'TLC', dram:'Yes'},
    {re:/\b970\s*evo\s*plus\b/i, read:3500, write:3300, nand:'TLC', dram:'Yes'},
    {re:/\b970\s*evo\b/i, read:3400, write:2500, nand:'TLC', dram:'Yes'},
    {re:/\b870\s*evo\b/i, read:560, write:530, nand:'TLC', dram:'Yes'},
    {re:/\b870\s*qvo\b/i, read:560, write:530, nand:'QLC', dram:'Yes'},
    {re:/\b860\s*evo\b/i, read:550, write:520, nand:'TLC', dram:'Yes'},
    {re:/\bmx500\b/i, read:560, write:510, nand:'TLC', dram:'Yes'},
    {re:/\bkc3000\b/i, read:7000, write:7000, nand:'TLC', dram:'Yes'},
    {re:/\bkc2000\b/i, read:3200, write:2200, nand:'TLC', dram:'Yes'},
    {re:/\bnv2\b/i, read:3500, write:2800, dram:'HMB'},
    {re:/\bnv1\b/i, read:2100, write:1700, dram:'HMB'},
    {re:/\bsn770\b/i, read:5150, write:4900, nand:'TLC', dram:'HMB'},
    {re:/\bsn850x?\b/i, read:7300, write:6600, nand:'TLC', dram:'Yes'},
    {re:/\bsn750\b/i, read:3470, write:3000, nand:'TLC', dram:'Yes'},
    {re:/\bblack\s*sn850x?\b/i, read:7300, write:6600, nand:'TLC', dram:'Yes'},
    {re:/\bcrucial\s*p3\s*plus\b/i, read:5000, write:4200, nand:'QLC', dram:'HMB'},
    {re:/\bcrucial\s*p3\b/i, read:3500, write:3000, nand:'QLC', dram:'HMB'},
    {re:/\bcrucial\s*p5\s*plus\b/i, read:6600, write:5000, nand:'TLC', dram:'Yes'},
    {re:/\bcrucial\s*p5\b/i, read:3400, write:3000, nand:'TLC', dram:'Yes'},
    {re:/\bfury\s*renegade\b/i, read:7300, write:7000, nand:'TLC', dram:'Yes'},
    {re:/\bfirecuda\s*530\b/i, read:7300, write:6900, nand:'TLC', dram:'Yes'},
    {re:/\badata\s*legend\s*960\b/i, read:7400, write:6800, nand:'TLC', dram:'Yes'},
    {re:/\badata\s*legend\s*850\b/i, read:5000, write:4500, nand:'TLC', dram:'Yes'}
  ];
  const tlcHints=/\b(evo|pro|blue|sn770|sn850|sn850x|kc3000|kc2000|mx500|renegade|firecuda|p5|legend)\b/i;
  const qlcHints=/\b(qvo|p3\b|qlc)\b/i;
  categories.storage.forEach(s=>{
    const n=(s.name||'').toLowerCase();
    if(!s.interface){ if(/nvme|pci|gen4|gen3|m\.2/.test(n)) s.interface='PCIe'; else if(/sata/.test(n)) s.interface='SATA'; else if(s.type && /SATA SSD/i.test(s.type)) s.interface='SATA'; }
    if(!s.form){ if(/m\.2/.test(n)) s.form='M.2'; else if(/2\.5/.test(n)) s.form='2.5"'; }
    if(!s.rpm && /hdd|hard|rpm/.test(n)){ const m=n.match(/(5400|7200|10000)\s*rpm?/); if(m) s.rpm=+m[1]; }
    if(!s.cache){ const m=n.match(/(32|64|128|256|512)\s*mb\s*cache/); if(m) s.cache=+m[1]; }
    for(const spec of patternSpecs){ if(spec.re.test(s.name)){ if(s.read===undefined && spec.read!==undefined) s.read=spec.read; if(s.write===undefined && spec.write!==undefined) s.write=spec.write; if(!s.nand && spec.nand) s.nand=spec.nand; if(!s.dram && spec.dram) s.dram=spec.dram; break; } }
    if(!s.nand){ if(qlcHints.test(n)) s.nand='QLC'; else if(tlcHints.test(n)) s.nand='TLC'; }
    if(!s.dram){ if(/(sn770|nv2|p3\b|p3\s+plus)/.test(n)) s.dram='HMB'; }
  });
}

// ---- Category-specific pruning ----
// OS: keep only Windows 10 / 11 variants as requested
if(categories.os){
  categories.os = categories.os.filter(o=> /windows\s*1[01]\b|win\s*1[01]\b/i.test(o.name));
}

// Write out
// Annotate pricing details (original USD if present) & discount metadata
Object.keys(categories).forEach(cat=>{
  categories[cat].forEach(it=>{
    if(it.originalPriceUSD!==undefined){
      // Store effective exchange & discount info for frontend traceability
      it._pricing = { usd: it.originalPriceUSD, rate: USD_TO_VND, discount: DISCOUNT_RATE, baseVnd: Math.round(it.originalPriceUSD*USD_TO_VND), finalVnd: it.price };
    }
  });
});
const manifest = { generated: new Date().toISOString(), strict: STRICT_MODE, usdToVnd: USD_TO_VND, discountRate: DISCOUNT_RATE, counts: {}, estimated: estimationSummary, sources: { rawBase: RAW_BASE, cpuScraped: !!process.env.CPU_SCRAPED } };
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
