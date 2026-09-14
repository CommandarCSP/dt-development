import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REVIEW_SCRIPT = new URL('../scripts/review.mjs', import.meta.url).pathname;

function makeTempProject(name, files, configExtra = {}) {
  const dir = mkdtempSync(join(tmpdir(), `dt-frontend-e2e-${name}-`));
  // Make it a git repo so getChangedFiles works (and provide a .dt-frontend.json)
  spawnSync('git', ['init', '--quiet'], { cwd: dir });
  spawnSync('git', ['config', 'user.email', 'e2e@test'], { cwd: dir });
  spawnSync('git', ['config', 'user.name', 'e2e'], { cwd: dir });
  writeFileSync(join(dir, '.dt-frontend.json'), JSON.stringify({
    version: '0.1.0',
    paths: ['src/'],
    enabledSkills: ['dt-frontend-review'],
    coverage: { mode: 'off' },
    ...configExtra,
  }));
  for (const [path, content] of Object.entries(files)) {
    const abs = join(dir, path);
    mkdirSync(abs.slice(0, abs.lastIndexOf('/')), { recursive: true });
    writeFileSync(abs, content);
  }
  spawnSync('git', ['add', '.'], { cwd: dir });
  spawnSync('git', ['commit', '--quiet', '-m', 'init'], { cwd: dir });
  return dir;
}

function cleanup(dir) {
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
}

test('full mode: detects forbidden axios import in domain component', () => {
  const dir = makeTempProject('axios', {
    'src/components/domain/Bad.tsx': `
import axios from 'axios';
export function Bad() {
  axios.get('/api');
  return null;
}
`,
  });
  try {
    const r = spawnSync('node', [REVIEW_SCRIPT, 'full', '--no-coverage', '--project', dir], {
      encoding: 'utf8',
    });
    assert.match(r.stdout, /Critical/);
    assert.match(r.stdout, /domain-no-direct-api/);
    assert.match(r.stdout, /Bad\.tsx/);
    assert.equal(r.status, 1);
  } finally {
    cleanup(dir);
  }
});

test('full mode: clean code → no Critical findings, exit 0', () => {
  const dir = makeTempProject('clean', {
    'src/components/view/Card.tsx': `
interface Props { title: string }
export function Card({ title }: Props) {
  return <div>{title}</div>;
}
`,
  });
  try {
    const r = spawnSync('node', [REVIEW_SCRIPT, 'full', '--no-coverage', '--project', dir], {
      encoding: 'utf8',
    });
    // Clean view component has no critical violations — only ast-rule manual-review stubs
    // which produce "Ready to merge: With fixes" (not "No"). Exit code is 0.
    assert.doesNotMatch(r.stdout, /Ready to merge: No/);
    assert.equal(r.status, 0);
  } finally {
    cleanup(dir);
  }
});

test('partial mode: only checks specified paths', () => {
  const dir = makeTempProject('partial', {
    'src/components/domain/Good.tsx': `
import { useFoo } from '../../business/hooks/useFoo';
export function Good() { useFoo(); return null; }
`,
    'src/components/domain/Bad.tsx': `
import axios from 'axios';
export function Bad() { axios.get('/'); return null; }
`,
  });
  try {
    const r = spawnSync('node', [REVIEW_SCRIPT, 'partial', '--paths', 'src/components/domain/Good.tsx', '--project', dir], {
      encoding: 'utf8',
    });
    assert.doesNotMatch(r.stdout, /Bad\.tsx/);
    assert.match(r.stdout, /Ready to merge:/);
  } finally {
    cleanup(dir);
  }
});

test('view component with hook import: flagged as critical', () => {
  const dir = makeTempProject('view-hook', {
    'src/components/view/Tainted.tsx': `
import { useQuery } from '@tanstack/react-query';
export function Tainted() {
  useQuery({ queryKey: ['x'], queryFn: async () => {} });
  return null;
}
`,
  });
  try {
    const r = spawnSync('node', [REVIEW_SCRIPT, 'full', '--no-coverage', '--project', dir], {
      encoding: 'utf8',
    });
    assert.match(r.stdout, /pure-view-component/);
    assert.match(r.stdout, /Critical/);
  } finally {
    cleanup(dir);
  }
});

test('override: styling override skips view-styling + prints transparency line', () => {
  const dir = makeTempProject('override-styling', {
    'src/components/view/Styled.tsx': `
import './Styled.scss';
export function Styled() { return <div className="card" />; }
`,
    'src/components/view/Styled.scss': `.card { padding: 16px; }`,
  }, { overrides: { styling: 'mui' } });
  try {
    const r = spawnSync('node', [REVIEW_SCRIPT, 'full', '--no-coverage', '--project', dir], {
      encoding: 'utf8',
    });
    // transparency line must be printed
    assert.match(r.stdout, /오버라이드/);
    // view-styling is overridable(styling) → skipped, must NOT appear as a finding.
    // The transparency line legitimately lists it under `skip:`; strip that line
    // before asserting it is absent from the actual findings.
    const withoutOverrideLine = r.stdout
      .split('\n')
      .filter((l) => !l.includes('오버라이드'))
      .join('\n');
    assert.doesNotMatch(withoutOverrideLine, /view-styling/);
  } finally {
    cleanup(dir);
  }
});

test('override: structural Critical rule still enforced under styling override', () => {
  const dir = makeTempProject('override-structural', {
    'src/components/domain/Bad.tsx': `
import axios from 'axios';
export function Bad() {
  axios.get('/api');
  return null;
}
`,
  }, { overrides: { styling: 'mui' } });
  try {
    const r = spawnSync('node', [REVIEW_SCRIPT, 'full', '--no-coverage', '--project', dir], {
      encoding: 'utf8',
    });
    // styling override does NOT disable structural rules
    assert.match(r.stdout, /domain-no-direct-api/);
    assert.match(r.stdout, /Critical/);
    assert.equal(r.status, 1);
  } finally {
    cleanup(dir);
  }
});

test('no override: view-styling still fires (regression)', () => {
  const dir = makeTempProject('no-override-styling', {
    'src/components/view/Styled.tsx': `
import './Styled.scss';
export function Styled() { return <div className="card" />; }
`,
    'src/components/view/Styled.scss': `.card { padding: 16px; }`,
  });
  try {
    const r = spawnSync('node', [REVIEW_SCRIPT, 'full', '--no-coverage', '--project', dir], {
      encoding: 'utf8',
    });
    // without overrides, the styling rule must still be reported
    assert.match(r.stdout, /view-styling/);
  } finally {
    cleanup(dir);
  }
});
