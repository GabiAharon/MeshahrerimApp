(function () {
  if (!('serviceWorker' in navigator)) return;

  let deferredInstallPrompt = null;
  const BANNER_ID = 'pwa-install-banner';

  // ─── Install Banner ──────────────────────────────────────────────────────────

  function createInstallBanner() {
    if (document.getElementById(BANNER_ID)) return null;

    const banner = document.createElement('div');
    banner.id = BANNER_ID;
    Object.assign(banner.style, {
      position:       'fixed',
      bottom:         'calc(env(safe-area-inset-bottom, 0px) + 86px)',
      left:           '50%',
      transform:      'translateX(-50%) translateY(20px)',
      zIndex:         '9997',
      display:        'flex',
      alignItems:     'center',
      gap:            '12px',
      background:     'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderRadius:   '18px',
      padding:        '12px 16px',
      boxShadow:      '0 8px 32px rgba(61,46,42,0.14), 0 1px 0 rgba(255,255,255,0.8) inset',
      border:         '1px solid rgba(212,120,92,0.15)',
      maxWidth:       '320px',
      width:          'calc(100% - 48px)',
      opacity:        '0',
      transition:     'all 0.4s cubic-bezier(0.34,1.56,0.64,1)',
      pointerEvents:  'none',
    });

    // Icon
    const icon = document.createElement('img');
    icon.src = '/icons/icon-192-v4.png';
    Object.assign(icon.style, {
      width: '40px', height: '40px',
      borderRadius: '10px',
      flexShrink: '0',
    });

    // Text
    const textWrap = document.createElement('div');
    textWrap.style.flex = '1';
    textWrap.style.minWidth = '0';

    const title = document.createElement('div');
    title.textContent = 'MyBuilding';
    Object.assign(title.style, {
      fontFamily: 'Rubik, sans-serif',
      fontWeight: '700',
      fontSize:   '0.875rem',
      color:      '#3D2E2A',
      lineHeight: '1.2',
    });

    const sub = document.createElement('div');
    sub.textContent = 'הוסיפי לסרגל הבית';
    Object.assign(sub.style, {
      fontFamily: 'Rubik, sans-serif',
      fontSize:   '0.75rem',
      color:      '#8B7355',
      marginTop:  '1px',
    });

    textWrap.appendChild(title);
    textWrap.appendChild(sub);

    // Install button
    const installBtn = document.createElement('button');
    installBtn.type = 'button';
    installBtn.textContent = 'התקן';
    Object.assign(installBtn.style, {
      background:   'linear-gradient(135deg,#D4785C,#B8614A)',
      color:        'white',
      border:       'none',
      borderRadius: '999px',
      padding:      '7px 16px',
      fontFamily:   'Rubik, sans-serif',
      fontWeight:   '700',
      fontSize:     '0.8125rem',
      cursor:       'pointer',
      whiteSpace:   'nowrap',
      flexShrink:   '0',
    });
    installBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      hideBanner();
    });

    // Dismiss X
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.innerHTML = '&times;';
    Object.assign(dismiss.style, {
      background:   'none',
      border:       'none',
      padding:      '0 2px',
      color:        '#B8A090',
      fontSize:     '1.1rem',
      lineHeight:   '1',
      cursor:       'pointer',
      flexShrink:   '0',
    });
    dismiss.addEventListener('click', () => {
      hideBanner();
      // Don't show again this session
      sessionStorage.setItem('pwa-install-dismissed', '1');
    });

    banner.appendChild(icon);
    banner.appendChild(textWrap);
    banner.appendChild(installBtn);
    banner.appendChild(dismiss);

    document.body.appendChild(banner);
    return banner;
  }

  function showBanner() {
    if (sessionStorage.getItem('pwa-install-dismissed')) return;
    const banner = createInstallBanner();
    if (!banner) return;
    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        banner.style.opacity = '1';
        banner.style.transform = 'translateX(-50%) translateY(0)';
        banner.style.pointerEvents = 'auto';
      });
    });
  }

  function hideBanner() {
    const banner = document.getElementById(BANNER_ID);
    if (!banner) return;
    banner.style.opacity = '0';
    banner.style.transform = 'translateX(-50%) translateY(20px)';
    banner.style.pointerEvents = 'none';
    setTimeout(() => { if (banner.parentNode) banner.remove(); }, 400);
  }

  // ─── Events ──────────────────────────────────────────────────────────────────

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredInstallPrompt = event;
    // Show banner after a short delay so the page has loaded
    setTimeout(showBanner, 2500);
  });

  window.addEventListener('appinstalled', function () {
    hideBanner();
    deferredInstallPrompt = null;
  });

  // ─── Service Worker ───────────────────────────────────────────────────────────

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js')
      .then(function () {
        navigator.serviceWorker.addEventListener('controllerchange', function () {
          window.location.reload();
        });
      })
      .catch(function (error) {
        console.warn('Service worker registration failed:', error);
      });
  });
})();
