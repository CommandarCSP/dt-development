# Integration Walkthrough

자동 테스트가 어려운 흐름(Figma MCP + askQuestion)을 수동으로 검증.

## 환경

- 별도 테스트 프로젝트 (예: `~/projects/sample-app`)
- dt-spec 플러그인 로드 완료
- Figma MCP 연결 + LoginPage용 디자인/와이어프레임 node id 확보

## 시나리오 1: 신규 페이지 (LoginPage)

### 전제
- `docs/project-context.md` 없음
- `docs/specs/pages/login/` 없음

### 실행
```
/dt-spec <login-page-node-id> <login-wireframe-node-id>
```

### 기대 결과

체크리스트:
- [ ] Pre-flight Check 통과 (MCP 연결/node 조회)
- [ ] CollectProjectContext가 4개 askQuestion 수행 (개요/제약/도메인용어)
- [ ] `package.json`이 파싱되어 기술 스택이 자동 채워짐
- [ ] `docs/project-context.md` 생성됨 (메타 헤더 포함)
- [ ] AnalyzeFigmaFrame이 emailLogin 후보를 confident로 추출
- [ ] AnalyzeFigmaFrame이 pageMeta.accessControl='guest_only' 등 추출
- [ ] AskMissingRequirement가 후보 검토 + 누락 체크리스트 (6항목) 질문
- [ ] EARS 형식 askQuestion으로 method/endpoint/schema 받음
- [ ] `docs/specs/pages/login/requirements.md` 생성 — FR마다 출처 라벨 + 패턴 라벨
- [ ] `docs/specs/pages/login/design.md` 생성 — projectContext.techStack 반영
- [ ] `docs/specs/pages/login/tasks.md` 생성 — 각 Task가 FR과 매핑
- [ ] 헤더 메타: status=finalized

### 검증 명령

```bash
# 헤더 형식 검증
node -e '
import("./scripts/buildSpecHeader.mjs").then(async ({ parseSpecHeader }) => {
  const { readFile } = await import("node:fs/promises");
  const md = await readFile("<test-project>/docs/specs/pages/login/requirements.md", "utf8");
  const parsed = parseSpecHeader(md);
  console.log(parsed);
  if (!parsed) process.exit(1);
  if (parsed.status !== "finalized") process.exit(1);
})
'
```

## 시나리오 2: 재실행 (package.json만 변경)

### 전제
- 시나리오 1 완료 상태
- `package.json`에 새 의존성 추가 (예: `axios` → `tailwindcss` 등)

### 실행
```
/dt-spec <login-page-node-id> <login-wireframe-node-id>
```

### 기대
- [ ] `docs/project-context.md`의 기술 스택 섹션만 자동 갱신 (강제, MVP 정책)
- [ ] askQuestion 출처 섹션(개요/제약/도메인용어)은 보존
- [ ] `lastSyncedAt` / `packageJsonMtime` 메타 갱신
- [ ] `docs/specs/pages/login/`은 diff 표시 후 사용자 confirm (자동 덮어쓰기 X)

## 시나리오 3: Pre-flight 실패

### 전제
- Figma MCP 연결 끊김 또는 잘못된 page node id

### 실행
```
/dt-spec 9999:9999 9999:9999
```

### 기대
- [ ] 명확한 에러 메시지 + 자가 진단 안내 (`/mcp` 안내 등)
- [ ] 산출물 생성되지 않음 (워크플로 [0] 중단 — draft 케이스 아님)

## 시나리오 4: askQuestion 중단 (draft 상태)

### 전제
- 시나리오 1 진행 중 [5] 또는 [6] askQuestion에서 Ctrl+C

### 기대
- [ ] 부분 저장됨
- [ ] 산출물 헤더 메타: `status: draft`
- [ ] 다른 도구가 이를 보고 경고 가능

## 통과 기준

4개 시나리오 모두 체크리스트 통과 시 통합 검증 완료.
