import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeExtractionResults } from '../scripts/mergeExtractionResults.mjs';

// Helper: create a minimal ExtractionResult
function createER(overrides = {}) {
  return {
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
    _possibleDuplicates: [],
    ...overrides
  };
}

test('mergeExtractionResults: 빈 partials 배열 → 빈 유효한 ExtractionResult 반환', () => {
  const result = mergeExtractionResults([]);
  assert.deepEqual(result, createER());
});

test('mergeExtractionResults: 단일 partial → 기본적으로 자신을 반환 (provenance 정규화)', () => {
  const partial = createER({
    components: [
      {
        name: 'Button',
        _provenance: { type: 'figma', locator: '235:1412' }
      }
    ],
    _sources: [{ type: 'figma', locator: '235:1412' }]
  });
  const result = mergeExtractionResults([partial]);
  assert.equal(result.components.length, 1);
  assert.equal(result.components[0].name, 'Button');
  // provenance should be normalized to array
  assert(Array.isArray(result.components[0]._provenance));
  assert.equal(result.components[0]._provenance[0].type, 'figma');
});

test('mergeExtractionResults: 동일한 component name 2개 source → 1개 item, 2개 provenance 축적', () => {
  const partial1 = createER({
    components: [
      {
        name: 'Button',
        _provenance: { type: 'figma', locator: '235:1412' }
      }
    ],
    _sources: [{ type: 'figma', locator: '235:1412' }]
  });
  const partial2 = createER({
    components: [
      {
        name: 'Button',
        _provenance: { type: 'markdown', locator: './req.md' }
      }
    ],
    _sources: [{ type: 'markdown', locator: './req.md' }]
  });
  const result = mergeExtractionResults([partial1, partial2]);
  assert.equal(result.components.length, 1);
  assert.equal(result.components[0].name, 'Button');
  assert.equal(result.components[0]._provenance.length, 2);
  assert.equal(result.components[0]._provenance[0].type, 'figma');
  assert.equal(result.components[0]._provenance[1].type, 'markdown');
});

test('mergeExtractionResults: 중복된 provenance 제거 (동일 provenance 객체 2개)', () => {
  const prov = { type: 'figma', locator: '235:1412' };
  const partial1 = createER({
    components: [
      {
        name: 'Button',
        _provenance: prov
      }
    ],
    _sources: [prov]
  });
  const partial2 = createER({
    components: [
      {
        name: 'Button',
        _provenance: prov
      }
    ],
    _sources: [prov]
  });
  const result = mergeExtractionResults([partial1, partial2]);
  assert.equal(result.components.length, 1);
  assert.equal(result.components[0]._provenance.length, 1);
});

test('mergeExtractionResults: 같은 id 다른 label → conflict 생성, 첫 값 유지', () => {
  const partial1 = createER({
    semanticUIElements: [
      {
        id: 'form-email',
        role: 'textbox',
        label: 'Email Address',
        _provenance: { type: 'figma', locator: '235:1412' }
      }
    ],
    _sources: [{ type: 'figma', locator: '235:1412' }]
  });
  const partial2 = createER({
    semanticUIElements: [
      {
        id: 'form-email',
        role: 'textbox',
        label: 'Email',
        _provenance: { type: 'markdown', locator: './req.md' }
      }
    ],
    _sources: [{ type: 'markdown', locator: './req.md' }]
  });
  const result = mergeExtractionResults([partial1, partial2]);
  assert.equal(result.semanticUIElements.length, 1);
  assert.equal(result.semanticUIElements[0].label, 'Email Address');
  assert.equal(result._conflicts.length, 1);
  assert.equal(result._conflicts[0].field, 'semanticUIElements[form-email].label');
  assert.equal(result._conflicts[0].values.length, 2);
  assert.equal(result._conflicts[0].values[0].value, 'Email Address');
  assert.equal(result._conflicts[0].values[1].value, 'Email');
});

