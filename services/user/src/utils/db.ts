import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

const connectionString = process.env.DB_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "Database connection string is missing. Set DB_URL or DATABASE_URL in .env"
  );
}

const pool = new Pool({
  connectionString,
  ssl:
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1")
      ? false
      : { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000,
});

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