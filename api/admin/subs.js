import { sql, initializeDatabase } from '../../lib/db.js';

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
      const rows = await sql`SELECT id, data FROM subs ORDER BY id DESC LIMIT 25`;
      const countResult = await sql`SELECT COUNT(*)::int AS c FROM subs`;
      res.json({ count: countResult[0].c, rows });
    } catch (error) {
      console.error("Admin subs error:", error);
      res.status(500).json({ ok: false, error: "Database error" });
    }
  });
}