/**
 * 산출물 형식 등록부 — 사용자 프로젝트에 남는 파일마다 위치·현재 형식 버전·버전 읽는 법·이전 함수를 둔다.
 * 정책(버전의 뜻·표시 규칙·읽기 호환)은 `docs/refs/compat-policy.md`. 점검·이전 CLI 는 `scripts/migrate.mjs`.
 *
 * 판정 결과(status)
 *   current   현재 형식
 *   migrate   옛 형식, 이전 함수가 있다(미리보기 → 확인 → 쓰기)
 *   manual    옛 형식, 이전 함수가 없다 — 읽기는 되고, 다음에 그 스킬이 다시 쓸 때 새 형식이 된다
 *   newer     플러그인보다 새 형식 — 쓰지 않는다(플러그인을 업데이트한다)
 *
 * 표시가 없는 파일은 깨뜨리지 않는다: 옛 구조 특징이 있으면 옛 버전, 없으면 현재 버전으로 본다.
 */
import { parseSpecHeader } from './buildSpecHeader.mjs';
import { SPEC_VERSION as DEFINITION_VERSION } from './buildDefinitionHeader.mjs';
import { legacyPlan, migrateLegacy as migrateProjectContext } from './projectContextSync.mjs';
import { detectLegacy as interactionsLegacy, migrateLegacy as migrateInteractions } from './interactionsSync.mjs';

const MARKER_RE = /<!--\s*dt-schema:\s*([a-z-]+)@(\d+)\s*-->/;

/** md 의 `<!-- dt-schema: 종류@N -->`. 없으면 null. */
export function readMarker(md) {
  const m = md.match(MARKER_RE);
  return m ? { kind: m[1], version: Number(m[2]) } : null;
}

/** 표시를 붙이거나 바꾼다. 앞머리 주석 블록 끝(없으면 맨 위, 머리말 `---` 뒤)에 둔다. */
export function setMarker(md, kind, version) {
  const line = `<!-- dt-schema: ${kind}@${version} -->`;
  if (MARKER_RE.test(md)) return md.replace(MARKER_RE, line);
  let head = 0;
  if (md.startsWith('---\n')) head = md.indexOf('\n---\n', 4) + 5;
  const rest = md.slice(head);
  const lead = rest.match(/^(?:<!--[^]*?-->\s*\n)*/)[0];
  return md.slice(0, head) + lead + line + '\n' + rest.slice(lead.length);
}

const cmp = (a, b) => {
  const x = String(a).split('.').map(Number); const y = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
};
const judge = (version, current, { migratable = false } = {}) =>
  cmp(version, current) === 0 ? 'current' : cmp(version, current) > 0 ? 'newer' : migratable ? 'migrate' : 'manual';

/** md 종류 하나 — 표시가 있으면 그것, 없으면 legacy(md) 가 참이면 1, 아니면 current. */
function markedMd(kind, current, { legacy = () => false, migrate = null, note } = {}) {
  return {
    kind, current, format: 'md',
    detect(md, opts) {
      const mk = readMarker(md);
      const version = mk ? mk.version : legacy(md, opts) ? current - 1 : current;
      return { version, marked: Boolean(mk), status: judge(version, current, { migratable: Boolean(migrate) }), note: !mk && version < current ? note : null };
    },
    migrate: migrate && ((md, opts) => {
      const r = migrate(md, opts);
      return r.blocked ? r : { ...r, md: setMarker(r.md, kind, current) };
    }),
  };
}

export const SCHEMAS = [
  {
    kind: 'spec', current: '1.1', format: 'md',
    match: (p) => /docs\/specs\/(pages|resources)\/[^/]+\/(requirements|design|tasks|layout-skeleton|api-contract)\.md$/.test(p),
    detect(md) {
      const h = parseSpecHeader(md);
      if (!h) return { version: null, marked: false, status: 'manual', note: '머리 주석이 없다(손으로 쓴 스펙) — 형식 검사가 경고만 낸다. 다음에 스펙 스킬로 다시 쓰면 머리가 붙는다' };
      const version = h.specVersion ?? '1.0';
      return { version, marked: true, status: judge(version, this.current), note: cmp(version, this.current) < 0 ? '옛 형식 — 형식 검사가 오류를 경고로 낮춘다. 다음에 스펙 스킬로 다시 쓰면 새 형식이 된다' : null };
    },
  },
  {
    kind: 'definition', current: DEFINITION_VERSION, format: 'md',
    match: (p) => /docs\/specs\/definition(\.[\w-]+)?\.md$/.test(p),
    detect(md) {
      const v = md.match(/<!--\s*specVersion:\s*([\d.]+)\s*-->/)?.[1] ?? null;
      if (!v) return { version: null, marked: false, status: 'manual', note: '머리 주석이 없다(손으로 쓴 정의서) — /dt-devspec 이 정규화를 제안한다' };
      return { version: v, marked: true, status: judge(v, this.current), note: cmp(v, this.current) < 0 ? '옛 형식 — /dt-devspec 재생성 때 새 형식이 된다' : null };
    },
  },
  {
    ...markedMd('project-context', 2, {
      legacy: (md, opts) => Boolean(legacyPlan(md, opts)),
      migrate: (md, opts) => {
        const r = migrateProjectContext(md, opts);
        if (r.needsResolve) return { blocked: 'resolve', plan: r.plan, message: '플러그인 절과 겹치는 절이 있다 — --resolve drop|keep' };
        if (r.needsStack) return { blocked: 'stack', plan: r.plan, message: '스택을 짐작하지 못했다 — --stack frontend|backend' };
        return { md: r.md, plan: r.plan };
      },
      note: '플러그인 형식이 아니다(옛 단일 템플릿·플러그인 밖 문서) — 스펙 작성의 merge 가 멈춘다',
    }),
    match: (p) => /docs\/project-context\.md$/.test(p),
  },
  {
    ...markedMd('interactions', 2, {
      legacy: (md) => Boolean(interactionsLegacy(md)),
      migrate: (md) => ({ md: migrateInteractions(md).md }),
      note: '절 구분 전 형식 — 소유 밖 절을 FE 절 아래로 모은다',
    }),
    match: (p) => /docs\/specs\/interactions\.md$/.test(p),
  },
  { ...markedMd('plan', 1), match: (p) => /docs\/specs\/(pages|resources)\/[^/]+\/plan\.md$/.test(p) },
  { ...markedMd('e2e-ledger', 1), match: (p) => /\.e2e-scenarios\.md$/.test(p) || /docs\/specs\/e2e\/(be-)?journeys\.md$/.test(p) },
  { ...markedMd('decision', 1), match: (p) => /docs\/decisions\/PD-\d+[^/]*\.md$/.test(p) },
  {
    kind: 'config', current: 1, format: 'json',
    match: (p) => /(^|\/)\.dt(-frontend|-backend)?\.json$/.test(p),
    detect(text) {
      let v = null;
      try { v = JSON.parse(text).$schemaVersion ?? null; } catch { return { version: null, marked: false, status: 'manual', note: 'JSON 을 읽지 못했다' }; }
      const version = v ?? this.current;
      return { version, marked: v != null, status: judge(version, this.current), note: null };
    },
  },
];

export const schemaFor = (path) => SCHEMAS.find((s) => s.match(path.replace(/\\/g, '/'))) ?? null;
