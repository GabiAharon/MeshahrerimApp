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
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const supabaseServiceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!appId || !apiKey) {
    return res.status(500).json({
      error: 'OneSignal server credentials are missing',
      hint: 'Set ONESIGNAL_APP_ID and ONESIGNAL_APP_API_KEY in Vercel (no Key/Basic prefix).'
    });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const title = (body.title || '').toString().trim();
  const message = (body.message || '').toString().trim();
  const url = (body.url || '/admin.html').toString();
  const adminUserIdsFromClient = Array.isArray(body.adminUserIds) ? body.adminUserIds : [];

  if (!title || !message) {
    return res.status(400).json({ error: 'title and message are required' });
  }

  let adminUserIds = adminUserIdsFromClient
    .map((id) => String(id || '').trim())
    .filter(Boolean);

  if (adminUserIds.length === 0 && supabaseUrl && supabaseServiceRoleKey) {
    try {
      const query = `${supabaseUrl}/rest/v1/profiles?select=id&is_admin=eq.true&is_approved=eq.true`;
      const supabaseRes = await fetch(query, {
        method: 'GET',
        headers: {
          apikey: supabaseServiceRoleKey,
          Authorization: `Bearer ${supabaseServiceRoleKey}`
        }
      });
      const supabaseData = await supabaseRes.json();
      if (supabaseRes.ok && Array.isArray(supabaseData)) {
        adminUserIds = supabaseData
          .map((row) => String(row?.id || '').trim())
          .filter(Boolean);
      }
    } catch (err) {
      console.error('Failed to fetch admin ids from Supabase:', err);
    }
  }

  adminUserIds = Array.from(new Set(adminUserIds));

  if (adminUserIds.length === 0) {
    return res.status(400).json({
      error: 'No admin users to notify',
      hint: 'Set SUPABASE_SERVICE_ROLE_KEY in Vercel so server can resolve admin user ids.'
    });
  }

  try {
    const sendNotification = async (bodyPayload) => {
      const response = await fetch('https://api.onesignal.com/notifications?c=push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Key ${apiKey}`
        },
        body: JSON.stringify(bodyPayload)
      });
      const result = await response.json();
      return { response, result };
    };

    const commonPayload = {
      app_id: appId,
      target_channel: 'push',
      headings: { en: title, he: title },
      contents: { en: message, he: message },
      url,
      // Unique collapse_id per notification — prevents overwriting previous ones
      collapse_id: `admin-${Date.now()}`,
      priority: 10
    };

    // Primary route: direct by external_id aliases (user.id)
    const primary = await sendNotification({
      ...commonPayload,
      include_aliases: { external_id: adminUserIds }
    });

    // Fallback route: tagged admins (role=admin) in case alias mapping is missing.
    let finalResponse = primary.response;
    let finalResult = primary.result;
    if (primary.response.ok && Number(primary.result?.recipients || 0) === 0) {
      const fallback = await sendNotification({
        ...commonPayload,
        filters: [{ field: 'tag', key: 'role', relation: '=', value: 'admin' }]
      });
      finalResponse = fallback.response;
      finalResult = fallback.result;
    }

    if (!finalResponse.ok) {
      return res.status(finalResponse.status).json({
        error: finalResult?.errors || finalResult?.message || 'OneSignal request failed',
        hint: finalResponse.status === 401 || finalResponse.status === 403
          ? 'Check ONESIGNAL_APP_API_KEY in Vercel. Paste raw key only, without prefix.'
          : undefined
      });
    }

    return res.status(200).json({
      id: finalResult.id,
      recipients: finalResult.recipients || 0
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Unexpected push send failure'
    });
  }
}
