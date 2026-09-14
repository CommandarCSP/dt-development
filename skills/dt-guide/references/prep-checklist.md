# 참조: 가이드 준비물 체크리스트 (코드에 없어 사람에게 묻는 것)

> 종류: **참조 문서(지식)** · 소비처: `guide-analyst`(찾기·빈칸 목록화), `dt-guide` 조율자(한 질문으로 묶어 묻기), `guide-author`(절에 배치).
> SOT: 본 문서. 스펙 §5-4. **성장형** — 새 프로젝트에서 반복해 묻게 되는 항목이 생기면 행을 더한다.

## 원칙

가이드에는 코드·문서에 없는 사실이 들어간다(문의처·요금·고지). 그것을 **처음부터 사람에게 묻지 말고**, 먼저 코드·문서에서 찾고, 못 찾은 것만 **한 질문으로 묶어** 묻는다. 무인 실행이면 조율자가 기본값을 넣고 `assumed`로 표시한다.

| 키 | 코드·문서에서 찾는 곳 | 못 찾으면 묻는 것 | 무인 기본값 | 가이드 절 |
|---|---|---|---|---|
| `audience` | README 대상 절, 제품 소개 문서 | 처음 쓰는 일반 사용자인가, 운영자인가 | "처음 쓰는 일반 사용자" | 1 |
| `systemRequirements` | `package.json engines`, electron-builder 타깃, `browserslist`, 배포 문서 | 지원 OS·브라우저·최소 버전 | web: "최신 크롬·엣지·사파리" / electron: builder 타깃 | 2 |
| `installAccess` | 배포 문서, 릴리스 URL, 앱 URL·env | 어디서 받거나 어디로 접속하나 | `null`(절에 "접속 주소는 운영자에게 확인" 문장) | 2 |
| `accountProvisioning` | 인증 코드, 가입·초대 화면 | 누가 계정을 만들어 주나, 초대 흐름 | 인증 없으면 "계정 없이 사용" / 있으면 `null` | 3 |
| `thirdPartyPrereqs` | OAuth 프로바이더, API 키 env(`.env.example`) | 사용자가 미리 가입·발급해야 하는 것 | 감지된 프로바이더 이름 목록 | 3 |
| `pricingNotice` | — | 유료 호출·쿼터가 있으면 고지 문구 | `null`(절 생략) | 3 |
| `dataNotice` | 저장 경로 코드, 텔레메트리·로그 전송 코드, 개인정보 문서 | 어디에 저장되고 무엇이 전송되는지 — **코드에서 전송이 보이면 빼면 안 된다** | 코드에서 본 사실만 서술 | 7 |
| `supportChannel` | README, `package.json bugs`, 사내 문서 | 이메일·채널·운영 시간 | `null`(절에 "문의처는 배포자가 안내" 문장) | 9 |
| `knownLimitations` | CHANGELOG, 이슈 언급, 코드 `TODO`/`FIXME`, 스펙의 비범위 | 이번 판에서 못 하는 것 | 코드·문서에서 본 것만 | 8·9 |
| `branding` | 로고 파일(`public/`·`build/icon*`), 제품명 | 표지 제품명·로고 사용 여부 | 제품명만, 로고 없음 | 표지 |
| `distribution` | 배포 문서 | PDF를 어디에 올릴지(릴리스·Confluence·앱 내) → `.dt-guide.json distribution` | `[]` | — |

찾은 값은 인벤토리 `prep` 아래에 그대로 넣는다. 못 찾고 묻지도 못한 칸은 `null`로 둔다 — 빈 칸과 `null`은 다르다. `null`은 "찾아봤고 없었다"는 기록이다.

## 묻는 방식

빈칸이 여럿이어도 **AskUserQuestion 한 번**(항목이 4개를 넘으면 두 번)에 묶는다. 질문 본문에 "이 답은 가이드 N절에 들어간다"를 적는다(`askquestion-principle.md`).
