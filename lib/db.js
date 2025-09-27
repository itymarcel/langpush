import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Missing DATABASE_URL');

export const sql = neon(url);

// Initialize the database table
export async function initializeDatabase() {
  await sql`
    CREATE TABLE IF NOT EXISTS subs (
      id BIGSERIAL PRIMARY KEY,
      data JSONB NOT NULL
    )
  `;
}