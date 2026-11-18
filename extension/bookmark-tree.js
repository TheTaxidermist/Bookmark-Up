export function walkTree(tree, visit, depth = 0) {
  if (!tree) return;
  visit(tree, depth);
  for (const child of tree.children ?? []) {
    walkTree(child, visit, depth + 1);
  }
}

export function listNodes(tree) {
  const nodes = [];
  walkTree(tree, (node, depth) => nodes.push({ node, depth }));
  return nodes;
}

export function findNode(tree, id) {
  const match = listNodes(tree).find(({ node }) => node.id === id);
  return match ? match.node : null;
}

export function countStructure(tree) {
  let bookmarkCount = 0;
  let folderCount = 0;
  let deepestBookmarkLevel = 0;

  walkTree(tree, (node, depth) => {
    if (typeof node.url === 'string') {
      bookmarkCount += 1;
      deepestBookmarkLevel = Math.max(deepestBookmarkLevel, depth);
    } else if (Array.isArray(node.children)) {
      folderCount += 1;
    }
  });

  return { bookmarkCount, folderCount, deepestBookmarkLevel };
}

export function treeSignature(tree) {
  return JSON.stringify(tree);
}
