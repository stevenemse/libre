// Crée (ou réinitialise) un compte de démonstration rempli de données réalistes.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const EMAIL = 'demo@libre.app';
const PASSWORD = 'Libre2026!';

const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
let user = list?.users.find((u) => u.email === EMAIL);

if (!user) {
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { first_name: 'Awa' },
  });
  if (error) throw error;
  user = data.user;
} else {
  await admin.auth.admin.updateUserById(user.id, { password: PASSWORD, email_confirm: true });
}

const uid = user.id;

// Repartir d'une base propre pour la démo
for (const table of ['transactions', 'assets', 'simulations', 'tip_progress', 'user_challenges']) {
  await admin.from(table).delete().eq('user_id', uid);
}

await admin.from('profiles').update({
  first_name: 'Awa',
  currency: 'XAF',
  life_goal: 'autonomie',
  avg_income: 600000,
  avg_needs: 280000,
  savings_rate_goal: 20,
  emergency_months: 6,
  onboarded: true,
}).eq('id', uid);

await admin.from('allocations').update({
  pct_subsistence: 25,
  pct_assets: 50,
  pct_protection: 25,
}).eq('user_id', uid);

await admin.from('emergency_fund').update({ amount_saved: 420000 }).eq('user_id', uid);

const { data: categories } = await admin.from('categories').select('*').eq('user_id', uid);
const cat = (name) => categories.find((c) => c.name === name)?.id ?? null;

const today = new Date();
// Date locale au format AAAA-MM-JJ (toISOString décalerait d'un jour).
const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const rows = [];

for (let back = 4; back >= 0; back -= 1) {
  const base = new Date(today.getFullYear(), today.getMonth() - back, 1);
  const maxDay = back === 0 ? today.getDate() : 27;
  const day = (n) => iso(new Date(base.getFullYear(), base.getMonth(), Math.min(n, maxDay)));
  const wobble = back === 0 ? 0.92 : 1;
  rows.push(
    { user_id: uid, category_id: cat('Salaire'), type: 'income', amount: 450000, occurred_on: day(1), note: 'Salaire mensuel' },
    { user_id: uid, category_id: cat('Business'), type: 'income', amount: Math.round(150000 * wobble), occurred_on: day(4), note: 'Boutique de tissus' },
    { user_id: uid, category_id: cat('Loyer'), type: 'expense', amount: 120000, occurred_on: day(2), note: 'Loyer appartement' },
    { user_id: uid, category_id: cat('Nourriture'), type: 'expense', amount: Math.round(92000 * wobble), occurred_on: day(6), note: 'Marché du mois' },
    { user_id: uid, category_id: cat('Transport'), type: 'expense', amount: 32000, occurred_on: day(8), note: 'Taxi et bus' },
    { user_id: uid, category_id: cat('Factures'), type: 'expense', amount: 24500, occurred_on: day(10), note: 'Électricité et internet' },
    { user_id: uid, category_id: cat('Santé'), type: 'expense', amount: 15000, occurred_on: day(12), note: 'Pharmacie' },
    { user_id: uid, category_id: cat('Sorties'), type: 'expense', amount: 38000, occurred_on: day(14), note: 'Anniversaire' },
    { user_id: uid, category_id: cat('Shopping'), type: 'expense', amount: 21000, occurred_on: day(17), note: 'Chaussures' }
  );
}

const { error: txError } = await admin.from('transactions').insert(rows);
if (txError) throw txError;

await admin.from('assets').insert([
  { user_id: uid, name: 'Boutique de tissus', asset_type: 'Commerce', value: 1800000, monthly_income: 150000, acquired_on: '2024-03-01' },
  { user_id: uid, name: 'Parts dans une tontine', asset_type: 'Placement', value: 450000, monthly_income: 12000, acquired_on: '2025-01-15' },
]);

await admin.from('simulations').insert([
  { user_id: uid, label: 'Cap actuel', monthly_needs: 280000, monthly_contribution: 90000, annual_return: 8, horizon_years: 15, start_capital: 2250000 },
  { user_id: uid, label: 'Avec revenus locatifs', monthly_needs: 280000, monthly_contribution: 140000, annual_return: 10, horizon_years: 15, start_capital: 3000000 },
]);

const { data: tips } = await admin.from('tips').select('id, category').limit(4);
await admin.from('tip_progress').insert(
  (tips ?? []).map((tip, index) => ({
    user_id: uid,
    tip_id: tip.id,
    read_at: new Date().toISOString(),
    favorite: index === 0,
  }))
);

for (const key of ['health_insurance', 'documents', 'income_sources']) {
  await admin.from('protection_checklist').update({ done: true }).eq('user_id', uid).eq('item_key', key);
}

console.log(`Compte de démonstration prêt : ${EMAIL} / ${PASSWORD}`);
