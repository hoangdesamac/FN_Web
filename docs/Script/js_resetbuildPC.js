// PC Builder Logic + load header/footer
async function loadPagePart(url, containerId, callback = null) {
    try {
        const res = await fetch(url);
        const html = await res.text();
        document.getElementById(containerId).innerHTML = html;
        if (callback) callback();
    } catch (e) { console.error('Load part error:', e); }
}

// ===== Data Sets (sample, can extend) =====
const PART_CATEGORIES = [
    { key:'cpu', label:'CPU' },
    { key:'mainboard', label:'Mainboard' },
    { key:'ram', label:'RAM' },
    { key:'gpu', label:'GPU' },
    { key:'storage', label:'Lưu trữ' },
    { key:'psu', label:'Nguồn' },
    { key:'case', label:'Case' },
    { key:'cooler', label:'Tản nhiệt' },
    { key:'monitor', label:'Màn hình' }
];

// Minimal structured parts
const PART_LIBRARY = {
    cpu: [
        { id:'cpu_7900x', name:'AMD Ryzen 9 7900X', price:8990000, socket:'AM5', tdp:170, cores:12 },
        { id:'cpu_7800x3d', name:'AMD Ryzen 7 7800X3D', price:9990000, socket:'AM5', tdp:120, cores:8, tag:'Gaming+' },
        { id:'cpu_i7_14700k', name:'Intel Core i7-14700K', price:11690000, socket:'LGA1700', tdp:125, cores:20 },
    ],
    mainboard: [
        { id:'mb_b650', name:'MSI B650 Tomahawk WIFI', price:4790000, socket:'AM5', chipset:'B650', form:'ATX' },
        { id:'mb_x670', name:'ASUS ROG Strix X670E-E', price:11990000, socket:'AM5', chipset:'X670E', form:'ATX' },
        { id:'mb_z790', name:'Gigabyte Z790 Aorus Elite AX', price:6990000, socket:'LGA1700', chipset:'Z790', form:'ATX' },
    ],
    ram: [
        { id:'ram_ddr5_32_6000', name:'DDR5 32GB (2x16) 6000MHz CL32', price:2590000, type:'DDR5', size:32, sticks:2, speed:6000 },
        { id:'ram_ddr5_64_6000', name:'DDR5 64GB (2x32) 6000MHz CL34', price:4790000, type:'DDR5', size:64, sticks:2, speed:6000 },
    ],
    gpu: [
        { id:'gpu_4070', name:'RTX 4070 12GB', price:13490000, power:200, vram:12 },
        { id:'gpu_4070s', name:'RTX 4070 SUPER 12GB', price:15490000, power:220, vram:12 },
        { id:'gpu_4080', name:'RTX 4080 16GB', price:25990000, power:285, vram:16 },
    ],
    storage: [
        { id:'nvme_1tb_gen4', name:'SSD NVMe 1TB Gen4', price:1590000, type:'NVMe', size:1000 },
        { id:'nvme_2tb_gen4', name:'SSD NVMe 2TB Gen4', price:2890000, type:'NVMe', size:2000 },
        { id:'hdd_2tb', name:'HDD 3.5" 2TB 7200RPM', price:1490000, type:'HDD', size:2000 },
    ],
    psu: [
        { id:'psu_750_gold', name:'PSU 750W 80+ Gold', price:1990000, watt:750 },
        { id:'psu_850_gold', name:'PSU 850W 80+ Gold', price:2490000, watt:850 },
        { id:'psu_1000_plat', name:'PSU 1000W 80+ Platinum', price:3890000, watt:1000 },
    ],
    case: [
        { id:'case_mesh', name:'Mid Tower Mesh RGB', price:1590000, type:'Mid' },
        { id:'case_airflow', name:'Airflow ARGB ATX', price:1890000, type:'Mid' },
    ],
    cooler: [
        { id:'cooler_360_aio', name:'AIO 360mm ARGB', price:2890000, type:'AIO360', tdp:250 },
        { id:'cooler_air_tower', name:'Air Tower Dual Fan', price:1190000, type:'Air', tdp:200 },
    ],
    monitor: [
        { id:'monitor_2k_165', name:'27" 2K 165Hz IPS', price:5390000, hz:165, res:'2560x1440' },
        { id:'monitor_4k_160', name:'27" 4K 160Hz MiniLED', price:14990000, hz:160, res:'3840x2160' },
    ]
};

const state = { selected: {}, total:0, power:0 };

function formatPrice(v){ return v.toLocaleString('vi-VN') + '₫'; }

