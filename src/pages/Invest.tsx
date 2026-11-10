import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Banknote,
  Check,
  Landmark,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import {
  useAddAsset,
  useDeleteAsset,
  useSaveAllocation,
  useSaveEmergency,
  useToggleProtection,
  useWorkspace,
} from '../lib/queries';
import {
  FieldError,
  IconCircle,
  ProgressBar,
  SectionTitle,
  Sheet,
  cn,
} from '../components/ui';
import { currencyLabel, formatAmount, formatPercent, todayISO } from '../lib/format';
import {
  currentMonthKey,
  emergencyTarget,
  monthlySummaries,
  monthsToEmergencyFund,
  num,
  pocketAmounts,
  savings,
} from '../lib/calc';

const PRESETS = [
  { key: 'prudent', label: 'Prudent', values: [30, 20, 50] },
  { key: 'equilibre', label: 'Équilibré', values: [25, 50, 25] },
  { key: 'ambitieux', label: 'Ambitieux', values: [15, 70, 15] },
] as const;

const PROTECTION_ITEMS = [
  { key: 'health_insurance', label: 'Assurance santé', hint: 'Une couverture, même minimale' },
  { key: 'activity_insurance', label: 'Assurance activité', hint: 'Ton outil de travail est protégé' },
  { key: 'documents', label: 'Documents importants copiés', hint: 'Une copie chez un proche ou en ligne' },
  { key: 'income_sources', label: 'Plusieurs sources de revenus', hint: 'Pas de point unique de rupture' },
  { key: 'trusted_contact', label: "Accès d'urgence pour un proche", hint: "Quelqu'un sait où chercher" },
];

const ASSET_TYPES = ['Commerce', 'Immobilier', 'Placement', 'Compétence / outil', 'Autre'];

