import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { flushPendingTransactions, pendingCount, queueTransaction, isOnline } from './offline';
import type {
  AdminAccount,
  AdminHealth,
  AdminOverview,
  Allocation,
  Asset,
  Category,
  Challenge,
  Debt,
  EmergencyFund,
  Goal,
  NotificationSettings,
  Profile,
  ProtectionItem,
  Simulation,
  Tip,
  TipProgress,
  Transaction,
  UserChallenge,
  Workspace,
} from './types';

const wsKey = (userId: string | undefined) => ['workspace', userId ?? 'anonymous'];

async function loadWorkspace(userId: string): Promise<Workspace> {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 13);

  const [
    profile,
    allocation,
    emergency,
    categories,
    transactions,
    protection,
    assets,
    debts,
    goals,
    simulations,
    tips,
    progress,
    challenges,
    userChallenges,
    notifications,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('allocations').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('emergency_fund').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('categories').select('*').order('name'),
    supabase
      .from('transactions')
      .select('*')
      .gte('occurred_on', twelveMonthsAgo.toISOString().slice(0, 10))
      .order('occurred_on', { ascending: false })
      .limit(3000),
    supabase.from('protection_checklist').select('*').order('item_key'),
    supabase.from('assets').select('*').order('created_at', { ascending: false }),
    supabase.from('debts').select('*').order('created_at', { ascending: false }),
    supabase
      .from('goals')
      .select('*')
      .eq('archived', false)
      .order('created_at', { ascending: false }),
    supabase.from('simulations').select('*').order('created_at', { ascending: false }),
    supabase.from('tips').select('*').eq('published', true).order('category'),
    supabase.from('tip_progress').select('*').eq('user_id', userId),
    supabase.from('challenges').select('*').order('duration_days'),
    supabase.from('user_challenges').select('*').eq('user_id', userId),
    supabase.from('notification_settings').select('*').eq('user_id', userId).maybeSingle(),
  ]);

  for (const result of [
    profile,
    allocation,
    emergency,
    categories,
    transactions,
    protection,
    assets,
    debts,
    goals,
    simulations,
    tips,
    progress,
    challenges,
    userChallenges,
    notifications,
  ]) {
    if (result.error) throw new Error(result.error.message);
  }

  let profileRow = profile.data as Profile | null;
  if (!profileRow) {
    const { data, error } = await supabase
      .from('profiles')
      .insert({ id: userId, first_name: '' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    profileRow = data as Profile;
  }

  return {
    profile: profileRow,
    allocation: (allocation.data as Allocation | null) ?? {
      user_id: userId,
      pct_subsistence: 25,
      pct_assets: 50,
      pct_protection: 25,
      updated_at: new Date().toISOString(),
    },
    emergency: (emergency.data as EmergencyFund | null) ?? {
      user_id: userId,
      amount_saved: 0,
      target_amount: null,
      updated_at: new Date().toISOString(),
    },
    categories: (categories.data ?? []) as Category[],
    transactions: (transactions.data ?? []) as Transaction[],
    protection: (protection.data ?? []) as ProtectionItem[],
    assets: (assets.data ?? []) as Asset[],
    debts: (debts.data ?? []) as Debt[],
    goals: (goals.data ?? []) as Goal[],
    simulations: (simulations.data ?? []) as Simulation[],
    tips: (tips.data ?? []) as Tip[],
    progress: (progress.data ?? []) as TipProgress[],
    challenges: (challenges.data ?? []) as Challenge[],
    userChallenges: (userChallenges.data ?? []) as UserChallenge[],
    notifications: (notifications.data as NotificationSettings | null) ?? {
      user_id: userId,
      daily_reminder: true,
      payday_reminder: true,
      budget_alert: true,
      monthly_summary: true,
      weekly_review: true,
      reminder_hour: 19,
      push_subscription: null,
    },
  };
}

export function useWorkspace(userId: string | undefined) {
  return useQuery({
    queryKey: wsKey(userId),
    enabled: Boolean(userId),
    queryFn: () => loadWorkspace(userId as string),
    staleTime: 20_000,
  });
}

function useInvalidate() {
  const client = useQueryClient();
  return (userId: string | undefined) =>
    client.invalidateQueries({ queryKey: wsKey(userId) });
}

export function useAddTransaction(userId: string | undefined) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      type: Transaction['type'];
      amount: number;
      category_id: string | null;
      note: string | null;
      occurred_on: string;
      recurrence: Transaction['recurrence'];
      income_kind: Transaction['income_kind'];
    }) => {
      if (!userId) throw new Error('Session expirée');
      if (!isOnline()) {
        const queued = queueTransaction({ ...input, user_id: userId });
        return { queued: true, id: queued.id };
      }
      const { error } = await supabase
        .from('transactions')
        .insert({ ...input, user_id: userId });
      if (error) throw new Error(error.message);
      return { queued: false, id: crypto.randomUUID() };
    },
    onSuccess: () => invalidate(userId),
  });
}

