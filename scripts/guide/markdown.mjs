/**
 * 가이드용 소형 마크다운 렌더러 — 외부 의존을 두지 않기 위한 부분집합 구현.
 * 지원 문법은 tests/guideMarkdown.test.mjs 가 정의한다. 그 밖은 문단으로 렌더된다.
 */
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderInline(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    let m;
    if ((m = /^`([^`]+)`/.exec(rest))) { out += `<code>${esc(m[1])}</code>`; i += m[0].length; continue; }
    // 인라인 raw HTML — 근거 뱃지(<span class="ev …">)와 줄바꿈만. 그 밖의 태그는 글자로 남긴다.
    if ((m = /^<\/?(?:span|br)\b[^>]*>/.exec(rest))) { out += m[0]; i += m[0].length; continue; }
    if ((m = /^!\[([^\]]*)\]\(([^)\s]+)\)/.exec(rest))) { out += `<img alt="${esc(m[1])}" src="${esc(m[2])}">`; i += m[0].length; continue; }
    if ((m = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest))) { out += `<a href="${esc(m[2])}">${renderInline(m[1])}</a>`; i += m[0].length; continue; }
    if ((m = /^\*\*(.+?)\*\*/.exec(rest))) { out += `<strong>${renderInline(m[1])}</strong>`; i += m[0].length; continue; }
    if ((m = /^\*([^*]+?)\*/.exec(rest))) { out += `<em>${renderInline(m[1])}</em>`; i += m[0].length; continue; }
    out += esc(text[i]);
    i++;
  }
  return out;
}

function renderList(lines, start, indent) {
  // lines[start] 는 목록 항목. 같은 indent 의 항목을 모으고, 더 들여쓴 줄은 하위 목록으로.
  const isItem = (l, ind) => new RegExp(`^ {${ind}}(?:[-*]|\\d+\\.) `).test(l);
  const ordered = /^ *\d+\. /.test(lines[start]);
  let html = ordered ? '<ol>' : '<ul>';
  let i = start;
  while (i < lines.length && isItem(lines[i], indent)) {
    const text = lines[i].replace(/^ *(?:[-*]|\d+\.) /, '');
    let inner = renderInline(text);
    let j = i + 1;
    if (j < lines.length && isItem(lines[j], indent + 2)) {
      const sub = renderList(lines, j, indent + 2);
      inner += sub.html;
      j = sub.next;
    }
    html += `<li>${inner}</li>`;
    i = j;
  }
  html += ordered ? '</ol>' : '</ul>';
  return { html, next: i };
}

function renderTable(rows) {
  const cells = (r) => r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  const [head, , ...body] = rows;
  let html = '<table><thead><tr>' + cells(head).map((c) => `<th>${renderInline(c)}</th>`).join('') + '</tr></thead><tbody>';
  for (const r of body) html += '<tr>' + cells(r).map((c) => `<td>${renderInline(c)}</td>`).join('') + '</tr>';
  return html + '</tbody></table>';
}

export function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') { i++; continue; }
    let m;
    if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) { out.push(`<h${m[1].length}>${renderInline(m[2].trim())}</h${m[1].length}>`); i++; continue; }
    if (/^---+\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    if ((m = /^```(\w*)/.exec(line))) {
      const lang = m[1];
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      // 머메이드는 코드가 아니라 그림이다 — 빌드가 브라우저에서 그린다.
      out.push(lang === 'mermaid'
        ? `<pre class="mermaid">${esc(buf.join('\n'))}</pre>`
        : `<pre><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }
    if (/^</.test(line)) { // raw HTML 블록
      const open = /^<(figure|svg)\b/.exec(line);
      const buf = [];
      if (open) {
        // 손 SVG 는 안에 빈 줄이 있다 — 짝이 되는 닫는 태그까지 삼킨다.
        const close = new RegExp(`</${open[1]}>`);
        while (i < lines.length) { buf.push(lines[i]); if (close.test(lines[i])) { i++; break; } i++; }
      } else { // 그 밖의 raw HTML: 빈 줄까지 그대로
        while (i < lines.length && lines[i].trim() !== '') { buf.push(lines[i]); i++; }
      }
      out.push(buf.join('\n'));
      continue;
    }
    if (/^>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
      out.push(`<blockquote><p>${renderInline(buf.join(''))}</p></blockquote>`);
      continue;
    }
    if (/^\|/.test(line) && i + 1 < lines.length && /^\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i]); i++; }
      out.push(renderTable(rows));
      continue;
    }
    if (/^(?:[-*]|\d+\.) /.test(line)) { const r = renderList(lines, i, 0); out.push(r.html); i = r.next; continue; }
    if ((m = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/.exec(line))) { out.push(`<p>${renderInline(line.trim())}</p>`); i++; continue; } // 그림은 홀로 p
    // 문단: 빈 줄·블록 시작 전까지
    const buf = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,6}\s|```|>|\||(?:[-*]|\d+\.) |<|!\[)/.test(lines[i])) { buf.push(lines[i]); i++; }
    if (buf.length === 0) { buf.push(lines[i]); i++; }
    out.push(`<p>${renderInline(buf.join(' '))}</p>`);
  }
  return out.join('\n');
}
