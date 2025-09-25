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


// store subscription
app.post("/subscribe", async (req, res) => {
  await pool.query("INSERT INTO subs (data) VALUES ($1)", [req.body]);
  res.json({ ok: true });
});

// send test
app.get("/admin/broadcast", guard, async (req, res) => {
  const { rows } = await pool.query("SELECT data FROM subs")
  const { it, en } = randomPhraseNoRepeat();
  const payload = `🇮🇹 ${it}\n🇬🇧 ${en}`;
  let sent = 0;
  for (const row of rows) {
    try {
      await webpush.sendNotification(JSON.parse(row.data), payload);
      sent++;
    } catch {}
  }
  res.json({ ok: true, sent, phrase: { it, en } });
});

// serve static site
app.use(express.static("public"));

app.listen(process.env.PORT || 3000, () => console.log("Server running"));