test('mergeExtractionResults: null-completion — 한쪽이 비어있으면 다른 쪽으로 채우기 (conflict 아님)', () => {
  const partial1 = createER({
    semanticUIElements: [
      {
        id: 'form-email',
        role: 'textbox',
        label: 'Email Address',
        parentContext: undefined,
        _provenance: { type: 'figma', locator: '235:1412' }
      }
    ],
    _sources: [{ type: 'figma', locator: '235:1412' }]
  });
  const partial2 = createER({
    semanticUIElements: [
      {
        id: 'form-email',
        role: 'textbox',
        label: undefined,
        parentContext: 'ContactForm',
        _provenance: { type: 'markdown', locator: './req.md' }
      }
    ],
    _sources: [{ type: 'markdown', locator: './req.md' }]
  });
  const result = mergeExtractionResults([partial1, partial2]);
  assert.equal(result.semanticUIElements.length, 1);
  assert.equal(result.semanticUIElements[0].label, 'Email Address');
  assert.equal(result.semanticUIElements[0].parentContext, 'ContactForm');
  assert.equal(result._conflicts.length, 0);
});

test('mergeExtractionResults: 양쪽 모두 같은 값 → 그냥 유지 (conflict 아님)', () => {
  const partial1 = createER({
    semanticUIElements: [
      {
        id: 'form-email',
        role: 'textbox',
        label: 'Email Address',
        _provenance: { type: 'figma', locator: '235:1412' }
      }
    ],
    _sources: [{ type: 'figma', locator: '235:1412' }]
  });
  const partial2 = createER({
    semanticUIElements: [
      {
        id: 'form-email',
        role: 'textbox',
        label: 'Email Address',
        _provenance: { type: 'markdown', locator: './req.md' }
      }
    ],
    _sources: [{ type: 'markdown', locator: './req.md' }]
  });
  const result = mergeExtractionResults([partial1, partial2]);
  assert.equal(result.semanticUIElements.length, 1);
  assert.equal(result.semanticUIElements[0].label, 'Email Address');
  assert.equal(result._conflicts.length, 0);
});

test('mergeExtractionResults: _inferred 제거 — inferred item + real-source item 같은 key → merged는 _inferred 없음', () => {
  const partial1 = createER({
    components: [
      {
        name: 'Button',
        _provenance: { type: 'inferred' },
        _inferred: true
      }
    ],
    _sources: [{ type: 'figma', locator: '235:1412' }]
  });
  const partial2 = createER({
    components: [
      {
        name: 'Button',
        _provenance: { type: 'figma', locator: '235:1412' }
      }
    ],
    _sources: [{ type: 'figma', locator: '235:1412' }]
  });
  const result = mergeExtractionResults([partial1, partial2]);
  assert.equal(result.components.length, 1);
  assert(!result.components[0]._inferred);
  assert.equal(result.components[0]._provenance.length, 2);
});

test('mergeExtractionResults: apiCandidates keyed by endpoint (있으면), 없으면 featureName', () => {
  const partial1 = createER({
    apiCandidates: [
      {
        featureName: 'fetchUser',
        kind: 'query',
        sourceUiElement: 'UserCard',
        confidence: 'confident',
        endpoint: 'GET /api/users/:id',
        _provenance: { type: 'figma', locator: '235:1412' }
      }
    ],
    _sources: [{ type: 'figma', locator: '235:1412' }]
  });
  const partial2 = createER({
    apiCandidates: [
      {
        featureName: 'fetchUser',
        kind: 'query',
        sourceUiElement: 'UserCard',
        confidence: 'confident',
        endpoint: 'GET /api/users/:id',
        method: 'GET',
        _provenance: { type: 'markdown', locator: './req.md' }
      }
    ],
    _sources: [{ type: 'markdown', locator: './req.md' }]
  });
  const result = mergeExtractionResults([partial1, partial2]);
  assert.equal(result.apiCandidates.length, 1);
  assert.equal(result.apiCandidates[0].endpoint, 'GET /api/users/:id');
  assert.equal(result.apiCandidates[0].method, 'GET');
  assert.equal(result.apiCandidates[0]._provenance.length, 2);
});

