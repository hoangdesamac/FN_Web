// js_MenuClick.js - Xử lý menu đa cấp và hiển thị sản phẩm

// === Các hàm xử lý menu và lọc sản phẩm ===
function toggleCategoryHeader() {
    const menuList = document.getElementById('menuList');
    if (menuList) menuList.classList.toggle('show');
}

// Hàm tạo breadcrumb
function createBreadcrumb(category, subcategory = null) {
    const breadcrumbContainer = document.createElement('div');
    breadcrumbContainer.className = 'breadcrumb-container';

    let html = '';

    // Link trang chủ
    html += `
        <a href="javascript:void(0)" onclick="returnToHome()" class="breadcrumb-item">
            <i class="bx bx-home"></i> Trang chủ
        </a>
        <span class="breadcrumb-separator">
            <i class="bx bx-chevron-right"></i>
        </span>
    `;

    if (subcategory) {
        // Trường hợp có danh mục con: Trang chủ -> Danh mục cha -> Danh mục con
        html += `
            <a href="javascript:void(0)" onclick="filterProducts('semiconductor')" class="breadcrumb-item">
                ${category}
            </a>
            <span class="breadcrumb-separator">
                <i class="bx bx-chevron-right"></i>
            </span>
            <span class="breadcrumb-item current">${subcategory}</span>
        `;
    } else {
        // Trường hợp chỉ có danh mục cha: Trang chủ -> Danh mục cha
        html += `<span class="breadcrumb-item current">${category}</span>`;
    }

    breadcrumbContainer.innerHTML = html;
    return breadcrumbContainer;
}

// Hàm lọc sản phẩm theo danh mục
function filterProducts(category, subcategory = null) {
    // Đóng menu danh mục sau khi chọn
    const menuList = document.getElementById('menuList');
    if (menuList && menuList.classList.contains('show')) {
        menuList.classList.remove('show');
    }

    console.log(`Filtering products: ${category}${subcategory ? ' - ' + subcategory : ''}`);

    // Xóa breadcrumb cũ nếu có
    const existingBreadcrumb = document.querySelector('.breadcrumb-container');
    if (existingBreadcrumb) {
        existingBreadcrumb.remove();
    }

    // Ẩn tất cả các section trước
    const allSections = document.querySelectorAll('.product-section');
    allSections.forEach(section => {
        section.classList.add('hidden');
    });

    // Xử lý từng loại danh mục
    if (category === 'arduino') {
        // Hiển thị chỉ section Arduino
        const arduinoSection = document.querySelector('.product-section[data-category="arduino"]');
        if (arduinoSection) {
            arduinoSection.classList.remove('hidden');

            // Thêm breadcrumb
            const breadcrumb = createBreadcrumb('Arduino');
            const mainContent = document.querySelector('.main-content');
            mainContent.insertBefore(breadcrumb, mainContent.firstChild);

            // Cập nhật autoscroll cho section Arduino
            setTimeout(() => {
                if (typeof reInitializeAutoScroll === 'function') {
                    reInitializeAutoScroll('productGridArduino');
                }
            }, 300);
        }
    }
    else if ( category === 'maincpuvga') {
        // Hiển thị section Semiconductor
        const semiconductorSection = document.querySelector('.product-section[data-category="maincpuvga"]');
        if (semiconductorSection) {
            semiconductorSection.classList.remove('hidden');

            // Nếu có subcategory, chỉ hiển thị subcategory đó
            if (subcategory) {
                // Ẩn tất cả các subcategory container
                const allSubcategories = semiconductorSection.querySelectorAll('.subcategory-container');
                allSubcategories.forEach(sub => {
                    sub.classList.add('hidden');
                });

                // Hiển thị subcategory được chọn
                const selectedSubcategory = semiconductorSection.querySelector(`.subcategory-container[data-subcategory="${subcategory}"]`);
                if (selectedSubcategory) {
                    selectedSubcategory.classList.remove('hidden');

                    // Thêm breadcrumb với subcategory
                    const breadcrumb = createBreadcrumb('Main-CPU-VGA', subcategory);
                    const mainContent = document.querySelector('.main-content');
                    mainContent.insertBefore(breadcrumb, mainContent.firstChild);

                    // Khởi tạo lại autoscroll cho subcategory được chọn
                    setTimeout(() => {
                        if (typeof reInitializeAutoScroll === 'function') {
                            const gridId = `productGrid${subcategory}`;
                            console.log(`Khởi tạo lại auto-scroll cho ${gridId}`);
                            reInitializeAutoScroll(gridId);
                        }
                    }, 300);
                }
            } else {
                // Hiển thị tất cả subcategory
                const allSubcategories = semiconductorSection.querySelectorAll('.subcategory-container');
                allSubcategories.forEach(sub => {
                    sub.classList.remove('hidden');
                });

                // Thêm breadcrumb chỉ với category
                const breadcrumb = createBreadcrumb('Main-CPU-VGA');
                const mainContent = document.querySelector('.main-content');
                mainContent.insertBefore(breadcrumb, mainContent.firstChild);

                // Khởi tạo lại autoscroll cho tất cả subcategory
                setTimeout(() => {
                    if (typeof reInitializeAutoScroll === 'function') {
                        console.log("Khởi tạo lại auto-scroll cho tất cả subcategories");
                        reInitializeAutoScroll('productGridTransistor');
                        reInitializeAutoScroll('productGridDiode');
                        reInitializeAutoScroll('productGridIC');
                    }
                }, 300);
            }
        }
    }
    else {
        // Xử lý cho các danh mục khác trong tương lai
        // Ví dụ: Cảm biến, LED, v.v.
        const targetSection = document.querySelector(`.product-section[data-category="${category}"]`);
        if (targetSection) {
            targetSection.classList.remove('hidden');

            // Lấy tên danh mục từ tiêu đề section
            const categoryTitle = targetSection.querySelector('.section-title')?.textContent || category;

            // Thêm breadcrumb
            const breadcrumb = createBreadcrumb(categoryTitle);
            const mainContent = document.querySelector('.main-content');
            mainContent.insertBefore(breadcrumb, mainContent.firstChild);

            // Cập nhật autoscroll nếu có
            setTimeout(() => {
                if (typeof reInitializeAutoScroll === 'function') {
                    const productGrid = targetSection.querySelector('.product-grid');
                    if (productGrid && productGrid.id) {
                        reInitializeAutoScroll(productGrid.id);
                    }
                }
            }, 300);
        }
    }
}
function filterMainCpuVga(subcategory) {
    const section = document.getElementById("maincpuvga");
    const items = section.querySelectorAll(".product-item");

    items.forEach(item => {
        item.style.display = (item.dataset.subcategory === subcategory) ? "block" : "none";
    });
}


