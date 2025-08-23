// ===== Helper load header/footer =====
function loadPagePart(url, selector, callback = null) {
    fetch(url)
        .then(res => res.text())
        .then(data => {
            const container = document.querySelector(selector);
            if (container) {
                container.innerHTML = data;

                // chạy lại script trong fragment
                const tempDiv = document.createElement("div");
                tempDiv.innerHTML = data;
                const scripts = tempDiv.querySelectorAll("script");
                scripts.forEach(oldScript => {
                    const newScript = document.createElement("script");
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
            if (typeof callback === "function") callback();
        })
        .catch(err => console.error(`Lỗi khi load ${url}:`, err));
}

// ===== Load profile data =====
let currentPhone = null;
let pendingPhone = null;
let phoneVerified = true; // flag xác minh số mới

async function loadProfile() {
    try {
        const res = await fetch(`${window.API_BASE}/api/me`, { credentials: "include" });
        const data = await res.json();

        if (!data.loggedIn) {
            window.location.href = "index.html";
            return;
        }

        const user = data.user;
        document.getElementById("firstName").value = user.firstName || "";
        document.getElementById("lastName").value = user.lastName || "";
        document.getElementById("email").value = user.email || "";
        document.getElementById("phone").value = user.phone || "";
        document.getElementById("gender").value = user.gender || "";
        document.getElementById("birthday").value = user.birthday || "";

        document.getElementById("sidebarAvatar").src =
            user.avatar_url || "https://via.placeholder.com/80?text=U";
        document.getElementById("sidebarName").textContent =
            `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Người dùng";

        currentPhone = user.phone || null;
        phoneVerified = true; // mặc định đã xác minh
    } catch (err) {
        console.error("Lỗi load profile:", err);
    }
}

// ===== Main =====
document.addEventListener("DOMContentLoaded", () => {
    // Load header + footer
    loadPagePart("HTML/Layout/resetheader.html", "#header-container", () => {
        if (typeof initHeader === "function") initHeader();
        if (typeof initializeUser === "function") initializeUser();
    });

    loadPagePart("HTML/Layout/resetfooter.html", "#footer-container", () => {
        if (typeof initFooter === "function") initFooter();
    });

    loadProfile();

    const editBtn = document.getElementById("editBtn");
    const saveBtn = document.getElementById("saveBtn");
    const phoneInput = document.getElementById("phone");
    const msgBox = document.getElementById("profileMessage");

    // OTP section & Send OTP button (đã có sẵn trong HTML)
    const otpSection = document.getElementById("otpSection");
    const sendOtpBtn = document.getElementById("sendOtpBtn");
    const verifyOtpBtn = document.getElementById("verifyOtpBtn");

    // Ban đầu ẩn
    otpSection.classList.add("d-none");
    sendOtpBtn.classList.add("d-none");

    // ===== Toggle edit mode =====
    editBtn.addEventListener("click", () => {
        const inputs = document.querySelectorAll("#profileForm input");
        inputs.forEach(input => {
            if (input.id !== "email") {
                input.removeAttribute("readonly");
            }
        });

        const genderSelect = document.getElementById("gender");
        genderSelect.classList.remove("readonly-select");

        saveBtn.classList.remove("d-none");
        editBtn.style.display = "none";

        // Cho phép gửi OTP khi edit
        sendOtpBtn.classList.remove("d-none");
    });

    // ===== Sự kiện thay đổi số điện thoại =====
    phoneInput.addEventListener("input", () => {
        const newPhone = phoneInput.value.trim();
        if (newPhone && newPhone !== currentPhone) {
            phoneVerified = false; // cần xác minh
            saveBtn.disabled = true; // disable nút lưu
        } else {
            phoneVerified = true;
            saveBtn.disabled = false;
        }
    });

    // ===== Gửi OTP =====
    sendOtpBtn.addEventListener("click", async () => {
        const newPhone = phoneInput.value.trim();
        if (!newPhone) {
            msgBox.textContent = "❌ Vui lòng nhập số điện thoại.";
            msgBox.className = "form-message text-danger fw-bold";
            return;
        }
        if (newPhone === currentPhone) {
            msgBox.textContent = "ℹ️ Số điện thoại chưa thay đổi.";
            msgBox.className = "form-message text-info fw-bold";
            return;
        }

        try {
            const res = await fetch(`${window.API_BASE}/api/send-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: newPhone })
            });
            const data = await res.json();
            if (data.success) {
                pendingPhone = newPhone;
                otpSection.classList.remove("d-none");
                msgBox.textContent = data.message;
                msgBox.className = "form-message text-success fw-bold";
            } else {
                msgBox.textContent = data.error || "❌ Lỗi gửi OTP!";
                msgBox.className = "form-message text-danger fw-bold";
            }
        } catch (err) {
            console.error("Lỗi gửi OTP:", err);
        }
    });

    // ===== Xác minh OTP =====
    verifyOtpBtn.addEventListener("click", async () => {
        const otp = document.getElementById("otpCode").value.trim();
        if (!pendingPhone || !otp) {
            msgBox.textContent = "❌ Vui lòng nhập OTP.";
            msgBox.className = "form-message text-danger fw-bold";
            return;
        }

        try {
            const res = await fetch(`${window.API_BASE}/api/verify-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: pendingPhone, otp })
            });
            const data = await res.json();
            if (data.success) {
                currentPhone = pendingPhone;
                pendingPhone = null;
                phoneVerified = true;
                saveBtn.disabled = false; // cho phép lưu
                otpSection.classList.add("d-none");
                msgBox.textContent = "✅ Số điện thoại đã xác minh!";
                msgBox.className = "form-message text-success fw-bold";
            } else {
                msgBox.textContent = data.error || "❌ Mã OTP không hợp lệ!";
                msgBox.className = "form-message text-danger fw-bold";
            }
        } catch (err) {
            console.error("Lỗi verify OTP:", err);
        }
    });

    // ===== Update profile =====
    document.getElementById("profileForm").addEventListener("submit", async e => {
        e.preventDefault();

        // Kiểm tra số điện thoại đã xác minh chưa
        if (!phoneVerified) {
            msgBox.textContent = "❌ Bạn cần xác minh số điện thoại mới trước khi lưu!";
            msgBox.className = "form-message text-danger fw-bold";
            return;
        }

        const body = {
            firstName: document.getElementById("firstName").value.trim(),
            lastName: document.getElementById("lastName").value.trim(),
            phone: phoneInput.value.trim(),
            gender: document.getElementById("gender").value,
            birthday: document.getElementById("birthday").value
        };

        try {
            const res = await fetch(`${window.API_BASE}/api/me`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(body)
            });
            const data = await res.json();

            if (data.success) {
                msgBox.textContent = "✅ Cập nhật thành công!";
                msgBox.className = "form-message text-success fw-bold";

                // cập nhật sidebar
                localStorage.setItem("firstName", data.user.firstName || "");
                localStorage.setItem("lastName", data.user.lastName || "");
                localStorage.setItem("email", data.user.email || "");
                if (data.user.avatar_url) {
                    localStorage.setItem("avatarUrl", data.user.avatar_url);
                }
                document.getElementById("sidebarAvatar").src =
                    data.user.avatar_url || "https://via.placeholder.com/80?text=U";
                document.getElementById("sidebarName").textContent =
                    `${data.user.firstName || ""} ${data.user.lastName || ""}`.trim() ||
                    "Người dùng";

                // Sau khi lưu thành công → khóa lại input
                const inputs = document.querySelectorAll("#profileForm input");
                inputs.forEach(input => input.setAttribute("readonly", true));
                document.getElementById("email").setAttribute("readonly", true);
                const genderSelect = document.getElementById("gender");
                genderSelect.classList.add("readonly-select");

                saveBtn.classList.add("d-none");
                editBtn.style.display = "block";
                sendOtpBtn.classList.add("d-none");
                otpSection.classList.add("d-none");
            } else {
                msgBox.textContent = data.error || "❌ Lỗi cập nhật!";
                msgBox.className = "form-message text-danger fw-bold";
            }
        } catch (err) {
            console.error("Lỗi update profile:", err);
        }
    });
});
