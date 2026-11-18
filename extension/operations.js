import { findNode, treeSignature } from './bookmark-tree.js';
import { createFolderPlan, moveBookmarkPlan, removeExactDuplicatePlan } from './plans.js';

export class BookmarkOperationError extends Error {
  constructor(message, recovery = 'not-needed') {
    super(message);
    this.name = 'BookmarkOperationError';
    this.recovery = recovery;
  }
}

function cloneTree(tree) {
  return JSON.parse(JSON.stringify(tree));
}

function getFolder(tree, folderId) {
  const folder = findNode(tree, folderId);
  if (!folder || !Array.isArray(folder.children)) {
    throw new Error('A folder in the approved plan no longer exists.');
  }
  return folder;
}

function sameTreeIgnoringDateModified(actual, expected, ignoredIds = new Set()) {
  if (Array.isArray(actual) || Array.isArray(expected)) {
    return Array.isArray(actual)
      && Array.isArray(expected)
      && actual.length === expected.length
      && actual.every((value, index) => sameTreeIgnoringDateModified(value, expected[index], ignoredIds));
  }

  if (actual && expected && typeof actual === 'object' && typeof expected === 'object') {
    const actualKeys = Object.keys(actual).sort();
    const expectedKeys = Object.keys(expected).sort();
    const actualCopy = { ...actual };
    const expectedCopy = { ...expected };
    delete actualCopy.dateModified;
    delete expectedCopy.dateModified;

    return actualKeys.length === expectedKeys.length
      && actualKeys.every((key, index) => key === expectedKeys[index]
        && sameTreeIgnoringDateModified(actualCopy[key], expectedCopy[key], ignoredIds));
  }

  return actual === expected;
}

function expectSameSnapshot(actual, expected) {
  if (treeSignature(actual) !== treeSignature(expected)) {
    throw new BookmarkOperationError('Bookmarks changed after plan review. No operation was applied.');
  }
}

function expectedMove(tree, plan) {
  const expected = cloneTree(tree);
  const source = getFolder(expected, plan.sourceParentId);
  const destination = getFolder(expected, plan.destinationId);
  const sourceIndex = source.children.findIndex((child) => child.id === plan.bookmarkId);

  if (sourceIndex < 0 || sourceIndex !== plan.sourceIndex) {
    throw new BookmarkOperationError('The bookmark\'s position changed after plan review.');
  }

  const [bookmark] = source.children.splice(sourceIndex, 1);
  if (destination.children.some((child) => child.id === bookmark.id)) {
    throw new BookmarkOperationError('The destination already contains this bookmark.');
  }

  destination.children.push(bookmark);
  bookmark.parentId = plan.destinationId;
  return expected;
}

function expectedFolder(tree, plan, created) {
  const expected = cloneTree(tree);
  const parent = getFolder(expected, plan.parentId);

  if (created.parentId !== plan.parentId || created.title !== plan.title || created.type !== 'folder') {
    throw new BookmarkOperationError('The browser returned an unexpected new folder.');
  }

  parent.children.push(created);
  return expected;
}

function expectedDuplicateRemoval(tree, plan) {
  const expected = cloneTree(tree);
  const removalIds = new Set(plan.removeIds);
  const keeper = findNode(expected, plan.keeperId);
  if (!keeper || typeof keeper.url !== 'string') {
    throw new BookmarkOperationError('The keeper no longer exists.');
  }

  for (const id of removalIds) {
    const node = findNode(expected, id);
    if (!node || typeof node.url !== 'string' || node.url !== keeper.url) {
      throw new BookmarkOperationError('A selected duplicate no longer matches the keeper URL exactly.');
    }
    const parent = findNode(expected, node.parentId);
    if (!parent || !Array.isArray(parent.children)) {
      throw new BookmarkOperationError('A duplicate no longer has a valid parent folder.');
    }
    const index = parent.children.findIndex((child) => child.id === id);
    if (index < 0) {
      throw new BookmarkOperationError('A duplicate is no longer present in the tree.');
    }
    parent.children.splice(index, 1);
  }

  return expected;
}

async function restoreMove(bookmarksApi, before, plan) {
  try {
    const current = await bookmarksApi.getTree();
    if (sameTreeIgnoringDateModified(current, before)) return 'already-unchanged';
    if (!sameTreeIgnoringDateModified(current, expectedMove(before, plan))) return 'not-safe-to-recover';

    await bookmarksApi.move(plan.bookmarkId, {
      parentId: plan.sourceParentId,
      index: plan.sourceIndex
    });

    const restored = await bookmarksApi.getTree();
    return sameTreeIgnoringDateModified(restored, before) ? 'recovered' : 'verification-failed';
  } catch {
    return 'recovery-failed';
  }
}

