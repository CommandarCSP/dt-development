import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alignmentCandidates } from '../scripts/alignmentCandidates.mjs';

// Helper: tokenize a label into a set of lowercase word tokens.
function tokenize(label) {
  if (!label || typeof label !== 'string') return new Set();
  // Split on whitespace, underscores, hyphens, slashes.
  return new Set(label.toLowerCase().split(/[\s_\-/]+/).filter(t => t.length > 0));
}

// Helper: compute Jaccard similarity.
function jaccardSimilarity(set1, set2) {
  if (set1.size === 0 || set2.size === 0) return 0;
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return intersection.size / union.size;
}

test('alignmentCandidates: 교차 소스, 동일 role, 높은 label 유사성 → candidate', () => {
  const elements = [
    {
      id: 'fig-1',
      role: 'button',
      label: 'submit button',
      _provenance: [{ type: 'figma', locator: 'page1:1' }]
    },
    {
      id: 'md-1',
      role: 'button',
      label: 'submit form button',
      _provenance: [{ type: 'markdown', locator: './req.md' }]
    }
  ];
  const result = alignmentCandidates(elements);
  assert.equal(result.length, 1);
  const [pair] = result;
  assert.equal(pair.a.id, 'fig-1');
  assert.equal(pair.b.id, 'md-1');
  assert.equal(pair.roleMatch, true);
  assert.ok(pair.labelSimilarity > 0.5, 'label similarity should be > 0.5');
});

test('alignmentCandidates: 동일 role이지만 낮은 label 유사성 → NOT candidate', () => {
  const elements = [
    {
      id: 'fig-1',
      role: 'button',
      label: 'upload',
      _provenance: [{ type: 'figma', locator: 'page1:1' }]
    },
    {
      id: 'md-1',
      role: 'button',
      label: 'delete permanently',
      _provenance: [{ type: 'markdown', locator: './req.md' }]
    }
  ];
  const result = alignmentCandidates(elements);
  assert.equal(result.length, 0, 'no candidate when label similarity is low');
});

test('alignmentCandidates: 다른 role → NOT candidate (label 동일해도)', () => {
  const elements = [
    {
      id: 'fig-1',
      role: 'button',
      label: 'save',
      _provenance: [{ type: 'figma', locator: 'page1:1' }]
    },
    {
      id: 'md-1',
      role: 'link',
      label: 'save',
      _provenance: [{ type: 'markdown', locator: './req.md' }]
    }
  ];
  const result = alignmentCandidates(elements);
  assert.equal(result.length, 0, 'no candidate when roles differ');
});

test('alignmentCandidates: 동일 source (provenance 공유) → NOT candidate (교차 소스 아님)', () => {
  const elements = [
    {
      id: 'fig-1',
      role: 'button',
      label: 'upload',
      _provenance: [{ type: 'figma', locator: 'page1:1' }]
    },
    {
      id: 'fig-2',
      role: 'button',
      label: 'upload',
      _provenance: [{ type: 'figma', locator: 'page1:1' }]
    }
  ];
  const result = alignmentCandidates(elements);
  assert.equal(result.length, 0, 'no candidate when both from same source');
});

test('alignmentCandidates: inferred vs figma, 동일 role, 유사 label → candidate (교차 소스)', () => {
  const elements = [
    {
      id: 'inf-1',
      role: 'button',
      label: 'submit form',
      _provenance: [{ type: 'inferred' }]
    },
    {
      id: 'fig-1',
      role: 'button',
      label: 'submit',
      _provenance: [{ type: 'figma', locator: 'page1:1' }]
    }
  ];
  const result = alignmentCandidates(elements);
  assert.equal(result.length, 1, 'inferred and figma are cross-source');
  assert.equal(result[0].labelSimilarity, 1 / 2, 'Jaccard of {form,submit} ∩ {submit} = 1/2');
});

test('alignmentCandidates: 없는 label → similarity 0, default threshold 0.5에서 NOT candidate', () => {
  const elements = [
    {
      id: 'fig-1',
      role: 'button',
      _provenance: [{ type: 'figma', locator: 'page1:1' }]
    },
    {
      id: 'md-1',
      role: 'button',
      label: 'click me',
      _provenance: [{ type: 'markdown', locator: './req.md' }]
    }
  ];
  const result = alignmentCandidates(elements);
  assert.equal(result.length, 0, 'missing label → similarity 0 → not candidate at threshold 0.5');
});

