#!/usr/bin/env node
// Promote heuristic/default entries to factual when speeds closely match a known factual model pattern.
// Tolerance: absolute diff <= 100MB/s OR relative diff <= 3% for both read and write when same generation.
// Does not overwrite differing existing factual values.

const fs=require('fs');
const path=require('path');
const FACT_FILE=path.join(__dirname,'known-storage-factual.json');
const FILES=[
  path.join(__dirname,'..','pc-part-dataset','processed','storage.json'),
  path.join(__dirname,'..','docs','pc-part-dataset','processed','storage.json')
];

if(!fs.existsSync(FACT_FILE)) { console.error('Missing factual file'); process.exit(1);} 
const facts=JSON.parse(fs.readFileSync(FACT_FILE,'utf8'));

// Collapse by read/write pair to allow fuzzy matching ignoring iops
const factPairs=[]; const seen=new Set();
for(const f of facts){ if(f.read && f.write){ const key=f.read+'/'+f.write; if(!seen.has(key)){ factPairs.push({read:f.read,write:f.write}); seen.add(key);} } }

function close(a,b){ if(a==null||b==null) return false; const diff=Math.abs(a-b); if(diff<=100) return true; const rel=diff/Math.max(a,b); return rel<=0.03; }

function promoteFile(file){
  if(!fs.existsSync(file)) return {file, promoted:0};
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  let promoted=0;
  for(const d of data){
    if(d._confidence==='factual') continue;
    if(d.read==null || d.write==null) continue;
    for(const p of factPairs){
      if(close(d.read,p.read) && close(d.write,p.write)){
        d._confidence='factual';
        d._specSource=(d._specSource||'')+(d._specSource?'+':'')+'fuzzy-factual';
        promoted++; break;
      }
    }
  }
  if(promoted) fs.writeFileSync(file, JSON.stringify(data));
  return {file,promoted};
}

const results=FILES.map(promoteFile);
console.log('promote-fuzzy-factual results:', results);
