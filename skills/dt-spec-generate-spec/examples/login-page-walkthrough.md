# LoginPage Walkthrough (dt-spec 실행 예시)

design doc 4-2 / 4-3 / 4-4의 LoginPage 예시를 GeneratePageDevSpec이 어떻게 생성하는지 단계별로 보여준다.

## 입력

```
/dt-spec 1:234 2:456 --api-doc docs/api/auth.yaml
```

## 워크플로 흐름

### [0] Pre-flight
- ✅ MCP 연결 OK
- ✅ pageNodeId=1:234 조회 OK
- ✅ uxWireframeNodeId=2:456 조회 OK

### [2] CollectProjectContext
- 기존 `docs/project-context.md` 있음 → 메모리 로드
- `package.json` mtime 변경 감지 → 기술 스택 강제 동기화

### [3] Analyze (병렬)

AnalyzeFigmaFrame 결과:
```
apiCandidates: [
  { featureName: 'emailLogin', kind: 'mutation', sourceUiElement: 'login_button', confidence: 'confident' }
]
semanticUIElements: [
  { role: 'form_field', sourceNodeId: 'email_input' },
  { role: 'form_field', sourceNodeId: 'password_input' },
  { role: 'submit_action', sourceNodeId: 'login_button' }
]
```

AnalyzeFigmaFrame 결과:
```
pageMeta: { purpose: '이메일 로그인', accessControl: 'guest_only' }
userStories: ['사용자로서, 이메일로 로그인하여 내 계정에 접근하고 싶다']
scenarios: [
  { name: '로그인 실패', steps: ['401 응답'], state: 'error' }
]
edgeCases: ['5회 실패 시 30분 잠금']
```

### [4] AskMissingRequirement

(a) AI 후보 검토:
```
✓ emailLogin [confident] → keep (ai-confirmed)
```

(c) 누락 카테고리 체크리스트:
```
☑ 페이지 진입 시 자동 호출 → user-added: csrfToken
```

### [5] EARS 형식 질문 (값 채우기)
```
"emailLogin 기능:
  WHEN 사용자가 login_button을 클릭하면
  THE SYSTEM SHALL [어떤 API 호출?]"
→ POST /api/auth/login, { email, password } → { token, user }
```

API 문서 매칭:
```
"docs/api/auth.yaml에서 POST /api/auth/login 발견. 적용할까요? (y/n/edit)"
→ y
```

### [6] 나머지 필드 보강
- validation: 이메일 RFC 5322
- errorHandling: 401 → 인라인 에러, 423 → 잠금 메시지

### [7] 산출물 빌드

[7-1] raw → EARS 변환:
- emailLogin → FR-2 Event-driven
- accessControl: guest_only → (별도 FR 생략, requirements.md "접근 권한" 섹션에 명시)
- 이메일 검증 → FR-1 Event-driven (emailLogin 후보의 validation에서 파생 — 1→N 전파)
- 401 응답 → FR-3 Unwanted (`IF 인증 정보가 잘못되면 THEN ...`)
- "실패 5회 이상" (edgeCases + 사용자 명시) → FR-4 State-driven (`WHILE 실패 시도가 5회 이상일 때 ...`). 사용자 상태 기반이라 State-driven 매핑.
- csrfToken (체크리스트) → FR-5 Event-driven (user-added, 페이지 마운트 시 자동 호출)

[7-2] 출처 라벨:
- FR-1, FR-2, FR-3 → ai-confirmed (emailLogin 후보에서 파생)
- FR-4 → user-added (edgeCases + 사용자 명시)
- FR-5 → user-added (체크리스트, 옵셔널 부연 추가)

[7-4] requirements.md 결과: design doc 4-2 그대로.

[7-5] 검증:
- ✅ 모든 FR 6패턴 중 하나로 분류됨
- ✅ EARS 키워드 일관
- ✅ Complex 자동 결합 없음
- ✅ FR-1 → Task 1, FR-2 → Task 2, ... 1:N 매핑

[7-6] status: finalized

[7-7] 파일 저장:
- `docs/specs/pages/login/requirements.md`
- `docs/specs/pages/login/design.md`
- `docs/specs/pages/login/tasks.md`
