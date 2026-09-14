import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SPEC_VERSION } from './buildDefinitionHeader.mjs';
import { validateDefinition, cmpVersion } from './validateDefinition.mjs';

// WHY: 소프트 게이트 — 정의서 상태를 판정(kind)만 낸다. 수락/거절·standalone·스텁은
// leaf §0이 이 판정 위에서 사용자에게 묻고 분기한 결과라 게이트 반환에 넣지 않는다.
// 분기 입력은 kind+structureOk+specVersion(valid는 corrupt 탐지 의미로만 간접 사용).
// WHY: scope(옵셔널) — 다중 스코프. 있으면 definition.<scope>.md, 없으면 definition.md.
// (모듈 최상단 고정 상수 → 함수 내부 동적 계산으로 이동: scope 분기 전제.)
export function checkDefinitionGate({ projectRoot, scope }) {
  const relpath = scope
    ? join('docs', 'specs', `definition.${scope}.md`)
    : join('docs', 'specs', 'definition.md');
  const path = join(projectRoot, relpath);
  if (!existsSync(path)) {
    return { kind: 'none' };
  }
  const md = readFileSync(path, 'utf8');
  const v = validateDefinition(md);

  // structureOk:false 분기 — generated면 깨짐(corrupt), 손작성이면 정규화 라우팅
  if (!v.structureOk) {
    return v.kind === 'generated' ? { kind: 'corrupt' } : { kind: 'needsNormalization', path };
  }

  // structureOk:true 분기 — 버전 비교
  if (v.specVersion != null && cmpVersion(v.specVersion, SPEC_VERSION) > 0) {
    return { kind: 'versionTooHigh' };
  }
  // 하한: sub-1.0은 이 플러그인이 못 읽는 버전 → 업그레이드/재생성 라우팅(설계 §8 종료상태 책무)
  if (v.specVersion != null && cmpVersion(v.specVersion, '1.0') < 0) {
    return { kind: 'versionTooHigh' };
  }
  const isOldGenerated =
    (v.specVersion != null && cmpVersion(v.specVersion, SPEC_VERSION) < 0) ||
    (v.kind === 'generated' && v.specVersion == null);

  return {
    kind: 'consume',
    authorKind: v.kind,
    ...(isOldGenerated ? { migrate: 'in-memory' } : {}),
    status: v.status,
    path,
    definitionVersion: v.definitionVersion
  };
}
