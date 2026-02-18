// OneSignal Web Push bootstrap
(function () {
    const config = window.APP_CONFIG || {};
    const ONE_SIGNAL_APP_ID = config.ONESIGNAL_APP_ID || '';
    const ONE_SIGNAL_SW_SCOPE = '/onesignal/';
    const ONE_SIGNAL_SW_PATH = '/onesignal/OneSignalSDKWorker.js';
    const ONE_SIGNAL_SW_UPDATER_PATH = '/onesignal/OneSignalSDKUpdaterWorker.js';

    const state = {
        initialized: false,
        sdkLoaded: false,
        currentUserId: null,
        initPromise: null
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
                        serviceWorkerPath: ONE_SIGNAL_SW_PATH,
                        serviceWorkerUpdaterPath: ONE_SIGNAL_SW_UPDATER_PATH,
                        serviceWorkerParam: { scope: ONE_SIGNAL_SW_SCOPE }
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
                    if (permission === 'granted') return;
                    await OneSignal.Notifications.requestPermission();
                });
                return { data: true, error: null };
            } catch (error) {
                console.error('Push permission request failed:', error);
                return { error };
            }
        }
    };
})();
