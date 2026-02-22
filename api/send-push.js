export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const appId = (process.env.ONESIGNAL_APP_ID || process.env.VITE_ONESIGNAL_APP_ID || '').trim();
  const rawApiKey = (
    process.env.ONESIGNAL_APP_API_KEY ||
    process.env.ONESIGNAL_REST_API_KEY ||
    process.env.ONESIGNAL_API_KEY ||
    ''
  ).trim();
  const apiKey = rawApiKey
    .replace(/^['"]|['"]$/g, '')
    .replace(/^basic\s+/i, '')
    .replace(/^key\s+/i, '');

  if (!appId || !apiKey) {
    return res.status(500).json({
      error: 'OneSignal server credentials are missing',
      hint: 'Set ONESIGNAL_APP_ID and ONESIGNAL_APP_API_KEY in Vercel (no Key/Basic prefix).'
    });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const title = (body.title || '').toString().trim();
  const message = (body.message || '').toString().trim();
  const url = (body.url || '/index.html').toString();

  if (!title || !message) {
    return res.status(400).json({ error: 'title and message are required' });
  }

  try {
    const response = await fetch('https://api.onesignal.com/notifications?c=push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${apiKey}`
      },
      body: JSON.stringify({
        app_id: appId,
        included_segments: ['All'],
        target_channel: 'push',
        headings: { en: title, he: title },
        contents: { en: message, he: message },
        url,
        // Do NOT group notifications - each is separate
        priority: 10
      })
    });

    const result = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: result?.errors || result?.message || 'OneSignal request failed',
        hint: response.status === 401 || response.status === 403
          ? 'Check ONESIGNAL_APP_API_KEY in Vercel. Paste raw key only, without prefix.'
          : undefined
      });
    }

    return res.status(200).json({
      id: result.id,
      recipients: result.recipients || 0
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Unexpected push send failure'
    });
  }
}
