/**
 * 프로젝트에 어느 스택 설정(`.dt-frontend.json` · `.dt-backend.json`)을 만들지 정한다.
 *
 * **디스크를 보지 않는다.** 호출부가 `package.json` 을 읽어 객체로 넘기고, 소스 경로도
 * 호출부가 찾아 넘긴다. 그래야 픽스처 객체만으로 테스트할 수 있다 —
 * `scripts/parseSources.mjs` 와 같은 방침이다.
 *
 * 절차 전체(언제 부르고, 만든 뒤 무엇을 보고하는지)는
 * `docs/refs/stack-config-bootstrap.md` 가 단일 출처다.
 */

/** 이 의존성이 보이면 그 스택으로 본다. 이름만 보고 버전은 보지 않는다. */
const STACK_MARKERS = {
  frontend: ['react', 'react-dom', 'next', 'vite'],
  backend: ['@nestjs/core', '@nestjs/common'],
};

/** 스택별로 켜는 스킬. 스캐폴드가 새 프로젝트에 넣던 것과 같은 집합이다. */
const STACK_SKILLS = {
  frontend: [
    'dt-frontend-architecture',
    'dt-frontend-testing',
    'dt-frontend-review',
    'dt-frontend-coding-discipline',
  ],
  backend: [
    'dt-backend-architecture',
    'dt-backend-testing',
    'dt-backend-review',
    'dt-backend-coding-discipline',
  ],
};

/**
 * `package.json` 내용으로 스택을 가린다.
 *
 * 모르면 **빈 배열**을 돌려준다. 던지지 않는다 — 감지 실패는 오류가 아니라 "모른다" 이고,
 * 호출부는 그때 설정을 만들지 않으면 그만이다. 억지로 하나를 고르면 엉뚱한 규칙이
 * 켜진 채로 리뷰가 돈다.
 *
 * 순서는 `frontend` → `backend` 로 고정한다. 모노레포 루트처럼 둘 다 잡히는 경우에
 * 결과가 실행마다 달라지면 테스트도 사람도 헷갈린다.
 *
 * @param {object|null|undefined} pkg `package.json` 을 파싱한 객체
 * @returns {('frontend'|'backend')[]}
 */
export function detectStacks(pkg) {
  if (!pkg || typeof pkg !== 'object') return [];
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  return ['frontend', 'backend'].filter((stack) =>
    STACK_MARKERS[stack].some((name) => name in deps),
  );
}

/**
 * 한 스택의 설정 객체를 만든다.
 *
 * 코드가 실제로 읽는 키는 `coverage` 와 `overrides` 뿐이지만
 * (`skills/dt-frontend-review/scripts/lib/overrides.mjs`, `modes/full.mjs`),
 * `paths` 와 `enabledSkills` 는 스킬 문서가 읽는 값이라 함께 넣는다.
 *
 * `coverage.mode` 기본값은 `full` — 스캐폴드가 새 프로젝트에 넣던 값과 맞춘다.
 * 새로 얹은 프로젝트만 다른 기준으로 검사되면 같은 플러그인이 두 결과를 낸다.
 *
 * @param {'frontend'|'backend'} stack
 * @param {{ srcPath: string }} opts `srcPath` 는 호출부가 찾아 넘긴다(모노레포면 `packages/web/src` 같은 값)
 */
export function buildStackConfig(stack, { srcPath }) {
  const skills = STACK_SKILLS[stack];
  if (!skills) {
    throw new Error(
      `unknown stack '${stack}' (expected one of: ${Object.keys(STACK_SKILLS).join(', ')})`,
    );
  }
  return {
    paths: { src: srcPath },
    coverage: { mode: 'full', baselineRef: 'HEAD' },
    enabledSkills: [...skills],
    overrides: {},
  };
}

/** 스택 → 설정 파일 이름. `skills/dt-frontend-review/scripts/lib/stacks.mjs` 와 같은 값이다. */
export const CONFIG_FILE_NAME = {
  frontend: '.dt-frontend.json',
  backend: '.dt-backend.json',
};
