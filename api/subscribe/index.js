import { sql, initializeDatabase } from '../../lib/db.js';

export default async function handler(req, res) {
  await initializeDatabase();

  if (req.method === 'POST') {
    const sub = req.body;
    const endpoint = sub?.endpoint;
    if (!endpoint) return res.status(400).json({ ok: false, error: "Missing endpoint" });

    try {
      await sql`INSERT INTO subs (data) VALUES (${JSON.stringify(sub)})`;
      res.json({ ok: true });
    } catch (error) {
      console.error("Insert error:", error);
      res.status(500).json({ ok: false, error: "Failed to subscribe" });
    }
  } else if (req.method === 'DELETE') {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ ok: false, error: "Missing endpoint" });

    try {
      const result = await sql`DELETE FROM subs WHERE data->>'endpoint' = ${endpoint}`;
      res.json({ ok: true, deleted: result.length });
    } catch (error) {
      console.error("Delete error:", error);
      res.status(500).json({ ok: false, error: "Failed to unsubscribe" });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}