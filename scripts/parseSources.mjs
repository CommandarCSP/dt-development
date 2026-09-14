export function parseSources(args) {
  const sources = [];

  // Consume tokens, respecting --source flag.
  for (let i = 0; i < args.length; i++) {
    const token = args[i];

    // --source flag: next token is the locator.
    if (token === '--source') {
      if (i + 1 >= args.length) {
        continue; // Skip missing locator.
      }
      const locator = args[++i];
      const parsed = parseLocator(locator);
      sources.push(parsed);
    } else if (token !== '--source' && !token.startsWith('--')) {
      // Positional argument.
      const parsed = parseLocator(token);
      sources.push(parsed);
    }
  }

  // Validate: at least one source.
  if (sources.length === 0) {
    throw new Error(
      '소스가 없습니다. figma 노드, .md/.pdf 경로, 또는 URL을 하나 이상 넣어주세요'
    );
  }

  // Validate cardinality: max 1 design, max 1 wireframe (only count explicit roles).
  const designCount = sources.filter(s => s.type === 'figma' && s.role === 'design').length;
  const wireframeCount = sources.filter(s => s.type === 'figma' && s.role === 'wireframe').length;

  if (designCount > 1) {
    throw new Error(
      'Figma 디자인 노드는 1개만 지원합니다. 한 화면이 여러 프레임으로 나뉘어 있으면 그 프레임들을 감싸는 상위 프레임 노드 id를 주세요(상위 노드로 우회).'
    );
  }

  if (wireframeCount > 1) {
    throw new Error(
      'Figma 와이어프레임 노드는 1개만 지원합니다. 한 화면이 여러 프레임으로 나뉘어 있으면 그 프레임들을 감싸는 상위 프레임 노드 id를 주세요(상위 노드로 우회).'
    );
  }

  return { sources };
}

export function parseLocator(token) {
  // Strip @role suffix before type detection.
  let locator = token;
  let role = undefined;

  const atIndex = token.lastIndexOf('@');
  if (atIndex > 0) {
    // Check if what follows @ is a valid role.
    const potentialRole = token.substring(atIndex + 1);
    if (potentialRole === 'design' || potentialRole === 'wireframe') {
      locator = token.substring(0, atIndex);
      role = potentialRole;
    }
  }

  // Detect type: Priority 1 → explicit type:locator.
  if (locator.includes(':')) {
    const colonIndex = locator.indexOf(':');
    const potentialType = locator.substring(0, colonIndex);
    if (['figma', 'markdown', 'pdf', 'web'].includes(potentialType)) {
      const actualLocator = locator.substring(colonIndex + 1);
      // Only attach role if type is figma.
      if (potentialType === 'figma') {
        return { type: potentialType, locator: actualLocator, ...(role && { role }) };
      } else {
        return { type: potentialType, locator: actualLocator };
      }
    }
  }

  // Rules 2–7: classify by pattern. Crucially, check for file/URL indicators FIRST to prevent
  // Windows paths or colon-containing paths from being mis-detected as node IDs by rule 7.

  // Check if locator looks like a file path or URL (has extension, or contains /, \, ://).
  const hasFilePathOrUrlIndicator =
    /\.[a-zA-Z0-9]+$/.test(locator) || // Has extension (e.g. .md, .pdf)
    locator.includes('/') ||
    locator.includes('\\') ||
    locator.includes('://');

  if (!hasFilePathOrUrlIndicator) {
    // Rule 7: pure node ID (no path/URL indicator) → check ^\d+:\d+$.
    if (/^\d+:\d+$/.test(locator)) {
      return { type: 'figma', locator, ...(role && { role }) };
    }
  }

  // Rules 2–6: path/URL classification (applies even if hasFilePathOrUrlIndicator is true).

  // Rule 2: contains figma.com/.
  if (locator.includes('figma.com/')) {
    return { type: 'figma', locator, ...(role && { role }) };
  }

  // Rule 3: ends with .md / .markdown / .txt.
  if (
    locator.endsWith('.md') ||
    locator.endsWith('.markdown') ||
    locator.endsWith('.txt')
  ) {
    return { type: 'markdown', locator };
  }

  // Rule 4: ends with .pdf.
  if (locator.endsWith('.pdf')) {
    return { type: 'pdf', locator };
  }

  // Rule 5: contains notion.so/ or .atlassian.net/.
  if (locator.includes('notion.so/') || locator.includes('.atlassian.net/')) {
    return { type: 'web', locator };
  }

  // Rule 6: other http:// or https://.
  if (locator.startsWith('http://') || locator.startsWith('https://')) {
    return { type: 'web', locator };
  }

  // None of the above: throw error.
  throw new Error(
    `소스 타입을 알 수 없습니다: ${locator}. figma 노드, .md/.pdf 경로, 또는 URL을 넣어주세요`
  );
}
