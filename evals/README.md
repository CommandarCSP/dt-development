# 스킬 동작 평가 (evals)

스킬 본문을 고친 뒤에도 그 스킬을 **실제로 돌렸을 때** 결과물이 제대로 나오는지 본다. `npm test`는 파일 모양·스크립트만 보고 스킬을 돌리지 않는다 — 이 평가가 그 빈칸을 메운다. 형식은 Claude Code 내장 `claude plugin eval`(공식 문서: code.claude.com/docs/en/plugin-evals.md).

## 평가 목록

| case | 스킬 | 예제 프로젝트 | 무엇을 보나 |
|---|---|---|---|
| `fe-spec-login` | dt-spec | React + 로그인 화면 요구사항 | 스펙 4개, `specVersion: 1.1`, FR 형식, 라우팅, 형식 검사 오류 0, 에러 문구를 지어내지 않음(llm 1개) |
| `be-spec-comments` | dt-be-spec | NestJS·Prisma + comments OpenAPI | 스펙 4개, 엔드포인트 4개, 403, 형식 검사 오류 0 |
| `review-bootstrap` | dt-review | 스택 설정 없는 React + 위반 파일 | 설정 부트스트랩, 리뷰 스크립트 실행, 위반 ruleId, 보고서 원문 |
| `migrate-preview` | dt-migrate | 플러그인 밖 형식 project-context | 기본은 미리보기 — 확인 없이 파일을 고치지 않음 |

- 예제 프로젝트는 각 case의 `scaffold.sh`가 빈 작업 폴더에 만든다(`--scaffold`일 때만 돈다).
- 실행 중에는 사람에게 물을 수 없다. 각 `prompt.md`의 `append_system_prompt`가 "고르는 질문은 권장안으로 진행하고 가정으로 보고, 파일을 고치기 전 승인 단계는 승인 안 된 것으로 본다"를 정한다 — 원칙 P2(되묻기 대신 가정 보고)와 "확인 없이 쓰지 않기"를 함께 본다.
- 채점은 결정적 채점기(`file_exists`·`regex`·`tool_used`)가 기본이다. 우리 검사기(`validateSpec.mjs`)는 채점기로 못 돌리므로 프롬프트가 결과를 `eval-validate.json`에 쓰게 하고 그 파일을 채점한다(공식 우회법).

## 돌리는 법

실행마다 실제로 스킬을 끝까지 돌리므로 비용이 든다. **CI에는 넣지 않는다** — 스킬을 크게 고쳤을 때와 릴리즈 전에 손으로 돌린다.

```bash
# 평소(빠르게): 각 1회, 플러그인 없는 비교 없이
claude plugin eval . --runs 1 --ablation none --scaffold --trust-plugin \
  --allow-tools Bash Write Edit --no-publish --max-cost-usd 15

# 한 case만
claude plugin eval . --case review-bootstrap --runs 1 --ablation none --scaffold --trust-plugin --allow-tools Bash Write Edit --no-publish

# 릴리즈 전: 기본 3회 + 플러그인 없는 비교(Δ). 모델을 고정한다(모델 변경을 플러그인 퇴보로 착각하지 않게)
claude plugin eval . --scaffold --trust-plugin --allow-tools Bash Write Edit --model <모델 id> --judge-model <모델 id> --max-cost-usd 60
```

- 여러 case를 고를 때 `--case`를 여러 번 주면 **마지막 것만** 돈다 — 태그로 고른다(`--tag spec`).
- `--scaffold`·`--trust-plugin`은 이 저장소가 쓴 평가에만 준다(스크립트가 사용자 권한으로 돈다).
- 결과는 `evals/results/`(git 무시). 실패하면 `--keep-temp`로 작업 폴더와 `trace.jsonl`을 남겨 본다.

## 평가를 더할 때

1. `evals/<case>/`에 `prompt.md`(머리말: `description`·`tags`·`runs`·`max_turns`·`timeout_seconds`·`allowed_tools`·`append_system_prompt`)와 `graders/*.md`를 둔다. 예제 파일이 필요하면 `case.yaml`의 `context.scaffold_script`.
2. 결과물 하나에 채점기 하나 + 과정(어느 스킬·명령을 썼나 `tool_used`) 하나. 긴 파일은 `regex`로, `llm`은 짧은 판정에만.
3. 한 번 돌려 채점기가 맞게 가르는지 본다 — 처음 돌리면 대개 예제·채점기 쪽 실수가 먼저 나온다.
4. 구조 테스트(`tests/evals.test.mjs`)가 머리말 키·채점기 type·scaffold 파일을 검사한다(돌리지는 않는다).

## 처음 돌렸을 때 찾은 것 (GEN-28, 2026-11-16)

결과: 4건 모두 1.00(각 1회, 플러그인 없는 비교 없음). 비용 — fe-spec-login $2.05(5분), be-spec-comments $1.03(2.5분), review-bootstrap $0.30, migrate-preview $0.22.


- **dt-migrate가 물을 수 없을 때 확인 없이 `--write`로 썼다** → 스킬에 "물을 수 없는 실행이면 쓰지 않고 미리보기로 끝낸다"를 넣었다.
- **리뷰 full 모드가 git을 못 쓰면 0개 파일을 검사하고 "위반 없음 · Ready to merge: Yes"를 냈다**(평가 격리 환경에서 실제로 일어남) → git 실패 시 폴더를 훑고, 새 파일(untracked)도 보고, 검사 파일 수를 보고서에 적고, 0개면 `Unknown`. 스킬 문서의 "기본 범위 = 커밋 안 된 변경"도 코드와 달라 "프로젝트 전체"로 고쳤다.
