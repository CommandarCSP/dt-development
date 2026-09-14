---
version: 1.0.0
type: web
product: Demo
scenarios:
  - id: S1
    title: 시작하기
    steps: [SCR-home]
    source: [doc:README.md]
screens:
  - id: SCR-home
    title: 홈
    route: "/"
    capture: { mode: auto }
    publish: true
    source: [code:src/App.tsx:1]
---
