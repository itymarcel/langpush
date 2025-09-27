import { sql, initializeDatabase } from '../../lib/db.js';

export default async function handler(req, res) {
  await initializeDatabase();

  const { endpoint } = req.query;
  if (!endpoint) return res.status(400).json({ ok: false, error: "Missing endpoint" });

  try {
    const result = await sql`SELECT 1 FROM subs WHERE data->>'endpoint' = ${endpoint} LIMIT 1`;
    res.json({ exists: result.length > 0 });
  } catch (error) {
    console.error("Exists check error:", error);
    res.status(500).json({ ok: false, error: "Database error" });
  }
}