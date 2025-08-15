// Stealth CPU scraper using puppeteer-extra & stealth plugin
// Installs: npm i puppeteer-extra puppeteer-extra-plugin-stealth
// Usage: npm run scrape:cpu:stealth

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const MODE_ARG = process.argv[2] || '';
const FULL = MODE_ARG.startsWith('full');
const WITH_DETAILS = MODE_ARG === 'full:details';
const BASE_URL='https://pcpartpicker.com/products/cpu/';

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
async function ensureReady(page){
  const start=Date.now(); const max=90000;
  while(Date.now()-start<max){
    // Detect cloudflare challenge elements
    const challenge = await page.$('form#challenge-form, #cf-chl-widget, #challenge-stage, iframe[src*="challenge"]');
    if(!challenge){
      // Try to locate expected table rows OR product list entries
      const rows = await page.$$eval('table tbody tr', rs=>rs.length).catch(()=>0);
      const altRows = rows===0 ? await page.$$eval('.tr__product, .productRow', rs=>rs.length).catch(()=>0) : 0;
      if(rows>0 || altRows>5) return; // consider ready if we have some rows
    }
    await sleep(1500);
  }
}
async function extractPage(page){
  return await page.evaluate(()=>{
    function link(td){ const a=td.querySelector('a'); return a? a.href:null; }
    const rows=[...document.querySelectorAll('table tbody tr')];
    return rows.map(r=>{
      const tds=[...r.children];
      const vals=tds.map(td=>td.innerText.trim());
      const [name, cores, baseClock, boostClock, microarch, tdp, igpu, rating, price] = vals;
      return {
        name,
        cores: cores? parseInt(cores,10):null,
        baseClock, boostClock, microarch,
        tdp: tdp? parseInt(tdp.replace(/[^0-9]/g,''),10):null,
        igpu, rating,
        priceUSD: price? parseFloat(price.replace(/[^0-9.]/g,'')):null,
        link: link(tds[0])
      };
    }).filter(r=>r.name);
  });
}
(async()=>{
  const browser = await puppeteer.launch({headless:'new', args:["--no-sandbox","--disable-setuid-sandbox","--disable-blink-features=AutomationControlled"]});
  const page = await browser.newPage();
  await page.setViewport({width:1500,height:950});
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36');
  const results=[]; let next=BASE_URL; let idx=1;
  while(next){
    console.log('[stealth] Page', idx, next);
    await page.goto(next,{waitUntil:'networkidle2', timeout:90000}).catch(()=>{});
    await ensureReady(page);
    let rows=await extractPage(page);
    if(rows.length===0){
      // Debug dump
      try{
        const html = await page.content();
        const dumpFile = path.resolve('temp',`cpu_page_${idx}.html`);
        fs.writeFileSync(dumpFile, html.slice(0,500000));
        console.log('[stealth] WARNING: 0 rows extracted. Dump saved to', dumpFile);
        // Retry simple selector fallback: look for generic table rows excluding header
        const alt = await page.$$eval('table tr', trs=>trs.filter(t=>t.querySelector('td')).map(tr=>[...tr.children].map(td=>td.innerText.trim()))).catch(()=>[]);
        if(alt.length>0){
          rows = alt.map(cells=>{
            const [name, cores, baseClock, boostClock, microarch, tdp, igpu, rating, price] = cells;
            return { name, cores: cores? parseInt(cores,10):null, baseClock, boostClock, microarch, tdp: tdp? parseInt(String(tdp).replace(/[^0-9]/g,''),10):null, igpu, rating, priceUSD: price? parseFloat(String(price).replace(/[^0-9.]/g,'')):null };
          }).filter(r=>r.name);
          console.log('[stealth] Fallback extracted rows', rows.length);
        }
      }catch(e){ console.log('[stealth] debug dump failed', e.message); }
    }
    console.log('[stealth] rows', rows.length);
    results.push(...rows);
    if(!FULL) break;
    // detect next
    next = await page.$$eval('a[rel="next"]', as=> as[0]? as[0].href: null).catch(()=>null);
    idx++; await sleep(1500+Math.random()*800);
  }
  if(WITH_DETAILS){
    console.log('[stealth] fetching socket details');
    const detail = await browser.newPage();
    await detail.setUserAgent(await page.evaluate(()=>navigator.userAgent));
    let processed=0;
    for(const item of results){
      processed++; if(!item.link) continue;
      try{
        await detail.goto(item.link,{waitUntil:'domcontentloaded',timeout:60000});
        await ensureReady(detail);
        const socket = await detail.evaluate(()=>{
          const labels=[...document.querySelectorAll('tr, li, div')];
            for(const el of labels){
              const txt=el.textContent||'';
              if(/socket/i.test(txt)){
                const m=txt.match(/Socket\s*:?\s*([A-Za-z0-9-]+)/i);
                if(m) return m[1];
                if(el.tagName==='TR'){
                  const tds=el.querySelectorAll('td,th');
                  if(tds.length>=2 && /socket/i.test(tds[0].innerText)) return tds[1].innerText.trim();
                }
              }
            }
            return null;
        });
        if(socket) item.socket=socket;
      }catch(e){ /* ignore */ }
      if(processed%10===0) console.log('[stealth] detail', processed,'/',results.length);
      await sleep(600+Math.random()*500);
    }
  }
  const outDir=path.resolve('temp'); fs.mkdirSync(outDir,{recursive:true});
  const outFile=path.join(outDir,'cpu_pcpartpicker.json');
  fs.writeFileSync(outFile, JSON.stringify({ scraped:new Date().toISOString(), full:FULL, details:WITH_DETAILS, count:results.length, items:results },null,2));
  console.log('[stealth] Done ->', outFile, 'items', results.length);
  await browser.close();
})();
