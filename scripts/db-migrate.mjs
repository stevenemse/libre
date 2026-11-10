import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
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
    // .env is optional when the variables are already exported
  }
}

loadEnv();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL manquant.');
  process.exit(1);
}

const withSeed = process.argv.includes('--seed');
const folders = [['supabase/migrations', true], ['supabase/seed', withSeed]];
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

await client.connect();
console.log('Connecté à la base.');

for (const [folder, enabled] of folders) {
  if (!enabled) continue;
  let files = [];
  try {
    files = readdirSync(folder).filter((f) => f.endsWith('.sql')).sort();
  } catch {
    continue;
  }
  for (const file of files) {
    const sql = readFileSync(join(folder, file), 'utf8');
    process.stdout.write(`${folder}/${file} … `);
    try {
      await client.query(sql);
      console.log('ok');
    } catch (error) {
      console.log('échec');
      console.error(error.message);
      await client.end();
      process.exit(1);
    }
  }
}

const { rows } = await client.query(
  "select table_name from information_schema.tables where table_schema = 'public' order by 1"
);
console.log('Tables publiques :', rows.map((r) => r.table_name).join(', '));
await client.end();
