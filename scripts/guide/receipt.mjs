/** 가이드 영수증 + 소스 해시 — 기존 TS 구현(src/guide/{source-hash,collect-files,receipt}.ts) 이식. */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep, posix } from 'node:path';

export function collectGuideFiles(guideDir, exclude = []) {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      const rel = relative(guideDir, full).split(sep).join(posix.sep);
      if (exclude.includes(rel)) continue; // PDF·영수증·HTML 산출물은 소스가 아니다
      files.push({ path: rel, content: readFileSync(full) });
    }
  };
  walk(guideDir);
  return files;
}

export function computeSourceHash(files) {
  const h = createHash('sha256');
  for (const f of [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    h.update(f.path); h.update('\0');
    h.update(typeof f.content === 'string' ? Buffer.from(f.content, 'utf8') : f.content); h.update('\0');
  }
  return h.digest('hex');
}

export function checkGuideReceipt({ receipt, appVersion, currentSourceHash, pdfExists }) {
  if (receipt === undefined || receipt === null) return { ok: false, reason: '가이드 영수증이 없다 — /dt-guide build 를 먼저 돌려라.' };
  if (!pdfExists) return { ok: false, reason: '가이드 PDF 가 없다 — /dt-guide build 를 돌려라.' };
  if (receipt.version !== appVersion) return { ok: false, reason: `가이드가 ${receipt.version} 판이고 프로젝트는 ${appVersion} 이다 — guide.md 의 version 을 맞추고 다시 빌드하라.` };
  if (receipt.sourceHash !== currentSourceHash) return { ok: false, reason: '가이드 소스가 PDF 를 만든 뒤에 바뀌었다 — 다시 빌드하라.' };
  if (receipt.pdf !== true) return { ok: false, reason: 'PDF 없이 만든 영수증이다(--no-pdf) — PDF 를 만들어 다시 빌드하라.' };
  if (!receipt.shotsRefreshed) return { ok: false, reason: '캡처를 갱신하지 않고 만든 PDF 다 — 배포에는 /dt-guide capture 후 빌드한 것을 쓴다.' };
  return { ok: true };
}
