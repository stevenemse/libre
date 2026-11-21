import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveDebtMutationOptions } from './queries';
import type { Debt } from './types';

const { fromMock, selectMock, selectEqMock, updateMock, updateEqMock, insertMock } = vi.hoisted(
  () => {
    const selectEqMock = vi.fn();
    const selectMock = vi.fn(() => ({ eq: selectEqMock }));
    const updateEqMock = vi.fn();
    const updateMock = vi.fn(() => ({ eq: updateEqMock }));
    const insertMock = vi.fn();
    const fromMock = vi.fn(() => ({
      select: selectMock,
      update: updateMock,
      insert: insertMock,
    }));
    return { fromMock, selectMock, selectEqMock, updateMock, updateEqMock, insertMock };
  }
);

vi.mock('./supabase', () => ({
  supabase: { from: fromMock },
}));

const existing: Debt = {
  id: 'debt-1',
  user_id: 'user-1',
  title: 'Crédit moto',
  direction: 'owed_by_me',
  counterparty: 'Banque X',
  balance: 100_000,
  monthly_payment: 10_000,
  interest_rate: 10,
  due_date: '2027-06-01',
  created_at: '',
};

describe('useSaveDebt', () => {
  beforeEach(() => {
    fromMock.mockClear();
    selectMock.mockClear();
    selectEqMock.mockReset();
    updateMock.mockClear();
    updateEqMock.mockReset();
    insertMock.mockReset();

    selectEqMock
      .mockImplementationOnce(() => ({ eq: selectEqMock }))
      .mockResolvedValueOnce({ data: [existing], error: null });
    updateEqMock.mockResolvedValue({ error: null });
    insertMock.mockResolvedValue({ error: null });
  });

  it('met à jour la dette du prêteur existant au lieu d’en insérer une seconde', async () => {
    const result = await saveDebtMutationOptions('user-1').mutationFn({
      title: 'Crédit auto',
      direction: 'owed_by_me',
      counterparty: '  banque   x ',
      balance: 50_000,
      monthly_payment: 5_000,
      interest_rate: 0,
      due_date: null,
    });

    expect(result).toEqual({ merged: true, id: 'debt-1' });
    expect(insertMock).not.toHaveBeenCalled();
    expect(fromMock).toHaveBeenNthCalledWith(1, 'debts');
    expect(fromMock).toHaveBeenNthCalledWith(2, 'debts');
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(selectMock).toHaveBeenCalledWith('*');
    expect(selectEqMock).toHaveBeenNthCalledWith(1, 'user_id', 'user-1');
    expect(selectEqMock).toHaveBeenNthCalledWith(2, 'direction', 'owed_by_me');
    expect(updateMock).toHaveBeenCalledWith({
      balance: 150_000,
      monthly_payment: 15_000,
      interest_rate: 6.67,
      due_date: '2027-06-01',
    });
    expect(updateEqMock).toHaveBeenCalledWith('id', 'debt-1');
  });
});
