#!/usr/bin/env bun
/**
 * Upstream Release Watcher for LokkyWork (fork of iOfficeAI/AionUi).
 *
 * Runs daily via user crontab. Compares our local package.json version against
 * the latest upstream GitHub release. When upstream is strictly newer AND we
 * have not yet notified for that exact version, it:
 *   1. creates a Plane work item ("merge/update" reminder),
 *   2. fires a PAI desktop notification, and
 *   3. records the version in a state file so we never double-notify.
 *
 * Design constraints:
 *   - No hardcoded paths (uses $HOME / script-relative repo root).
 *   - Never logs secrets (Plane API key is read but never printed).
 *   - Idempotent: one notification per upstream version, ever.
 *   - Dry-run support via WATCHER_DRY_RUN / --dry-run: runs full detection +
 *     comparison but performs no Plane write, no notify, no state mutation.
 *   - Version override via WATCHER_FAKE_LOCAL_VERSION for testing the
 *     comparison logic without editing package.json.
 *
 * Exit codes:
 *   0  success (whether or not an update was found)
 *   1  unexpected runtime error (network, parse, etc.)
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '..');

const STATE_FILE = join(homedir(), '.lokkywork-upstream-watcher.json');
const PACKAGE_JSON = join(REPO_ROOT, 'package.json');
const MCP_JSON = join(REPO_ROOT, '.mcp.json');

const UPSTREAM_REPO = 'iOfficeAI/AionUi';
const GITHUB_LATEST = `https://api.github.com/repos/${UPSTREAM_REPO}/releases/latest`;
const PLANE_PROJECT_ID = 'e59496b8-9884-4ecf-a523-cc858cf9387c';
const NOTIFY_URL = 'http://localhost:31337/notify';

const DRY_RUN = process.env.WATCHER_DRY_RUN === '1' || process.argv.includes('--dry-run');

type State = { last_notified_version: string | null };

function log(msg: string): void {
  console.log(`[upstream-watcher ${new Date().toISOString()}] ${msg}`);
}

/** Parse "v2.1.21" / "2.1.21" into comparable numeric parts. */
function parseVersion(raw: string): number[] {
  const cleaned = raw.trim().replace(/^v/i, '');
  // Strip any pre-release/build suffix (e.g. "2.1.21-beta.1") for comparison.
  const core = cleaned.split(/[-+]/)[0];
  return core.split('.').map((p) => {
    const n = Number.parseInt(p, 10);
    return Number.isFinite(n) ? n : 0;
  });
}

/** Returns true when `a` is strictly newer than `b` (semantic compare). */
function isNewer(a: string, b: string): boolean {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

function readLocalVersion(): string {
  const override = process.env.WATCHER_FAKE_LOCAL_VERSION;
  if (override) {
    log(`Using overridden local version: ${override} (test mode)`);
    return override;
  }
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')) as { version?: string };
  if (!pkg.version) throw new Error('package.json has no "version" field');
  return pkg.version;
}

function readState(): State {
  if (!existsSync(STATE_FILE)) return { last_notified_version: null };
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as State;
  } catch {
    log('State file unreadable/corrupt — treating as empty.');
    return { last_notified_version: null };
  }
}

function writeState(state: State): void {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

/** Read Plane credentials from the gitignored .mcp.json. Never logged. */
function readPlaneCreds(): { apiKey: string; baseUrl: string; slug: string } | null {
  try {
    const mcp = JSON.parse(readFileSync(MCP_JSON, 'utf8'));
    const env = mcp?.mcpServers?.plane?.env ?? {};
    const apiKey = env.PLANE_API_KEY;
    const baseUrl = env.PLANE_BASE_URL;
    const slug = env.PLANE_WORKSPACE_SLUG;
    if (!apiKey || !baseUrl || !slug) return null;
    return { apiKey, baseUrl, slug };
  } catch {
    return null;
  }
}

async function fetchLatestUpstream(): Promise<{ tag: string; url: string }> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'lokkywork-upstream-watcher',
  };
  // Optional token to dodge unauthenticated rate limits; never logged.
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const res = await fetch(GITHUB_LATEST, { headers });
  if (!res.ok) throw new Error(`GitHub API returned HTTP ${res.status}`);
  const data = (await res.json()) as { tag_name?: string; html_url?: string };
  if (!data.tag_name) throw new Error('GitHub release response has no tag_name');
  return {
    tag: data.tag_name,
    url: data.html_url ?? `https://github.com/${UPSTREAM_REPO}/releases/tag/${data.tag_name}`,
  };
}

async function createPlaneItem(tag: string, releaseUrl: string): Promise<boolean> {
  const creds = readPlaneCreds();
  if (!creds) {
    log('Plane credentials not found in .mcp.json — skipping Plane item (notify still sent).');
    return false;
  }
  const endpoint = `${creds.baseUrl}/api/v1/workspaces/${creds.slug}/projects/${PLANE_PROJECT_ID}/issues/`;
  const body = {
    name: `Upstream AionUi ${tag} verfügbar — Merge/Update prüfen`,
    description_html:
      `<p>Upstream <strong>${UPSTREAM_REPO}</strong> hat eine neue Version <strong>${tag}</strong> veröffentlicht.</p>` +
      `<p>Release: <a href="${releaseUrl}">${releaseUrl}</a></p>` +
      `<p>Bitte prüfen, ob ein Merge/Update in den LokkyWork-Fork fällig ist.</p>`,
  };
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'X-API-Key': creds.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      log(`Plane item creation failed: HTTP ${res.status} — ${text.slice(0, 200)}`);
      return false;
    }
    log('Plane work item created.');
    return true;
  } catch (err) {
    log(`Plane item creation errored: ${(err as Error).message}`);
    return false;
  }
}

async function notify(message: string): Promise<void> {
  try {
    const res = await fetch(NOTIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) log(`Notify endpoint returned HTTP ${res.status}.`);
    else log('Notification sent.');
  } catch (err) {
    log(`Notify failed (PAI not running?): ${(err as Error).message}`);
  }
}

async function main(): Promise<void> {
  if (DRY_RUN) log('DRY RUN — no Plane item, no notify, no state change.');

  const localVersion = readLocalVersion();
  const { tag, url } = await fetchLatestUpstream();
  const state = readState();

  log(
    `Local version: ${localVersion} | Upstream latest: ${tag} | Last notified: ${state.last_notified_version ?? '(none)'}`
  );

  if (!isNewer(tag, localVersion)) {
    log('No update: upstream is not newer than local. Nothing to do.');
    return;
  }

  const upstreamCore = tag.trim().replace(/^v/i, '').split(/[-+]/)[0];
  if (state.last_notified_version === upstreamCore) {
    log(`Already notified for ${tag} — deduped, nothing to do.`);
    return;
  }

  log(`NEW upstream version detected: ${tag} (local ${localVersion}).`);

  if (DRY_RUN) {
    log('DRY RUN — would create Plane item + notify + record state. Stopping here.');
    return;
  }

  await createPlaneItem(tag, url);
  await notify(`Neue AionUi-Version ${tag} verfügbar — Merge prüfen (Plane-Item angelegt).`);

  writeState({ last_notified_version: upstreamCore });
  log(`State updated: last_notified_version=${upstreamCore}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    log(`FATAL: ${(err as Error).message}`);
    process.exit(1);
  });
