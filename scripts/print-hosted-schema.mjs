import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const dbPath = path.join(repoRoot, 'functions', '_lib', 'db.ts');

const txt = fs.readFileSync(dbPath, 'utf8');
const m = txt.match(/export const HOSTED_SCHEMA_SQL = `([\s\S]*?)`\s*;\s*$/m);
if (!m) {
  console.error('Could not find HOSTED_SCHEMA_SQL in functions/_lib/db.ts');
  process.exit(1);
}

process.stdout.write(m[1].trim() + '\n');