function buildCategoryList(){
    const ul = document.getElementById('category-list');
    ul.innerHTML = '';
    PART_CATEGORIES.forEach(c => {
        const li = document.createElement('li');
        li.dataset.key = c.key;
        li.innerHTML = `<span>${c.label}</span><span class="count" id="count-${c.key}">0</span>`;
        li.addEventListener('click',()=> openPartModal(c.key));
        ul.appendChild(li);
    });
}

function buildConfigRows(){
    const tbody = document.getElementById('config-rows');
    tbody.innerHTML = '';
    PART_CATEGORIES.forEach(c => {
        const tr = document.createElement('tr');
        tr.id = 'row-' + c.key;
        tr.innerHTML = `
            <td style="width:140px;font-weight:600;">${c.label}</td>
            <td class="part-cell" id="cell-${c.key}">
                <button class="part-select-btn" data-key="${c.key}"><i class="fa fa-plus"></i> Chọn ${c.label}</button>
            </td>
            <td id="price-${c.key}">-</td>
            <td id="act-${c.key}"></td>`;
        tbody.appendChild(tr);
    });
    tbody.querySelectorAll('.part-select-btn').forEach(btn=> btn.addEventListener('click',()=> openPartModal(btn.dataset.key)));
}

function openPartModal(category){
    const modal = document.getElementById('part-modal');
    document.getElementById('modal-title').textContent = 'Chọn ' + (PART_CATEGORIES.find(c=>c.key===category)?.label||category);
    modal.dataset.category = category;
    const grid = document.getElementById('parts-grid');
    grid.innerHTML = '';
    (PART_LIBRARY[category]||[]).forEach(p => {
        const div = document.createElement('div');
        div.className='part-card';
        div.innerHTML = `
            <h4>${p.name}</h4>
            <div class="part-meta">${ buildMeta(p) }</div>
            <div class="part-price">${formatPrice(p.price)}</div>`;
        div.addEventListener('click',()=> { selectPart(category,p); closeModal(); });
        grid.appendChild(div);
    });
    modal.style.display='flex';
}

function buildMeta(p){
    const meta = [];
    if (p.socket) meta.push('Socket ' + p.socket);
    if (p.chipset) meta.push(p.chipset);
    if (p.tdp) meta.push(p.tdp + 'W');
    if (p.power) meta.push(p.power + 'W');
    if (p.size && p.type==='DDR5') meta.push(p.size + 'GB');
    if (p.speed) meta.push(p.speed + 'MHz');
    if (p.vram) meta.push(p.vram + 'GB VRAM');
    if (p.watt) meta.push(p.watt + 'W');
    if (p.res) meta.push(p.res + '@' + p.hz + 'Hz');
    return meta.join(' • ');
}

function selectPart(category, part){
    state.selected[category] = part;
    renderSelected(category);
    recalcTotals();
    updateSummary();
    saveToLocal();
}

function removePart(category){
    delete state.selected[category];
    renderSelected(category);
    recalcTotals();
    updateSummary();
    saveToLocal();
}

function renderSelected(category){
    const cell = document.getElementById('cell-'+category);
    const priceCell = document.getElementById('price-'+category);
    const actCell = document.getElementById('act-'+category);
    const countSpan = document.getElementById('count-'+category);
    const part = state.selected[category];
    if (!part){
        cell.innerHTML = `<button class="part-select-btn" data-key="${category}"><i class="fa fa-plus"></i> Chọn ${(PART_CATEGORIES.find(c=>c.key===category)||{}).label||category}</button>`;
        priceCell.textContent='-';
        actCell.innerHTML='';
        countSpan.textContent='0';
        cell.querySelector('button').addEventListener('click',()=> openPartModal(category));
        return;
    }
    countSpan.textContent='1';
    cell.innerHTML = `<div class="selected-part"><div class="name">${part.name}</div><div class="meta">${buildMeta(part)}</div></div>`;
    priceCell.textContent = formatPrice(part.price);
    actCell.innerHTML = `<button class="remove-part-btn" title="Xóa" aria-label="Xóa" onclick="removePart('${category}')">×</button>`;
}

function recalcTotals(){
    let total=0, power=0;
    Object.values(state.selected).forEach(p=> { total += p.price||0; power += (p.tdp||p.power||0); });
    state.total = total; state.power = power;
    document.getElementById('total-price').textContent = formatPrice(total);
    document.getElementById('total-power').textContent = power + 'W';
    compatibilityCheck();
}

