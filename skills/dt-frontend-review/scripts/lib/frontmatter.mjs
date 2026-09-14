// Minimal YAML subset parser for pattern frontmatter.
// Supports:
// - scalar: key: value (quoted or unquoted)
// - inline array: key: [a, b, c]
// - nested array of maps:
//     key:
//       - subkey: val
//         subkey2: ["a", "b"]
// Does NOT support: anchors, refs, multiline strings, full YAML

const FRONT_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

export function parseFrontmatter(text) {
  const match = text.match(FRONT_RE);
  if (!match) return { data: null, body: text };
  const yaml = match[1];
  const body = match[2];
  const data = parseYamlSubset(yaml);
  return { data, body };
}

function parseYamlSubset(yaml) {
  const lines = yaml.split('\n');
  const result = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) { i++; continue; }
    const indent = line.match(/^ */)[0].length;
    if (indent !== 0) { i++; continue; } // top-level only
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) { i++; continue; }
    const key = line.slice(0, colonIdx).trim();
    const rest = line.slice(colonIdx + 1).trim();
    if (rest === '') {
      // value continues on next lines (nested)
      const block = collectChildren(lines, i + 1, indent);
      result[key] = parseBlock(block.children);
      i = block.nextIndex;
    } else if (rest.startsWith('[')) {
      result[key] = parseInlineArray(rest);
      i++;
    } else {
      result[key] = parseScalar(rest);
      i++;
    }
  }
  return result;
}

function collectChildren(lines, startIdx, parentIndent) {
  const children = [];
  let i = startIdx;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const indent = line.match(/^ */)[0].length;
    if (indent <= parentIndent) break;
    children.push(line);
    i++;
  }
  return { children, nextIndex: i };
}

function parseBlock(lines) {
  // Detect: array (starts with "- ") or map
  if (lines.length === 0) return null;
  const first = lines[0].trim();
  if (first.startsWith('- ')) {
    return parseArrayOfMaps(lines);
  }
  return parseMap(lines);
}

function parseArrayOfMaps(lines) {
  // Split by lines starting with "- " at the same indent
  const items = [];
  let current = null;
  let baseIndent = -1;
  for (const line of lines) {
    const indent = line.match(/^ */)[0].length;
    if (line.trim().startsWith('- ')) {
      if (baseIndent === -1) baseIndent = indent;
      if (current) items.push(parseMap(current));
      current = [line.replace(/^ *- /, ' '.repeat(indent + 2))];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) items.push(parseMap(current));
  return items;
}

function parseMap(lines) {
  const map = {};
  const baseIndent = lines[0].match(/^ */)[0].length;
  for (const line of lines) {
    const indent = line.match(/^ */)[0].length;
    if (indent !== baseIndent) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const rest = line.slice(colonIdx + 1).trim();
    if (rest.startsWith('[')) {
      map[key] = parseInlineArray(rest);
    } else if (rest) {
      map[key] = parseScalar(rest);
    }
  }
  return map;
}

function parseInlineArray(rest) {
  // rest like: ["a", "b", c] — respect quoted strings and {a,b} curly groups when splitting
  const inner = rest.slice(1, rest.lastIndexOf(']'));
  const items = [];
  let buf = '';
  let inQuote = null;
  let braceDepth = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (inQuote) {
      buf += ch;
      if (ch === inQuote) inQuote = null;
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
      buf += ch;
    } else if (ch === '{') {
      braceDepth++;
      buf += ch;
    } else if (ch === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
      buf += ch;
    } else if (ch === ',' && braceDepth === 0) {
      items.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf) items.push(buf);
  return items.map((s) => parseScalar(s.trim())).filter((s) => s !== '');
}

function parseScalar(value) {
  if (value === '') return '';
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  return value;
}
