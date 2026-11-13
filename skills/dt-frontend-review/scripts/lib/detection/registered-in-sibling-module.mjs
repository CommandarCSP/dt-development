// NestJS 와이어링 (GEN-23) — @Injectable/@Controller 클래스는 같은 폴더의 *.module.ts 에 등록돼야 한다.
// Config: { type: 'registered-in-sibling-module', rationale? }
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function detectRegisteredInSiblingModule(code, _cfg, ctx = {}) {
  const deco = code.match(/@(Injectable|Controller)\s*\(/);
  if (!deco) return [];
  const cls = code.slice(deco.index).match(/export\s+class\s+(\w+)/);
  if (!cls) return [];
  const name = cls[1];
  const line = code.slice(0, deco.index).split('\n').length;
  if (!ctx.projectRoot || !ctx.relPath) return [{ manualReview: true, hint: `${name}: 모듈 등록 확인에 경로 정보가 없다` }];
  const dir = join(ctx.projectRoot, dirname(ctx.relPath));
  let modules = [];
  try { modules = readdirSync(dir).filter((f) => f.endsWith('.module.ts')); } catch { /* 폴더를 못 읽음 */ }
  if (!modules.length) return [{ matched: `${name}: 같은 폴더에 *.module.ts 가 없다`, line }];
  const registered = modules.some((f) => new RegExp(`\\b${name}\\b`).test(readFileSync(join(dir, f), 'utf8')));
  return registered ? [] : [{ matched: `${name}: ${modules.join(', ')} 에 등록되지 않았다`, line }];
}
