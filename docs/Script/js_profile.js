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

    // ===== Toggle edit mode =====
    editBtn.addEventListener("click", () => {
        const inputs = document.querySelectorAll("#profileForm input, #profileForm select");
        inputs.forEach(input => {
            if (input.id !== "email") {
                input.removeAttribute("readonly");
                input.removeAttribute("disabled");
            }
        });
        saveBtn.classList.remove("d-none"); // hiện nút lưu
        editBtn.style.display = "none"; // ẩn bút chì
    });

    // ===== Update profile =====
    document.getElementById("profileForm").addEventListener("submit", async e => {
        e.preventDefault();
        const body = {
            firstName: document.getElementById("firstName").value.trim(),
            lastName: document.getElementById("lastName").value.trim(),
            phone: document.getElementById("phone").value.trim(),
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
            const msgBox = document.getElementById("profileMessage");

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
                const inputs = document.querySelectorAll("#profileForm input, #profileForm select");
                inputs.forEach(input => {
                    input.setAttribute("readonly", true);
                    input.setAttribute("disabled", true);
                });
                document.getElementById("email").setAttribute("readonly", true); // email luôn readonly
                saveBtn.classList.add("d-none");
                editBtn.style.display = "block";
            } else {
                msgBox.textContent = data.error || "❌ Lỗi cập nhật!";
                msgBox.className = "form-message text-danger fw-bold";
            }
        } catch (err) {
            console.error("Lỗi update profile:", err);
        }
    });
});
