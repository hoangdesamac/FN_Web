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

    // ===== Address Book (dùng Modal) =====
    async function loadAddresses() {
        const container = document.getElementById("addressList");
        if (!container) return;

        try {
            const res = await fetch(`${window.API_BASE}/api/addresses`, { credentials: "include" });
            const data = await res.json();

            if (!data.success) {
                container.innerHTML = `<p class="text-danger">❌ Không tải được danh sách địa chỉ!</p>`;
                return;
            }

            if (!data.addresses.length) {
                container.innerHTML = `<p class="text-muted">Chưa có địa chỉ nào. Hãy thêm mới!</p>`;
                return;
            }

            container.innerHTML = data.addresses.map(addr => `
            <div class="card mb-2 p-3 ${addr.is_default ? "border-success" : ""}">
                <p><b>${addr.recipient_name}</b> - ${addr.recipient_phone}</p>
                <p>${addr.street_address}, ${addr.ward || ""}, ${addr.city || ""}</p>
                ${addr.is_default ? `<span class="badge bg-success">Mặc định</span>` : ""}
                <div class="mt-2">
                    <button class="btn btn-sm btn-primary me-2" onclick="editAddress(${addr.id})">
                        <i class="fa-solid fa-pen"></i> Sửa
                    </button>
                    <button class="btn btn-sm btn-danger me-2" onclick="deleteAddress(${addr.id})">
                        <i class="fa-solid fa-trash"></i> Xóa
                    </button>
                    ${!addr.is_default ? `
                        <button class="btn btn-sm btn-outline-success" onclick="setDefaultAddress(${addr.id})">
                            <i class="fa-solid fa-check"></i> Đặt mặc định
                        </button>` : ""}
                </div>
            </div>
        `).join("");
        } catch (err) {
            console.error("Lỗi load addresses:", err);
            container.innerHTML = `<p class="text-danger">❌ Lỗi server khi tải địa chỉ!</p>`;
        }
    }

// Mở modal thêm địa chỉ
    document.getElementById("addAddressBtn").addEventListener("click", () => {
        const form = document.getElementById("addressForm");
        form.reset();
        delete form.dataset.editingId;
        document.getElementById("addressFormTitle").textContent = "Thêm địa chỉ mới";
        new bootstrap.Modal(document.getElementById("addressModal")).show();
    });

// Sửa địa chỉ (mở modal với dữ liệu)
    async function editAddress(id) {
        try {
            const res = await fetch(`${window.API_BASE}/api/addresses`, { credentials: "include" });
            const data = await res.json();
            const addr = data.addresses.find(a => a.id === id);
            if (!addr) return alert("❌ Không tìm thấy địa chỉ!");

            const form = document.getElementById("addressForm");
            form.recipient_name.value = addr.recipient_name;
            form.recipient_phone.value = addr.recipient_phone;
            form.street_address.value = addr.street_address;
            form.ward.value = addr.ward || "";
            form.city.value = addr.city || "";
            form.is_default.checked = addr.is_default;
            form.dataset.editingId = id;

            document.getElementById("addressFormTitle").textContent = "Chỉnh sửa địa chỉ";
            new bootstrap.Modal(document.getElementById("addressModal")).show();
        } catch (err) {
            console.error("Lỗi editAddress:", err);
        }
    }

// Submit form (thêm/sửa)
    document.getElementById("addressForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const form = e.target;
        const id = form.dataset.editingId;

        const body = {
            recipient_name: form.recipient_name.value.trim(),
            recipient_phone: form.recipient_phone.value.trim(),
            street_address: form.street_address.value.trim(),
            ward: form.ward.value.trim(),
            city: form.city.value.trim(),
            is_default: form.is_default.checked
        };

        try {
            let url = `${window.API_BASE}/api/addresses`;
            let method = "POST";
            if (id) {
                url = `${window.API_BASE}/api/addresses/${id}`;
                method = "PUT";
            }

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(body)
            });
            const data = await res.json();

            if (data.success) {
                form.reset();
                delete form.dataset.editingId;
                bootstrap.Modal.getInstance(document.getElementById("addressModal")).hide();
                await loadAddresses();
            } else {
                alert(data.error || "❌ Lỗi lưu địa chỉ!");
            }
        } catch (err) {
            console.error("Lỗi submit address form:", err);
        }
    });

// Xóa địa chỉ
    async function deleteAddress(id) {
        if (!confirm("Bạn có chắc muốn xóa địa chỉ này?")) return;
        try {
            const res = await fetch(`${window.API_BASE}/api/addresses/${id}`, {
                method: "DELETE",
                credentials: "include"
            });
            const data = await res.json();
            if (data.success) {
                await loadAddresses();
            } else {
                alert(data.error || "❌ Lỗi xóa địa chỉ!");
            }
        } catch (err) {
            console.error("Lỗi deleteAddress:", err);
        }
    }

// Đặt mặc định
    async function setDefaultAddress(id) {
        try {
            const res = await fetch(`${window.API_BASE}/api/addresses/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ is_default: true })
            });
            const data = await res.json();
            if (data.success) {
                await loadAddresses();
            } else {
                alert(data.error || "❌ Lỗi đặt mặc định!");
            }
        } catch (err) {
            console.error("Lỗi setDefaultAddress:", err);
        }
    }

// Khi chuyển sang tab "tab-address" thì load
    const addressTab = document.querySelector('.sidebar-menu li[data-target="tab-address"]');
    if (addressTab) {
        addressTab.addEventListener("click", () => {
            loadAddresses();
        });
    }



});
