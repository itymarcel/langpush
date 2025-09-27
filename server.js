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
  data JSONB NOT NULL
)`)

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CONTACT_EMAIL } = process.env;
webpush.setVapidDetails(`mailto:${CONTACT_EMAIL}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

app.get("/vapidPublicKey", (req, res) => {
  res.send(VAPID_PUBLIC_KEY);
});

app.get("/admin-key", (req, res) => {
  res.send(process.env.ADMIN_KEY);
});

function guard(req, res, next) {
  if (req.get("X-Admin-Key") !== process.env.ADMIN_KEY) return res.sendStatus(401);
  next();
}

// count + sample
app.get("/admin/subs", guard, async (req, res) => {
  const { rows } = await pool.query("SELECT id, data FROM subs ORDER BY id DESC LIMIT 25");
  const { rows: c } = await pool.query("SELECT COUNT(*)::int AS c FROM subs");
  res.json({ count: c[0].c, rows });
});


app.post("/subscribe", async (req, res) => {
  const sub = req.body;
  const endpoint = sub?.endpoint;
  if (!endpoint) return res.status(400).json({ ok: false, error: "Missing endpoint" });

  // de-dupe the endpoint (no schema change needed)
  await pool.query("DELETE FROM subs WHERE data->>'endpoint' = $1", [endpoint]);
  await pool.query("INSERT INTO subs (data) VALUES ($1)", [JSON.stringify(sub)]);
  res.json({ ok: true });
});

// 1) check if a subscription exists (by endpoint)
app.get("/subscribe/exists", async (req, res) => {
  const endpoint = req.query.endpoint;
  if (!endpoint) return res.status(400).json({ ok: false, error: "Missing endpoint" });
  const { rows } = await pool.query("SELECT 1 FROM subs WHERE data->>'endpoint' = $1 LIMIT 1", [endpoint]);
  res.json({ ok: true, exists: rows.length > 0 });
});

// 2) remove subscription (by endpoint)
app.delete("/subscribe", async (req, res) => {
  const endpoint = req.body?.endpoint || req.query.endpoint;
  if (!endpoint) return res.status(400).json({ ok: false, error: "Missing endpoint" });
  const r = await pool.query("DELETE FROM subs WHERE data->>'endpoint' = $1", [endpoint]);
  res.json({ ok: true, deleted: r.rowCount });
});

app.post("/admin/broadcast", guard, async (_req, res) => {
  const { rows } = await pool.query("SELECT id, data FROM subs");

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
      payload = `🇪🇸 ${phrase.es}\n🇬🇧 ${phrase.en}`;
    } else if (language === 'french') {
      payload = `🇫🇷 ${phrase.fr}\n🇬🇧 ${phrase.en}`;
    } else if (language === 'japanese') {
      payload = `🇯🇵 ${phrase.ja}\n🇬🇧 ${phrase.en}`;
    } else {
      payload = `🇮🇹 ${phrase.it}\n🇬🇧 ${phrase.en}`;
    }

    try {
      // Create clean subscription object without our custom language field
      const { language: _, ...cleanSub } = sub;
      await webpush.sendNotification(cleanSub, payload);
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
    // Find the subscription by endpoint
    const { rows } = await pool.query("SELECT id, data FROM subs WHERE data->>'endpoint' = $1", [endpoint]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Subscription not found" });
    }

    const row = rows[0];
    const sub = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    const language = sub.language || 'italian';

    // Generate a phrase for this user's language
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

    // Create clean subscription object without our custom language field
    const { language: _, ...cleanSub } = sub;
    await webpush.sendNotification(cleanSub, payload);

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

// Try to use HTTPS in development if certificates exist
if (process.env.NODE_ENV !== 'production') {
  try {
    const options = {
      key: fs.readFileSync('./localhost+2-key.pem'),
      cert: fs.readFileSync('./localhost+2.pem')
    };
    https.createServer(options, app).listen(port, () => {
      console.log(`Server running on https://localhost:${port}`);
    });
  } catch (err) {
    // Fallback to HTTP if certificates don't exist
    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port} (no HTTPS certificates found)`);
    });
  }
} else {
  app.listen(port, () => console.log("Server running"));
}
