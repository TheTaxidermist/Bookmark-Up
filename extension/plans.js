import { findNode } from './bookmark-tree.js';

export function createFolderPlan(tree, parentId, title) {
  const parent = findNode(tree, parentId);
  const normalizedTitle = title.trim();

  if (!parent || !Array.isArray(parent.children) || parent.id === '0') {
    throw new Error('Choose an existing folder for the new folder.');
  }
  if (!normalizedTitle) {
    throw new Error('Enter a folder name.');
  }

  return {
    operation: 'create-folder',
    parentId,
    title: normalizedTitle
  };
}

export function moveBookmarkPlan(tree, bookmarkId, destinationId) {
  const bookmark = findNode(tree, bookmarkId);
  const destination = findNode(tree, destinationId);

  if (!bookmark || typeof bookmark.url !== 'string') {
    throw new Error('Choose an existing bookmark to move.');
  }
  if (!destination || !Array.isArray(destination.children) || destination.id === '0') {
    throw new Error('Choose an existing folder as the destination.');
  }
  if (bookmark.parentId === destinationId) {
    throw new Error('The bookmark is already in that folder; reordering is not supported.');
  }

  const source = findNode(tree, bookmark.parentId);
  if (!source || !Array.isArray(source.children)) {
    throw new Error('The bookmark\'s current folder could not be found.');
  }

  const sourceIndex = source.children.findIndex((child) => child.id === bookmarkId);
  if (sourceIndex < 0) {
    throw new Error('The bookmark\'s current position could not be found.');
  }

  return {
    operation: 'move-bookmark',
    bookmarkId,
    title: bookmark.title ?? '',
    url: bookmark.url,
    sourceParentId: bookmark.parentId,
    sourceIndex,
    destinationId,
    destinationIndex: destination.children.length
  };
}

export function removeExactDuplicatePlan(tree, keeperId, removalIds) {
  const keeper = findNode(tree, keeperId);
  if (!keeper || typeof keeper.url !== 'string') {
    throw new Error('Choose an existing bookmark as the keeper.');
  }

  const toRemove = Array.isArray(removalIds) ? removalIds : [removalIds];
  if (toRemove.length === 0) {
    throw new Error('Choose at least one duplicate to remove.');
  }

  const duplicateNodes = toRemove.map((id) => findNode(tree, id)).filter(Boolean);
  if (duplicateNodes.length !== toRemove.length) {
    throw new Error('Only exact duplicates in the selected URL group can be removed.');
  }

  const keeperUrl = keeper.url;
  const invalid = duplicateNodes.some((node) => node.id === keeperId || typeof node.url !== 'string' || node.url !== keeperUrl);
  if (invalid) {
    throw new Error('The selected duplicates must all match the same exact URL as the keeper.');
  }

  return {
    operation: 'remove-duplicate',
    keeperId,
    keeperTitle: keeper.title ?? '',
    keeperUrl,
    removeIds: [...new Set(toRemove)]
  };
}
