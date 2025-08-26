// ================== KHỞI TẠO TOÀN BỘ LOGIC TRANG ALLPRODUCTS ==================
function setupAllProductsPage() {
  // Toggle sidebar logic
  function showSidebar(type) {
    const pcSidebar = document.querySelector('.pc-sidebar');
    const laptopSidebar = document.querySelector('.laptop-sidebar');
    if (type === 'laptop') {
      if (pcSidebar) pcSidebar.style.display = 'none';
      if (laptopSidebar) laptopSidebar.style.display = '';
    } else {
      if (pcSidebar) pcSidebar.style.display = '';
      if (laptopSidebar) laptopSidebar.style.display = 'none';
    }
  }

  // Button event listeners
  document.addEventListener('DOMContentLoaded', function() {
    const pcBtn = document.getElementById('show-pc-btn');
    const laptopBtn = document.getElementById('show-laptop-btn');
    if (pcBtn) pcBtn.addEventListener('click', function() {
      showSidebar('pc');
      renderPCProducts('all');
    });
    if (laptopBtn) laptopBtn.addEventListener('click', function() {
      showSidebar('laptop');
      renderPCProducts('all');
    });
    // On page load, show correct sidebar based on URL param
    const params = new URLSearchParams(window.location.search);
    showSidebar(params.get('type') === 'laptop' ? 'laptop' : 'pc');
    // Always attach laptop filter events on load
    attachLaptopFilterEvents();
  });
  // Lọc sản phẩm khi thay đổi bộ lọc

  // PC filter getter
  function getSelectedFilters() {
    const filters = {};
    filters.brand = Array.from(document.querySelectorAll('input[id^="brand-"]:checked')).map(cb => cb.labels[0].innerText.trim());
    filters.type = Array.from(document.querySelectorAll('input[id^="loai-"]:checked')).map(cb => cb.labels[0].innerText.trim());
    filters.series = Array.from(document.querySelectorAll('input[id^="series-"]:checked')).map(cb => cb.labels[0].innerText.trim());
    filters.need = Array.from(document.querySelectorAll('input[id^="nc-"]:checked')).map(cb => cb.labels[0].innerText.trim());
    filters.segment = Array.from(document.querySelectorAll('input[id^="seg-"]:checked')).map(cb => cb.labels[0].innerText.trim());
    filters.cpuSeries = Array.from(document.querySelectorAll('input[id^="cpu-"]:checked')).map(cb => cb.labels[0].innerText.trim());
    filters.cpuGen = Array.from(document.querySelectorAll('input[id^="gen-"]:checked')).map(cb => cb.labels[0].innerText.trim());
    filters.ram = Array.from(document.querySelectorAll('input[id^="ram-"]:checked')).map(cb => cb.labels[0].innerText.trim());
    filters.gpu = Array.from(document.querySelectorAll('input[id^="gpu-"]:checked')).map(cb => cb.labels[0].innerText.trim());
    filters.ssd = Array.from(document.querySelectorAll('input[id^="ssd-"]:checked')).map(cb => cb.labels[0].innerText.trim());
    filters.os = Array.from(document.querySelectorAll('input[id^="os-"]:checked')).map(cb => cb.labels[0].innerText.trim());
    const minPrice = parseInt((document.getElementById('min-price')?.value || '0').replace(/\D/g, '')) || 0;
    const maxPrice = parseInt((document.getElementById('max-price')?.value || '200000000').replace(/\D/g, '')) || 200000000;
    filters.price = { min: minPrice, max: maxPrice };
    return filters;
  }

  // LAPTOP filter getter
  function getSelectedLaptopFilters() {
    const filters = {};
    filters.brand = Array.from(document.querySelectorAll('input[id^="laptop-brand-"]:checked')).map(cb => cb.labels[0].innerText.trim());
    filters.series = Array.from(document.querySelectorAll('input[id^="laptop-series-"]:checked')).map(cb => cb.labels[0].innerText.trim());
    filters.need = Array.from(document.querySelectorAll('input[id^="laptop-need-"]:checked')).map(cb => cb.labels[0].innerText.trim());
    filters.cpuSeries = Array.from(document.querySelectorAll('input[id^="laptop-cpu-"]:checked')).map(cb => cb.labels[0].innerText.trim());
    filters.cpuGen = Array.from(document.querySelectorAll('input[id^="laptop-gen-"]:checked')).map(cb => cb.labels[0].innerText.trim());
    filters.screenSize = Array.from(document.querySelectorAll('input[id^="laptop-size-"]:checked')).map(cb => cb.labels[0].innerText.trim());
    filters.laptopStd = Array.from(document.querySelectorAll('input[id^="laptop-std-"]:checked')).map(cb => cb.labels[0].innerText.trim());
    filters.ram = Array.from(document.querySelectorAll('input[id^="laptop-ram-"]:checked')).map(cb => cb.labels[0].innerText.trim());
    filters.gpu = Array.from(document.querySelectorAll('input[id^="laptop-gpu-"]:checked')).map(cb => cb.labels[0].innerText.trim());
    filters.ssd = Array.from(document.querySelectorAll('input[id^="laptop-ssd-"]:checked')).map(cb => cb.labels[0].innerText.trim());
    filters.resolution = Array.from(document.querySelectorAll('input[id^="laptop-res-"]:checked')).map(cb => cb.labels[0].innerText.trim());
    filters.os = Array.from(document.querySelectorAll('input[id^="laptop-os-"]:checked')).map(cb => cb.labels[0].innerText.trim());
    const minPrice = parseInt((document.getElementById('laptop-min-price')?.value || '0').replace(/\D/g, '')) || 0;
    const maxPrice = parseInt((document.getElementById('laptop-max-price')?.value || '200000000').replace(/\D/g, '')) || 200000000;
    filters.price = { min: minPrice, max: maxPrice };
    return filters;
  }

  // LAPTOP filter logic
  function filterLaptopProducts() {
    const filters = getSelectedLaptopFilters();
  let filtered = (window.laptopData || pcData).filter(item => {
      // Thương hiệu: so sánh không phân biệt hoa thường, loại bỏ khoảng trắng, kiểm tra cả item.brand và item.category (array)
      if (filters.brand.length) {
        const brands = [];
        if (item.brand) brands.push((item.brand + '').replace(/\s+/g, '').toLowerCase());
        if (Array.isArray(item.category)) {
          item.category.forEach(cat => brands.push((cat + '').replace(/\s+/g, '').toLowerCase()));
        }
        const match = filters.brand.some(val => {
          const filterVal = val.replace(/\s+/g, '').toLowerCase();
          return brands.includes(filterVal);
        });
        if (!match) return false;
      }
      if (filters.series.length) {
        // Kiểm tra cả item.series, item.category (array), và cả item.name (fuzzy)
        const seriesList = [];
        if (item.series) seriesList.push((item.series + '').replace(/\s+/g, '').toLowerCase());
        if (Array.isArray(item.category)) {
          item.category.forEach(cat => seriesList.push((cat + '').replace(/\s+/g, '').toLowerCase()));
        }
        // Thêm cả tên sản phẩm để hỗ trợ lọc mờ
        if (item.name) seriesList.push((item.name + '').replace(/\s+/g, '').toLowerCase());
        const match = filters.series.some(val => {
          const filterVal = val.replace(/\s+/g, '').toLowerCase();
          return seriesList.some(s => s.includes(filterVal));
        });
        if (!match) return false;
      }
      if (filters.need.length) {
        // Fuzzy match, normalize dấu, spaces, "hoạ"/"họa"
        function normalize(str) {
          return (str || '')
            .toLowerCase()
            .replace(/[\s\-]+/g, '')
            .replace(/[ọo]/g, 'o')
            .replace(/[ạa]/g, 'a')
            .replace(/[ỹyịi]/g, 'y')
            .replace(/[ậa]/g, 'a')
            .replace(/[ệe]/g, 'e')
            .replace(/[íi]/g, 'i')
            .replace(/[đd]/g, 'd')
            .normalize('NFD').replace(/\p{Diacritic}/gu, '');
        }
        const needList = [];
        if (item.need) needList.push(normalize(item.need));
        if (Array.isArray(item.category)) {
          item.category.forEach(cat => needList.push(normalize(cat)));
        }
        if (item.name) needList.push(normalize(item.name));
        const match = filters.need.some(val => {
          const filterVal = normalize(val);
          return needList.some(s => s.includes(filterVal) || filterVal.includes(s));
        });
        if (!match) return false;
      }
      if (filters.cpuSeries.length && (!item.cpu || !filters.cpuSeries.some(val => (item.cpu + '').toLowerCase().includes(val.toLowerCase())))) return false;
      if (filters.cpuGen.length && (!item.cpu_gen || !filters.cpuGen.includes(item.cpu_gen))) return false;
      function normalize(str) {
        return (str || '')
          .toLowerCase()
          .replace(/[\s\-]+/g, '')
          .replace(/[ọo]/g, 'o')
          .replace(/[ạa]/g, 'a')
          .replace(/[ỹyịi]/g, 'y')
          .replace(/[ậa]/g, 'a')
          .replace(/[ệe]/g, 'e')
          .replace(/[íi]/g, 'i')
          .replace(/[đd]/g, 'd')
          .normalize('NFD').replace(/\p{Diacritic}/gu, '');
      }
      if (filters.screenSize.length) {
        // Lấy từ screen_size hoặc display (nhiều data chỉ có display)
        let itemVal = '';
        if (item.screen_size) itemVal = item.screen_size;
        else if (item.display) itemVal = item.display;
        if (!itemVal) return false;
        // Trích số inch từ chuỗi
        const inchMatch = itemVal.match(/(\d{1,2}(?:\.\d{1,2})?)/g);
        let inch = null;
        if (inchMatch) {
          // Lấy số lớn nhất (trường hợp "15.6 inch 2.8K OLED 120Hz")
          inch = Math.max(...inchMatch.map(Number));
        }
        function matchScreenSize(val) {
          const normVal = normalize(val);
          if (inch) {
            if (normVal.includes('11-13.3') && inch >= 11 && inch <= 13.3) return true;
            if (normVal.includes('13.4-14') && inch >= 13.4 && inch <= 14) return true;
            if (normVal.includes('15-15.6') && inch >= 15 && inch <= 15.6) return true;
            if (normVal.includes('16-16.1') && inch >= 16 && inch <= 16.1) return true;
          }
          // fallback: so khớp mờ
          const normItem = normalize(itemVal);
          return normItem.includes(normVal) || normVal.includes(normItem);
        }
        const match = filters.screenSize.some(val => matchScreenSize(val));
        if (!match) return false;
      }
      if (filters.laptopStd.length && (!item.laptop_std || !filters.laptopStd.some(val => (item.laptop_std + '').includes(val)))) return false;
      if (filters.ram.length && (!item.ram || !filters.ram.some(val => (item.ram + '').replace(/\s+/g, '').toLowerCase().includes(val.replace(/\s+/g, '').toLowerCase())))) return false;
      if (filters.gpu.length) {
        if (!item.gpu) return false;
        const itemVal = normalize(item.gpu);
        const match = filters.gpu.some(val => itemVal.includes(normalize(val)) || normalize(val).includes(itemVal));
        if (!match) return false;
      }
      if (filters.ssd.length && (!item.storage || !filters.ssd.some(val => (item.storage + '').replace(/\s+/g, '').toLowerCase().includes(val.replace(/\s+/g, '').toLowerCase())))) return false;
      if (filters.resolution.length) {
        // Lấy từ resolution hoặc display (nhiều data chỉ có display)
        let itemVal = '';
        if (item.resolution) itemVal = normalize(item.resolution);
        else if (item.display) itemVal = normalize(item.display);
        if (!itemVal) return false;
        // Mapping các chuẩn phân giải phổ biến
        function mapRes(str) {
          str = str.replace(/[^a-z0-9]/g, '');
          if (/fhd|fullhd|1920x1080/.test(str)) return 'fhd';
          if (/wqhd|2560x1440|2k/.test(str)) return 'wqhd';
          if (/4k|3840x2160/.test(str)) return '4k';
          if (/3k|2880x1800/.test(str)) return '3k';
          if (/qhd|1440p/.test(str)) return 'qhd';
          return str;
        }
        const itemRes = mapRes(itemVal);
        const match = filters.resolution.some(val => {
          const filterRes = mapRes(normalize(val));
          return itemRes === filterRes || itemRes.includes(filterRes) || filterRes.includes(itemRes);
        });
        if (!match) return false;
      }
      if (filters.os.length && (!item.os || !filters.os.includes(item.os))) return false;
      const price = item.price || 0;
      if (price < filters.price.min || price > filters.price.max) return false;
      return true;
    });
    lastFilteredList = filtered;
    currentPage = 1;
    showLaptopProductsFiltered(filtered);
  }

  // LAPTOP render filtered
  function showLaptopProductsFiltered(list) {
    const totalPages = Math.ceil(list.length / productsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    const startIdx = (currentPage - 1) * productsPerPage;
    const endIdx = startIdx + productsPerPage;
    let html = '';
    // Only restore scroll if paginating, not filtering
    let restoreScroll = false;
    if (typeof window._paginationScrollY !== 'undefined') {
      restoreScroll = true;
    }
    list.slice(startIdx, endIdx).forEach(item => {
      if (!item.name) return;
      let discount = item.old_price && item.price ? Math.round(100 * (item.old_price - item.price) / item.old_price) : 0;
      function getShortSpec(str) {
        if (!str) return '';
        return str
          .replace(/^(Intel |AMD |AMD Ryzen |Intel Core |NVIDIA |Radeon |Ryzen |ASUS |Chipset |Mainboard |Bo mạch chủ |Main |CPU |VGA |Card màn hình |Ổ cứng |SSD |HDD |RAM |Memory |Bộ nhớ |Ổ SSD |Ổ HDD )/i, '')
          .replace(/^Core /i, '')
          .replace(/^GeForce /i, '')
          .replace(/^Radeon /i, '')
          .replace(/^Ryzen /i, '')
          .replace(/^ASUS /i, '')
          .replace(/^Graphics /i, '')
          .replace(/^Processor /i, '')
          .replace(/^Ổ /i, '')
          .replace(/^Ổ đĩa /i, '')
          .replace(/^Ổ lưu trữ /i, '')
          .replace(/^Ổ cứng /i, '')
          .replace(/^Bộ nhớ /i, '')
          .trim();
      }
      const specsArr = [
        getShortSpec(item.cpu),
        getShortSpec(item.gpu),
        getShortSpec(item.screen_size),
        getShortSpec(item.ram),
        getShortSpec(item.storage)
      ].filter(Boolean);
      const iconMap = [
        '<i class="bi bi-cpu"></i>',
        '<i class="bi bi-gpu-card"></i>',
        '<i class="bi bi-laptop"></i>',
        '<i class="bi bi-memory"></i>',
        '<i class="bi bi-hdd"></i>'
      ];
      let specsText = '<div class="specs-grid">';
      for (let i = 0; i < 5; i += 2) {
        specsText += '<div class="specs-row">';
        if (specsArr[i]) {
          specsText += `<span class="spec-item">${iconMap[i] || ''} ${specsArr[i]}</span>`;
        } else {
          specsText += '<span class="spec-item"></span>';
        }
        if (specsArr[i+1]) {
          specsText += `<span class="spec-item">${iconMap[i+1] || ''} ${specsArr[i+1]}</span>`;
        } else {
          specsText += '<span class="spec-item"></span>';
        }
        specsText += '</div>';
      }
      specsText += '</div>';
      html += `
        <div class="col-12 col-sm-6 col-md-4 col-lg-3 mb-4 d-flex">
          <div class="product-card neon-border p-3 d-flex flex-column w-100 animate__animated animate__fadeInUp" style="align-items:stretch;">
            <div class="product-image mb-2 mx-auto d-flex align-items-center justify-content-center" style="width:100%;max-width:220px;min-height:120px;">
              <img src="${item.image || '#'}" alt="${item.name}" style="border-radius:8px;border:2px solid #e0e0e0;max-height:120px;object-fit:contain;background:#fff;width:100%;" loading="lazy">
            </div>
            <div class="product-name fw-bold mb-1 clamp-2" style="font-size:1.02rem;min-height:38px;color:var(--primary);text-shadow:0 1px 4px var(--bg-gradient);text-align:left;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${item.name}</div>
            <div class="product-specs-box mb-2 mx-auto" style="font-size:0.82rem; border-radius:7px; padding:7px 10px; min-height:28px;max-width:95%">${specsText}</div>
            <div class="d-flex align-items-center justify-content-between mb-1 w-100 gap-2">
              <span class="original-price" style="font-size:0.93em;color:var(--secondary,#aaa);text-decoration:line-through;">${item.old_price ? item.old_price.toLocaleString('vi-VN') + '₫' : ''}</span>
              ${discount > 0 ? `<span class="discount-badge ms-auto" style="font-size:0.85em;background:var(--bg-gradient,#fff0f0);color:var(--accent,#e53935);border:1px solid var(--accent,#e53935);">-${discount}%</span>` : ''}
            </div>
            <div class="sale-price mb-1" style="font-size:1.18rem;font-weight:700;color:var(--accent,#e53935);text-align:left;">${item.price ? item.price.toLocaleString('vi-VN') + '₫' : 'Liên hệ'}</div>
            <div class="product-rating mb-0 w-100" style="font-size:0.98rem;color:var(--accent,#ff9900);text-align:left;">
              <span><i class="fa fa-star"></i> 0.0</span> <span style="color:var(--secondary,#b0b0b0);font-size:0.95em;">(0 đánh giá)</span>
            </div>
          </div>
        </div>
      `;
    });
    document.getElementById('product-list').innerHTML = html || '<div class="text-center">Không có sản phẩm phù hợp.</div>';
    renderLaptopPagination(list.length, totalPages);
    if (restoreScroll) {
      setTimeout(() => {
        window.scrollTo({ top: window._paginationScrollY });
        delete window._paginationScrollY;
      }, 0);
    }
  }

  // LAPTOP pagination
  function renderLaptopPagination(totalItems, totalPages) {
    const pagBar = document.getElementById('pagination-bar');
    if (!pagBar) return;
    let html = '';
    if (totalPages <= 1) {
      pagBar.innerHTML = '';
      return;
    }
    // Jump to first
    html += `<li class="page-item${currentPage === 1 ? ' disabled' : ''}"><a class="page-link" href="#" data-page="first">&laquo;</a></li>`;
    // Prev page
    html += `<li class="page-item${currentPage === 1 ? ' disabled' : ''}"><a class="page-link" href="#" data-page="prev">&lt;</a></li>`;
    // Only show 1, 2, 3
    for (let i = 1; i <= Math.min(3, totalPages); i++) {
      html += `<li class="page-item${i === currentPage ? ' active' : ''}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
    }
    // Next page
    html += `<li class="page-item${currentPage === totalPages ? ' disabled' : ''}"><a class="page-link" href="#" data-page="next">&gt;</a></li>`;
    // Jump to last
    html += `<li class="page-item${currentPage === totalPages ? ' disabled' : ''}"><a class="page-link" href="#" data-page="last">&raquo;</a></li>`;
    pagBar.innerHTML = html;
    pagBar.querySelectorAll('a.page-link').forEach(link => {
      link.onclick = function(e) {
        e.preventDefault();
        let page = this.getAttribute('data-page');
        window._paginationScrollY = window.scrollY;
        // Always recalculate totalPages based on current filtered list
        let total = (typeof lastFilteredList !== 'undefined' && lastFilteredList.length) ? lastFilteredList.length : (window.laptopData ? window.laptopData.length : 0);
        let pages = Math.ceil(total / productsPerPage) || 1;
        if (page === 'first') {
          currentPage = 1;
        } else if (page === 'last') {
          currentPage = pages;
        } else if (page === 'prev') {
          currentPage = Math.max(1, currentPage - 1);
        } else if (page === 'next') {
          currentPage = Math.min(pages, currentPage + 1);
        } else if (!isNaN(page)) {
          currentPage = parseInt(page);
        }
        if (typeof lastFilteredList !== 'undefined' && lastFilteredList.length) {
          showLaptopProductsFiltered(lastFilteredList);
        } else {
          showLaptopProducts('all');
        }
      };
    });
  }

  // Attach laptop filter events
  function attachLaptopFilterEvents() {
    // Gắn lại sự kiện cho tất cả checkbox trong sidebar laptop
    const laptopSidebar = document.querySelector('.laptop-sidebar');
    if (!laptopSidebar) return;
    const allCheckboxes = laptopSidebar.querySelectorAll('input[type="checkbox"]');
    allCheckboxes.forEach(cb => {
      const newCb = cb.cloneNode(true);
      cb.parentNode.replaceChild(newCb, cb);
    });
    laptopSidebar.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', filterLaptopProducts);
    });
    // Thanh kéo giá
    const priceSlider = document.getElementById('laptop-price-slider');
    if (priceSlider) {
      const newSlider = priceSlider.cloneNode(true);
      priceSlider.parentNode.replaceChild(newSlider, priceSlider);
      newSlider.addEventListener('input', function() {
        let val = parseInt(this.value, 10);
        document.getElementById('laptop-min-price').value = val.toLocaleString('vi-VN') + 'đ';
        filterLaptopProducts();
      });
    }
  }

  function filterPCProducts() {
    const filters = getSelectedFilters();
    let filtered = pcData.filter(item => {
      // Thương hiệu
      if (filters.brand.length && (!item.brand || !filters.brand.includes(item.brand))) return false;
      // Loại hàng
      if (filters.type.length && (!item.type || !filters.type.some(val => (item.type + '').includes(val)))) return false;
      // Series
      if (filters.series.length && (!item.series || !filters.series.some(val => (item.series + '').includes(val)))) return false;
      // Nhu cầu
      if (filters.need.length && (!item.need || !filters.need.some(val => (item.need + '').includes(val)))) return false;
      // PC Segment
      if (filters.segment.length && (!item.segment || !filters.segment.includes(item.segment))) return false;
  // Series CPU
  if (filters.cpuSeries.length && (!item.cpu || !filters.cpuSeries.some(val => (item.cpu + '').toLowerCase().includes(val.toLowerCase())))) return false;
      // Thế hệ CPU
      if (filters.cpuGen.length && (!item.cpu_gen || !filters.cpuGen.includes(item.cpu_gen))) return false;
      // RAM
      if (filters.ram.length && (!item.ram || !filters.ram.some(val => {
        // Chuẩn hóa: chỉ so sánh số và đơn vị GB
        const match = val.match(/(\d+)\s*GB/i);
        if (!match) return false;
        const num = match[1];
        return (item.ram + '').replace(/\s+/g, '').toLowerCase().includes(num + 'gb');
      }))) return false;
      // GPU
      if (filters.gpu.length && (!item.gpu || !filters.gpu.some(val => (item.gpu + '').includes(val)))) return false;
      // SSD
      if (filters.ssd.length && (!item.storage || !filters.ssd.some(val => {
        // Chuẩn hóa: chỉ so sánh số và đơn vị GB/TB
        const match = val.match(/(\d+)\s*(GB|TB)/i);
        if (!match) return false;
        const num = match[1];
        const unit = match[2].toLowerCase();
        return (item.storage + '').replace(/\s+/g, '').toLowerCase().includes(num + unit);
      }))) return false;
      // OS
      if (filters.os.length && (!item.os || !filters.os.includes(item.os))) return false;
      // Giá
      const price = item.price || 0;
      if (price < filters.price.min || price > filters.price.max) return false;
      return true;
    });
    lastFilteredList = filtered;
    currentPage = 1;
    showPCProductsFiltered(filtered);
  }

  function showPCProductsFiltered(list) {
    const totalPages = Math.ceil(list.length / productsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    const startIdx = (currentPage - 1) * productsPerPage;
    const endIdx = startIdx + productsPerPage;
    let html = '';
    list.slice(startIdx, endIdx).forEach(item => {
      if (!item.name) return;
      let discount = item.old_price && item.price ? Math.round(100 * (item.old_price - item.price) / item.old_price) : 0;
      function getShortSpec(str) {
        if (!str) return '';
        return str
          .replace(/^(Intel |AMD |AMD Ryzen |Intel Core |NVIDIA |Radeon |Ryzen |ASUS |Chipset |Mainboard |Bo mạch chủ |Main |CPU |VGA |Card màn hình |Ổ cứng |SSD |HDD |RAM |Memory |Bộ nhớ |Ổ SSD |Ổ HDD )/i, '')
          .replace(/^Core /i, '')
          .replace(/^GeForce /i, '')
          .replace(/^Radeon /i, '')
          .replace(/^Ryzen /i, '')
          .replace(/^ASUS /i, '')
          .replace(/^Graphics /i, '')
          .replace(/^Processor /i, '')
          .replace(/^Ổ /i, '')
          .replace(/^Ổ đĩa /i, '')
          .replace(/^Ổ lưu trữ /i, '')
          .replace(/^Ổ cứng /i, '')
          .replace(/^Bộ nhớ /i, '')
          .trim();
      }
      const specsArr = [
        getShortSpec(item.cpu),
        getShortSpec(item.gpu),
        getShortSpec(item.mainboard),
        getShortSpec(item.ram),
        getShortSpec(item.storage)
      ].filter(Boolean);
      const iconMap = [
        '<i class="bi bi-cpu"></i>',
        '<i class="bi bi-gpu-card"></i>',
        '<i class="bi bi-motherboard"></i>',
        '<i class="bi bi-memory"></i>',
        '<i class="bi bi-hdd"></i>'
      ];
      let specsText = '<div class="specs-grid">';
      for (let i = 0; i < 5; i += 2) {
        specsText += '<div class="specs-row">';
        if (specsArr[i]) {
          specsText += `<span class="spec-item">${iconMap[i] || ''} ${specsArr[i]}</span>`;
        } else {
          specsText += '<span class="spec-item"></span>';
        }
        if (specsArr[i+1]) {
          specsText += `<span class="spec-item">${iconMap[i+1] || ''} ${specsArr[i+1]}</span>`;
        } else {
          specsText += '<span class="spec-item"></span>';
        }
        specsText += '</div>';
      }
      specsText += '</div>';
      html += `
        <div class="col-12 col-sm-6 col-md-4 col-lg-3 mb-4 d-flex">
          <div class="product-card neon-border p-3 d-flex flex-column w-100 animate__animated animate__fadeInUp" style="align-items:stretch;">
            <div class="product-image mb-2 mx-auto d-flex align-items-center justify-content-center" style="width:100%;max-width:220px;min-height:120px;">
              <img src="${item.image || '#'}" alt="${item.name}" style="border-radius:8px;border:2px solid #e0e0e0;max-height:120px;object-fit:contain;background:#fff;width:100%;" loading="lazy">
            </div>
            <div class="product-name fw-bold mb-1 clamp-2" style="font-size:1.02rem;min-height:38px;color:var(--primary);text-shadow:0 1px 4px var(--bg-gradient);text-align:left;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${item.name}</div>
            <div class="product-specs-box mb-2 mx-auto" style="font-size:0.82rem; border-radius:7px; padding:7px 10px; min-height:28px;max-width:95%">${specsText}</div>
            <div class="d-flex align-items-center justify-content-between mb-1 w-100 gap-2">
              <span class="original-price" style="font-size:0.93em;color:var(--secondary,#aaa);text-decoration:line-through;">${item.old_price ? item.old_price.toLocaleString('vi-VN') + '₫' : ''}</span>
              ${discount > 0 ? `<span class="discount-badge ms-auto" style="font-size:0.85em;background:var(--bg-gradient,#fff0f0);color:var(--accent,#e53935);border:1px solid var(--accent,#e53935);">-${discount}%</span>` : ''}
            </div>
            <div class="sale-price mb-1" style="font-size:1.18rem;font-weight:700;color:var(--accent,#e53935);text-align:left;">${item.price ? item.price.toLocaleString('vi-VN') + '₫' : 'Liên hệ'}</div>
            <div class="product-rating mb-0 w-100" style="font-size:0.98rem;color:var(--accent,#ff9900);text-align:left;">
              <span><i class="fa fa-star"></i> 0.0</span> <span style="color:var(--secondary,#b0b0b0);font-size:0.95em;">(0 đánh giá)</span>
            </div>
          </div>
        </div>
      `;
    });
    document.getElementById('product-list').innerHTML = html || '<div class="text-center">Không có sản phẩm phù hợp.</div>';
    renderPagination(list.length, totalPages);
  }

  function renderPagination(totalItems, totalPages) {
    const pagBar = document.getElementById('pagination-bar');
    if (!pagBar) return;
    let html = '';
    if (totalPages <= 1) {
      pagBar.innerHTML = '';
      return;
    }
    // Prev
    html += `<li class="page-item${currentPage === 1 ? ' disabled' : ''}"><a class="page-link" href="#" data-page="prev">&laquo;</a></li>`;
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 2) {
        html += `<li class="page-item${i === currentPage ? ' active' : ''}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
      } else if (i === 2 && currentPage > 4) {
        html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
      } else if (i === totalPages - 1 && currentPage < totalPages - 3) {
        html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
      }
    }
    // Next
    html += `<li class="page-item${currentPage === totalPages ? ' disabled' : ''}"><a class="page-link" href="#" data-page="next">&raquo;</a></li>`;
    pagBar.innerHTML = html;
    // Sự kiện click
    pagBar.querySelectorAll('a.page-link').forEach(link => {
      link.onclick = function(e) {
        e.preventDefault();
        let page = this.getAttribute('data-page');
        if (page === 'prev' && currentPage > 1) currentPage--;
        else if (page === 'next' && currentPage < totalPages) currentPage++;
        else if (!isNaN(page)) currentPage = parseInt(page);
        // Nếu đang ở filter, phân trang lại danh sách đã lọc
        if (typeof lastFilteredList !== 'undefined' && lastFilteredList.length) {
          showPCProductsFiltered(lastFilteredList);
        } else {
          showPCProducts('all');
        }
      };
    });
  }

  // Gắn sự kiện cho các filter
  function attachFilterEvents() {
    // Checkbox
    document.querySelectorAll('.product-sidebar input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', filterPCProducts);
    });
    // Price slider
    const priceSlider = document.getElementById('price-slider');
    if (priceSlider) {
      priceSlider.addEventListener('input', function() {
        // Cập nhật min-price
        let val = parseInt(this.value, 10);
        document.getElementById('min-price').value = val.toLocaleString('vi-VN') + 'đ';
        filterPCProducts();
      });
    }
  }

  // Khi dữ liệu đã load xong, gắn sự kiện filter
  const oldRenderPCProducts = window.renderPCProducts;
  window.renderPCProducts = function(category = 'all') {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type') || 'pc';
    let dataFile = 'pc-part-dataset/processed/pc.json';
    if (type === 'laptop') dataFile = 'pc-part-dataset/processed/laptop.json';
    fetch(dataFile)
      .then(res => res.json())
      .then(data => {
        pcData = data;
        currentPage = 1;
        if (type === 'laptop') {
          filterLaptopProducts();
          attachLaptopFilterEvents();
        } else {
          filterPCProducts();
          attachFilterEvents();
        }
      });
  };
  // Đảm bảo chỉ có 1 thanh kéo, cập nhật giá trị min-price khi kéo
  const priceSlider = document.getElementById('price-slider');
  const minPriceInput = document.getElementById('min-price');
  const maxPriceInput = document.getElementById('max-price');
  if (priceSlider && minPriceInput && maxPriceInput) {
    priceSlider.addEventListener('input', function() {
      let val = parseInt(this.value, 10);
      minPriceInput.value = val.toLocaleString('vi-VN') + 'đ';
      // maxPrice luôn là 200.000.000đ
    });
  }

  // Collapse/expand filter sections
  function setupCollapsibleSections() {
    // Bỏ qua nhóm đầu tiên (Khoảng giá)
    var titles = Array.from(document.querySelectorAll('.sidebar-title.collapsible'));
    if (titles.length && titles[0].textContent.trim().includes('Khoảng giá')) {
      titles = titles.slice(1);
    }
    titles.forEach(function(title) {
      const section = title.closest('.filter-section');
      // Find all .row.g-2.mb-2 and .filter-options inside this section (not just the first)
      const optionsList = Array.from(section.querySelectorAll('.row.g-2.mb-2, .filter-options'));
      if (!optionsList.length) return;
      title.style.cursor = 'pointer';
      // Collapse all by default
      optionsList.forEach(opt => opt.style.display = 'none');
      // Set correct arrow (right for collapsed)
      const icon = title.querySelector('i.fa');
      if (icon) {
        icon.classList.remove('fa-angle-down');
        icon.classList.add('fa-angle-right');
      }
      title.addEventListener('click', function(e) {
        e.preventDefault();
        // Toggle only this section
        const isCollapsed = optionsList[0].style.display === 'none';
        optionsList.forEach(opt => opt.style.display = isCollapsed ? '' : 'none');
        if (icon) {
          icon.classList.toggle('fa-angle-down', isCollapsed);
          icon.classList.toggle('fa-angle-right', !isCollapsed);
        }
      });
    });
  }

  // Gọi các hàm khởi tạo khi DOM đã sẵn sàng
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setupCollapsibleSections();
      renderPCProducts();
    });
  } else {
    setupCollapsibleSections();
    renderPCProducts();
  }
}
// ================== END KHỞI TẠO TOÀN BỘ LOGIC TRANG ALLPRODUCTS ==================
// Load header & footer
document.addEventListener("DOMContentLoaded", function () {
    loadPagePart("HTML/Layout/resetheader.html", "#header-container", () => {
        if (typeof initHeader === 'function') initHeader();
        if (typeof initializeUser === 'function') initializeUser();
    });

    loadPagePart("HTML/Layout/resetfooter.html", "#footer-container", () => {
        if (typeof initFooter === 'function') initFooter();
    });

    // Thanh giá
    const priceRange = document.getElementById("priceRange");
    const priceMin = document.getElementById("priceMin");
    const priceMax = document.getElementById("priceMax");

    priceRange.addEventListener("input", () => {
        priceMax.textContent = Number(priceRange.value).toLocaleString();
    });
});