async function restoreDuplicateRemoval(bookmarksApi, before, plan) {
  try {
    const current = await bookmarksApi.getTree();
    if (sameTreeIgnoringDateModified(current, before)) return 'already-unchanged';
    if (!sameTreeIgnoringDateModified(current, expectedDuplicateRemoval(before, plan))) return 'not-safe-to-recover';

    for (const id of plan.removeIds) {
      const node = findNode(before, id);
      const parent = findNode(before, node.parentId);
      const index = parent.children.findIndex((child) => child.id === id);
      if (!node || !parent || index < 0) return 'not-safe-to-recover';
      parent.children.splice(index, 0, node);
    }

    const restored = await bookmarksApi.getTree();
    return sameTreeIgnoringDateModified(restored, before) ? 'recovered' : 'verification-failed';
  } catch {
    return 'recovery-failed';
  }
}

async function applyMove(bookmarksApi, tree, plan) {
  const checkedPlan = moveBookmarkPlan(tree, plan.bookmarkId, plan.destinationId);
  if (JSON.stringify(checkedPlan) !== JSON.stringify(plan)) {
    throw new BookmarkOperationError('The move no longer matches the reviewed plan.');
  }

  const expected = expectedMove(tree, plan);
  try {
    await bookmarksApi.move(plan.bookmarkId, {
      parentId: plan.destinationId,
      index: plan.destinationIndex
    });
    const after = await bookmarksApi.getTree();
    if (!sameTreeIgnoringDateModified(after, expected)) {
      throw new Error('The moved bookmark did not match the reviewed result.');
    }
    return { status: 'applied', tree: after };
  } catch (error) {
    const recovery = await restoreMove(bookmarksApi, tree, plan);
    const message = error instanceof Error ? error.message : 'The browser rejected the move.';
    throw new BookmarkOperationError(`${message} Recovery status: ${recovery}.`, recovery);
  }
}

async function applyFolderCreation(bookmarksApi, tree, plan) {
  const checkedPlan = createFolderPlan(tree, plan.parentId, plan.title);
  if (JSON.stringify(checkedPlan) !== JSON.stringify(plan)) {
    throw new BookmarkOperationError('Folder creation no longer matches the reviewed plan.');
  }

  let created;
  try {
    created = await bookmarksApi.create({ parentId: plan.parentId, title: plan.title });
    const after = await bookmarksApi.getTree();
    const actualCreated = findNode(after, created.id);
    if (!actualCreated) throw new Error('The browser did not return the new folder in the tree.');
    const expected = expectedFolder(tree, plan, actualCreated);
    if (!sameTreeIgnoringDateModified(after, expected)) {
      throw new Error('The new folder did not match the reviewed result.');
    }
    return { status: 'applied', tree: after };
  } catch (error) {
    let recovery = 'not-needed';
    if (created?.id) {
      try {
        const after = await bookmarksApi.getTree();
        const actualFolder = findNode(after, created.id);
        if (actualFolder && sameTreeIgnoringDateModified(after, expectedFolder(tree, plan, actualFolder))) {
          await bookmarksApi.remove(created.id);
          const restored = await bookmarksApi.getTree();
          recovery = sameTreeIgnoringDateModified(restored, tree) ? 'recovered' : 'verification-failed';
        } else {
          recovery = 'not-safe-to-recover';
        }
      } catch {
        recovery = 'recovery-failed';
      }
    }

    const message = error instanceof Error ? error.message : 'The browser rejected folder creation.';
    throw new BookmarkOperationError(`${message} Recovery status: ${recovery}.`, recovery);
  }
}

async function applyDuplicateRemoval(bookmarksApi, tree, plan) {
  const checkedPlan = removeExactDuplicatePlan(tree, plan.keeperId, plan.removeIds);
  if (JSON.stringify(checkedPlan) !== JSON.stringify(plan)) {
    throw new BookmarkOperationError('The duplicate-removal plan no longer matches the reviewed plan.');
  }

  const expected = expectedDuplicateRemoval(tree, plan);
  try {
    for (const id of plan.removeIds) {
      await bookmarksApi.remove(id);
    }
    const after = await bookmarksApi.getTree();
    if (!sameTreeIgnoringDateModified(after, expected)) {
      throw new Error('The duplicate removals did not match the reviewed result.');
    }
    return { status: 'applied', tree: after };
  } catch (error) {
    const recovery = await restoreDuplicateRemoval(bookmarksApi, tree, plan);
    const message = error instanceof Error ? error.message : 'The browser rejected the duplicate removals.';
    throw new BookmarkOperationError(`${message} Recovery status: ${recovery}.`, recovery);
  }
}

export async function applyReviewedOperation(bookmarksApi, reviewedTree, plan) {
  const currentTree = await bookmarksApi.getTree();
  expectSameSnapshot(currentTree, reviewedTree);

  if (plan.operation === 'move-bookmark') return applyMove(bookmarksApi, currentTree, plan);
  if (plan.operation === 'create-folder') return applyFolderCreation(bookmarksApi, currentTree, plan);
  if (plan.operation === 'remove-duplicate') return applyDuplicateRemoval(bookmarksApi, currentTree, plan);

  throw new BookmarkOperationError('This operation is not supported.');
}