export function useUpdateTransaction(userId: string | undefined) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Transaction> }) => {
      const { error } = await supabase.from('transactions').update(patch).eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(userId),
  });
}

export function useDeleteTransaction(userId: string | undefined) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(userId),
  });
}

export function useSaveProfile(userId: string | undefined) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (patch: Partial<Profile>) => {
      if (!userId) throw new Error('Session expirée');
      const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(userId),
  });
}

export function useSaveAllocation(userId: string | undefined) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (pcts: {
      pct_subsistence: number;
      pct_assets: number;
      pct_protection: number;
    }) => {
      if (!userId) throw new Error('Session expirée');
      const { error } = await supabase
        .from('allocations')
        .update({ ...pcts, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(userId),
  });
}

export function useSaveEmergency(userId: string | undefined) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (payload: { amount?: number; target?: number | null }) => {
      if (!userId) throw new Error('Session expirée');
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (payload.amount !== undefined) update.amount_saved = payload.amount;
      if (payload.target !== undefined) update.target_amount = payload.target;
      const { error } = await supabase
        .from('emergency_fund')
        .update(update)
        .eq('user_id', userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(userId),
  });
}

export function useToggleProtection(userId: string | undefined) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ itemKey, done }: { itemKey: string; done: boolean }) => {
      if (!userId) throw new Error('Session expirée');
      const { error } = await supabase
        .from('protection_checklist')
        .upsert({ user_id: userId, item_key: itemKey, done }, { onConflict: 'user_id,item_key' });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(userId),
  });
}

export function useSaveSimulation(userId: string | undefined) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: Omit<Simulation, 'id' | 'user_id' | 'created_at'>) => {
      if (!userId) throw new Error('Session expirée');
      const { error } = await supabase.from('simulations').insert({ ...input, user_id: userId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(userId),
  });
}

export function useDeleteSimulation(userId: string | undefined) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('simulations').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(userId),
  });
}

export function useSaveTipProgress(userId: string | undefined) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({
      tipId,
      read,
      favorite,
    }: {
      tipId: string;
      read?: boolean;
      favorite?: boolean;
    }) => {
      if (!userId) throw new Error('Session expirée');
      const payload: Record<string, unknown> = { user_id: userId, tip_id: tipId };
      if (read !== undefined) payload.read_at = read ? new Date().toISOString() : null;
      if (favorite !== undefined) payload.favorite = favorite;
      const { error } = await supabase
        .from('tip_progress')
        .upsert(payload, { onConflict: 'user_id,tip_id' });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(userId),
  });
}

export function useSaveNotifications(userId: string | undefined) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (patch: Partial<NotificationSettings>) => {
      if (!userId) throw new Error('Session expirée');
      const { error } = await supabase
        .from('notification_settings')
        .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(userId),
  });
}

export function useAddAsset(userId: string | undefined) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: Omit<Asset, 'id' | 'user_id' | 'created_at'>) => {
      if (!userId) throw new Error('Session expirée');
      const { error } = await supabase.from('assets').insert({ ...input, user_id: userId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(userId),
  });
}

export function useSaveDebt(userId: string | undefined) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      title: string;
      direction: Debt['direction'];
      counterparty: string | null;
      balance: number;
      monthly_payment: number;
      interest_rate: number | null;
      due_date: string | null;
    }) => {
      if (!userId) throw new Error('Session expirée');
      const { id, ...payload } = input;
      const { error } = id
        ? await supabase.from('debts').update(payload).eq('id', id)
        : await supabase.from('debts').insert({ ...payload, user_id: userId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(userId),
  });
}

export function useDeleteDebt(userId: string | undefined) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('debts').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(userId),
  });
}

export function useDeleteAsset(userId: string | undefined) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assets').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(userId),
  });
}

export function useStartChallenge(userId: string | undefined) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (challengeId: string) => {
      if (!userId) throw new Error('Session expirée');
      const { error } = await supabase
        .from('user_challenges')
        .insert({ user_id: userId, challenge_id: challengeId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(userId),
  });
}

export function useAddGoal(userId: string | undefined) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      target_amount: number;
      target_date: string | null;
      pocket: Goal['pocket'];
      monthly_contribution: number;
    }) => {
      if (!userId) throw new Error('Session expirée');
      const { error } = await supabase
        .from('goals')
        .insert({ ...input, user_id: userId, current_amount: 0 });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(userId),
  });
}

