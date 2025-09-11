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
    { key:'storage', label:'Ổ cứng' },
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
    storage:[
        { id:'ssd_nvme_sn770_1tb', name:'WD Black SN770 1TB NVMe Gen4', price:1590000, type:'NVMe', interface:'PCIe 4.0 x4', size:1000, read:5150, write:4900, nand:'TLC', dram:'HMB' },
        { id:'ssd_nvme_980pro_1tb', name:'Samsung 980 PRO 1TB NVMe Gen4', price:1990000, type:'NVMe', interface:'PCIe 4.0 x4', size:1000, read:7000, write:5000, nand:'TLC', dram:'Yes' },
        { id:'ssd_sata_870evo_1tb', name:'Samsung 870 EVO 1TB SATA', price:1690000, type:'SATA SSD', interface:'SATA III', size:1000, read:560, write:530, nand:'TLC', dram:'Yes' },
        { id:'hdd_wd_blue_1tb', name:'WD Blue 1TB HDD 7200rpm', price:1050000, type:'HDD', interface:'SATA III', size:1000, rpm:7200, cache:64 },
        { id:'hdd_seagate_barracuda_2tb', name:'Seagate Barracuda 2TB HDD 7200rpm', price:1390000, type:'HDD', interface:'SATA III', size:2000, rpm:7200, cache:256 }
    ],
    psu:[ { id:'psu_750_gold', name:'PSU 750W 80+ Gold', price:1990000, watt:750 } ],
    case:[ { id:'case_mesh', name:'Mid Tower Mesh RGB', price:1590000, type:'Mid' } ],
    cooler:[ { id:'cooler_360_aio', name:'AIO 360mm ARGB', price:2890000, type:'AIO360', tdp:250 } ],
    monitor:[ { id:'monitor_2k_165', name:'27" 2K 165Hz IPS', price:5390000, hz:165, res:'2560x1440' } ]
};

// === Apply price overrides (supports number or object {price,source,updatedAt,currency,fx}) ===
(async function applyPriceOverrides(){
    try{
        const bases=['../pc-part-dataset','pc-part-dataset','../../pc-part-dataset'];
        let res=null;
        for(const b of bases){ try{ const r=await fetch(b+'/price-overrides.json'); if(r.ok){ res=r; break; } }catch{} }
        if(!res) return;
        const overrides=await res.json();
        const today=new Date().toISOString().slice(0,10);
        Object.keys(PART_LIBRARY).forEach(cat=>{
            PART_LIBRARY[cat].forEach(it=>{
                const ov=overrides[it.id];
                if(!ov) return;
                let newPrice=null, meta={};
                if(typeof ov==='number') newPrice=ov; else if(typeof ov==='object'){ if(typeof ov.price==='number') newPrice=ov.price; if(ov.source) meta.source=ov.source; meta.updatedAt=ov.updatedAt||today; if(ov.currency&&ov.fx){ meta.currency=ov.currency; meta.fx=ov.fx; } }
                if(newPrice){ it._oldPrice=it.price; it.price=newPrice; if(Object.keys(meta).length) it._priceMeta=meta; }
            });
        });
        // If selections already loaded, refresh their prices
        if(document.readyState!=='loading'){
            Object.keys(state.selected||{}).forEach(k=>{
                const sel=state.selected[k];
                if(sel && overrides[sel.id]){
                    const ov=overrides[sel.id];
                    if(typeof ov==='number'){
                        sel.price=ov; sel._priceMeta=undefined;
                    } else if(typeof ov==='object'){
                        if(ov.price) sel.price=ov.price;
                        sel._priceMeta={
                            source: ov.source||sel._priceMeta?.source,
                            updatedAt: ov.updatedAt||today,
                            currency: ov.currency,
                            fx: ov.fx
                        };
                    }
                    renderSelected(k);
                }
            });
            recalcTotals();
        } else {
            document.addEventListener('DOMContentLoaded', ()=>{ Object.keys(state.selected||{}).forEach(k=>{ const sel=state.selected[k]; if(sel && overrides[sel.id]){ const ov=overrides[sel.id]; if(typeof ov==='number'){ sel.price=ov; } else if(typeof ov==='object' && ov.price){ sel.price=ov.price; } } }); });
        }
        console.log('[PRICE] Overrides applied');
    }catch(e){ console.warn('Price override failed', e); }
})();

// Precompute simple search index to avoid repeated toLowerCase operations when filtering
let _globalItemCounter=0; // for stable sort
function indexItem(cat, it){
    const fields=[it.name,it.socket,it.type,it.chipset,it.form,it.res,it.aspect,it.panel];
    if(it.vram) fields.push(it.vram+'gb');
    if(it.size && it.type) fields.push(it.size+'gb');
    it._search = fields.filter(Boolean).map(s=>String(s).toLowerCase()).join(' ');
    if(it._order===undefined) it._order=_globalItemCounter++;
    return it;
}
Object.keys(PART_LIBRARY).forEach(cat=>{ PART_LIBRARY[cat] = PART_LIBRARY[cat].map(it=> indexItem(cat,it)); });

// --- Generic sorting state (per category) & column definitions ---
const sortState = {};
// Initialize each category with default sorting: price descending
function ensureSortState(cat){
    if(!sortState[cat]) sortState[cat]={ field:'price', dir:-1 }; // dir -1 => descending for numeric comparator
    return sortState[cat];
}

