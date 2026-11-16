import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPendingTransactions, pendingTransactions } from './offline';
import { addTransactionMutationOptions } from './queries';

const { insertMock } = vi.hoisted(() => ({ insertMock: vi.fn() }));

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(() => ({ insert: insertMock })),
  },
}));

const storage = new Map<string, string>();
const navigatorStub = { onLine: false };

beforeEach(() => {
  storage.clear();
  navigatorStub.onLine = false;
  insertMock.mockReset();
  insertMock.mockResolvedValue({ error: null });
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, String(value)),
  });
  vi.stubGlobal('navigator', navigatorStub);
  vi.stubGlobal('window', { dispatchEvent: () => {} });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('file hors-ligne', () => {
  it('met en file hors-ligne, puis flush et insère au retour du réseau', async () => {
    const options = addTransactionMutationOptions('user-1');
    expect(options.networkMode).toBe('always');

    const input = {
      type: 'expense' as const,
      amount: 7000,
      category_id: 'cat-1',
      note: 'TEST Offline Sync',
      occurred_on: '2026-11-13',
      recurrence: 'none' as const,
      income_kind: null,
    };

    const queuedResult = await options.mutationFn(input);

    expect(queuedResult.queued).toBe(true);
    expect(insertMock).not.toHaveBeenCalled();

    const queued = pendingTransactions();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ ...input, user_id: 'user-1' });
    expect(queued[0].id).toBe(queuedResult.id);

    navigatorStub.onLine = true;
    const sent = await flushPendingTransactions();

    expect(sent).toBe(1);
    expect(insertMock).toHaveBeenCalledOnce();
    expect(insertMock).toHaveBeenCalledWith({ ...input, user_id: 'user-1' });
    expect(pendingTransactions()).toEqual([]);
  });
});
