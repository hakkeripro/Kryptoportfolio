import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';

const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);`,
  `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      createdAtISO TEXT NOT NULL
    );`,
  `CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      name TEXT,
      createdAtISO TEXT NOT NULL,
      lastSeenAtISO TEXT NOT NULL,
      FOREIGN KEY(userId) REFERENCES users(id)
    );`,
  `CREATE TABLE IF NOT EXISTS sync_envelopes (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      deviceId TEXT NOT NULL,
      cursor INTEGER NOT NULL UNIQUE,
      createdAtISO TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      kdfSaltBase64 TEXT NOT NULL DEFAULT '',
      kdfIterations INTEGER NOT NULL DEFAULT 0,
      ciphertextBase64 TEXT NOT NULL,
      nonceBase64 TEXT NOT NULL,
      checksum TEXT,
      FOREIGN KEY(userId) REFERENCES users(id)
    );`,
  `CREATE TABLE IF NOT EXISTS web_push_subscriptions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      subscriptionJson TEXT NOT NULL,
      createdAtISO TEXT NOT NULL,
      updatedAtISO TEXT NOT NULL,
      UNIQUE(userId, endpoint)
    );`,
  `CREATE TABLE IF NOT EXISTS expo_push_tokens (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      createdAtISO TEXT NOT NULL
    );`,
  `CREATE TABLE IF NOT EXISTS server_alerts (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      alertJson TEXT NOT NULL,
      isEnabled INTEGER NOT NULL,
      createdAtISO TEXT NOT NULL,
      updatedAtISO TEXT NOT NULL,
      lastTriggeredAtISO TEXT
    );`,
  `CREATE TABLE IF NOT EXISTS alert_mirror_state (
      userId TEXT PRIMARY KEY,
      stateJson TEXT NOT NULL,
      updatedAtISO TEXT NOT NULL
    );`,
  `CREATE TABLE IF NOT EXISTS alert_trigger_logs (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      alertId TEXT NOT NULL,
      triggeredAtISO TEXT NOT NULL,
      source TEXT NOT NULL,
      contextJson TEXT NOT NULL
    );`
];

function nowISO() {
  return new Date().toISOString();
}

export async function initDb(dbFile: string) {
  const SQL = await initSqlJs({});

  const abs = path.isAbsolute(dbFile) ? dbFile : path.join(process.cwd(), dbFile);
  fs.mkdirSync(path.dirname(abs), { recursive: true });

  const fileExists = fs.existsSync(abs);
  const buf = fileExists ? fs.readFileSync(abs) : undefined;
  const db = new SQL.Database(buf);

  for (const m of MIGRATIONS) db.run(m);

  // Lightweight column migrations (sql.js + sqlite): add columns if missing
  const ensureColumn = (table: string, column: string, ddl: string) => {
    const stmt = db.prepare(`PRAGMA table_info(${table});`);
    const cols: string[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as any;
      cols.push(String(row.name));
    }
    stmt.free();
    if (!cols.includes(column)) {
      db.run(`ALTER TABLE ${table} ADD COLUMN ${ddl};`);
    }
  };

  ensureColumn('sync_envelopes', 'version', 'version INTEGER NOT NULL DEFAULT 1');
  ensureColumn('sync_envelopes', 'kdfSaltBase64', "kdfSaltBase64 TEXT NOT NULL DEFAULT ''");
  ensureColumn('sync_envelopes', 'kdfIterations', 'kdfIterations INTEGER NOT NULL DEFAULT 0');

  const persist = async () => {
    const data = db.export();
    fs.writeFileSync(abs, Buffer.from(data));
  };

  // Debounced persist: after each write we schedule a flush
  let persistTimer: NodeJS.Timeout | undefined;
  const schedulePersist = () => {
    if (persistTimer) return;
    persistTimer = setTimeout(async () => {
      persistTimer = undefined;
      await persist();
    }, 250);
  };

  const exec = (sql: string, params?: any[]) => {
    db.run(sql, params);
    schedulePersist();
  };

  const query = <T = any>(sql: string, params?: any[]): T[] => {
    const stmt = db.prepare(sql);
    stmt.bind(params ?? []);
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as any);
    stmt.free();
    return rows;
  };

  const getOne = <T = any>(sql: string, params?: any[]): T | undefined => query<T>(sql, params)[0];

  // Write schema version into meta
  const meta = getOne<{ value: string }>('SELECT value FROM meta WHERE key=?', ['schemaVersion']);
  if (!meta) {
    exec('INSERT INTO meta(key,value) VALUES (?,?)', ['schemaVersion', '1']);
  }

  // Keep DB consistent on exit
  process.on('SIGINT', async () => {
    await persist();
    process.exit(0);
  });

  return { db, exec, query, getOne, persist };
}

export type Db = Awaited<ReturnType<typeof initDb>>;
