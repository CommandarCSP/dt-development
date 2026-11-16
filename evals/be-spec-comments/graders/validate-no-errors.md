---
type: regex
pattern: "\"errors\":\\s*\\[\\s*\\{"
match: not_contains
target: { source: file, path: eval-validate.json }
---
