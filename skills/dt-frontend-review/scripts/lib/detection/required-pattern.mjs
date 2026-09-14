// v1: handles a small set of known patterns by description string.
// Unknown descriptions emit a "manualReview" finding so reviewers know
// to inspect manually. Plan 3+ can add AST-based detection.

export function detectRequiredPattern(code, cfg) {
  const desc = (cfg.description || '').toLowerCase();

  // Pattern A: queryKey must include parameter
  if (desc.includes('querykey') && (desc.includes('parameter') || desc.includes('파라미터'))) {
    return checkQueryKeyParam(code);
  }

  // Pattern B: request DTO must carry class-validator decorators (validation at boundary)
  if (desc.includes('class-validator') || (desc.includes('dto') && desc.includes('valid'))) {
    return checkDtoHasValidator(code);
  }

  // Pattern C: a page module must render an error boundary somewhere
  if (desc.includes('error boundary') || desc.includes('errorboundary')) {
    return checkHasErrorBoundary(code);
  }

  // Default: cannot enforce automatically — flag for manual review
  return [{ manualReview: true, hint: cfg.description || 'unknown required-pattern' }];
}

// A page that renders JSX must contain an ErrorBoundary (element or withErrorBoundary HOC).
// Non-JSX modules (constants/helpers that happen to live under pages/) are exempt.
function checkHasErrorBoundary(code) {
  const rendersJsx = /return\s*\(?\s*</.test(code) || /=>\s*</.test(code);
  if (!rendersJsx) return [];
  if (/<\s*[A-Za-z]*ErrorBoundary[\s/>]/.test(code)) return [];
  if (/withErrorBoundary\s*\(/.test(code)) return [];
  const idx = code.search(/return\s*\(?\s*</);
  const line = idx >= 0 ? code.slice(0, idx).split('\n').length : 1;
  return [{ matched: 'page-without-error-boundary', line }];
}

// A request DTO that declares typed properties must validate at least one of them
// with a class-validator decorator. A DTO with no properties (marker/empty) passes.
const VALIDATOR_DECORATOR_RE = /@(Is[A-Z]\w*|Min|Max|Length|MinLength|MaxLength|Matches|ValidateNested|ValidateIf|ArrayMinSize|ArrayMaxSize|IsOptional|Type)\s*\(/;
const PROPERTY_RE = /^\s*(?:readonly\s+)?[a-zA-Z_]\w*\??\s*:\s*[^;]+;/m;

function checkDtoHasValidator(code) {
  // Only meaningful for files declaring a class.
  if (!/\bclass\s+\w+/.test(code)) return [];
  // No typed properties → nothing to validate.
  if (!PROPERTY_RE.test(code)) return [];
  if (VALIDATOR_DECORATOR_RE.test(code)) return [];
  // Has properties but zero validator decorators.
  const classLine = code.slice(0, code.search(/\bclass\s+\w+/)).split('\n').length;
  return [{ matched: 'request-dto-without-validator', line: classLine }];
}

function checkQueryKeyParam(code) {
  // Find functions that take destructured params: function foo({ param1, param2 })
  const fnRe = /function\s+\w+\s*\(\s*\{([^}]+)\}/g;
  let m;
  const findings = [];

  while ((m = fnRe.exec(code)) !== null) {
    const paramNames = m[1]
      .split(',')
      .map((s) => s.trim().split(':')[0].trim())
      .filter(Boolean);

    if (paramNames.length === 0) continue;

    // Look for queryKey: expression in the code from this function start
    const start = m.index;
    const tail = code.slice(start);
    const queryKeyMatch = tail.match(/queryKey:\s*([^\n,]+)/);
    if (!queryKeyMatch) continue;

    const queryKeyExpr = queryKeyMatch[1].trim();

    // Flag if expression doesn't reference any param name
    const usesParam = paramNames.some((p) => new RegExp(`\\b${escapeRe(p)}\\b`).test(queryKeyExpr));
    if (!usesParam) {
      const lineOffset = code.slice(0, start + tail.indexOf(queryKeyMatch[0])).split('\n').length;
      findings.push({ matched: 'queryKey-without-params', line: lineOffset, expression: queryKeyExpr });
    }
  }
  return findings;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
