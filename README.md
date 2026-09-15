# dt-development

기획부터 코드, 리뷰, 마무리(문서·이슈 정리)까지 — 웹 서비스 개발의 한 흐름 전체를 정해진 방식대로 자동화하는 Claude Code 플러그인입니다.

프론트엔드(React 5계층)와 백엔드(NestJS 계층형) 양쪽에서, 코드를 만들 때마다 정해진 아키텍처를 따르고 자동으로 검증되도록 설계했습니다. 사람이 매번 규칙을 기억하지 않아도 늘 같은 구조·같은 품질로 결과물이 나오는 것이 목표입니다.

---

## 설치

Claude Code 세션 안에서 다음 두 명령을 입력합니다(터미널이 아닙니다).

```
/plugin marketplace add CommandarCSP/dt-development
/plugin install dt-development@dt-development
```

---

## 무엇이 들어 있나

스킬 35개 · 에이전트 11개 · 커맨드 19개로 이루어져 있습니다. 갈래로 묶으면 다음과 같습니다.

| 갈래 | 하는 일 | 대표 커맨드 |
|---|---|---|
| 정의서 | 프로젝트 합의서(FE/BE 범위 분담 + 인터페이스 계약)를 먼저 만든다 | `/dt-devspec` |
| FE 스펙 생성 | Figma·문서 등 여러 소스를 분석해 화면 단위 SDD 명세를 만든다 | `/dt-spec` |
| BE 스펙 생성 | OpenAPI·ERD·문서를 분석해 리소스 단위 SDD 명세 + API 계약을 만든다 | `/dt-be-spec` |
| 스캐폴드·구현 | 확정된 스펙을 5계층(FE)·계층형(BE) 코드로 만든다 | `/dt-implement` · `/dt-scaffold` · `/dt-be-implement` · `/dt-be-scaffold` |
| 리뷰 | 아키텍처 규칙 위반과 테스트 커버리지를 기계적으로 검사한다 | `/dt-review` · `/dt-be-review` |
| 풀스택 조율 | 정의서 → BE → FE → 리뷰까지 한 번에 이어 실행한다 | `dt-fullstack` (전용 슬래시 커맨드 없음 — 스킬을 직접 불러 실행) |
| 감사 | 스펙과 실제 구현이 어긋난 곳(드리프트)을 찾는다 | `/dt-audit` |
| 가이드 PDF | 프로젝트를 분석해 사용자 가이드 PDF를 만든다 | `/dt-guide` |
| 인수인계 핸드북 | 이미 있는 코드를 분석해 신규 개발자용 핸드북 PDF를 만든다. 데이터 주인·군집·경계를 먼저 세우고 시나리오 호출 사슬을 얹는다 | `/dt-handbook` |
| 한국어 문장 검사 | 기계 검사 + 격리 리뷰로 어색한 문장을 고친다 | `/dt-ko` |
| Jira 연동 | 개발 작업을 Jira Sub-task로 정리·동기화한다 | `/dt-worklog` |
| Confluence 연동 | 작업을 Confluence 문서(회의록·요약·기술문서·릴리즈노트)로 쓴다 | `/dt-confluence` |
| 마무리 | 브랜치 통합, 커밋→문서화 판단→Jira 동기화 순서 안내 | `/dt-git` · `/dt-wrap` |

---

## 설정 — 회사·프로젝트 값은 어디에 넣나

스킬 안에 값을 적어 넣는 게 아니라, **여러분 프로젝트 루트의 설정 파일**에 넣습니다. 대부분은 위저드가 대신 만들어 줍니다.

