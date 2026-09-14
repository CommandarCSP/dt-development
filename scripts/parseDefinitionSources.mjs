import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseLocator } from './parseSources.mjs';

// WHY: D12 역합치 — 정의서 없이 만든 standalone leaf 스펙을 입력으로 거두려면 발견이 필요.
// docs/specs/{pages,resources}/*/ 하위 디렉터리를 leaf 스펙으로 보고 role:'leaf-spec' 태그.
// definition.md는 {pages,resources} 밖이라 자연 제외(자기참조 루프 방지).
export function discoverLeafSpecs({ projectRoot }) {
  const found = [];
  for (const kind of ['pages', 'resources']) {
    const base = join(projectRoot, 'docs', 'specs', kind);
    if (!existsSync(base)) continue;
    for (const ent of readdirSync(base, { withFileTypes: true })) {
      if (ent.isDirectory()) {
        found.push({ type: 'markdown', locator: join(base, ent.name), role: 'leaf-spec' });
      }
    }
  }
  return found;
}

// WHY: 다중 스코프 — docs/specs/definition*.md를 스캔해 leaf §0의 단일/다중 판정 입력을 만든다.
// definition.md=scope:null(이름 없는 1번 스코프), definition.<slug>.md=scope:'<slug>'.
// definition.md.bak·readme.md 등 비대상은 슬러그 정규식이 자연 제외(.bak는 .md$ 불일치).
// WHY: 시그니처는 형제 함수 discoverLeafSpecs({ projectRoot })·checkDefinitionGate({ projectRoot })와
//      동일하게 destructured 객체 — 모듈 내 호출 컨벤션 일치(설계 doc의 positional 스케치를 정합 우선으로 정정).
export function discoverDefinitions({ projectRoot }) {
  const dir = join(projectRoot, 'docs', 'specs');
  if (!existsSync(dir)) return [];
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isFile()) continue;
    const name = ent.name;
    if (name === 'definition.md') {
      out.push({ scope: null, path: join(dir, name) });
      continue;
    }
    const m = name.match(/^definition\.([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)\.md$/);
    if (m) out.push({ scope: m[1], path: join(dir, name) });
  }
  // NOTE: 반환 순서는 readdirSync(파일시스템) 의존 — 호출부는 순서에 의존하지 말 것(집합으로 사용).
  return out;
}

// WHY: dt-spec(parseSources)는 figma design 1개만 허용하지만, 개발 정의서는 프로젝트 단위라
// 여러 figma 페이지/소스를 모두 받는다. parseLocator만 공유하고 cardinality 제약은 두지 않는다.
export function parseDefinitionSources(args) {
  const sources = [];
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (token === '--source') {
      if (i + 1 >= args.length) continue;
      sources.push(parseLocator(args[++i]));
    } else if (!token.startsWith('--')) {
      sources.push(parseLocator(token));
    }
  }
  if (sources.length === 0) {
    throw new Error('소스가 없습니다. figma 노드/페이지, .md/.pdf 경로, 또는 URL을 하나 이상 넣어주세요');
  }
  return { sources };
}
