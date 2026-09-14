# dt-audit 드리프트 판정 절차 (git 축)

diff만으로는 "원래부터 미구현(missing)"과 "스펙이 나중에 바뀌었는데 코드 미반영(drift)"을
구분할 수 없다. 구분 근거는 git 이력이다. auditor 워커가 검사 단위별로 수행한다.

## 판정 절차

1. **스펙 측 시점**: 검사 단위가 속한 스펙 섹션의 마지막 수정 커밋을 확보.
   - 행 범위를 알면: `git log -L <start>,<end>:<spec파일> --format="%H %aI" -1`
   - 아니면 파일 단위 폴백: `git log -1 --format="%H %aI" -- <spec파일>`
2. **코드 측 시점**: code-scope map의 파일들에 대해 `git log -1 --format="%aI" -- <파일들>`.
3. **판정**: 스펙 변경이 코드 변경보다 **나중**이고, 스펙 변경 이후 해당 코드 파일들에
   커밋이 없으면(`git log <스펙커밋>..HEAD -- <파일들>` 이 비면) → 해당 finding의 gapType을
   `drift`로 승격. evidence에 스펙 커밋 sha + 그 구간 스펙 diff 요약(무엇이 바뀌었는지 1~2문장)을 담는다.
4. **정의서 체인**: 기준 스펙의 `basedOnDefinition@vN` 마커가 stale(정의서 currentVersion > N)이면
   기준 스펙 자체가 낡은 것 — findings에 확정 판정 대신 stale 플래그를 병기하고
   `staleSpecs`로 반환한다(조율자가 "정의서→스펙→코드" 2단 체인으로 승격 보고).

## 폴백

- git 이력이 없거나 얕으면(shallow clone) drift 축은 skip — `checked.skipped`에 사유를 남기고
  리포트 헤더에 "드리프트 감사 미수행" 명시. missing/mismatch 판정은 그대로 유효.
- 스펙과 코드가 다른 레포(크로스루트)면 각자 레포에서 시점을 얻어 비교한다(symlink 정의서 케이스).

## 주의

- drift 판정에는 **git 근거(커밋 sha) 필수** — 근거를 못 만들면 drift가 아니라 mismatch/missing으로 둔다.
- 커밋 시점 비교는 author date(`%aI`) 기준. 리베이스로 순서가 꼬인 흔적이 보이면 confidence를 🟡로 낮춘다.
