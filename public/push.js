// OneSignal Web Push bootstrap
(function () {
    const config = window.APP_CONFIG || {};
    const ONE_SIGNAL_APP_ID = config.ONESIGNAL_APP_ID || '';

    const state = {
        initialized: false,
        sdkLoaded: false,
        currentUserId: null,
        initPromise: null,
        toggleRendered: false
    };

    // ─── Bell Toggle UI ────────────────────────────────────────────────────────

    const TOGGLE_ID = 'push-bell-toggle';

    const renderToggle = (granted) => {
        let el = document.getElementById(TOGGLE_ID);
        if (!el) {
            el = document.createElement('button');
            el.id = TOGGLE_ID;
            el.type = 'button';
            el.setAttribute('aria-label', 'התראות');
            Object.assign(el.style, {
                position:    'fixed',
                top:         'calc(env(safe-area-inset-top, 0px) + 14px)',
                left:        '16px',
                zIndex:      '9998',
                border:      'none',
                borderRadius:'999px',
                width:       '44px',
                height:      '44px',
                display:     'flex',
                alignItems:  'center',
                justifyContent: 'center',
                cursor:      'pointer',
                transition:  'all 0.3s ease',
                boxShadow:   '0 2px 12px rgba(61,46,42,0.15)',
                fontSize:    '1.15rem',
            });
            el.addEventListener('click', async () => {
                if (state.permission === 'granted') return; // already on
                const result = await window.AppPush.promptForPermission();
                if (result?.error) console.warn('Push permission error:', result.error.message || result.error);
            });
            document.body.appendChild(el);
        }
        if (granted) {
            el.innerHTML = '🔔';
            el.title = 'התראות פעילות';
            Object.assign(el.style, {
                background: 'linear-gradient(135deg,#D4785C,#B8614A)',
                color:      'white',
                opacity:    '0.92',
            });
            el.style.pointerEvents = 'none'; // already granted – no action needed
        } else {
            el.innerHTML = '🔕';
            el.title = 'הפעל התראות';
            Object.assign(el.style, {
                background: 'rgba(255,255,255,0.92)',
                color:      '#8B7355',
                backdropFilter: 'blur(8px)',
                opacity:    '1',
                pointerEvents: 'auto',
            });
        }
        state.toggleRendered = true;
    };

    const removeToggle = () => {
        const el = document.getElementById(TOGGLE_ID);
        if (el) el.remove();
        state.toggleRendered = false;
    };

    // ─── OneSignal SDK helpers ─────────────────────────────────────────────────

    const runWithOneSignal = (callback) => new Promise((resolve, reject) => {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function (OneSignal) {
            try { resolve(await callback(OneSignal)); }
            catch (error) { reject(error); }
        });
    });

    const loadSdk = async () => {
        if (state.sdkLoaded) return true;
        await new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-onesignal-sdk="true"]');
            if (existing) {
                existing.addEventListener('load', () => resolve(), { once: true });
                existing.addEventListener('error', () => reject(new Error('OneSignal SDK failed to load')), { once: true });
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
            script.defer = true;
            script.dataset.onesignalSdk = 'true';
            script.addEventListener('load', () => resolve(), { once: true });
            script.addEventListener('error', () => reject(new Error('OneSignal SDK failed to load')), { once: true });
            document.head.appendChild(script);
        });
        state.sdkLoaded = true;
        return true;
    };

    const ensureInit = async (externalUserId) => {
        if (state.initialized && externalUserId && state.currentUserId !== String(externalUserId)) {
            await runWithOneSignal(async (OneSignal) => {
                await OneSignal.login(String(externalUserId));
            });
            state.currentUserId = String(externalUserId);
            return;
        }
        if (state.initialized) return;

        if (!state.initPromise) {
            state.initPromise = (async () => {
                await loadSdk();
                await runWithOneSignal(async (OneSignal) => {
                    await OneSignal.init({
                        appId: ONE_SIGNAL_APP_ID,
                        allowLocalhostAsSecureOrigin: true,
                        serviceWorkerPath: '/OneSignalSDKWorker.js',
                        serviceWorkerParam: { scope: '/' }
                    });
                    if (externalUserId) {
                        await OneSignal.login(String(externalUserId));
                    }
                });
                state.initialized = true;
                state.currentUserId = externalUserId ? String(externalUserId) : null;
            })();
        }
        await state.initPromise;
    };

    // ─── Public API ────────────────────────────────────────────────────────────

    window.AppPush = {
        async init(externalUserId) {
            if (!ONE_SIGNAL_APP_ID) return { error: { message: 'OneSignal app id not configured' } };
            if (!window.isSecureContext) return { error: { message: 'Push requires HTTPS context' } };
            try {
                await ensureInit(externalUserId);
                return { data: true, error: null };
            } catch (error) {
                console.error('Push init failed:', error);
                return { error };
            }
        },

        async promptForPermission() {
            if (!ONE_SIGNAL_APP_ID) return { error: { message: 'OneSignal app id not configured' } };
            try {
                await ensureInit(null);
                await runWithOneSignal(async (OneSignal) => {
                    const permission = OneSignal.Notifications.permission;
                    state.permission = permission;
                    if (permission === 'granted') { renderToggle(true); return; }
                    await OneSignal.Notifications.requestPermission();
                    const after = OneSignal.Notifications.permission;
                    state.permission = after;
                    renderToggle(after === 'granted');
                });
                return { data: true, error: null };
            } catch (error) {
                console.error('Push permission request failed:', error);
                renderToggle(false);
                return { error };
            }
        },

        async ensurePromptButton() {
            if (!ONE_SIGNAL_APP_ID) return;
            try {
                await ensureInit(null);
                await runWithOneSignal(async (OneSignal) => {
                    const permission = OneSignal.Notifications.permission;
                    state.permission = permission;
                    renderToggle(permission === 'granted');
                });
            } catch (error) {
                console.warn('Could not evaluate push permission state:', error);
                renderToggle(false);
            }
        }
    };
})();
