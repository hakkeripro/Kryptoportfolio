import type { FastifyInstance } from 'fastify';
import { evaluateAndTriggerServerAlerts } from '../services/serverAlerts.js';

export function startAlertRunner(app: FastifyInstance) {
  const interval = app.config.alertRunnerIntervalSec;
  if (interval <= 0) return;

  const tick = async () => {
    // For each user with enabled alerts and mirror state
    const users = app.db.query<any>(
      'SELECT DISTINCT userId FROM server_alerts WHERE isEnabled=1'
    );

    for (const u of users) {
      const userId = u.userId as string;
      await evaluateAndTriggerServerAlerts(app, userId);
    }
  };

  const timer = setInterval(() => {
    tick().catch((err) => app.log.error({ err }, 'alert runner tick failed'));
  }, interval * 1000);

  // do first tick soon
  setTimeout(() => tick().catch(() => {}), 1_000);

  app.addHook('onClose', async () => {
    clearInterval(timer);
  });
}
