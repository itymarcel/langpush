import express from "express";
import bodyParser from "body-parser";
import Database from "better-sqlite3";
import webpush from "web-push";

const app = express();
app.use(bodyParser.json());

const db = new Database("data.db");
db.exec(`CREATE TABLE IF NOT EXISTS subs (id INTEGER PRIMARY KEY, data TEXT);`);

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
app.get("/admin/subs", guard, (req, res) => {
  const rows = db.prepare("SELECT id, data FROM subs ORDER BY id DESC").all();
  res.json({ count: rows.length, rows: rows.slice(0, 25) }); // cap output
});


// store subscription
app.post("/subscribe", (req, res) => {
  db.prepare("INSERT INTO subs (data) VALUES (?)").run(JSON.stringify(req.body));
  res.json({ ok: true });
});

// send test
app.get("/admin/broadcast", guard, async (req, res) => {
  const rows = db.prepare("SELECT data FROM subs").all();
  const phrase = "🇮🇹 Buongiorno!\n🇬🇧 Good morning!";
  let sent = 0;
  for (const row of rows) {
    try {
      await webpush.sendNotification(JSON.parse(row.data), phrase);
      sent++;
    } catch {}
  }
  res.json({ ok: true, sent });
});

// serve static site
app.use(express.static("public"));

app.listen(process.env.PORT || 3000, () => console.log("Server running"));