// Column definition map per category (excluding action column). Dynamic pruning hides empty columns.
const CATEGORY_COLUMNS = {
    cpu: [
        { field:'name', label:'Tên' },
        { field:'socket', label:'Socket' },
        { field:'cores', label:'Nhân' },
        { field:'threads', label:'Luồng', value:p=>p.threads },
        { field:'pCores', label:'P-Cores', value:p=>p.pCores },
        { field:'eCores', label:'E-Cores', value:p=>p.eCores },
        { field:'baseClock', label:'Xung cơ bản', value:p=> p.baseClock||p.base||p.clockBase },
        { field:'boostClock', label:'Xung boost', value:p=> p.boostClock||p.boost||p.clockBoost },
        { field:'microarch', label:'Vi kiến trúc', value:p=> p.microarch||p.arch },
        { field:'l3', label:'L3 (MB)', value:p=>p.l3||p.cacheL3 },
        { field:'l2', label:'L2 (MB)', value:p=>p.l2||p.cacheL2 },
        { field:'l1', label:'L1 (KB)', value:p=>p.l1||p.cacheL1 },
        { field:'process', label:'Tiến trình (nm)', value:p=>p.process },
        { field:'basePower', label:'Base Power (W)', value:p=>p.basePower },
        { field:'tdp', label:'TDP', value:p=> p.tdp },
        { field:'igpu', label:'iGPU', value:p=> p.igpu||p.iGPU||p.graphics },
        { field:'igpuClock', label:'iGPU Clock (MHz)', value:p=>p.igpuClock },
        { field:'igpuEUs', label:'iGPU EU/CU', value:p=>p.igpuEUs||p.igpuCUs },
        { field:'pcieLanes', label:'PCIe Lanes', value:p=>p.pcieLanes },
        { field:'pcieVersion', label:'PCIe Ver', value:p=>p.pcieVersion },
        { field:'memSupport', label:'Hỗ trợ RAM', value:p=>p.memSupport },
        { field:'memChannels', label:'Kênh RAM', value:p=>p.memChannels },
        { field:'maxMemorySpeed', label:'Max RAM MHz', value:p=>p.maxMemorySpeed },
        { field:'releaseDate', label:'Ngày ra mắt', value:p=>p.releaseDate },
        { field:'pricePerCore', label:'₫/Core', value:p=> p.pricePerCore },
        { field:'price', label:'Giá' }
    ],
    mainboard: [
        { field:'name', label:'Tên' },
        { field:'socket', label:'Socket' },
        { field:'form', label:'Form' },
        { field:'maxMemory', label:'Max RAM', value:p=>p.maxMemory },
        { field:'memorySlots', label:'Khe RAM', value:p=>p.memorySlots },
        { field:'m2Slots', label:'M.2', value:p=>p.m2Slots },
        { field:'pciSlots', label:'PCIe Slots', value:p=>p.pciSlots },
        { field:'pcieVersion', label:'PCIe', value:p=>p.pcieVersion },
        { field:'lan', label:'LAN', value:p=>p.lan },
        { field:'wifi', label:'WiFi', value:p=>p.wifi },
        { field:'bios', label:'BIOS', value:p=>p.bios },
        { field:'vrm', label:'VRM phases', value:p=>p.vrm },
        { field:'audio', label:'Audio', value:p=>p.audio },
        { field:'usb', label:'USB Ports', value:p=>p.usb },
        { field:'sata', label:'SATA', value:p=>p.sata },
        { field:'thunderbolt', label:'Thunderbolt', value:p=>p.thunderbolt },
        { field:'rearIO', label:'Rear I/O', value:p=>p.rearIO },
        { field:'releaseDate', label:'Ngày ra mắt', value:p=>p.releaseDate },
        { field:'color', label:'Màu', value:p=>p.color },
        { field:'price', label:'Giá' }
    ],
    ram: [
        { field:'name', label:'Tên' },
        { field:'type', label:'Loại' },
        { field:'size', label:'Dung lượng', value:p=>p.size },
        { field:'speed', label:'Tốc độ', value:p=>p.speed },
        { field:'sticks', label:'Số thanh', value:p=>p.sticks },
        { field:'latency', label:'CL', value:p=>p.latency||p.cl },
        { field:'voltage', label:'Điện áp', value:p=>p.voltage },
        { field:'ecc', label:'ECC', value:p=>p.ecc },
        { field:'rgb', label:'RGB', value:p=>p.rgb },
        { field:'timings', label:'Timing', value:p=>p.timings },
        { field:'profile', label:'XMP/EXPO', value:p=>p.profile },
        { field:'ranks', label:'Ranks', value:p=>p.ranks },
        { field:'height', label:'Chiều cao (mm)', value:p=>p.height },
        { field:'pricePerGB', label:'₫/GB', value:p=>p.pricePerGB },
        { field:'price', label:'Giá' }
    ],
    gpu: [
        { field:'name', label:'Tên' },
        { field:'chipset', label:'Chipset' },
        { field:'vram', label:'VRAM', value:p=>p.vram },
        { field:'memoryType', label:'Bộ nhớ', value:p=>p.memoryType },
        { field:'bus', label:'Bus (bit)', value:p=>p.bus },
        { field:'bandwidth', label:'Băng thông GB/s', value:p=>p.bandwidth },
        { field:'core', label:'Core', value:p=>p.core },
        { field:'boost', label:'Boost', value:p=>p.boost },
        { field:'memoryClock', label:'Mem Clock', value:p=>p.memoryClock },
        { field:'length', label:'Dài (mm)', value:p=>p.length },
        { field:'slotWidth', label:'Chiếm slot', value:p=>p.slotWidth },
        { field:'estPower', label:'Công suất ước', value:p=>p.estPower||p.power },
        { field:'recommendedPsu', label:'PSU khuyến nghị', value:p=>p.recommendedPsu },
        { field:'connectors', label:'Nguồn vào', value:p=>p.connectors },
        { field:'process', label:'Tiến trình (nm)', value:p=>p.process },
        { field:'cudaCores', label:'CUDA', value:p=>p.cudaCores },
        { field:'rtCores', label:'RT Cores', value:p=>p.rtCores },
        { field:'tensorCores', label:'Tensor', value:p=>p.tensorCores },
        { field:'transistors', label:'Transistors (B)', value:p=>p.transistors },
        { field:'outputs', label:'Cổng xuất', value:p=>p.outputs },
        { field:'architecture', label:'Kiến trúc', value:p=>p.architecture },
        { field:'releaseDate', label:'Ngày ra mắt', value:p=>p.releaseDate },
        { field:'tgp', label:'TGP (W)', value:p=>p.tgp },
        { field:'tbp', label:'TBP (W)', value:p=>p.tbp },
        { field:'tier', label:'Tier', value:p=>p.tier },
        { field:'price', label:'Giá' }
    ],
    storage: [
        { field:'name', label:'Tên' },
        { field:'type', label:'Loại' },
        { field:'interface', label:'Kết nối', value:p=>p.interface },
        { field:'form', label:'Form', value:p=>p.form },
        { field:'size', label:'Dung lượng', value:p=>p.size },
        { field:'read', label:'Đọc MB/s', value:p=>p.read },
        { field:'write', label:'Ghi MB/s', value:p=>p.write },
        { field:'endurance', label:'Endurance (PBW)', value:p=>p.endurance },
        { field:'temp', label:'Nhiệt độ', value:p=>p.temp },
        { field:'dimensions', label:'Kích thước', value:p=>p.dimensions },
        { field:'weight', label:'Trọng lượng (g)', value:p=>p.weight },
        { field:'warranty', label:'Bảo hành', value:p=>p.warranty },
        { field:'pricePerGB', label:'₫/GB', value:p=>p.pricePerGB },
        { field:'price', label:'Giá' }
    ],
    psu: [
        { field:'name', label:'Tên' },
        { field:'watt', label:'Công suất', value:p=>p.watt },
        { field:'efficiency', label:'Chuẩn', value:p=>p.efficiency },
        { field:'modular', label:'Modular', value:p=>p.modular },
        { field:'type', label:'Loại', value:p=>p.type },
        { field:'atx', label:'ATX Ver', value:p=>p.atx },
        { field:'pcie5', label:'PCIe 5.0', value:p=>p.pcie5 },
        { field:'protections', label:'Bảo vệ', value:p=>p.protections },
        { field:'length', label:'Dài (mm)', value:p=>p.length },
        { field:'fanSize', label:'Quạt (mm)', value:p=>p.fanSize },
        { field:'fanType', label:'Loại quạt', value:p=>p.fanType },
        { field:'bearing', label:'Bạc đạn', value:p=>p.bearing },
        { field:'rails12V', label:'Số rail 12V', value:p=>p.rails12V },
        { field:'current12V', label:'Dòng 12V (A)', value:p=>p.current12V },
        { field:'holdUp', label:'Hold-up (ms)', value:p=>p.holdUp },
        { field:'warranty', label:'Bảo hành', value:p=>p.warranty },
        { field:'pricePerWatt', label:'₫/W', value:p=>p.pricePerWatt },
        { field:'price', label:'Giá' }
    ],
    monitor: [
        { field:'name', label:'Tên' },
        { field:'size', label:'Kích thước', value:p=>p.size },
        { field:'res', label:'Độ phân giải', value:p=>p.res },
        { field:'hz', label:'Tần số', value:p=>p.hz },
        { field:'panel', label:'Panel', value:p=>p.panel },
        { field:'aspect', label:'Tỉ lệ', value:p=>p.aspect },
        { field:'brightness', label:'Độ sáng (nits)', value:p=>p.brightness },
        { field:'contrast', label:'Tương phản', value:p=>p.contrast },
        { field:'response', label:'Response (ms)', value:p=>p.response },
        { field:'gamut', label:'Gamut', value:p=>p.gamut },
        { field:'hdr', label:'HDR', value:p=>p.hdr },
        { field:'sync', label:'Sync', value:p=>p.sync },
        { field:'colorDepth', label:'Màu (bit)', value:p=>p.colorDepth },
        { field:'srgb', label:'sRGB %', value:p=>p.srgb },
        { field:'adobeRGB', label:'AdobeRGB %', value:p=>p.adobeRGB },
        { field:'dciP3', label:'DCI-P3 %', value:p=>p.dciP3 },
        { field:'viewAngle', label:'Góc nhìn', value:p=>p.viewAngle },
        { field:'pixelPitch', label:'Pixel pitch', value:p=>p.pixelPitch },
        { field:'curve', label:'Độ cong', value:p=>p.curve },
        { field:'panelMaker', label:'Panel maker', value:p=>p.panelMaker },
        { field:'warranty', label:'Bảo hành', value:p=>p.warranty },
        { field:'price', label:'Giá' }
    ],
    cooler: [
        { field:'name', label:'Tên' },
        { field:'type', label:'Loại' },
        { field:'height', label:'Cao (mm)', value:p=>p.height },
        { field:'fans', label:'Số quạt', value:p=>p.fans },
        { field:'fanSize', label:'Fan (mm)', value:p=>p.fanSize },
        { field:'rpm', label:'RPM', value:p=>p.rpm },
        { field:'noise', label:'Độ ồn dB', value:p=>p.noise },
        { field:'pump', label:'Pump RPM', value:p=>p.pump },
        { field:'heatpipes', label:'Ống dẫn nhiệt', value:p=>p.heatpipes },
        { field:'radiator', label:'Radiator', value:p=>p.radiator },
        { field:'tubeLength', label:'Ống (mm)', value:p=>p.tubeLength },
        { field:'socketSupport', label:'Socket hỗ trợ', value:p=>p.socketSupport },
        { field:'baseMaterial', label:'Đế tản', value:p=>p.baseMaterial },
        { field:'price', label:'Giá' }
    ],
    case: [
        { field:'name', label:'Tên' },
        { field:'type', label:'Loại', value:p=>p.type },
        { field:'formSupport', label:'Hỗ trợ main', value:p=>p.formSupport },
        { field:'gpuMax', label:'GPU tối đa (mm)', value:p=>p.gpuMax },
        { field:'coolerMax', label:'Tản CPU max (mm)', value:p=>p.coolerMax },
        { field:'psuMax', label:'PSU max (mm)', value:p=>p.psuMax },
        { field:'fansIncluded', label:'Quạt kèm', value:p=>p.fansIncluded },
        { field:'fanFront', label:'Fan trước', value:p=>p.fanFront },
        { field:'fanTop', label:'Fan trên', value:p=>p.fanTop },
        { field:'fanRear', label:'Fan sau', value:p=>p.fanRear },
        { field:'radiator', label:'Radiator', value:p=>p.radiator },
        { field:'color', label:'Màu', value:p=>p.color },
        { field:'dimensions', label:'Kích thước', value:p=>p.dimensions },
        { field:'weight', label:'Trọng lượng (kg)', value:p=>p.weight },
        { field:'materials', label:'Vật liệu', value:p=>p.materials },
        { field:'driveBays35', label:'Khay 3.5"', value:p=>p.driveBays35 },
        { field:'driveBays25', label:'Khay 2.5"', value:p=>p.driveBays25 },
        { field:'frontIO', label:'Front I/O', value:p=>p.frontIO },
        { field:'sidePanel', label:'Hông', value:p=>p.sidePanel },
        { field:'dustFilters', label:'Lọc bụi', value:p=>p.dustFilters },
        { field:'price', label:'Giá' }
    ],
    keyboard: [
        { field:'name', label:'Tên' },
        { field:'price', label:'Giá' },
        { field:'type', label:'Loại', value:p=>p.type },
        { field:'switch', label:'Switch', value:p=>p.switch },
        { field:'layout', label:'Layout', value:p=>p.layout },
        { field:'connection', label:'Kết nối', value:p=>p.connection },
        { field:'keyRollover', label:'Key rollover', value:p=>p.keyRollover },
        { field:'rgb', label:'RGB', value:p=>p.rgb },
        { field:'hotSwap', label:'Hot-swap', value:p=>p.hotSwap },
        { field:'keycapMaterial', label:'Keycap', value:p=>p.keycapMaterial },
        { field:'wireless', label:'Wireless', value:p=>p.wireless },
        { field:'battery', label:'Pin (mAh)', value:p=>p.battery },
        { field:'software', label:'Phần mềm', value:p=>p.software }
    ],
    mouse: [
        { field:'name', label:'Tên' },
        { field:'price', label:'Giá' },
        { field:'sensor', label:'Sensor', value:p=>p.sensor },
        { field:'dpi', label:'DPI', value:p=>p.dpi },
        { field:'weight', label:'Trọng lượng (g)', value:p=>p.weight },
        { field:'connection', label:'Kết nối', value:p=>p.connection },
        { field:'switch', label:'Switch', value:p=>p.switch },
        { field:'polling', label:'Polling Hz', value:p=>p.polling },
        { field:'sensorModel', label:'Model sensor', value:p=>p.sensorModel },
        { field:'accel', label:'Gia tốc (G)', value:p=>p.accel },
        { field:'maxSpeed', label:'Tốc độ tối đa', value:p=>p.maxSpeed },
        { field:'battery', label:'Pin (mAh)', value:p=>p.battery },
        { field:'liftOff', label:'Lift-off (mm)', value:p=>p.liftOff }
    ],
    headphones: [
        { field:'name', label:'Tên' },
        { field:'price', label:'Giá' },
        { field:'type', label:'Loại', value:p=>p.type },
        { field:'driver', label:'Driver (mm)', value:p=>p.driver },
        { field:'freq', label:'Tần số', value:p=>p.freq },
        { field:'impedance', label:'Trở kháng (Ω)', value:p=>p.impedance },
        { field:'sensitivity', label:'Độ nhạy (dB)', value:p=>p.sensitivity },
        { field:'mic', label:'Mic', value:p=>p.mic },
        { field:'connection', label:'Kết nối', value:p=>p.connection },
        { field:'wireless', label:'Wireless', value:p=>p.wireless },
        { field:'battery', label:'Pin (h)', value:p=>p.battery },
        { field:'codec', label:'Codec', value:p=>p.codec },
        { field:'noiseCancel', label:'Chống ồn', value:p=>p.noiseCancel },
        { field:'weight', label:'Trọng lượng (g)', value:p=>p.weight },
        { field:'cableLength', label:'Dài dây (m)', value:p=>p.cableLength }
    ],
    speakers: [
        { field:'name', label:'Tên' },
        { field:'price', label:'Giá' },
        { field:'channels', label:'Kênh', value:p=>p.channels },
        { field:'powerRms', label:'Công suất RMS', value:p=>p.powerRms },
        { field:'freq', label:'Tần số', value:p=>p.freq },
        { field:'connection', label:'Kết nối', value:p=>p.connection },
        { field:'subwoofer', label:'Sub', value:p=>p.subwoofer },
        { field:'totalPower', label:'Tổng công suất', value:p=>p.totalPower },
        { field:'bluetooth', label:'Bluetooth', value:p=>p.bluetooth },
        { field:'inputs', label:'Ngõ vào', value:p=>p.inputs },
        { field:'warranty', label:'Bảo hành', value:p=>p.warranty }
    ],
    os: [
        { field:'name', label:'Tên' },
        { field:'price', label:'Giá' },
        { field:'version', label:'Version', value:p=>p.version },
        { field:'license', label:'License', value:p=>p.license },
        { field:'arch', label:'Arch', value:p=>p.arch },
        { field:'build', label:'Build', value:p=>p.build },
        { field:'edition', label:'Edition', value:p=>p.edition },
        { field:'oemRetail', label:'OEM/Retail', value:p=>p.oemRetail },
        { field:'activation', label:'Kích hoạt', value:p=>p.activation },
        { field:'supportEnd', label:'Hết hỗ trợ', value:p=>p.supportEnd }
    ],
    soundcard: [
        { field:'name', label:'Tên' },
        { field:'price', label:'Giá' },
        { field:'chipset', label:'Chipset', value:p=>p.chipset },
        { field:'channels', label:'Kênh', value:p=>p.channels },
        { field:'snr', label:'SNR (dB)', value:p=>p.snr },
        { field:'sample', label:'Sample kHz', value:p=>p.sample },
        { field:'bitDepth', label:'Bit', value:p=>p.bitDepth },
        { field:'interface', label:'Kết nối', value:p=>p.interface },
        { field:'sampleRateMax', label:'Sample tối đa', value:p=>p.sampleRateMax },
        { field:'dsd', label:'DSD', value:p=>p.dsd },
        { field:'opAmps', label:'Op-amps', value:p=>p.opAmps },
        { field:'outputs', label:'Ngõ ra', value:p=>p.outputs },
        { field:'inputs', label:'Ngõ vào', value:p=>p.inputs }
    ],
    network: [
        { field:'name', label:'Tên' },
        { field:'price', label:'Giá' },
        { field:'speed', label:'Tốc độ', value:p=>p.speed },
        { field:'interface', label:'Kết nối', value:p=>p.interface },
        { field:'chipset', label:'Chipset', value:p=>p.chipset },
        { field:'wifi', label:'WiFi', value:p=>p.wifi },
        { field:'bt', label:'Bluetooth', value:p=>p.bt },
        { field:'antennas', label:'Ăng-ten', value:p=>p.antennas },
        { field:'standard', label:'Chuẩn', value:p=>p.standard },
        { field:'mimo', label:'MIMO', value:p=>p.mimo },
        { field:'latency', label:'Độ trễ', value:p=>p.latency },
        { field:'warranty', label:'Bảo hành', value:p=>p.warranty }
    ]
};
// Sets for table categories & wide layout
const TABLE_CATS = new Set(Object.keys(CATEGORY_COLUMNS));
const WIDE_TABLE_CATS = new Set(['cpu','mainboard','ram','gpu','psu','monitor','storage','case','cooler','keyboard','mouse','headphones','speakers','os','soundcard','network']);
function getSortValue(cat, obj, field){
    if(field==='price') return obj.price ?? 0;
    if(field==='name') return obj.name || '';
    // custom lookups
    switch(field){
        case 'cores': return obj.cores ?? 0;
        case 'baseClock': return parseFloat(obj.baseClock||obj.base||obj.clockBase)||0;
        case 'boostClock': return parseFloat(obj.boostClock||obj.boost||obj.clockBoost)||0;
        case 'microarch': return obj.microarch||obj.arch||'';
        case 'tdp': return obj.tdp ?? 0;
        case 'igpu': return obj.igpu||obj.iGPU||obj.graphics||'';
        case 'rating': return typeof obj.rating==='number'? obj.rating : (Array.isArray(obj.rating)? obj.rating[0]:0);
        case 'socket': return obj.socket||'';
        case 'chipset': return obj.chipset||'';
        case 'form': return obj.form||'';
        case 'maxMemory': return obj.maxMemory||0;
        case 'type': return obj.type||'';
        case 'size': return obj.size||0;
        case 'speed': return obj.speed||0;
        case 'sticks': return obj.sticks||0;
        case 'vram': return obj.vram||0;
        case 'core': return obj.core||0;
        case 'boost': return obj.boost||0;
        case 'estPower': return obj.estPower||obj.power||0;
        case 'watt': return obj.watt||0;
        case 'efficiency': return obj.efficiency||'';
        case 'modular': return obj.modular||'';
        case 'hz': return obj.hz||0;
        case 'panel': return obj.panel||'';
    case 'length': return obj.length||0;
    case 'aspect': return obj.aspect||'';
    case 'color': return obj.color||'';
    case 'pricePerGB': return obj.pricePerGB||0;
    case 'pricePerCore': return obj.pricePerCore||0;
    case 'pricePerWatt': return obj.pricePerWatt||0;
    case 'originalPriceUSD': return obj.originalPriceUSD||0;
    case 'tier': return obj.tier||'';
        default: return obj[field];
    }
}

