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

// ===== Globals =====
let currentPhone = null;   // số gốc từ DB
let pendingPhone = null;   // số đang chờ xác minh OTP
let phoneVerified = true;  // flag trạng thái xác minh
let countdownInterval = null;

// ===== Load profile data =====
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
        phoneVerified = true; // mặc định đã xác minh nếu số từ DB
    } catch (err) {
        console.error("Lỗi load profile:", err);
    }
}

// ===== Main =====
document.addEventListener("DOMContentLoaded", () => {
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

    const otpSection = document.querySelector(".otp-section");
    const sendOtpBtn = document.getElementById("sendOtpBtn");
    const verifyOtpBtn = document.getElementById("verifyOtpBtn");
    const otpCode = document.getElementById("otpCode");

    const resendBox = document.createElement("small");

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
        document.getElementById("gender").classList.remove("readonly-select");

        saveBtn.classList.remove("d-none");
        editBtn.style.display = "none";
    });

    // ===== Kiểm tra thay đổi số điện thoại =====
    phoneInput.addEventListener("input", () => {
        const newPhone = phoneInput.value.trim();

        if (newPhone === currentPhone || newPhone === "") {
            // không thay đổi hoặc xoá số
            phoneVerified = true;
            pendingPhone = null;
            saveBtn.disabled = false;
            sendOtpBtn.classList.add("d-none");
            otpSection.classList.add("d-none");
        } else {
            // nhập số mới → cần OTP
            phoneVerified = false;
            pendingPhone = newPhone;
            saveBtn.disabled = true;
            sendOtpBtn.classList.remove("d-none");
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
                msgBox.textContent = data.message || "✅ OTP đã gửi!";
                msgBox.className = "form-message text-success fw-bold";
                startCountdown(sendOtpBtn);
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
        const otp = otpCode.value.trim();
        if (!pendingPhone || !otp) {
            msgBox.textContent = "❌ Vui lòng nhập OTP.";
            msgBox.className = "form-message text-danger fw-bold";
            return;
        }

        try {
            let endpoint;
            let body = { phone: pendingPhone, otp };

            // Nếu nhập số mới → verify + update DB
            if (pendingPhone !== currentPhone) {
                endpoint = `${window.API_BASE}/api/verify-otp-phone-change`;
            } else {
                endpoint = `${window.API_BASE}/api/verify-otp`;
            }

            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(body)
            });
            const data = await res.json();

            if (data.success) {
                currentPhone = pendingPhone;
                pendingPhone = null;
                phoneVerified = true;
                saveBtn.disabled = false;
                otpSection.classList.add("d-none");
                sendOtpBtn.classList.add("d-none");
                msgBox.textContent = "✅ Số điện thoại đã xác minh!";
                msgBox.className = "form-message text-success fw-bold";
            } else {
                phoneVerified = false;
                saveBtn.disabled = true;
                msgBox.textContent = data.error || "❌ Mã OTP không hợp lệ!";
                msgBox.className = "form-message text-danger fw-bold";
            }
        } catch (err) {
            console.error("Lỗi verify OTP:", err);
            msgBox.textContent = "❌ Lỗi hệ thống khi xác minh OTP!";
            msgBox.className = "form-message text-danger fw-bold";
        }
    });

    // ===== Update profile =====
    document.getElementById("profileForm").addEventListener("submit", async e => {
        e.preventDefault();

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

                // update sidebar
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

                // reset trạng thái form
                document.querySelectorAll("#profileForm input")
                    .forEach(input => input.setAttribute("readonly", true));
                document.getElementById("email").setAttribute("readonly", true);
                document.getElementById("gender").classList.add("readonly-select");

                saveBtn.classList.add("d-none");
                editBtn.style.display = "block";
                sendOtpBtn.classList.add("d-none");
                otpSection.classList.add("d-none");

                currentPhone = body.phone || null; // cập nhật số mới làm gốc
            } else {
                msgBox.textContent = data.error || "❌ Lỗi cập nhật!";
                msgBox.className = "form-message text-danger fw-bold";
            }
        } catch (err) {
            console.error("Lỗi update profile:", err);
        }
    });

    // ===== Countdown resend OTP =====
    function startCountdown(btn) {
        let timeLeft = 30;
        btn.disabled = true;

        if (countdownInterval) clearInterval(countdownInterval);

        resendBox.textContent = `Bạn chưa nhận được mã? Gửi lại sau ${timeLeft}s`;
        resendBox.className = "text-muted d-block mt-2";
        otpSection.appendChild(resendBox);

        countdownInterval = setInterval(() => {
            timeLeft--;
            if (timeLeft > 0) {
                resendBox.textContent = `Bạn chưa nhận được mã? Gửi lại sau ${timeLeft}s`;
            } else {
                clearInterval(countdownInterval);
                resendBox.innerHTML = `<a href="#" id="resendOtpLink">Gửi lại mã</a>`;
                btn.disabled = false;

                document.getElementById("resendOtpLink").addEventListener("click", (e) => {
                    e.preventDefault();
                    btn.click();
                });
            }
        }, 1000);
    }

    // ===== Sidebar Tabs =====
    const sidebarItems = document.querySelectorAll(".sidebar-menu li[data-target]");
    const tabPanes = document.querySelectorAll(".tab-pane");

    sidebarItems.forEach(item => {
        item.addEventListener("click", () => {
            // active menu
            sidebarItems.forEach(el => el.classList.remove("active"));
            item.classList.add("active");

            // show đúng tab
            const target = item.getAttribute("data-target");
            tabPanes.forEach(pane => {
                if (pane.id === target) {
                    pane.classList.remove("d-none");
                } else {
                    pane.classList.add("d-none");
                }
            });
        });
    });
});
