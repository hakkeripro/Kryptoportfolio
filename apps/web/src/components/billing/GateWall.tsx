import type { ReactNode } from 'react';
import type { GatedFeature } from '@kp/core';
import { useFeatureGate } from '../../hooks/useFeatureGate';
import { UpgradeModal, UpgradeTeaser } from './UpgradeModal';

interface GateWallProps {
  feature: GatedFeature;
  /** Shown to free users instead of children */
  preview?: ReactNode;
  children: ReactNode;
}

/**
 * Wraps gated content. Free users see `preview` (or an UpgradeTeaser).
 * Premium users see `children` as normal.
 */
export function GateWall({ feature, preview, children }: GateWallProps) {
  const { allowed, upgradeModalOpen, openUpgrade, closeUpgrade } = useFeatureGate(feature);

  return (
    <>
      {allowed ? (
        children
      ) : (
        <div data-testid={`gate-wall-${feature}`}>
          {preview ?? null}
          <UpgradeTeaser onUpgrade={openUpgrade} />
        </div>
      )}
      <UpgradeModal open={upgradeModalOpen} onClose={closeUpgrade} />
    </>
  );
}