const state = { selected:{}, total:0, power:0, loadedExternal:false };
window.state = state;
// Format price: show 'Liên hệ' when price missing/zero
function formatPrice(v){ if(v===undefined||v===null||v<=0) return 'Liên hệ'; return v.toLocaleString('vi-VN') + '₫'; }

// (Đã bỏ logic làm tròn giá tối đa theo yêu cầu)

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

function buildConfigRows(){
    const tbody=document.getElementById('config-rows');
    tbody.innerHTML='';
    PART_CATEGORIES.forEach(c=>{
        const tr=document.createElement('tr');
        tr.id='row-'+c.key;
        tr.innerHTML=`<td style="width:140px;font-weight:600;">${c.label}</td>
            <td class="part-cell" id="cell-${c.key}">
                <button class="part-select-btn" data-key="${c.key}">
                    <i class="fa fa-plus"></i> Chọn ${c.label}
                </button>
            </td>
            <td id="price-${c.key}">-</td>
            <td id="act-${c.key}"></td>`;
        tbody.appendChild(tr);
    });
    tbody.querySelectorAll('.part-select-btn').forEach(btn=> btn.addEventListener('click',()=> openPartModal(btn.dataset.key)));
}

function buildMeta(p){ const meta=[]; if(p.socket)meta.push('Socket '+p.socket); if(p.chipset)meta.push(p.chipset); if(p.tdp)meta.push(p.tdp+'W'); if(p.power)meta.push(p.power+'W'); if(p.size && p.type)meta.push(p.size+'GB'); if(p.speed)meta.push(p.speed+'MHz'); if(p.vram)meta.push(p.vram+'GB VRAM'); if(p.watt)meta.push(p.watt+'W'); if(p.res)meta.push(p.res+(p.hz?('@'+p.hz+'Hz'):'')); if(p._estimated) meta.push('ước tính'); return meta.join(' • '); }

