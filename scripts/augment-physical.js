// Fill generic dimensions & weight for storage devices when missing.
// Mark _specSource append tag ' +generic-phys' if applied.
const fs=require('fs');
const path=require('path');
const FILES=[
  path.join(__dirname,'..','pc-part-dataset','processed','storage.json'),
  path.join(__dirname,'..','docs','pc-part-dataset','processed','storage.json')
];
function apply(file){
  let data;try{data=JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){console.error('Parse fail',file);return;}
  let changed=0;
  for(const item of data){
    if(item.dimensions==null){
      if(/M\.2/i.test(item.form)||/M\.2/.test(item.form)) item.dimensions='80 x 22 x 2.3 mm';
      else if(/2\.5/.test(item.form)||item.form==='2.5"') item.dimensions='100 x 70 x 7 mm';
      else if(/3\.5/.test(item.form)||item.form==='3.5"') item.dimensions='147 x 101.6 x 26.1 mm';
      else if(/External/i.test(item.type)||/External/.test(item.form||'')) item.dimensions='(external variable)';
      if(item.dimensions) changed++;
    }
    if(item.weight==null){
      if(/M\.2/.test(item.form)) item.weight=8; // grams
      else if(/2\.5/.test(item.form)) item.weight=50;
      else if(/3\.5/.test(item.form)) item.weight=650;
      else if(/External/i.test(item.type)) item.weight=100; // placeholder
      if(item.weight!=null) changed++;
    }
    if(changed && item.dimensions && item.weight && (!item._specSource || item._specSource.startsWith('heuristic'))){
      item._specSource = (item._specSource||'heuristic') + '+generic-phys';
    }
  }
  if(changed){ fs.writeFileSync(file, JSON.stringify(data)); }
  console.log('augment-physical',path.basename(file),'changes',changed);
}
FILES.forEach(apply);
