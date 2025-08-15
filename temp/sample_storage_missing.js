const fs=require('fs');
const data=JSON.parse(fs.readFileSync('pc-part-dataset/processed/storage.json','utf8'));
function sample(field,limit=20){return data.filter(it=>!it[field]).slice(0,limit).map(x=>x.name);} 
console.log('MISSING_READ_SAMPLE', sample('read').join('\n'));
console.log('---');
console.log('MISSING_NAND_SAMPLE', sample('nand').join('\n'));
console.log('---');
console.log('MISSING_DRAM_SAMPLE', sample('dram').join('\n'));
