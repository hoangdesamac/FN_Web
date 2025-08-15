// Dataset build script: reads raw csv/jsonl -> outputs processed per-category JSON + manifest
const fs = require('fs');
const path = require('path');

const RAW_BASE = path.resolve('pc-part-dataset','data');
const CSV_DIR = path.join(RAW_BASE,'csv');
const JSONL_DIR = path.join(RAW_BASE,'jsonl');
const OUT_DIR = path.resolve('pc-part-dataset','processed');
const USD_TO_VND = 25000;

fs.mkdirSync(OUT_DIR,{recursive:true});

function readFileSafe(p){ try { return fs.readFileSync(p,'utf8'); } catch { return ''; } }
function slug(s){ return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').slice(0,60); }
function normPrice(v){ if(v===null||v===undefined||v==='') return 0; if(typeof v==='number') return Math.round(v*USD_TO_VND); const n=parseFloat(String(v).replace(/[^0-9.]/g,'')); return isNaN(n)?0:Math.round(n*USD_TO_VND); }
function parseCSV(text){ if(!text.trim()) return []; const lines=text.replace(/\r/g,'').split('\n'); const headerLine=lines.shift(); if(!headerLine) return []; const headers=headerLine.split(','); const rows=[]; for(const raw of lines){ if(!raw.trim()) continue; const fields=[]; let cur='', q=false; for(let i=0;i<raw.length;i++){ const ch=raw[i]; if(ch==='"'){ if(q && raw[i+1]==='"'){ cur+='"'; i++; } else q=!q; } else if(ch===',' && !q){ fields.push(cur); cur=''; } else cur+=ch; } fields.push(cur); const obj={}; headers.forEach((h,idx)=> obj[h.trim()]=(fields[idx]||'').trim()); rows.push(obj); } return rows; }
function parseJsonl(text){ return text.split(/\r?\n/).filter(l=>l.trim()).map(l=>{ try {return JSON.parse(l);} catch { return null; } }).filter(Boolean); }

const categories = {};
function add(cat, item){ if(!categories[cat]) categories[cat]=[]; categories[cat].push(item); }

// CSV Loaders
function loadCsvFile(file, handler){ const p=path.join(CSV_DIR,file); const data=parseCSV(readFileSafe(p)); data.forEach(r=> handler(r)); }

// --- CPU from JSONL (richer) then CSV fallback ---
const cpuJsonlPath = path.join(JSONL_DIR,'cpu.jsonl');
if(fs.existsSync(cpuJsonlPath)){
  parseJsonl(readFileSafe(cpuJsonlPath)).forEach(r=>{
    if(!r.name) return; add('cpu', {
      id:'cpu_'+slug(r.name), name:r.name, price:normPrice(r.price||r.cost),
      socket:r.socket_type||r.socket, cores:r.core_count, baseClock:r.core_clock, boostClock:r.boost_clock,
      tdp:r.tdp, graphics:r.graphics, perfScore: (r.core_count||0) * (r.boost_clock||r.core_clock||0)
    });
  });
}
loadCsvFile('cpu.csv', r=>{ if(!r.name) return; const id='cpu_'+slug(r.name); if(categories.cpu && categories.cpu.some(x=>x.id===id)) return; add('cpu', { id, name:r.name, price:normPrice(r.price), socket:r.socket_type||r.socket, cores: +r.core_count||undefined, baseClock: +r.core_clock||undefined, boostClock: +r.boost_clock||undefined, tdp:+r.tdp||undefined }); });

// Motherboard
loadCsvFile('motherboard.csv', r=>{ if(!r.name) return; add('mainboard',{ id:'mb_'+slug(r.name), name:r.name, price:normPrice(r.price), socket:r.socket, chipset: r.chipset, form: (r.form_factor||'').toLowerCase(), maxMemory: +r.max_memory||undefined, color:r.color }); });
// Memory
loadCsvFile('memory.csv', r=>{ if(!r.name) return; add('ram',{ id:'ram_'+slug(r.name), name:r.name, price:normPrice(r.price), type:r.type||r.memory_type, size:+r.capacity_gb||undefined, speed:r.speed||r.frequency, sticks: +r.modules||undefined }); });
// GPU
loadCsvFile('video-card.csv', r=>{ if(!r.name) return; const vram=+r.memory||undefined; const power = vram? 50 + vram*10 : undefined; add('gpu',{ id:'gpu_'+slug(r.name), name:r.name, price:normPrice(r.price), chipset:r.chipset, vram, core:+r.core_clock||undefined, boost:+r.boost_clock||undefined, length:+r.length||undefined, estPower: power }); });
// PSU
loadCsvFile('power-supply.csv', r=>{ if(!r.name) return; add('psu',{ id:'psu_'+slug(r.name), name:r.name, price:normPrice(r.price), type:r.type, efficiency:r.efficiency, watt:+r.wattage||undefined, modular:r.modular }); });
// Monitor
loadCsvFile('monitor.csv', r=>{ if(!r.name) return; add('monitor',{ id:'mon_'+slug(r.name), name:r.name, price:normPrice(r.price), size:+r.screen_size||undefined, res:(r.resolution||'').replace(/"|,/g,'x'), hz:+r.refresh_rate||undefined, panel:r.panel_type, aspect:r.aspect_ratio }); });
// Storage
loadCsvFile('internal-hard-drive.csv', r=>{ if(!r.name) return; add('storage',{ id:'stor_i_'+slug(r.name), name:r.name, price:normPrice(r.price), type:'HDD', size:+r.capacity_gb||undefined }); });
loadCsvFile('external-hard-drive.csv', r=>{ if(!r.name) return; add('storage',{ id:'stor_e_'+slug(r.name), name:r.name, price:normPrice(r.price), type:'External', size:+r.capacity_gb||undefined }); });
// Case & Cooler
loadCsvFile('case.csv', r=>{ if(!r.name) return; add('case',{ id:'case_'+slug(r.name), name:r.name, price:normPrice(r.price), type:r.type||r.form_factor }); });
loadCsvFile('cpu-cooler.csv', r=>{ if(!r.name) return; add('cooler',{ id:'cool_'+slug(r.name), name:r.name, price:normPrice(r.price), type:r.type, tdp:+r.tdp||undefined }); });
// Peripherals
loadCsvFile('keyboard.csv', r=>{ if(!r.name) return; add('keyboard',{ id:'kb_'+slug(r.name), name:r.name, price:normPrice(r.price) }); });
loadCsvFile('mouse.csv', r=>{ if(!r.name) return; add('mouse',{ id:'mouse_'+slug(r.name), name:r.name, price:normPrice(r.price) }); });
loadCsvFile('headphones.csv', r=>{ if(!r.name) return; add('headphones',{ id:'hp_'+slug(r.name), name:r.name, price:normPrice(r.price) }); });
loadCsvFile('speakers.csv', r=>{ if(!r.name) return; add('speakers',{ id:'spk_'+slug(r.name), name:r.name, price:normPrice(r.price) }); });
loadCsvFile('os.csv', r=>{ if(!r.name) return; add('os',{ id:'os_'+slug(r.name), name:r.name, price:normPrice(r.price) }); });
loadCsvFile('sound-card.csv', r=>{ if(!r.name) return; add('soundcard',{ id:'sc_'+slug(r.name), name:r.name, price:normPrice(r.price) }); });
loadCsvFile('wired-network-card.csv', r=>{ if(!r.name) return; add('network',{ id:'net_'+slug(r.name), name:r.name, price:normPrice(r.price) }); });
loadCsvFile('wireless-network-card.csv', r=>{ if(!r.name) return; add('network',{ id:'net_'+slug(r.name)+'_w', name:r.name, price:normPrice(r.price) }); });

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
console.log('Dataset built:', manifest);