function buildFacetOptions(category){
    const sel=document.getElementById('part-filter-socket');
    if(!sel) return;
    // Brand filter visibility (Intel / AMD) - only meaningful for CPU & Mainboard
    const brandBox=document.getElementById('brand-filter');
    if(brandBox){
        if(category==='cpu' || category==='mainboard'){
            brandBox.style.display='block';
        } else {
            brandBox.style.display='none';
            // Uncheck all when hidden to avoid impacting other categories
            brandBox.querySelectorAll('input[type="checkbox"]').forEach(cb=> cb.checked=false);
        }
    }
    const facetGroup=document.getElementById('group-facet');
    const facetTitle=document.getElementById('facet-title');
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
    if(!key){ sel.classList.add('hidden'); sel.innerHTML=''; if(facetGroup) facetGroup.style.display='none'; return; }
    const list = PART_LIBRARY[category]||[];
    const values = new Set();
    list.forEach(it=>{ const v = it[key]; if(v!==undefined && v!=='' && v!==null) values.add(String(v)); });
    if(values.size <= 1){ sel.classList.add('hidden'); sel.innerHTML=''; if(facetGroup) facetGroup.style.display='none'; return; }
    const labelMap={ socket:'Socket', type:'Loại', vram:'VRAM', efficiency:'Chuẩn hiệu suất', res:'Độ phân giải' };
    sel.classList.remove('hidden');
    sel.innerHTML = `<option value="">${labelMap[key]}: Tất cả</option>` + Array.from(values).sort((a,b)=> a.localeCompare(b, 'vi', {numeric:true})).map(v=>`<option value="${v}">${v}</option>`).join('');
    sel.dataset.facetKey = key; // store which field we're filtering on
    if(facetGroup){ facetGroup.style.display='block'; }
    if(facetTitle){ facetTitle.textContent = labelMap[key] || 'Thuộc tính'; }
}
function openPartModal(category){
    const modal=document.getElementById('part-modal');
    document.getElementById('modal-title').textContent='Chọn '+(PART_CATEGORIES.find(c=>c.key===category)?.label||category);
    modal.dataset.category=category;
    currentModalLimit = MODAL_PAGE_SIZE; // reset mỗi lần mở
    buildFacetOptions(category);
    renderPartModalList();
    buildAdvancedFilters(category);
    modal.style.display='flex';
    // Chặn scroll nền khi mở modal
    document.body.classList.add('no-scroll');
    const modalContent = modal.querySelector('.builder-modal-content');
    if(modalContent){
        // Thêm overlay fade nếu chưa có
        if(!modalContent.querySelector('.scroll-fade-top')){
            const fadeTop=document.createElement('div');
            fadeTop.className='scroll-fade-top';
            modalContent.prepend(fadeTop);
        }
        if(!modalContent.querySelector('.scroll-fade-bottom')){
            const fadeBottom=document.createElement('div');
            fadeBottom.className='scroll-fade-bottom';
            modalContent.appendChild(fadeBottom);
        }
                                                const scrollContainer = modalContent.querySelector('.parts-area') || modalContent; // chỉ cuộn phần danh sách
        const checkScroll=()=>{
            const st = scrollContainer.scrollTop;
            const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight - 1;
            if(st>8) modalContent.classList.add('has-scroll-top'); else modalContent.classList.remove('has-scroll-top');
            if(st < maxScroll-8) modalContent.classList.add('has-scroll-bottom'); else modalContent.classList.remove('has-scroll-bottom');
        };
        // Remove previous listeners
        if(modalContent._scrollFadeHandler && modalContent._scrollFadeEl){ modalContent._scrollFadeEl.removeEventListener('scroll', modalContent._scrollFadeHandler); }
        modalContent._scrollFadeHandler = checkScroll;
        modalContent._scrollFadeEl = scrollContainer;
        scrollContainer.addEventListener('scroll', checkScroll);
        // init state
        requestAnimationFrame(checkScroll);
        if(WIDE_TABLE_CATS.has(category)) modalContent.classList.add('cpu-mode'); else modalContent.classList.remove('cpu-mode');
    }
}
function renderPartModalList(){
    const modal=document.getElementById('part-modal');
    const category=modal.dataset.category;
    const grid=document.getElementById('parts-grid');
    const q=(document.getElementById('part-search').value||'').toLowerCase();
    // Advanced filter state (persist in memory between renders within modal)
    const advState = window._advFilterState || (window._advFilterState={});
    const catState = advState[category] || {};
    const facetSelect=document.getElementById('part-filter-socket');
    const facetKey=facetSelect?.dataset?.facetKey;
    const facetValue = facetSelect && !facetSelect.classList.contains('hidden') ? facetSelect.value : '';
    // Brand filter collection
    const brandBox=document.getElementById('brand-filter');
    let brandSelected=[];
    if(brandBox && brandBox.style.display!=='none'){
        brandSelected = Array.from(brandBox.querySelectorAll('input[type="checkbox"]:checked')).map(cb=>cb.value.toLowerCase());
    }
    grid.innerHTML='';
    let list=PART_LIBRARY[category]||[];
    if(q){ list=list.filter(p=> p._search && p._search.includes(q)); }
    if(facetValue && facetKey){ list=list.filter(p=> String(p[facetKey])===facetValue); }
    if(brandSelected.length){
        // Heuristic: check name starts with / contains brand keyword
        list=list.filter(p=>{
            const name=(p.name||'').toLowerCase();
            return brandSelected.some(b=> name.includes(b));
        });
    }
    // Apply advanced numeric / option filters
    list = list.filter(p=> applyAdvancedFilter(category, p));
    // (Đã xóa lọc giá tối đa)
    if(TABLE_CATS.has(category)){
        const s=ensureSortState(category);
        if(s.field){
            list=[...list].sort((a,b)=>{
                const va=getSortValue(category,a,s.field);
                const vb=getSortValue(category,b,s.field);
                if(typeof va==='number' && typeof vb==='number'){
                    if(va!==vb) return (va-vb)*s.dir;
                } else {
                    const sa=String(va??'').toLowerCase();
                    const sb=String(vb??'').toLowerCase();
                    const cmp=sa.localeCompare(sb,'vi',{numeric:true});
                    if(cmp!==0) return cmp*s.dir;
                }
                return (a._order - b._order);
            });
        }
        // Start with configured columns
        const baseCols = CATEGORY_COLUMNS[category] || [];
        // Dynamic prune: drop columns (except name/price) that are entirely empty across the full dataset for this category
        const fullData = PART_LIBRARY[category] || [];
        const cols = baseCols.filter(c=>{
            if(c.field==='name' || c.field==='price') return true;
            return fullData.some(p=>{
                const v = (typeof c.value==='function') ? c.value(p) : p[c.field];
                return v!==undefined && v!==null && v!=='';
            });
        });
        const table=document.createElement('table');
        table.className='cpu-table';
        table.innerHTML='<thead><tr>' + cols.map(c=>`<th data-field="${c.field}">${c.label}</th>`).join('') + '<th></th></tr></thead><tbody></tbody>';
        const tbody=table.querySelector('tbody');
        const end=Math.min(currentModalLimit, list.length);
        list.slice(0,end).forEach(p=>{
            const tr=document.createElement('tr');
            const tds = cols.map(c=>{
                let raw = c.value? c.value(p) : p[c.field];
                if(raw===undefined || raw===null) raw='';
                if(['baseClock','boostClock'].includes(c.field) && raw!=='') raw=raw+' GHz';
                if(['tdp','watt'].includes(c.field) && raw!=='') raw=raw+'W';
                if(c.field==='size' && raw!=='') {
                    // Contextual size unit formatting
                    if(category==='monitor') {
                        raw = raw + ' inch';
                    } else if(category==='ram') {
                        raw = raw + 'GB';
                    } else if(category==='storage') {
                        // storage handled in category-specific block below
                    } else {
                        // default keep raw (no unit) to avoid misleading GB label
                    }
                }
                if(c.field==='vram' && raw!=='') raw=raw+'GB';
                if(c.field==='microarch' && raw && p.microarchSource==='inferred') raw = `<span class=\"inferred\" title=\"Suy luận từ tên, chưa xác thực nguồn gốc\">${raw}</span>`;
                if(c.field==='price'){
                    const cls = p._estimated? 'price estimated':'price';
                    const usd = (p.originalPriceUSD && p.originalPriceUSD>0)? ` (USD $${p.originalPriceUSD})` : '';
                    const titleParts=[];
                    if(p.originalPriceUSD) titleParts.push('Giá gốc USD: $'+p.originalPriceUSD);
                    if(p._estimated) titleParts.push('Giá VND ước tính');
                    if(!titleParts.length && usd) titleParts.push('Giá gốc');
                    const titleAttr = titleParts.length? ` title="${titleParts.join(' | ')}"` : '';
                    raw = `<span class="${cls}"${titleAttr}>${formatPrice(p.price)}${p.originalPriceUSD?'<sup style=\"opacity:.6;font-size:10px;margin-left:2px;\">$'+p.originalPriceUSD+'</sup>':''}</span>`;
                }
                if(['pricePerGB','pricePerCore','pricePerWatt'].includes(c.field) && raw){ raw = raw.toLocaleString('vi-VN'); }
                if(category==='storage'){
                    if(c.field==='size' && raw){
                        const v=parseInt(p.size,10); if(v>=1024){ raw=(v/1024)+'TB'; } else raw=v+'GB';
                    }
                    if(c.field==='type' && raw){
                        const t=String(raw).toLowerCase();
                        if(/nvme/.test(t)) raw='NVMe SSD';
                        else if(/sata/.test(t) && /ssd/.test(t)) raw='SATA SSD';
                        else if(/hdd|rpm/.test(t)) raw='HDD';
                    }
                    // Hiển thị 'none' cho ô trống (ngoại trừ giá đã xử lý riêng)
                    if(raw==='') raw='none';
                }
                return `<td>${raw}</td>`;
            }).join('');
            tr.innerHTML = tds + '<td><button class="mini-add">Chọn</button></td>';
            tr.querySelector('.mini-add').addEventListener('click',()=>{ selectPart(category,p); closeModal(); });
            tbody.appendChild(tr);
        });
        if(list.length>end){
            const trMore=document.createElement('tr');
            const td=document.createElement('td');
            td.colSpan=cols.length+1; td.className='more-row';
            td.textContent=`Hiển thị ${end}/${list.length} kết quả. Nhấn để tải thêm...`;
            td.addEventListener('click',()=>{ currentModalLimit+=MODAL_PAGE_SIZE; renderPartModalList(); });
            trMore.appendChild(td); tbody.appendChild(trMore);
        }
        grid.appendChild(table);
        table.querySelectorAll('th[data-field]').forEach(th=>{
            th.classList.remove('sort-asc','sort-desc');
            if(s.field===th.dataset.field){ th.classList.add(s.dir===1?'sort-asc':'sort-desc'); }
            th.addEventListener('click',()=>{
                const f=th.dataset.field;
                if(s.field===f) s.dir=-s.dir; else { s.field=f; s.dir=1; }
                renderPartModalList();
            });
        });
        return; // table path
    }
    // Card layout for other categories
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

// ===== Advanced Filters =====
function buildAdvancedFilters(category){
    const wrap=document.getElementById('dynamic-filters');
    if(!wrap) return;
    wrap.innerHTML='';
    const data = PART_LIBRARY[category]||[];
    if(!data.length){ wrap.innerHTML=''; return; }
    const add=(html)=>{ const div=document.createElement('div'); div.className='filter-group dyn'; div.innerHTML=html; wrap.appendChild(div); };
    // Helper builds
    const numberRange=(id,label,min,max,step=1)=>{
        if(min===Infinity||max===-Infinity||min===max) return;
        add(`<div class="fg-title">${label}</div><div class="range-line"><input type="number" id="af-${id}-min" class="af-num" placeholder="Min" value=""><span>→</span><input type="number" id="af-${id}-max" class="af-num" placeholder="Max" value=""></div>`);
    };
    const multiSelect=(id,label,values)=>{
        if(!values.length) return;
        add(`<div class="fg-title">${label}</div><div class="chk-col">${values.slice(0,30).map(v=>`<label class="chk"><input type="checkbox" data-af-multi="${id}" value="${v}"> <span>${v}</span></label>`).join('')}</div>`);
    };
    // Derive stats
    const collect = (field)=> data.map(p=>p[field]).filter(v=> v!==undefined && v!==null && v!=='');
    const numericStats=(field)=>{ const nums=collect(field).map(Number).filter(n=>!isNaN(n)); return {min:Math.min(...nums), max:Math.max(...nums)}; };
    switch(category){
        case 'cpu':{
            multiSelect('socket','Socket', Array.from(new Set(collect('socket'))));
            numberRange('cores','Số nhân', ...Object.values(numericStats('cores')) );
            numberRange('tdp','TDP (W)', ...Object.values(numericStats('tdp')) );
            numberRange('price','Giá (VND)', ...Object.values(numericStats('price')),100000 );
            break; }
        case 'gpu':{
            numberRange('vram','VRAM (GB)', ...Object.values(numericStats('vram')) );
            numberRange('power','Công suất (W)', ...Object.values(numericStats('power')) );
            numberRange('price','Giá (VND)', ...Object.values(numericStats('price')),100000 );
            break; }
        case 'ram':{
            numberRange('size','Dung lượng (GB)', ...Object.values(numericStats('size')) );
            numberRange('speed','Tốc độ (MHz)', ...Object.values(numericStats('speed')) );
            numberRange('price','Giá (VND)', ...Object.values(numericStats('price')),50000 );
            break; }
        case 'storage':{
            multiSelect('type','Loại', Array.from(new Set(collect('type'))));
            numberRange('size','Dung lượng (GB)', ...Object.values(numericStats('size')) );
            numberRange('read','Đọc MB/s', ...Object.values(numericStats('read')) );
            numberRange('price','Giá (VND)', ...Object.values(numericStats('price')),50000 );
            break; }
        case 'psu':{
            numberRange('watt','Công suất (W)', ...Object.values(numericStats('watt')) );
            multiSelect('efficiency','Chuẩn', Array.from(new Set(collect('efficiency'))));
            numberRange('price','Giá (VND)', ...Object.values(numericStats('price')),50000 );
            break; }
        case 'monitor':{
            numberRange('size','Kích thước (inch)', ...Object.values(numericStats('size')) );
            numberRange('hz','Tần số (Hz)', ...Object.values(numericStats('hz')) );
            multiSelect('res','Độ phân giải', Array.from(new Set(collect('res'))));
            numberRange('price','Giá (VND)', ...Object.values(numericStats('price')),100000 );
            break; }
        default: {
            // Generic price filter if variety
            if(data.some(p=>p.price)) numberRange('price','Giá (VND)', ...Object.values(numericStats('price')),50000 );
        }
    }
    // Attach listeners for inputs
    wrap.querySelectorAll('input').forEach(el=>{
        el.addEventListener('input', debounce(()=> renderPartModalList(), 250));
        el.addEventListener('change', ()=> renderPartModalList());
    });
}

function getAdvancedFilterValues(category){
    const wrap=document.getElementById('dynamic-filters');
    if(!wrap) return {};
    const vals={ multis:{} };
    wrap.querySelectorAll('input[type="number"]').forEach(inp=>{
        const id=inp.id.replace(/^af-/,'');
        const [field,kind] = id.split('-').slice(0,2);
        if(!vals[field]) vals[field]={};
        const v=parseFloat(inp.value);
        if(!isNaN(v)) vals[field][kind]=v;
    });
    wrap.querySelectorAll('input[data-af-multi]:checked').forEach(cb=>{
        const f=cb.getAttribute('data-af-multi');
        if(!vals.multis[f]) vals.multis[f]=[];
        vals.multis[f].push(cb.value);
    });
    return vals;
}

function applyAdvancedFilter(category, p){
    const vals=getAdvancedFilterValues(category);
    // Range checks
    for(const field in vals){
        if(field==='multis') continue;
        const cond=vals[field];
        if(cond.min!==undefined && p[field]!==undefined && p[field] < cond.min) return false;
        if(cond.max!==undefined && p[field]!==undefined && p[field] > cond.max) return false;
    }
    // Multi select
    for(const f in vals.multis){
        const arr=vals.multis[f];
        if(arr.length && !arr.includes(String(p[f]))) return false;
    }
    return true;
}

function debounce(fn,delay){ let t; return function(){ clearTimeout(t); t=setTimeout(()=>fn.apply(this,arguments),delay); }; }

function _isLoggedIn() {
    try {
        return (window.AuthSync && typeof window.AuthSync.isLoggedIn === 'function')
            ? window.AuthSync.isLoggedIn()
            : !!localStorage.getItem('userName');
    } catch (_) {
        return !!localStorage.getItem('userName');
    }
}

// Cập nhật badge giỏ ưu tiên dùng cartCountShared (giống index/checkout)
async function _refreshCartBadgeFrom(cart) {
    try {
        if (window.cartCountShared && typeof window.cartCountShared.setFromCart === 'function') {
            window.cartCountShared.setFromCart(Array.isArray(cart) ? cart : JSON.parse(localStorage.getItem('cart')||'[]'));
        } else if (typeof updateCartCount === 'function') {
            updateCartCount();
        }
    } catch (_) {}
}

// Thêm 1 item vào giỏ: ưu tiên server, fallback local cho khách vãng lai
async function _addOneItemToCart(payload) {
    // Chuẩn hoá số
    payload.originalPrice = Number(payload.originalPrice) || 0;
    payload.salePrice = Number(payload.salePrice) || payload.originalPrice;
    payload.discountPercent = Number(payload.discountPercent) || 0;
    payload.quantity = Number(payload.quantity) || 1;

    if (_isLoggedIn()) {
        try {
            const res = await fetch(`${window.API_BASE}/api/cart`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok && data && data.success) {
                const serverCart = data.cart || [];
                localStorage.setItem('cart', JSON.stringify(serverCart)); // cache local để đồng bộ với các trang khác
                await _refreshCartBadgeFrom(serverCart);
                if (typeof showNotification === 'function') showNotification(`Đã thêm "${payload.name}" vào giỏ hàng!`, 'success');
                return true;
            }
        } catch (err) {
            console.warn('Add to cart via server failed, fallback local.', err);
        }
    }

    // Fallback LOCAL (khách chưa đăng nhập)
    try {
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        const idx = cart.findIndex(it => String(it.id) === String(payload.id));
        if (idx !== -1) {
            cart[idx].quantity = (Number(cart[idx].quantity) || 0) + payload.quantity;
            cart[idx].updatedAt = new Date().toISOString();
        } else {
            cart.push({
                id: payload.id,
                name: payload.name,
                originalPrice: payload.originalPrice,
                salePrice: payload.salePrice,
                discountPercent: payload.discountPercent,
                image: payload.image || 'Images/Logo.jpg',
                quantity: payload.quantity,
                addedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }
        localStorage.setItem('cart', JSON.stringify(cart));
        await _refreshCartBadgeFrom(cart);
        if (typeof showNotification === 'function') showNotification(`Đã thêm "${payload.name}" vào giỏ hàng!`, 'success');
        return true;
    } catch (e) {
        console.error('Local add to cart failed:', e);
        return false;
    }
}

function selectPart(category,part){
    // Ép key hợp lệ
    var validKeys = ['cpu','gpu','mainboard','ram','storage','psu','case','cooler'];
    var key = (category+'').toLowerCase();
    if(!validKeys.includes(key)) {
        console.warn('Linh kiện chọn không hợp lệ:', category, part);
    }
    state.selected[key]=part;
    renderSelected(key);
    recalcTotals();
    updateSummary();
    saveToLocal();
    console.log('DEBUG selectPart:', key, state.selected);
}

function removePart(category){
    delete state.selected[category];
    renderSelected(category);
    recalcTotals();
    updateSummary();
    saveToLocal();
}

function renderSelected(category){
    const cell=document.getElementById('cell-'+category);
    const priceCell=document.getElementById('price-'+category);
    const actCell=document.getElementById('act-'+category);
    const part=state.selected[category];
    if(!cell) return;

    if(!part){
        cell.innerHTML=`<button class="part-select-btn" data-key="${category}">
      <i class="fa fa-plus"></i> Chọn ${(PART_CATEGORIES.find(c=>c.key===category)||{}).label||category}
    </button>`;
        priceCell.textContent='-';
        actCell.innerHTML='';
        cell.querySelector('button').addEventListener('click',()=> openPartModal(category));
    } else {
        cell.innerHTML=`<div class="selected-part">
        <div class="name">${part.name}</div>
        <div class="meta">${buildMeta(part)}</div>
      </div>`;
        priceCell.textContent=formatPrice(part.price);
        actCell.innerHTML=`<div class="row-actions">
      <button class="add-part-cart" title="Thêm vào giỏ" onclick="handleAddToCart('${category}')">
        <i class="fa fa-cart-plus"></i>
      </button>
      <button class="remove-part-btn" title="Xóa linh kiện" onclick="removePart('${category}')">×</button>
    </div>`;

        // Gắn thêm vào giỏ cho từng dòng (server-sync)
        window.handleAddToCart = async function handleAddToCart(cat) {
            const p = state.selected[cat];
            if(!p){ showNotification?.('Chưa chọn linh kiện','error'); return; }
            const price = Number(p.price)||0;
            await _addOneItemToCart({
                id: p.id,
                name: p.name,
                originalPrice: price,
                salePrice: price,
                discountPercent: 0,
                image: p.image || 'Images/Logo.jpg',
                quantity: 1
            });
        };
    }

    const li=document.querySelector(`.builder-categories li[data-key="${category}"]`);
    if(li){ if(part) li.classList.add('has-selected'); else li.classList.remove('has-selected'); }
    updateCategoryCount(category);
}

// Thêm 1 linh kiện đơn lẻ vào giỏ hàng
async function addSinglePart(category){
    const part=state.selected[category];
    if(!part){ showNotification?.('Chưa chọn linh kiện','error'); return; }
    const price = Number(part.price)||0;
    await _addOneItemToCart({
        id: part.id,
        name: part.name,
        originalPrice: price,
        salePrice: price,
        discountPercent: 0,
        image: part.image || 'Images/Logo.jpg',
        quantity: 1
    });
}

function recalcTotals(){
    let total=0, power=0;
    Object.values(state.selected).forEach(p=>{
        total+=p.price||0;
        power+=(p.tdp||p.power||0);
    });
    state.total=total;
    state.power=power;
    document.getElementById('total-price').textContent=formatPrice(total);
    var el = document.getElementById('total-power'); // nếu có
    if(el) el.textContent = power+'W';
    compatibilityCheck();
}

function compatibilityCheck(){ const cpu=state.selected.cpu, mb=state.selected.mainboard, ram=state.selected.ram, psu=state.selected.psu, gpu=state.selected.gpu; const box=document.getElementById('compat-status'); const warnBox=document.getElementById('warning-box'); warnBox.style.display='none'; warnBox.innerHTML=''; const problems=[]; if(cpu&&mb&&cpu.socket&&mb.socket&&cpu.socket!==mb.socket) problems.push('CPU & Mainboard khác socket'); if(psu && state.power && psu.watt < state.power * 1.4) problems.push('Nguồn có thể thiếu (khuyến nghị >140%)'); if(problems.length){ box.className='compatibility-status error'; box.textContent='Không tương thích'; warnBox.style.display='block'; warnBox.innerHTML='<strong>Vấn đề:</strong><br>'+problems.map(p=>'• '+p).join('<br>'); } else if(cpu && mb){ box.className='compatibility-status ok'; box.textContent='Tương thích'; } else { box.className='compatibility-status warn'; box.textContent='Chọn thêm linh kiện'; } }
function updateSummary(){ const list=document.getElementById('summary-list'); list.innerHTML=''; Object.keys(state.selected).forEach(k=>{ const p=state.selected[k]; const div=document.createElement('div'); div.className='summary-item'; div.innerHTML=`<div class=\"label\">${(PART_CATEGORIES.find(c=>c.key===k)||{}).label||k}</div><div class=\"value\">${p.name}</div>`; list.appendChild(div); }); buildRecommendation(); }
function buildRecommendation(){ const box=document.getElementById('recommend-box'); const cpu=state.selected.cpu, gpu=state.selected.gpu, ram=state.selected.ram; let txt=''; if(cpu&&gpu){ if((cpu.cores||0)>=12 && (gpu.power||0)>=250) txt+='Cấu hình mạnh cho Streaming / 4K Gaming.<br>'; else if((gpu.power||0)<=200) txt+='Phù hợp chơi game eSports / văn phòng.<br>'; } if(ram && (ram.size||0)>=64) txt+='Đa nhiệm nặng & dựng video.<br>'; if(!txt) txt='Chọn thêm linh kiện để nhận gợi ý.'; box.innerHTML='<strong>Gợi ý:</strong><br>'+txt; }

function saveToLocal(){ localStorage.setItem('pcBuilderConfig', JSON.stringify(state.selected)); }
function loadFromLocal(){
        try{
            const saved=JSON.parse(localStorage.getItem('pcBuilderConfig')||'{}');
            const validKeys = ['cpu','gpu','mainboard','ram','storage','psu','case','cooler'];
            // Xóa sạch mọi key cũ
            state.selected = {};
            Object.keys(saved).forEach(k=>{
                var key = (k+'').toLowerCase();
                if(validKeys.includes(key)) state.selected[key]=saved[k];
            });
        }catch(e){}
}
function clearConfig(){
        // Xóa sạch mọi key cũ
        state.selected={};
        buildConfigRows();
        recalcTotals();
        updateSummary();
        saveToLocal();
        if(window.updateFloatBar) window.updateFloatBar();
}
function closeModal(){ document.getElementById('part-modal').style.display='none'; }
// Gỡ class no-scroll khi đóng modal
const _closeModalRef = closeModal;
closeModal = function(){
    _closeModalRef();
    document.body.classList.remove('no-scroll');
};

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
    // After loading CPU dataset, enrich with microarchitecture & rating if missing
    if(cat==='cpu') enrichCpuDerivedData();
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
    // Brand filter listeners
    const brandBox=document.getElementById('brand-filter');
    if(brandBox){ brandBox.querySelectorAll('input[type="checkbox"]').forEach(cb=> cb.addEventListener('change', ()=>{ currentModalLimit = MODAL_PAGE_SIZE; renderPartModalList(); })); }
    document.getElementById('close-modal')?.addEventListener('click', closeModal);
    document.getElementById('part-modal')?.addEventListener('click', e=>{ if(e.target.id==='part-modal') closeModal(); });
    document.getElementById('clear-config')?.addEventListener('click', clearConfig);
    // Đã xoá nút lưu cấu hình, không cần gán sự kiện
    document.getElementById('load-config')?.addEventListener('click', ()=>{ loadFromLocal(); Object.keys(state.selected).forEach(k=> renderSelected(k)); recalcTotals(); updateSummary(); });
}

document.addEventListener('DOMContentLoaded', ()=>{ loadPagePart('HTML/Layout/resetheader.html','header-container', ()=>{ if(typeof initHeader==='function') initHeader(); }); loadPagePart('HTML/Layout/resetfooter.html','footer-container'); initProcessed(); });

// ==== Thêm vào giỏ hàng từ trang Build PC ====
async function addCurrentSelectionToCart(options={bundle:false}){
    const requiredKeys = ['cpu','gpu','mainboard','ram','storage','psu','case','cooler'];
    const partsMap = state.selected || {};
    const parts = Object.values(partsMap);
    if(!parts.length){ showNotification?.('Chưa chọn linh kiện nào','error'); return; }

    if(options.bundle){
        const missing = requiredKeys.filter(k => !partsMap[k]);
        if(missing.length){
            const labels = { cpu:'CPU', gpu:'GPU', mainboard:'Mainboard', ram:'RAM', storage:'Ổ cứng', psu:'Nguồn', case:'Case', cooler:'Tản nhiệt' };
            showNotification?.('Vui lòng chọn đủ: '+missing.map(k=>labels[k]||k).join(', '), 'error');
            return;
        }
        const totalPrice = parts.reduce((s,p)=> s + (Number(p.price)||0), 0);
        const cpu = partsMap['cpu']; const gpu = partsMap['gpu']; const ram = partsMap['ram']; const storage = partsMap['storage'];
        const ramSize = ram?.size ? ram.size+'GB' : '';
        let storageSize = '';
        if(storage?.size){ storageSize = storage.size>=1000 ? (storage.size/1000)+'TB' : storage.size+'GB'; }
        const bundleName = 'PC ' + (cpu?.name||'CPU') + ' + ' + (gpu?.name||'GPU') + (ramSize?(' + '+ramSize):'') + (storageSize?(' + '+storageSize):'');
        const bundleId = 'build_' + Date.now();

        await _addOneItemToCart({
            id: bundleId,
            name: bundleName,
            originalPrice: totalPrice,
            salePrice: totalPrice,
            discountPercent: 0,
            image: cpu?.image || gpu?.image || 'Images/Logo.jpg',
            quantity: 1
        });
        return;
    }

    // Không bundle: thêm từng linh kiện
    for (const p of parts){
        const price = Number(p.price)||0;
        await _addOneItemToCart({
            id: p.id,
            name: p.name,
            originalPrice: price,
            salePrice: price,
            discountPercent: 0,
            image: p.image || 'Images/Logo.jpg',
            quantity: 1
        });
    }
    showNotification?.(`Đã thêm ${parts.length} linh kiện vào giỏ hàng`, 'success');
}

// Trường hợp header/cart script load chậm -> thử cập nhật lại nhiều lần
function scheduleCartCountRefresh(){
    let attempts=0;
    const max=10;
    const timer=setInterval(()=>{
        attempts++;
        if(typeof updateCartCount==='function'){
            updateCartCount();
            clearInterval(timer);
        } else if(attempts>=max){
            clearInterval(timer);
        }
    },300);
}

// Bind nút "Thêm vào giỏ hàng" chính để mở snackbar (floatbar đã loại bỏ)
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('export-json');
    if (btn && typeof window.handleAddToCartClick === 'function') {
        btn.onclick = window.handleAddToCartClick;
    }
});

