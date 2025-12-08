import { neon, neonConfig } from '@neondatabase/serverless';
import dotenv from "dotenv";
dotenv.config();
// Prefer an explicit connection string and fail fast if it's missing
const connectionString = process.env.DB_URL ||
    process.env.DATABASE_URL; // allow a common fallback name
if (!connectionString) {
    throw new Error("Database connection string is missing. Set DB_URL or DATABASE_URL in .env");
}
// Keep the driver from hanging indefinitely when the network is unreachable.
// Values are intentionally modest to surface misconfiguration early.
neonConfig.fetchTimeout = Number(process.env.DB_FETCH_TIMEOUT_MS ?? 10000);
neonConfig.poolQueryTimeout = Number(process.env.DB_QUERY_TIMEOUT_MS ?? 10000);
export const sql = neon(connectionString);
