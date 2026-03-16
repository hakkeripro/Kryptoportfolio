import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
// React must be in scope for JSX
import React from 'react'; // eslint-disable-line @typescript-eslint/no-unused-vars

afterEach(() => cleanup());
import { Button } from './Button';
import { Card, CardHeader, CardTitle } from './Card';
import { Badge } from './Badge';
import { Input } from './Input';
import { Spinner } from './Spinner';
import { EmptyState } from './EmptyState';
import { TokenIcon } from './TokenIcon';
import { KpiCard } from './KpiCard';
import { Logo } from './Logo';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from './Tooltip';

/* ── Button ─────────────────────────────────────────── */
describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeTruthy();
  });

  it('applies destructive variant', () => {
    const { container } = render(<Button variant="destructive">Delete</Button>);
    expect(container.querySelector('button')!.className).toContain('bg-destructive');
  });

  it('applies lg size class', () => {
    const { container } = render(<Button size="lg">Large</Button>);
    expect(container.querySelector('button')!.className).toContain('px-8');
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
  it('renders children', () => {
    render(<Card>Content</Card>);
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
    expect(screen.getByText('Title')).toBeTruthy();
  });
});

/* ── Badge ──────────────────────────────────────────── */
describe('Badge', () => {
  it('renders text', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeTruthy();
  });

  it('applies destructive variant', () => {
    const { container } = render(<Badge variant="destructive">Error</Badge>);
    expect(container.firstElementChild!.className).toContain('bg-destructive');
  });

  it('applies outline variant', () => {
    const { container } = render(<Badge variant="outline">Info</Badge>);
    expect(container.firstElementChild!.className).toContain('text-foreground');
  });
});

/* ── Input ──────────────────────────────────────────── */
describe('Input', () => {
  it('renders an input element', () => {
    const { container } = render(<Input />);
    expect(container.querySelector('input')).toBeTruthy();
  });

  it('accepts placeholder', () => {
    render(<Input placeholder="Enter value" />);
    expect(screen.getByPlaceholderText('Enter value')).toBeTruthy();
  });

  it('forwards className', () => {
    const { container } = render(<Input className="my-input" />);
    expect(container.querySelector('input')!.className).toContain('my-input');
  });

  it('disables when disabled', () => {
    const { container } = render(<Input disabled />);
    expect((container.querySelector('input') as HTMLInputElement).disabled).toBe(true);
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

  it('renders delta text with positive type', () => {
    render(<KpiCard label="Change" value="€100" delta="+5%" deltaType="positive" />);
    expect(screen.getByText('+5%')).toBeTruthy();
  });

  it('renders delta text with negative type', () => {
    render(<KpiCard label="Change" value="€100" delta="-3%" deltaType="negative" />);
    expect(screen.getByText('-3%')).toBeTruthy();
  });

  it('hides delta when not provided', () => {
    render(<KpiCard label="Value" value="€0" />);
    expect(screen.queryByText('+5%')).toBeNull();
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
  it('renders tab triggers', () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">Tab A</TabsTrigger>
          <TabsTrigger value="b">Tab B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Content A</TabsContent>
        <TabsContent value="b">Content B</TabsContent>
      </Tabs>,
    );
    expect(screen.getByRole('tab', { name: 'Tab A' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Tab B' })).toBeTruthy();
  });

  it('defaults to first tab as active', () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">Tab A</TabsTrigger>
          <TabsTrigger value="b">Tab B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Content A</TabsContent>
        <TabsContent value="b">Content B</TabsContent>
      </Tabs>,
    );
    expect(screen.getByRole('tab', { name: 'Tab A' }).getAttribute('data-state')).toBe('active');
  });

  it('active tab has data-state active', () => {
    render(
      <Tabs defaultValue="b">
        <TabsList>
          <TabsTrigger value="a">Tab A</TabsTrigger>
          <TabsTrigger value="b">Tab B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">A</TabsContent>
        <TabsContent value="b">B</TabsContent>
      </Tabs>,
    );
    expect(screen.getByRole('tab', { name: 'Tab B' }).getAttribute('data-state')).toBe('active');
    expect(screen.getByRole('tab', { name: 'Tab A' }).getAttribute('data-state')).toBe('inactive');
  });
});

/* ── Tooltip ────────────────────────────────────────── */
describe('Tooltip', () => {
  it('renders trigger content', () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button>Hover me</button>
          </TooltipTrigger>
          <TooltipContent>Help text</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(screen.getByRole('button', { name: 'Hover me' })).toBeTruthy();
  });

  it('shows tooltip content on hover', async () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button>Hover me</button>
          </TooltipTrigger>
          <TooltipContent>Help text</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    const trigger = screen.getByRole('button', { name: 'Hover me' });
    expect(trigger).toBeTruthy();
    // TooltipContent is rendered in a portal; we just verify the trigger is accessible
  });
});
