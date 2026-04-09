/**
 * Package the built extension into a ZIP suitable for Chrome Web Store.
 *
 * Contract:
 *   - The ZIP contains the *contents* of dist/ at its root (so
 *     manifest.json sits at the top level, which is what Chrome
 *     expects).
 *   - Filename: autoverdict-<version>.zip in the repo root.
 *   - Requires the `zip` CLI (present by default on macOS/Linux).
 *
 * Run:  npm run package
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, 'dist');

function fail(msg) {
  console.error(`\x1b[31m✕ ${msg}\x1b[0m`);
  process.exit(1);
}

if (!existsSync(DIST)) {
  fail('dist/ not found. Run `npm run build` first.');
}
if (!existsSync(resolve(DIST, 'manifest.json'))) {
  fail('dist/manifest.json missing — build is incomplete.');
}

const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
const version = pkg.version ?? '0.0.0';
const name = pkg.name ?? 'extension';
const zipName = `${name}-${version}.zip`;
const zipPath = resolve(ROOT, zipName);

// Verify the `zip` CLI is available.
try {
  execSync('command -v zip', { stdio: 'ignore' });
} catch {
  fail(
    'The `zip` CLI is not installed. On macOS/Linux it ships by default; ' +
      'on Windows use WSL or install Info-ZIP.',
  );
}

// Remove any stale ZIP of the same name so `zip` does not append.
if (existsSync(zipPath)) {
  rmSync(zipPath);
}

// Zip the contents of dist/ — not dist/ itself — so manifest.json is at the root.
try {
  execSync(`zip -rq "${zipPath}" .`, { cwd: DIST, stdio: 'inherit' });
} catch (err) {
  fail(`zip command failed: ${err instanceof Error ? err.message : err}`);
}

const size = statSync(zipPath).size;
const kb = (size / 1024).toFixed(1);
console.log(`\x1b[32m✓ Created ${zipName} (${kb} KB)\x1b[0m`);
console.log(`  → ${zipPath}`);
console.log('  Upload this file at https://chrome.google.com/webstore/devconsole');
