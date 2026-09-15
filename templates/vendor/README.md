# 동봉 정적 자산

| 파일 | 출처 | 버전 | 라이선스 |
|---|---|---|---|
| `mermaid-11.4.1.min.js` | https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js | 11.4.1 | MIT |

npm 의존이 아니라 정적 자산이다. 빌드 때 Chromium 페이지에 통째로 주입한다.
CDN 을 실행 시점에 부르지 않는다 — 오프라인에서도 같은 결과가 나와야 한다.

번들은 ESM 을 감싼 형태지만 마지막 줄에서 `globalThis.mermaid` 를 채운다. 그래서
`page.addScriptTag({ content })` 로 넣어도 `window.mermaid` 로 잡힌다. 버전을 올릴 때
그 줄이 사라졌는지 확인한다 — 사라지면 주입 방식을 바꿔야 한다.

올릴 때는 버전이 든 새 파일을 넣고 이 표와 `scripts/handbook/render.mjs` 의
`MERMAID_FILE` 을 함께 고친다.
