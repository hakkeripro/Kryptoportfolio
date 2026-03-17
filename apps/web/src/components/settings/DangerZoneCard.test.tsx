import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import React from 'react';
import DangerZoneCard from './DangerZoneCard';

afterEach(() => cleanup());

vi.mock('@kp/platform-web', () => ({
  ensureWebDbOpen: vi.fn().mockResolvedValue(undefined),
  getWebDb: vi.fn().mockReturnValue({
    ledgerEvents: {
      toArray: vi.fn().mockResolvedValue([{ id: '1', type: 'BUY' }, { id: '2', type: 'SELL' }]),
    },
  }),
}));

describe('DangerZoneCard', () => {
  it('renders card with export and delete buttons', () => {
    render(<DangerZoneCard />);
    expect(screen.getByTestId('card-danger-zone')).toBeTruthy();
    expect(screen.getByTestId('btn-export-data')).toBeTruthy();
    expect(screen.getByTestId('btn-delete-account')).toBeTruthy();
  });

  it('delete button shows confirmation dialog', () => {
    render(<DangerZoneCard />);
    fireEvent.click(screen.getByTestId('btn-delete-account'));
    expect(screen.getByTestId('btn-delete-account-confirm')).toBeTruthy();
  });

  it('cancel hides confirmation and restores delete button', () => {
    render(<DangerZoneCard />);
    fireEvent.click(screen.getByTestId('btn-delete-account'));
    expect(screen.getByTestId('btn-delete-account-confirm')).toBeTruthy();
    const cancelBtn = screen.getAllByRole('button').find((b) => b.textContent === 'Cancel');
    fireEvent.click(cancelBtn!);
    expect(screen.queryByTestId('btn-delete-account-confirm')).toBeNull();
    expect(screen.getByTestId('btn-delete-account')).toBeTruthy();
  });

  it('export button calls URL.createObjectURL', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:test');
    const revokeObjectURL = vi.fn();
    // @ts-expect-error stub
    global.URL = { createObjectURL, revokeObjectURL };

    const clickSpy = vi.fn();
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const el = origCreate('a') as HTMLAnchorElement;
        el.click = clickSpy;
        return el;
      }
      return origCreate(tag);
    });

    render(<DangerZoneCard />);
    fireEvent.click(screen.getByTestId('btn-export-data'));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});
