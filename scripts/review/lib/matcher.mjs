// Minimal glob matcher supporting: **, *, ?, {a,b}
// Converts glob to RegExp.

export function matchGlob(filepath, pattern) {
  const re = globToRegExp(pattern);
  return re.test(filepath);
}

export function matchAny(filepath, patterns) {
  return patterns.some((p) => matchGlob(filepath, p));
}

function globToRegExp(glob) {
  // Tokenize first to handle ** vs * correctly
  let re = '^';
  let i = 0;
  while (i < glob.length) {
    const ch = glob[i];
    if (ch === '*' && glob[i + 1] === '*') {
      // ** — matches anything including /
      // If next char is /, consume it too: "**/" → ".*"
      if (glob[i + 2] === '/') {
        re += '(?:.*/)?';
        i += 3;
      } else {
        re += '.*';
        i += 2;
      }
    } else if (ch === '*') {
      // single * — matches any chars except /
      re += '[^/]*';
      i++;
    } else if (ch === '?') {
      re += '[^/]';
      i++;
    } else if (ch === '{') {
      const close = glob.indexOf('}', i);
      if (close === -1) { re += '\\{'; i++; continue; }
      const inner = glob.slice(i + 1, close);
      const opts = inner.split(',').map(escapeRe).join('|');
      re += `(?:${opts})`;
      i = close + 1;
    } else if ('.+^$()[]|\\'.includes(ch)) {
      re += '\\' + ch;
      i++;
    } else {
      re += ch;
      i++;
    }
  }
  re += '$';
  return new RegExp(re);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
