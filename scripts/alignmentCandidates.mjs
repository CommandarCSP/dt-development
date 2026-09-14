/**
 * Generate deterministic cross-source UI-element candidate pairs for later LLM same-or-not judgment.
 * @param {Array} semanticUIElements - items with { id, role, label?, parentContext?, _provenance }
 * @param {Object} [opts={}]
 * @param {number} [opts.threshold=0.5] - Jaccard similarity threshold for label matching
 * @returns {Array} pairs { a, b, roleMatch, labelSimilarity }, sorted by a.id then b.id
 */
export function alignmentCandidates(semanticUIElements, opts = {}) {
  const threshold = opts.threshold ?? 0.5;

  // WHY: tokenize a label into a set of lowercase word tokens, split on whitespace and common separators.
  function tokenize(label) {
    if (!label || typeof label !== 'string') return new Set();
    return new Set(
      label.toLowerCase().split(/[\s_\-/]+/).filter(t => t.length > 0)
    );
  }

  // WHY: compute Jaccard similarity between two token sets.
  function jaccardSimilarity(set1, set2) {
    if (set1.size === 0 || set2.size === 0) return 0;
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
  }

  // WHY: check if two provenance arrays share any identical entry (by JSON stringification).
  function shareProvenance(prov1, prov2) {
    const prov1Set = new Set((prov1 || []).map(p => JSON.stringify(p)));
    const prov2Set = new Set((prov2 || []).map(p => JSON.stringify(p)));
    for (const key of prov1Set) {
      if (prov2Set.has(key)) return true;
    }
    return false;
  }

  // WHY: build candidate pairs that satisfy ALL matching rules.
  const pairs = [];

  for (let i = 0; i < semanticUIElements.length; i++) {
    for (let j = i + 1; j < semanticUIElements.length; j++) {
      const a = semanticUIElements[i];
      const b = semanticUIElements[j];

      // Rule 1: cross-source check — must NOT share any provenance entry.
      if (shareProvenance(a._provenance, b._provenance)) {
        continue;
      }

      // Rule 2: role must be equal.
      if (a.role !== b.role) {
        continue;
      }

      // Rule 3: label token Jaccard ≥ threshold.
      const tokensA = tokenize(a.label);
      const tokensB = tokenize(b.label);
      const labelSim = jaccardSimilarity(tokensA, tokensB);
      if (labelSim < threshold) {
        continue;
      }

      // All rules passed: add as a candidate pair.
      const pair = {
        a,
        b,
        roleMatch: true,
        labelSimilarity: labelSim
      };
      pairs.push(pair);
    }
  }

  // WHY: sort deterministically by a.id then b.id for stable output.
  pairs.sort((p1, p2) => {
    const cmp = p1.a.id.localeCompare(p2.a.id);
    if (cmp !== 0) return cmp;
    return p1.b.id.localeCompare(p2.b.id);
  });

  return pairs;
}