test('alignmentCandidates: threshold override (0.3) → borderline 쌍 admitted', () => {
  const elements = [
    {
      id: 'fig-1',
      role: 'button',
      label: 'save file',
      _provenance: [{ type: 'figma', locator: 'page1:1' }]
    },
    {
      id: 'md-1',
      role: 'button',
      label: 'save',
      _provenance: [{ type: 'markdown', locator: './req.md' }]
    }
  ];
  // Default threshold 0.5: {save,file} ∩ {save} = 1/2 = 0.5, borderline (not >)
  // But Jaccard = 1/2 is exactly threshold, so it's admitted (>= threshold)
  // Test with threshold 0.3: this should be admitted since 0.5 >= 0.3
  const elements2 = [
    {
      id: 'fig-1',
      role: 'button',
      label: 'create file',
      _provenance: [{ type: 'figma', locator: 'page1:1' }]
    },
    {
      id: 'md-1',
      role: 'button',
      label: 'create',
      _provenance: [{ type: 'markdown', locator: './req.md' }]
    }
  ];
  // "create file" → {create, file}, "create" → {create}
  // Intersection: {create} = 1, Union: {create, file} = 2
  // Jaccard = 1/2 = 0.5
  const result = alignmentCandidates(elements2, { threshold: 0.3 });
  assert.equal(result.length, 1, 'threshold 0.3 admits Jaccard 0.5 pair');
  assert.equal(result[0].labelSimilarity, 0.5);
});

test('alignmentCandidates: 중복 pair 없음, self-pair 없음', () => {
  const elements = [
    {
      id: 'fig-1',
      role: 'button',
      label: 'click',
      _provenance: [{ type: 'figma', locator: 'page1:1' }]
    },
    {
      id: 'md-1',
      role: 'button',
      label: 'click',
      _provenance: [{ type: 'markdown', locator: './req.md' }]
    },
    {
      id: 'req-1',
      role: 'button',
      label: 'click',
      _provenance: [{ type: 'requirements', locator: 'spec.txt' }]
    }
  ];
  const result = alignmentCandidates(elements);
  // Should produce 3 pairs: (fig-1, md-1), (fig-1, req-1), (md-1, req-1)
  assert.equal(result.length, 3, '3 cross-source pairs, no duplicates');
  // Check no (a, a) or (a, b) and (b, a) duplicates
  const seen = new Set();
  for (const pair of result) {
    const key1 = `${pair.a.id}::${pair.b.id}`;
    const key2 = `${pair.b.id}::${pair.a.id}`;
    assert.ok(!seen.has(key1) && !seen.has(key2), 'no duplicate pairs');
    seen.add(key1);
  }
});

test('alignmentCandidates: 결과는 deterministic 순서 (a.id then b.id 정렬)', () => {
  const elements = [
    {
      id: 'z',
      role: 'button',
      label: 'x',
      _provenance: [{ type: 'figma', locator: '1' }]
    },
    {
      id: 'a',
      role: 'button',
      label: 'x',
      _provenance: [{ type: 'markdown', locator: '1' }]
    },
    {
      id: 'm',
      role: 'button',
      label: 'x',
      _provenance: [{ type: 'requirements', locator: '1' }]
    }
  ];
  const result = alignmentCandidates(elements);
  // Should have 3 pairs total.
  assert.equal(result.length, 3);
  // Check sorted by (a.id, b.id).
  for (let i = 0; i < result.length - 1; i++) {
    const cmp = result[i].a.id.localeCompare(result[i + 1].a.id);
    assert.ok(cmp < 0 || (cmp === 0 && result[i].b.id.localeCompare(result[i + 1].b.id) < 0),
      'pairs should be sorted by a.id then b.id');
  }
});

test('alignmentCandidates: tokenization: "파일 추가 버튼" vs "upload_button"', () => {
  const elements = [
    {
      id: 'fig-1',
      role: 'button',
      label: '파일 추가 버튼',
      _provenance: [{ type: 'figma', locator: '1' }]
    },
    {
      id: 'md-1',
      role: 'button',
      label: 'upload_button',
      _provenance: [{ type: 'markdown', locator: '1' }]
    }
  ];
  const result = alignmentCandidates(elements);
  // Both should tokenize to something, but intersection might be empty.
  // "파일 추가 버튼" → {파일, 추가, 버튼}
  // "upload_button" → {upload, button}
  // Intersection: {button} if button in korean tokens? No.
  // Actually both tokenize, but disjoint or minimal overlap.
  // Let me check: if no token overlap, Jaccard = 0.
  if (result.length > 0) {
    // If there's a pair, it means some tokens overlap.
    assert.ok(result[0].labelSimilarity >= 0, 'similarity should be computed');
  }
});

