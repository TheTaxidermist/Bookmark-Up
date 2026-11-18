import { countStructure, listNodes } from './bookmark-tree.js';

export function analyzeTree(tree) {
  const duplicatesByUrl = new Map();

  for (const { node, depth } of listNodes(tree)) {
    if (typeof node.url !== 'string') continue;
    const existing = duplicatesByUrl.get(node.url) ?? [];
    existing.push({
      id: node.id,
      name: node.title ?? '(untitled)',
      parentId: node.parentId,
      depth
    });
    duplicatesByUrl.set(node.url, existing);
  }

  return {
    ...countStructure(tree),
    duplicateCandidates: [...duplicatesByUrl.entries()]
      .filter(([, matches]) => matches.length > 1)
      .map(([url, matches]) => ({ url, matches }))
  };
}