export function useContributeGoal(userId: string | undefined) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      if (!userId) throw new Error('Session expirée');
      const { data: goal, error: readError } = await supabase
        .from('goals')
        .select('current_amount, name')
        .eq('id', id)
        .single();
      if (readError) throw new Error(readError.message);
      const next = Math.max(0, Number(goal?.current_amount ?? 0) + amount);
      const { error } = await supabase.from('goals').update({ current_amount: next }).eq('id', id);
      if (error) throw new Error(error.message);

      // Le versement devient une vraie sortie d'épargne : on crée une
      // transaction liée à l'objectif pour que l'argent ne soit plus
      // disponible dans l'épargne du mois.
      const { error: txError } = await supabase.from('transactions').insert({
        user_id: userId,
        type: 'expense',
        amount,
        category_id: null,
        goal_id: id,
        occurred_on: new Date().toISOString().slice(0, 10),
        note: `Versement : ${goal?.name ?? 'objectif'}`,
        recurrence: 'none',
        parent_tx_id: null,
        income_kind: null,
      });
      if (txError) throw new Error(txError.message);
    },
    onSuccess: () => invalidate(userId),
  });
}

export function useDeleteGoal(userId: string | undefined) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('goals').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(userId),
  });
}

export function useCompleteChallenge(userId: string | undefined) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase
        .from('user_challenges')
        .update({ completed: done, completed_at: done ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(userId),
  });
}

export function useDeleteChallenge(userId: string | undefined) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_challenges').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(userId),
  });
}

/** Enregistre un abonnement Web Push (un par appareil). */
export function useSavePushSubscription(userId: string | undefined) {
  return useMutation({
    mutationFn: async (subscription: PushSubscriptionJSON) => {
      if (!userId) throw new Error('Session expirée');
      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: userId,
          endpoint: subscription.endpoint,
          subscription,
          user_agent: navigator.userAgent.slice(0, 200),
        },
        { onConflict: 'endpoint' }
      );
      if (error) throw new Error(error.message);
    },
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw new Error(error.message);
    },
  });
}

/** Génère les transactions récurrentes dues, une fois par session. */
export function useRecurringTransactions(userId: string | undefined) {
  const client = useQueryClient();
  const [ran, setRan] = useState(false);
  useEffect(() => {
    if (!userId || ran) return;
    setRan(true);
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('generate_recurring_transactions');
        if (!error && typeof data === 'number' && data > 0) {
          await client.invalidateQueries({ queryKey: wsKey(userId) });
        }
      } catch {
        // La génération est un bonus : une erreur ne doit pas bloquer l'app.
      }
    })();
  }, [userId, ran, client]);
}

export function useOnlineStatus() {
  const [online, setOnline] = useState(isOnline());
  const [pending, setPending] = useState(pendingCount());
  const client = useQueryClient();

  useEffect(() => {
    const update = () => setOnline(isOnline());
    const refreshQueue = () => setPending(pendingCount());
    const flush = async () => {
      const sent = await flushPendingTransactions();
      refreshQueue();
      if (sent > 0) client.invalidateQueries({ queryKey: ['workspace'] });
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    window.addEventListener('libre:queue-change', refreshQueue);
    window.addEventListener('online', flush);
    if (isOnline()) void flush();
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      window.removeEventListener('libre:queue-change', refreshQueue);
      window.removeEventListener('online', flush);
    };
  }, [client]);

  return { online, pending };
}

/* ------------------------------------------------------------ Administrateur */

/** Vue d'ensemble, comptes et contrôle d'intégrité — réservé à l'opérateur. */
export function useAdminPanel(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-panel'],
    enabled,
    staleTime: 15_000,
    queryFn: async () => {
      const [overview, accounts, health] = await Promise.all([
        supabase.rpc('admin_overview'),
        supabase.rpc('admin_accounts', { limit_n: 200 }),
        supabase.rpc('admin_db_health'),
      ]);

      for (const result of [overview, accounts, health]) {
        if (result.error) throw new Error(result.error.message);
      }

      return {
        overview: overview.data as unknown as AdminOverview,
        accounts: (accounts.data ?? []) as AdminAccount[],
        health: health.data as unknown as AdminHealth,
      };
    },
  });
}

/** Active ou coupe le mode maintenance affiché aux utilisateurs. */
export function useSetMaintenance() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ active, message }: { active: boolean; message: string }) => {
      const { error } = await supabase.rpc('admin_set_maintenance', {
        active,
        message,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['admin-panel'] });
      client.invalidateQueries({ queryKey: ['maintenance'] });
    },
  });
}

/** État du mode maintenance, lisible par tout utilisateur connecté. */
export function useMaintenance() {
  return useQuery({
    queryKey: ['maintenance'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('maintenance_active');
      if (error) return false;
      return Boolean(data);
    },
  });
}
