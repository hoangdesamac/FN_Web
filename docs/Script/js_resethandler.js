// Centralized handler to inject js_resetauth.js after header is present,
// call AuthSync.refresh() (if available), then update header/cart/order UI.
// Safe to include on all pages (idempotent).
(function () {
    if (window.__resethandler_installed) return;
    window.__resethandler_installed = true;

    let injected = false;
    function injectResetauth() {
        if (injected) return;
        injected = true;

        try {
            const s = document.createElement('script');
            s.src = "Script/js_resetauth.js";
            s.defer = true;
            s.onload = async function () {
                try {
                    if (window.AuthSync && typeof window.AuthSync.refresh === 'function') {
                        await window.AuthSync.refresh();
                    }
                } catch (err) {
                    console.warn('AuthSync.refresh() failed (resethandler):', err);
                }

                // Best-effort update header UI + counts
                try {
                    if (typeof updateUserDisplay === 'function') {
                        // allow async updateUserDisplay implementations
                        const maybePromise = updateUserDisplay();
                        if (maybePromise && typeof maybePromise.then === 'function') {
                            await maybePromise;
                        }
                    }
                    if (typeof updateCartCount === 'function') updateCartCount();
                    if (typeof updateOrderCount === 'function') updateOrderCount();
                } catch (e) {
                    console.warn('Post-refresh header update failed (resethandler):', e);
                }

                // legacy modal flag behavior
                try {
                    if (localStorage.getItem("showLoginAfterReset") === "true") {
                        localStorage.removeItem("showLoginAfterReset");
                        if (typeof CyberModal !== "undefined" && typeof CyberModal.open === "function") {
                            CyberModal.open();
                        }
                    }
                } catch (e) { /* ignore */ }
            };
            document.body.appendChild(s);
        } catch (e) {
            console.error('Failed to inject js_resetauth.js:', e);
        }
    }

    function scheduleInjectIfHeaderReady() {
        const hc = document.getElementById('header-container');
        if (hc && hc.children.length > 0) {
            injectResetauth();
            return;
        }
        if (hc) {
            const obs = new MutationObserver((mutations, observer) => {
                for (const m of mutations) {
                    if (m.type === 'childList' && m.addedNodes.length > 0) {
                        injectResetauth();
                        observer.disconnect();
                        return;
                    }
                }
            });
            obs.observe(hc, { childList: true, subtree: false });
            // safety timeout: if header never appears, still inject after short wait
            setTimeout(() => {
                try { obs.disconnect(); } catch (e) {}
                if (!injected) injectResetauth();
            }, 3500);
            return;
        }
        // if no header-container element in page, just wait for DOMContentLoaded then inject
        document.addEventListener('DOMContentLoaded', function () {
            setTimeout(injectResetauth, 150);
        });
    }

    scheduleInjectIfHeaderReady();
})();