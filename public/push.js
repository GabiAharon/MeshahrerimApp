// OneSignal Web Push bootstrap
(function () {
    const config = window.APP_CONFIG || {};
    const ONE_SIGNAL_APP_ID = config.ONESIGNAL_APP_ID || '';

    const state = {
        initialized: false,
        sdkLoaded: false,
        currentUserId: null,
        initPromise: null,
        promptButtonShown: false
    };

    const removePromptButton = () => {
        const existing = document.getElementById('push-enable-btn');
        if (existing) existing.remove();
        state.promptButtonShown = false;
    };

    const showPromptButton = () => {
        if (state.promptButtonShown || document.getElementById('push-enable-btn')) return;
        const btn = document.createElement('button');
        btn.id = 'push-enable-btn';
        btn.type = 'button';
        btn.textContent = 'הפעל התראות';
        btn.style.position = 'fixed';
        btn.style.bottom = '156px';
        btn.style.left = '16px';
        btn.style.zIndex = '9999';
        btn.style.border = 'none';
        btn.style.borderRadius = '999px';
        btn.style.padding = '10px 14px';
        btn.style.background = '#D4785C';
        btn.style.color = '#fff';
        btn.style.fontFamily = 'Assistant, Rubik, sans-serif';
        btn.style.fontWeight = '700';
        btn.style.boxShadow = '0 8px 20px rgba(0,0,0,0.2)';
        btn.style.cursor = 'pointer';
        btn.addEventListener('click', async () => {
            const result = await window.AppPush.promptForPermission();
            if (result?.error) {
                alert(result.error.message || 'נכשל בהפעלת התראות');
                return;
            }
            removePromptButton();
        });
        document.body.appendChild(btn);
        state.promptButtonShown = true;
    };

    const runWithOneSignal = (callback) => new Promise((resolve, reject) => {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function (OneSignal) {
            try {
                const result = await callback(OneSignal);
                resolve(result);
            } catch (error) {
                reject(error);
            }
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

    window.AppPush = {
        async init(externalUserId) {
            if (!ONE_SIGNAL_APP_ID) {
                return { error: { message: 'OneSignal app id not configured' } };
            }
            if (!window.isSecureContext) {
                return { error: { message: 'Push requires HTTPS context' } };
            }

            try {
                await ensureInit(externalUserId);
                return { data: true, error: null };
            } catch (error) {
                console.error('Push init failed:', error);
                return { error };
            }
        },

        async promptForPermission() {
            if (!ONE_SIGNAL_APP_ID) {
                return { error: { message: 'OneSignal app id not configured' } };
            }

            try {
                await ensureInit(null);
                await runWithOneSignal(async (OneSignal) => {
                    const permission = await OneSignal.Notifications.permission;
                    if (permission === 'granted') {
                        removePromptButton();
                        return;
                    }
                    await OneSignal.Notifications.requestPermission();
                    const afterPermission = await OneSignal.Notifications.permission;
                    if (afterPermission === 'granted') {
                        removePromptButton();
                    }
                });
                return { data: true, error: null };
            } catch (error) {
                console.error('Push permission request failed:', error);
                showPromptButton();
                return { error };
            }
        },

        async ensurePromptButton() {
            if (!ONE_SIGNAL_APP_ID) return;
            try {
                await ensureInit(null);
                await runWithOneSignal(async (OneSignal) => {
                    const permission = await OneSignal.Notifications.permission;
                    if (permission === 'granted') {
                        removePromptButton();
                    } else {
                        showPromptButton();
                    }
                });
            } catch (error) {
                console.warn('Could not evaluate push permission state:', error);
                showPromptButton();
            }
        }
    };
})();
