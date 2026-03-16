import { useCallback, useState } from 'react';
import { isFeatureAllowed, type GatedFeature } from '@kp/core';
import { useAuthStore } from '../store/useAuthStore';

export type GateReason = 'ok' | 'plan' | 'offline';

export interface FeatureGateResult {
  allowed: boolean;
  reason: GateReason;
  upgradeModalOpen: boolean;
  openUpgrade: () => void;
  closeUpgrade: () => void;
}

/**
 * Returns whether a gated feature is allowed for the current user.
 * If not allowed, openUpgrade() triggers the UpgradeModal.
 */
export function useFeatureGate(feature: GatedFeature): FeatureGateResult {
  const plan = useAuthStore((s) => s.plan);
  const planExpiresAt = useAuthStore((s) => s.planExpiresAt);
  const token = useAuthStore((s) => s.token);

  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  // Offline-only users (no token) are always free
  const offline = !token;
  const allowed = !offline && isFeatureAllowed(plan, feature, planExpiresAt);

  const reason: GateReason = offline ? 'offline' : allowed ? 'ok' : 'plan';

  const openUpgrade = useCallback(() => setUpgradeModalOpen(true), []);
  const closeUpgrade = useCallback(() => setUpgradeModalOpen(false), []);

  return { allowed, reason, upgradeModalOpen, openUpgrade, closeUpgrade };
}
