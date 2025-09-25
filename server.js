import express from "express";
import bodyParser from "body-parser";
import pkg from 'pg'
import webpush from "web-push";
import { randomPhraseNoRepeat } from "./phrases.js";

const { Pool } = pkg

const app = express();
app.use(bodyParser.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }})
await pool.query(`CREATE TABLE IF NOT EXISTS subs (
  id BIGSERIAL PRIMARY KEY,
  data JSONB NOT NULL
)`)

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CONTACT_EMAIL } = process.env;
webpush.setVapidDetails(`mailto:${CONTACT_EMAIL}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

app.get("/vapidPublicKey", (req, res) => {
  res.send(VAPID_PUBLIC_KEY);
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
  const { it, en } = randomPhraseNoRepeat();
  const payload = `🇮🇹 ${it}\n🇬🇧 ${en}`;

  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    const sub = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    try {
      await webpush.sendNotification(sub, payload);
      sent++;
    } catch (e) {
      failed++;
      console.error("Push failed:", e.statusCode, e.body?.toString() || e.message);
      if (e.statusCode === 410 || e.statusCode === 404) {
        await pool.query("DELETE FROM subs WHERE id = $1", [row.id]);
      }
    }
  }
  res.json({ ok: true, sent, failed, phrase: { it, en } });
});


// serve static site
app.use(express.static("public"));

app.listen(process.env.PORT || 3000, () => console.log("Server running"));
