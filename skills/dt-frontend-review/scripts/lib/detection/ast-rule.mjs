// AST rule detection — v1 stub. Always returns a "manualReview" finding
// so reports include the rule but flag it as needing human inspection.
// Plan 3+ will integrate ts-morph for real AST analysis.

export function detectAstRule(_code, cfg) {
  return [{
    manualReview: true,
    hint: cfg.description || 'AST-based rule — manual review required (v1 stub)',
  }];
}
