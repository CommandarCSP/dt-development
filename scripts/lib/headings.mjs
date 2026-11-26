/**
 * 산출물 제목·라벨 레지스트리 — 스크립트가 **글자 그대로** 찾는 한글 제목과 상태 라벨을 한곳에 둔다.
 *
 * 왜 한곳인가: 같은 목록이 여러 스크립트에 복사돼 있으면 템플릿 제목을 하나 바꿀 때 한쪽만 고쳐져
 * 검사가 조용히 빈다(예: interactions 소유 절이 interactionsSync·planFreshness 두 곳에 있었다).
 * 템플릿 제목과 이 값이 같은지는 tests/headings.test.mjs 가 본다.
 *
 * 언어: 지금은 `ko` 하나다. 영어 산출물(GEN-15 보류)을 붙일 때는 같은 모양의 `en` 묶음을 더하고
 * 읽는 쪽이 `headingsFor(locale)` 로 고르게 한다 — 읽는 코드는 키 이름(`definition.sections.conventions`)만 안다.
 */

const ko = {
  /** docs/specs/definition.md — validateDefinition·definitionVersion */
  definition: {
    sections: { conventions: '전역 규약', scope: '범위 분담', interfaces: '인터페이스 합의', changes: '변경 추적' },
    /** IF 표 상태 칸. unresolved 가 하나라도 있으면 정의서는 draft 다. */
    states: { confirmed: '확정', convention: '컨벤션', negotiating: '협의중', unresolved: '미해소' },
  },
  /** docs/specs/{pages,resources}/<unit>/*.md 필수 절 — validateSpec. 키 = `<종류>:<스택>` */
  specSections: {
    'requirements:frontend': ['사용자 스토리', '기능 요구사항', '라우팅 / 네비게이션', '비기능 요구사항', '접근 권한'],
    'requirements:backend': ['사용자 스토리 / 시나리오', '기능 요구사항', '비기능 요구사항', '접근 권한 / 인증·인가', '데이터 명세'],
    'design:frontend': ['아키텍처', '데이터 모델 / API 계약', '컴포넌트 구조', '시퀀스', '요구사항 매핑'],
    'design:backend': ['아키텍처', '데이터 모델 / API 계약', '인덱스 & 페이지네이션 전략', '시퀀스', '요구사항 매핑'],
    'layout-skeleton:frontend': ['코딩 에이전트 변환 지침', '스켈레톤'],
    'api-contract:backend': ['엔드포인트'],
  },
  /** 있으면 좋은 절 — 없으면 경고만 */
  specRecommended: { 'api-contract:backend': ['스캐폴드 변환 지침', '요청/응답 스키마'] },
  /** docs/specs/interactions.md 소유 절 — interactionsSync·planFreshness·validateSpec */
  interactions: { frontend: 'FE 크로스페이지', backend: 'BE 크로스리소스' },
  /** docs/project-context.md — projectContextSync·materialize-tokens */
  projectContext: {
    overview: '개요',
    constraints: '제약사항',
    glossary: '도메인 용어',
    feStack: 'FE 기술 스택',
    feLibs: 'FE 프로젝트 기술/라이브러리',
    designTokens: '디자인 토큰',
    beStack: 'BE 기술 스택',
    beLibs: 'BE 프로젝트 기술/라이브러리',
    sharedConventions: '공유 규약',
    /** `## 디자인 토큰` 아래 `###` 하위 절 */
    tokenGroups: { colors: '색', typography: '타이포그래피', spacing: '간격', radius: 'radius' },
  },
  /** docs/decisions/*.md·docs/policies/*.md 필수 절 — decisions */
  decision: ['맥락', '결정', '이유', '버린 대안', '출처'],
  /** 트래커 마무리 댓글 줄 이름(TP-002 §4) — worklogConfig checkCloseComment */
  closeComment: { result: '결과', output: '산출물', decision: '결정 사항' },
  /** 요구사항의 AI 제안 API 표시 — parseSpecForScaffold */
  proposedMark: '[제안]',
};

export const HEADINGS = { ko };
export const DEFAULT_LOCALE = 'ko';

/** 언어별 묶음. 없는 언어는 ko — 영어 묶음이 생기기 전까지 산출물은 한글 제목이다. */
export const headingsFor = (locale = DEFAULT_LOCALE) => HEADINGS[locale] ?? HEADINGS[DEFAULT_LOCALE];

/** 지금 쓰는 묶음. */
export const H = headingsFor();
