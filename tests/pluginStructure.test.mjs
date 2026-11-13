// 플러그인 구조 검사 — 스킬·에이전트·명령의 머리말, 이름, 내부 경로·문서 링크, README 개수.
// 이 플러그인의 대부분은 코드가 아니라 문서라, 문서가 깨지는 것은 단위 테스트가 못 잡는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const rel = (p) => join(ROOT, p);

/** 맨 앞 `---` 블록의 `key: value` 한 줄짜리 필드만 읽는다(여러 줄 값은 첫 줄만 — 존재 확인용). */
export function readFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

const skillDirs = readdirSync(rel('skills'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
const agentFiles = readdirSync(rel('agents')).filter((f) => f.endsWith('.md'));
const commandFiles = readdirSync(rel('commands')).filter((f) => f.endsWith('.md'));

test('스킬: SKILL.md 가 있고 name = 폴더명, description 이 있다', () => {
  const problems = [];
  for (const d of skillDirs) {
    const p = rel(`skills/${d}/SKILL.md`);
    if (!existsSync(p)) { problems.push(`${d}: SKILL.md 없음`); continue; }
    const fm = readFrontmatter(readFileSync(p, 'utf8'));
    if (!fm) { problems.push(`${d}: 머리말 없음`); continue; }
    if (fm.name !== d) problems.push(`${d}: name="${fm.name}" (폴더명과 다름)`);
    if (!fm.description) problems.push(`${d}: description 없음`);
  }
  assert.deepEqual(problems, []);
});

test('에이전트: name = 파일명, description 이 있다', () => {
  const problems = [];
  for (const f of agentFiles) {
    const fm = readFrontmatter(readFileSync(rel(`agents/${f}`), 'utf8'));
    if (!fm) { problems.push(`${f}: 머리말 없음`); continue; }
    if (fm.name !== basename(f, '.md')) problems.push(`${f}: name="${fm.name}" (파일명과 다름)`);
    if (!fm.description) problems.push(`${f}: description 없음`);
  }
  assert.deepEqual(problems, []);
});

test('명령: description 이 있다', () => {
  const problems = [];
  for (const f of commandFiles) {
    const fm = readFrontmatter(readFileSync(rel(`commands/${f}`), 'utf8'));
    if (!fm) problems.push(`${f}: 머리말 없음`);
    else if (!fm.description) problems.push(`${f}: description 없음`);
  }
  assert.deepEqual(problems, []);
});

/** 검사 대상: 플러그인이 런타임에 읽는 텍스트(스킬·에이전트·명령·훅·스크립트·템플릿·런타임 문서). 설계 이력(docs/specs)은 제외. */
function runtimeFiles() {
  const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: ROOT, encoding: 'utf8' });
  return out.split('\0').filter(Boolean).filter((f) =>
    /^(skills|agents|commands|hooks|scripts|templates|templates-backend|docs\/refs)\//.test(f) || /^docs\/[^/]+\.md$/.test(f) || f === 'README.md',
  ).filter((f) => !/\/tests\/fixtures\//.test(f) && /\.(md|mjs|json|tmpl|ya?ml|html)$/.test(f));
}

/** 자리표(<x>·{x}·*·…)가 든 경로는 실제 파일이 아니다. */
const isPlaceholder = (p) => /[<>{}*…]|\.\.\./.test(p);

test('${CLAUDE_PLUGIN_ROOT}/… 경로가 실제로 있다', () => {
  const missing = [];
  for (const f of runtimeFiles()) {
    const text = readFileSync(rel(f), 'utf8');
    for (const m of text.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([A-Za-z0-9._\/<>{}*-]+)/g)) {
      const p = m[1].replace(/[.,:;)]+$/, '');
      if (isPlaceholder(p)) continue;
      if (!existsSync(rel(p))) missing.push(`${f} → ${p}`);
    }
  }
  assert.deepEqual([...new Set(missing)], []);
});

// 플러그인 자기 문서만 본다. docs/specs/pages/… · docs/project-context.md 같은 건 스킬이 사용자 프로젝트에 만드는 산출물이다.
const PLUGIN_DOC_RE = /\bdocs\/(refs\/[A-Za-z0-9._\/-]+\.md|specs\/20\d\d-\d\d-\d\d-[A-Za-z0-9._-]+\.md|[A-Za-z0-9._-]+\.md)/g;
const CONSUMER_DOCS = new Set(['docs/project-context.md']);

