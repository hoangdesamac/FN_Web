document.addEventListener("DOMContentLoaded", function () {
    function setupMenu() {
        const menuToggle = document.getElementById("menuToggle");
        const menuList = document.getElementById("menuList");

        if (menuToggle && menuList) {
            console.log("🎯 Menu đã tìm thấy, gán sự kiện click.");

            menuToggle.addEventListener("click", function (event) {
                event.stopPropagation();
                menuList.classList.toggle("active");
                console.log("📂 Danh mục đã bật/tắt.");
            });

            document.addEventListener("click", function (event) {
                if (!menuToggle.contains(event.target) && !menuList.contains(event.target)) {
                    menuList.classList.remove("active");
                    console.log("❌ Danh mục bị đóng.");
                }
            });
        } else {
            console.warn("⚠️ Không tìm thấy menuToggle hoặc menuList!");
        }
    }

    function checkHeaderLoaded() {
        if (document.getElementById("menuToggle")) {
            setupMenu();
        } else {
            setTimeout(checkHeaderLoaded, 100); // Kiểm tra lại sau 100ms
        }
    }

    checkHeaderLoaded();
});
