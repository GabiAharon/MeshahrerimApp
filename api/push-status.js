export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const appId = process.env.ONESIGNAL_APP_ID || process.env.VITE_ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !apiKey) {
    return res.status(500).json({
      error: 'OneSignal credentials missing',
      appIdPresent: !!appId,
      apiKeyPresent: !!apiKey
    });
  }

  try {
    const response = await fetch(`https://api.onesignal.com/apps/${appId}`, {
      headers: { Authorization: `Key ${apiKey}` }
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.errors || data });
    }
    return res.status(200).json({
      name: data.name,
      players: data.players,
      messageable_players: data.messageable_players,
      apns_env: data.apns_env,
      safari_enabled: !!data.safari_apns_certificate,
      gcm_key_present: !!data.gcm_key
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
