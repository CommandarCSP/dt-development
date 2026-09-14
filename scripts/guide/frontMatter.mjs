/**
 * YAML 부분집합 파서 — 인벤토리·가이드 front matter 전용. 외부 의존을 두지 않기 위한 최소 구현.
 * 지원: 스칼라, 따옴표 문자열, 인라인 배열 [a, b], 인라인 맵 { k: v }, 블록 배열 "- ", 블록 맵(2칸 들여쓰기).
 * 미지원: 앵커, 멀티라인 스칼라, 주석 외 특수 문법 → 그런 파일은 쓰지 않는다(스펙 §5-2).
 */
function scalar(s) {
  const t = s.trim();
  if (t === '' || t === 'null' || t === '~') return null;
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(t) && !/^\d+\.\d+\.\d+$/.test(t)) return Number(t);
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  if (t.startsWith('[') && t.endsWith(']')) return splitTop(t.slice(1, -1)).filter((x) => x.trim() !== '').map(scalar);
  if (t.startsWith('{') && t.endsWith('}')) {
    const obj = {};
    for (const part of splitTop(t.slice(1, -1))) {
      if (part.trim() === '') continue;
      const i = part.indexOf(':');
      obj[part.slice(0, i).trim()] = scalar(part.slice(i + 1));
    }
    return obj;
  }
  return t;
}

/** 최상위 쉼표로 분리(중첩 괄호·따옴표 안은 무시). */
function splitTop(s) {
  const out = [];
  let depth = 0, quote = null, cur = '';
  for (const ch of s) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === '[' || ch === '{') depth++;
    if (ch === ']' || ch === '}') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim() !== '') out.push(cur);
  return out;
}

function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) { if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '#' && (i === 0 || line[i - 1] === ' ')) return line.slice(0, i);
  }
  return line;
}

function parseBlock(lines, indent) {
  // 배열인지 맵인지는 첫 유효 줄로 결정
  const first = lines.find((l) => l.text.trim() !== '');
  if (!first) return null;
  if (first.text.trim().startsWith('- ')) return parseArray(lines, indent);
  return parseMap(lines, indent);
}

function parseArray(lines, indent) {
  const arr = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.text.trim() === '') { i++; continue; }
    const content = l.text.slice(indent + 2); // "- " 뒤
    // 항목 본문: 같은 줄 내용 + 더 들여쓴 후속 줄들
    const children = [];
    let j = i + 1;
    while (j < lines.length && (lines[j].text.trim() === '' || lines[j].indent > indent)) { children.push(lines[j]); j++; }
    if (content.includes(':') && !content.trim().startsWith('{') && !content.trim().startsWith('[') && !/^['"]/.test(content.trim())) {
      // "- id: S1" 형태 → 맵의 첫 키. 후속 줄은 indent+2 로 정렬된 맵의 나머지 키
      const merged = [{ indent: indent + 2, text: ' '.repeat(indent + 2) + content }, ...children];
      arr.push(parseMap(merged, indent + 2));
    } else if (content.trim() === '') {
      arr.push(parseBlock(children, indent + 2));
    } else {
      arr.push(scalar(content));
    }
    i = j;
  }
  return arr;
}

function parseMap(lines, indent) {
  const obj = {};
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.text.trim() === '') { i++; continue; }
    const text = l.text.slice(indent);
    const ci = text.indexOf(':');
    if (ci === -1) throw new Error(`front matter ${l.no}행: 키가 없다 — "${l.text.trim()}"`);
    const key = text.slice(0, ci).trim();
    const rest = text.slice(ci + 1);
    const children = [];
    let j = i + 1;
    while (j < lines.length && (lines[j].text.trim() === '' || lines[j].indent > indent)) { children.push(lines[j]); j++; }
    const kids = children.filter((c) => c.text.trim() !== '');
    if (rest.trim() === '' && kids.length > 0) {
      // "key:" 아래 유일한 자식이 인라인 빈/축약 컬렉션(`[]`·`{}`·`[a, b]`)이면 그것이 값이다.
      const only = kids.length === 1 ? kids[0].text.trim() : '';
      if (/^\[[\s\S]*\]$/.test(only) || /^\{[\s\S]*\}$/.test(only)) { obj[key] = scalar(only); i = j; continue; }
      obj[key] = parseBlock(children, kids[0].indent);
    } else {
      obj[key] = scalar(rest);
    }
    i = j;
  }
  return obj;
}

export function parseYamlSubset(src) {
  const lines = src.split('\n').map((raw, idx) => {
    const text = stripComment(raw).replace(/\s+$/, '');
    return { no: idx + 1, text, indent: text.length - text.trimStart().length };
  });
  return parseBlock(lines, 0) ?? {};
}

export function splitFrontMatter(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!m) return null;
  return { data: parseYamlSubset(m[1]), body: m[2] };
}
