// Render review findings as markdown report.
// Options:
//   verbose: when true, prints each Manual Review heuristic stub finding (one line per file/rule).
//            Default false — manual-review hints are summarized as a single count line by rule.

export function renderReport({ findings, coverage, overrides, scope = null }, { verbose = false } = {}) {
  const manualReviews = findings.filter((f) => f.manualReview);
  const realFindings = findings.filter((f) => !f.manualReview);

  const buckets = { critical: [], important: [], minor: [] };
  for (const f of realFindings) {
    const key = ['critical', 'important', 'minor'].includes(f.severity) ? f.severity : 'minor';
    buckets[key].push(f);
  }

  const sections = [];

  if (buckets.critical.length) {
    sections.push('### Critical (must fix)');
    sections.push(...buckets.critical.map(formatFinding));
  }
  if (buckets.important.length) {
    sections.push('### Important (should fix)');
    sections.push(...buckets.important.map(formatFinding));
  }
  if (buckets.minor.length) {
    sections.push('### Minor (nice to have)');
    sections.push(...buckets.minor.map(formatFinding));
  }

  if (coverage.findings.length) {
    sections.push('### Coverage');
    for (const f of coverage.findings) {
      sections.push(`- ${f.file}: ${f.message}`);
    }
  }

  if (manualReviews.length) {
    if (verbose) {
      sections.push('### Manual Review (heuristic stubs — AST analysis not implemented yet)');
      for (const f of manualReviews) {
        sections.push(`- ${f.file}${f.line ? ':' + f.line : ''} — ${f.ruleId} — ${f.hint || f.message || ''}`);
      }
    } else {
      // Summarize per rule: how many files were flagged as needing manual review
      const perRule = new Map();
      for (const f of manualReviews) {
        const key = f.ruleId || '(unknown)';
        if (!perRule.has(key)) perRule.set(key, new Set());
        perRule.get(key).add(f.file);
      }
      sections.push('### Manual Review (suppressed — run with `--verbose` for full list)');
      const summary = [...perRule.entries()]
        .sort((a, b) => b[1].size - a[1].size)
        .map(([rule, files]) => `- ${rule}: ${files.size}개 파일 (AST 미구현 휴리스틱)`);
      sections.push(...summary);
    }
  }

  const hasCritical =
    buckets.critical.length > 0 ||
    coverage.findings.some((f) => f.severity === 'critical');
  // 검사한 소스 파일이 0개면 "위반 없음"은 거짓 통과다 — Yes 라고 하지 않는다(GEN-23 조용한 통과 제거).
  const nothingScanned = scope != null && scope.scanned === 0;
  const verdict = hasCritical
    ? 'No'
    : nothingScanned
    ? 'Unknown'
    : buckets.important.length || buckets.minor.length
    ? 'With fixes'
    : 'Yes';

  if (overrides && Array.isArray(overrides.skippedRuleIds) && overrides.skippedRuleIds.length) {
    sections.unshift(`오버라이드(.dt-frontend.json): ${overrides.keys.join(', ')} → skip: ${overrides.skippedRuleIds.join(', ')}`);
  }

  sections.push('### Assessment');
  if (scope != null) sections.push(`검사한 소스 파일: ${scope.scanned}개 (${scope.base ? `${scope.base} 이후 바뀐 파일` : '프로젝트 전체'})`);
  sections.push(`Ready to merge: ${verdict}`);
  if (nothingScanned) sections.push('Reasoning: 검사한 소스 파일이 0개다 — 경로(paths.src)·git 상태·--base 범위를 확인한다. 위반이 없다는 뜻이 아니다.');
  if (nothingScanned && !hasCritical) {
    // 이유는 위에 적었다
  } else if (hasCritical) {
    sections.push(
      `Reasoning: Critical 위반 ${buckets.critical.length}건${coverage.findings.length ? ` + coverage ${coverage.findings.length}건` : ''} — 머지 전 수정 필요.`,
    );
  } else if (buckets.important.length) {
    sections.push('Reasoning: Critical은 없으나 Important 개선 권장.');
  } else if (buckets.minor.length) {
    sections.push('Reasoning: Minor 개선 사항 있음.');
  } else {
    sections.push('Reasoning: 위반 없음.');
  }

  return sections.join('\n\n');
}

function formatFinding(f) {
  return `- ${f.file}${f.line ? `:${f.line}` : ''} — ${f.ruleId} — ${f.message || ''}`;
}
