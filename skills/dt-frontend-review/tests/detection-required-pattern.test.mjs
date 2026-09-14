import test from 'node:test';
import assert from 'node:assert/strict';
import { detectRequiredPattern } from '../scripts/lib/detection/required-pattern.mjs';

test('flags if queryKey factory does not use params when params present', () => {
  const code = `
export function usePostListQuery({ limit }) {
  return useQuery({
    queryKey: postKeys.all,
    queryFn: () => fetch(\`/posts?limit=\${limit}\`),
  });
}
`;
  const cfg = { description: 'queryKey must include parameter when hook takes params' };
  const findings = detectRequiredPattern(code, cfg);
  // For v1, required-pattern is heuristic: flags only if code has 'queryKey:' followed by a non-call expression while params exist
  assert.equal(findings.length, 1);
});

test('no flag when queryKey calls factory with params', () => {
  const code = `
export function usePostListQuery({ limit }) {
  return useQuery({
    queryKey: postKeys.list({ limit }),
    queryFn: () => fetch(\`/posts?limit=\${limit}\`),
  });
}
`;
  const cfg = { description: 'queryKey must include parameter when hook takes params' };
  const findings = detectRequiredPattern(code, cfg);
  assert.equal(findings.length, 0);
});

test('flags request DTO with typed properties but no class-validator decorator', () => {
  const code = `export class CreateOrderDto {
  customerId: string;
  total: number;
}`;
  const cfg = { description: 'request DTO must carry class-validator decorator (validation at boundary)' };
  const findings = detectRequiredPattern(code, cfg);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].matched, 'request-dto-without-validator');
});

test('no flag when request DTO has a class-validator decorator', () => {
  const code = `import { IsString, IsPositive } from 'class-validator';
export class CreateOrderDto {
  @IsString() customerId: string;
  @IsPositive() total: number;
}`;
  const cfg = { description: 'request DTO must carry class-validator decorator (validation at boundary)' };
  const findings = detectRequiredPattern(code, cfg);
  assert.equal(findings.length, 0);
});

test('no flag for an empty marker DTO (no properties)', () => {
  const code = `export class EmptyDto {}`;
  const cfg = { description: 'request DTO must carry class-validator decorator' };
  const findings = detectRequiredPattern(code, cfg);
  assert.equal(findings.length, 0);
});

test('error-boundary: flags a page that renders JSX but has no ErrorBoundary', () => {
  const code = `export function PostListPage() {
  return <div><PostList /></div>;
}`;
  const cfg = { description: 'page must wrap children in an error boundary' };
  const findings = detectRequiredPattern(code, cfg);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].matched, 'page-without-error-boundary');
});

test('error-boundary: no flag when page renders an ErrorBoundary element', () => {
  const code = `export function PostListPage() {
  return <ApiErrorBoundary><PostList /></ApiErrorBoundary>;
}`;
  const cfg = { description: 'page must wrap children in an error boundary' };
  assert.equal(detectRequiredPattern(code, cfg).length, 0);
});

test('error-boundary: no flag when page uses withErrorBoundary HOC', () => {
  const code = `export default withErrorBoundary(PostListPage, { FallbackComponent: RetryErrorFallback });`;
  const cfg = { description: 'page must wrap children in an error boundary' };
  assert.equal(detectRequiredPattern(code, cfg).length, 0);
});

test('error-boundary: no flag for a non-JSX module in pages dir', () => {
  const code = `export const ROUTE = '/posts';`;
  const cfg = { description: 'page must wrap children in an error boundary' };
  assert.equal(detectRequiredPattern(code, cfg).length, 0);
});

test('returns manual review marker for unhandled descriptions', () => {
  const code = `const x = 1;`;
  const cfg = { description: 'arbitrary pattern check that v1 cannot do' };
  const findings = detectRequiredPattern(code, cfg);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].manualReview, true);
});
