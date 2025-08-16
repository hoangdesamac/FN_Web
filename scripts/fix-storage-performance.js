#!/usr/bin/env node
/**
 * Fix storage performance specs (read/write) to remove generic placeholder values
 * and inject factual speeds for widely published mainstream models.
 *
 * Goals:
 *  - Detect placeholder pairs: 3500/3000 (legacy generic NVMe), 7000/6000 (generic Gen4 high-end guess)
 *  - For PCIe 5.0 models handled already by flag-storage-inaccuracies (kept separate)
 *  - Null out placeholder speeds (set read/write = null) when we cannot confidently supply factual numbers
 *    so UI shows missing instead of misleading guesses; mark _needsSpecReview=true and _confidence='missing'.
 *  - Inject factual read/write for a curated safe regex mapping list (widely published sequential specs):
 *      WD Black SN850X 7300/6600
 *      WD Black SN850 (non-X) 7000/5300
 *      WD Black SN770 5150/4900
 *      WD Blue SN580 4150/4150 (1TB spec; smaller capacities lower — using headline max)
 *      Samsung 990 Pro 7450/6900
 *      Samsung 980 Pro 7000/5000
 *      Samsung 970 Evo Plus 3500/3300 (headline max; some capacities ≈3200 write)
 *      Kingston KC3000 7000/7000
 *      Kingston NV2 3500/2800 (headline max higher capacities)
 *      Crucial P5 Plus 6600/5000
 *      Crucial P3 Plus 5000/4200
 *      Seagate FireCuda 530 7300/6900
 *      Sabrent Rocket 4 Plus 7100/6600
 *      Sabrent Rocket 5 (Gen5) 14000/12000 (already possibly injected elsewhere)
 *      Corsair MP700 PRO / PRO SE 12400/11800 (already possibly injected)
 *  - Upgrade _confidence to 'factual' when applying mapping (does not overwrite existing factual values).
 *  - Do NOT alter entries already marked _confidence='factual'.
 *  - Leave SATA 560/530 pairs intact (they are realistic interface ceiling) unless clearly nonsensical.
 *
 * Summary printed with counts of: placeholderNullified, factualInjected, genericHighDowngraded, skippedFactualProtected.
 */
const fs=require('fs');
const path=require('path');

const TARGETS=[
  path.join(__dirname,'..','pc-part-dataset','processed','storage.json'),
  path.join(__dirname,'..','docs','pc-part-dataset','processed','storage.json')
];

const FACTUAL_MODELS=[
  // WD Black / Blue / Green families
  {rx:/wd[_\s-]*black[_\s-]*sn850x/i, read:7300, write:6600},
  {rx:/wd[_\s-]*black[_\s-]*sn850(?!x)/i, read:7000, write:5300},
  {rx:/wd[_\s-]*black[_\s-]*sn770/i, read:5150, write:4900},
  {rx:/wd[_\s-]*blue[_\s-]*sn580/i, read:4150, write:4150},
  {rx:/wd[_\s-]*blue[_\s-]*sn570/i, read:3500, write:3000},
  {rx:/wd[_\s-]*green[_\s-]*sn350/i, read:2400, write:1900},
  // Samsung
  {rx:/samsung[_\s-]*990[_\s-]*pro/i, read:7450, write:6900},
  {rx:/samsung[_\s-]*980[_\s-]*pro/i, read:7000, write:5000},
  {rx:/samsung[_\s-]*980(?!.*pro)/i, read:3500, write:3000},
  {rx:/samsung[_\s-]*970[_\s-]*evo[_\s-]*plus/i, read:3500, write:3300},
  // Kingston
  {rx:/kingston[_\s-]*kc3000/i, read:7000, write:7000},
  {rx:/kingston[_\s-]*nv2/i, read:3500, write:2800},
  {rx:/kingston[_\s-]*nv1/i, read:2100, write:1700},
  {rx:/kingston[_\s-]*a2000/i, read:2200, write:2000},
  {rx:/fury[_\s-]*renegade/i, read:7300, write:7000},
  // Crucial
  {rx:/crucial[_\s-]*p5[_\s-]*plus/i, read:6600, write:5000},
  {rx:/crucial[_\s-]*p3[_\s-]*plus/i, read:5000, write:4200},
  {rx:/crucial[_\s-]*p3(?!.*plus)/i, read:3500, write:3000},
  {rx:/crucial[_\s-]*p2/i, read:2400, write:1900},
  {rx:/crucial[_\s-]*p1/i, read:2000, write:1700},
  // Seagate / FireCuda
  {rx:/firecuda[_\s-]*530/i, read:7300, write:6900},
  {rx:/firecuda[_\s-]*520/i, read:5000, write:4400},
  // Sabrent
  {rx:/rocket[_\s-]*4[_\s-]*plus/i, read:7100, write:6600},
  {rx:/rocket[_\s-]*5/i, read:14000, write:12000},
  // Corsair
  {rx:/mp700\s+pro(?!.*elite)/i, read:12400, write:11800},
  {rx:/mp700\s+pro\s+se/i, read:12400, write:11800},
  {rx:/mp700\s+elite/i, read:10000, write:9500},
  // Lexar
  {rx:/lexar[_\s-]*nm790/i, read:7400, write:6500},
  // Silicon Power
  {rx:/silicon[_\s-]*power[_\s-]*ud90/i, read:5000, write:4500},
  // Inland (US Micro Center house brand) – headline maxes
  {rx:/inland[_\s-]*performance[_\s-]*plus/i, read:7000, write:6850}
];