// Hàm load page part (dùng lại từ resetshowroom.js)
function loadPagePart(url, selector, callback = null, executeScripts = true) {
    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
            return response.text();
        })
        .then(data => {
            const container = document.querySelector(selector);
            if (container) {
                container.innerHTML = data;
                if (executeScripts) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = data;
                    const scripts = tempDiv.querySelectorAll('script');
                    scripts.forEach(oldScript => {
                        const newScript = document.createElement('script');
                        if (oldScript.src) {
                            if (!document.querySelector(`script[src="${oldScript.src}"]`)) {
                                newScript.src = oldScript.src;
                                newScript.defer = true;
                                document.body.appendChild(newScript);
                            }
                        } else {
                            newScript.textContent = oldScript.textContent;
                            document.body.appendChild(newScript);
                        }
                    });
                }
                if (typeof callback === 'function') callback();
            }
        })
        .catch(error => console.error(`Lỗi khi tải ${url}:`, error));
}

// ================== XỬ LÝ HIỂN THỊ SẢN PHẨM ==================
let pcData = [];
let currentPage = 1;
const productsPerPage = 44;
let lastFilteredList = [];

function renderPCProducts(category = 'all') {
  // Lấy tham số type trên URL
  const params = new URLSearchParams(window.location.search);
  const type = params.get('type') || 'pc';
  let dataFile = 'pc-part-dataset/processed/pc.json';
  if (type === 'laptop') dataFile = 'pc-part-dataset/processed/laptop.json';

  fetch(dataFile)
    .then(res => res.json())
    .then(data => {
      if (type === 'laptop') {
        window.laptopData = data;
        pcData = data;
        currentPage = 1;
        filterLaptopProducts();
        attachLaptopFilterEvents && attachLaptopFilterEvents();
      } else {
        pcData = data;
        currentPage = 1;
        filterPCProducts();
        attachFilterEvents && attachFilterEvents();
      }
    });
}

