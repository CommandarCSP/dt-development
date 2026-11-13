---
description: Run dt-frontend rule and coverage review against current project — bootstraps the stack config if missing, then shows the report verbatim
argument-hint: '[full|partial] [--base <ref>] [--paths file1,file2] [--verbose]'
allowed-tools: Read, Write, Bash, AskUserQuestion
---

dt-frontend-review 스킬의 "단독 실행 절차"를 따른다. 자세한 절차는 `skills/dt-frontend-review/SKILL.md` 참조.

Raw arguments: `$ARGUMENTS`

## 순서 (건너뛰지 않는다)
1. **스택 설정** — 프로젝트 루트에 `.dt-frontend.json`이 없으면 `${CLAUDE_PLUGIN_ROOT}/docs/refs/stack-config-bootstrap.md` 절차로 만든다(스택을 못 가리면 묻는다). 만들었으면 한 줄로 알린다.
2. **팀 설정** — `node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/config.mjs" .`의 `warnings`가 있으면 한 줄씩 보인다.
3. **실행**
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/dt-frontend-review/scripts/review.mjs" $ARGUMENTS
   ```
   - 모드가 없으면 `full`. `--base`가 없으면 `HEAD`(커밋 안 된 변경). Manual Review 휴리스틱은 룰별 개수로 요약되고, `--verbose`면 파일별로 펼친다.
4. **보고서를 그대로 보인다.** 요약하거나 고치지 않는다. 종료 코드 1이면 Critical이 있다(Ready to merge: No).
5. **후속 안내** — 보고서 뒤에 해당하는 것만 한 줄씩 덧붙인다. 자동으로 고치지 않는다.
   - `override-decision-ref`가 있으면: "`/dt-decision override <키>`로 규칙 끄기에 근거 결정을 단다(또는 override를 지운다)."
   - 1번에서 설정을 새로 만들었으면: "`.dt-frontend.json`의 `paths.src`가 맞는지 확인한다."
