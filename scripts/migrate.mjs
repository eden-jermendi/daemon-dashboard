#!/usr/bin/env node
import { neon } from "@neondatabase/serverless";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Migration error: DATABASE_URL_UNPOOLED or DATABASE_URL must be set in environment.");
  process.exit(1);
}

const sql = neon(connectionString);
const migrationsDir = resolve(process.cwd(), "db/migrations");

async function runMigrations() {
  console.log("Running database migrations from:", migrationsDir);
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const filePath = join(migrationsDir, file);
    const query = readFileSync(filePath, "utf-8");
    console.log(`Applying migration: ${file}...`);
    await sql(query);
    console.log(`✓ Successfully applied: ${file}`);
  }
  console.log("All migrations completed successfully.");
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
