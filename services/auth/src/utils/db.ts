import dotenv from "dotenv";
import { Pool } from "pg";
import dns from "node:dns";

dotenv.config();

// Prefer IPv4 first to avoid DNS resolution issues (EAI_AGAIN) in some networks
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // Node < 18 doesn't support this; ignore
}

// Prefer an explicit connection string and fail fast if it's missing
const connectionString =
  process.env.DB_URL ||
  process.env.DATABASE_URL; // allow a common fallback name

if (!connectionString) {
  throw new Error(
    "Database connection string is missing. Set DB_URL or DATABASE_URL in .env"
  );
}

// pg uses TCP, which works for both local Postgres and Neon; ssl off for local, lax for cloud
const pool = new Pool({
  connectionString,
  ssl:
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1")
      ? false
      : { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000, // Increased to 10 seconds
  idleTimeoutMillis: 30000,
  max: 20, // Maximum number of clients in the pool
  keepAlive: true,
});

/**
 * Template-tag helper to mirror neon's sql`` API using pg under the hood.
 * Converts interpolated values into parameterized queries to avoid SQL injection.
 */
export async function sql(
  strings: TemplateStringsArray,
  ...values: any[]
): Promise<any[]> {
  const text = strings.reduce(
    (acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ""),
    ""
  );

  const client = await pool.connect();
  try {
    const result = await client.query(text, values);
    return result.rows;
  } finally {
    client.release();
  }
}