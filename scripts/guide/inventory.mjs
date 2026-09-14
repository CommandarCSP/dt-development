/**
 * 인벤토리(docs/guide/inventory.md) 파싱·검증 — 던지지 않고 { kind:'failed', reason } 을 돌려준다(게이트가 한 줄로 찍는다).
 * 스키마: 스펙 §5-2. 게이트 G2 의 왼쪽 항이자 캡처·집필의 입력.
 */
import { splitFrontMatter } from './frontMatter.mjs';

export const CAPTURE_MODES = ['auto', 'manual', 'none'];
const SCENARIO_ID = /^S\d+$/;
const SCREEN_ID = /^SCR-[a-z0-9][a-z0-9-]*$/;

export function parseInventory(raw) {
  let fm;
  try { fm = splitFrontMatter(raw); } catch (err) { return { kind: 'failed', reason: `front matter 를 읽지 못했다: ${err.message}` }; }
  if (!fm) return { kind: 'failed', reason: 'front matter 가 없다 — inventory.md 는 --- 로 감싼 YAML 로 시작해야 한다.' };
  const d = fm.data;
  const fail = (reason) => ({ kind: 'failed', reason });

  if (typeof d.version !== 'string') return fail(`version 이 문자열이 아니다: ${String(d.version)}`);
  if (d.type !== 'web' && d.type !== 'electron') return fail(`type 은 web|electron 이어야 한다: ${String(d.type)}`);
  if (typeof d.product !== 'string' || d.product === '') return fail('product 가 없다.');
  if (!Array.isArray(d.screens)) return fail('screens 가 배열이 아니다.');
  if (!Array.isArray(d.scenarios)) return fail('scenarios 가 배열이 아니다(없으면 빈 배열).');

  const screenIds = new Set();
  for (const [i, s] of d.screens.entries()) {
    if (typeof s?.id !== 'string' || !SCREEN_ID.test(s.id)) return fail(`screens[${i}].id 는 SCR-<slug> 형식이어야 한다: ${String(s?.id)}`);
    if (screenIds.has(s.id)) return fail(`화면 id 중복: ${s.id}`);
    screenIds.add(s.id);
    if (typeof s.title !== 'string') return fail(`${s.id}: title 이 없다.`);
    if (typeof s.route !== 'string') return fail(`${s.id}: route 가 없다(web: URL 경로 · electron: view:… / window:… / external).`);
    const cap = s.capture ?? {};
    const mode = cap.mode ?? 'auto';
    if (!CAPTURE_MODES.includes(mode)) return fail(`${s.id}: capture.mode 는 auto|manual|none 이어야 한다: ${String(mode)}`);
    if (mode === 'none' && (typeof cap.reason !== 'string' || cap.reason === '')) return fail(`${s.id}: capture.mode none 이면 reason 이 필요하다.`);
    s.capture = { ...cap, mode, needs: Array.isArray(cap.needs) ? cap.needs : [] };
    if (s.publish === undefined) s.publish = true;
    if (typeof s.publish !== 'boolean') return fail(`${s.id}: publish 는 참/거짓이어야 한다.`);
    if (!Array.isArray(s.source) || s.source.length === 0) return fail(`${s.id}: source 라벨이 하나 이상 필요하다.`);
  }
  const scenarioIds = new Set();
  for (const [i, sc] of d.scenarios.entries()) {
    if (typeof sc?.id !== 'string' || !SCENARIO_ID.test(sc.id)) return fail(`scenarios[${i}].id 는 S<n> 형식이어야 한다: ${String(sc?.id)}`);
    if (scenarioIds.has(sc.id)) return fail(`시나리오 id 중복: ${sc.id}`);
    scenarioIds.add(sc.id);
    if (typeof sc.title !== 'string') return fail(`${sc.id}: title 이 없다.`);
    if (!Array.isArray(sc.steps) || sc.steps.length === 0) return fail(`${sc.id}: steps 가 비었다.`);
    for (const step of sc.steps) if (!screenIds.has(step)) return fail(`${sc.id}: steps 의 ${step} 이 screens 에 없다.`);
    if (!Array.isArray(sc.source) || sc.source.length === 0) return fail(`${sc.id}: source 라벨이 하나 이상 필요하다.`);
    if (sc.publish === undefined) sc.publish = true;
    if (typeof sc.publish !== 'boolean') return fail(`${sc.id}: publish 는 참/거짓이어야 한다.`);
  }
  return { kind: 'ok', inventory: d, body: fm.body };
}

/** 가이드·게이트가 다루는 항목 — publish:true 만. 시나리오 먼저, 그 다음 화면(인벤토리 순서). */
export function publishedItems(inventory) {
  const out = [];
  for (const sc of inventory.scenarios) if (sc.publish !== false) out.push({ id: sc.id, kind: 'scenario', title: sc.title });
  for (const s of inventory.screens) if (s.publish !== false) out.push({ id: s.id, kind: 'screen', title: s.title, captureMode: s.capture.mode });
  return out;
}