function filterPCProducts() {
  const filters = getSelectedFilters();
  let filtered = pcData.filter(item => {
    // Thương hiệu
    if (filters.brand.length && (!item.brand || !filters.brand.includes(item.brand))) return false;
    // Loại hàng
    if (filters.type.length && (!item.type || !filters.type.some(val => (item.type + '').includes(val)))) return false;
    // Series
    if (filters.series.length && (!item.series || !filters.series.some(val => (item.series + '').includes(val)))) return false;
    // Nhu cầu
    if (filters.need.length && (!item.need || !filters.need.some(val => (item.need + '').includes(val)))) return false;
    // PC Segment
    if (filters.segment.length && (!item.segment || !filters.segment.includes(item.segment))) return false;
  // Series CPU
  if (filters.cpuSeries.length && (!item.cpu || !filters.cpuSeries.some(val => (item.cpu + '').toLowerCase().includes(val.toLowerCase())))) return false;
      // Thế hệ CPU
      if (filters.cpuGen.length && (!item.cpu_gen || !filters.cpuGen.includes(item.cpu_gen))) return false;
      // RAM
      if (filters.ram.length && (!item.ram || !filters.ram.some(val => {
        const match = val.match(/(\d+)\s*GB/i);
        if (!match) return false;
        const num = match[1];
        return (item.ram + '').replace(/\s+/g, '').toLowerCase().includes(num + 'gb');
      }))) return false;
      // GPU
      if (filters.gpu.length && (!item.gpu || !filters.gpu.some(val => (item.gpu + '').includes(val)))) return false;
      // SSD
      if (filters.ssd.length && (!item.storage || !filters.ssd.some(val => {
        const match = val.match(/(\d+)\s*(GB|TB)/i);
        if (!match) return false;
        const num = match[1];
        const unit = match[2].toLowerCase();
        return (item.storage + '').replace(/\s+/g, '').toLowerCase().includes(num + unit);
      }))) return false;
      // OS
      if (filters.os.length && (!item.os || !filters.os.includes(item.os))) return false;
      // Giá
      const price = item.price || 0;
      if (price < filters.price.min || price > filters.price.max) return false;
      return true;
    });
    lastFilteredList = filtered;
    currentPage = 1;
    showPCProductsFiltered(filtered);
}

