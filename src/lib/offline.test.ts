// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { flushPendingTransactions, pendingTransactions } from './offline';
import { useAddTransaction } from './queries';

const { insertMock } = vi.hoisted(() => ({ insertMock: vi.fn() }));

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(() => ({ insert: insertMock })),
  },
}));

let online = false;
let queryClient = new QueryClient();

const setOnline = (value: boolean) => {
  online = value;
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });
  onlineManager.setOnline(value);
  window.dispatchEvent(new Event(value ? 'online' : 'offline'));
};

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: queryClient }, children);

describe('file hors-ligne', () => {
  beforeEach(() => {
    localStorage.clear();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    insertMock.mockReset();
    insertMock.mockResolvedValue({ error: null });
    setOnline(false);
  });

  afterEach(() => {
    localStorage.clear();
    setOnline(true);
  });

  it('met la transaction en file hors-ligne puis l’insère au retour du réseau', async () => {
    const { result } = renderHook(() => useAddTransaction('user-1'), { wrapper });

    const input = {
      type: 'expense' as const,
      amount: 7000,
      category_id: 'cat-1',
      note: 'TEST Offline Sync',
      occurred_on: '2026-11-13',
      recurrence: 'none' as const,
      income_kind: null,
    };

    let mutationResult: { queued: boolean; id: string } | undefined;
    await act(async () => {
      mutationResult = await result.current.mutateAsync(input);
    });

    expect(mutationResult).toMatchObject({ queued: true });
    expect(insertMock).not.toHaveBeenCalled();

    const queued = pendingTransactions();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      user_id: 'user-1',
      amount: 7000,
      category_id: 'cat-1',
      note: 'TEST Offline Sync',
      occurred_on: '2026-11-13',
      type: 'expense',
      recurrence: 'none',
      income_kind: null,
    });
    expect(queued[0].id).toBe(mutationResult?.id);

    setOnline(true);
    const sent = await flushPendingTransactions();

    expect(sent).toBe(1);
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith({
      user_id: 'user-1',
      type: 'expense',
      amount: 7000,
      category_id: 'cat-1',
      note: 'TEST Offline Sync',
      occurred_on: '2026-11-13',
      recurrence: 'none',
      income_kind: null,
    });
    expect(pendingTransactions()).toEqual([]);
  });
});
