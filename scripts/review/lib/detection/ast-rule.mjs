// AST rule detection — v1 stub. Always returns a "manualReview" finding
// so reports include the rule but flag it as needing human inspection.
// Real AST analysis (ts-morph) is not implemented yet — see roadmap GEN-23.

export function detectAstRule(_code, cfg) {
  return [{
    manualReview: true,
    hint: cfg.description || 'AST-based rule — manual review required (v1 stub)',
  }];
}
