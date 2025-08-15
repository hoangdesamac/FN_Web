// Advanced Puppeteer scraper for pcpartpicker CPU list with pagination.
// Usage:
//  npm run scrape:cpu             -> first page only (fast)
//  npm run scrape:cpu:full        -> crawl all pages (listing data)
//  node scripts/scrape-cpu.js full:details -> crawl all pages + vào từng trang CPU lấy socket (chậm hơn)
// Output JSON: temp/cpu_pcpartpicker.json (fields: name, cores, baseClock, boostClock, microarch, tdp, igpu, rating, priceUSD, socket?)
// NOTE: Site protected by Cloudflare; script waits automatically. Excessive requests may trigger blocks.

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const MODE_ARG = process.argv[2] || '';
const FULL = MODE_ARG.startsWith('full');
const WITH_DETAILS = MODE_ARG === 'full:details';
const BASE_URL = 'https://pcpartpicker.com/products';

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function ensureReady(page){
  const start=Date.now();
  const maxWait=45000;
  while(Date.now()-start < maxWait){
    const challenge = await page.$('form#challenge-form, div#cf-chl-widget, #challenge-stage');
    if(!challenge){
      // check table rows
      const rows = await page.$$eval('table tbody tr', rs=>rs.length);
      if(rows>0) return;
    }
    await sleep(1000);
  }
}

async function extractPage(page){
  return await page.evaluate(()=>{
    function getLink(td){ const a = td.querySelector('a'); return a? a.href: null; }
    const rows=[...document.querySelectorAll('table tbody tr')];
    return rows.map(r=>{
      const cells=[...r.children];
      const c=cells.map(td=>td.innerText.trim());
      const [name, cores, baseClock, boostClock, microarch, tdp, igpu, rating, price] = c;
      const priceUSD = price? parseFloat(price.replace(/[^0-9.]/g,'')) : null;
      const tdpNum = tdp? parseInt(tdp.replace(/[^0-9]/g,''),10): null;
      const link = getLink(cells[0]);
      return { name, cores: cores? parseInt(cores,10): null, baseClock, boostClock, microarch, tdp: tdpNum, igpu, rating, priceUSD, link };
    }).filter(r=> r.name);
  });
}

(async()=>{
  const browser = await puppeteer.launch({headless:'new', args:['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36');
  await page.setViewport({width:1400,height:900});

  const results=[];
  let pageIndex=1;
  let nextUrl=BASE_URL;
  while(nextUrl){
    console.log(`[scrape-cpu] Page ${pageIndex} -> ${nextUrl}`);
    await page.goto(nextUrl,{waitUntil:'domcontentloaded'});
    await ensureReady(page);
    const rows=await extractPage(page);
    console.log(`[scrape-cpu] Extracted ${rows.length} rows`);
    results.push(...rows);
    if(!FULL) break; // only first page in fast mode
    // Find next page link
    const hasNext = await page.$('a.btn.btn-sm.svelte-hpyw8e[rel="next"], a.pagination__next');
    if(hasNext){
      try { nextUrl = await page.$eval('a[rel="next"]', a=>a.href); } catch { nextUrl=null; }
    } else nextUrl=null;
    pageIndex++;
    if(FULL) await sleep(1500 + Math.random()*1000); // polite delay
  }

  // Optionally fetch details (socket) sequentially to reduce block risk
  if(WITH_DETAILS){
    console.log('[scrape-cpu] Fetching detail pages for socket...');
    const detailPage = await browser.newPage();
    await detailPage.setUserAgent(await page.evaluate(()=>navigator.userAgent));
    let processed=0;
    for(const item of results){
      processed++;
      if(!item.link) continue;
      try{
        await detailPage.goto(item.link,{waitUntil:'domcontentloaded', timeout:45000});
        await ensureReady(detailPage);
        const socket = await detailPage.evaluate(()=>{
          // Try find label 'Socket'
            const candidates=[...document.querySelectorAll('tr, li, div')].filter(el=>/socket/i.test(el.textContent));
            for(const el of candidates){
              const text=el.textContent.trim();
              const m=text.match(/Socket\s*:?\s*([A-Za-z0-9-]+)/i);
              if(m) return m[1];
              // Table row pattern: first cell label second value
              if(el.tagName==='TR'){
                const tds=el.querySelectorAll('td,th');
                if(tds.length>=2 && /socket/i.test(tds[0].innerText)) return tds[1].innerText.trim();
              }
            }
            return null;
        });
        if(socket) item.socket=socket;
      }catch(e){ /* ignore */ }
      if(processed % 10 ===0) console.log(`[scrape-cpu] Detail ${processed}/${results.length}`);
      await sleep(700 + Math.random()*500);
    }
  }

  const outDir=path.resolve('temp');
  fs.mkdirSync(outDir,{recursive:true});
  const outFile=path.join(outDir,'cpu_pcpartpicker.json');
  fs.writeFileSync(outFile, JSON.stringify({ scraped:new Date().toISOString(), full:FULL, count:results.length, items:results },null,2));
  console.log('[scrape-cpu] DONE ->', outFile, 'items:', results.length);
  await browser.close();
})();