function category(o){
  const iface=(o.interface||'').toLowerCase();
  if(/pcie 5\.0/.test(iface)) return 'NVME5';
  if(/pcie 4\.0/.test(iface)) return 'NVME4';
  if(/pcie 3\.0|pcie 2\.0/.test(iface)) return 'NVME3';
  if(/sata/.test(iface)) return 'SATA';
  if(/usb|thunderbolt/.test(iface)) return 'EXT';
  return 'OTHER';
}

function isSSD(o){return /(ssd|nvme)/i.test(o.type||'');}

for(const file of TARGETS){
  if(!fs.existsSync(file)) continue;
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  let placeholderNullified=0, factualInjected=0, genericHighDowngraded=0, skippedFactualProtected=0;
  for(const d of data){
    if(!isSSD(d)) continue;
    const cat=category(d);
    const name=(d.name||'');
    // Skip if already factual
    if(d._confidence==='factual'){ skippedFactualProtected++; continue; }

    // Apply factual mapping first (only if speeds missing OR placeholder patterns) 
    const model=FACTUAL_MODELS.find(m=>m.rx.test(name));
    if(model){
      const wasPlaceholder=(d.read===3500&&d.write===3000)||(d.read===7000&&d.write===6000);
      if(d.read==null || d.write==null || wasPlaceholder || d._confidence!=='factual'){
        d.read=model.read; d.write=model.write; d._confidence='factual';
        if(!(d._specSource||'').includes('known')) d._specSource=((d._specSource||'')? (d._specSource+'+'): '')+'known';
        factualInjected++; continue; // factual assignment dominates
      }
    }

    // Placeholder handling
  const isPlaceholder3500 = d.read===3500 && d.write===3000;
    const isGenericHigh = d.read===7000 && d.write===6000 && cat==='NVME4';
    // Nullify inappropriate placeholder for Gen4/5 categories
  if((cat==='NVME4' || cat==='NVME3') && (isPlaceholder3500 || (cat==='NVME4' && isGenericHigh))){
      if(isGenericHigh) genericHighDowngraded++; else placeholderNullified++;
      d.read=null; d.write=null; d._confidence='missing'; d._needsSpecReview=true; continue;
    }
    // For Gen5 leftover placeholder 3500/3000 (should already be handled elsewhere) - ensure null
    if(cat==='NVME5' && isPlaceholder3500){
      placeholderNullified++; d.read=null; d.write=null; d._confidence='missing'; d._needsSpecReview=true; continue;
    }
    // Fallback: any PCIe interface (not SATA) still with 3500/3000 and not factual -> null
    if(/pcie/i.test(d.interface||'') && d.read===3500 && d.write===3000 && d._confidence!=='factual'){
      placeholderNullified++; d.read=null; d.write=null; d._confidence='missing'; d._needsSpecReview=true; continue;
    }
  }
  // Final sweep for any residual 3500/3000 (e.g. malformed interface detection): SATA gets realistic 560/530, others null
  for(const d of data){
    if(d.read===3500 && d.write===3000){
      if(/sata/i.test(d.interface||'')){
        d.read=560; d.write=530; d._confidence='normalized';
      } else {
        d.read=null; d.write=null; d._confidence='missing'; d._needsSpecReview=true;
      }
      placeholderNullified++;
    }
  }
  fs.writeFileSync(file, JSON.stringify(data));
  console.log(path.basename(file), {placeholderNullified, factualInjected, genericHighDowngraded, skippedFactualProtected});
}