// ===== PCPartPicker List Import =====
async function importPcPartPickerList(url){
    try{
        const res = await fetch('/api/import-pcpartpicker', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ url }) });
        if(!res.ok) throw new Error('Import thất bại');
        const data = await res.json();
        if(!data.items) return;
        // Ensure categories loaded before matching
        const catsToLoad = ['cpu','mainboard','ram','gpu','storage','psu','case','cooler'];
        await Promise.all(catsToLoad.map(c=> ensureCategory(c)));
        // Simple fuzzy name match: choose first dataset item whose normalized name contains main token(s)
        function norm(s){ return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,' '); }
        data.items.forEach(it=>{
            if(!it.category) return;
            const list = PART_LIBRARY[it.category]||[];
            const targetTokens = norm(it.name).split(' ').filter(t=>t.length>2);
            let best=null, bestScore=0;
            list.forEach(p=>{
                const base = norm(p.name);
                let score=0;
                targetTokens.forEach(t=>{ if(base.includes(t)) score++; });
                if(score>bestScore){ bestScore=score; best=p; }
            });
            if(best && bestScore>=2){ // require at least 2 token matches to reduce false positives
                selectPart(it.category, best);
            }
        });
        recalcTotals(); updateSummary();
    }catch(e){ console.warn('Import list error', e); }
}

