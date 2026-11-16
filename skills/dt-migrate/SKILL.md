---
name: dt-migrate
description: Check a project's dt artifacts (specs, definition, project-context, interactions, plans, e2e ledgers, decisions, .dt*.json) against the plugin's current formats after a plugin update, and migrate the ones that have a migrator — preview first, write only on approval. Use after updating the plugin, when a skill reports an old-format artifact, when CHANGELOG lists an artifact format change, or via /dt-migrate. Never changes content a person wrote; asks when there is a choice.
user-invocable: false
---

# dt-migrate — 산출물 형식 점검·이전

플러그인을 올린 뒤, 프로젝트에 이미 있는 dt 산출물이 지금 형식과 맞는지 한 번에 보고, 옮길 수 있는 것은 옮긴다. 정책(버전의 뜻·읽기 호환)은 `${CLAUDE_PLUGIN_ROOT}/docs/refs/compat-policy.md`, 무엇을 어떻게 판정하는지는 `${CLAUDE_PLUGIN_ROOT}/scripts/artifactSchemas.mjs`.

## 단계
1. **점검(미리보기).** `node "${CLAUDE_PLUGIN_ROOT}/scripts/migrate.mjs" <projectRoot>`. 결과를 그대로 보인다 — 산출물별 `옮김`(이전 도구 있음)·`손으로`(이전 도구 없음 — 다음에 그 스킬이 다시 쓸 때 새 형식이 된다)·`더 새것`(플러그인보다 새 형식).
   - `더 새것`이 있으면 멈추고 "플러그인을 업데이트한 뒤 다시 돌린다"를 권한다. 다른 사람이 새 플러그인으로 쓴 파일이다 — 옛 플러그인으로 덮으면 내용이 빠질 수 있다. <!-- hard-stop: 플러그인보다 새 형식을 옛 플러그인으로 쓰면 손실 — 업데이트 안내 -->
   - 볼 것이 없으면 "할 일 없음"으로 끝낸다.
2. **고를 것 묻기.** `고를 것`으로 나온 파일은 한 번에 묻는다(원칙 6).
   - project-context의 겹치는 절 — "옛 절 지우기(`--resolve drop`) / `옛 기록 — `으로 남기기(`--resolve keep`, 권장)". 판단에 쓰도록 `node "${CLAUDE_PLUGIN_ROOT}/scripts/projectContextSync.mjs" migrate --file docs/project-context.md --root .` 미리보기(옮김·겹침·코드에 없는 기술)를 함께 보인다.
   - 스택을 짐작하지 못함 — "FE / BE".
3. **쓰기.** 확인받은 뒤 `node "${CLAUDE_PLUGIN_ROOT}/scripts/migrate.mjs" <projectRoot> --write [--resolve …] [--stack …]`. 이전은 제목·형식 표시만 바꾸고 내용은 그대로 둔다.
4. **다시 점검.** 1단계를 한 번 더 돌려 `옮김`이 0인지 보인다(두 번 돌려도 같아야 한다). `손으로`가 남으면 각각 어떤 스킬을 다시 돌리면 되는지 한 줄씩 적는다(스펙 → `/dt-spec`·`/dt-be-spec`, 정의서 → `/dt-devspec`).
5. **보고.** 옮긴 파일, 남은 것, 커밋 제안(`chore: dt 산출물 형식 이전`). 커밋은 하지 않는다.

## 안 하는 것
- 사람 확인 없이 쓰기 · 사람이 쓴 내용 지우기(겹치는 절은 묻는다) · 이전 도구가 없는 파일을 손으로 고쳐 쓰기 · 플러그인보다 새 형식을 덮기.
