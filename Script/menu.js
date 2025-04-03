document.addEventListener("DOMContentLoaded", function () {
    function setupMenu() {
        const menuToggle = document.getElementById("menuToggle");
        const menuList = document.getElementById("menuList");

        if (menuToggle && menuList) {
            menuToggle.addEventListener("click", function () {
                menuList.classList.toggle("active");
            });

            document.addEventListener("click", function (event) {
                if (!menuToggle.contains(event.target) && !menuList.contains(event.target)) {
                    menuList.classList.remove("active");
                }
            });
        }
    }

    function checkHeaderLoaded() {
        const menuToggle = document.getElementById("menuToggle");
        if (menuToggle) {
            setupMenu();
        } else {
            setTimeout(checkHeaderLoaded, 100); // Kiểm tra lại sau 100ms
        }
    }

    checkHeaderLoaded(); // Gọi kiểm tra xem header đã load chưa
});