function showPCProductsFiltered(list) {
  const totalPages = Math.ceil(list.length / productsPerPage) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  const startIdx = (currentPage - 1) * productsPerPage;
  const endIdx = startIdx + productsPerPage;
  let html = '';
  // Only restore scroll if paginating, not filtering
  let restoreScroll = false;
  if (typeof window._paginationScrollY !== 'undefined') {
    restoreScroll = true;
  }
  list.slice(startIdx, endIdx).forEach(item => {
    if (!item.name) return;
    let discount = item.old_price && item.price ? Math.round(100 * (item.old_price - item.price) / item.old_price) : 0;
    function getShortSpec(str) {
      if (!str) return '';
      return str
        .replace(/^(Intel |AMD |AMD Ryzen |Intel Core |NVIDIA |Radeon |Ryzen |ASUS |Chipset |Mainboard |Bo mạch chủ |Main |CPU |VGA |Card màn hình |Ổ cứng |SSD |HDD |RAM |Memory |Bộ nhớ |Ổ SSD |Ổ HDD )/i, '')
        .replace(/^Core /i, '')
        .replace(/^GeForce /i, '')
        .replace(/^Radeon /i, '')
        .replace(/^Ryzen /i, '')
        .replace(/^ASUS /i, '')
        .replace(/^Graphics /i, '')
        .replace(/^Processor /i, '')
        .replace(/^Ổ /i, '')
        .replace(/^Ổ đĩa /i, '')
        .replace(/^Ổ lưu trữ /i, '')
        .replace(/^Ổ cứng /i, '')
        .replace(/^Bộ nhớ /i, '')
        .trim();
    }
    const specsArr = [
      getShortSpec(item.cpu),
      getShortSpec(item.gpu),
      getShortSpec(item.mainboard),
      getShortSpec(item.ram),
      getShortSpec(item.storage)
    ].filter(Boolean);
    const iconMap = [
      '<i class="bi bi-cpu"></i>',
      '<i class="bi bi-gpu-card"></i>',
      '<i class="bi bi-motherboard"></i>',
      '<i class="bi bi-memory"></i>',
      '<i class="bi bi-hdd"></i>'
    ];
    let specsText = '<div class="specs-grid">';
    for (let i = 0; i < 5; i += 2) {
      specsText += '<div class="specs-row">';
      if (specsArr[i]) {
        specsText += `<span class="spec-item">${iconMap[i] || ''} ${specsArr[i]}</span>`;
      } else {
        specsText += '<span class="spec-item"></span>';
      }
      if (specsArr[i+1]) {
        specsText += `<span class="spec-item">${iconMap[i+1] || ''} ${specsArr[i+1]}</span>`;
      } else {
        specsText += '<span class="spec-item"></span>';
      }
      specsText += '</div>';
    }
    specsText += '</div>';
    html += `
      <div class="col-12 col-sm-6 col-md-4 col-lg-3 mb-4 d-flex">
        <div class="product-card neon-border p-3 d-flex flex-column w-100 animate__animated animate__fadeInUp" style="align-items:stretch;">
          <div class="product-image mb-2 mx-auto d-flex align-items-center justify-content-center" style="width:100%;max-width:220px;min-height:120px;">
            <img src="${item.image || '#'}" alt="${item.name}" style="border-radius:8px;border:2px solid #e0e0e0;max-height:120px;object-fit:contain;background:#fff;width:100%;" loading="lazy">
          </div>
          <div class="product-name fw-bold mb-1 clamp-2" style="font-size:1.02rem;min-height:38px;color:var(--primary);text-shadow:0 1px 4px var(--bg-gradient);text-align:left;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${item.name}</div>
          <div class="product-specs-box mb-2 mx-auto" style="font-size:0.82rem; border-radius:7px; padding:7px 10px; min-height:28px;max-width:95%">${specsText}</div>
          <div class="d-flex align-items-center justify-content-between mb-1 w-100 gap-2">
            <span class="original-price" style="font-size:0.93em;color:var(--secondary,#aaa);text-decoration:line-through;">${item.old_price ? item.old_price.toLocaleString('vi-VN') + '₫' : ''}</span>
            ${discount > 0 ? `<span class="discount-badge ms-auto" style="font-size:0.85em;background:var(--bg-gradient,#fff0f0);color:var(--accent,#e53935);border:1px solid var(--accent,#e53935);">-${discount}%</span>` : ''}
          </div>
          <div class="sale-price mb-1" style="font-size:1.18rem;font-weight:700;color:var(--accent,#e53935);text-align:left;">${item.price ? item.price.toLocaleString('vi-VN') + '₫' : 'Liên hệ'}</div>
          <div class="product-rating mb-0 w-100" style="font-size:0.98rem;color:var(--accent,#ff9900);text-align:left;">
            <span><i class="fa fa-star"></i> 0.0</span> <span style="color:var(--secondary,#b0b0b0);font-size:0.95em;">(0 đánh giá)</span>
          </div>
        </div>
      </div>
    `;
  });
  document.getElementById('product-list').innerHTML = html || '<div class="text-center">Không có sản phẩm phù hợp.</div>';
  renderPagination(list.length, totalPages);
  if (restoreScroll) {
    setTimeout(() => {
      window.scrollTo({ top: window._paginationScrollY });
      delete window._paginationScrollY;
    }, 0);
  }
}

