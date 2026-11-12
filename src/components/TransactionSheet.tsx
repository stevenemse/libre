import { useEffect, useMemo, useState } from 'react';
import { Trash2, WifiOff } from 'lucide-react';
import { Sheet, FieldError, Alert } from './ui';
import { useAddTransaction, useDeleteTransaction, useUpdateTransaction, useWorkspace } from '../lib/queries';
import { currencyLabel, todayISO } from '../lib/format';
import { isOnline } from '../lib/offline';
import type { IncomeKind, Recurrence, Transaction, TxType } from '../lib/types';

const INCOME_KINDS: Array<{ key: IncomeKind; label: string; hint: string }> = [
  { key: 'fixed', label: 'Fixe', hint: 'salaire, rente' },
  { key: 'variable', label: 'Variable', hint: 'activité, commerce' },
  { key: 'one_off', label: 'Ponctuel', hint: 'vente, aide, prime' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string | undefined;
  currency: string;
  initialType?: TxType;
  editing?: Transaction | null;
}

export function TransactionSheet({
  open,
  onClose,
  userId,
  currency,
  initialType = 'expense',
  editing = null,
}: Props) {
  const { data: workspace } = useWorkspace(userId);
  const addTransaction = useAddTransaction(userId);
  const updateTransaction = useUpdateTransaction(userId);
  const deleteTransaction = useDeleteTransaction(userId);

  const [type, setType] = useState<TxType>(initialType);
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [occurredOn, setOccurredOn] = useState(todayISO());
  const [note, setNote] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('none');
  const [incomeKind, setIncomeKind] = useState<IncomeKind>('fixed');
  const [error, setError] = useState<string | null>(null);
  const [offlineSaved, setOfflineSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setOfflineSaved(false);
    setConfirmDelete(false);
    setShowAllCategories(false);
    if (editing) {
      setType(editing.type);
      setAmount(String(editing.amount));
      setCategoryId(editing.category_id);
      setOccurredOn(editing.occurred_on);
      setNote(editing.note ?? '');
      setRecurrence(editing.recurrence);
      setIncomeKind(editing.income_kind ?? 'fixed');
    } else {
      setType(initialType);
      setAmount('');
      setCategoryId(null);
      setOccurredOn(todayISO());
      setNote('');
      setRecurrence('none');
      setIncomeKind('fixed');
    }
  }, [open, editing, initialType]);

  const categories = useMemo(
    () => (workspace?.categories ?? []).filter((category) => category.type === type),
    [workspace?.categories, type]
  );

  const suggestion = useMemo(
    () => categories.find((category) => category.name === (type === 'expense' ? 'Nourriture' : 'Salaire')),
    [categories, type]
  );

  const activeCategory = categoryId ?? suggestion?.id ?? null;

  // Les catégories les plus utilisées d'abord : on reconnaît au lieu de chercher.
  const rankedCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tx of workspace?.transactions ?? []) {
      if (!tx.category_id) continue;
      counts.set(tx.category_id, (counts.get(tx.category_id) ?? 0) + 1);
    }
    return [...categories].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
  }, [categories, workspace?.transactions]);

  // Six choix visibles au maximum (loi de Hick), le reste à la demande.
  const visibleCategories = useMemo(() => {
    if (showAllCategories) return rankedCategories;
    const top = rankedCategories.slice(0, 6);
    if (activeCategory && !top.some((category) => category.id === activeCategory)) {
      const active = rankedCategories.find((category) => category.id === activeCategory);
      if (active) top.unshift(active);
    }
    return top;
  }, [rankedCategories, showAllCategories, activeCategory]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const parsed = Number.parseFloat(amount.replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Saisis un montant supérieur à zéro.');
      return;
    }
    if (!categoryId && !suggestion) {
      setError('Choisis une catégorie.');
      return;
    }
    try {
      if (editing) {
        await updateTransaction.mutateAsync({
          id: editing.id,
          patch: {
            type,
            amount: parsed,
            category_id: activeCategory,
            occurred_on: occurredOn,
            note: note.trim() || null,
            recurrence,
            income_kind: type === 'income' ? incomeKind : null,
          },
        });
      } else {
        const result = await addTransaction.mutateAsync({
          type,
          amount: parsed,
          category_id: activeCategory,
          occurred_on: occurredOn,
          note: note.trim() || null,
          recurrence,
          income_kind: type === 'income' ? incomeKind : null,
        });
        if (result.queued) setOfflineSaved(true);
      }
      if (isOnline()) onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    }
  };

  const busy = addTransaction.isPending || updateTransaction.isPending;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Modifier la transaction' : 'Ajouter une transaction'}
      subtitle="Chaque franc noté rend ton épargne réelle."
    >
      {offlineSaved ? (
        <div className="mb-4">
          <Alert tone="info" title="Enregistrée hors-ligne">
            Ta transaction partira dès que la connexion revient. Tu peux continuer à saisir.
          </Alert>
        </div>
      ) : null}

      <form onSubmit={submit} className="space-y-5">
        <div className="grid grid-cols-2 gap-2 rounded-full bg-slate2 p-1">
          {(['expense', 'income'] as TxType[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setType(option);
                setCategoryId(null);
              }}
              aria-pressed={type === option}
              className={
                type === option
                  ? 'h-11 rounded-full bg-accent text-[15px] font-semibold text-ink'
                  : 'h-11 rounded-full text-[15px] font-medium text-mist transition-colors hover:text-snow'
              }
            >
              {option === 'expense' ? 'Dépense' : 'Revenu'}
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="tx-amount" className="field-label">
            Montant
          </label>
          <div className="relative">
            <input
              id="tx-amount"
              inputMode="decimal"
              autoComplete="off"
              enterKeyHint="done"
              data-autofocus="true"
              aria-invalid={Boolean(error)}
              aria-describedby="tx-amount-unit tx-error"
              className="field h-16 pr-24 text-[28px] font-semibold"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0"
            />
            <span
              id="tx-amount-unit"
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-mist"
            >
              {currencyLabel(currency)}
            </span>
          </div>
        </div>

        <div>
          <span className="field-label">Catégorie</span>
          <div className="flex flex-wrap gap-2">
            {visibleCategories.map((category) => {
              const active = activeCategory === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  className="pill"
                  aria-pressed={active}
                  onClick={() => setCategoryId(category.id)}
                >
                  {category.name}
                  {category.kind ? (
                    <span className={active ? 'text-ink/75' : 'text-mist'}>
                      · {category.kind === 'need' ? 'besoin' : 'envie'}
                    </span>
                  ) : null}
                </button>
              );
            })}
            {rankedCategories.length > 6 ? (
              <button
                type="button"
                className="pill"
                aria-expanded={showAllCategories}
                onClick={() => setShowAllCategories((value) => !value)}
              >
                {showAllCategories ? 'Moins de catégories' : `Toutes (${rankedCategories.length})`}
              </button>
            ) : null}
          </div>
        </div>

        {type === 'income' ? (
          <div>
            <span className="field-label">Type de revenu</span>
            <div className="flex flex-wrap gap-2">
              {INCOME_KINDS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className="pill"
                  aria-pressed={incomeKind === option.key}
                  onClick={() => setIncomeKind(option.key)}
                >
                  {option.label}
                  <span className={incomeKind === option.key ? 'text-ink/75' : 'text-mist'}>
                    · {option.hint}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-mist">
              Libre calcule ta base de calcul sur la médiane de tes revenus variables, jamais sur
              ton meilleur mois.
            </p>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="tx-date" className="field-label">
              Date
            </label>
            <input
              id="tx-date"
              type="date"
              className="field"
              value={occurredOn}
              max={todayISO()}
              onChange={(event) => setOccurredOn(event.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="tx-recurrence" className="field-label">
              Récurrence
            </label>
            <select
              id="tx-recurrence"
              className="field appearance-none"
              value={recurrence}
              onChange={(event) => setRecurrence(event.target.value as Recurrence)}
            >
              <option value="none">Aucune</option>
              <option value="weekly">Chaque semaine</option>
              <option value="monthly">Chaque mois</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="tx-note" className="field-label">
            Note <span className="font-normal text-mist">(facultatif)</span>
          </label>
          <input
            id="tx-note"
            className="field"
            value={note}
            maxLength={120}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ex. marché du samedi"
          />
        </div>

        <FieldError id="tx-error">{error ? error : null}</FieldError>

        {!isOnline() ? (
          <p className="flex items-center gap-2 text-[13px] text-mist">
            <WifiOff size={14} strokeWidth={1.75} /> Hors-ligne : la saisie sera synchronisée
            automatiquement.
          </p>
        ) : null}

        <div className="flex gap-2">
          <button
            type="submit"
            className="btn btn-primary flex-1"
            disabled={busy || amount.trim().length === 0}
          >
            {busy ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Ajouter la transaction'}
          </button>
          {editing ? (
            <button
              type="button"
              className="btn btn-secondary text-coral-text"
              onClick={async () => {
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  return;
                }
                await deleteTransaction.mutateAsync(editing);
                onClose();
              }}
              aria-label="Supprimer la transaction"
            >
              <Trash2 size={16} strokeWidth={1.75} />
              {confirmDelete ? 'Confirmer' : null}
            </button>
          ) : null}
        </div>
      </form>
    </Sheet>
  );
}
