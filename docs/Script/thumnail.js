document.addEventListener("DOMContentLoaded", function () {
    const thumbnails = document.querySelectorAll(".thumbnail");
    const mainImage = document.getElementById("mainImage");
    const thumbnailWrapper = document.querySelector(".thumbnail-wrapper");
    const prevButton = document.querySelector(".prev");
    const nextButton = document.querySelector(".next");

    // Thay đổi ảnh lớn khi click vào thumbnail
    thumbnails.forEach(thumbnail => {
        thumbnail.addEventListener("click", function () {
            mainImage.src = this.src;
            thumbnails.forEach(img => img.classList.remove("active"));
            this.classList.add("active");
        });
    });
    
    // Chức năng cuộn thumbnails
    let scrollAmount = 0;
    const scrollStep = 100;

    prevButton.addEventListener("click", function () {
        if (thumbnailWrapper) {
            scrollAmount -= scrollStep;
            thumbnailWrapper.scrollTo({ left: scrollAmount, behavior: "smooth" });
        }
    });

    nextButton.addEventListener("click", function () {
        if (thumbnailWrapper) {
            scrollAmount += scrollStep;
            thumbnailWrapper.scrollTo({ left: scrollAmount, behavior: "smooth" });
        }
    });
});
