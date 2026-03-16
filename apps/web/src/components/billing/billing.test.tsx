import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { UpgradeModal, UpgradeTeaser } from './UpgradeModal';

afterEach(() => cleanup());

type MockAuthState = { plan: string; planExpiresAt: string | null; token: string };

// Shared mock state — mutated per test for GateWall
const authState: MockAuthState = { plan: 'free', planExpiresAt: null, token: 'tok' };

vi.mock('../../store/useAuthStore', () => ({
  useAuthStore: (selector: (s: MockAuthState) => unknown) => selector(authState),
}));

/* ── UpgradeModal ─────────────────────────────────── */
describe('UpgradeModal', () => {
  it('renders when open=true', () => {
    render(<UpgradeModal open={true} onClose={() => {}} />);
    expect(screen.getByTestId('upgrade-modal')).toBeTruthy();
  });

  it('does not render when open=false', () => {
    render(<UpgradeModal open={false} onClose={() => {}} />);
    expect(screen.queryByTestId('upgrade-modal')).toBeNull();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<UpgradeModal open={true} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('upgrade-modal-close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when dismiss button clicked', () => {
    const onClose = vi.fn();
    render(<UpgradeModal open={true} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('upgrade-modal-dismiss'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

/* ── UpgradeTeaser ────────────────────────────────── */
describe('UpgradeTeaser', () => {
  it('calls onUpgrade when button clicked', () => {
    const onUpgrade = vi.fn();
    render(<UpgradeTeaser onUpgrade={onUpgrade} />);
    fireEvent.click(screen.getByTestId('upgrade-teaser-btn'));
    expect(onUpgrade).toHaveBeenCalledOnce();
  });
});

/* ── GateWall ─────────────────────────────────────── */
describe('GateWall', () => {
  // GateWall is imported lazily so we can control authState before import
  it('shows gate wall (not children) for free user', async () => {
    authState.plan = 'free';
    authState.token = 'tok';
    const { GateWall } = await import('./GateWall');
    render(
      <GateWall feature="tax-export-pdf">
        <div data-testid="premium-content">Full report</div>
      </GateWall>,
    );
    expect(screen.queryByTestId('premium-content')).toBeNull();
    expect(screen.getByTestId('gate-wall-tax-export-pdf')).toBeTruthy();
  });

  it('shows preview inside gate wall when provided for free user', async () => {
    authState.plan = 'free';
    authState.token = 'tok';
    const { GateWall } = await import('./GateWall');
    render(
      <GateWall feature="tax-export-pdf" preview={<div data-testid="preview">Preview</div>}>
        <div data-testid="full">Full</div>
      </GateWall>,
    );
    expect(screen.getByTestId('preview')).toBeTruthy();
    expect(screen.queryByTestId('full')).toBeNull();
  });

  it('shows children for tax plan user', async () => {
    authState.plan = 'tax';
    authState.token = 'tok';
    const { GateWall } = await import('./GateWall');
    render(
      <GateWall feature="tax-export-pdf">
        <div data-testid="premium-content">Full report</div>
      </GateWall>,
    );
    expect(screen.getByTestId('premium-content')).toBeTruthy();
    expect(screen.queryByTestId('gate-wall-tax-export-pdf')).toBeNull();
  });
});
