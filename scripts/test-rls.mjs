// Tests RLS automatisés : prouvent qu'un utilisateur ne peut jamais lire,
// modifier ou créer les données d'un autre utilisateur.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  try {
    for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
}
loadEnv();

const url = process.env.VITE_SUPABASE_URL;
const publishable = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !publishable || !secret) {
  console.error('Variables Supabase manquantes.');
  process.exit(1);
}

const admin = createClient(url, secret, { auth: { persistSession: false } });
const stamp = Date.now();
const userA = { email: `rls-a-${stamp}@libre-test.dev`, password: `Test-${stamp}-a!` };
const userB = { email: `rls-b-${stamp}@libre-test.dev`, password: `Test-${stamp}-b!` };

let failures = 0;
function check(label, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} · ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

const created = [];
try {
  for (const user of [userA, userB]) {
    const { data, error } = await admin.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { first_name: 'Test' },
    });
    if (error) throw new Error(`création ${user.email}: ${error.message}`);
    user.id = data.user.id;
    created.push(user.id);
  }

  const clientA = createClient(url, publishable, { auth: { persistSession: false } });
  const clientB = createClient(url, publishable, { auth: { persistSession: false } });
  const anon = createClient(url, publishable, { auth: { persistSession: false } });

  for (const [client, user] of [[clientA, userA], [clientB, userB]]) {
    const { error } = await client.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });
    if (error) throw new Error(`connexion ${user.email}: ${error.message}`);
  }

  // Le déclencheur a créé profil, allocations, fonds d'urgence, réglages et catégories
  const { data: profileA } = await clientA.from('profiles').select('*').single();
  check('trigger — profil créé', profileA?.id === userA.id);
  const { data: allocationsA } = await clientA.from('allocations').select('*').single();
  check(
    'trigger — répartition par défaut à 100 %',
    allocationsA &&
      allocationsA.pct_subsistence + allocationsA.pct_assets + allocationsA.pct_protection === 100
  );
  const { data: categoriesA } = await clientA.from('categories').select('id, name');
  check('trigger — catégories par défaut copiées', (categoriesA?.length ?? 0) >= 14);

  // A crée une transaction
  const needCategory = categoriesA.find((c) => c.name === 'Nourriture');
  const { data: txA, error: insertError } = await clientA
    .from('transactions')
    .insert({
      user_id: userA.id,
      amount: 5000,
      type: 'expense',
      category_id: needCategory.id,
      occurred_on: '2026-11-01',
    })
    .select()
    .single();
  check('A — insertion de ses propres données', Boolean(txA) && !insertError, insertError?.message);

  // B ne voit jamais les données de A
  const { data: bSeesA } = await clientB.from('transactions').select('*').eq('user_id', userA.id);
  check('B — ne lit pas les transactions de A', (bSeesA?.length ?? 0) === 0);

  const { data: bReadsOwn } = await clientB.from('transactions').select('*');
  check('B — ne voit que ses propres lignes', (bReadsOwn?.length ?? 0) === 0);

  const { data: bSingle } = await clientB.from('transactions').select('*').eq('id', txA.id);
  check('B — ne lit pas une transaction de A par identifiant', (bSingle?.length ?? 0) === 0);

  const { data: bUpdate } = await clientB
    .from('transactions')
    .update({ amount: 1 })
    .eq('id', txA.id)
    .select();
  check('B — ne modifie pas une transaction de A', (bUpdate?.length ?? 0) === 0);

  const { error: bDeleteError, count: bDeleteCount } = await clientB
    .from('transactions')
    .delete({ count: 'exact' })
    .eq('id', txA.id);
  check('B — ne supprime pas une transaction de A', bDeleteCount === 0 && !bDeleteError);

  const { error: bForgeError } = await clientB
    .from('transactions')
    .insert({ user_id: userA.id, amount: 100, type: 'income' });
  check('B — ne crée pas une ligne au nom de A', Boolean(bForgeError));

  const { data: bProfiles } = await clientB.from('profiles').select('*').eq('id', userA.id);
  check('B — ne lit pas le profil de A', (bProfiles?.length ?? 0) === 0);

  const { data: bFunds } = await clientB.from('emergency_fund').select('*').eq('user_id', userA.id);
  check("B — ne lit pas le fonds d'urgence de A", (bFunds?.length ?? 0) === 0);

  const { data: bSims } = await clientB.from('simulations').select('*').eq('user_id', userA.id);
  check('B — ne lit pas les simulations de A', (bSims?.length ?? 0) === 0);

  const { data: bTips } = await clientB.from('tips').select('id').limit(5);
  check('conseils — lecture autorisée pour un utilisateur connecté', (bTips?.length ?? 0) === 5);

  const { error: bTipWrite } = await clientB
    .from('tips')
    .insert({ category: 'Épargner', title: 'Intrusion', body: 'x' });
  check('conseils — écriture refusée au client', Boolean(bTipWrite));

  const { data: anonTips } = await anon.from('tips').select('id').limit(1);
  check('anonyme — aucune lecture des conseils', (anonTips?.length ?? 0) === 0);

  const { data: anonTx } = await anon.from('transactions').select('*');
  check('anonyme — aucune lecture des transactions', (anonTx?.length ?? 0) === 0);

  const { data: anonProfiles } = await anon.from('profiles').select('*');
  check('anonyme — aucune lecture des profils', (anonProfiles?.length ?? 0) === 0);

  // Contraintes métier
  const { error: allocError } = await clientA
    .from('allocations')
    .update({ pct_subsistence: 30, pct_assets: 30, pct_protection: 30 });
  check('répartition — total différent de 100 refusé', Boolean(allocError));

  const { error: amountError } = await clientA
    .from('transactions')
    .insert({ user_id: userA.id, amount: -5, type: 'income' });
  check('transaction — montant négatif refusé', Boolean(amountError));

  // A peut toujours lire sa propre transaction
  const { data: aOwn } = await clientA.from('transactions').select('*').eq('id', txA.id);
  check('A — lit toujours sa transaction', (aOwn?.length ?? 0) === 1);
} catch (error) {
  console.error('ERREUR', error.message);
  failures += 1;
} finally {
  for (const id of created) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
  console.log(failures === 0 ? '\nTous les tests RLS passent.' : `\n${failures} test(s) en échec.`);
  process.exit(failures === 0 ? 0 : 1);
}
