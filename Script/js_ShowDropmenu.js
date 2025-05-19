function setupDropdownMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const menuList = document.getElementById('menuList');
    const menuItems = document.querySelectorAll('.menu-item');
    const submenuItems = document.querySelectorAll('.submenu li');

    if (!menuToggle || !menuList) return;

    // Toggle hiển thị menu chính
    menuToggle.addEventListener('click', function (e) {
        e.stopPropagation();
        menuList.classList.toggle('show');
    });

    // Toggle từng menu cha (không đóng các cái khác)
    menuItems.forEach(item => {
        item.addEventListener('click', function (e) {
            item.classList.toggle('open');
            e.stopPropagation();
        });
    });

    // Ngăn submenu bị tắt khi click vào mục con
    submenuItems.forEach(sub => {
        sub.addEventListener('click', function (e) {
            e.stopPropagation();
            // Tùy ý xử lý, ví dụ: chuyển trang, active state, v.v.
            console.log("Bạn đã chọn:", sub.textContent.trim());
        });
    });

    // Click bên ngoài để đóng tất cả
    document.addEventListener('click', function (e) {
        if (!menuList.contains(e.target) && !menuToggle.contains(e.target)) {
            menuList.classList.remove('show');
            menuItems.forEach(item => item.classList.remove('open'));
        }
    });
}

// Khởi động khi DOM sẵn sàng
if (document.readyState !== 'loading') {
    setupDropdownMenu();
} else {
    document.addEventListener('DOMContentLoaded', setupDropdownMenu);
}
