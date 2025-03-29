document.addEventListener("DOMContentLoaded", function () {
    const menuIcon = document.querySelector(".menu-icon");
    const menuList = document.querySelector(".menu-list");

    menuIcon.addEventListener("click", function () {
        menuList.style.display = menuList.style.display === "block" ? "none" : "block";
    });
});
