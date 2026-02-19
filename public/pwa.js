(function () {
  if (!('serviceWorker' in navigator)) return;

  let deferredInstallPrompt = null;

  function createInstallButton() {
    if (document.getElementById('pwa-install-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'pwa-install-btn';
    btn.type = 'button';
    btn.textContent = 'התקן אפליקציה';
    btn.style.position = 'fixed';
    btn.style.bottom = '96px';
    btn.style.left = '16px';
    btn.style.zIndex = '9999';
    btn.style.border = 'none';
    btn.style.borderRadius = '999px';
    btn.style.padding = '10px 14px';
    btn.style.background = '#2D5A4A';
    btn.style.color = '#fff';
    btn.style.fontFamily = 'Rubik, sans-serif';
    btn.style.fontWeight = '600';
    btn.style.boxShadow = '0 8px 20px rgba(0,0,0,0.2)';
    btn.style.cursor = 'pointer';
    btn.style.display = 'none';

    btn.addEventListener('click', async function () {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      btn.remove();
    });

    document.body.appendChild(btn);
    return btn;
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredInstallPrompt = event;
    const btn = createInstallButton();
    if (btn) btn.style.display = 'inline-flex';
  });

  window.addEventListener('appinstalled', function () {
    const btn = document.getElementById('pwa-install-btn');
    if (btn) btn.remove();
    deferredInstallPrompt = null;
  });

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
