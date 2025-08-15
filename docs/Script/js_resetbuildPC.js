// Rebuilt / Enhanced full script
async function loadPagePart(url, containerId, callback = null) {
        try { const res = await fetch(url); const html = await res.text(); document.getElementById(containerId).innerHTML = html; if (callback) callback(); }
        catch(e){ console.error('Load part error:', e); }
}

// ===== Categories (extended) =====
const PART_CATEGORIES = [
    { key:'cpu', label:'CPU' },
    { key:'mainboard', label:'Mainboard' },
    { key:'ram', label:'RAM' },
    { key:'gpu', label:'GPU' },
    { key:'storage', label:'Lưu trữ' },
    { key:'psu', label:'Nguồn' },
    { key:'case', label:'Case' },
    { key:'cooler', label:'Tản nhiệt' },
    { key:'monitor', label:'Màn hình' },
    { key:'keyboard', label:'Bàn phím' },
    { key:'mouse', label:'Chuột' },
    { key:'headphones', label:'Tai nghe' },
    { key:'speakers', label:'Loa' },
    { key:'os', label:'Hệ điều hành' },
    { key:'soundcard', label:'Sound Card' },
    { key:'network', label:'Card mạng' }
];

// Base inline dataset
let PART_LIBRARY = {
    cpu:[ { id:'cpu_7900x', name:'AMD Ryzen 9 7900X', price:8990000, socket:'AM5', tdp:170, cores:12 }, { id:'cpu_7800x3d', name:'AMD Ryzen 7 7800X3D', price:9990000, socket:'AM5', tdp:120, cores:8 }, { id:'cpu_i7_14700k', name:'Intel Core i7-14700K', price:11690000, socket:'LGA1700', tdp:125, cores:20 } ],
    mainboard:[ { id:'mb_b650', name:'MSI B650 Tomahawk WIFI', price:4790000, socket:'AM5', chipset:'B650', form:'ATX' }, { id:'mb_x670', name:'ASUS ROG Strix X670E-E', price:11990000, socket:'AM5', chipset:'X670E', form:'ATX' }, { id:'mb_z790', name:'Gigabyte Z790 Aorus Elite AX', price:6990000, socket:'LGA1700', chipset:'Z790', form:'ATX' } ],
    ram:[ { id:'ram_ddr5_32_6000', name:'DDR5 32GB (2x16) 6000MHz CL32', price:2590000, type:'DDR5', size:32, sticks:2, speed:6000 } ],
    gpu:[ { id:'gpu_4070', name:'RTX 4070 12GB', price:13490000, power:200, vram:12 } ],
    storage:[ { id:'nvme_1tb_gen4', name:'SSD NVMe 1TB Gen4', price:1590000, type:'NVMe', size:1000 } ],
    psu:[ { id:'psu_750_gold', name:'PSU 750W 80+ Gold', price:1990000, watt:750 } ],
    case:[ { id:'case_mesh', name:'Mid Tower Mesh RGB', price:1590000, type:'Mid' } ],
    cooler:[ { id:'cooler_360_aio', name:'AIO 360mm ARGB', price:2890000, type:'AIO360', tdp:250 } ],
    monitor:[ { id:'monitor_2k_165', name:'27" 2K 165Hz IPS', price:5390000, hz:165, res:'2560x1440' } ]
};

// Precompute simple search index to avoid repeated toLowerCase operations when filtering
function indexItem(cat, it){
    const fields=[it.name,it.socket,it.type,it.chipset,it.form,it.res,it.aspect,it.panel];
    if(it.vram) fields.push(it.vram+'gb');
    if(it.size && it.type) fields.push(it.size+'gb');
    it._search = fields.filter(Boolean).map(s=>String(s).toLowerCase()).join(' ');
    return it;
}
Object.keys(PART_LIBRARY).forEach(cat=>{ PART_LIBRARY[cat] = PART_LIBRARY[cat].map(it=> indexItem(cat,it)); });

const state = { selected:{}, total:0, power:0, loadedExternal:false };
// Format price: show 'Liên hệ' when price missing/zero
function formatPrice(v){ if(v===undefined||v===null||v<=0) return 'Liên hệ'; return v.toLocaleString('vi-VN') + '₫'; }

// ===== Modal pagination settings =====
const MODAL_PAGE_SIZE = 400; // số lượng tải mỗi lần
let currentModalLimit = MODAL_PAGE_SIZE; // giới hạn hiện tại
let DATA_MANIFEST = null; // manifest dữ liệu processed

