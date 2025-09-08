/* AuthSync - Lightweight auth synchronization helper
   - Source of truth: cookie + backend /api/me
   - Sync channel: localStorage key "auth_state" + storage events
   - Compatibility: mirrors legacy localStorage keys used in your code:
       userName, firstName, lastName, email, userId, avatarUrl
*/
(function (global) {
    const API = (() => {
        try { return window.API_BASE || '/'; } catch (e) { return '/'; }
    })();

    const AUTH_LS_KEY = 'auth_state'; // canonical auth state used to sync across tabs
    const KEEP_KEYS = ['cart', 'giftCart', 'postLoginRedirect', 'pendingAction']; // keys NOT to remove on logout by default

    const listeners = new Set();

    let internalState = { loggedIn: false, user: null };

    // coalesced refresh promise (avoid duplicate network calls)
    let _refreshPromise = null;

    function getStoredState() {
        try {
            const s = localStorage.getItem(AUTH_LS_KEY);
            return s ? JSON.parse(s) : { loggedIn: false, user: null };
        } catch (e) {
            return { loggedIn: false, user: null };
        }
    }

    function setStoredState(state, writeTimestamp = true) {
        try {
            const payload = {
                loggedIn: !!state.loggedIn,
                user: state.user || null,
                ts: writeTimestamp ? Date.now() : (state.ts || Date.now())
            };
            localStorage.setItem(AUTH_LS_KEY, JSON.stringify(payload));
            // also write a ping key to trigger storage listeners even when same content is set
            localStorage.setItem('auth_ping', String(Date.now()));
            internalState = { loggedIn: payload.loggedIn, user: payload.user };
            notifyAll(payload);
        } catch (e) {
            console.error('AuthSync setStoredState error', e);
        }
    }

    function notifyAll(state) {
        // custom event for other scripts
        try {
            const ev = new CustomEvent('auth:changed', { detail: state });
            window.dispatchEvent(ev);
        } catch (e) { /* ignore */ }

        // legacy events used by your code (user:login / user:logout)
        try {
            if (state.loggedIn) {
                window.dispatchEvent(new Event('user:login'));
            } else {
                window.dispatchEvent(new Event('user:logout'));
            }
        } catch (e) { /* ignore */ }

        // call registered listeners
        listeners.forEach(fn => {
            try { fn(state); } catch (er) { console.warn('AuthSync listener error', er); }
        });
    }

    async function fetchMe() {
        try {
            const res = await fetch(`${API.replace(/\/$/, '')}/api/me`, {
                method: 'GET',
                credentials: 'include',
                headers: { 'Accept': 'application/json' }
            });
            const data = await res.json();
            return data;
        } catch (err) {
            console.warn('AuthSync fetch /api/me failed', err);
            return { loggedIn: false };
        }
    }

    function mirrorCompatibilityKeys(user) {
        try {
            // ALWAYS write compatibility keys (set to empty string when missing) to avoid stale header values
            localStorage.setItem('userName', (user && (user.lastName || user.last_name || user.lastName)) ? String((user.lastName || user.last_name || '').trim()) : '');
            localStorage.setItem('firstName', (user && (user.firstName || user.first_name)) ? String((user.firstName || user.first_name).trim()) : '');
            localStorage.setItem('lastName', (user && (user.lastName || user.last_name)) ? String((user.lastName || user.last_name).trim()) : '');
            localStorage.setItem('email', (user && (user.email || '')) ? String(user.email || '') : '');
            localStorage.setItem('userId', (user && (user.id || '')) ? String(user.id || '') : '');
            if (user && (user.avatar_url || user.avatarUrl)) {
                localStorage.setItem('avatarUrl', String(user.avatar_url || user.avatarUrl || ''));
            } else {
                // remove avatar if not provided to avoid showing stale avatar
                localStorage.removeItem('avatarUrl');
            }
            // note: do NOT remove other unrelated keys (cart etc.) here
        } catch (e) { console.warn('AuthSync mirrorCompatibilityKeys error', e); }
    }

    function removeCompatibilityKeys() {
        try {
            ['userName', 'firstName', 'lastName', 'email', 'userId', 'avatarUrl'].forEach(k => localStorage.removeItem(k));
        } catch (e) { console.warn('AuthSync removeCompatibilityKeys error', e); }
    }

    const AuthSync = {
        init: async function (opts = {}) {
            // attach storage listener to react to changes in other tabs
            window.addEventListener('storage', (ev) => {
                if (!ev.key) return;
                if (ev.key === AUTH_LS_KEY || ev.key === 'auth_ping') {
                    const state = getStoredState();
                    internalState = { loggedIn: state.loggedIn, user: state.user };
                    notifyAll(state);
                }
            });

            // refresh on focus to keep state fresh if cookies changed
            window.addEventListener('focus', () => {
                // small debounce
                if (this._focusTimer) clearTimeout(this._focusTimer);
                this._focusTimer = setTimeout(() => {
                    this.refresh().catch(() => { /* ignore */ });
                }, 300);
            });

            // initial server check
            await this.refresh();

            // expose current state for immediate queries
            return internalState;
        },

        // force re-check /api/me and update stored state
        refresh: function () {
            // coalesce concurrent refresh calls
            if (_refreshPromise) return _refreshPromise;

            _refreshPromise = (async () => {
                try {
                    const data = await fetchMe();
                    if (data && data.loggedIn) {
                        // standardize user object
                        const user = {
                            id: data.user?.id ?? data.userId ?? data.id ?? null,
                            email: data.user?.email ?? data.email ?? null,
                            firstName: data.user?.firstName ?? data.user?.first_name ?? null,
                            lastName: data.user?.lastName ?? data.user?.last_name ?? null,
                            avatar_url: data.user?.avatar_url ?? data.user?.avatarUrl ?? null,
                            phone: data.user?.phone ?? null,
                            phone_verified: data.user?.phone_verified ?? false,
                            // keep other fields if any
                            ...((data.user && typeof data.user === 'object') ? data.user : {})
                        };

                        mirrorCompatibilityKeys(user);
                        setStoredState({ loggedIn: true, user });
                        return { loggedIn: true, user };
                    } else {
                        // logged out
                        AuthSync.clear(false); // don't remove KEEP_KEYS
                        return { loggedIn: false };
                    }
                } catch (err) {
                    console.warn('AuthSync.refresh internal error', err);
                    AuthSync.clear(false);
                    return { loggedIn: false };
                } finally {
                    // allow new refreshes next time
                    _refreshPromise = null;
                }
            })();

            return _refreshPromise;
        },

        // wait for an in-flight refresh to finish (soft timeout)
        waitUntilReady: async function (timeoutMs = 1500) {
            if (!_refreshPromise) return internalState;
            try {
                const res = await Promise.race([
                    _refreshPromise,
                    new Promise(resolve => setTimeout(() => resolve(null), timeoutMs))
                ]);
                // return current internalState (likely updated by refresh)
                return internalState;
            } catch (e) {
                return internalState;
            }
        },

        // clear auth state locally (call after server logout)
        clear: function (wipeAll = false) {
            setStoredState({ loggedIn: false, user: null });
            removeCompatibilityKeys();
            // do not clear unrelated keys (cart, etc.) unless requested
            if (wipeAll) {
                try {
                    const keysToKeep = new Set(KEEP_KEYS);
                    Object.keys(localStorage).forEach(k => {
                        if (!keysToKeep.has(k)) localStorage.removeItem(k);
                    });
                } catch (e) { console.warn('AuthSync clear wipeAll error', e); }
            }
            return { loggedIn: false };
        },

        // returns current known state (may be slightly stale until refresh completes)
        getState: function () {
            return internalState;
        },

        isLoggedIn: function () {
            return !!internalState.loggedIn;
        },

        onChange: function (fn) {
            if (typeof fn === 'function') listeners.add(fn);
            return () => listeners.delete(fn);
        },

        // small helper for legacy code: call this after a successful client-side login response
        // it will attempt to read /api/me (cookie must be set by server) and sync.
        notifyLoginFromServer: async function () {
            return this.refresh();
        },

        // helper for debugging
        _debugDump: function () {
            return getStoredState();
        }
    };

    // attach to window
    global.AuthSync = AuthSync;

    // auto-init (best-effort). You can still call AuthSync.init() explicitly on pages.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { AuthSync.init().catch(()=>{}); });
    } else {
        AuthSync.init().catch(()=>{});
    }

})(window);