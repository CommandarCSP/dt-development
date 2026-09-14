---
ruleId: dto-vs-viewmodel
summary: "View/Domain은 ViewModel(Model) 타입만 사용, DTO 타입 import 금지"
severity: important
appliesTo: ["src/components/**/*.{ts,tsx}", "src/pages/**/*.{ts,tsx}"]
detection:
  - type: forbidden-import
    matches: ["**/types/*Dto", "@/types/*Dto"]
    rationale: "View/Domain Component는 DTO가 아닌 Model(ViewModel) 타입만 사용"
relatedRules: [where-does-business-logic-go]
---

# DTO와 ViewModel을 분리하라

## 왜 중요한가
- API 응답 필드가 바뀌어도 UI 코드가 영향받지 않게
- UI가 쓰기 좋은 이름 사용 (`userId` → `authorId`)
- 계산/포맷 필드 추가 (`createdAt` → `relativeTime`)

## ❌ Incorrect

```ts
// src/types/post.ts
export interface Post {
  userId: number; // API 그대로
  id: number;
  title: string;
  body: string;
}

// View에서 PostDto를 그대로 사용
export function PostCard({ post }: { post: Post }) {
  return <div>Author ID: {post.userId}</div>;
}
```

## ✅ Correct

```ts
// src/types/post.ts
export interface PostDto {
  userId: number;
  id: number;
  title: string;
  body: string;
}

export interface Post {
  id: number;
  title: string;
  body: string;
  authorId: number; // UI 친화적 이름
}

// Business Hook에서 변환
function toPost(dto: PostDto): Post {
  return { id: dto.id, title: dto.title, body: dto.body, authorId: dto.userId };
}
```

## 관련 규칙
- [[where-does-business-logic-go]]