test('mergeExtractionResults: businessRules union — 2개 source → 모두 유지 (중복 검출 아님)', () => {
  const partial1 = createER({
    businessRules: [
      {
        rule: 'Users can only edit their own profile',
        _provenance: { type: 'markdown', locator: './req.md' }
      }
    ],
    _sources: [{ type: 'markdown', locator: './req.md' }]
  });
  const partial2 = createER({
    businessRules: [
      {
        rule: 'Admin can edit any profile',
        _provenance: { type: 'markdown', locator: './req.md' }
      },
      {
        rule: 'Users can only edit their own profile',
        _provenance: { type: 'web', locator: 'https://wiki.example.com' }
      }
    ],
    _sources: [{ type: 'web', locator: 'https://wiki.example.com' }]
  });
  const result = mergeExtractionResults([partial1, partial2]);
  assert.equal(result.businessRules.length, 3);
  assert.equal(result.businessRules[0].rule, 'Users can only edit their own profile');
  assert.equal(result.businessRules[1].rule, 'Admin can edit any profile');
  assert.equal(result.businessRules[2].rule, 'Users can only edit their own profile');
});

test('mergeExtractionResults: pageMeta field merge — 양쪽 값 다르면 conflict', () => {
  const partial1 = createER({
    pageMeta: {
      title: 'User Profile',
      description: 'Shows user profile information',
      _provenance: { type: 'figma', locator: '235:1412' }
    },
    _sources: [{ type: 'figma', locator: '235:1412' }]
  });
  const partial2 = createER({
    pageMeta: {
      title: 'Profile',
      description: 'Shows user profile information',
      _provenance: { type: 'markdown', locator: './req.md' }
    },
    _sources: [{ type: 'markdown', locator: './req.md' }]
  });
  const result = mergeExtractionResults([partial1, partial2]);
  assert.equal(result.pageMeta.title, 'User Profile');
  assert.equal(result.pageMeta.description, 'Shows user profile information');
  assert.equal(result._conflicts.length, 1);
  assert.equal(result._conflicts[0].field, 'pageMeta.title');
});

test('mergeExtractionResults: pageMeta field merge — 한쪽 비어있으면 null-completion', () => {
  const partial1 = createER({
    pageMeta: {
      title: 'User Profile',
      description: undefined,
      _provenance: { type: 'figma', locator: '235:1412' }
    },
    _sources: [{ type: 'figma', locator: '235:1412' }]
  });
  const partial2 = createER({
    pageMeta: {
      title: undefined,
      description: 'Shows user profile information',
      _provenance: { type: 'markdown', locator: './req.md' }
    },
    _sources: [{ type: 'markdown', locator: './req.md' }]
  });
  const result = mergeExtractionResults([partial1, partial2]);
  assert.equal(result.pageMeta.title, 'User Profile');
  assert.equal(result.pageMeta.description, 'Shows user profile information');
  assert.equal(result._conflicts.length, 0);
});

test('mergeExtractionResults: designTokens/layoutTree/uiTree passthrough (최대 1개 source)', () => {
  const tokens = { colors: { primary: '#007bff' } };
  const partial1 = createER({
    designTokens: tokens,
    _sources: [{ type: 'figma', locator: '235:1412' }]
  });
  const partial2 = createER({
    businessRules: [{ rule: 'Some rule', _provenance: { type: 'markdown', locator: './req.md' } }],
    _sources: [{ type: 'markdown', locator: './req.md' }]
  });
  const result = mergeExtractionResults([partial1, partial2]);
  assert.deepEqual(result.designTokens, tokens);
});

test('mergeExtractionResults: _sources concat from all partials', () => {
  const partial1 = createER({
    _sources: [{ type: 'figma', locator: '235:1412' }]
  });
  const partial2 = createER({
    _sources: [{ type: 'markdown', locator: './req.md' }]
  });
  const partial3 = createER({
    _sources: [{ type: 'web', locator: 'https://example.com' }]
  });
  const result = mergeExtractionResults([partial1, partial2, partial3]);
  assert.equal(result._sources.length, 3);
  assert.equal(result._sources[0].type, 'figma');
  assert.equal(result._sources[1].type, 'markdown');
  assert.equal(result._sources[2].type, 'web');
});

test('mergeExtractionResults: _possibleDuplicates 항상 빈 배열 (step (b)에서 채워짐)', () => {
  const partial1 = createER({
    components: [
      {
        name: 'Button',
        _provenance: { type: 'figma', locator: '235:1412' }
      }
    ]
  });
  const result = mergeExtractionResults([partial1]);
  assert.deepEqual(result._possibleDuplicates, []);
});

