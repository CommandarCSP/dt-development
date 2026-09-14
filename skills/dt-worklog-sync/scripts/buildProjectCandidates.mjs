import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// getVisibleJiraProjects 응답에서 프로젝트 값 배열을 정규화해 꺼낸다.
// 페이지네이션 병합 편의를 위해 세 형태를 모두 허용한다:
//   1) { values: [...] }            — 단일 페이지 응답
//   2) [ { values: [...] }, ... ]   — 페이지 응답들의 배열
//   3) [ {id,key,...}, ... ]        — 이미 평탄화한 프로젝트 배열
export function extractProjects(raw) {
  let values;
  if (Array.isArray(raw)) {
    // 첫 원소가 .values를 가지면 "페이지 응답들의 배열"로 본다.
    // 실제 Jira 프로젝트 객체에는 values 필드가 없어 평탄 배열과 충돌하지 않는다.
    if (raw.length > 0 && raw[0] && Array.isArray(raw[0].values)) {
      values = raw.flatMap((page) => page.values);
    } else {
      values = raw;
    }
  } else if (raw && Array.isArray(raw.values)) {
    values = raw.values;
  } else {
    throw new Error('인식할 수 없는 프로젝트 덤프 형식: values 배열을 찾지 못함');
  }
  return values.map((p) => ({
    id: p.id,
    key: p.key,
    name: p.name,
    category: p.projectCategory?.name ?? null,
  }));
}

// id는 Jira가 생성 순으로 순차 발급하는 문자열 숫자다.
// 숫자 내림차순 = 최근 생성순. 비숫자/동률은 key 오름차순으로 안정화.
export function sortByRecency(projects) {
  return [...projects].sort((a, b) => {
    const na = Number(a.id);
    const nb = Number(b.id);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return nb - na;
    return String(a.key).localeCompare(String(b.key));
  });
}

export function browseUrl(site, key) {
  return `https://${site}/browse/${key}`;
}

// 최근순 경량 마크다운 표(키·이름·URL). avatarUrls/issueTypes는 의도적으로 제외.
export function renderTable(projects, site) {
  const sorted = sortByRecency(projects);
  const header = '| 키 | 이름 | URL |\n|---|---|---|';
  const rows = sorted.map((p) => `| ${p.key} | ${p.name} | ${browseUrl(site, p.key)} |`);
  return [header, ...rows].join('\n');
}

// 사용자 입력(키 또는 브라우즈 URL)에서 프로젝트 키를 추출해 대문자로 정규화한다.
// "PROJ", " proj ", "https://x/browse/PROJ", "https://x/browse/PROJ?foo" → "PROJ".
// URL 패턴 [A-Za-z][A-Za-z0-9]+ 는 Jira 프로젝트 키 최소 2자 규칙을 전제로 한다.
export function parseKeyInput(input) {
  if (input == null) return '';
  const s = String(input).trim();
  const m = s.match(/\/browse\/([A-Za-z][A-Za-z0-9]+)/);
  const key = m ? m[1] : s;
  return key.toUpperCase();
}

// 입력 키가 조회 가능 목록에 존재하면 해당 프로젝트, 아니면 null.
export function validateKey(projects, input) {
  const key = parseKeyInput(input);
  return projects.find((p) => String(p.key).toUpperCase() === key) ?? null;
}

// 설정 객체 = example 템플릿에 defaultProjectKey/site/cloudId만 주입.
// issueTypeNames/transitionMap 등 나머지는 example 그대로 보존한다.
export function buildConfig(example, key, site, cloudId) {
  return { ...example, defaultProjectKey: key, site, cloudId };
}

// .gitignore 내용에 entry 줄을 멱등하게 보장한다.
// content가 null(파일 없음)이면 새로 만들고, 끝 개행을 보정하며, 이미 있으면 그대로 둔다.
export function ensureGitignoreEntry(content, entry) {
  const text = content ?? '';
  const present = text.split('\n').some((line) => line.trim() === entry);
  if (present) return text;
  if (text === '') return entry + '\n';
  const sep = text.endsWith('\n') ? '' : '\n';
  return text + sep + entry + '\n';
}

// CLI:
//   node buildProjectCandidates.mjs table    <dumpFile> <site>               → 최근순 표를 stdout
//   node buildProjectCandidates.mjs validate <dumpFile> <keyOrUrl>           → 존재 시 "KEY"+exit0, 없으면 exit1
//   node buildProjectCandidates.mjs setup    <dumpFile> <keyOrUrl> <site> <cloudId> [root]
//        → 키 검증 후 [root](기본 cwd)에 .dt-worklog.json / .dt-worklog.local.json 작성 + .gitignore 등록
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, dumpFile, ...rest] = process.argv.slice(2);
  try {
    if (!cmd || !dumpFile) {
      throw new Error('usage: buildProjectCandidates.mjs <table|validate|setup> <dumpFile> …');
    }
    const raw = JSON.parse(readFileSync(dumpFile, 'utf8'));
    const projects = extractProjects(raw);
    if (cmd === 'table') {
      const site = rest[0];
      if (!site) throw new Error('table 모드: site 인자가 필요합니다');
      process.stdout.write(renderTable(projects, site) + '\n');
    } else if (cmd === 'validate') {
      const input = rest[0];
      if (!input) throw new Error('validate 모드: keyOrUrl 인자가 필요합니다');
      const match = validateKey(projects, input);
      if (!match) {
        process.stderr.write(`키를 목록에서 찾지 못함: ${input}\n`);
        process.exit(1);
      }
      process.stdout.write(`${match.key}\n`);
    } else if (cmd === 'setup') {
      const [keyInput, site, cloudId, root] = rest;
      if (!keyInput?.trim() || !site || !cloudId) {
        throw new Error('setup 모드: <keyOrUrl> <site> <cloudId> 인자가 필요합니다');
      }
      const match = validateKey(projects, keyInput);
      if (!match) {
        process.stderr.write(`키를 목록에서 찾지 못함: ${keyInput}\n`);
        process.exit(1);
      }
      const targetRoot = root || process.cwd();
      // 쓰기 전에 읽기·계산을 모두 끝내 부분 쓰기(한 파일만 쓰이고 실패) 위험을 줄인다.
      const example = JSON.parse(
        readFileSync(new URL('../references/dt-worklog.example.json', import.meta.url), 'utf8')
      );
      const config = buildConfig(example, match.key, site, cloudId);
      const localPath = join(targetRoot, '.dt-worklog.local.json');
      const localExists = existsSync(localPath);
      const giPath = join(targetRoot, '.gitignore');
      const giNext = ensureGitignoreEntry(
        existsSync(giPath) ? readFileSync(giPath, 'utf8') : null,
        '.dt-worklog.local.json'
      );
      // .dt-worklog.json(팀 설정)은 위저드의 산출물 — (재)작성한다. .local(런타임 상태)만 보존.
      writeFileSync(join(targetRoot, '.dt-worklog.json'), JSON.stringify(config, null, 2) + '\n');
      if (!localExists) {
        writeFileSync(localPath, JSON.stringify({ lastSyncSha: null }, null, 2) + '\n');
      }
      writeFileSync(giPath, giNext);
      process.stdout.write(`✓ ${match.key} (${match.name}) 설정 완료 — .dt-worklog.json · .dt-worklog.local.json · .gitignore\n`);
    } else {
      throw new Error(`알 수 없는 명령: ${cmd}`);
    }
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
}
