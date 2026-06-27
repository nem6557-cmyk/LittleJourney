#!/usr/bin/env node
/**
 * Push the EXPO_PUBLIC_* build-time vars from .env up to EAS as account-level
 * secrets, so `eas build` can bake them into the native bundle. EAS does NOT
 * upload your local .env (it's in .easignore), so without this the production
 * profile crashes at boot (src/lib/config.ts fails fast on missing Supabase env).
 *
 * Safe to re-run: uses `--force` to overwrite an existing secret of the same name.
 * Reads values from .env only — nothing secret is hardcoded here or committed.
 *
 * Prereq: you are logged in (`npx eas-cli login`). Run from the repo root:
 *   node scripts/eas-push-secrets.mjs
 * Add --dry-run to print what WOULD be pushed without calling EAS.
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');

// The exact build-time vars Expo bakes into the bundle. EXPO_PUBLIC_ENV is set
// per-profile in eas.json, so it is intentionally NOT pushed here.
const KEYS = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_STRIPE_PRICE_STARTER',
  'EXPO_PUBLIC_STRIPE_PRICE_PROFESSIONAL',
  'EXPO_PUBLIC_STRIPE_PRICE_ENTERPRISE',
  'EXPO_PUBLIC_STRIPE_PRICE_PARENT_PREMIUM',
  'EXPO_PUBLIC_SENTRY_DSN',
];

// Minimal .env parser (KEY=VALUE, ignores comments/blank lines).
const env = {};
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const eas = (args) =>
  spawnSync('npx', ['eas-cli@latest', ...args], { cwd: root, stdio: 'inherit', shell: true });

let pushed = 0;
let skipped = 0;
for (const key of KEYS) {
  const value = env[key];
  if (!value || value.includes('placeholder') || value.includes('YOUR_')) {
    console.warn(`SKIP  ${key} — missing/placeholder in .env`);
    skipped++;
    continue;
  }
  // mask the value in logs: show only first 6 chars
  const masked = value.length > 10 ? value.slice(0, 6) + '…(' + value.length + ' chars)' : '***';
  if (dryRun) {
    console.log(`WOULD push ${key} = ${masked}`);
    continue;
  }
  console.log(`\n=== Pushing ${key} (${masked}) ===`);
  const r = eas([
    'secret:create',
    '--scope', 'project',
    '--name', key,
    '--value', value,
    '--type', 'string',
    '--force',
    '--non-interactive',
  ]);
  if (r.status !== 0) {
    console.error(`FAILED to push ${key} (exit ${r.status}). Are you logged in? Run: npx eas-cli login`);
    process.exit(r.status || 1);
  }
  pushed++;
}

console.log(
  dryRun
    ? `\nDry run complete. ${KEYS.length} keys would be processed.`
    : `\nDone. Pushed ${pushed} secret(s), skipped ${skipped}. Verify with: npx eas-cli secret:list`,
);
