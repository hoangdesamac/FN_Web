// Enrich storage dataset by adding missing fields with null/defaults without removing existing items.
const fs = require('fs');
const path = require('path');
const FILES = [
  path.join(__dirname,'..','pc-part-dataset','processed','storage.json'),
  path.join(__dirname,'..','docs','pc-part-dataset','processed','storage.json')
];

const FIELDS = {
  id:null,
  name:null,
  type:null,
  interface:null,
  form:null,
  size:null,
  rpm:null,
  cache:null,
  read:null,
  write:null,
  iopsRead:null,
  iopsWrite:null,
  // Removed deprecated fields: nand, dram, controller, tbw, mtbf, endurancePB
  warranty:null,
  dimensions:null,
  weight:null,
  originalPriceUSD:null,
  price:null,
  pricePerGB:null,
  rawPricePerGB:null,
  _pricing:null,
  _specSource:null,
  _estimated:null
};

function enrich(file){
  const raw = fs.readFileSync(file,'utf8');
  let data;
  try { data = JSON.parse(raw); } catch(e){
    console.error('SKIP (parse fail):', file, e.message);
    return; }
  if(!Array.isArray(data)){ console.error('SKIP (not array):', file); return; }
  let changed = false;
  for(const item of data){
    for(const k of Object.keys(FIELDS)){
      if(!(k in item)) { item[k] = FIELDS[k]; changed = true; }
    }
  }
  if(changed){
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, file);
    console.log('Updated', file);
  } else {
    console.log('No changes for', file);
  }
}

FILES.forEach(enrich);
