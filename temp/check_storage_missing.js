const fs=require('fs');
const p='pc-part-dataset/processed/storage.json';
const data=JSON.parse(fs.readFileSync(p,'utf8'));
const fields=['type','size','interface','form','rpm','read','write','nand','dram','cache','pricePerGB'];
const miss=Object.fromEntries(fields.map(f=>[f,0]));
for(const it of data){
  for(const f of fields){ if(it[f]===undefined||it[f]===null||it[f]==='') miss[f]++; }
}
console.log('Storage count', data.length);
console.log('Missing per field', miss);
