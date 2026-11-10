import { supabase } from './supabase';
import { todayISO } from './format';
import type { Recurrence, TxType } from './types';

export interface PendingTransaction {
  id: string;
  user_id: string;
  type: TxType;
  amount: number;
  category_id: string | null;
  note: string | null;
  occurred_on: string;
  recurrence: Recurrence;
}

const KEY = 'libre:pending-transactions';

const read = (): PendingTransaction[] => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingTransaction[]) : [];
  } catch {
    return [];
  }
};

const write = (items: PendingTransaction[]) => {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('libre:queue-change'));
};

export const pendingTransactions = (): PendingTransaction[] => read();

export const pendingCount = (): number => read().length;

export function queueTransaction(
  tx: Omit<PendingTransaction, 'id' | 'occurred_on'> & { occurred_on?: string }
): PendingTransaction {
  const queued: PendingTransaction = {
    ...tx,
    id: crypto.randomUUID(),
    occurred_on: tx.occurred_on ?? todayISO(),
  };
  write([...read(), queued]);
  return queued;
}

/** Envoie les transactions en attente dès que le réseau revient. */
export async function flushPendingTransactions(): Promise<number> {
  const items = read();
  if (items.length === 0) return 0;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 0;

  const sent: string[] = [];
  for (const item of items) {
    const { error } = await supabase.from('transactions').insert({
      user_id: item.user_id,
      type: item.type,
      amount: item.amount,
      category_id: item.category_id,
      note: item.note,
      occurred_on: item.occurred_on,
      recurrence: item.recurrence,
    });
    if (error) break;
    sent.push(item.id);
  }
  if (sent.length > 0) {
    write(read().filter((item) => !sent.includes(item.id)));
  }
  return sent.length;
}

export const isOnline = (): boolean =>
  typeof navigator === 'undefined' ? true : navigator.onLine;
