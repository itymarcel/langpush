import { sql, initializeDatabase } from '../../lib/db.js';
import webpush from 'web-push';
import { randomPhraseNoRepeat } from '../../phrases.js';

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CONTACT_EMAIL } = process.env;
webpush.setVapidDetails(`mailto:${CONTACT_EMAIL}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

function guard(req, res, next) {
  if (req.headers['x-admin-key'] !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

export default async function handler(req, res) {
  await initializeDatabase();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Apply guard middleware
  guard(req, res, async () => {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ ok: false, error: "Missing endpoint" });

    try {
      const rows = await sql`SELECT id, data FROM subs WHERE data->>'endpoint' = ${endpoint}`;
      if (rows.length === 0) {
        return res.status(404).json({ ok: false, error: "Subscription not found" });
      }

      const row = rows[0];
      const sub = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
      const language = sub.language || 'italian';

      const phrase = randomPhraseNoRepeat(language);
      let payload;

      if (language === 'spanish') {
        payload = `🇪🇸 ${phrase.es}\n🇬🇧 ${phrase.en}`;
      } else if (language === 'french') {
        payload = `🇫🇷 ${phrase.fr}\n🇬🇧 ${phrase.en}`;
      } else if (language === 'japanese') {
        payload = `🇯🇵 ${phrase.ja}\n🇬🇧 ${phrase.en}`;
      } else {
        payload = `🇮🇹 ${phrase.it}\n🇬🇧 ${phrase.en}`;
      }

      const { language: _, ...cleanSub } = sub;
      await webpush.sendNotification(cleanSub, payload);

      res.json({ ok: true, sent: 1 });
    } catch (error) {
      console.error("Send now failed:", error);

      if (error.statusCode === 410 || error.statusCode === 404) {
        await sql`DELETE FROM subs WHERE data->>'endpoint' = ${endpoint}`;
      }

      res.status(500).json({ ok: false, error: "Failed to send notification" });
    }
  });
}