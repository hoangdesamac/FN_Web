document.addEventListener("DOMContentLoaded", () => {
    function openAuthModal() {
        let authModal = document.getElementById("authModal");

        if (!authModal) {
            console.error("⚠️ Không tìm thấy #authModal, đang thử tải lại...");
            loadHTML("auth-placeholder", "../HTML/Layout/auth.html");

            setTimeout(() => {
                authModal = document.getElementById("authModal");
                if (authModal) {
                    authModal.style.display = "flex";
                } else {
                    console.error("❌ Vẫn không tìm thấy #authModal!");
                }
            }, 1000); // Đợi 1s để file load xong
        } else {
            authModal.style.display = "flex";
        }
    }

    function closeAuthModal() {
        const authModal = document.getElementById("authModal");
        if (authModal) authModal.style.display = "none";
    }

    document.addEventListener("click", (event) => {
        if (event.target.classList.contains("login-btn") || event.target.classList.contains("register-btn")) {
            openAuthModal();
        }
        if (event.target.classList.contains("close-btn")) {
            closeAuthModal();
        }
    });
});
