export type Plan = 'free' | 'tax';

export interface PlanInfo {
  plan: Plan;
  planExpiresAt: string | null; // ISO 8601, null = no expiry
}

export type GatedFeature =
  | 'tax-report-view'
  | 'tax-export-pdf'
  | 'tax-export-csv'
  | 'hmo-calculator'
  | 'omavero-guide';

/**
 * Pure function — determines whether a given plan allows a feature.
 * Expiry logic: if planExpiresAt is in the past, treat as 'free'.
 */
export function isFeatureAllowed(
  plan: Plan,
  feature: GatedFeature,
  planExpiresAt?: string | null,
): boolean {
  const effectivePlan = resolveEffectivePlan(plan, planExpiresAt);
  switch (feature) {
    case 'tax-report-view':
      // Free users see a preview summary; premium sees full detail
      return effectivePlan === 'tax';
    case 'tax-export-pdf':
    case 'tax-export-csv':
    case 'hmo-calculator':
    case 'omavero-guide':
      return effectivePlan === 'tax';
    default:
      return false;
  }
}

function resolveEffectivePlan(plan: Plan, planExpiresAt?: string | null): Plan {
  if (plan === 'free') return 'free';
  if (!planExpiresAt) return plan;
  const expiresAt = new Date(planExpiresAt).getTime();
  if (Number.isNaN(expiresAt)) return 'free';
  return Date.now() < expiresAt ? plan : 'free';
}