function buildCategoryList(){
    const ul=document.getElementById('category-list');
    ul.innerHTML='';
    PART_CATEGORIES.forEach(c=>{
        const li=document.createElement('li');
        li.dataset.key=c.key;
        const count = DATA_MANIFEST?.counts?.[c.key] ?? 0;
        li.innerHTML=`<span>${c.label}</span><span class="count" id="count-${c.key}">${count}</span>`;
        li.addEventListener('click',()=> openPartModal(c.key));
        ul.appendChild(li);
    });
}

function updateCategoryCount(cat){
    const el=document.getElementById('count-'+cat);
    if(!el) return;
    const loaded=(PART_LIBRARY[cat]||[]).length;
    // If manifest knows bigger total, show loaded/total else just loaded
    const total = DATA_MANIFEST?.counts?.[cat];
    if(total && total>loaded) el.textContent = loaded + '/' + total;
    else el.textContent = loaded;
}
function buildConfigRows(){ const tbody=document.getElementById('config-rows'); tbody.innerHTML=''; PART_CATEGORIES.forEach(c=>{ const tr=document.createElement('tr'); tr.id='row-'+c.key; tr.innerHTML=`<td style="width:140px;font-weight:600;">${c.label}</td><td class="part-cell" id="cell-${c.key}"><button class="part-select-btn" data-key="${c.key}"><i class="fa fa-plus"></i> Chọn ${c.label}</button></td><td id="price-${c.key}">-</td><td id="act-${c.key}"></td>`; tbody.appendChild(tr); }); tbody.querySelectorAll('.part-select-btn').forEach(btn=> btn.addEventListener('click',()=> openPartModal(btn.dataset.key))); }

function buildMeta(p){ const meta=[]; if(p.socket)meta.push('Socket '+p.socket); if(p.chipset)meta.push(p.chipset); if(p.tdp)meta.push(p.tdp+'W'); if(p.power)meta.push(p.power+'W'); if(p.size && p.type)meta.push(p.size+'GB'); if(p.speed)meta.push(p.speed+'MHz'); if(p.vram)meta.push(p.vram+'GB VRAM'); if(p.watt)meta.push(p.watt+'W'); if(p.res)meta.push(p.res+(p.hz?('@'+p.hz+'Hz'):'')); if(p._estimated) meta.push('ước tính'); return meta.join(' • '); }

function buildFacetOptions(category){
    const sel=document.getElementById('part-filter-socket');
    if(!sel) return;
    // Determine facet key per category
    const mapKey = {
        cpu:'socket',
        mainboard:'socket',
        ram:'type',
        gpu:'vram',
        storage:'type',
        psu:'efficiency',
        monitor:'res'
    };
    const key = mapKey[category];
    if(!key){ sel.classList.add('hidden'); sel.innerHTML=''; return; }
    const list = PART_LIBRARY[category]||[];
    const values = new Set();
    list.forEach(it=>{ const v = it[key]; if(v!==undefined && v!=='' && v!==null) values.add(String(v)); });
    if(values.size <= 1){ sel.classList.add('hidden'); sel.innerHTML=''; return; }
    const labelMap={ socket:'Socket', type:'Loại', vram:'VRAM', efficiency:'Chuẩn hiệu suất', res:'Độ phân giải' };
    sel.classList.remove('hidden');
    sel.innerHTML = `<option value="">${labelMap[key]}: Tất cả</option>` + Array.from(values).sort((a,b)=> a.localeCompare(b, 'vi', {numeric:true})).map(v=>`<option value="${v}">${v}</option>`).join('');
    sel.dataset.facetKey = key; // store which field we're filtering on
}
function openPartModal(category){
    const modal=document.getElementById('part-modal');
    document.getElementById('modal-title').textContent='Chọn '+(PART_CATEGORIES.find(c=>c.key===category)?.label||category);
    modal.dataset.category=category;
    currentModalLimit = MODAL_PAGE_SIZE; // reset mỗi lần mở
    buildFacetOptions(category);
    renderPartModalList();
    modal.style.display='flex';
}
function renderPartModalList(){
    const modal=document.getElementById('part-modal');
    const category=modal.dataset.category;
    const grid=document.getElementById('parts-grid');
    const q=(document.getElementById('part-search').value||'').toLowerCase();
    const facetSelect=document.getElementById('part-filter-socket');
    const facetKey=facetSelect?.dataset?.facetKey;
    const facetValue = facetSelect && !facetSelect.classList.contains('hidden') ? facetSelect.value : '';
    grid.innerHTML='';
    let list=PART_LIBRARY[category]||[];
    if(q){ list=list.filter(p=> p._search && p._search.includes(q)); }
    if(facetValue && facetKey){ list=list.filter(p=> String(p[facetKey])===facetValue); }
    // Tăng giới hạn nếu người dùng đã bấm tải thêm
    const end = Math.min(currentModalLimit, list.length);
    list.slice(0,end).forEach(p=>{
        const div=document.createElement('div');
        div.className='part-card';
        if(!p.price||p.price<=0) div.classList.add('no-price');
        div.innerHTML=`<h4>${p.name}</h4><div class="part-meta">${buildMeta(p)}</div><div class="part-price">${formatPrice(p.price)}</div>`;
        div.addEventListener('click',()=>{ selectPart(category,p); closeModal(); });
        grid.appendChild(div);
    });
    if(list.length > end){
        const more=document.createElement('div');
        more.className='part-card more-note';
        more.style.cursor='pointer';
        more.textContent=`Hiển thị ${end}/${list.length} kết quả. Nhấn để tải thêm...`;
        more.addEventListener('click', ()=> { currentModalLimit += MODAL_PAGE_SIZE; renderPartModalList(); });
        grid.appendChild(more);
    }
    // (Đã ước tính giá cho mọi sản phẩm => không cần ghi chú ẩn giá 0)
}

