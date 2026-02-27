// OneSignal Web Push bootstrap
(function () {
    const config = window.APP_CONFIG || {};
    const ONE_SIGNAL_APP_ID = config.ONESIGNAL_APP_ID || '';

    const state = {
        initialized: false,
        sdkLoaded: false,
        currentUserId: null,
        initPromise: null,
        promptButtonShown: false,
        indexedDBAvailable: false
    };

    // Check IndexedDB availability
    const checkIndexedDB = async () => {
        if (!window.indexedDB) {
            console.warn('IndexedDB not available in this browser');
            return false;
        }

        try {
            const testDB = await new Promise((resolve, reject) => {
                const request = indexedDB.open('__test__', 1);
                request.onsuccess = () => {
                    const db = request.result;
                    db.close();
                    indexedDB.deleteDatabase('__test__');
                    resolve(true);
                };
                request.onerror = () => reject(request.error);
                request.onblocked = () => reject(new Error('IndexedDB blocked'));
            });
            return testDB;
        } catch (error) {
            console.warn('IndexedDB test failed:', error);
            return false;
        }
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
                        serviceWorkerPath: '/sw.js',
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

    const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);

    window.AppPush = {
        async init(externalUserId) {
            if (isLocalhost) {
                console.log('[dev] Push init skipped on localhost');
                return { data: true, error: null };
            }
            if (!ONE_SIGNAL_APP_ID) {
                console.warn('Push init skipped: OneSignal app id not configured');
                return { error: { message: 'OneSignal app id not configured' } };
            }
            if (!window.isSecureContext) {
                console.warn('Push init skipped: Requires HTTPS context');
                return { error: { message: 'Push requires HTTPS context' } };
            }

            // Check IndexedDB availability first
            if (!state.indexedDBAvailable) {
                state.indexedDBAvailable = await checkIndexedDB();
                if (!state.indexedDBAvailable) {
                    console.warn('Push init skipped: IndexedDB not available');
                    return { error: { message: 'IndexedDB not available. Push notifications require IndexedDB support.' } };
                }
            }

            try {
                await ensureInit(externalUserId);

                // Store the OneSignal subscription ID in the user's Supabase profile.
                // The ID is often null right after init, so we poll every second
                // for up to 15 seconds until the SDK populates it.
                if (externalUserId && window.AppAuth) {
                    const uid = String(externalUserId);
                    const trySaveSubId = async () => {
                        try {
                            return await runWithOneSignal(async (OneSignal) => {
                                const subId = OneSignal.User?.PushSubscription?.id;
                                if (subId) {
                                    await window.AppAuth.updateMyProfile(uid, {
                                        onesignal_subscription_id: subId
                                    });
                                    return true;
                                }
                                return false;
                            });
                        } catch (e) {
                            console.warn('Could not store OneSignal subscription id:', e);
                            return false;
                        }
                    };

                    // Attempt immediately, then poll if still null
                    const saved = await trySaveSubId();
                    if (!saved) {
                        let attempts = 0;
                        const poll = setInterval(async () => {
                            attempts++;
                            const ok = await trySaveSubId();
                            if (ok || attempts >= 15) clearInterval(poll);
                        }, 1000);
                    }
                }

                return { data: true, error: null };
            } catch (error) {
                console.error('Push init failed:', error);
                return { error };
            }
        },

        async promptForPermission() {
            if (isLocalhost) {
                console.log('[dev] Push permission skipped on localhost');
                return { data: true, error: null };
            }
            if (!ONE_SIGNAL_APP_ID) {
                return { error: { message: 'OneSignal app id not configured' } };
            }

            // Check IndexedDB availability first
            if (!state.indexedDBAvailable) {
                state.indexedDBAvailable = await checkIndexedDB();
                if (!state.indexedDBAvailable) {
                    console.warn('Push prompt skipped: IndexedDB not available');
                    return { error: { message: 'IndexedDB not available. Please check browser settings or try a different browser.' } };
                }
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
            if (isLocalhost) return;
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
        },

        async setTag(key, value) {
            if (isLocalhost) return { data: true, error: null };
            if (!ONE_SIGNAL_APP_ID) return { error: { message: 'OneSignal app id not configured' } };
            if (!key) return { error: { message: 'Tag key is required' } };
            try {
                await ensureInit(state.currentUserId || null);
                await runWithOneSignal(async (OneSignal) => {
                    const tagValue = value == null ? '' : String(value);
                    await OneSignal.User.addTag(String(key), tagValue);
                });
                return { data: true, error: null };
            } catch (error) {
                console.warn('Failed setting OneSignal tag:', error);
                return { error };
            }
        }
    };
})();
