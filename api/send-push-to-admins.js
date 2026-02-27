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

  if (!title || !message) {
    return res.status(400).json({ error: 'title and message are required' });
  }

  // Accept targeting data from the client (populated via get_admin_push_targets RPC).
  // This avoids the need for SUPABASE_SERVICE_ROLE_KEY on the server.
  let adminSubscriptionIds = (Array.isArray(body.adminSubscriptionIds) ? body.adminSubscriptionIds : [])
    .map((id) => String(id || '').trim())
    .filter(Boolean);
  let adminUserIds = (Array.isArray(body.adminUserIds) ? body.adminUserIds : [])
    .map((id) => String(id || '').trim())
    .filter(Boolean);

  // Fallback: server-side Supabase lookup if client didn't provide targets.
  if (adminSubscriptionIds.length === 0 && adminUserIds.length === 0 && supabaseUrl && supabaseServiceRoleKey) {
    try {
      const query = `${supabaseUrl}/rest/v1/profiles?select=id,onesignal_subscription_id&is_admin=eq.true&is_approved=eq.true`;
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
        adminSubscriptionIds = supabaseData
          .map((row) => String(row?.onesignal_subscription_id || '').trim())
          .filter(Boolean);
      }
    } catch (err) {
      console.error('Failed to fetch admin profiles from Supabase:', err);
    }
  }

  adminUserIds = Array.from(new Set(adminUserIds));
  adminSubscriptionIds = Array.from(new Set(adminSubscriptionIds));

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
      priority: 10
    };

    // Route 1 (most reliable): direct subscription IDs stored in profiles table.
    // These are set when the admin opens any page with push.js loaded.
    if (adminSubscriptionIds.length > 0) {
      const result = await sendNotification({
        ...commonPayload,
        include_subscription_ids: adminSubscriptionIds
      });
      if (result.response.ok) {
        return res.status(200).json({
          id: result.result.id,
          recipients: result.result.recipients || 0,
          route: 'subscription-ids'
        });
      }
      console.warn('Subscription-id route failed:', result.result);
    }

    // Route 2: external_id aliases (user.id linked via OneSignal.login).
    if (adminUserIds.length > 0) {
      const primary = await sendNotification({
        ...commonPayload,
        include_aliases: { external_id: adminUserIds }
      });
      if (primary.response.ok && Number(primary.result?.recipients || 0) > 0) {
        return res.status(200).json({
          id: primary.result.id,
          recipients: primary.result.recipients || 0,
          route: 'external-id'
        });
      }
    }

    // Route 3 (broadest fallback): tag filter — works if admin has role=admin tag set.
    const tagResult = await sendNotification({
      ...commonPayload,
      filters: [{ field: 'tag', key: 'role', relation: '=', value: 'admin' }]
    });
    if (!tagResult.response.ok) {
      return res.status(tagResult.response.status).json({
        error: tagResult.result?.errors || tagResult.result?.message || 'OneSignal request failed',
        hint: tagResult.response.status === 401 || tagResult.response.status === 403
          ? 'Check ONESIGNAL_APP_API_KEY in Vercel. Paste raw key only, without prefix.'
          : 'Set SUPABASE_SERVICE_ROLE_KEY in Vercel for reliable admin targeting.'
      });
    }
    return res.status(200).json({
      id: tagResult.result.id,
      recipients: tagResult.result.recipients || 0,
      route: 'tag-filter'
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Unexpected push send failure'
    });
  }
}