function selectPart(category,part){ state.selected[category]=part; renderSelected(category); recalcTotals(); updateSummary(); saveToLocal(); }
function removePart(category){ delete state.selected[category]; renderSelected(category); recalcTotals(); updateSummary(); saveToLocal(); }
function renderSelected(category){
    const cell=document.getElementById('cell-'+category);
    const priceCell=document.getElementById('price-'+category);
    const actCell=document.getElementById('act-'+category);
    const part=state.selected[category];
    if(!cell) return;
    if(!part){
        cell.innerHTML=`<button class="part-select-btn" data-key="${category}"><i class="fa fa-plus"></i> Chọn ${(PART_CATEGORIES.find(c=>c.key===category)||{}).label||category}</button>`;
        priceCell.textContent='-';
        actCell.innerHTML='';
        cell.querySelector('button').addEventListener('click',()=> openPartModal(category));
    } else {
        cell.innerHTML=`<div class="selected-part"><div class="name">${part.name}</div><div class="meta">${buildMeta(part)}</div></div>`;
        priceCell.textContent=formatPrice(part.price);
        actCell.innerHTML=`<button class="remove-part-btn" onclick="removePart('${category}')">×</button>`;
    }
    // Update category list item visual state (without altering the count which reflects dataset size)
    const li=document.querySelector(`.builder-categories li[data-key="${category}"]`);
    if(li){ if(part) li.classList.add('has-selected'); else li.classList.remove('has-selected'); }
    updateCategoryCount(category);
}

function recalcTotals(){ let total=0,power=0; Object.values(state.selected).forEach(p=>{ total+=p.price||0; power+=(p.tdp||p.power||0); }); state.total=total; state.power=power; document.getElementById('total-price').textContent=formatPrice(total); document.getElementById('total-power').textContent=power+'W'; compatibilityCheck(); }
function compatibilityCheck(){ const cpu=state.selected.cpu, mb=state.selected.mainboard, ram=state.selected.ram, psu=state.selected.psu, gpu=state.selected.gpu; const box=document.getElementById('compat-status'); const warnBox=document.getElementById('warning-box'); warnBox.style.display='none'; warnBox.innerHTML=''; const problems=[]; if(cpu&&mb&&cpu.socket&&mb.socket&&cpu.socket!==mb.socket) problems.push('CPU & Mainboard khác socket'); if(ram&&mb&&ram.type&&mb.chipset && ram.type.startsWith('DDR5') && mb.chipset.match(/b550|x570/i)) problems.push('RAM DDR5 không chạy trên chipset AM4'); if(psu && state.power && psu.watt < state.power * 1.4) problems.push('Nguồn có thể thiếu (khuyến nghị >140%)'); if(problems.length){ box.className='compatibility-status error'; box.textContent='Không tương thích'; warnBox.style.display='block'; warnBox.innerHTML='<strong>Vấn đề:</strong><br>'+problems.map(p=>'• '+p).join('<br>'); } else if(cpu && mb){ box.className='compatibility-status ok'; box.textContent='Tương thích'; } else { box.className='compatibility-status warn'; box.textContent='Chọn thêm linh kiện'; } }
function updateSummary(){ const list=document.getElementById('summary-list'); list.innerHTML=''; Object.keys(state.selected).forEach(k=>{ const p=state.selected[k]; const div=document.createElement('div'); div.className='summary-item'; div.innerHTML=`<div class="label">${(PART_CATEGORIES.find(c=>c.key===k)||{}).label||k}</div><div class="value">${p.name}</div>`; list.appendChild(div); }); buildRecommendation(); }
function buildRecommendation(){ const box=document.getElementById('recommend-box'); const cpu=state.selected.cpu, gpu=state.selected.gpu, ram=state.selected.ram; let txt=''; if(cpu&&gpu){ if((cpu.cores||0)>=12 && (gpu.power||0)>=250) txt+='Cấu hình mạnh cho Streaming / 4K Gaming.<br>'; else if((gpu.power||0)<=200) txt+='Phù hợp chơi game eSports / văn phòng.<br>'; } if(ram && (ram.size||0)>=64) txt+='Đa nhiệm nặng & dựng video.<br>'; if(!txt) txt='Chọn thêm linh kiện để nhận gợi ý.'; box.innerHTML='<strong>Gợi ý:</strong><br>'+txt; }

