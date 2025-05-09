let reviewCounter = 0; // Mặc định là 0 đánh giá

const reviewForm = document.getElementById("reviewForm");
const reviewDisplay = document.getElementById("reviewDisplay");
reviewForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const nameInput = document.getElementById("name");
    const ratingInput = document.getElementById("rating");
    const commentInput = document.getElementById("comment");

    const name = nameInput.value.trim();
    const rating = parseInt(ratingInput.value);
    const comment = commentInput.value.trim();

    if (!name || !rating) {
        alert('Vui lòng điền đầy đủ thông tin!');
        return;
    }

    const reviewItem = document.createElement("div");
    reviewItem.className = "review-item";

    let starsHTML = "";
    for (let i = 0; i < 5; i++) {
        starsHTML += (i < rating) ? "<i class='bx bxs-star'></i>" : "<i class='bx bx-star'></i>";
    }

    const currentDate = getFormattedDate();

    reviewItem.innerHTML = `
        <div class="review-name"><i class='bx bx-user'></i> ${name}</div>
        <div class="review-stars">${starsHTML}</div>
        ${comment ? `<div class="review-comment">${comment}</div>` : ""}
        <div class="review-date"><i class='bx bx-time'></i> ${currentDate}</div>
    `;

    reviewDisplay.prepend(reviewItem);
    reviewCounter++;
    document.getElementById("reviewCount").textContent = `(${reviewCounter} đánh giá)`;

    // 🔄 Làm mới form:
    this.reset(); // Reset tất cả input, textarea
    ratingText.textContent = ""; // Xóa mô tả đánh giá
    stars.forEach(s => s.classList.remove('selected')); // Gỡ sao được chọn
});


    const stars = document.querySelectorAll('.star-rating span');
    const ratingInput = document.getElementById('rating');
    const ratingText = document.getElementById('rating-text');

    const descriptions = {
    1: "Rất tệ 😞",
    2: "Tệ 🙁",
    3: "Bình thường 😐",
    4: "Tốt 🙂",
    5: "Tuyệt vời 😍"
};

    stars.forEach(star => {
    star.addEventListener('mouseover', () => {
        const value = parseInt(star.getAttribute('data-value'));
        stars.forEach(s => {
            s.classList.toggle('hovered', parseInt(s.getAttribute('data-value')) <= value);
        });
    });

    star.addEventListener('mouseout', () => {
    stars.forEach(s => s.classList.remove('hovered'));
});

    star.addEventListener('click', () => {
    const selectedValue = parseInt(star.getAttribute('data-value'));
    ratingInput.value = selectedValue;
    stars.forEach(s => {
    s.classList.toggle('selected', parseInt(s.getAttribute('data-value')) <= selectedValue);
});
    ratingText.textContent = descriptions[selectedValue];
});
});
    function getFormattedDate() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} - ${hour}:${minute}`;
}