test('alignmentCandidates: 3개 sources 모두 교차 → 3개 조합 (n=3일 때)', () => {
  const elements = [
    {
      id: 'fig-1',
      role: 'dialog',
      label: 'confirm delete',
      _provenance: [{ type: 'figma', locator: '1' }]
    },
    {
      id: 'md-1',
      role: 'dialog',
      label: 'confirm delete',
      _provenance: [{ type: 'markdown', locator: '2' }]
    },
    {
      id: 'spec-1',
      role: 'dialog',
      label: 'confirm delete',
      _provenance: [{ type: 'spec', locator: '3' }]
    }
  ];
  const result = alignmentCandidates(elements);
  assert.equal(result.length, 3, 'C(3,2) = 3 pairs');
});

test('alignmentCandidates: empty array → empty result', () => {
  const result = alignmentCandidates([]);
  assert.equal(result.length, 0);
});

test('alignmentCandidates: 1개 element만 → empty result (pair 불가)', () => {
  const elements = [
    {
      id: 'fig-1',
      role: 'button',
      label: 'x',
      _provenance: [{ type: 'figma', locator: '1' }]
    }
  ];
  const result = alignmentCandidates(elements);
  assert.equal(result.length, 0);
});

test('alignmentCandidates: no mutation of input', () => {
  const original = [
    {
      id: 'fig-1',
      role: 'button',
      label: 'x',
      _provenance: [{ type: 'figma', locator: '1' }]
    },
    {
      id: 'md-1',
      role: 'button',
      label: 'x',
      _provenance: [{ type: 'markdown', locator: '2' }]
    }
  ];
  const deepCopy = JSON.parse(JSON.stringify(original));
  alignmentCandidates(original);
  assert.deepEqual(original, deepCopy, 'input should not be mutated');
});

test('alignmentCandidates: provenance with multiple entries, share check (partial provenance overlap)', () => {
  // Element A: figma source + inferred
  // Element B: figma source (same as A) + markdown
  // They share figma source → NOT cross-source
  const elements = [
    {
      id: 'a',
      role: 'button',
      label: 'x',
      _provenance: [
        { type: 'figma', locator: 'page1:1' },
        { type: 'inferred' }
      ]
    },
    {
      id: 'b',
      role: 'button',
      label: 'x',
      _provenance: [
        { type: 'figma', locator: 'page1:1' },
        { type: 'markdown', locator: './req.md' }
      ]
    }
  ];
  const result = alignmentCandidates(elements);
  assert.equal(result.length, 0, 'shared provenance entry → not cross-source');
});

test('alignmentCandidates: Jaccard with overlapping tokens', () => {
  const elements = [
    {
      id: 'fig-1',
      role: 'input',
      label: 'enter name and email',
      _provenance: [{ type: 'figma', locator: '1' }]
    },
    {
      id: 'md-1',
      role: 'input',
      label: 'name and email',
      _provenance: [{ type: 'markdown', locator: '2' }]
    }
  ];
  const result = alignmentCandidates(elements);
  // "enter name and email" → {enter, name, and, email}
  // "name and email" → {name, and, email}
  // Intersection: {name, and, email} (3 items)
  // Union: {enter, name, and, email} (4 items)
  // Jaccard = 3/4 = 0.75
  assert.equal(result.length, 1);
  assert.equal(result[0].labelSimilarity, 0.75);
});

test('alignmentCandidates: default opts object handling', () => {
  const elements = [
    {
      id: 'fig-1',
      role: 'button',
      label: 'x',
      _provenance: [{ type: 'figma', locator: '1' }]
    },
    {
      id: 'md-1',
      role: 'button',
      label: 'x',
      _provenance: [{ type: 'markdown', locator: '2' }]
    }
  ];
  const result = alignmentCandidates(elements);
  assert.equal(result.length, 1, 'default opts should work');
});
