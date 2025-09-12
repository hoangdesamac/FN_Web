// CACHE + GLOBALS cho address
let addressesCache = [];         // cập nhật trong loadAddresses()
let provinceData = null;         // cache json danh mục tỉnh/xã
let provinceListenerAttached = false;
/* ==== Avatar Upload Config (ADD) ==== */
const AVATAR_MAX_SIZE_MB = 5; // giới hạn 5MB
const AVATAR_ALLOWED_EXT = [
    'png','jpg','jpeg','jfif','pjpeg','pjp',
    'webp','avif','gif','svg','ico','cur',
    'bmp','dib','tif','tiff','heic','heif','jxl','psd'
];
/* file.type phải bắt đầu với image/, tuy nhiên vài trình duyệt có thể thiếu => fallback theo ext */
function isValidImageFile(file) {
    if (!file) return false;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (file.type && file.type.startsWith('image/')) return true;
    return AVATAR_ALLOWED_EXT.includes(ext);
}
/* ==== Avatar Upload Helpers (ADD) ==== */
function showAvatarMessage(msg, type='info') {
    const box = document.getElementById('avatarUploadMsg');
    if (!box) return;
    box.textContent = msg;
    box.className = `small mt-1 avatar-msg ${type === 'success' ? 'success' : type === 'error' ? 'error' : ''}`;
}

function fileToBase64(file){
    return new Promise((resolve,reject)=>{
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file); // data:image/...
    });
}

/**
 * Tải avatar lên backend.
 * Ưu tiên endpoint multipart: POST /api/me/avatar (đề xuất ở backend phần 4).
 * Nếu endpoint này chưa có (404) => fallback PATCH /api/me với avatarData (cần backend hỗ trợ).
 */
let avatarUploadInProgress = false;
async function uploadAvatarFile(file){
    if (!file) {
        showAvatarMessage('❌ Không có file để upload!', 'error');
        return;
    }
    if (avatarUploadInProgress) {
        showAvatarMessage('⏳ Đang tải ảnh trước đó, vui lòng chờ...', 'info');
        return;
    }
    if (!isValidImageFile(file)) {
        showAvatarMessage('❌ File không hợp lệ!', 'error');
        return;
    }

    avatarUploadInProgress = true;
    const shell = document.querySelector('.avatar-shell');
    shell?.classList.add('uploading');
    showAvatarMessage('Đang tải ảnh...', 'info');

    try {
        const fd = new FormData();
        fd.append('avatar', file);

        let res = await fetch(`${window.API_BASE}/api/me/avatar`, {
            method: 'POST',
            credentials: 'include',
            body: fd
        });

        if (res.status === 404) {
            const base64 = await fileToBase64(file);
            res = await fetch(`${window.API_BASE}/api/me/avatar-base64`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: base64 })
            });
        }

        if (!res.ok) {
            let errMsg = 'Upload thất bại';
            try { const j = await res.json(); errMsg = j.error || errMsg; } catch(_) {}
            throw new Error(errMsg);
        }

        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Upload thất bại');

        const newUrl = data.url || data.user?.avatar_url;
        if (newUrl) {
            applyNewAvatar(newUrl);
            showAvatarMessage('✅ Cập nhật avatar thành công!', 'success');
        } else {
            showAvatarMessage('⚠ Upload thành công nhưng không có URL!', 'error');
        }
    } catch (err) {
        console.error('Upload avatar error:', err);
        showAvatarMessage('❌ Lỗi tải ảnh: ' + err.message, 'error');
    } finally {
        avatarUploadInProgress = false;
        shell?.classList.remove('uploading');
    }
}

function handleAvatarSelection(file){
    if (!file) {
        showAvatarMessage('❌ Không tìm thấy file hợp lệ!', 'error');
        return;
    }
    if (avatarUploadInProgress) {
        showAvatarMessage('⏳ Đang tải ảnh trước đó, vui lòng đợi...', 'info');
        return;
    }
    if (!isValidImageFile(file)) {
        showAvatarMessage('❌ File không phải định dạng ảnh hợp lệ!', 'error');
        return;
    }
    if (file.size > AVATAR_MAX_SIZE_MB * 1024 * 1024) {
        showAvatarMessage(`❌ Ảnh quá lớn (>${AVATAR_MAX_SIZE_MB}MB)!`, 'error');
        return;
    }

    const img = document.getElementById('sidebarAvatar');
    if (img) {
        if (img.dataset.objectUrl) {
            try { URL.revokeObjectURL(img.dataset.objectUrl); } catch(_) {}
        }
        const objectURL = URL.createObjectURL(file);
        img.dataset.objectUrl = objectURL;
        img.onload = () => {
            try { URL.revokeObjectURL(objectURL); delete img.dataset.objectUrl; } catch(_) {}
        };
        img.src = objectURL;
    }

    uploadAvatarFile(file);
}

