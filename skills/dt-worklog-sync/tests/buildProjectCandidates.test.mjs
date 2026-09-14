import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  extractProjects,
  sortByRecency,
  browseUrl,
  renderTable,
  parseKeyInput,
  validateKey,
  buildConfig,
  ensureGitignoreEntry,
} from '../scripts/buildProjectCandidates.mjs';

// getVisibleJiraProjects(action=browse, expandIssueTypes=false) 응답의 축약 샘플.
const PAGE = {
  total: 3,
  isLast: true,
  values: [
    { id: '10001', key: 'PROJ', name: '[ACME] 주문 관리', projectCategory: { name: '2026년' } },
    { id: '10002', key: 'SHOP', name: '[ACME] 쇼핑몰 개편', projectCategory: { name: '2026년' } },
    { id: '10042', key: 'PORT', name: 'ACME_Portfolio', projectCategory: { name: 'In-house' } },
  ],
};
const SITE = 'your-site.atlassian.net';

test('extractProjects normalizes a single-page response', () => {
  const got = extractProjects(PAGE);
  assert.equal(got.length, 3);
  assert.deepEqual(got[0], { id: '10001', key: 'PROJ', name: '[ACME] 주문 관리', category: '2026년' });
});

test('extractProjects flattens an array of page responses', () => {
  const got = extractProjects([PAGE, { values: [{ id: '999', key: 'X', name: 'x' }] }]);
  assert.equal(got.length, 4);
  assert.equal(got[3].key, 'X');
  assert.equal(got[3].category, null);
});

test('extractProjects accepts an already-flat values array', () => {
  const got = extractProjects(PAGE.values);
  assert.equal(got.length, 3);
  assert.equal(got[1].key, 'SHOP');
});

test('extractProjects throws on unrecognized shape', () => {
  assert.throws(() => extractProjects({ foo: 1 }), /values 배열/);
});

test('sortByRecency orders by numeric id descending (newest first)', () => {
  const sorted = sortByRecency(extractProjects(PAGE));
  assert.deepEqual(sorted.map((p) => p.key), ['SHOP', 'PROJ', 'PORT']);
});

test('browseUrl builds the site browse link', () => {
  assert.equal(browseUrl(SITE, 'PROJ'), 'https://your-site.atlassian.net/browse/PROJ');
});

test('renderTable outputs a newest-first lightweight table with URLs', () => {
  const table = renderTable(extractProjects(PAGE), SITE);
  const lines = table.split('\n');
  assert.equal(lines[0], '| 키 | 이름 | URL |');
  assert.equal(lines[1], '|---|---|---|');
  assert.equal(lines[2], '| SHOP | [ACME] 쇼핑몰 개편 | https://your-site.atlassian.net/browse/SHOP |');
  assert.equal(lines[3], '| PROJ | [ACME] 주문 관리 | https://your-site.atlassian.net/browse/PROJ |');
  assert.equal(lines[4], '| PORT | ACME_Portfolio | https://your-site.atlassian.net/browse/PORT |');
  assert.ok(!table.includes('avatar'), 'avatarUrls가 새어나오면 안 된다');
});

test('parseKeyInput uppercases a bare key and trims', () => {
  assert.equal(parseKeyInput(' proj '), 'PROJ');
});

test('parseKeyInput extracts the key from a browse URL', () => {
  assert.equal(parseKeyInput('https://your-site.atlassian.net/browse/SHOP'), 'SHOP');
  assert.equal(parseKeyInput('https://your-site.atlassian.net/browse/PROJ?filter=1'), 'PROJ');
});

test('parseKeyInput returns empty string for nullish input', () => {
  assert.equal(parseKeyInput(null), '');
  assert.equal(parseKeyInput(undefined), '');
});

test('validateKey returns the matching project for a key or URL', () => {
  const projects = extractProjects(PAGE);
  assert.equal(validateKey(projects, 'proj').key, 'PROJ');
  assert.equal(validateKey(projects, 'https://your-site.atlassian.net/browse/SHOP').key, 'SHOP');
});

test('validateKey returns null for an unknown key', () => {
  assert.equal(validateKey(extractProjects(PAGE), 'NOPE'), null);
});

