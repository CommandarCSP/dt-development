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

export function parseEndpoints(text) {
  const re = /\/api\/([a-z0-9-]+)/gi;
  const segs = [];
  let m;
  while ((m = re.exec(text)) !== null) segs.push(m[1].toLowerCase());
  return segs;
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

export function parseSpecForScaffold(specDir, { existingDomains = [], readFile } = {}) {
  const read = readFile ?? ((p) => readFileSync(p, 'utf8'));
  const requirements = read(join(specDir, 'requirements.md'));
  const design = read(join(specDir, 'design.md'));

  const domainNames = deriveDomains(parseEndpoints(requirements + '\n' + design));

  return {
    specDir,
    status: parseStatus(requirements),
    page: { name: parsePageName(requirements) },
    domains: assignIntent(domainNames, existingDomains),
    multiDomain: domainNames.length > 1,
    draftFlags: { proposedApiCount: countProposedApis(requirements) },
  };
}
