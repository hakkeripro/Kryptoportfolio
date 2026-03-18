import { useMemo } from 'react';
import { useDbQuery } from './useDbQuery';
import { ensureWebDbOpen } from '@kp/platform-web';

function useAlerts() {
  return useDbQuery(
    async (db) => {
      await ensureWebDbOpen();
      return db.alerts.toArray();
    },
    [],
    [],
  );
}

export function useAlertBadgeCount(): number {
  const alertsQuery = useAlerts();
  return useMemo(
    () => alertsQuery.data.filter((a) => a.triggeredAtISO && !a.acknowledgedAtISO).length,
    [alertsQuery.data],
  );
}