function getFirstValidImageFile(fileList) {
    if (!fileList || !fileList.length) return null;
    for (let i = 0; i < fileList.length; i++) {
        const f = fileList[i];
        if (isValidImageFile(f)) return f;
    }
    return null;
}

function warnIfMultiple(fileList) {
    try {
        if (fileList && fileList.length > 1) {
            showAvatarMessage(`Chỉ dùng ảnh đầu tiên. (${fileList.length} ảnh đã chọn)`, 'info');
        }
    } catch(_) {}
}

// NEW: Áp dụng avatar mới đồng bộ toàn site
function applyNewAvatar(url) {
    if (!url) return;

    // Cập nhật ảnh trong sidebar (trang profile)
    const img = document.getElementById('sidebarAvatar');
    if (img) img.src = url;

    // Lưu localStorage (giữ tương thích)
    try { localStorage.setItem('avatarUrl', url); } catch(_) {}

    // Nếu có AuthSync.setAvatar → cập nhật state & bắn sự kiện auth:changed ngay
    if (window.AuthSync && typeof window.AuthSync.setAvatar === 'function') {
        try {
            window.AuthSync.setAvatar(url);
        } catch (e) {
            console.warn('applyNewAvatar -> AuthSync.setAvatar error:', e);
        }
    } else {
        // Fallback: phát event thủ công để header khác có thể nghe
        try {
            const ev = new CustomEvent('user:avatar-updated', { detail: { url } });
            window.dispatchEvent(ev);
        } catch(_) {}
    }

    // Cập nhật header ngay (không chờ bất kỳ request nào)
    if (typeof updateUserDisplay === 'function') {
        try { updateUserDisplay(); } catch(_) {}
    }
}
// Load và cache JSON (FormText/danhmucxaphuong.json)
async function loadProvinceData() {
    if (provinceData) return provinceData;
    try {
        const res = await fetch("/FormText/danhmucxaphuong.json");
        provinceData = await res.json();
        return provinceData;
    } catch (err) {
        console.error("Lỗi load danh mục tỉnh/xã:", err);
        provinceData = [];   // ❌ trước đây là {}, giờ sửa thành []
        return provinceData;
    }
}


// Điền options cho #city và #ward; preProvince/preWard nếu preset khi edit
async function populateProvinceWard(preProvince = "", preWard = "") {
    await loadProvinceData();
    const provinceEl = document.getElementById("city");
    const wardEl = document.getElementById("ward");
    if (!provinceEl || !wardEl) return;

    // reset
    provinceEl.innerHTML = `<option value="">-- Chọn Tỉnh/Thành phố --</option>`;
    wardEl.innerHTML = `<option value="">-- Chọn Xã/Phường --</option>`;

    // thêm tỉnh
    provinceData
        .slice()
        .sort((a,b) => a.tentinhmoi.localeCompare(b.tentinhmoi, 'vi'))
        .forEach(p => {
            const opt = document.createElement("option");
            opt.value = p.tentinhmoi;        // lưu tên tỉnh
            opt.textContent = p.tentinhmoi;  // hiển thị tên tỉnh
            provinceEl.appendChild(opt);
        });

    // helper lấy wards (flatten nếu cần)
    const getWards = (provinceName) => {
        const province = provinceData.find(p => p.tentinhmoi === provinceName);
        if (!province || !province.phuongxa) return [];
        return province.phuongxa
            .map(x => x.tenphuongxa)   // lấy tên xã/phường
            .sort((a, b) => a.localeCompare(b, 'vi'));
    };


    // attach change listener chỉ 1 lần (global)
    if (!provinceListenerAttached) {
        provinceEl.addEventListener("change", () => {
            wardEl.innerHTML = `<option value="">-- Chọn Xã/Phường --</option>`;
            const wards = getWards(provinceEl.value);
            wards.forEach(w => {
                const opt = document.createElement("option");
                opt.value = w;
                opt.textContent = w;
                wardEl.appendChild(opt);
            });
        });

        provinceListenerAttached = true;
    }

    // preset nếu có NHÉ
    if (preProvince) {
        provinceEl.value = preProvince;
        // kích hoạt event manual để load wards
        const event = new Event('change');
        provinceEl.dispatchEvent(event);
        if (preWard) {
            // chờ microtask để DOM option wards có thể được tạo — 0ms timeout an toàn
            setTimeout(() => { wardEl.value = preWard; }, 0);
        }
    }
}

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

