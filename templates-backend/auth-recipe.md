# 캐논 auth 레시피 (인증 발급 기본값)

> dt-bespec `[7-3]` 인증 발급 도출이 **원천이 발급에 침묵 + 발급 트리거=Y**일 때 instantiate하는 캐논.
> 이 레시피는 인증의 **"Case 2 기본값"** — 원천(OpenAPI security scheme·ERD)이 인증을 명시하면 그것을 우선하고 이 레시피는 비켜선다(소스-퍼스트).
> instantiate 결과는 일반 리소스와 동일하게 `docs/specs/resources/auth/`의 4종 산출물(requirements/design/tasks/api-contract)로 작성된다. 엔진(scaffold)은 auth를 특수 취급하지 않는다 — 일반 5-layer로 생성.

## 캐논 패러다임 — Passport + JWT

| 관심사 | 구현 |
|---|---|
| access 검증 | `JwtStrategy`(passport-jwt) + `AuthGuard('jwt')` |
| refresh 검증 | `RefreshTokenStrategy` + `AuthGuard('jwt-refresh')` |
| 로그인 자격 확인 | service에서 `bcrypt.compare` (단발이라 `LocalStrategy` 생략 — 필요 시 택1) |
| 토큰 서명 | `JwtService.sign` (access 단기 + refresh 장기). **refresh 페이로드엔 고유 `jti`(예: `randomUUID()`) 필수** |
| refresh 저장 | DB에 **해시 저장 + 로테이션** (사용 시 기존 revoke + 신규 발급, 재사용 감지) |
| 시크릿 | `ConfigModule` → `JwtModule.registerAsync`(secret from `ConfigService`) |

## 엔드포인트 (→ api-contract.md `{{ENDPOINT_TABLE}}`)

| Method | Path | Auth | Request | Response | Status |
|---|---|---|---|---|---|
| POST | /auth/register | public | `{ username, email, name, password }` | `{ id, username, email, name }` | 201, 409 |
| POST | /auth/login | public | `{ username, password }` | `{ accessToken, refreshToken }` | 200, 401 |
| POST | /auth/refresh | refresh token | `{ refreshToken }` | `{ accessToken, refreshToken }` | 200, 401 |

- `register`: `bcrypt.hash(password)` → User 생성. `passwordHash`는 응답 비노출. 중복(username/email) → 409.
- `login`: User 조회 → `bcrypt.compare` → access+refresh 발급. 불일치 → 401.
- `refresh`: 저장 해시 대조 → 로테이션(기존 무효화 + 신규 발급). 만료/불일치/재사용 → 401.
- **refresh 토큰 고유성(필수)**: refresh 페이로드는 `{ sub, jti: randomUUID() }`. `jti`가 없으면 JWT `iat`이 초 단위라 login·refresh가 **같은 초에 서명될 때 토큰이 바이트 동일**해진다 → 로테이션이 같은 토큰을 내고, 기존 토큰을 revoke해도 동일 토큰이 새 활성 해시와 매칭되어 **재사용 감지가 무력화**된다. access는 무관(상태 없음).

## Prisma delta (→ api-contract.md `{{PRISMA_SKETCH}}`)

```prisma
model User {
  // ...기존 필드
  passwordHash String          // bcrypt, 응답 비노출
  refreshTokens RefreshToken[]
}

model RefreshToken {
  id        Int       @id @default(autoincrement())
  userId    Int
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String                       // bcrypt 해시 (평문 저장 금지)
  expiresAt DateTime
  createdAt DateTime  @default(now())
  revokedAt DateTime?                     // 로테이션 시 set
  @@index([userId])
}
```

## 요구사항 골격 (→ requirements.md, EARS)

- `[Event-driven(request)]` WHEN a client sends `POST /auth/register` with valid body, THE SYSTEM SHALL create a user with a bcrypt password hash and respond `201` (passwordHash 비노출).
- `[Unwanted(error)]` IF username/email already exists, THEN THE SYSTEM SHALL respond `409`.
- `[Event-driven(request)]` WHEN a client sends `POST /auth/login` with matching credentials, THE SYSTEM SHALL respond `200` with `{ accessToken, refreshToken }`.
- `[Unwanted(error)]` IF credentials do not match, THEN THE SYSTEM SHALL respond `401`.
- `[Event-driven(request)]` WHEN a client sends `POST /auth/refresh` with a valid stored refresh token, THE SYSTEM SHALL rotate it and respond `200` with new tokens.
- `[Unwanted(error)]` IF the refresh token is expired/unknown/reused, THEN THE SYSTEM SHALL respond `401`.

## 설계 메모 (→ design.md 시퀀스)

- **레이어 배치**: 가드/전략은 Common(`src/common/auth/`). 발급 로직(해싱·서명·로테이션)은 `auth` 리소스 Service. Repository가 User·RefreshToken 유일 Prisma 호출자.
- **인가는 별개**: 소유권/역할 *판단*은 각 리소스 service 책임(본 레시피 범위 아님).
- 부트스트랩(ConfigModule·JwtModule·JwtStrategy 골격)은 `new-project` 배터리가 깐다 → 본 레시피는 발급 리소스만.

## 비범위 (YAGNI)

OAuth/소셜 로그인(Passport로 확장 경로만 열림), 로그아웃 전역 블랙리스트(로테이션으로 갈음), 이메일 인증·비번 재설정.