// --- CLI ---
function withDump(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'dt-wl-'));
  try {
    const file = join(dir, 'projects.json');
    writeFileSync(file, JSON.stringify(PAGE));
    return fn(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const CLI = new URL('../scripts/buildProjectCandidates.mjs', import.meta.url).pathname;

test('CLI table mode prints the newest-first table', () => {
  withDump((file) => {
    const r = spawnSync('node', [CLI, 'table', file, SITE], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const lines = r.stdout.trim().split('\n');
    assert.equal(lines[2], '| SHOP | [ACME] 쇼핑몰 개편 | https://your-site.atlassian.net/browse/SHOP |');
  });
});

test('CLI validate mode exits 0 and echoes the key for a known project', () => {
  withDump((file) => {
    const r = spawnSync('node', [CLI, 'validate', file, 'proj'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), 'PROJ');
  });
});

test('CLI validate mode exits 1 for an unknown key', () => {
  withDump((file) => {
    const r = spawnSync('node', [CLI, 'validate', file, 'NOPE'], { encoding: 'utf8' });
    assert.equal(r.status, 1);
  });
});

test('CLI validate mode exits 1 when keyOrUrl is missing', () => {
  withDump((file) => {
    const r = spawnSync('node', [CLI, 'validate', file], { encoding: 'utf8' });
    assert.equal(r.status, 1);
  });
});

test('CLI errors (exit 1) when args are missing', () => {
  const r = spawnSync('node', [CLI], { encoding: 'utf8' });
  assert.equal(r.status, 1);
});

test('buildConfig injects key/site/cloudId and preserves the rest of the example', () => {
  const example = {
    site: 'placeholder', cloudId: 'placeholder', defaultProjectKey: 'REPLACE',
    issueTypeNames: { story: '스토리' }, issueKeyPattern: 'X',
  };
  const cfg = buildConfig(example, 'PROJ', 'your-site.atlassian.net', 'cloud-123');
  assert.equal(cfg.defaultProjectKey, 'PROJ');
  assert.equal(cfg.site, 'your-site.atlassian.net');
  assert.equal(cfg.cloudId, 'cloud-123');
  assert.deepEqual(cfg.issueTypeNames, { story: '스토리' });
  assert.equal(cfg.issueKeyPattern, 'X');
});

test('ensureGitignoreEntry creates content when none exists', () => {
  assert.equal(ensureGitignoreEntry(null, '.dt-worklog.local.json'), '.dt-worklog.local.json\n');
  assert.equal(ensureGitignoreEntry('', '.dt-worklog.local.json'), '.dt-worklog.local.json\n');
});

test('ensureGitignoreEntry appends with a newline when trailing newline is missing', () => {
  assert.equal(
    ensureGitignoreEntry('node_modules/', '.dt-worklog.local.json'),
    'node_modules/\n.dt-worklog.local.json\n'
  );
});

test('ensureGitignoreEntry appends after an existing trailing newline', () => {
  assert.equal(
    ensureGitignoreEntry('node_modules/\n', '.dt-worklog.local.json'),
    'node_modules/\n.dt-worklog.local.json\n'
  );
});

test('ensureGitignoreEntry is idempotent when the entry already exists', () => {
  const content = 'node_modules/\n.dt-worklog.local.json\n';
  assert.equal(ensureGitignoreEntry(content, '.dt-worklog.local.json'), content);
});

// --- setup CLI ---
function withSetupEnv(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'dt-wl-setup-'));
  try {
    const dump = join(dir, 'projects.json');
    writeFileSync(dump, JSON.stringify(PAGE));
    return fn(dir, dump);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('CLI setup writes the three config files into the consumer root', () => {
  withSetupEnv((root, dump) => {
    const r = spawnSync('node', [CLI, 'setup', dump, 'proj', SITE, 'cloud-123', root], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(r.stdout.includes('[ACME] 주문 관리'), '성공 출력에 프로젝트 이름이 보여야 한다');
    const cfg = JSON.parse(readFileSync(join(root, '.dt-worklog.json'), 'utf8'));
    assert.equal(cfg.defaultProjectKey, 'PROJ');
    assert.equal(cfg.site, SITE);
    assert.equal(cfg.cloudId, 'cloud-123');
    assert.ok(cfg.issueTypeNames, 'example의 issueTypeNames가 보존돼야 한다');
    const local = JSON.parse(readFileSync(join(root, '.dt-worklog.local.json'), 'utf8'));
    assert.equal(local.lastSyncSha, null);
    const giLines = readFileSync(join(root, '.gitignore'), 'utf8').split('\n').map((l) => l.trim());
    assert.ok(giLines.includes('.dt-worklog.local.json'));
  });
});

test('CLI setup exits 1 for an unknown key and writes no config', () => {
  withSetupEnv((root, dump) => {
    const r = spawnSync('node', [CLI, 'setup', dump, 'NOPE', SITE, 'cloud-123', root], { encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.equal(existsSync(join(root, '.dt-worklog.json')), false);
  });
});

test('CLI setup preserves an existing .dt-worklog.local.json (lastSyncSha kept)', () => {
  withSetupEnv((root, dump) => {
    writeFileSync(join(root, '.dt-worklog.local.json'), JSON.stringify({ lastSyncSha: 'abc123' }));
    const r = spawnSync('node', [CLI, 'setup', dump, 'PROJ', SITE, 'cloud-123', root], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const local = JSON.parse(readFileSync(join(root, '.dt-worklog.local.json'), 'utf8'));
    assert.equal(local.lastSyncSha, 'abc123');
  });
});

test('CLI setup exits 1 when required args are missing', () => {
  withSetupEnv((root, dump) => {
    const r = spawnSync('node', [CLI, 'setup', dump, 'PROJ'], { encoding: 'utf8' });
    assert.equal(r.status, 1);
  });
});

test('CLI setup accepts a paginated dump (array of page responses)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dt-wl-setup-pg-'));
  try {
    const dump = join(dir, 'projects.json');
    writeFileSync(dump, JSON.stringify([
      { values: PAGE.values.slice(0, 2) },
      { values: PAGE.values.slice(2) },
    ]));
    const r = spawnSync('node', [CLI, 'setup', dump, 'PORT', SITE, 'cloud-123', dir], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const cfg = JSON.parse(readFileSync(join(dir, '.dt-worklog.json'), 'utf8'));
    assert.equal(cfg.defaultProjectKey, 'PORT');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI setup exits 1 for a whitespace-only key and writes no config', () => {
  withSetupEnv((root, dump) => {
    const r = spawnSync('node', [CLI, 'setup', dump, '   ', SITE, 'cloud-123', root], { encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.equal(existsSync(join(root, '.dt-worklog.json')), false);
  });
});