| 파일 | 무엇 | 만들어지는 방법 |
|---|---|---|
| `.dt-worklog.json` / `.dt-worklog.local.json` | Jira 연동(프로젝트 키 등) | 최초 실행 위저드가 자동으로 진입해 만든다 |
| `.dt-confluence.json` / `.dt-confluence.local.json` | Confluence 연동 | 최초 실행 위저드가 자동으로 진입해 만든다 |
| `.dt-guide.json` | 가이드 PDF 설정 | 없으면 기본 템플릿으로 자동 생성 |
| `.dt-handbook.json` | 인수인계 핸드북 설정 | 없으면 기본 템플릿으로 자동 생성 |
| `.dt-pipeline.json` | 세션 알림 훅 사용 여부(opt-in) | `/dt-wrap --init` |
| `.dt-frontend.json` / `.dt-backend.json` | FE/BE 아키텍처 규칙 | 스킬이 필요할 때 없으면 만든다 |

읽는 순서는 **개인(`.local.json`) > 팀(`.json`) > 대화형 질문**입니다. `.local.json`은 커밋하지 않는 개인 값(예: 마지막으로 동기화를 마친 커밋 위치)이라 각자 `.gitignore`에 등록합니다.

Jira 연동 위저드는 cloudId·site를 `getAccessibleAtlassianResources`로 자동 확인합니다. 사람이 고르는 것은 프로젝트 키 하나뿐이고, cloudId 같은 UUID를 손으로 찾아 넣을 일은 없습니다.

---

## 이미 있는 프로젝트에 얹을 때

아무것도 준비하지 않아도 됩니다. `.dt-frontend.json`·`.dt-backend.json`이 없으면 **스킬이 필요한 시점에 만들고 하던 일을 계속합니다.**

무엇을 보고 정하는지는 이렇습니다.

- 스택 — `package.json`의 의존성. `react`·`vite`·`next`가 보이면 프론트엔드, `@nestjs/core`가 보이면 백엔드. 둘 다면 둘 다 만듭니다
- 소스 경로 — `src/`가 있으면 `src`

**묻지 않고 만들지만, 무엇을 어떻게 정했는지는 알려 줍니다.** 모노레포처럼 소스가 `packages/web/src`에 있는 프로젝트라면 감지가 틀릴 수 있습니다. 그때는 만들어진 파일의 `paths.src`를 고치면 됩니다.

아는 의존성이 하나도 없으면 만들지 않습니다. 어느 스택인지 모르는 채로 만들면 맞지 않는 규칙이 켜진 상태로 검사가 돌기 때문입니다. 이때는 그 사실을 알리고 멈춥니다.

절차의 자세한 규칙은 [`docs/refs/stack-config-bootstrap.md`](./docs/refs/stack-config-bootstrap.md)에 있습니다.

---

## 설계 메모

**왜 얇은 에이전트인가.** 서브에이전트(`agents/`)는 절차를 자기 안에 베껴 넣지 않고, 실행 시점에 `${CLAUDE_PLUGIN_ROOT}` 아래 문서(스킬 본문, `docs/refs/`의 참조 문서)를 직접 읽습니다. 규칙을 두 곳에 나눠 적으면 한쪽만 고치고 다른 쪽을 잊는 일이 생기기 때문에, 절차의 단일 진실 원천(SOT)을 하나로 유지하는 쪽을 택했습니다.

**왜 규칙을 `docs/refs/`에 모아 두는가.** 한국어 문장 규칙(`readable-writing.md`), EARS 명세 패턴(`ears-patterns.md`) 같은 판정 기준은 여러 스킬이 함께 참조합니다. 스킬마다 복사해 두면 버전이 어긋나므로, 참조 문서를 한곳에 두고 스킬은 그 경로만 가리키게 했습니다.

---

## 한 줄 밝히기

사내 저장소에서 다듬어 온 것을 공개판으로 분리했습니다. 업무 규칙(Jira·Confluence 연동)은 특정 조직의 운영 방식을 따른 것이라, 쓰는 곳에 맞춰 고쳐야 합니다.

---

## 개발

```bash
npm test
```

스킬·룰·스크립트는 모두 텍스트와 작은 `.mjs` 헬퍼로 이루어져 있어, 빌드(코드를 실행 가능한 형태로 미리 묶어 두는 과정) 없이 Node만으로 테스트가 돌아갑니다.

---

## 라이선스

MIT — [LICENSE](./LICENSE) 참고.
