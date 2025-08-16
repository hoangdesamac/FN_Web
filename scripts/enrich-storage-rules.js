// Rule-based enrichment for storage dataset.
// Does NOT delete or overwrite existing non-null values.
// Adds heuristic or known specs for IOPS, warranty, read/write.
// Marks _specSource: 'known' for explicit map entries, 'heuristic' for rules applied.

const fs = require('fs');
const path = require('path');

const FILES = [
  path.join(__dirname,'..','pc-part-dataset','processed','storage.json'),
  path.join(__dirname,'..','docs','pc-part-dataset','processed','storage.json')
];

// Explicit known specs map keyed by id.
// Only include factual numeric specs (public domain factual data).
const KNOWN_SPECS = {
  'stor_i_samsung_990_pro': { // factual IOPS + warranty only (tbw removed)
    iopsRead: 1400000,
    iopsWrite: 1550000,
    warranty: 5
  },
  'stor_i_crucial_p3_plus': {
    iopsRead: 650000,
    iopsWrite: 700000,
    warranty: 5
  }
};

function classify(item){
  const t = item.type||''; const iface = item.interface||''; const size = item.size||0; const nand=(item.nand||'').toUpperCase();
  return {
    isSSD: /SSD/i.test(t) || /NVMe/i.test(t) || /SATA SSD/i.test(t) || /External SSD/i.test(t),
    isNVMe: /NVMe/i.test(t) || /PCIe/i.test(iface) || /M\.2 PCIe/i.test(iface),
    isSATA: /SATA/i.test(iface) && !/PCIe/i.test(iface),
    isExternal: /External/i.test(t) || /External/.test(item.form||''),
    sizeGB: size,
    isQLC: nand.includes('QLC'),
    isTLC: nand.includes('TLC'),
    iface, t
  };
}


function heuristicIOPS(cls){
  if(!cls.isSSD) return {read:null, write:null};
  if(cls.isNVMe){
    if(/PCIe 4\.0/i.test(cls.iface)) return {read:700000, write:650000};
    return {read:350000, write:300000};
  }
  if(cls.isSATA) return {read:100000, write:90000};
  return {read:null, write:null};
}

function heuristicWarranty(cls,item){
  if(item.warranty!=null) return null;
  if(cls.isExternal) return 3;
  if(cls.isSSD){
    if(/Samsung 990 Pro/i.test(item.name)) return 5;
    if(cls.isNVMe && /PCIe 4\.0/i.test(cls.iface)) return 5;
    return 3;
  }
  if(/Enterprise|Exos|Ultrastar|Nytro|DC/i.test(item.name)) return 5;
  return 2; // generic HDD / external fallback
}

function heuristicReadWrite(cls,item){
  if(item.read!=null && item.write!=null) return null;
  if(cls.isNVMe){
    const gen4 = /4\.0/.test(cls.iface);
    return {
      read: item.read!=null?item.read:(gen4?7000:3500),
      write: item.write!=null?item.write:(gen4?6000:3000)
    };
  }
  if(cls.isSATA && /SSD/i.test(cls.t)){
    return {read: item.read!=null?item.read:560, write: item.write!=null?item.write:530};
  }
  if(!cls.isSSD && /HDD/i.test(cls.t)){
    // Approx sequential MB/s by rpm
    if(item.rpm>=10000) return {read: item.read||250, write: item.write||230};
    if(item.rpm>=7200) return {read: item.read||200, write: item.write||190};
    return {read: item.read||160, write: item.write||150};
  }
  if(cls.isExternal){
    return {read: item.read||500, write: item.write||450};
  }
  return null;
}

function enrichFile(file){
  let raw;
  try { raw = fs.readFileSync(file,'utf8'); } catch(e){ console.error('Cannot read',file); return; }
  let data;
  try { data = JSON.parse(raw);} catch(e){ console.error('Parse fail',file,e.message); return; }
  if(!Array.isArray(data)){ console.error('Not array',file); return; }
  let modified=0, knownApplied=0, heuristicApplied=0;
  for(const item of data){
    const id = item.id;
    const cls = classify(item);
    // Known overrides (only if field null)
    if(id && KNOWN_SPECS[id]){
      const spec = KNOWN_SPECS[id];
      for(const k of Object.keys(spec)){
        if(item[k]==null){ item[k]=spec[k]; modified++; knownApplied++; }
      }
      if(!item._specSource) item._specSource='known';
    }
    // Warranty
    if(item.warranty==null){
      const w = heuristicWarranty(cls,item);
      if(w){ item.warranty = w; modified++; heuristicApplied++; if(!item._specSource) item._specSource='heuristic'; }
    }
    // IOPS
    if(item.iopsRead==null || item.iopsWrite==null){
      const io = heuristicIOPS(cls);
      if(io.read && item.iopsRead==null){ item.iopsRead=io.read; modified++; heuristicApplied++; if(!item._specSource) item._specSource='heuristic'; }
      if(io.write && item.iopsWrite==null){ item.iopsWrite=io.write; modified++; heuristicApplied++; if(!item._specSource) item._specSource='heuristic'; }
    }
      // Removed generic read/write auto-fill to avoid introducing placeholder speeds.
      // (Was previously setting 3500/3000 or 7000/6000 which we now eliminate.)
    // pricePerGB recompute if size and price present but pricePerGB null
    if(item.price!=null && item.size && item.pricePerGB==null){
      item.pricePerGB = Math.round(item.price / item.size);
      modified++; if(!item._specSource) item._specSource='heuristic';
    }
    if(item.originalPriceUSD!=null && item.size && item.rawPricePerGB==null){
      item.rawPricePerGB = +(item.originalPriceUSD / item.size).toFixed(3);
      modified++; if(!item._specSource) item._specSource='heuristic';
    }
  }
  if(modified){
    fs.writeFileSync(file, JSON.stringify(data));
    console.log('Enriched',file,'changes:',modified,'knownApplied:',knownApplied,'heuristicApplied:',heuristicApplied);
  } else {
    console.log('No modifications',file);
  }
}

FILES.forEach(enrichFile);
