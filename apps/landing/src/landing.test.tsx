import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LangProvider } from './i18n/LangContext';

// Mock framer-motion: replace all motion.* with plain divs/sections/etc.
vi.mock('framer-motion', async () => {
  const React = await import('react');
  const createEl =
    (tag: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({
      children,
      initial: _i,
      animate: _a,
      whileInView: _w,
      viewport: _vp,
      transition: _t,
      ...rest
    }: any) =>
      React.createElement(tag, rest, children);
  return {
    motion: new Proxy(
      {},
      {
        get: (_: unknown, prop: string) =>
          createEl(prop === 'path' || prop === 'rect' ? prop : 'div'),
      },
    ),
    useAnimation: () => ({ start: vi.fn() }),
    useMotionValue: (v: number) => ({ get: () => v, set: vi.fn() }),
    useTransform: () => ({ get: () => 0 }),
    animate: vi.fn(() => ({ stop: vi.fn() })),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  };
});

import LandingPage from './pages/LandingPage';
import PricingSection from './components/PricingSection';
import DashboardMockup from './components/DashboardMockup';
import BlogArticleFi from './pages/BlogArticleFi';

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <LangProvider>
      <MemoryRouter>{children}</MemoryRouter>
    </LangProvider>
  );
}

describe('LandingPage', () => {
  it('renders without errors', () => {
    const { container } = render(<LandingPage />, { wrapper: Wrapper });
    expect(container).toBeTruthy();
  });

  it('contains hero headline about privacy', () => {
    render(<LandingPage />, { wrapper: Wrapper });
    const allText = document.body.textContent ?? '';
    expect(allText.toLowerCase()).toContain('data');
  });
});

describe('PricingSection', () => {
  it('renders Free and Pro pricing options', () => {
    render(<PricingSection />, { wrapper: Wrapper });
    expect(screen.getByText('€4,99')).toBeTruthy();
    expect(screen.getByText('€0')).toBeTruthy();
  });

  it('shows comparison table features', () => {
    render(<PricingSection />, { wrapper: Wrapper });
    expect(screen.getAllByText('Portfolio tracking').length).toBeGreaterThan(0);
    expect(screen.getAllByText('HMO tax optimization').length).toBeGreaterThan(0);
  });
});

describe('DashboardMockup', () => {
  it('renders without errors', () => {
    const { container } = render(<DashboardMockup />);
    expect(container).toBeTruthy();
  });

  it('shows all three mock assets', () => {
    render(<DashboardMockup />);
    expect(screen.getByText('BTC')).toBeTruthy();
    expect(screen.getByText('ETH')).toBeTruthy();
    expect(screen.getByText('SOL')).toBeTruthy();
  });
});

describe('BlogArticleFi', () => {
  it('renders without errors', () => {
    const { container } = render(<BlogArticleFi />, { wrapper: Wrapper });
    expect(container).toBeTruthy();
  });

  it('contains main article heading', () => {
    render(<BlogArticleFi />, { wrapper: Wrapper });
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent?.toLowerCase()).toContain('verotus');
  });

  it('contains HMO section heading', () => {
    render(<BlogArticleFi />, { wrapper: Wrapper });
    const allText = document.body.textContent ?? '';
    expect(allText).toContain('Hankintameno-olettama');
  });

  it('contains OmaVero reference', () => {
    render(<BlogArticleFi />, { wrapper: Wrapper });
    const allText = document.body.textContent ?? '';
    expect(allText).toContain('OmaVero');
  });
});
