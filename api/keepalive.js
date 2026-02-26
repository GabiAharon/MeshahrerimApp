/**
 * Supabase Keep-Alive endpoint
 * Called by Vercel Cron every 4 days to prevent Supabase project from pausing.
 * Makes a lightweight query that counts records in the profiles table.
 */
export default async function handler(req, res) {
  // Allow GET (cron) and POST (manual trigger)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const supabaseKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: 'Supabase credentials missing',
      hint: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables.'
    });
  }

  try {
    // Lightweight ping: count rows in profiles (HEAD request = no data returned)
    const response = await fetch(`${supabaseUrl}/rest/v1/profiles?select=id&limit=1`, {
      method: 'GET',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: 'count=exact'
      }
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({
        error: 'Supabase ping failed',
        status: response.status,
        detail: text.slice(0, 200)
      });
    }

    const now = new Date().toISOString();
    console.log(`[keepalive] Supabase pinged successfully at ${now}`);

    return res.status(200).json({
      ok: true,
      pingedAt: now,
      message: 'Supabase keep-alive ping succeeded'
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Unexpected keepalive failure'
    });
  }
}