function compatibilityCheck(){
    const cpu = state.selected.cpu; const mb = state.selected.mainboard; const ram = state.selected.ram; const psu = state.selected.psu; const gpu = state.selected.gpu;
    const box = document.getElementById('compat-status');
    const warnBox = document.getElementById('warning-box');
    warnBox.style.display='none'; warnBox.innerHTML='';
    let problems = [];
    if (cpu && mb && cpu.socket !== mb.socket) problems.push('CPU & Mainboard khác socket');
    if (ram && mb && ram.type && ram.type !== 'DDR5') problems.push('Chỉ ví dụ DDR5');
    if (psu && state.power && psu.watt < state.power * 1.5) problems.push('Nguồn có thể thiếu công suất (khuyến nghị >150%)');
    if (gpu && mb && mb.form === 'ITX' && gpu.power > 250) problems.push('GPU quá lớn cho ITX (ví dụ)');
    if (problems.length){
        box.className='compatibility-status error';
        box.textContent='Không tương thích';
        warnBox.style.display='block';
        warnBox.innerHTML = '<strong>Vấn đề:</strong><br>' + problems.map(p=> '• '+p).join('<br>');
    } else if (cpu && mb){
        box.className='compatibility-status ok';
        box.textContent='Tương thích';
    } else {
        box.className='compatibility-status warn';
        box.textContent='Chọn thêm linh kiện';
    }
}

function updateSummary(){
    const list = document.getElementById('summary-list');
    list.innerHTML='';
    Object.keys(state.selected).forEach(k => {
        const p = state.selected[k];
        const div = document.createElement('div');
        div.className='summary-item';
        div.innerHTML = `<div class="label">${(PART_CATEGORIES.find(c=>c.key===k)||{}).label||k}</div><div class="value">${p.name}</div>`;
        list.appendChild(div);
    });
    buildRecommendation();
}

function buildRecommendation(){
    const box = document.getElementById('recommend-box');
    const cpu = state.selected.cpu; const gpu = state.selected.gpu; const ram = state.selected.ram;
    let txt = '';
    if (cpu && gpu){
        if (cpu.cores >=12 && gpu.power >=250) txt += 'Cấu hình mạnh cho Streaming / 4K Gaming.<br>';
        else if (gpu.power <=200) txt += 'Phù hợp chơi game eSports & làm việc văn phòng.<br>';
    }
    if (ram && ram.size >=64) txt += 'Đa nhiệm & content creation nặng.<br>';
    if (!txt) txt='Chọn thêm linh kiện để nhận gợi ý.';
    box.innerHTML = '<strong>Gợi ý:</strong><br>'+txt;
}

// Persistence
function saveToLocal(){ localStorage.setItem('pcBuilderConfig', JSON.stringify(state.selected)); }
function loadFromLocal(){
    try { const saved = JSON.parse(localStorage.getItem('pcBuilderConfig')||'{}');
        Object.keys(saved).forEach(k => state.selected[k]=saved[k]);
    } catch(e){}
}

function clearConfig(){ state.selected={}; buildConfigRows(); Object.keys(PART_CATEGORIES).forEach(()=>{}); recalcTotals(); updateSummary(); saveToLocal(); }

function exportJSON(){
    const data = JSON.stringify({ parts: state.selected, total: state.total, power: state.power }, null, 2);
    const blob = new Blob([data], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download='pc_config.json'; a.click();
}

function closeModal(){ document.getElementById('part-modal').style.display='none'; }

function initBuilder(){
    buildCategoryList();
    buildConfigRows();
    loadFromLocal();
    Object.keys(state.selected).forEach(k=> renderSelected(k));
    recalcTotals(); updateSummary();
    document.getElementById('close-modal').addEventListener('click', closeModal);
    document.getElementById('part-modal').addEventListener('click', e=> { if (e.target.id==='part-modal') closeModal(); });
    document.getElementById('clear-config').addEventListener('click', clearConfig);
    document.getElementById('export-json').addEventListener('click', exportJSON);
    document.getElementById('save-config').addEventListener('click', saveToLocal);
    document.getElementById('load-config').addEventListener('click', ()=> { loadFromLocal(); Object.keys(state.selected).forEach(k=> renderSelected(k)); recalcTotals(); updateSummary(); });
}

document.addEventListener('DOMContentLoaded', ()=> {
    loadPagePart('HTML/Layout/resetheader.html','header-container', ()=> { if (typeof initHeader==='function') initHeader(); });
    loadPagePart('HTML/Layout/resetfooter.html','footer-container');
    initBuilder();
});
