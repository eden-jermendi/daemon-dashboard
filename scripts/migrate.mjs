#!/usr/bin/env node
import { neon } from "@neondatabase/serverless";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

// Load .env.local / .env if process.env values are not already in environment
function loadEnv() {
  const envFiles = [".env.local", ".env"];
  for (const file of envFiles) {
    const fullPath = resolve(process.cwd(), file);
    if (existsSync(fullPath)) {
      const content = readFileSync(fullPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Migration error: DATABASE_URL_UNPOOLED or DATABASE_URL must be set in environment or .env.local.");
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
    const content = readFileSync(filePath, "utf-8");
    console.log(`Applying migration: ${file}...`);

    // Split SQL by semicolon while removing comment-only lines
    const statements = content
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      await sql.query(stmt);
    }
    console.log(`✓ Successfully applied: ${file}`);
  }
  console.log("All migrations completed successfully.");
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
