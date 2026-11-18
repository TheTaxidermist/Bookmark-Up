function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderHtmlNode(node, indent) {
  const prefix = ' '.repeat(indent);

  if (typeof node.url === 'string') {
    return `${prefix}<DT><A HREF="${escapeHtml(node.url)}">${escapeHtml(node.title ?? '')}</A>\n`;
  }

  const parts = [
    `${prefix}<DT><H3>${escapeHtml(node.title ?? '')}</H3>\n`,
    `${prefix}<DL><p>\n`
  ];

  for (const child of node.children ?? []) {
    parts.push(renderHtmlNode(child, indent + 4));
  }

  parts.push(`${prefix}</DL><p>\n`);
  return parts.join('');
}

export function serializeHtmlSnapshot(tree) {
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n',
    '<TITLE>Bookmarks</TITLE>\n',
    '<H1>Bookmarks</H1>\n',
    '<DL><p>\n'
  ];

  for (const child of tree.children ?? []) {
    lines.push(renderHtmlNode(child, 4));
  }

  lines.push('</DL><p>\n');
  return lines.join('');
}

export async function exportSnapshot(tree, download) {
  const timestamp = new Date().toISOString().replaceAll(':', '-');
  const json = JSON.stringify(tree, null, 2);
  const html = serializeHtmlSnapshot(tree);

  await download(`BookmarkUp_${timestamp}.json`, json, 'application/json');
  await download(`BookmarkUp_${timestamp}.html`, html, 'text/html');
}
