import dotenv from "dotenv";
import { Pool } from "pg";
dotenv.config();
// Prefer an explicit connection string and fail fast if it's missing
const connectionString = process.env.DB_URL ||
    process.env.DATABASE_URL; // allow a common fallback name
if (!connectionString) {
    throw new Error("Database connection string is missing. Set DB_URL or DATABASE_URL in .env");
}
// pg uses TCP, which works for both local Postgres and Neon; ssl off for local, lax for cloud
const pool = new Pool({
    connectionString,
    ssl: connectionString.includes("localhost") ||
        connectionString.includes("127.0.0.1")
        ? false
        : { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
});
/**
 * Template-tag helper to mirror neon's sql`` API using pg under the hood.
 * Converts interpolated values into parameterized queries to avoid SQL injection.
 */
export async function sql(strings, ...values) {
    const text = strings.reduce((acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ""), "");
    const client = await pool.connect();
    try {
        const result = await client.query(text, values);
        return result.rows;
    }
    finally {
        client.release();
    }
}
