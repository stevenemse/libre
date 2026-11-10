// Nomme un opérateur du panel /admin.
//   node scripts/set-admin.mjs steve@exemple.com
// La clé de service reste locale (.env), jamais côté client.

import { readFileSync } from 'node:fs';
import { Client } from 'pg';

function loadEnv() {
  try {
    const raw = readFileSync('.env', 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // variables déjà exportées
  }
}

loadEnv();

const email = process.argv[2];
if (!email) {
  console.error("Usage : node scripts/set-admin.mjs <email>");
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
const { rows } = await client.query(
  `update public.profiles p
      set is_admin = true
     from auth.users u
    where u.id = p.id and lower(u.email) = lower($1)
returning p.id, p.is_admin`,
  [email]
);

if (rows.length === 0) {
  console.error('Aucun compte pour', email);
} else {
  console.log('Administrateur :', email, rows[0]);
}

await client.end();
