/**
 * 마크다운 본문 + 테마 → 단일 HTML(이미지·글꼴 인라인).
 * fs 와 렌더러를 주입받는다 — 조립 규칙만 여기.
 * 치환값은 함수로 넘긴다 — 문자열로 넘기면 본문의 $& $' 같은 패턴이 해석된다(코드 블록의 셸 문장이 깨진다).
 */
const SRC_RE = /<img\b([^>]*?)\bsrc="([^"]+)"/g;
const isPassThrough = (src) => src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://');

const H2_RE = /<h2\b([^>]*)>([\s\S]*?)<\/h2>/g;
const stripTags = (html) => html.replace(/<[^>]+>/g, '').trim();

/**
 * 절(h2) 목차 — 제목마다 id 를 달고 목차 HTML 을 만든다.
 *
 * 왜 h2 만인가: 한 판 실측에서 제목이 40개를 넘었고(h3 포함), 그걸 다 넣으면
 * 목차가 두 쪽을 먹어 오히려 진입로가 아니라 벽이 된다. 절만 보이면 독자가
 * "어디를 펴면 되는지" 를 한눈에 고른다.
 *
 * 표지(h1)는 넣지 않는다 — 목차에서 제 자신을 가리키는 항목은 쓸모가 없다.
 * 절이 하나도 없으면 **빈 상자를 만들지 않는다**(html = '').
 *
 * **번호를 스스로 매기지 않는다**(`<ul>`). 절 제목이 이미 "0. 이 문서에 대하여"
 * 처럼 번호를 갖기 때문에 `<ol>` 을 쓰면 "1. 0. 이 문서에 대하여" 가 된다.
 */
export function buildToc(renderedHtml) {
  const entries = [];
  const used = new Map();
  const body = renderedHtml.replace(H2_RE, (whole, attrs, inner) => {
    const text = stripTags(inner);
    if (text === '') return whole;
    // 한글 제목은 슬러그로 만들면 빈 문자열이 되기 쉽다 — 순번을 쓴다.
    const base = `sec-${entries.length + 1}`;
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    const id = n === 1 ? base : `${base}-${n}`;
    entries.push({ id, text });
    return `<h2${attrs} id="${id}">${inner}</h2>`;
  });

  const html =
    entries.length === 0
      ? ''
      : `<nav class="toc"><h2 class="toc-title">목차</h2><ul>${entries
          .map((e) => `<li><a href="#${e.id}">${e.text}</a></li>`)
          .join('')}</ul></nav>`;

  return { entries, html, body };
}

export function assembleGuideHtml({ markdown, theme, version, title, fontCss, renderMarkdown, resolveAsset }) {
  const rendered = renderMarkdown(markdown);
  const toc = buildToc(rendered);
  const withImages = toc.body.replace(SRC_RE, (whole, attrs, src) => (isPassThrough(src) ? whole : `<img${attrs}src="${resolveAsset(src)}"`));
  // 함정 ③: 본문을 **마지막에** 끼운다 — 먼저 넣으면 본문 속 {{VERSION}} 같은 문자열이 뒤이은 치환에 걸린다.
  // 목차는 **표지 뒤**에 온다 — 표지가 1쪽이어야 한다. 표지와 본문을 가르는
  // `<div class="page-break">` 바로 다음이 그 자리다. 그 구분이 없는 문서(표지를
  // 따로 두지 않은 짧은 가이드)는 맨 앞에 둔다.
  const BREAK = '<div class="page-break"></div>';
  const at = withImages.indexOf(BREAK);
  const body =
    at === -1
      ? toc.html + withImages
      : withImages.slice(0, at + BREAK.length) + toc.html + withImages.slice(at + BREAK.length);

  return theme
    .replaceAll('{{TITLE}}', () => title)
    .replaceAll('{{VERSION}}', () => version)
    .replaceAll('{{FONT_CSS}}', () => fontCss)
    .replaceAll('{{CONTENT}}', () => body);
}

export const FONT_FILES = [
  { weight: 400, file: 'Pretendard-Regular.woff2' },
  { weight: 700, file: 'Pretendard-Bold.woff2' },
];

/** @font-face 2개 — readFont(name) 은 templates/fonts/<name> 의 Buffer 를 돌려준다(빌더가 주입). */
export function buildFontCss(readFont) {
  return FONT_FILES.map(({ weight, file }) => `@font-face{font-family:'Pretendard';font-weight:${weight};font-style:normal;font-display:block;src:url(data:font/woff2;base64,${readFont(file).toString('base64')}) format('woff2');}`).join('\n');
}