function saveToLocal(){ localStorage.setItem('pcBuilderConfig', JSON.stringify(state.selected)); }
function loadFromLocal(){ try{ const saved=JSON.parse(localStorage.getItem('pcBuilderConfig')||'{}'); Object.keys(saved).forEach(k=> state.selected[k]=saved[k]); }catch(e){} }
function clearConfig(){ state.selected={}; buildConfigRows(); recalcTotals(); updateSummary(); saveToLocal(); }
function exportJSON(){ const data=JSON.stringify({ parts:state.selected, total:state.total, power:state.power },null,2); const blob=new Blob([data],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='pc_config.json'; a.click(); }
function closeModal(){ document.getElementById('part-modal').style.display='none'; }

// ===== Processed dataset (lazy) =====
const DATA_BASES=[ '../pc-part-dataset/processed', 'pc-part-dataset/processed', '../../pc-part-dataset/processed' ];
async function fetchDataFile(relative){ for(const base of DATA_BASES){ const url=base + '/' + relative.replace(/^\//,''); try{ const res=await fetch(url); if(res.ok) return res; }catch{} } return null; }
const loadedCats=new Set();
async function ensureCategory(cat){
    if(loadedCats.has(cat)) return;
    const res=await fetchDataFile(cat + '.json');
    if(!res){ loadedCats.add(cat); updateCategoryCount(cat); return; }
    try{
        const arr=await res.json();
        if(Array.isArray(arr)){
            if(!PART_LIBRARY[cat]) PART_LIBRARY[cat]=[];
            const existing=new Set(PART_LIBRARY[cat].map(p=>p.id));
            let added=0;
            arr.forEach(it=>{ if(!it.id) it.id=cat+'_'+Math.random().toString(36).slice(2); if(existing.has(it.id)) return; indexItem(cat,it); PART_LIBRARY[cat].push(it); existing.add(it.id); added++; });
            if(added) console.log('[PC BUILDER] Loaded', added, cat);
        }
    }catch(e){ console.warn('Processed parse fail', cat, e); }
    loadedCats.add(cat);
    updateCategoryCount(cat);
}
async function preloadCore(){ ['cpu','mainboard','ram','gpu'].forEach(c=> ensureCategory(c)); }
// wrap openPartModal to ensure load
const _origOpenPartModal = openPartModal;
openPartModal = async function(category){ await ensureCategory(category); _origOpenPartModal(category); };

async function initProcessed(){
    // Try load manifest for counts
    try{
        const res=await fetchDataFile('manifest.json');
        if(res){ DATA_MANIFEST=await res.json(); }
    }catch{}
    buildCategoryList();
    buildConfigRows();
    preloadCore();
    loadFromLocal();
    Object.keys(state.selected).forEach(k=> renderSelected(k));
    recalcTotals();
    updateSummary();
    const search=document.getElementById('part-search');
    if(search){
        let t=null; search.addEventListener('input', ()=>{ clearTimeout(t); t=setTimeout(()=>{ currentModalLimit = MODAL_PAGE_SIZE; renderPartModalList(); },250); });
    }
    const facet=document.getElementById('part-filter-socket');
    if(facet){ facet.addEventListener('change', ()=>{ currentModalLimit = MODAL_PAGE_SIZE; renderPartModalList(); }); }
    document.getElementById('close-modal')?.addEventListener('click', closeModal);
    document.getElementById('part-modal')?.addEventListener('click', e=>{ if(e.target.id==='part-modal') closeModal(); });
    document.getElementById('clear-config')?.addEventListener('click', clearConfig);
    document.getElementById('export-json')?.addEventListener('click', exportJSON);
    document.getElementById('save-config')?.addEventListener('click', saveToLocal);
    document.getElementById('load-config')?.addEventListener('click', ()=>{ loadFromLocal(); Object.keys(state.selected).forEach(k=> renderSelected(k)); recalcTotals(); updateSummary(); });
}

document.addEventListener('DOMContentLoaded', ()=>{ loadPagePart('HTML/Layout/resetheader.html','header-container', ()=>{ if(typeof initHeader==='function') initHeader(); }); loadPagePart('HTML/Layout/resetfooter.html','footer-container'); initProcessed(); });
