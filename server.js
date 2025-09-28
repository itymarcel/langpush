import express from "express";
import bodyParser from "body-parser";
import pkg from 'pg'
import webpush from "web-push";
import { randomPhraseNoRepeat } from "./phrases.js";
import { config } from 'dotenv';
import https from 'https';
import fs from 'fs';
import chokidar from 'chokidar';

config();

const { Pool } = pkg

const app = express();
app.use(bodyParser.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})
await pool.query(`CREATE TABLE IF NOT EXISTS subs (
  id BIGSERIAL PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_phrase_original TEXT,
  last_phrase_english TEXT,
  last_phrase_language VARCHAR(20),
  last_notification_sent_at TIMESTAMP
)`)

// Add created_at column if it doesn't exist (for existing databases)
await pool.query(`
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subs' AND column_name='created_at') THEN
      ALTER TABLE subs ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
  END $$;
`)

// Add last notification columns if they don't exist (for existing databases)
try {
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subs' AND column_name='last_phrase_original') THEN
        ALTER TABLE subs ADD COLUMN last_phrase_original TEXT;
        RAISE NOTICE 'Added column: last_phrase_original';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subs' AND column_name='last_phrase_english') THEN
        ALTER TABLE subs ADD COLUMN last_phrase_english TEXT;
        RAISE NOTICE 'Added column: last_phrase_english';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subs' AND column_name='last_phrase_language') THEN
        ALTER TABLE subs ADD COLUMN last_phrase_language VARCHAR(20);
        RAISE NOTICE 'Added column: last_phrase_language';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subs' AND column_name='last_notification_sent_at') THEN
        ALTER TABLE subs ADD COLUMN last_notification_sent_at TIMESTAMP;
        RAISE NOTICE 'Added column: last_notification_sent_at';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subs' AND column_name='deactivated') THEN
        ALTER TABLE subs ADD COLUMN deactivated BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added column: deactivated';
      END IF;
    END $$;
  `);
  console.log('✅ Database migration completed successfully');
} catch (error) {
  console.error('❌ Database migration failed:', error);
  console.error('Migration error details:', error.message);
  process.exit(1);
}

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CONTACT_EMAIL } = process.env;
webpush.setVapidDetails(`mailto:${CONTACT_EMAIL}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

app.get("/vapidPublicKey", (req, res) => {
  res.send(VAPID_PUBLIC_KEY);
});

app.get("/admin-key", (req, res) => {
  res.send(process.env.ADMIN_KEY);
});

// Get last notification for a subscription
app.get("/last-notification", async (req, res) => {
  const { endpoint } = req.query;
  if (!endpoint) return res.status(400).json({ ok: false, error: "Missing endpoint" });

  try {
    const { rows } = await pool.query(
      "SELECT last_phrase_original, last_phrase_english, last_phrase_language, last_notification_sent_at FROM subs WHERE data->>'endpoint' = $1 AND (deactivated = FALSE OR deactivated IS NULL)",
      [endpoint]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Subscription not found" });
    }

    const notification = rows[0];
    if (!notification.last_phrase_original) {
      return res.json({ ok: true, hasNotification: false });
    }

    res.json({
      ok: true,
      hasNotification: true,
      original: notification.last_phrase_original,
      english: notification.last_phrase_english,
      language: notification.last_phrase_language,
      sentAt: notification.last_notification_sent_at
    });
  } catch (error) {
    console.error("Get last notification error:", error);
    res.status(500).json({ ok: false, error: "Database error" });
  }
});

function guard(req, res, next) {
  if (req.get("X-Admin-Key") !== process.env.ADMIN_KEY) return res.sendStatus(401);
  next();
}

// count + sample
app.get("/admin/subs", guard, async (req, res) => {
  const showDeactivated = req.query.show_deactivated === 'true';

  let query = "SELECT id, data, created_at, deactivated FROM subs";
  let countQuery = "SELECT COUNT(*)::int AS c FROM subs";

  if (!showDeactivated) {
    query += " WHERE deactivated = FALSE OR deactivated IS NULL";
    countQuery += " WHERE deactivated = FALSE OR deactivated IS NULL";
  }

  query += " ORDER BY created_at DESC LIMIT 25";

  const { rows } = await pool.query(query);
  const { rows: c } = await pool.query(countQuery);
  const { rows: deactivatedCount } = await pool.query("SELECT COUNT(*)::int AS c FROM subs WHERE deactivated = TRUE");

  res.json({
    count: c[0].c,
    deactivated_count: deactivatedCount[0].c,
    rows
  });
});


app.post("/subscribe", async (req, res) => {
  const sub = req.body;
  const endpoint = sub?.endpoint;
  if (!endpoint) return res.status(400).json({ ok: false, error: "Missing endpoint" });

  try {
    // Check if subscription already exists (active or deactivated)
    const { rows: existing } = await pool.query("SELECT id, deactivated FROM subs WHERE data->>'endpoint' = $1", [endpoint]);

    if (existing.length > 0) {
      // Reactivate existing subscription and update data
      await pool.query(
        "UPDATE subs SET data = $1, deactivated = FALSE WHERE data->>'endpoint' = $2",
        [JSON.stringify(sub), endpoint]
      );
    } else {
      // Create new subscription
      await pool.query("INSERT INTO subs (data, deactivated) VALUES ($1, FALSE)", [JSON.stringify(sub)]);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("Subscribe error:", error);
    res.status(500).json({ ok: false, error: "Database error" });
  }
});

// 1) check if a subscription exists (by endpoint) - exclude deactivated
app.get("/subscribe/exists", async (req, res) => {
  const endpoint = req.query.endpoint;
  if (!endpoint) return res.status(400).json({ ok: false, error: "Missing endpoint" });
  const { rows } = await pool.query("SELECT 1 FROM subs WHERE data->>'endpoint' = $1 AND (deactivated = FALSE OR deactivated IS NULL) LIMIT 1", [endpoint]);
  res.json({ ok: true, exists: rows.length > 0 });
});

// 2) deactivate subscription (by endpoint) - soft delete
app.delete("/subscribe", async (req, res) => {
  const endpoint = req.body?.endpoint || req.query.endpoint;
  if (!endpoint) return res.status(400).json({ ok: false, error: "Missing endpoint" });
  const r = await pool.query("UPDATE subs SET deactivated = TRUE WHERE data->>'endpoint' = $1 AND (deactivated = FALSE OR deactivated IS NULL)", [endpoint]);
  res.json({ ok: true, deactivated: r.rowCount });
});

app.post("/admin/broadcast", guard, async (_req, res) => {
  const { rows } = await pool.query("SELECT id, data, created_at FROM subs WHERE deactivated = FALSE OR deactivated IS NULL");

  let sent = 0;
  let failed = 0;
  let phrases = {};

  for (const row of rows) {
    const sub = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    const language = sub.language || 'italian'; // Default to Italian if no language specified

    // Generate phrase for this language if we haven't already
    if (!phrases[language]) {
      phrases[language] = randomPhraseNoRepeat(language);
    }

    const phrase = phrases[language];
    let payload;

    if (language === 'spanish') {
      payload = JSON.stringify({
        title: 'New Spanish Phrase',
        body: `🇪🇸 ${phrase.es}\n🇬🇧 ${phrase.en}`,
        icon: '/icon-192.png',
        badge: '/icon-192.png'
      });
    } else if (language === 'french') {
      payload = JSON.stringify({
        title: 'New French Phrase',
        body: `🇫🇷 ${phrase.fr}\n🇬🇧 ${phrase.en}`,
        icon: '/icon-192.png',
        badge: '/icon-192.png'
      });
    } else if (language === 'japanese') {
      payload = JSON.stringify({
        title: 'New Japanese Phrase',
        body: `🇯🇵 ${phrase.ja}\n🇬🇧 ${phrase.en}`,
        icon: '/icon-192.png',
        badge: '/icon-192.png'
      });
    } else {
      payload = JSON.stringify({
        title: 'New Italian Phrase',
        body: `🇮🇹 ${phrase.it}\n🇬🇧 ${phrase.en}`,
        icon: '/icon-192.png',
        badge: '/icon-192.png'
      });
    }

    try {
      // Create clean subscription object without our custom language field
      const { language: _, ...cleanSub } = sub;
      await webpush.sendNotification(cleanSub, payload);

      // Update last notification info
      await pool.query(
        "UPDATE subs SET last_phrase_original = $1, last_phrase_english = $2, last_phrase_language = $3, last_notification_sent_at = CURRENT_TIMESTAMP WHERE id = $4",
        [phrase[language === 'spanish' ? 'es' : language === 'french' ? 'fr' : language === 'japanese' ? 'ja' : 'it'], phrase.en, language, row.id]
      );

      sent++;
    } catch (e) {
      failed++;
      console.error("Push failed:", e.statusCode, e.body?.toString() || e.message);
      if (e.statusCode === 410 || e.statusCode === 404) {
        await pool.query("DELETE FROM subs WHERE id = $1", [row.id]);
      }
    }
  }
  res.json({ ok: true, sent, failed, phrases });
});

app.post("/admin/send-now", guard, async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ ok: false, error: "Missing endpoint" });

  try {
    // Find the subscription by endpoint - exclude deactivated
    const { rows } = await pool.query("SELECT id, data, created_at FROM subs WHERE data->>'endpoint' = $1 AND (deactivated = FALSE OR deactivated IS NULL)", [endpoint]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Subscription not found or deactivated" });
    }

    const row = rows[0];
    const sub = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    const language = sub.language || 'italian';

    // Generate a phrase for this user's language
    const phrase = randomPhraseNoRepeat(language);
    let payload;

    if (language === 'spanish') {
      payload = JSON.stringify({
        title: 'New Spanish Phrase',
        body: `🇪🇸 ${phrase.es}\n🇬🇧 ${phrase.en}`,
        icon: '/icon-192.png',
        badge: '/icon-192.png'
      });
    } else if (language === 'french') {
      payload = JSON.stringify({
        title: 'New French Phrase',
        body: `🇫🇷 ${phrase.fr}\n🇬🇧 ${phrase.en}`,
        icon: '/icon-192.png',
        badge: '/icon-192.png'
      });
    } else if (language === 'japanese') {
      payload = JSON.stringify({
        title: 'New Japanese Phrase',
        body: `🇯🇵 ${phrase.ja}\n🇬🇧 ${phrase.en}`,
        icon: '/icon-192.png',
        badge: '/icon-192.png'
      });
    } else {
      payload = JSON.stringify({
        title: 'New Italian Phrase',
        body: `🇮🇹 ${phrase.it}\n🇬🇧 ${phrase.en}`,
        icon: '/icon-192.png',
        badge: '/icon-192.png'
      });
    }

    // Create clean subscription object without our custom language field
    const { language: _, ...cleanSub } = sub;
    await webpush.sendNotification(cleanSub, payload);

    // Update last notification info
    await pool.query(
      "UPDATE subs SET last_phrase_original = $1, last_phrase_english = $2, last_phrase_language = $3, last_notification_sent_at = CURRENT_TIMESTAMP WHERE id = $4",
      [phrase[language === 'spanish' ? 'es' : language === 'french' ? 'fr' : language === 'japanese' ? 'ja' : 'it'], phrase.en, language, row.id]
    );

    res.json({ ok: true, sent: 1 });
  } catch (error) {
    console.error("Send now failed:", error);

    // Clean up invalid subscriptions
    if (error.statusCode === 410 || error.statusCode === 404) {
      await pool.query("DELETE FROM subs WHERE data->>'endpoint' = $1", [endpoint]);
    }

    res.status(500).json({ ok: false, error: "Failed to send notification" });
  }
});

