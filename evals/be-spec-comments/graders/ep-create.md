---
type: regex
pattern: "^\\|\\s*`?POST`?\\s*\\|\\s*`?/posts/[:{]postId}?/comments"
flags: m
target: { source: file, path: docs/specs/resources/comments/api-contract.md }
---
