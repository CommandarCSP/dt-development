import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function parseStatus(requirementsText) {
  const m = requirementsText.match(/<!-- status: (finalized|draft) -->/);
  return m ? m[1] : 'draft';
}

export function parsePageName(requirementsText) {
  const m = requirementsText.match(/^# Requirements: (.+)$/m);
  return m ? m[1].trim() : null;
}

/**
 * 스펙 본문의 API 주소에서 도메인 이름(접두어 다음 첫 조각)을 뽑는다.
 * apiPrefix: 스택 설정 `apiPrefix`(문자열 또는 배열, 기본 "/api"). `/v1` 같은 버전 조각은 건너뛴다.
 * 빈 접두어("")면 아무 `/조각`이나 잡지 않도록 HTTP 메서드 뒤의 주소만 본다(`GET /posts`).
 */
export function parseEndpoints(text, { apiPrefix = '/api' } = {}) {
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const norm = (p) => { const t = String(p ?? '').trim().replace(/\/+$/, ''); return !t ? '' : t.startsWith('/') ? t : `/${t}`; };
  const prefixes = [...new Set((Array.isArray(apiPrefix) ? apiPrefix : [apiPrefix]).map(norm))];
  const alts = prefixes.map((p) => (p ? `${esc(p)}` : '\\b(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\\s+'));
  const re = new RegExp(`(?:${alts.join('|')})(?:/v\\d+)?/([a-z0-9-]+)`, 'gi');
  const segs = [];
  let m;
  while ((m = re.exec(text)) !== null) segs.push(m[1].toLowerCase());
  return segs;
}

/** 스택 설정의 apiPrefix. 없으면 undefined(기본 "/api"). */
export function readApiPrefix(projectRoot, configFileName = '.dt-frontend.json') {
  try { return JSON.parse(readFileSync(join(projectRoot, configFileName), 'utf8')).apiPrefix; } catch { return undefined; }
}

export function deriveDomains(segs) {
  return [...new Set(segs)];
}

export function countProposedApis(requirementsText) {
  return requirementsText
    .split('\n')
    .filter((l) => /^### \d+\)/.test(l) && l.includes('[제안]'))
    .length;
}

export function assignIntent(domainNames, existingDomains = []) {
  const set = new Set(existingDomains);
  return domainNames.map((name) => ({
    name,
    intent: set.has(name) ? 'extend-domain' : 'new-domain',
  }));
}

export function parseSpecForScaffold(specDir, { existingDomains = [], readFile, apiPrefix, projectRoot } = {}) {
  const read = readFile ?? ((p) => readFileSync(p, 'utf8'));
  const requirements = read(join(specDir, 'requirements.md'));
  const design = read(join(specDir, 'design.md'));

  const prefix = apiPrefix ?? (projectRoot ? readApiPrefix(projectRoot) : undefined) ?? '/api';
  const domainNames = deriveDomains(parseEndpoints(requirements + '\n' + design, { apiPrefix: prefix }));

  return {
    specDir,
    status: parseStatus(requirements),
    page: { name: parsePageName(requirements) },
    domains: assignIntent(domainNames, existingDomains),
    multiDomain: domainNames.length > 1,
    draftFlags: { proposedApiCount: countProposedApis(requirements) },
  };
}