// Live reload for development
let clients = [];
if (process.env.NODE_ENV !== 'production') {
  app.get('/live-reload', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    clients.push(res);

    req.on('close', () => {
      clients = clients.filter(client => client !== res);
    });
  });

  // Watch for file changes in public directory
  const watcher = chokidar.watch('./public', {ignored: /^\./, persistent: true});
  watcher.on('change', () => {
    clients.forEach(client => {
      client.write('data: reload\n\n');
    });
  });
}

// serve static site
app.use(express.static("public"));

const port = process.env.PORT || 3000;
const isProduction = process.env.ENVIRONMENT === 'production';
const host = isProduction ? '0.0.0.0' : 'localhost';

// In production or when no certs exist, use HTTP only
if (isProduction) {
  app.listen(port, host, () => console.log(`Server running on http://${host}:${port}`));
} else {
  // Try to use HTTPS in development if certificates exist
  try {
    const options = {
      key: fs.readFileSync('./localhost+2-key.pem'),
      cert: fs.readFileSync('./localhost+2.pem')
    };
    https.createServer(options, app).listen(port, host, () => {
      console.log(`Server running on https://${host}:${port}`);
    });
  } catch (err) {
    // Fallback to HTTP if certificates don't exist
    app.listen(port, host, () => {
      console.log(`Server running on http://${host}:${port} (no HTTPS certificates found)`);
    });
  }
}