// ===== Address Book (Cyber Design) =====
async function loadAddresses() {
    const container = document.getElementById("addressList");
    if (!container) return;

    try {
        const res = await fetch(`${window.API_BASE}/api/addresses`, { credentials: "include" });
        const data = await res.json();

        if (!data.success) {
            container.innerHTML = `<p class="text-danger">❌ Không tải được danh sách địa chỉ!</p>`;
            addressesCache = [];
            return;
        }

        addressesCache = data.addresses || [];

        if (!addressesCache.length) {
            container.innerHTML = `<p class="text-muted">Chưa có địa chỉ nào. Hãy thêm mới!</p>`;
            return;
        }

        container.innerHTML = addressesCache.map(addr => `
            <div class="cyber-card ${addr.is_default ? "cyber-card-default" : ""}">
                <div class="cyber-card-body">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h5 class="cyber-recipient">
                            <i class="fa-solid fa-user me-2"></i>${addr.recipient_name}
                        </h5>
                        ${addr.is_default ? `<span class="cyber-badge">Mặc định</span>` : ""}
                    </div>
                    <p><i class="fa-solid fa-phone me-2"></i>${addr.recipient_phone}</p>
                    <p><i class="fa-solid fa-location-dot me-2"></i>
                        ${addr.street_address}, ${addr.ward || ""}, ${addr.city || ""}
                    </p>
                    <div class="cyber-actions-address text-end">
                        <button class="cyber-btn cyber-btn-edit" onclick="editAddress(${addr.id})">
                            <i class="fa-solid fa-pen"></i> Sửa
                        </button>
                        ${!addr.is_default ? `
                        <button class="cyber-btn cyber-btn-delete" onclick="deleteAddress(${addr.id})">
                            <i class="fa-solid fa-trash"></i> Xóa
                        </button>` : ""}
                    </div>
                </div>
            </div>
        `).join("");
    } catch (err) {
        console.error("Lỗi load addresses:", err);
        container.innerHTML = `<p class="text-danger">❌ Lỗi server khi tải địa chỉ!</p>`;
    }
}


// ===== Sửa địa chỉ =====
async function editAddress(id) {
    try {
        // lấy data chi tiết (có thể fetch all hoặc dùng API chi tiết nếu có)
        const res = await fetch(`${window.API_BASE}/api/addresses`, { credentials: "include" });
        const data = await res.json();
        const addr = (data.addresses || []).find(a => a.id === id);
        if (!addr) return alert("❌ Không tìm thấy địa chỉ!");

        const form = document.getElementById("addressForm");
        form.recipient_name.value = addr.recipient_name || "";
        form.recipient_phone.value = addr.recipient_phone || "";
        form.street_address.value = addr.street_address || "";
        // dùng populateProvinceWard để điền select và preset
        await populateProvinceWard(addr.city || "", addr.ward || "");
        form.dataset.editingId = id;

        const defaultCheckboxWrapper = form.querySelector(".form-check");
        const defaultCheckbox = form.is_default;
        if (addr.is_default) {
            // ẩn checkbox để user không uncheck địa chỉ mặc định
            if (defaultCheckboxWrapper) defaultCheckboxWrapper.style.display = "none";
            if (defaultCheckbox) defaultCheckbox.checked = true;
        } else {
            if (defaultCheckboxWrapper) defaultCheckboxWrapper.style.display = "block";
            if (defaultCheckbox) defaultCheckbox.checked = false;
        }

        // tìm nút Lưu / Hủy trong modal (tránh ID null)
        const modal = document.getElementById("addressModal");
        const saveBtn = modal.querySelector('button[type="submit"][form="addressForm"]');
        const cancelBtn = modal.querySelector('button[data-bs-dismiss="modal"]');
        if (saveBtn) {
            saveBtn.textContent = "Cập nhật địa chỉ";
            saveBtn.classList.remove("neon-btn"); // nếu muốn thay style
            saveBtn.classList.add("btn-save");
        }
        if (cancelBtn) {
            cancelBtn.classList.add("btn-cancel");
        }

        document.getElementById("addressFormTitle").textContent = "Chỉnh sửa địa chỉ";
        new bootstrap.Modal(modal).show();
    } catch (err) {
        console.error("Lỗi editAddress:", err);
    }
}


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

