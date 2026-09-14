import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_FORBIDDEN_MARKERS } from './gate.mjs';

/** .dt-guide.json + 기본값. 기존 .dt-frontend.json·.dt-confluence.json 관례. */
export function loadGuideConfig(projectRoot) {
  const p = join(projectRoot, '.dt-guide.json');
  const raw = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {};
  const pkg = existsSync(join(projectRoot, 'package.json')) ? JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8')) : {};
  const product = raw.product ?? pkg.name ?? 'Product';
  const ascii = String(product).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'Product';
  return {
    product,
    language: raw.language ?? 'ko',
    pdfName: raw.pdfName ?? `${ascii}-User-Guide.pdf`,
    forbiddenMarkers: [...new Set([...DEFAULT_FORBIDDEN_MARKERS, ...(raw.forbiddenMarkers ?? [])])],
    type: raw.type,
    /**
     * G6(그림 속 글자)가 봐주고 넘어갈 값들. 제품이 화면에 일부러 보여 주는
     * 예시 계정 같은 것이다 — **적어서 통과**시키는 것과 그냥 통과하는 것은
     * 다르니, 기본값은 빈 배열이다.
     */
    allowInShots: raw.allowInShots ?? [],
    distribution: raw.distribution ?? [],
    pluginRoot: raw.pluginRoot,
  };
}
