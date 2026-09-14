import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadAllRules } from '../lib/rule-loader.mjs';
import { matchAny } from '../lib/matcher.mjs';
import { detectForbiddenImport } from '../lib/detection/forbidden-import.mjs';
import { detectForbiddenCall } from '../lib/detection/forbidden-call.mjs';
import { detectForbiddenPattern } from '../lib/detection/forbidden-pattern.mjs';
import { detectRequiresSiblingTest } from '../lib/detection/requires-sibling-test.mjs';
import { detectRequiredPattern } from '../lib/detection/required-pattern.mjs';
import { detectRequiresAcceptanceLedger } from '../lib/detection/requires-acceptance-ledger.mjs';
import { detectAstRule } from '../lib/detection/ast-rule.mjs';
import {
  measureCoverage, measureBaselineCoverage, getChangedFiles, compareCoverage,
} from '../lib/coverage.mjs';
import { renderReport } from '../lib/reporter.mjs';
import { loadOverrideKeys } from '../lib/overrides.mjs';

// Run a full review against the user project at cwd.
// args: { pluginRoot, projectRoot, baseRef, runCoverage, ruleLocations, configFileName, testCommand, installCommand }
export async function runFullMode({
  pluginRoot, projectRoot, baseRef, runCoverage, verbose = false,
  ruleLocations = undefined,
  configFileName = '.dt-frontend.json',
  testCommand = undefined,
  installCommand = undefined,
}) {
  // 1. Load all rules
  const rules = await loadAllRules(pluginRoot, ruleLocations);
  const overrideKeys = await loadOverrideKeys(projectRoot, configFileName);
  const skippedRuleIds = new Set();

  // 2. Determine changed files
  const changed = baseRef
    ? getChangedFiles(projectRoot, baseRef)
    : listAllProjectFiles(projectRoot);

  // 3. Read each changed file and run applicable detections
  const findings = [];
  const detectionCache = {}; // run-scoped shared cache (cross-file dedupe, e.g. requires-acceptance-ledger)
  for (const relPath of changed) {
    if (!/\.(ts|tsx|js|jsx)$/.test(relPath)) continue;
    const abs = join(projectRoot, relPath);
    let code;
    try {
      code = await readFile(abs, 'utf8');
    } catch {
      continue; // file deleted
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

  // 4. Coverage (optional)
  // Honor .dt-frontend.json's coverage.mode if CLI didn't explicitly disable
  if (runCoverage) {
    try {
      const cfg = JSON.parse(await readFile(join(projectRoot, configFileName), 'utf8'));
      if (cfg.coverage?.mode === 'off') runCoverage = false;
    } catch {
      // no config — keep runCoverage as-is
    }
  }
  let coverage = { findings: [] };
  if (runCoverage && baseRef) {
    coverage = await runCoverageDiff({ projectRoot, baseRef, changed, configFileName, testCommand, installCommand });
  }

  // 5. Render report
  const overrides = { keys: [...overrideKeys], skippedRuleIds: [...skippedRuleIds] };
  return renderReport({ findings, coverage, overrides }, { verbose });
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

async function runCoverageDiff({ projectRoot, baseRef, changed, configFileName = '.dt-frontend.json', testCommand, installCommand }) {
  const head = measureCoverage(projectRoot, { testCommand });
  if (!head.ok) return { findings: [{ severity: 'critical', file: '(test run)', message: head.error }] };
  const base = measureBaselineCoverage(projectRoot, baseRef, { testCommand, installCommand });
  if (!base.ok) {
    return { findings: [{ severity: 'minor', file: '(baseline)', message: `baseline 계산 실패: ${base.error}. diff 검사 생략.` }] };
  }
  const cfgPath = join(projectRoot, configFileName);
  let threshold = 80;
  let baselineProtection = true;
  try {
    const cfg = JSON.parse(await readFile(cfgPath, 'utf8'));
    threshold = cfg.coverage?.newCodeThreshold ?? threshold;
    baselineProtection = cfg.coverage?.baselineProtection ?? baselineProtection;
  } catch {}
  return compareCoverage({ head: head.summary, base: base.summary, changed, threshold, baselineProtection });
}

function listAllProjectFiles(projectRoot) {
  const out = spawnSync('git', ['ls-files'], { cwd: projectRoot, encoding: 'utf8' });
  if (out.status !== 0) return [];
  return out.stdout.split('\n').filter(Boolean);
}
