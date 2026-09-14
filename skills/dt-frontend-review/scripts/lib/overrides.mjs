import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// .dt-frontend.json(또는 stack config)의 `overrides` 객체 키 집합을 반환.
// 파일/overrides 없거나 파싱 실패 시 빈 Set.
export async function loadOverrideKeys(projectRoot, configFileName = '.dt-frontend.json') {
  try {
    const cfg = JSON.parse(await readFile(join(projectRoot, configFileName), 'utf8'));
    if (cfg && cfg.overrides && typeof cfg.overrides === 'object') {
      return new Set(Object.keys(cfg.overrides));
    }
  } catch {
    // no config or parse error → no overrides
  }
  return new Set();
}