test('플러그인 내부 문서 링크(docs/refs · docs/specs/<날짜>-… · docs/*.md)가 실제로 있다', () => {
  const missing = [];
  for (const f of runtimeFiles()) {
    const text = readFileSync(rel(f), 'utf8');
    for (const m of text.matchAll(PLUGIN_DOC_RE)) {
      const p = m[0];
      if (CONSUMER_DOCS.has(p) || isPlaceholder(p)) continue;
      if (!existsSync(rel(p)) || !statSync(rel(p)).isFile()) missing.push(`${f} → ${p}`);
    }
  }
  assert.deepEqual([...new Set(missing)], []);
});

test('README 의 스킬·에이전트·명령 개수가 실제와 같다', () => {
  const readme = readFileSync(rel('README.md'), 'utf8');
  const m = readme.match(/스킬 (\d+)개 · 에이전트 (\d+)개 · 커맨드 (\d+)개/);
  assert.ok(m, 'README 에 "스킬 N개 · 에이전트 N개 · 커맨드 N개" 문장이 있어야 한다');
  assert.deepEqual(
    { skills: Number(m[1]), agents: Number(m[2]), commands: Number(m[3]) },
    { skills: skillDirs.length, agents: agentFiles.length, commands: commandFiles.length },
  );
});

// 에이전트 반환 봉투 — docs/orchestration-policy.md 원칙 5·6. 에이전트를 새로 넣으면 아래 두 목록 중 하나에 넣는다.
const WORKER_AGENTS = ['definition-author', 'spec-author', 'bespec-author', 'plan-author', 'fe-builder', 'be-builder', 'guide-analyst', 'guide-author', 'handbook-analyst', 'handbook-tracer', 'handbook-author', 'e2e-author'];
const JUDGE_AGENTS = ['reviewer', 'ko-writing-reviewer', 'auditor'];

