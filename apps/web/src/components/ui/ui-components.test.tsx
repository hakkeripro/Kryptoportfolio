import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
// React must be in scope for JSX
import React from 'react'; // eslint-disable-line @typescript-eslint/no-unused-vars

afterEach(() => cleanup());
import { Button } from './Button';
import { Card, CardHeader, CardTitle } from './Card';
import { Badge } from './Badge';
import { Input } from './Input';
import { Select } from './Select';
import { Spinner } from './Spinner';
import { EmptyState } from './EmptyState';
import { TokenIcon } from './TokenIcon';
import { KpiCard } from './KpiCard';
import { Logo } from './Logo';
import { Tabs } from './Tabs';
import { Tooltip } from './Tooltip';

/* ── Button ─────────────────────────────────────────── */
describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeTruthy();
  });

  it('applies variant classes', () => {
    const { container } = render(<Button variant="danger">Delete</Button>);
    expect(container.querySelector('button')!.className).toContain('bg-semantic-error');
  });

  it('applies size classes', () => {
    const { container } = render(<Button size="lg">Large</Button>);
    expect(container.querySelector('button')!.className).toContain('px-6');
  });

  it('disables when loading', () => {
    render(<Button loading>Save</Button>);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows spinner when loading', () => {
    const { container } = render(<Button loading>Save</Button>);
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('disables when disabled prop set', () => {
    render(<Button disabled>Nope</Button>);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('fires onClick', () => {
    const fn = vi.fn();
    render(<Button onClick={fn}>Go</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(fn).toHaveBeenCalledOnce();
  });
});

/* ── Card ───────────────────────────────────────────── */
describe('Card', () => {
  it('renders children with surface-raised', () => {
    const { container } = render(<Card>Content</Card>);
    expect(container.firstElementChild!.className).toContain('bg-gradient-card');
    expect(screen.getByText('Content')).toBeTruthy();
  });

  it('merges custom className', () => {
    const { container } = render(<Card className="my-class">X</Card>);
    expect(container.firstElementChild!.className).toContain('my-class');
  });
});

describe('CardHeader + CardTitle', () => {
  it('renders header and title', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
        </CardHeader>
      </Card>,
    );
    expect(screen.getByText('Title').tagName).toBe('H3');
  });
});

/* ── Badge ──────────────────────────────────────────── */
describe('Badge', () => {
  it('renders text', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeTruthy();
  });

  it('applies success variant', () => {
    const { container } = render(<Badge variant="success">OK</Badge>);
    expect(container.firstElementChild!.className).toContain('text-semantic-success');
  });

  it('applies sm size', () => {
    const { container } = render(<Badge size="sm">S</Badge>);
    expect(container.firstElementChild!.className).toContain('py-0.5');
  });
});

/* ── Input ──────────────────────────────────────────── */
describe('Input', () => {
  it('renders label and links it to input', () => {
    render(<Input label="Email" />);
    const input = screen.getByLabelText('Email');
    expect(input.tagName).toBe('INPUT');
  });

  it('shows error message', () => {
    render(<Input label="Name" error="Required" />);
    expect(screen.getByText('Required')).toBeTruthy();
  });

  it('applies error border', () => {
    const { container } = render(<Input error="Bad" />);
    expect(container.querySelector('input')!.className).toContain('border-semantic-error');
  });

  it('renders icon with left padding', () => {
    render(<Input icon={<span data-testid="icon">@</span>} />);
    expect(screen.getByTestId('icon')).toBeTruthy();
  });
});

/* ── Select ─────────────────────────────────────────── */
describe('Select', () => {
  it('renders label and options', () => {
    render(
      <Select label="Currency">
        <option value="EUR">EUR</option>
        <option value="USD">USD</option>
      </Select>,
    );
    expect(screen.getByLabelText('Currency')).toBeTruthy();
    expect(screen.getByText('EUR')).toBeTruthy();
  });

  it('shows error', () => {
    render(
      <Select error="Pick one">
        <option>X</option>
      </Select>,
    );
    expect(screen.getByText('Pick one')).toBeTruthy();
  });
});

