import 'fastify';
import type { Database } from 'sql.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: {
      db: Database;
      exec: (sql: string, params?: any[]) => void;
      query: <T = any>(sql: string, params?: any[]) => T[];
      getOne: <T = any>(sql: string, params?: any[]) => T | undefined;
      persist: () => Promise<void>;
    };
    config: {
      JWT_SECRET: string;
      DB_FILE: string;
      CORS_ORIGIN: string;
      COINGECKO_BASE_URL?: string;
      COINGECKO_DEMO_API_KEY?: string;
      VAPID_PUBLIC_KEY?: string;
      VAPID_PRIVATE_KEY?: string;
      VAPID_SUBJECT?: string;
      ALERT_RUNNER_INTERVAL_SEC: string;
      TEST_MODE?: string;
      port: number;
      host: string;
      alertRunnerIntervalSec: number;
    };
  }
}
