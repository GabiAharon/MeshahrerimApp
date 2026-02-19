export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const appId = process.env.ONESIGNAL_APP_ID || process.env.VITE_ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  return res.status(200).json({
    onesignal_app_id_present: !!appId,
    onesignal_app_id_length: appId ? appId.length : 0,
    onesignal_app_id_first_chars: appId ? appId.substring(0, 8) + '...' : 'MISSING',
    onesignal_api_key_present: !!apiKey,
    onesignal_api_key_length: apiKey ? apiKey.length : 0,
    env_keys: Object.keys(process.env).filter(k => k.includes('ONESIGNAL') || k.includes('VITE'))
  });
}
