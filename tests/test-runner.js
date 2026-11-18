import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'extension', 'manifest.json'), 'utf8'));

const {
  analyzeTree
} = await import('../extension/analysis.js');
const {
  findNode
} = await import('../extension/bookmark-tree.js');
const {
  createFolderPlan,
  moveBookmarkPlan,
  removeExactDuplicatePlan
} = await import('../extension/plans.js');
const {
  applyReviewedOperation
} = await import('../extension/operations.js');
const {
  executeReviewedPlan,
  Bookmarks_backed_up
} = await import('../extension/workflow.js');

function makeTree() {
  return {
    id: 'root',
    title: 'Bookmarks',
    type: 'folder',
    children: [
      {
        id: 'folder-alpha',
        title: 'Alpha',
        type: 'folder',
        parentId: 'root',
        children: [
          { id: 'b1', title: 'One', type: 'url', url: 'https://example.com/one', parentId: 'folder-alpha' },
          { id: 'b2', title: 'One Clone', type: 'url', url: 'https://example.com/one', parentId: 'folder-alpha' },
          { id: 'b3', title: 'Different Query', type: 'url', url: 'https://example.com/one?x=1', parentId: 'folder-alpha' },
          { id: 'b4', title: 'Other', type: 'url', url: 'https://example.com/other', parentId: 'folder-alpha' }
        ]
      },
      {
        id: 'folder-beta',
        title: 'Beta',
        type: 'folder',
        parentId: 'root',
        children: [
          { id: 'b5', title: 'Another One', type: 'url', url: 'https://example.com/one', parentId: 'folder-beta' }
        ]
      }
    ]
  };
}

async function run() {
  assert.equal(manifest.manifest_version, 3, 'Extension should be a Manifest V3 target.');
  assert.deepEqual(manifest.permissions, ['bookmarks', 'downloads'], 'Permission footprint must stay minimal and browser-specific.');
  assert.ok(!manifest.host_permissions || manifest.host_permissions.length === 0, 'No external host permissions should be requested.');

  const tree = makeTree();
  const summary = analyzeTree(tree);
  assert.equal(summary.bookmarkCount, 5, 'The synthetic tree should enumerate all bookmark nodes.');
  assert.equal(summary.folderCount, 3, 'The tree should include the root folder and child folders in the count.');
  assert.equal(summary.duplicateCandidates.length, 1, 'Only the exact URL matches should be reported as duplicates.');
  assert.deepEqual(
    summary.duplicateCandidates[0].matches.map((match) => match.id).sort(),
    ['b1', 'b2', 'b5'],
    'Only exact URL equality should create duplicate candidates.'
  );

  const folderPlan = createFolderPlan(tree, 'folder-alpha', ' Review ');
  assert.equal(folderPlan.operation, 'create-folder');
  assert.equal(folderPlan.title, 'Review');
  assert.throws(() => createFolderPlan(tree, 'missing', 'Bad folder'), /Choose an existing folder/);

  const movePlan = moveBookmarkPlan(tree, 'b1', 'folder-beta');
  assert.equal(movePlan.operation, 'move-bookmark');
  assert.equal(movePlan.sourceParentId, 'folder-alpha');
  assert.equal(movePlan.destinationId, 'folder-beta');
  assert.throws(() => moveBookmarkPlan(tree, 'b1', 'folder-alpha'), /already in that folder/);

  const removalPlan = removeExactDuplicatePlan(tree, 'b1', ['b2', 'b5']);
  assert.deepEqual(removalPlan.removeIds, ['b2', 'b5']);
  assert.throws(() => removeExactDuplicatePlan(tree, 'b1', ['b3']), /same exact URL/);

  const treeWithMutationApi = makeTree();
  const mutationApi = {
    async getTree() {
      return structuredClone(treeWithMutationApi);
    },
    async move(id, { parentId, index }) {
      const node = findNode(treeWithMutationApi, id);
      const oldParent = findNode(treeWithMutationApi, node.parentId);
      oldParent.children = oldParent.children.filter((child) => child.id !== id);
      const newParent = findNode(treeWithMutationApi, parentId);
      newParent.children.splice(index, 0, { ...node, parentId });
      node.parentId = parentId;
    },
    async create({ parentId, title }) {
      const folder = { id: 'folder-new', title, type: 'folder', parentId, children: [] };
      const parent = findNode(treeWithMutationApi, parentId);
      parent.children.push(folder);
      return folder;
    },
    async remove(id) {
      const node = findNode(treeWithMutationApi, id);
      const parent = findNode(treeWithMutationApi, node.parentId);
      parent.children = parent.children.filter((child) => child.id !== id);
    }
  };

  const result = await applyReviewedOperation(mutationApi, treeWithMutationApi, removalPlan);
  assert.equal(result.status, 'applied');
  assert.equal(findNode(result.tree, 'b1')?.url, 'https://example.com/one');
  assert.equal(findNode(result.tree, 'b2'), null, 'Exact duplicate removal should delete the non-keeper duplicate.');
  assert.equal(findNode(result.tree, 'b5'), null, 'Exact duplicate removal should delete the final selected duplicate.');

  const staleTree = makeTree();
  const stalePlan = removeExactDuplicatePlan(staleTree, 'b1', ['b2']);
  const staleReviewedTree = structuredClone(staleTree);
  staleReviewedTree.title = 'Different review';
  const workflowApi = {
    async getTree() {
      return structuredClone(staleTree);
    },
    async remove(id) {
      const node = findNode(staleTree, id);
      const parent = findNode(staleTree, node.parentId);
      parent.children = parent.children.filter((child) => child.id !== id);
    }
  };

  const staleResult = await executeReviewedPlan({
    bookmarksApi: workflowApi,
    reviewedTree: staleReviewedTree,
    plan: stalePlan,
    backup: async () => {},
    confirmRisk: async () => true
  });
  assert.equal(staleResult.status, 'stale', 'Workflow must reject stale reviewed trees before mutation.');

  const backupTree = makeTree();
  const backupPlan = removeExactDuplicatePlan(backupTree, 'b1', ['b2']);
  let backupCount = 0;
  const backupApi = {
    async getTree() {
      return structuredClone(backupTree);
    },
    async remove(id) {
      const node = findNode(backupTree, id);
      const parent = findNode(backupTree, node.parentId);
      parent.children = parent.children.filter((child) => child.id !== id);
    }
  };

  const backupResult = await executeReviewedPlan({
    bookmarksApi: backupApi,
    reviewedTree: backupTree,
    plan: backupPlan,
    backup: async () => {
      backupCount += 1;
    },
    confirmRisk: async () => true
  });
  assert.equal(backupResult.status, 'applied', 'A successful review plus backup should allow mutation.');
  assert.equal(backupCount, 1, 'The backup gate should run once on an approved plan.');
  assert.equal(backupResult.backedUp, true, 'The workflow should only report the backup as successful after a completed export.');

  console.log('PASS');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
