import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadAllRules } from '../lib/rule-loader.mjs';
import { matchAny } from '../lib/matcher.mjs';
import { detectForbiddenImport } from '../lib/detection/forbidden-import.mjs';
import { detectForbiddenCall } from '../lib/detection/forbidden-call.mjs';
import { detectForbiddenPattern } from '../lib/detection/forbidden-pattern.mjs';
import { detectRequiresSiblingTest } from '../lib/detection/requires-sibling-test.mjs';
import { detectRequiredPattern } from '../lib/detection/required-pattern.mjs';
import { detectRequiresAcceptanceLedger } from '../lib/detection/requires-acceptance-ledger.mjs';
import { detectAstRule } from '../lib/detection/ast-rule.mjs';
import { renderReport } from '../lib/reporter.mjs';
import { loadOverrideKeys } from '../lib/overrides.mjs';

// Partial mode: review only a specific set of paths (no coverage).
// Used by Plan 3 scaffold for per-phase mini-reviews.
// args: { pluginRoot, projectRoot, paths: string[], ruleLocations, configFileName }
export async function runPartialMode({ pluginRoot, projectRoot, paths, verbose = false, ruleLocations = undefined, configFileName = '.dt-frontend.json' }) {
  const rules = await loadAllRules(pluginRoot, ruleLocations);
  const overrideKeys = await loadOverrideKeys(projectRoot, configFileName);
  const skippedRuleIds = new Set();
  const findings = [];
  const detectionCache = {}; // run-scoped shared cache (cross-file dedupe, e.g. requires-acceptance-ledger)
  for (const relPath of paths) {
    if (!/\.(ts|tsx|js|jsx)$/.test(relPath)) continue;
    const abs = join(projectRoot, relPath);
    let code;
    try {
      code = await readFile(abs, 'utf8');
    } catch {
      continue;
    }
    for (const rule of rules) {
      if (!matchAny(relPath, rule.appliesTo)) continue;
      if (rule.excludePathPatterns.length > 0 && matchAny(relPath, rule.excludePathPatterns)) continue;
      if (rule.overridable && rule.overrideKey && overrideKeys.has(rule.overrideKey)) { skippedRuleIds.add(rule.ruleId); continue; }
      for (const det of rule.detection) {
        const ruleFindings = runDetection(code, det, { relPath, projectRoot, cache: detectionCache });
        for (const rf of ruleFindings) {
          findings.push({
            severity: rule.severity,
            ruleId: rule.ruleId,
            file: relPath,
            line: rf.line,
            matched: rf.matched,
            manualReview: rf.manualReview,
            hint: rf.hint,
            message: rf.manualReview ? rf.hint : `위반: ${det.type} (${rf.matched || ''})`,
          });
        }
      }
    }
  }
  const overrides = { keys: [...overrideKeys], skippedRuleIds: [...skippedRuleIds] };
  return renderReport({ findings, coverage: { findings: [] }, overrides }, { verbose });
}

function runDetection(code, det, ctx) {
  switch (det.type) {
    case 'forbidden-import':
      return detectForbiddenImport(code, det);
    case 'forbidden-call':
      return detectForbiddenCall(code, det);
    case 'forbidden-pattern':
      return detectForbiddenPattern(code, det);
    case 'requires-sibling-test':
      return detectRequiresSiblingTest(code, det, ctx);
    case 'required-pattern':
      return detectRequiredPattern(code, det);
    case 'requires-acceptance-ledger':
      return detectRequiresAcceptanceLedger(code, det, ctx);
    case 'ast-rule':
      return detectAstRule(code, det);
    default:
      return [];
  }
}