/* ── Spinner ────────────────────────────────────────── */
describe('Spinner', () => {
  it('renders with animate-spin', () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('applies size class', () => {
    const { container } = render(<Spinner size="lg" />);
    expect(container.querySelector('.h-8')).toBeTruthy();
  });
});

/* ── EmptyState ─────────────────────────────────────── */
describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState icon={<span>📦</span>} title="No data" description="Add something" />);
    expect(screen.getByText('No data')).toBeTruthy();
    expect(screen.getByText('Add something')).toBeTruthy();
  });

  it('renders action button and fires callback', () => {
    const fn = vi.fn();
    render(<EmptyState icon={<span>📦</span>} title="Empty" actionLabel="Add" onAction={fn} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(fn).toHaveBeenCalledOnce();
  });

  it('hides button when no actionLabel', () => {
    render(<EmptyState icon={<span>📦</span>} title="Empty" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

/* ── TokenIcon ──────────────────────────────────────── */
describe('TokenIcon', () => {
  it('renders img when iconUrl provided', () => {
    render(<TokenIcon symbol="BTC" iconUrl="https://example.com/btc.png" />);
    const img = screen.getByAltText('BTC') as HTMLImageElement;
    expect(img.src).toContain('btc.png');
    expect(img.getAttribute('loading')).toBe('lazy');
  });

  it('renders letter fallback when no iconUrl', () => {
    render(<TokenIcon symbol="ETH" />);
    expect(screen.getByText('E')).toBeTruthy();
  });

  it('renders letter fallback when iconUrl is null', () => {
    render(<TokenIcon symbol="SOL" iconUrl={null} />);
    expect(screen.getByText('S')).toBeTruthy();
  });

  it('uses correct size px', () => {
    const { container } = render(<TokenIcon symbol="XRP" size="lg" />);
    const span = container.querySelector('span')!;
    expect(span.style.width).toBe('40px');
  });

  it('falls back to letter on img error', () => {
    render(<TokenIcon symbol="DOGE" iconUrl="https://broken.url/x.png" />);
    const img = screen.getByAltText('DOGE');
    fireEvent.error(img);
    expect(screen.getByText('D')).toBeTruthy();
  });

  it('generates deterministic hue from symbol', () => {
    const { container: c1 } = render(<TokenIcon symbol="BTC" />);
    const { container: c2 } = render(<TokenIcon symbol="BTC" />);
    const bg1 = c1.querySelector('span')!.style.backgroundColor;
    const bg2 = c2.querySelector('span')!.style.backgroundColor;
    expect(bg1).toBe(bg2);
  });
});

/* ── KpiCard ────────────────────────────────────────── */
describe('KpiCard', () => {
  it('renders label and value', () => {
    render(<KpiCard label="Total" value="€10,000" />);
    expect(screen.getByText('Total')).toBeTruthy();
    expect(screen.getByText('€10,000')).toBeTruthy();
  });

  it('renders delta with positive styling', () => {
    const { container } = render(
      <KpiCard label="Change" value="€100" delta="+5%" deltaType="positive" />,
    );
    expect(screen.getByText('+5%')).toBeTruthy();
    expect(container.querySelector('.text-semantic-success')).toBeTruthy();
  });

  it('renders delta with negative styling', () => {
    const { container } = render(
      <KpiCard label="Change" value="€100" delta="-3%" deltaType="negative" />,
    );
    expect(container.querySelector('.text-semantic-error')).toBeTruthy();
  });

  it('hides delta when not provided', () => {
    const { container } = render(<KpiCard label="Value" value="€0" />);
    expect(container.querySelector('.text-semantic-success')).toBeNull();
    expect(container.querySelector('.text-semantic-error')).toBeNull();
  });
});

/* ── Logo ───────────────────────────────────────────── */
describe('Logo', () => {
  it('renders SVG and wordmark by default', () => {
    render(<Logo />);
    expect(screen.getByLabelText('VaultFolio')).toBeTruthy(); // svg aria-label
    expect(screen.getByText('VaultFolio')).toBeTruthy();
  });

  it('hides wordmark when showWordmark=false', () => {
    render(<Logo showWordmark={false} />);
    expect(screen.queryByText('VaultFolio')).toBeNull();
  });

  it('applies size', () => {
    const { container } = render(<Logo size="lg" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('48');
  });
});

/* ── Tabs ───────────────────────────────────────────── */
describe('Tabs', () => {
  const tabs = [
    { id: 'a', label: 'Tab A' },
    { id: 'b', label: 'Tab B' },
  ];

  it('renders tab buttons', () => {
    render(<Tabs tabs={tabs}>{(active) => <div>{active}</div>}</Tabs>);
    expect(screen.getByRole('tab', { name: 'Tab A' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Tab B' })).toBeTruthy();
  });

  it('defaults to first tab', () => {
    render(<Tabs tabs={tabs}>{(active) => <div data-testid="panel">{active}</div>}</Tabs>);
    expect(screen.getByTestId('panel').textContent).toBe('a');
  });

  it('switches tab on click (uncontrolled)', () => {
    render(<Tabs tabs={tabs}>{(active) => <div data-testid="panel">{active}</div>}</Tabs>);
    fireEvent.click(screen.getByRole('tab', { name: 'Tab B' }));
    expect(screen.getByTestId('panel').textContent).toBe('b');
  });

  it('calls onChange in controlled mode', () => {
    const fn = vi.fn();
    render(
      <Tabs tabs={tabs} activeTab="a" onChange={fn}>
        {(active) => <div>{active}</div>}
      </Tabs>,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Tab B' }));
    expect(fn).toHaveBeenCalledWith('b');
  });

  it('has correct aria-selected', () => {
    render(
      <Tabs tabs={tabs} activeTab="b">
        {(a) => <div>{a}</div>}
      </Tabs>,
    );
    expect(screen.getByRole('tab', { name: 'Tab B' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Tab A' }).getAttribute('aria-selected')).toBe('false');
  });
});

/* ── Tooltip ────────────────────────────────────────── */
describe('Tooltip', () => {
  it('shows content on mouseEnter (after delay)', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Help text">
        <button>Hover me</button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByText('Hover me').parentElement!);
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(screen.getByRole('tooltip').textContent).toBe('Help text');
    vi.useRealTimers();
  });

  it('hides on mouseLeave', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Tip">
        <button>X</button>
      </Tooltip>,
    );
    const wrapper = screen.getByText('X').parentElement!;
    fireEvent.mouseEnter(wrapper);
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.mouseLeave(wrapper);
    expect(screen.queryByRole('tooltip')).toBeNull();
    vi.useRealTimers();
  });
});