// Hàm quay về trang chủ
function returnToHome() {
    console.log("Returning to home");

    // Xóa breadcrumb
    const breadcrumb = document.querySelector('.breadcrumb-container');
    if (breadcrumb) {
        breadcrumb.remove();
    }

    // Hiển thị tất cả các section (trừ semiconductor)
    const regularSections = document.querySelectorAll('.product-section:not([data-category="semiconductor"])');
    regularSections.forEach(section => {
        section.classList.remove('hidden');
    });

    // Ẩn section semiconductor
    const semiconductorSection = document.querySelector('.product-section[data-category="semiconductor"]');
    if (semiconductorSection) {
        semiconductorSection.classList.add('hidden');
    }

    // Khởi tạo lại auto-scroll cho các section chính
    setTimeout(() => {
        if (typeof window.initializeAutoScroll === 'function') {
            window.initializeAutoScroll();
        }
    }, 300);
}

// === Thiết lập menu dropdown ===
function setupDropdownMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const menuList = document.getElementById('menuList');
    const menuItems = document.querySelectorAll('.menu-item');

    if (!menuToggle || !menuList) {
        console.warn("Menu elements not found");
        return;
    }

    // Đảm bảo toggle button hoạt động
    menuToggle.onclick = function(e) {
        e.stopPropagation();
        toggleCategoryHeader();
    };

    // Thiết lập event cho từng menu
    menuItems.forEach(item => {
        // Lấy phần tử div parent trong menu-item
        const parentDiv = item.querySelector('div');
        if (parentDiv) {
            // Xử lý khi click vào menu cha
            parentDiv.addEventListener('click', function(e) {
                e.stopPropagation();

                // Mở/đóng submenu
                item.classList.toggle('open');

                // Lấy text của menu
                const menuText = parentDiv.querySelector('span')?.textContent;
                if (!menuText) return;

                // Ánh xạ tên menu với category id
                const menuMap = {
                    'Chuột': 'mouse',
                    'Bàn Phím': 'keyboard',
                    'Tai nghe': 'headphone',
                    'Màn Hình': 'monitor',
                    'Laptop': 'laptop',
                    'Case - Nguồn - Tản': 'casepowercooling',
                    'Main - CPU - VGA': 'maincpuvga',
                    'Ổ cứng - Ram - Thẻ nhớ': 'storage',
                    'Loa - Micro - Webcam': 'soundvideo',
                    'Phần mềm - Mạng': 'software',
                    'Handheld - Console': 'console',
                    'Phụ kiện': 'accessory',
                    'Dịch vụ và thông tin khác': 'others'
                };

                // Lọc sản phẩm nếu click vào menu cha
                if (menuMap[menuText]) {
                    filterProducts(menuMap[menuText]);
                }
            });
        }

        // Xử lý khi click vào submenu items
        const submenuItems = item.querySelectorAll('.submenu li');
        submenuItems.forEach(subItem => {
            subItem.addEventListener('click', function(e) {
                e.stopPropagation();

                // Lấy text của menu cha và submenu
                const parentText = item.querySelector('div span')?.textContent;
                const subText = subItem.textContent.trim();

                console.log(`Click vào submenu: ${parentText} > ${subText}`);

                // Có thể thêm xử lý cho các submenu khác ở đây
                if (parentText === 'Main - CPU - VGA') {
                    if (['Mainboard', 'CPU', 'Card đồ họa (VGA)'].includes(subText)) {
                        filterProducts('maincpuvga', subText);

                    }
                }


            });
        });
    });

    // Đóng menu khi click bên ngoài
    document.addEventListener('click', function(e) {
        if (menuList && !menuList.contains(e.target) && !menuToggle.contains(e.target)) {
            menuList.classList.remove('show');
        }
    });
}

// Khởi tạo menu khi DOM đã sẵn sàng
function initializeMenuSystem() {
    console.log("Initializing menu system...");
    setupDropdownMenu();

    // Kiểm tra xem có hash parameter trong URL không để lọc sản phẩm theo hash
    const hash = window.location.hash.substring(1);
    if (hash) {
        const parts = hash.split('-');
        if (parts.length === 1) {
            setTimeout(() => filterProducts(parts[0]), 500);
        } else if (parts.length === 2) {
            setTimeout(() => filterProducts(parts[0], parts[1]), 500);
        }
    }

    console.log("Menu system initialized");
}

// Xuất ra global scope
window.toggleCategoryHeader = toggleCategoryHeader;
window.filterProducts = filterProducts;
window.returnToHome = returnToHome;
window.setupDropdownMenu = setupDropdownMenu;
window.initializeMenuSystem = initializeMenuSystem;
window.createBreadcrumb = createBreadcrumb;