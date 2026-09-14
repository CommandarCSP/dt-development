export function mergeExtractionResults(partials) {
  // WHY: null and undefined both represent "missing" values; treat equivalently.
  function isEmpty(val) {
    return val === undefined || val === null;
  }

  // Normalize provenance: single object → [object], array stays as-is.
  function normalizeProvenance(prov) {
    if (!prov) return [];
    if (Array.isArray(prov)) return prov;
    return [prov];
  }

  // Deduplicate provenance by comparing { type, locator } identity.
  function dedupeProvenance(provArray) {
    const seen = new Map();
    const result = [];
    for (const prov of provArray) {
      const key = JSON.stringify(prov);
      if (!seen.has(key)) {
        seen.set(key, true);
        result.push(prov);
      }
    }
    return result;
  }

  // WHY: JSON-safe data (no circular refs, no functions) can be compared by stringified value.
  function deepEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  // Format source for conflict reporting: "type:locator" or "inferred".
  function formatSource(prov) {
    if (prov.type === 'inferred') return 'inferred';
    return `${prov.type}:${prov.locator}`;
  }

  // Check if any provenance is a real source (not inferred).
  function hasRealSource(provArray) {
    return provArray.some(p => p.type !== 'inferred');
  }

  // Empty but valid ExtractionResult.
  const emptyResult = {
    components: [],
    semanticUIElements: [],
    apiCandidates: [],
    designTokens: undefined,
    layoutTree: undefined,
    uiTree: undefined,
    pageMeta: undefined,
    userStories: [],
    scenarios: [],
    businessRules: [],
    edgeCases: [],
    _sources: [],
    _conflicts: [],
    _possibleDuplicates: []
  };

  if (!partials || partials.length === 0) {
    return emptyResult;
  }

  const result = JSON.parse(JSON.stringify(emptyResult));
  const conflicts = [];

  // Merge identified areas: components by name, semanticUIElements by id, apiCandidates by endpoint/featureName.
  const componentMap = new Map();
  const elementMap = new Map();
  const candidateMap = new Map();

  // Helper: merge a single item into an identified map.
  function mergeIdentifiedItem(map, key, item, areaName) {
    if (!map.has(key)) {
      // First occurrence: normalize provenance, keep as-is.
      const normalized = {
        ...item,
        _provenance: dedupeProvenance(normalizeProvenance(item._provenance))
      };
      map.set(key, normalized);
    } else {
      // Merge with existing: accumulate provenance, detect field conflicts.
      const existing = map.get(key);
      const incoming = item;

      // Accumulate and dedupe provenance.
      const combinedProv = dedupeProvenance([
        ...existing._provenance,
        ...normalizeProvenance(incoming._provenance)
      ]);

      // Merge fields: null-completion, conflict detection.
      for (const fieldName in incoming) {
        if (fieldName === '_provenance' || fieldName === '_inferred') continue;
        const incomingValue = incoming[fieldName];
        const existingValue = existing[fieldName];

        // Skip if both empty.
        if (isEmpty(incomingValue) && isEmpty(existingValue)) continue;

        // If one is empty and the other isn't: null-completion (no conflict).
        if (isEmpty(incomingValue) && !isEmpty(existingValue)) {
          // Keep existing, no conflict.
          continue;
        }
        if (isEmpty(existingValue) && !isEmpty(incomingValue)) {
          // Adopt incoming, no conflict.
          existing[fieldName] = incomingValue;
          continue;
        }

        // Both have values: check deep equality.
        if (!deepEqual(incomingValue, existingValue)) {
          // Conflict: values differ.
          conflicts.push({
            field: `${areaName}[${key}].${fieldName}`,
            values: [
              { value: existingValue, source: formatSource(existing._provenance[0]) },
              { value: incomingValue, source: formatSource(normalizeProvenance(incoming._provenance)[0]) }
            ],
            note: 'Values differ; first kept as provisional.'
          });
        }
      }

      // Update with combined provenance.
      existing._provenance = combinedProv;

      // WHY: if any real source confirms this item, _inferred is no longer valid.
      // If both sides are inferred (_provenance only has {type:'inferred'}), keep _inferred.
      if (hasRealSource(combinedProv)) {
        delete existing._inferred;
      }
    }
  }

  // Process all partials.
  for (const partial of partials) {
    // Components.
    if (partial.components && Array.isArray(partial.components)) {
      for (const comp of partial.components) {
        mergeIdentifiedItem(componentMap, comp.name, comp, 'components');
      }
    }

    // Semantic UI Elements.
    if (partial.semanticUIElements && Array.isArray(partial.semanticUIElements)) {
      for (const elem of partial.semanticUIElements) {
        mergeIdentifiedItem(elementMap, elem.id, elem, 'semanticUIElements');
      }
    }

    // API Candidates (keyed by endpoint if present, else featureName).
    if (partial.apiCandidates && Array.isArray(partial.apiCandidates)) {
      for (const cand of partial.apiCandidates) {
        const key = cand.endpoint || cand.featureName;
        mergeIdentifiedItem(candidateMap, key, cand, 'apiCandidates');
      }
    }

    // Free-text areas: union without duplication detection.
    if (partial.userStories && Array.isArray(partial.userStories)) {
      result.userStories.push(...partial.userStories);
    }
    if (partial.scenarios && Array.isArray(partial.scenarios)) {
      result.scenarios.push(...partial.scenarios);
    }
    if (partial.businessRules && Array.isArray(partial.businessRules)) {
      result.businessRules.push(...partial.businessRules);
    }
    if (partial.edgeCases && Array.isArray(partial.edgeCases)) {
      result.edgeCases.push(...partial.edgeCases);
    }

    // Visual areas: passthrough (at most one source provides these).
    if (partial.designTokens && !result.designTokens) {
      result.designTokens = partial.designTokens;
    }
    if (partial.layoutTree && !result.layoutTree) {
      result.layoutTree = partial.layoutTree;
    }
    if (partial.uiTree && !result.uiTree) {
      result.uiTree = partial.uiTree;
    }

    // pageMeta: single object, merge field-by-field.
    if (partial.pageMeta) {
      if (!result.pageMeta) {
        result.pageMeta = {};
      }
      for (const fieldName in partial.pageMeta) {
        if (fieldName === '_provenance') continue;
        const incomingValue = partial.pageMeta[fieldName];
        const existingValue = result.pageMeta[fieldName];

        if (isEmpty(incomingValue) && isEmpty(existingValue)) continue;

        if (isEmpty(incomingValue) && !isEmpty(existingValue)) {
          continue;
        }
        if (isEmpty(existingValue) && !isEmpty(incomingValue)) {
          result.pageMeta[fieldName] = incomingValue;
          continue;
        }

        // Both have values: check deep equality.
        if (!deepEqual(incomingValue, existingValue)) {
          // Conflict in pageMeta field.
          const sourceStr = partial.pageMeta._provenance
            ? formatSource(normalizeProvenance(partial.pageMeta._provenance)[0])
            : 'unknown';
          const existingSourceStr = result.pageMeta._provenance
            ? formatSource(normalizeProvenance(result.pageMeta._provenance)[0])
            : 'unknown';
          conflicts.push({
            field: `pageMeta.${fieldName}`,
            values: [
              { value: existingValue, source: existingSourceStr },
              { value: incomingValue, source: sourceStr }
            ],
            note: 'Values differ; first kept as provisional.'
          });
        }
      }
      // Merge pageMeta provenance.
      if (partial.pageMeta._provenance) {
        if (!result.pageMeta._provenance) {
          result.pageMeta._provenance = normalizeProvenance(partial.pageMeta._provenance);
        } else {
          result.pageMeta._provenance = dedupeProvenance([
            ...normalizeProvenance(result.pageMeta._provenance),
            ...normalizeProvenance(partial.pageMeta._provenance)
          ]);
        }
      }
    }

    // Accumulate _sources.
    if (partial._sources && Array.isArray(partial._sources)) {
      result._sources.push(...partial._sources);
    }
  }

  // Populate result arrays from maps.
  result.components = Array.from(componentMap.values());
  result.semanticUIElements = Array.from(elementMap.values());
  result.apiCandidates = Array.from(candidateMap.values());

  // Attach conflicts.
  result._conflicts = conflicts;

  // _possibleDuplicates is empty (populated by step (b) later).
  result._possibleDuplicates = [];

  return result;
}
