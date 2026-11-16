import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';

// Discovers all rule files under plugin root and parses their frontmatter.
// Returns: array of { source, filepath, ruleId, severity, appliesTo, detection, relatedRules, body }
//
// The engine itself is stack-agnostic: callers pass the rule locations for the
// stack they are reviewing. STACK_RULE_LOCATIONS holds the built-in stacks.
// Missing directories are skipped, so a stack can be declared before its
// rule dirs exist (Plan ordering).

export const STACK_RULE_LOCATIONS = {
  frontend: [
    { dir: 'skills/dt-frontend-architecture/patterns', source: 'architecture' },
    { dir: 'skills/dt-frontend-testing/patterns', source: 'testing' },
    { dir: 'rules/vendored/vercel-react-best-practices', source: 'vendored:vercel-react-best-practices' },
  ],
  backend: [
    { dir: 'skills/dt-backend-architecture/patterns', source: 'architecture' },
    { dir: 'skills/dt-backend-testing/patterns', source: 'testing' },
  ],
};

export async function loadAllRules(pluginRoot, ruleLocations = STACK_RULE_LOCATIONS.frontend) {
  const rules = [];
  for (const { dir, source } of ruleLocations) {
    const abs = join(pluginRoot, dir);
    let entries;
    try {
      entries = await readdir(abs);
    } catch {
      continue; // directory may not exist (Plan ordering)
    }
    for (const name of entries) {
      if (!name.endsWith('.md')) continue;
      if (name === 'SOURCE.md' || name === 'README.md') continue;
      const filepath = join(abs, name);
      const text = await readFile(filepath, 'utf8');
      const { data, body } = parseFrontmatter(text);
      if (!data || !data.ruleId) continue;
      rules.push({
        source,
        filepath,
        ruleId: data.ruleId,
        severity: data.severity || 'minor',
        appliesTo: Array.isArray(data.appliesTo) ? data.appliesTo : [],
        detection: Array.isArray(data.detection) ? data.detection : [],
        relatedRules: Array.isArray(data.relatedRules) ? data.relatedRules : [],
        excludePathPatterns: Array.isArray(data.excludePathPatterns) ? data.excludePathPatterns : [],
        overridable: data.overridable === true,
        overrideKey: typeof data.overrideKey === 'string' ? data.overrideKey : null,
        body,
      });
    }
  }
  return rules;
}
