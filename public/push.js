// OneSignal Web Push - Simple & Direct
(function () {
    const config = window.APP_CONFIG || {};
    const ONE_SIGNAL_APP_ID = config.ONESIGNAL_APP_ID || '';

    if (!ONE_SIGNAL_APP_ID || !window.isSecureContext) {
        console.warn('OneSignal not configured or not in secure context');
        return;
    }

    // Load OneSignal SDK
    window.OneSignalDeferred = window.OneSignalDeferred || [];

    const script = document.createElement('script');
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    script.defer = true;
    document.head.appendChild(script);

    // Initialize when ready
    window.OneSignalDeferred.push(async function(OneSignal) {
        await OneSignal.init({
            appId: ONE_SIGNAL_APP_ID,
            allowLocalhostAsSecureOrigin: true
        });

        // Auto-prompt for permission if not already granted
        const permission = await OneSignal.Notifications.permission;
        if (permission === false) {
            // Not yet asked - show native prompt
            setTimeout(() => {
                OneSignal.Notifications.requestPermission();
            }, 3000); // Wait 3 seconds after page load
        }
    });

    // Public API for compatibility
    window.AppPush = {
        async init(externalUserId) {
            window.OneSignalDeferred.push(async function(OneSignal) {
                if (externalUserId) {
                    await OneSignal.login(String(externalUserId));
                }
            });
            return { data: true, error: null };
        },

        async promptForPermission() {
            return new Promise((resolve) => {
                window.OneSignalDeferred.push(async function(OneSignal) {
                    try {
                        await OneSignal.Notifications.requestPermission();
                        resolve({ data: true, error: null });
                    } catch (error) {
                        resolve({ error });
                    }
                });
            });
        },

        async ensurePromptButton() {
            // No-op - auto-prompts now
        }
    };
})();
