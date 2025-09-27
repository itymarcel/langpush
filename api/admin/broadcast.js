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

  // Apply guard middleware
  guard(req, res, async () => {
    try {
      const rows = await sql`SELECT id, data FROM subs`;

      let sent = 0;
      let failed = 0;
      let phrases = {};

      for (const row of rows) {
        const sub = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
        const language = sub.language || 'italian';

        if (!phrases[language]) {
          phrases[language] = randomPhraseNoRepeat(language);
        }

        const phrase = phrases[language];
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

        try {
          const { language: _, ...cleanSub } = sub;
          await webpush.sendNotification(cleanSub, payload);
          sent++;
        } catch (e) {
          failed++;
          console.error("Push failed:", e.statusCode, e.body?.toString() || e.message);
          if (e.statusCode === 410 || e.statusCode === 404) {
            await sql`DELETE FROM subs WHERE id = ${row.id}`;
          }
        }
      }

      res.json({ ok: true, sent, failed, phrases });
    } catch (error) {
      console.error("Broadcast error:", error);
      res.status(500).json({ ok: false, error: "Broadcast failed" });
    }
  });
}