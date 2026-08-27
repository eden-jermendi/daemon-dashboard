import "server-only";
import { neon } from "@neondatabase/serverless";

/**
 * Neon PostgreSQL serverless SQL client.
 * Uses HTTP transport for lightweight, connectionless queries.
 */
export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL environment variable is not configured. Please check your .env.local or production settings."
    );
  }
  return neon(connectionString);
}

export const isDbConfigured = Boolean(process.env.DATABASE_URL);
