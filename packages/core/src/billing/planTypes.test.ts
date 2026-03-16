import { describe, it, expect } from 'vitest';
import { isFeatureAllowed } from './planTypes';

describe('isFeatureAllowed', () => {
  it('free plan cannot export PDF', () => {
    expect(isFeatureAllowed('free', 'tax-export-pdf')).toBe(false);
  });

  it('free plan cannot export CSV', () => {
    expect(isFeatureAllowed('free', 'tax-export-csv')).toBe(false);
  });

  it('free plan cannot view full tax report', () => {
    expect(isFeatureAllowed('free', 'tax-report-view')).toBe(false);
  });

  it('tax plan can export PDF', () => {
    expect(isFeatureAllowed('tax', 'tax-export-pdf')).toBe(true);
  });

  it('tax plan can export CSV', () => {
    expect(isFeatureAllowed('tax', 'tax-export-csv')).toBe(true);
  });

  it('tax plan can view full tax report', () => {
    expect(isFeatureAllowed('tax', 'tax-report-view')).toBe(true);
  });

  it('expired tax plan is treated as free', () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    expect(isFeatureAllowed('tax', 'tax-export-pdf', pastDate)).toBe(false);
  });

  it('non-expired tax plan remains active', () => {
    const futureDate = new Date(Date.now() + 86_400_000).toISOString();
    expect(isFeatureAllowed('tax', 'tax-export-pdf', futureDate)).toBe(true);
  });

  it('tax plan without expiry is always active', () => {
    expect(isFeatureAllowed('tax', 'tax-export-pdf', null)).toBe(true);
  });
});
