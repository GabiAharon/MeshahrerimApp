// OneSignal Web Push bootstrap
(function() {
    const config = window.APP_CONFIG || {};
    const ONE_SIGNAL_APP_ID = config.ONESIGNAL_APP_ID || '';

    const state = {
        initialized: false,
        sdkLoaded: false
    };

    const loadSdk = async () => {
        if (state.sdkLoaded) return true;

        await new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-onesignal-sdk="true"]');
            if (existing) {
                existing.addEventListener('load', () => resolve(), { once: true });
                existing.addEventListener('error', () => reject(new Error('OneSignal SDK failed')), { once: true });
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
            script.defer = true;
            script.dataset.onesignalSdk = 'true';
            script.addEventListener('load', () => resolve(), { once: true });
            script.addEventListener('error', () => reject(new Error('OneSignal SDK failed')), { once: true });
            document.head.appendChild(script);
        });

        state.sdkLoaded = true;
        return true;
    };

    window.AppPush = {
        async init(externalUserId) {
            if (!ONE_SIGNAL_APP_ID) {
                return { error: { message: 'OneSignal app id not configured' } };
            }
            if (!window.isSecureContext) {
                return { error: { message: 'Push requires HTTPS' } };
            }
            if (state.initialized) return { data: true, error: null };

            try {
                await loadSdk();
                window.OneSignalDeferred = window.OneSignalDeferred || [];
                window.OneSignalDeferred.push(async function(OneSignal) {
                    await OneSignal.init({
                        appId: ONE_SIGNAL_APP_ID,
                        allowLocalhostAsSecureOrigin: true
                    });
                    if (externalUserId) {
                        await OneSignal.login(String(externalUserId));
                    }
                });
                state.initialized = true;
                return { data: true, error: null };
            } catch (error) {
                return { error };
            }
        },

        async promptForPermission() {
            if (!state.initialized) return { error: { message: 'Push not initialized' } };

            try {
                window.OneSignalDeferred = window.OneSignalDeferred || [];
                window.OneSignalDeferred.push(async function(OneSignal) {
                    await OneSignal.Notifications.requestPermission();
                });
                return { data: true, error: null };
            } catch (error) {
                return { error };
            }
        }
    };
})();
