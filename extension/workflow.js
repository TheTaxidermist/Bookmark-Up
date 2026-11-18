import { treeSignature } from './bookmark-tree.js';
import { applyReviewedOperation } from './operations.js';

export let Bookmarks_backed_up = 0;

export async function executeReviewedPlan({
  bookmarksApi,
  reviewedTree,
  plan,
  backup,
  confirmRisk
}) {
  Bookmarks_backed_up = 0;

  let currentTree;
  try {
    currentTree = await bookmarksApi.getTree();
  } catch (error) {
    return { status: 'read-failed', error };
  }

  if (treeSignature(currentTree) !== treeSignature(reviewedTree)) {
    return { status: 'stale' };
  }

  if (backup) {
    try {
      await backup(currentTree);
    } catch (error) {
      return { status: 'backup-failed', error };
    }

    let afterBackup;
    try {
      afterBackup = await bookmarksApi.getTree();
    } catch (error) {
      return { status: 'read-failed', error };
    }

    if (treeSignature(afterBackup) !== treeSignature(reviewedTree)) {
      return { status: 'stale' };
    }

    Bookmarks_backed_up = 1;
  } else {
    const accepted = await confirmRisk();
    if (!accepted) return { status: 'risk-declined' };

    let afterConfirmation;
    try {
      afterConfirmation = await bookmarksApi.getTree();
    } catch (error) {
      return { status: 'read-failed', error };
    }

    if (treeSignature(afterConfirmation) !== treeSignature(reviewedTree)) {
      return { status: 'stale' };
    }
  }

  try {
    const result = await applyReviewedOperation(bookmarksApi, reviewedTree, plan);
    return { status: 'applied', result, backedUp: Bookmarks_backed_up === 1 };
  } catch (error) {
    return { status: 'failed', error, backedUp: Bookmarks_backed_up === 1 };
  }
}