// Submit form thêm/sửa
    document.getElementById("addressForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const form = e.target;
        const id = form.dataset.editingId;

        // Nếu editing một địa chỉ mặc định, force is_default = true để không bị bỏ mặc định
        let forceDefault = false;
        if (id) {
            // tìm trong cache
            const original = addressesCache.find(a => String(a.id) === String(id));
            if (original && original.is_default) forceDefault = true;
        }

        const body = {
            recipient_name: form.recipient_name.value.trim(),
            recipient_phone: form.recipient_phone.value.trim(),
            street_address: form.street_address.value.trim(),
            ward: form.ward.value.trim(),
            city: form.city.value.trim(),
            is_default: forceDefault ? true : !!form.is_default.checked
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
                await loadAddresses(); // cập nhật lại cache & UI
            } else {
                alert(data.error || "❌ Lỗi lưu địa chỉ!");
            }
        } catch (err) {
            console.error("Lỗi submit address form:", err);
        }
    });

    // ===== Nút mở modal thêm địa chỉ =====
    document.getElementById("addAddressBtn").addEventListener("click", async () => {
        const form = document.getElementById("addressForm");
        form.reset();
        delete form.dataset.editingId;

        document.getElementById("addressFormTitle").textContent = "Thêm địa chỉ mới";

        // checkbox hiển thị
        const defaultCheckboxWrapper = form.querySelector(".form-check");
        const defaultCheckbox = form.is_default;
        if (defaultCheckboxWrapper) defaultCheckboxWrapper.style.display = "block";
        if (defaultCheckbox) defaultCheckbox.checked = false;

        // populate tỉnh/xã (không preset)
        await populateProvinceWard();

        // nút màu
        const modal = document.getElementById("addressModal");
        const saveBtn = modal.querySelector('button[type="submit"][form="addressForm"]');
        const cancelBtn = modal.querySelector('button[data-bs-dismiss="modal"]');
        if (saveBtn) {
            saveBtn.textContent = "Lưu địa chỉ";
            saveBtn.classList.add("btn-save");
        }
        if (cancelBtn) {
            cancelBtn.classList.add("btn-cancel");
        }

        new bootstrap.Modal(modal).show();
    });

// Khi click tab -> load
    const addressTab = document.querySelector('.sidebar-menu li[data-target="tab-address"]');
    if (addressTab) {
        addressTab.addEventListener("click", () => {
            loadAddresses();
        });
    }
    // === (ADD) Avatar edit events ===
    const changeAvatarBtn = document.getElementById('changeAvatarBtn');
    const avatarFileInput = document.getElementById('avatarFile');

    if (changeAvatarBtn && avatarFileInput) {
        changeAvatarBtn.addEventListener('click', () => {
            avatarFileInput.click();
        });

        avatarFileInput.addEventListener('change', () => {
            const fl = avatarFileInput.files;
            if (!fl || !fl.length) {
                showAvatarMessage('❌ Chưa chọn ảnh!', 'error');
                return;
            }
            warnIfMultiple(fl); // cảnh báo nếu có >1
            const first = getFirstValidImageFile(fl);
            handleAvatarSelection(first);
            // Xoá selection còn lại (nếu browser hỗ trợ) để tránh upload lại nhiều file
            avatarFileInput.value = '';
        });

        // Kéo-thả (optional)
        const shell = document.querySelector('.avatar-shell');
        if (shell) {
            shell.addEventListener('paste', e => {
                const items = e.clipboardData?.files;
                if (!items || !items.length) return;
                warnIfMultiple(items);
                const first = getFirstValidImageFile(items);
                if (first) handleAvatarSelection(first);
            });
        }
    }
    initAvatarDragEvents();
});
// === NEW: Khởi tạo đầy đủ drag & drop avatar (ngăn mở ảnh tab mới) ===
function initAvatarDragEvents() {
    const shell = document.querySelector('.avatar-shell');
    if (!shell || shell.dataset.dragInit === '1') return; // tránh gắn lại
    shell.dataset.dragInit = '1';

    ['dragenter','dragover'].forEach(ev => {
        shell.addEventListener(ev, e => {
            e.preventDefault(); e.stopPropagation();
            shell.classList.add('dragging');
        });
    });
    ['dragleave','dragend'].forEach(ev => {
        shell.addEventListener(ev, e => {
            e.preventDefault(); e.stopPropagation();
            shell.classList.remove('dragging');
        });
    });
    shell.addEventListener('drop', e => {
        e.preventDefault(); e.stopPropagation();
        shell.classList.remove('dragging');
        const fl = e.dataTransfer?.files;
        if (!fl || !fl.length) {
            showAvatarMessage('❌ Không có file!', 'error');
            return;
        }
        warnIfMultiple(fl);
        const first = getFirstValidImageFile(fl);
        handleAvatarSelection(first);
    });
}
