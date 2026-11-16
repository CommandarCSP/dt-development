import { readFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadAllRules } from '../lib/rule-loader.mjs';
import { applyLayout, readConfig } from '../lib/layout.mjs';
import { matchAny } from '../lib/matcher.mjs';
import { detectForbiddenImport } from '../lib/detection/forbidden-import.mjs';
import { detectForbiddenCall } from '../lib/detection/forbidden-call.mjs';
import { detectForbiddenPattern } from '../lib/detection/forbidden-pattern.mjs';
import { detectRequiresSiblingTest } from '../lib/detection/requires-sibling-test.mjs';
import { detectRequiredPattern } from '../lib/detection/required-pattern.mjs';
import { detectRequiresAcceptanceLedger } from '../lib/detection/requires-acceptance-ledger.mjs';
import { detectAstRule } from '../lib/detection/ast-rule.mjs';
import { detectPatternPair } from '../lib/detection/pattern-pair.mjs';
import { detectJsxTagAttrs } from '../lib/detection/jsx-tag-attrs.mjs';
import { detectRegisteredInSiblingModule } from '../lib/detection/registered-in-sibling-module.mjs';
import {
  measureCoverage, measureBaselineCoverage, getChangedFiles, compareCoverage,
} from '../lib/coverage.mjs';
import { renderReport } from '../lib/reporter.mjs';
import { loadOverrideKeys, overrideDecisionFindings } from '../lib/overrides.mjs';
import { resolveCoverageCommands } from '../lib/stacks.mjs';

// Run a full review against the user project at cwd.
// args: { pluginRoot, projectRoot, baseRef, runCoverage, stack, ruleLocations, configFileName, testCommand, installCommand }
// testCommand·installCommand 를 넘기지 않으면 scripts/stackCommands.mjs 가 스택 설정·프로젝트로 고른다.
export async function runFullMode({
  pluginRoot, projectRoot, baseRef, runCoverage, verbose = false,
  stack = 'frontend',
  ruleLocations = undefined,
  configFileName = '.dt-frontend.json',
  testCommand = undefined,
  installCommand = undefined,
}) {
  // 1. Load all rules
  const rules = applyLayout(await loadAllRules(pluginRoot, ruleLocations), await readConfig(projectRoot, configFileName));
  const overrideKeys = await loadOverrideKeys(projectRoot, configFileName);
  const skippedRuleIds = new Set();

  // 2. Determine changed files
  const changed = baseRef
    ? getChangedFiles(projectRoot, baseRef)
    : listAllProjectFiles(projectRoot);
  let scanned = 0; // 실제로 읽어 검사한 소스 파일 수 — 0 이면 보고서가 "통과"라고 말하지 않는다

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
    scanned++;
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

  // 3.5 override 근거 결정(PD) 확인 — 근거 없이 규칙을 끄지 않는다(TP-001)
  findings.push(...await overrideDecisionFindings(projectRoot, configFileName));

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
    let cfg = {};
    try { cfg = JSON.parse(await readFile(join(projectRoot, configFileName), 'utf8')) ?? {}; } catch {}
    const picked = resolveCoverageCommands(stack, projectRoot, cfg);
    coverage = await runCoverageDiff({
      projectRoot, baseRef, changed, configFileName,
      testCommand: testCommand ?? picked.testCommand,
      installCommand: installCommand ?? picked.installCommand,
      describe: testCommand ? '호출자가 넘긴 명령' : picked.describe,
    });
  }

  // 5. Render report
  const overrides = { keys: [...overrideKeys], skippedRuleIds: [...skippedRuleIds] };
  return renderReport({ findings, coverage, overrides, scope: { scanned, base: baseRef ?? null } }, { verbose });
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
    case 'pattern-pair':
      return detectPatternPair(code, det);
    case 'jsx-tag-attrs':
      return detectJsxTagAttrs(code, det);
    case 'registered-in-sibling-module':
      return detectRegisteredInSiblingModule(code, det, ctx);
    case 'manual':
      return []; // 판단 규칙 — reviewer 에이전트가 규칙 문서를 읽고 본다(GEN-23)
    default:
      return [];
  }
}

async function runCoverageDiff({ projectRoot, baseRef, changed, configFileName = '.dt-frontend.json', testCommand, installCommand, describe }) {
  const head = measureCoverage(projectRoot, { testCommand });
  if (!head.ok) {
    const cmd = [testCommand[0], ...testCommand[1]].join(' ');
    return { findings: [{ severity: 'critical', file: '(test run)', message: `커버리지 명령 실패 — \`${cmd}\` [${describe}]. 맞지 않으면 스택 설정 testRunner·packageManager 나 commands.coverage 로 고친다.\n${head.error}` }] };
  }
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

// --base 가 없으면 프로젝트 전체: git 이 아는 파일 + 아직 추가 안 한 새 파일(.gitignore 제외).
// git 을 못 쓰면(저장소 아님·권한·dubious ownership) 조용히 0개로 끝내지 않고 폴더를 훑는다.
const WALK_SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', 'out']);
function listAllProjectFiles(projectRoot) {
  const out = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: projectRoot, encoding: 'utf8' });
  if (out.status === 0) return [...new Set(out.stdout.split('\n').filter(Boolean))];
  const files = [];
  const walk = (dir) => {
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) { if (!WALK_SKIP.has(e.name) && !e.name.startsWith('.')) walk(join(dir, e.name)); }
      else files.push(relative(projectRoot, join(dir, e.name)).split('\\').join('/'));
    }
  };
  walk(projectRoot);
  return files;
}