test('mergeExtractionResults: provenance 정규화 — single object → array로 변환', () => {
  const partial = createER({
    components: [
      {
        name: 'Button',
        _provenance: { type: 'figma', locator: '235:1412' }
      }
    ]
  });
  const result = mergeExtractionResults([partial]);
  assert(Array.isArray(result.components[0]._provenance));
  assert.equal(result.components[0]._provenance.length, 1);
});

test('mergeExtractionResults: provenance 정규화 — array 그대로 유지', () => {
  const partial = createER({
    components: [
      {
        name: 'Button',
        _provenance: [
          { type: 'figma', locator: '235:1412' },
          { type: 'inferred' }
        ]
      }
    ]
  });
  const result = mergeExtractionResults([partial]);
  assert(Array.isArray(result.components[0]._provenance));
  assert.equal(result.components[0]._provenance.length, 2);
});

test('mergeExtractionResults: 여러 identified areas 혼합 merge', () => {
  const partial1 = createER({
    components: [
      {
        name: 'Button',
        _provenance: { type: 'figma', locator: '235:1412' }
      }
    ],
    semanticUIElements: [
      {
        id: 'btn-submit',
        role: 'button',
        _provenance: { type: 'figma', locator: '235:1412' }
      }
    ],
    _sources: [{ type: 'figma', locator: '235:1412' }]
  });
  const partial2 = createER({
    components: [
      {
        name: 'Input',
        _provenance: { type: 'markdown', locator: './req.md' }
      }
    ],
    semanticUIElements: [
      {
        id: 'inp-email',
        role: 'textbox',
        _provenance: { type: 'markdown', locator: './req.md' }
      }
    ],
    _sources: [{ type: 'markdown', locator: './req.md' }]
  });
  const result = mergeExtractionResults([partial1, partial2]);
  assert.equal(result.components.length, 2);
  assert.equal(result.semanticUIElements.length, 2);
  assert.equal(result._sources.length, 2);
});

test('mergeExtractionResults: conflict 기록 — 출처 정보 포함', () => {
  const partial1 = createER({
    semanticUIElements: [
      {
        id: 'form-email',
        role: 'textbox',
        label: 'Email Address',
        _provenance: { type: 'figma', locator: '235:1412' }
      }
    ]
  });
  const partial2 = createER({
    semanticUIElements: [
      {
        id: 'form-email',
        role: 'textbox',
        label: 'Email',
        _provenance: { type: 'markdown', locator: './req.md' }
      }
    ]
  });
  const result = mergeExtractionResults([partial1, partial2]);
  assert.equal(result._conflicts.length, 1);
  const conflict = result._conflicts[0];
  assert.equal(conflict.values[0].source, 'figma:235:1412');
  assert.equal(conflict.values[1].source, 'markdown:./req.md');
});

test('mergeExtractionResults: userStories/scenarios/edgeCases union 배열', () => {
  const partial1 = createER({
    userStories: [
      { text: 'As a user I want to login', _provenance: { type: 'markdown', locator: './req.md' } }
    ],
    scenarios: [
      { name: 'Happy path', _provenance: { type: 'markdown', locator: './req.md' } }
    ],
    edgeCases: [
      { case: 'Invalid email', _provenance: { type: 'markdown', locator: './req.md' } }
    ]
  });
  const partial2 = createER({
    userStories: [
      { text: 'As an admin I want to manage users', _provenance: { type: 'web', locator: 'https://wiki.example.com' } }
    ],
    scenarios: [
      { name: 'Error handling', _provenance: { type: 'web', locator: 'https://wiki.example.com' } }
    ],
    edgeCases: [
      { case: 'Network timeout', _provenance: { type: 'web', locator: 'https://wiki.example.com' } }
    ]
  });
  const result = mergeExtractionResults([partial1, partial2]);
  assert.equal(result.userStories.length, 2);
  assert.equal(result.scenarios.length, 2);
  assert.equal(result.edgeCases.length, 2);
});

