#!/usr/bin/env node
/**
 * Lightweight Neon Postgres migration runner.
 *
 * Usage:
 *   node scripts/migrate.mjs status   — show applied / pending migrations
 *   node scripts/migrate.mjs run      — apply pending migrations
 *   node scripts/migrate.mjs create <name> — scaffold a new migration file
 *
 * Requires DATABASE_URL env var (Neon connection string with sslmode=require).
 */

import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';

const MIGRATIONS_DIR = path.join(process.cwd(), 'scripts', 'migrations');

// ── helpers ──────────────────────────────────────────────────────────

function die(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) die('DATABASE_URL env var is required.');
  return neon(url);
}

/** Ensure the tracking table exists. */
async function ensureTrackingTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

/** Return sorted list of migration filenames from disk. */
function listMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

/** Return set of already-applied migration names. */
async function getApplied(sql) {
  const rows = await sql`SELECT name FROM schema_migrations ORDER BY name`;
  return new Set(rows.map((r) => r.name));
}

// ── commands ─────────────────────────────────────────────────────────

async function cmdStatus() {
  const sql = getSql();
  await ensureTrackingTable(sql);

  const files = listMigrationFiles();
  const applied = await getApplied(sql);

  if (files.length === 0) {
    console.log('No migration files found.');
    return;
  }

  console.log('Migration status:\n');
  let pending = 0;
  for (const f of files) {
    const status = applied.has(f) ? '✓ applied' : '… pending';
    if (!applied.has(f)) pending++;
    console.log(`  ${status}  ${f}`);
  }
  console.log(`\n${files.length} total, ${files.length - pending} applied, ${pending} pending.`);
}

async function cmdRun() {
  const sql = getSql();
  await ensureTrackingTable(sql);

  const files = listMigrationFiles();
  const applied = await getApplied(sql);
  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log('All migrations already applied.');
    return;
  }

  console.log(`Applying ${pending.length} pending migration(s)...\n`);

  for (const f of pending) {
    const filePath = path.join(MIGRATIONS_DIR, f);
    const sqlText = fs.readFileSync(filePath, 'utf8').trim();

    if (!sqlText) {
      console.log(`  SKIP  ${f} (empty file)`);
      continue;
    }

    console.log(`  RUN   ${f}`);
    try {
      // Execute the migration SQL
      await sql(sqlText);
      // Record it as applied
      await sql`INSERT INTO schema_migrations (name) VALUES (${f})`;
      console.log(`  OK    ${f}`);
    } catch (err) {
      console.error(`  FAIL  ${f}`);
      console.error(`        ${err.message}`);
      die('Migration failed. Fix the issue and re-run. Already-applied migrations are tracked and will be skipped.');
    }
  }

  console.log('\nAll pending migrations applied successfully.');
}

function cmdCreate(name) {
  if (!name) die('Usage: node scripts/migrate.mjs create <name>');

  // Sanitize name
  const safeName = name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!safeName) die('Invalid migration name.');

  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filename = `${date}-${safeName}.sql`;
  const filePath = path.join(MIGRATIONS_DIR, filename);

  if (fs.existsSync(filePath)) die(`File already exists: ${filename}`);

  fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
  fs.writeFileSync(
    filePath,
    `-- Migration: ${safeName}\n-- Created: ${date}\n-- Idempotent: use IF NOT EXISTS / IF EXISTS patterns.\n\n`,
    'utf8',
  );

  console.log(`Created: scripts/migrations/${filename}`);
}

// ── main ─────────────────────────────────────────────────────────────

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case 'status':
    await cmdStatus();
    break;
  case 'run':
    await cmdRun();
    break;
  case 'create':
    await cmdCreate(args.join('-'));
    break;
  default:
    console.log(`Neon migration runner

Usage:
  node scripts/migrate.mjs status          Show applied / pending migrations
  node scripts/migrate.mjs run             Apply pending migrations
  node scripts/migrate.mjs create <name>   Create new migration file

Requires DATABASE_URL env var.`);
    process.exit(command ? 1 : 0);
}
