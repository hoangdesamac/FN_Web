// Centralized handler to inject js_resetauth.js after header is present,
// call AuthSync.refresh() (if available), then update header/cart/order UI.
// Safe to include on all pages (idempotent).
(function () {
    if (window.__resethandler_installed) return;
    window.__resethandler_installed = true;

    let injected = false;

    // Consume flag safely: prefer sessionStorage (per-tab), fallback to localStorage
    // but only if timestamp is recent. This prevents stale flags in other tabs from
    // opening the modal unexpectedly.
    function consumeShowLoginFlag() {
        try {
            // sessionStorage is per-tab — ideal for "open modal once" behaviour
            if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('showLoginAfterReset') === 'true') {
                try { sessionStorage.removeItem('showLoginAfterReset'); } catch (_) {}
                return true;
            }

            const v = localStorage.getItem('showLoginAfterReset');
            if (!v) return false;

            // if localStorage was used, check timestamp guard (10s)
            const ts = Number(localStorage.getItem('showLoginAfterReset_ts') || '0');
            const now = Date.now();
            // consider recent only (10 seconds)
            if (ts && (now - ts) < 10 * 1000) {
                try {
                    localStorage.removeItem('showLoginAfterReset');
                    localStorage.removeItem('showLoginAfterReset_ts');
                } catch (_) {}
                return true;
            }
            // otherwise clear stale values and ignore
            try {
                localStorage.removeItem('showLoginAfterReset');
                localStorage.removeItem('showLoginAfterReset_ts');
            } catch (_) {}
            return false;
        } catch (e) {
            console.warn('consumeShowLoginFlag error', e);
            try {
                localStorage.removeItem('showLoginAfterReset');
                localStorage.removeItem('showLoginAfterReset_ts');
            } catch (_) {}
            try { sessionStorage.removeItem('showLoginAfterReset'); } catch (_) {}
            return false;
        }
    }

    // Safe setter helper for other scripts to request opening login modal after redirect.
    // Prefer sessionStorage (per-tab). If useSession === false, uses localStorage+timestamp as fallback.
    function setShowLoginAfterReset(useSession = true) {
        try {
            if (useSession && typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem('showLoginAfterReset', 'true');
                return;
            }
            // fallback to localStorage with timestamp
            localStorage.setItem('showLoginAfterReset', 'true');
            localStorage.setItem('showLoginAfterReset_ts', String(Date.now()));
        } catch (e) {
            console.warn('setShowLoginAfterReset failed, attempting best-effort fallback', e);
            try { sessionStorage.setItem('showLoginAfterReset', 'true'); } catch (_) {}
            try {
                localStorage.setItem('showLoginAfterReset', 'true');
                localStorage.setItem('showLoginAfterReset_ts', String(Date.now()));
            } catch (_) {}
        }
    }

    // Safe open modal helper (debounced) to avoid double-open from multiple scripts
    function openLoginModalSafely() {
        try {
            const now = Date.now();
            if (window.__lastLoginModalOpenAt && (now - window.__lastLoginModalOpenAt) < 1200) return;
            window.__lastLoginModalOpenAt = now;
            if (typeof CyberModal !== "undefined" && typeof CyberModal.open === "function") {
                CyberModal.open();
            }
        } catch (e) { /* ignore */ }
    }

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

                // Safe consume flag: prefer global helper _consumeShowLoginFlag or setShowLoginAfterReset exported by js_resetauth
                try {
                    let consumed = false;

                    // Prefer an exported helper if js_resetauth provided one.
                    if (typeof window._consumeShowLoginFlag === 'function') {
                        try { consumed = !!window._consumeShowLoginFlag(); } catch (err) { consumed = false; }
                    } else if (typeof window.consumeShowLoginFlag === 'function') {
                        // backwards compat
                        try { consumed = !!window.consumeShowLoginFlag(); } catch (err) { consumed = false; }
                    } else {
                        // fallback to local implementation
                        try { consumed = !!consumeShowLoginFlag(); } catch (err) { consumed = false; }
                    }

                    // NOTE: Do NOT auto-open modal here. Modal opening is intentionally removed so that
                    // it only occurs when the user explicitly interacts (clicks icon/button).
                    // Keep the consumed flag logic in case other scripts want to inspect/consume it,
                    // but do not trigger openLoginModalSafely() automatically.
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

    // Export helpers (do not overwrite if already provided by other scripts)
    try {
        if (!window._consumeShowLoginFlag) {
            window._consumeShowLoginFlag = consumeShowLoginFlag;
        }
    } catch (e) { /* ignore */ }

    try {
        if (!window.consumeShowLoginFlag) {
            window.consumeShowLoginFlag = consumeShowLoginFlag;
        }
    } catch (e) { /* ignore */ }

    try {
        if (!window.setShowLoginAfterReset) {
            window.setShowLoginAfterReset = setShowLoginAfterReset;
        }
    } catch (e) { /* ignore */ }

    // Expose safe open helper globally for other scripts if they want to use it
    try { if (!window.openLoginModalSafely) window.openLoginModalSafely = openLoginModalSafely; } catch (e) {}
})();
// Clear both session and local copies of the flag (use on logout)
function clearShowLoginAfterReset() {
    try { sessionStorage.removeItem('showLoginAfterReset'); } catch (_) {}
    try { localStorage.removeItem('showLoginAfterReset'); localStorage.removeItem('showLoginAfterReset_ts'); } catch (_) {}
    try { localStorage.removeItem('pendingAction'); } catch (_) {}
}
try { if (!window.clearShowLoginAfterReset) window.clearShowLoginAfterReset = clearShowLoginAfterReset; } catch(e) {}