test('mergeExtractionResults: apiCandidates featureName key (endpoint 없을 때)', () => {
  const partial1 = createER({
    apiCandidates: [
      {
        featureName: 'fetchUser',
        kind: 'query',
        sourceUiElement: 'UserCard',
        confidence: 'confident',
        _provenance: { type: 'figma', locator: '235:1412' }
      }
    ]
  });
  const partial2 = createER({
    apiCandidates: [
      {
        featureName: 'fetchUser',
        kind: 'query',
        sourceUiElement: 'UserCard',
        confidence: 'confident',
        method: 'GET',
        _provenance: { type: 'markdown', locator: './req.md' }
      }
    ]
  });
  const result = mergeExtractionResults([partial1, partial2]);
  assert.equal(result.apiCandidates.length, 1);
  assert.equal(result.apiCandidates[0].featureName, 'fetchUser');
  assert.equal(result.apiCandidates[0].method, 'GET');
});

test('mergeExtractionResults: apiCandidates 같은 endpoint + 구조적으로 동일한 requestSchema → conflict 없음', () => {
  const schema = { type: 'object', properties: { id: { type: 'string' } } };
  const partial1 = createER({
    apiCandidates: [
      {
        featureName: 'fetchUser',
        kind: 'query',
        sourceUiElement: 'UserCard',
        confidence: 'confident',
        endpoint: 'GET /api/users/:id',
        requestSchema: schema,
        _provenance: { type: 'figma', locator: '235:1412' }
      }
    ],
    _sources: [{ type: 'figma', locator: '235:1412' }]
  });
  const partial2 = createER({
    apiCandidates: [
      {
        featureName: 'fetchUser',
        kind: 'query',
        sourceUiElement: 'UserCard',
        confidence: 'confident',
        endpoint: 'GET /api/users/:id',
        requestSchema: { type: 'object', properties: { id: { type: 'string' } } },
        _provenance: { type: 'markdown', locator: './req.md' }
      }
    ],
    _sources: [{ type: 'markdown', locator: './req.md' }]
  });
  const result = mergeExtractionResults([partial1, partial2]);
  assert.equal(result.apiCandidates.length, 1);
  assert.equal(result.apiCandidates[0]._provenance.length, 2);
  assert.equal(result._conflicts.length, 0);
});

test('mergeExtractionResults: apiCandidates 같은 endpoint + 다른 requestSchema → conflict 기록', () => {
  const partial1 = createER({
    apiCandidates: [
      {
        featureName: 'fetchUser',
        kind: 'query',
        sourceUiElement: 'UserCard',
        confidence: 'confident',
        endpoint: 'GET /api/users/:id',
        requestSchema: { type: 'object', properties: { id: { type: 'string' } } },
        _provenance: { type: 'figma', locator: '235:1412' }
      }
    ],
    _sources: [{ type: 'figma', locator: '235:1412' }]
  });
  const partial2 = createER({
    apiCandidates: [
      {
        featureName: 'fetchUser',
        kind: 'query',
        sourceUiElement: 'UserCard',
        confidence: 'confident',
        endpoint: 'GET /api/users/:id',
        requestSchema: { type: 'object', properties: { userId: { type: 'number' } } },
        _provenance: { type: 'markdown', locator: './req.md' }
      }
    ],
    _sources: [{ type: 'markdown', locator: './req.md' }]
  });
  const result = mergeExtractionResults([partial1, partial2]);
  assert.equal(result.apiCandidates.length, 1);
  assert.equal(result._conflicts.length, 1);
  assert.equal(result._conflicts[0].field, 'apiCandidates[GET /api/users/:id].requestSchema');
});

test('mergeExtractionResults: 양쪽 모두 _inferred → merged 결과도 _inferred 유지', () => {
  const partial1 = createER({
    components: [
      {
        name: 'Button',
        _provenance: { type: 'inferred' },
        _inferred: true
      }
    ],
    _sources: []
  });
  const partial2 = createER({
    components: [
      {
        name: 'Button',
        _provenance: { type: 'inferred' },
        _inferred: true
      }
    ],
    _sources: []
  });
  const result = mergeExtractionResults([partial1, partial2]);
  assert.equal(result.components.length, 1);
  assert(result.components[0]._inferred);
  assert.equal(result.components[0]._provenance.length, 1);
  assert.equal(result.components[0]._provenance[0].type, 'inferred');
});