/** "## 핸드오프" 또는 "## 반환" 으로 시작하는 절 본문. */
function returnSection(text) {
  const m = text.match(/\n## (?:핸드오프|반환)[^\n]*\n([\s\S]*?)(?=\n## |\s*$)/);
  return m ? m[0] : null;
}

test('에이전트: 모든 에이전트가 작업형·판정형 중 하나로 분류돼 있다', () => {
  const known = new Set([...WORKER_AGENTS, ...JUDGE_AGENTS]);
  const actual = agentFiles.map((f) => basename(f, '.md'));
  assert.deepEqual(actual.filter((a) => !known.has(a)), [], '새 에이전트는 WORKER_AGENTS 또는 JUDGE_AGENTS 에 넣는다');
  assert.deepEqual([...known].filter((a) => !actual.includes(a)), [], '목록에 있는데 파일이 없다');
});

test('작업형 에이전트: 반환 절이 프로토콜을 가리키고 공통 필드(status·artifacts·needsDecision·summary)를 담는다', () => {
  const problems = [];
  for (const a of WORKER_AGENTS) {
    const sec = returnSection(readFileSync(rel(`agents/${a}.md`), 'utf8'));
    if (!sec) { problems.push(`${a}: "## 핸드오프|## 반환" 절 없음`); continue; }
    if (!/orchestration-policy\.md/.test(sec) || !/원칙 5/.test(sec)) problems.push(`${a}: 반환 절이 orchestration-policy.md 원칙 5를 가리키지 않음`);
    for (const field of ['status', 'artifacts', 'needsDecision', 'summary']) {
      if (!new RegExp(`\\b${field}\\b`).test(sec)) problems.push(`${a}: 반환 절에 ${field} 없음`);
    }
    if (!/done \| draft \| blocked/.test(sec)) problems.push(`${a}: status 값이 done | draft | blocked 가 아님`);
  }
  assert.deepEqual(problems, []);
});

// 스펙·정의서·플랜 작성 에이전트는 빈틈 스윕을 하고, 가정한 자리를 assumptions 로 돌려준다(docs/refs/askquestion-principle.md).
const SPEC_AUTHORS = ['definition-author', 'spec-author', 'bespec-author', 'plan-author'];

test('스펙 작성 에이전트: 빈틈 스윕 게이트가 있고 반환에 assumptions 를 담는다', () => {
  const problems = [];
  for (const a of SPEC_AUTHORS) {
    const text = readFileSync(rel(`agents/${a}.md`), 'utf8');
    if (!/빈틈 스윕/.test(text) || !/askquestion-principle\.md/.test(text)) problems.push(`${a}: 빈틈 스윕 게이트(askquestion-principle.md)가 없음`);
    const sec = returnSection(text) ?? '';
    if (!/assumptions: \[\{ id, what, why, reflectsTo \}\]/.test(sec)) problems.push(`${a}: 반환 절에 assumptions: [{ id, what, why, reflectsTo }] 없음`);
  }
  assert.deepEqual(problems, []);
});

test('판정형 에이전트: 반환이 프로토콜을 가리키고 verdict·findings·summary 를 담는다', () => {
  const problems = [];
  for (const a of JUDGE_AGENTS) {
    const text = readFileSync(rel(`agents/${a}.md`), 'utf8');
    if (!/orchestration-policy\.md/.test(text) || !/원칙 5/.test(text)) { problems.push(`${a}: orchestration-policy.md 원칙 5를 가리키지 않음`); continue; }
    // auditor 는 반환 계약을 finding-schema.md 에 둔다.
    const contract = a === 'auditor' ? readFileSync(rel('skills/dt-audit/references/finding-schema.md'), 'utf8') : returnSection(text) ?? '';
    for (const field of ['verdict', 'findings', 'summary']) {
      if (!new RegExp(`\\b${field}\\b`).test(contract)) problems.push(`${a}: 반환 계약에 ${field} 없음`);
    }
  }
  assert.deepEqual(problems, []);
});

test('needsDecision 항목 형식: 에이전트 문서에 적힌 항목 모양이 { id, topic, question, options:[{label,description}], recommended, … } 이다', () => {
  const problems = [];
  for (const f of agentFiles) {
    const text = readFileSync(rel(`agents/${f}`), 'utf8');
    for (const m of text.matchAll(/needsDecision: \[\{([^\n]*)/g)) {   // 항목 모양은 한 줄에 적는다 — 줄 끝까지 본다
      const body = m[1];
      for (const key of ['id', 'topic', 'question', 'options', 'recommended', 'evidence', 'reflectsTo']) {
        if (!new RegExp(`\\b${key}\\b`).test(body)) problems.push(`${f}: needsDecision 항목에 ${key} 없음 → "${m[0].slice(0, 60)}…"`);
      }
    }
    if (/\(기본값\)/.test(text)) problems.push(`${f}: 권장 선택지를 label "(기본값)" 대신 recommended 로 적는다`);
  }
  assert.deepEqual(problems, []);
});

// 서브에이전트는 다른 서브에이전트를 부를 수 없다(docs/orchestration-policy.md 원칙 3). 작업형 에이전트 문서에
// "X를 dispatch" 지시가 다시 들어오면 실행되지 않는 절차가 생긴다. 부정문("dispatch하지 않는다")은 허용.
const AGENT_NAMES = [...WORKER_AGENTS, ...JUDGE_AGENTS].join('|');
const NESTED_DISPATCH_RE = new RegExp(`\\b(?:${AGENT_NAMES})\\b(?:\\.md)?\`?\\)?\\s*(?:를|을)?\\s*(?:\\([^)]*\\)\\s*)?(?:로\\s*)?(?:재)?dispatch(?!하지 않)`);

test('작업형 에이전트: 다른 에이전트를 dispatch 하라는 지시가 없다(리뷰·수리 루프는 조율자 몫)', () => {
  const problems = [];
  for (const a of WORKER_AGENTS) {
    readFileSync(rel(`agents/${a}.md`), 'utf8').split('\n').forEach((line, i) => {
      if (/조율자가|조율자는|조율자\)/.test(line)) return;   // 조율자가 하는 일을 설명하는 줄
      if (NESTED_DISPATCH_RE.test(line)) problems.push(`${a}.md:${i + 1}: ${line.trim().slice(0, 80)}`);
    });
  }
  assert.deepEqual(problems, []);
});

test('스캐폴드 체크리스트: reviewer dispatch 는 조율자가 하는 것으로 적혀 있다', () => {
  const problems = [];
  for (const f of ['dt-frontend-scaffold/checklist/new-domain.md', 'dt-frontend-scaffold/checklist/extend-domain.md',
                   'dt-backend-scaffold/checklist/new-module.md', 'dt-backend-scaffold/checklist/extend-module.md']) {
    readFileSync(rel(`skills/${f}`), 'utf8').split('\n').forEach((line, i) => {
      if (/reviewer(?:\.md)?`?.*dispatch/.test(line) && !/조율자/.test(line)) problems.push(`${f}:${i + 1}: ${line.trim().slice(0, 80)}`);
    });
  }
  assert.deepEqual(problems, []);
});

// 공통 설정 — docs/refs/config-schema.md 의 키 표와 로더(DEFAULTS·HOOK_DEFAULTS)가 같고, 키마다 실제로 읽는 곳이 있다.
test('설정 스키마: 문서의 키 표 = 로더의 키, 그리고 키마다 읽는 곳이 그 키를 언급한다', async () => {
  const { DEFAULTS, HOOK_DEFAULTS } = await import('../scripts/lib/config.mjs');
  const flat = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${prefix}${k}.`) : [`${prefix}${k}`]);
  const loaderKeys = [...flat(DEFAULTS).filter((k) => k !== 'hooks'), ...Object.keys(HOOK_DEFAULTS).map((k) => `hooks.${k}`)].sort();

  const doc = readFileSync(rel('docs/refs/config-schema.md'), 'utf8');
  const rows = [...doc.matchAll(/^\| `([a-zA-Z.]+)` \|[^\n]*\| `([^`]+)` \|$/gm)].map((m) => ({ key: m[1], reader: m[2] }));
  assert.deepEqual(rows.map((r) => r.key).sort(), loaderKeys, '문서 표의 키와 로더 키가 다르다');

  const problems = [];
  for (const { key, reader } of rows) {
    if (!existsSync(rel(reader))) { problems.push(`${key}: 읽는 곳 ${reader} 이 없다`); continue; }
    const text = readFileSync(rel(reader), 'utf8');
    const needle = reader.endsWith('.mjs') ? key.split('.').pop() : key.replace(/\.(planner|builder|reviewer)$/, '');
    if (!text.includes(needle)) problems.push(`${key}: ${reader} 가 "${needle}" 을 언급하지 않는다`);
  }
  assert.deepEqual(problems, []);
});

test('readFrontmatter: 머리말이 없으면 null, 있으면 한 줄 필드를 읽는다', () => {
  assert.equal(readFrontmatter('# 제목'), null);
  assert.deepEqual(readFrontmatter('---\nname: a\ndescription: b c\n---\n본문'), { name: 'a', description: 'b c' });
});

// 결정 기록(원칙 9) — 스펙·플랜 작성 에이전트는 채택된 PD·TP(decisions)를 고정 입력으로 받는다.
test('스펙 작성 에이전트: 입력에 decisions(채택된 PD·TP)가 있고 원칙 9를 가리킨다', () => {
  const problems = [];
  for (const a of ['definition-author', 'spec-author', 'bespec-author', 'plan-author']) {
    const text = readFileSync(rel(`agents/${a}.md`), 'utf8');
    const input = text.match(/\n## 읽기[^\n]*\n([\s\S]*?)(?=\n## )/)?.[1] ?? '';
    if (!/`decisions`/.test(input) || !/원칙 9/.test(input)) problems.push(`${a}: 읽기 절에 decisions(원칙 9)가 없다`);
  }
  assert.deepEqual(problems, []);
});

// 명령은 스킬 절차의 입구다. 스크립트만 부르고 스킬을 건너뛰면 설정 부트스트랩 같은 절차가 조용히 빠진다(GEN-33).
test('명령: 모두 실제 스킬을 가리키고, 도구를 스크립트 실행 하나로 묶지 않는다', () => {
  const problems = [];
  const skills = new Set(skillDirs);
  for (const f of commandFiles) {
    const text = readFileSync(rel(`commands/${f}`), 'utf8');
    const refs = [...text.matchAll(/skills\/(dt-[a-z0-9-]+)\/SKILL\.md|`?(dt-[a-z0-9-]+)`? 스킬/g)].map((m) => m[1] ?? m[2]);
    if (!refs.some((r) => skills.has(r))) problems.push(`${f}: 따를 스킬(skills/<이름>/SKILL.md 또는 "<이름> 스킬")을 가리키지 않는다`);
    const tools = readFrontmatter(text)?.['allowed-tools'] ?? '';
    if (/^Bash\([^)]*\)$/.test(tools.trim())) problems.push(`${f}: allowed-tools 가 "${tools}" 뿐 — 스킬 절차(파일 읽기·쓰기·질문)를 못 한다`);
  }
  assert.deepEqual(problems, []);
});

// 원칙 10 — 막혔을 때 안내 한 줄 + 중단으로 끝내지 않는다. 멈추는 줄은 선택지(AskUserQuestion·needsDecision)를 내거나
// `<!-- hard-stop: 사유 -->` 로 의도된 멈춤임을 밝힌다.
const STOP_RE = /\+ 중단|미산출 종료|[으이]?면 중단|안내 후 종료|\+ 종료/;
const STOP_OK_RE = /AskUserQuestion|needsDecision|hard-stop:|원칙 10/;

test('하드 스톱: 스킬·에이전트·명령의 멈춤 줄은 선택지를 내거나 hard-stop 사유를 단다', () => {
  const files = [
    ...skillDirs.flatMap((d) => [`skills/${d}/SKILL.md`, ...(existsSync(rel(`skills/${d}/references`)) ? readdirSync(rel(`skills/${d}/references`)).filter((f) => f.endsWith('.md')).map((f) => `skills/${d}/references/${f}`) : [])]),
    ...agentFiles.map((f) => `agents/${f}`),
    ...commandFiles.map((f) => `commands/${f}`),
  ].filter((f) => existsSync(rel(f)));
  const problems = [];
  for (const f of files) {
    readFileSync(rel(f), 'utf8').split('\n').forEach((line, i) => {
      if (STOP_RE.test(line) && !STOP_OK_RE.test(line)) problems.push(`${f}:${i + 1}: ${line.trim().slice(0, 90)}`);
    });
  }
  assert.deepEqual(problems, []);
});

// GEN-31 — 코드를 만들거나 테스트를 돌리는 스킬은 시작 전에 스택 사전 점검을 하고, 빌더는 스택 결정을 따른다.
test('스택 사전 점검: 구현·스캐폴드·e2e·fullstack 스킬이 절차를 가리키고, 빌더가 스택 결정을 우선한다', () => {
  const problems = [];
  for (const s of ['dt-implement', 'dt-be-implement', 'dt-frontend-scaffold', 'dt-backend-scaffold', 'dt-e2e', 'dt-be-e2e', 'dt-fullstack']) {
    if (!readFileSync(rel(`skills/${s}/SKILL.md`), 'utf8').includes('docs/refs/stack-precheck.md')) problems.push(`${s}: stack-precheck.md 를 가리키지 않는다`);
  }
  for (const b of ['fe-builder', 'be-builder']) {
    const text = readFileSync(rel(`agents/${b}.md`), 'utf8');
    if (!/topic: stack\.\*/.test(text) || !/`decisions`/.test(text)) problems.push(`${b}: 스택 결정(decisions · topic: stack.*)을 읽지 않는다`);
  }
  assert.deepEqual(problems, []);
});

// GEN-38 — 산출물 계약(docs/refs/artifact-contract.md): 쓰는 쪽이 하나이고, 문서가 그 사실과 맞는다.
function contractRows() {
  const doc = readFileSync(rel('docs/refs/artifact-contract.md'), 'utf8');
  const rows = [];
  for (const line of doc.split('\n')) {
    if (!/^\| `/.test(line)) continue;
    const cells = line.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim().replace(/\\\|/g, '|'));
    const ticks = (c) => [...c.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    rows.push({ paths: ticks(cells[0]), sections: ticks(cells[1]), owners: ticks(cells[2]) });
  }
  return rows;
}
const ownerFile = (name) => (name.endsWith('.md') ? name : existsSync(rel(`agents/${name}.md`)) ? `agents/${name}.md` : `skills/${name}/SKILL.md`);

test('산출물 계약: 쓰는 쪽 문서가 그 경로(절이면 절 이름)를 적었고, 같은 경로·절의 쓰는 쪽은 한 줄뿐이다', () => {
  const rows = contractRows();
  assert.ok(rows.length >= 20, `계약 표 행이 너무 적다(${rows.length})`);
  const problems = [];
  const seen = new Map();
  for (const r of rows) {
    for (const o of r.owners) {
      const f = ownerFile(o);
      if (!existsSync(rel(f))) { problems.push(`쓰는 쪽 ${o} 의 문서가 없다`); continue; }
      const text = readFileSync(rel(f), 'utf8');
      const needles = r.sections.length ? r.sections.map((s) => s.replace(/^## /, '')) : r.paths;
      for (const n of needles) if (!text.includes(n)) problems.push(`${o}: "${n}" 을 적지 않았다`);
    }
    for (const p of r.paths) for (const s of r.sections.length ? r.sections : ['']) {
      const k = `${p}#${s}`;
      if (seen.has(k)) problems.push(`${k} 의 쓰는 쪽이 두 줄에 있다`);
      seen.set(k, r.owners);
    }
  }
  assert.deepEqual(problems, []);
});

test('산출물 계약: 에이전트의 "소유 경로" 절에 적힌 경로는 표에서 그 에이전트 몫이다', () => {
  const rows = contractRows();
  const problems = [];
  for (const f of agentFiles) {
    const name = basename(f, '.md');
    const sec = readFileSync(rel(`agents/${f}`), 'utf8').match(/\n## 소유 경로[^\n]*\n([\s\S]*?)(?=\n## )/)?.[1];
    if (!sec) continue;
    // 각 줄 맨 앞(목록 표시 뒤)의 경로들만 소유 경로로 본다 — 설명 문장 속 명령·참조 문서는 제외.
    const declared = sec.split('\n').flatMap((line) => {
      const head = line.match(/^(?:- )?((?:`[^`\n]+`(?:\s*(?:\+|·|,)\s*)?)+)/);
      return head ? [...head[1].matchAll(/`([^`\n]*\/[^`\n]*)`/g)].map((m) => [null, m[1]]) : [];
    });
    for (const [, p] of declared) {
      const row = rows.find((r) => r.paths.includes(p));
      if (!row) problems.push(`${name}: 소유 경로 ${p} 가 계약 표에 없다`);
      else if (!row.owners.includes(name) && !rows.some((r) => r.paths.includes(p) && r.owners.includes(name))) problems.push(`${name}: ${p} 는 표에서 ${row.owners.join('·')} 몫이다`);
    }
  }
  assert.deepEqual(problems, []);
});

// GEN-39 — 판정 에이전트는 쓰기 도구가 없고, 페이지 조립은 조율자가 아니라 fe-builder(assemble)가 한다.
test('판정 에이전트: tools 허용 목록에 Write·Edit 가 없다 (auditor 는 브라우저 MCP 때문에 예외 — 사유를 머리말에 적는다)', () => {
  const problems = [];
  for (const a of JUDGE_AGENTS) {
    const text = readFileSync(rel(`agents/${a}.md`), 'utf8');
    const tools = readFrontmatter(text)?.tools;
    if (a === 'auditor') { if (tools || !/# tools 허용 목록을 두지 않는다/.test(text)) problems.push('auditor: 예외 사유 주석이 없거나 tools 가 있다'); continue; }
    if (!tools) problems.push(`${a}: tools 허용 목록이 없다`);
    else if (/\b(Write|Edit|NotebookEdit)\b/.test(tools)) problems.push(`${a}: tools 에 쓰기 도구가 있다(${tools})`);
  }
  assert.deepEqual(problems, []);
});

test('dt-implement: 페이지 조립을 fe-builder variant: assemble 로 맡기고, fe-builder 가 그 절차를 갖는다', () => {
  const impl = readFileSync(rel('skills/dt-implement/SKILL.md'), 'utf8');
  const sec5 = impl.match(/### \[5\][^\n]*\n([\s\S]*?)(?=\n### )/)?.[0] ?? '';
  assert.match(sec5, /variant: assemble/);
  assert.match(readFileSync(rel('agents/fe-builder.md'), 'utf8'), /## 조립 \(`variant: assemble`/);
});

test('e2e 스킬: e2e-author 에 무거운 일을 맡기고 사람 검증은 조율자에 남긴다', () => {
  for (const s of ['dt-e2e', 'dt-be-e2e']) {
    const t = readFileSync(rel(`skills/${s}/SKILL.md`), 'utf8');
    assert.match(t, /agents\/e2e-author\.md/, `${s}: e2e-author 를 가리키지 않는다`);
    assert.match(t, /사람 검증/, `${s}: 사람 검증 주체가 없다`);
  }
});

// GEN-37 — dt-fullstack 단계표: 이름 있는 단계, 실제 스킬, 플랜 경로는 계약 표와 같고, 별도 리뷰 단계가 없다.
test('dt-fullstack: 단계표의 스킬이 실제로 있고, 플랜 경로가 계약과 같고, 별도 리뷰 단계가 없다', () => {
  const text = readFileSync(rel('skills/dt-fullstack/SKILL.md'), 'utf8');
  const rows = [...text.matchAll(/^\| `([a-z0-9-]+)` \| [^|]+ \| ([^|]+) \|/gm)].map((m) => ({ stage: m[1], skills: [...m[2].matchAll(/`(dt-[a-z0-9-]+)`/g)].map((x) => x[1]) }));
  const stages = rows.map((r) => r.stage);
  assert.deepEqual(stages, ['definition', 'be-spec', 'be-build', 'fe-spec', 'fe-build', 'e2e', 'audit', 'guide', 'handbook', 'wrap']);
  const missing = rows.flatMap((r) => r.skills).filter((s) => !skillDirs.includes(s));
  assert.deepEqual(missing, [], '단계표의 스킬이 없다');
  assert.ok(!stages.includes('review'), '리뷰는 build 단계 안에 있다 — 별도 단계를 두지 않는다');
  assert.ok(text.includes('docs/specs/<pages|resources>/<unit>/plan.md'), '플랜 경로가 계약 표(artifact-contract.md)와 다르다');
  const cmd = readFileSync(rel('commands/dt-fullstack.md'), 'utf8');
  for (const s of stages) assert.ok(cmd.includes(`\`${s}\``), `명령 파일에 단계 ${s} 가 없다`);
});

// GEN-22 — 산출물을 쓰는 에이전트는 형식 검사기를 게이트로 돌리고, 스펙 확정 단계가 그 결과를 막는 조건으로 쓴다.
test('형식 검사: 작성 에이전트 4개와 스펙 확정 단계가 validateSpec.mjs 를 부른다', () => {
  const problems = [];
  for (const a of ['spec-author', 'bespec-author', 'plan-author', 'e2e-author']) {
    if (!readFileSync(rel(`agents/${a}.md`), 'utf8').includes('scripts/validateSpec.mjs')) problems.push(`${a}: validateSpec.mjs 게이트가 없다`);
  }
  for (const s of ['dt-spec-generate-spec', 'dt-bespec-generate-spec']) {
    if (!readFileSync(rel(`skills/${s}/SKILL.md`), 'utf8').includes('scripts/validateSpec.mjs')) problems.push(`${s}: 확정 전 형식 검사가 없다`);
  }
  assert.deepEqual(problems, []);
});

// GEN-23 — 검출이 빈 규칙은 "검사하는 척"한다. 기계 검출이 없으면 type: manual 로 명시한다.
test('리뷰 규칙: 검출이 빈 규칙이 없다(기계 검출 또는 manual)', async () => {
  const { loadAllRules } = await import('../skills/dt-frontend-review/scripts/lib/rule-loader.mjs');
  const { resolveStack } = await import('../skills/dt-frontend-review/scripts/lib/stacks.mjs');
  const KNOWN = new Set(['forbidden-import', 'forbidden-call', 'forbidden-pattern', 'requires-sibling-test', 'required-pattern', 'requires-acceptance-ledger', 'ast-rule', 'pattern-pair', 'jsx-tag-attrs', 'registered-in-sibling-module', 'manual']);
  const problems = [];
  for (const st of ['frontend', 'backend']) {
    for (const r of await loadAllRules(ROOT, resolveStack(st).ruleLocations)) {
      if (!r.detection?.length) problems.push(`${st}:${r.ruleId}: detection 이 비었다 — 구현하거나 type: manual`);
      for (const d of r.detection ?? []) if (!KNOWN.has(d.type)) problems.push(`${st}:${r.ruleId}: 모르는 detection 타입 ${d.type}`);
    }
  }
  assert.deepEqual(problems, []);
});