export default function Invest() {
  const { userId } = useAuth();
  const { data } = useWorkspace(userId);
  const saveAllocation = useSaveAllocation(userId);
  const saveEmergency = useSaveEmergency(userId);
  const toggleProtection = useToggleProtection(userId);
  const addAsset = useAddAsset(userId);
  const deleteAsset = useDeleteAsset(userId);

  const [subsistence, setSubsistence] = useState(25);
  const [assets, setAssets] = useState(50);
  const [allocationSaved, setAllocationSaved] = useState(false);

  const [emergencyInput, setEmergencyInput] = useState('');
  const [emergencySaved, setEmergencySaved] = useState(false);

  const [assetOpen, setAssetOpen] = useState(false);
  const [assetName, setAssetName] = useState('');
  const [assetType, setAssetType] = useState(ASSET_TYPES[0]);
  const [assetValue, setAssetValue] = useState('');
  const [assetIncome, setAssetIncome] = useState('');
  const [assetError, setAssetError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setSubsistence(num(data.allocation.pct_subsistence));
    setAssets(num(data.allocation.pct_assets));
    setEmergencyInput(String(num(data.emergency.amount_saved)));
  }, [data]);

  const derived = useMemo(() => {
    if (!data) return null;
    const kinds = new Map<string, 'need' | 'want' | null>(
      data.categories.map((category) => [category.id, category.kind])
    );
    const summaries = monthlySummaries(
      data.transactions,
      kinds,
      { income: num(data.profile.avg_income), needs: num(data.profile.avg_needs) },
      12
    );
    const current = summaries.find((item) => item.month === currentMonthKey());
    const income = current?.income ?? 0;
    const needs = current?.needs ?? 0;
    const monthlySavings = savings(income, needs);
    const planningNeeds = needs > 0 ? needs : num(data.profile.avg_needs);
    const target = emergencyTarget(planningNeeds, data.profile.emergency_months);
    const assetsValue = data.assets.reduce((sum, asset) => sum + num(asset.value), 0);
    const passive = data.assets.reduce((sum, asset) => sum + num(asset.monthly_income), 0);
    return { monthlySavings, planningNeeds, target, assetsValue, passive };
  }, [data]);

  if (!data || !derived) return null;

  const currency = data.profile.currency;
  const protection = Math.max(0, 100 - subsistence - assets);
  const rounded = { s: Math.round(subsistence), a: Math.round(assets), p: Math.round(protection) };
  const amounts = pocketAmounts(derived.monthlySavings, {
    ...data.allocation,
    pct_subsistence: subsistence,
    pct_assets: assets,
    pct_protection: protection,
  });
  const dirty =
    rounded.s !== Math.round(num(data.allocation.pct_subsistence)) ||
    rounded.a !== Math.round(num(data.allocation.pct_assets));
  const emergencyAmount = num(emergencyInput);
  const monthsLeft = monthsToEmergencyFund(derived.target, emergencyAmount, amounts.protection);
  const emergencyProgress = derived.target > 0 ? emergencyAmount / derived.target : 0;
  const coverage = derived.planningNeeds > 0 ? derived.passive / derived.planningNeeds : 0;
  const hasAssets = derived.assetsValue > 0;

  const applyPreset = (values: readonly [number, number, number]) => {
    setSubsistence(values[0]);
    setAssets(values[1]);
    setAllocationSaved(false);
  };

  const saveAllocationNow = async () => {
    await saveAllocation.mutateAsync({
      pct_subsistence: rounded.s,
      pct_assets: rounded.a,
      pct_protection: rounded.p,
    });
    setAllocationSaved(true);
  };

  return (
    <div className="fade-up space-y-6">
      <header>
        <p className="label">Investir</p>
        <h1 className="mt-1 text-[30px] leading-tight sm:text-[38px]">Fais travailler ton épargne</h1>
        <p className="mt-2 max-w-[60ch] text-[14px] text-mist">
          Trois poches, une seule règle : ton épargne du mois se répartit à 100 %. Ajuste les
          curseurs, Libre calcule les montants.
        </p>
      </header>

      <section data-tour="assets" className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="label">Répartition de l'épargne</p>
            <p className="num mt-1 text-[22px] font-semibold">
              {formatAmount(derived.monthlySavings, currency)}
              <span className="ml-1.5 text-[12px] font-medium text-mist">
                {currencyLabel(currency)} ce mois
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Répartitions prêtes à l'emploi">
            {PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                className="pill"
                aria-pressed={rounded.s === preset.values[0] && rounded.a === preset.values[1]}
                onClick={() => applyPreset(preset.values)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="space-y-5">
            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="pct-subsistence" className="text-[14px] font-medium">
                  Biens de subsistance
                </label>
                <span className="num text-[15px] font-semibold">{rounded.s} %</span>
              </div>
              <input
                id="pct-subsistence"
                type="range"
                min={0}
                max={100}
                step={5}
                value={subsistence}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setSubsistence(next);
                  setAssets(Math.min(assets, 100 - next));
                  setAllocationSaved(false);
                }}
                className="mt-2"
                aria-valuetext={`${rounded.s} pour cent`}
              />
              <p className="label">
                Vêtements, maison, équipement. Ils servent mais ne rapportent pas.
              </p>
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="pct-assets" className="text-[14px] font-medium">
                  Assets
                </label>
                <span className="num text-[15px] font-semibold text-accent-text">{rounded.a} %</span>
              </div>
              <input
                id="pct-assets"
                type="range"
                min={0}
                max={100}
                step={5}
                value={assets}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setAssets(next);
                  setSubsistence(Math.min(subsistence, 100 - next));
                  setAllocationSaved(false);
                }}
                className="mt-2"
                aria-valuetext={`${rounded.a} pour cent`}
              />
              <p className="label">
                Ce qui génère un profit : commerce, location, placements, compétences vendues.
              </p>
            </div>

            <div className="rounded-2xl bg-slate2/70 p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-[14px] font-medium">Protection</span>
                <span className="num text-[15px] font-semibold">{rounded.p} %</span>
              </div>
              <p className="label mt-1">
                Ajustée automatiquement pour que le total reste à 100 %. Fonds d'urgence,
                assurances, diversification.
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-4 rounded-3xl bg-slate2/50 p-4">
            {[
              { key: 'subsistence' as const, label: 'Subsistance', color: '#3B4656', pct: rounded.s },
              { key: 'assets' as const, label: 'Assets', color: '#A8FF00', pct: rounded.a },
              { key: 'protection' as const, label: 'Protection', color: '#E9EEF3', pct: rounded.p },
            ].map((pocket) => (
              <div key={pocket.key} className="flex items-center gap-3">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: pocket.color }}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">{pocket.label}</p>
                  <ProgressBar value={pocket.pct / 100} height={6} ariaLabel={`${pocket.label} : ${pocket.pct} %`} />
                </div>
                <span className="num w-24 text-right text-[14px] font-semibold">
                  {formatAmount(amounts[pocket.key], currency)}
                </span>
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn btn-primary"
                onClick={saveAllocationNow}
                disabled={!dirty && allocationSaved}
              >
                {allocationSaved && !dirty ? (
                  <>
                    <Check size={16} strokeWidth={2} /> Enregistré
                  </>
                ) : (
                  'Enregistrer la répartition'
                )}
              </button>
              <Link to="/conseils" className="text-[13px] font-semibold text-accent-text">
                Comprendre les poches
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5 sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="label">Fonds d'urgence</p>
              <h2 className="mt-1 text-[22px]">
                {monthsLeft === null
                  ? 'À constituer'
                  : monthsLeft === 0
                    ? 'Objectif atteint'
                    : `${monthsLeft} mois restants`}
              </h2>
            </div>
            <IconCircle icon={ShieldCheck} tone="accent" />
          </div>

          <div className="mt-4">
            <ProgressBar value={emergencyProgress} ariaLabel="Progression du fonds d'urgence" />
            <div className="mt-2 flex justify-between text-[12px] text-mist">
              <span>
                {formatAmount(emergencyAmount, currency)} / {formatAmount(derived.target, currency)}{' '}
                {currencyLabel(currency)}
              </span>
              <span>{formatPercent(Math.min(1, emergencyProgress))}</span>
            </div>
          </div>

          <form
            className="mt-5 flex gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              await saveEmergency.mutateAsync(Math.max(0, emergencyAmount));
              setEmergencySaved(true);
            }}
          >
            <div className="relative flex-1">
              <label htmlFor="emergency-amount" className="sr-only">
                Montant déjà constitué
              </label>
              <input
                id="emergency-amount"
                className="field pr-20"
                inputMode="decimal"
                value={emergencyInput}
                onChange={(event) => {
                  setEmergencyInput(event.target.value);
                  setEmergencySaved(false);
                }}
                placeholder="0"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[12px] text-mist">
                {currencyLabel(currency)}
              </span>
            </div>
            <button type="submit" className="btn btn-secondary">
              {emergencySaved ? 'Enregistré' : 'Mettre à jour'}
            </button>
          </form>

          <p className="mt-3 text-[12px] leading-relaxed text-mist">
            Cible : {data.profile.emergency_months} × tes besoins mensuels ({formatAmount(derived.planningNeeds, currency)}{' '}
            {currencyLabel(currency)}). Avec ta poche protection, tu ajoutes{' '}
            {formatAmount(amounts.protection, currency)} {currencyLabel(currency)} par mois.
          </p>
        </section>

        <section className="card p-5 sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="label">Protection</p>
              <h2 className="mt-1 text-[22px]">Ta check-list</h2>
            </div>
            <span className="num text-[13px] text-mist">
              {data.protection.filter((item) => item.done).length}/{PROTECTION_ITEMS.length}
            </span>
          </div>

          <ul className="mt-4 space-y-1">
            {PROTECTION_ITEMS.map((item) => {
              const state = data.protection.find((row) => row.item_key === item.key);
              const done = Boolean(state?.done);
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => toggleProtection.mutate({ itemKey: item.key, done: !done })}
                    className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors hover:bg-veil"
                    aria-pressed={done}
                  >
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-colors',
                        done ? 'border-accent bg-accent text-ink' : 'border-line-strong text-transparent'
                      )}
                      aria-hidden="true"
                    >
                      <Check size={14} strokeWidth={3} />
                    </span>
                    <span className="min-w-0">
                      <span
                        className={cn(
                          'block text-[14px] font-medium',
                          done && 'text-mist line-through decoration-line'
                        )}
                      >
                        {item.label}
                      </span>
                      <span className="block text-[12px] text-mist">{item.hint}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[12px] text-mist">
            À revoir une fois par an : ta vie change, tes protections doivent suivre.
          </p>
        </section>
      </div>

      <section>
        <SectionTitle
          action={
            <button type="button" className="btn btn-secondary h-9 px-3 text-[13px]" onClick={() => setAssetOpen(true)}>
              <Plus size={15} strokeWidth={2} /> Ajouter un asset
            </button>
          }
        >
          Mes assets
        </SectionTitle>

        <div className="card p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="label">Valeur totale</p>
              <p className="num mt-1 text-[22px] font-semibold">
                {formatAmount(derived.assetsValue, currency)}
              </p>
            </div>
            <div>
              <p className="label">Revenu passif / mois</p>
              <p className="num mt-1 text-[22px] font-semibold text-accent-text">
                {formatAmount(derived.passive, currency)}
              </p>
            </div>
            <div>
              <p className="label">Besoins couverts</p>
              <p className="num mt-1 text-[22px] font-semibold">{formatPercent(coverage)}</p>
            </div>
          </div>

          {!hasAssets ? (
            <div className="mt-5 flex items-start gap-3 rounded-2xl bg-slate2/70 p-4">
              <IconCircle icon={Sparkles} size={36} />

              <div>
                <p className="text-[14px] font-semibold">Ton premier asset change tout</p>
                <p className="mt-0.5 text-[13px] text-mist">
                  Un petit commerce, un local loué, une compétence vendue : déclare-le pour voir ta
                  progression vers la liberté.
                </p>
              </div>
            </div>
          ) : (
            <ul className="mt-5 divide-y divide-line">
              {data.assets.map((asset) => (
                <li key={asset.id} className="flex items-center gap-3 py-3">
                  <IconCircle icon={asset.asset_type === 'Immobilier' ? Landmark : Banknote} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{asset.name}</p>
                    <p className="text-[12px] text-mist">
                      {asset.asset_type} · {formatAmount(num(asset.monthly_income), currency)}{' '}
                      {currencyLabel(currency)} / mois
                    </p>
                  </div>
                  <span className="num text-[14px] font-semibold">
                    {formatAmount(num(asset.value), currency)}
                  </span>
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-mist transition-colors hover:bg-coral/10 hover:text-coral-text"
                    onClick={() => {
                      if (window.confirm(`Supprimer « ${asset.name} » ?`)) deleteAsset.mutate(asset.id);
                    }}
                    aria-label={`Supprimer ${asset.name}`}
                  >
                    <Trash2 size={15} strokeWidth={1.75} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <p className="text-[12px] leading-relaxed text-mist">
        Un asset génère du profit. Un bien de subsistance te sert sans rien rapporter. La protection
        ne rapporte pas non plus, mais elle t'évite de tout perdre.
      </p>

      <Sheet
        open={assetOpen}
        onClose={() => setAssetOpen(false)}
        title="Ajouter un asset"
        subtitle="Déclare ce qui produit déjà un revenu."
      >
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setAssetError(null);
            if (!assetName.trim()) {
              setAssetError('Donne un nom à cet asset.');
              return;
            }
            try {
              await addAsset.mutateAsync({
                name: assetName.trim(),
                asset_type: assetType,
                value: Number.parseFloat(assetValue.replace(',', '.')) || 0,
                monthly_income: Number.parseFloat(assetIncome.replace(',', '.')) || 0,
                acquired_on: todayISO(),
              });
              setAssetOpen(false);
              setAssetName('');
              setAssetValue('');
              setAssetIncome('');
              setAssetType(ASSET_TYPES[0]);
            } catch (err) {
              setAssetError(err instanceof Error ? err.message : 'Enregistrement impossible.');
            }
          }}
        >
          <div>
            <label htmlFor="asset-name" className="field-label">
              Nom
            </label>
            <input
              id="asset-name"
              className="field"
              value={assetName}
              onChange={(event) => setAssetName(event.target.value)}
              placeholder="Ex. Boutique de tissus"
              maxLength={60}
            />
          </div>

          <div>
            <label htmlFor="asset-type" className="field-label">
              Type
            </label>
            <select
              id="asset-type"
              className="field appearance-none"
              value={assetType}
              onChange={(event) => setAssetType(event.target.value)}
            >
              {ASSET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="asset-value" className="field-label">
                Valeur estimée
              </label>
              <input
                id="asset-value"
                className="field"
                inputMode="decimal"
                value={assetValue}
                onChange={(event) => setAssetValue(event.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label htmlFor="asset-income" className="field-label">
                Revenu mensuel
              </label>
              <input
                id="asset-income"
                className="field"
                inputMode="decimal"
                value={assetIncome}
                onChange={(event) => setAssetIncome(event.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <FieldError>{assetError}</FieldError>

          <button type="submit" className="btn btn-primary w-full" disabled={addAsset.isPending}>
            <TrendingUp size={16} strokeWidth={1.75} />
            {addAsset.isPending ? 'Enregistrement…' : 'Ajouter cet asset'}
          </button>
        </form>
      </Sheet>
    </div>
  );
}
