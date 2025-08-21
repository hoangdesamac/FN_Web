const API_BASE = window.API_BASE || "https://fn-web.onrender.com";

async function loadProfile() {
    try {
        const res = await fetch(`${API_BASE}/api/me`, { credentials: "include" });
        const data = await res.json();

        if (!data.loggedIn) {
            window.location.href = "index.html";
            return;
        }

        const user = data.user;

        // Gán dữ liệu vào form
        document.getElementById("firstName").value = user.firstName || "";
        document.getElementById("lastName").value = user.lastName || "";
        document.getElementById("email").value = user.email || "";
        document.getElementById("phone").value = user.phone || "";
        document.getElementById("gender").value = user.gender || "";
        document.getElementById("birthday").value = user.birthday || "";

        // Sidebar avatar + name
        document.getElementById("sidebarAvatar").src = user.avatar_url || "https://via.placeholder.com/80?text=U";
        document.getElementById("sidebarName").textContent = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Người dùng";
    } catch (err) {
        console.error("Lỗi load profile:", err);
    }
}

document.getElementById("profileForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const body = {
        firstName: document.getElementById("firstName").value.trim(),
        lastName: document.getElementById("lastName").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        gender: document.getElementById("gender").value,
        birthday: document.getElementById("birthday").value
    };

    try {
        const res = await fetch(`${API_BASE}/api/me`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(body)
        });
        const data = await res.json();

        const msgBox = document.getElementById("profileMessage");
        if (data.success) {
            msgBox.textContent = "✅ Cập nhật thành công!";
            msgBox.className = "form-message text-success fw-bold";

            // Cập nhật localStorage để header hiển thị đúng
            localStorage.setItem("firstName", data.user.firstName || "");
            localStorage.setItem("lastName", data.user.lastName || "");
            localStorage.setItem("email", data.user.email || "");
            if (data.user.avatar_url) {
                localStorage.setItem("avatarUrl", data.user.avatar_url);
            }

            // Đồng bộ sidebar
            document.getElementById("sidebarAvatar").src = data.user.avatar_url || "https://via.placeholder.com/80?text=U";
            document.getElementById("sidebarName").textContent = `${data.user.firstName || ""} ${data.user.lastName || ""}`.trim() || "Người dùng";
        } else {
            msgBox.textContent = data.error || "❌ Lỗi cập nhật!";
            msgBox.className = "form-message text-danger fw-bold";
        }
    } catch (err) {
        console.error("Lỗi update profile:", err);
    }
});

document.addEventListener("DOMContentLoaded", loadProfile);