// Bind UI
document.addEventListener('DOMContentLoaded', ()=>{
    const btn=document.getElementById('import-pp-btn');
    const input=document.getElementById('pp-list-url');
    if(btn && input){
        btn.addEventListener('click', ()=>{ const url=input.value.trim(); if(url) importPcPartPickerList(url); });
        input.addEventListener('keydown', e=>{ if(e.key==='Enter'){ const url=input.value.trim(); if(url) importPcPartPickerList(url); }});
    }
});

// ===== CPU derived data (microarchitecture + synthetic rating) =====
function enrichCpuDerivedData(){
    const list = PART_LIBRARY.cpu||[];
    if(!list.length) return;
    // Only add microarch when pattern clearly matches; do NOT fabricate rating for accuracy.
    list.forEach(c=>{
        if(!c.microarch){
            const m=guessMicroArch(c.name);
            if(m) c.microarch=m; // only set if confidently guessed
        }
        // Do not generate rating; leave blank if source dataset lacks it
        indexItem('cpu', c);
    });
}
function guessMicroArch(name){
    if(!name) return '';
    const n=name.toLowerCase();
    // AMD Ryzen pattern
    if(n.includes('ryzen')){
        const m = n.match(/ryzen\s+\d+\s*(?:pro|x3d|g)?\s*(\d{4,5})?/); // fallback
        // Extract 4-digit model code
        let codeMatch = n.match(/\b(\d{4,5})x?3?d?\b/);
        let code = codeMatch? parseInt(codeMatch[1],10): null;
        if(code){
            if(code>=9000) return 'Zen 5';
            if(code>=7000) return 'Zen 4';
            if(code>=5000) return 'Zen 3';
            if(code>=3000) return 'Zen 2';
            if(code>=2000) return 'Zen+';
            if(code>=1000) return 'Zen 1';
        }
        return 'Zen';
    }
    if(n.includes('threadripper')) return 'Zen HEDT';
    // Intel Core gen detection (look for i3/i5/i7/i9 & model number)
    if(/core\s+i[3579]/.test(n)){
    const genMatch = n.match(/\b(\d{4,5})[a-z]{0,2}\b/); // e.g. 14700K -> 14700
        if(genMatch){
            const num = parseInt(genMatch[1],10);
            const gen = Math.floor(num/1000); // 14700 -> 14
            if(gen>=15) return gen + 'th Gen';
            const intelMap={12:'Alder Lake',13:'Raptor Lake',14:'Raptor Lake R',11:'Rocket Lake',10:'Comet Lake',9:'Coffee Lake R',8:'Coffee Lake'};
            if(intelMap[gen]) return intelMap[gen];
            return gen + 'th Gen';
        }
        return 'Intel Core';
    }
    return '';
}
