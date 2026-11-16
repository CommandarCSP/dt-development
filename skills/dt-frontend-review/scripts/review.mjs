#!/usr/bin/env node
// 옛 경로 호환 파일 — 리뷰 엔진은 `scripts/review/review.mjs`로 옮겼다(GEN-08).
// 다음 minor 버전에서 지운다(docs/refs/compat-policy.md). 새 경로를 부르도록 고친다.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const engine = fileURLToPath(new URL('../../../scripts/review/review.mjs', import.meta.url));
process.stderr.write('경고: skills/dt-frontend-review/scripts/review.mjs 는 옛 경로다 — scripts/review/review.mjs 를 부른다(다음 minor 버전에서 지운다)\n');
const r = spawnSync(process.execPath, [engine, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 2);