function renderPagination(totalItems, totalPages) {
  const pagBar = document.getElementById('pagination-bar');
  if (!pagBar) return;
  let html = '';
  if (totalPages <= 1) {
    pagBar.innerHTML = '';
    return;
  }
  // Jump to first
  html += `<li class="page-item${currentPage === 1 ? ' disabled' : ''}"><a class="page-link" href="#" data-page="first">&laquo;</a></li>`;
  // Prev page
  html += `<li class="page-item${currentPage === 1 ? ' disabled' : ''}"><a class="page-link" href="#" data-page="prev">&lt;</a></li>`;
  // Only show 1, 2, 3
  for (let i = 1; i <= Math.min(3, totalPages); i++) {
    html += `<li class="page-item${i === currentPage ? ' active' : ''}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
  }
  // Next page
  html += `<li class="page-item${currentPage === totalPages ? ' disabled' : ''}"><a class="page-link" href="#" data-page="next">&gt;</a></li>`;
  // Jump to last
  html += `<li class="page-item${currentPage === totalPages ? ' disabled' : ''}"><a class="page-link" href="#" data-page="last">&raquo;</a></li>`;
  pagBar.innerHTML = html;
  pagBar.querySelectorAll('a.page-link').forEach(link => {
    link.onclick = function(e) {
      e.preventDefault();
      let page = this.getAttribute('data-page');
      window._paginationScrollY = window.scrollY;
      // Always recalculate totalPages based on current filtered list
      let total = (typeof lastFilteredList !== 'undefined' && lastFilteredList.length) ? lastFilteredList.length : (pcData ? pcData.length : 0);
      let pages = Math.ceil(total / productsPerPage) || 1;
      if (page === 'first') {
        currentPage = 1;
      } else if (page === 'last') {
        currentPage = pages;
      } else if (page === 'prev') {
        currentPage = Math.max(1, currentPage - 1);
      } else if (page === 'next') {
        currentPage = Math.min(pages, currentPage + 1);
      } else if (!isNaN(page)) {
        currentPage = parseInt(page);
      }
      if (typeof lastFilteredList !== 'undefined' && lastFilteredList.length) {
        showPCProductsFiltered(lastFilteredList);
      } else {
        showPCProducts('all');
      }
    };
  });
}

function filterCategory(cat) {
  showPCProducts(cat);
}
// ================== END XỬ LÝ SẢN PHẨM ==================
