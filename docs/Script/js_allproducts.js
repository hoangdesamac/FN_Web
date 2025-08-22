// Load header & footer
document.addEventListener("DOMContentLoaded", function () {
    loadPagePart("HTML/Layout/resetheader.html", "#header-container", () => {
        if (typeof initHeader === 'function') initHeader();
        if (typeof initializeUser === 'function') initializeUser();
    });

    loadPagePart("HTML/Layout/resetfooter.html", "#footer-container", () => {
        if (typeof initFooter === 'function') initFooter();
    });

    // Thanh giá
    const priceRange = document.getElementById("priceRange");
    const priceMin = document.getElementById("priceMin");
    const priceMax = document.getElementById("priceMax");

    priceRange.addEventListener("input", () => {
        priceMax.textContent = Number(priceRange.value).toLocaleString();
    });
});

// Hàm load page part (dùng lại từ resetshowroom.js)
function loadPagePart(url, selector, callback = null, executeScripts = true) {
    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
            return response.text();
        })
        .then(data => {
            const container = document.querySelector(selector);
            if (container) {
                container.innerHTML = data;
                if (executeScripts) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = data;
                    const scripts = tempDiv.querySelectorAll('script');
                    scripts.forEach(oldScript => {
                        const newScript = document.createElement('script');
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
                if (typeof callback === 'function') callback();
            }
        })
        .catch(error => console.error(`Lỗi khi tải ${url}:`, error));
}
