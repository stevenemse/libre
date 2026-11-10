// Libre — envoi des bilans (hebdomadaire et mensuel) par e-mail et push.
//
// Cette fonction n'est PAS déployée par le dépôt : voir « Notifications serveur »
// dans le README. Elle exige quatre secrets :
//   RESEND_API_KEY      clé Resend (e-mail)
//   RESEND_FROM         expéditeur vérifié, ex. "Libre <bonjour@libre.app>"
//   VAPID_PUBLIC_KEY    clé publique Web Push
//   VAPID_PRIVATE_KEY   clé privée Web Push
// et s'appelle avec la clé de service :
//   curl -X POST https://<projet>.supabase.co/functions/v1/notify \
//     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
//     -H "Content-Type: application/json" -d '{"kind":"weekly"}'
//
// Aucun calcul n'est fait côté client : les agrégats sont recalculés ici à
// partir des transactions, et seuls les utilisateurs ayant activé le réglage
// correspondant sont contactés.

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

type Kind = 'weekly' | 'monthly';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

const formatMoney = (value: number, currency: string) =>
  `${Math.round(value).toLocaleString('fr-FR')} ${currency}`;

const iso = (date: Date) => date.toISOString().slice(0, 10);

/** Lundi 00:00 de la semaine précédente, et dimanche 23:59 de celle-ci. */
function lastWeek(now = new Date()) {
  const day = now.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  const thisMonday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset)
  );
  const from = new Date(thisMonday);
  from.setUTCDate(from.getUTCDate() - 7);
  const to = new Date(thisMonday);
  to.setUTCDate(to.getUTCDate() - 1);
  return { from: iso(from), to: iso(to) };
}

function lastMonth(now = new Date()) {
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return { from: iso(first), to: iso(last) };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization') ?? '';
  if (!serviceKey || authorization !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json().catch(() => ({}));
  const kind: Kind = body.kind === 'monthly' ? 'monthly' : 'weekly';

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);
  const range = kind === 'weekly' ? lastWeek() : lastMonth();

  const { data: settings, error: settingsError } = await supabase
    .from('notification_settings')
    .select('user_id, weekly_review, monthly_summary')
    .eq(kind === 'weekly' ? 'weekly_review' : 'monthly_summary', true);

  if (settingsError) {
    return new Response(JSON.stringify({ error: settingsError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  if (vapidPublic && vapidPrivate) {
    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT') ?? 'mailto:bonjour@libre.app',
      vapidPublic,
      vapidPrivate
    );
  }

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const resendFrom = Deno.env.get('RESEND_FROM') ?? 'Libre <bonjour@libre.app>';
  const appOrigin = Deno.env.get('APP_ORIGIN') ?? 'https://libre.app';

  let emails = 0;
  let pushes = 0;

  for (const setting of settings ?? []) {
    const userId = setting.user_id as string;

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, currency')
      .eq('id', userId)
      .maybeSingle();

    const { data: rows } = await supabase
      .from('transactions')
      .select('type, amount, occurred_on')
      .eq('user_id', userId)
      .gte('occurred_on', range.from)
      .lte('occurred_on', range.to);

    if (!rows || rows.length === 0) continue;

    const income = rows
      .filter((row) => row.type === 'income')
      .reduce((sum, row) => sum + Number(row.amount), 0);
    const expenses = rows
      .filter((row) => row.type === 'expense')
      .reduce((sum, row) => sum + Number(row.amount), 0);
    if (income === 0 && expenses === 0) continue;

    const saved = Math.max(0, income - expenses);
    const currency = (profile?.currency as string) ?? 'XAF';
    const firstName = (profile?.first_name as string) || '';
    const title =
      kind === 'weekly' ? 'Ton bilan de la semaine' : 'Ton résumé du mois';
    const body = `${kind === 'weekly' ? 'Cette semaine' : 'Ce mois-ci'} : ${formatMoney(
      income,
      currency
    )} gagnés, ${formatMoney(expenses, currency)} dépensés, ${formatMoney(
      saved,
      currency
    )} gardés.`;

    if (resendKey) {
      const { data: email } = await supabase.auth.admin.getUserById(userId);
      const to = email?.user?.email;
      if (to) {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: resendFrom,
            to,
            subject: `${title} — Libre`,
            html: `<div style="background:#0B0F15;color:#F2F5F8;font-family:system-ui,sans-serif;padding:32px;border-radius:16px">
              <p style="color:#A8FF00;font-weight:700;margin:0 0 12px">Libre</p>
              <h1 style="font-size:22px;margin:0 0 12px">${title}${firstName ? `, ${firstName}` : ''}</h1>
              <p style="color:#8B97A7;margin:0 0 16px">${body}</p>
              <p style="color:#8B97A7;margin:0 0 16px">Ouvre Libre pour voir le détail et ton action du moment.</p>
              <a href="${appOrigin}" style="display:inline-block;background:#A8FF00;color:#0B0F15;font-weight:700;padding:12px 20px;border-radius:999px;text-decoration:none">Ouvrir Libre</a>
              <p style="color:#5b6675;font-size:11px;margin-top:24px">Libre est un outil pédagogique, pas un conseil financier personnalisé. Tu peux couper ces rappels dans les paramètres.</p>
            </div>`,
          }),
        });
        if (response.ok) emails += 1;
      }
    }

    if (vapidPublic && vapidPrivate) {
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('id, subscription')
        .eq('user_id', userId);

      for (const row of subscriptions ?? []) {
        try {
          await webpush.sendNotification(
            row.subscription as never,
            JSON.stringify({ title, body, url: '/', kind })
          );
          pushes += 1;
        } catch {
          // Abonnement expiré : on le retire pour ne pas réessayer indéfiniment.
          await supabase.from('push_subscriptions').delete().eq('id', row.id);
        }
      }
    }
  }

  return new Response(JSON.stringify({ kind, range, emails, pushes }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
