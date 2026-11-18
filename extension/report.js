import { analyzeTree } from './analysis.js';
import { createBookmarkApi } from './bookmark-api.js';
import { exportSnapshot } from './backup.js';
import { listNodes } from './bookmark-tree.js';
import { createFolderPlan, moveBookmarkPlan, removeExactDuplicatePlan } from './plans.js';
import { executeReviewedPlan } from './workflow.js';

const api = createBookmarkApi(chrome.bookmarks);
const statusElement = document.querySelector('#status');
const reportElement = document.querySelector('#report');
const taskSelect = document.querySelector('#task');
const taskFields = document.querySelector('#task-fields');
const planElement = document.querySelector('#plan');

let reviewedTree = null;
let reviewedPlan = null;

function addCount(label, value) {
  const term = document.createElement('dt');
  term.textContent = label;
  const description = document.createElement('dd');
  description.textContent = String(value);
  document.querySelector('#counts').append(term, description);
}

function folderOptions(tree) {
  return listNodes(tree)
    .filter(({ node }) => node.id !== '0' && Array.isArray(node.children))
    .map(({ node, depth }) => ({
      id: node.id,
      label: `${'— '.repeat(Math.max(0, depth - 1))}${node.title || 'Bookmarks'}`
    }));
}

function fillSelect(select, options, placeholder) {
  select.replaceChildren();
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = placeholder;
  empty.selected = true;
  empty.disabled = true;
  select.append(empty);

  for (const option of options) {
    const item = document.createElement('option');
    item.value = option.id;
    item.textContent = option.label;
    select.append(item);
  }
}

function renderDuplicates(groups) {
  const container = document.querySelector('#duplicates');
  container.replaceChildren();

  if (groups.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No exact URL matches found.';
    container.append(empty);
    return;
  }

  for (const group of groups) {
    const card = document.createElement('article');
    card.className = 'duplicate-group';

    const urlLabel = document.createElement('p');
    urlLabel.textContent = group.url;

    const matches = document.createElement('ul');
    for (const match of group.matches) {
      const item = document.createElement('li');
      item.textContent = `${match.name} (${match.id})`;
      matches.append(item);
    }

    card.append(urlLabel, matches);
    container.append(card);
  }
}

function renderTaskFields(task) {
  taskFields.replaceChildren();
  if (!reviewedTree || !task) return;

  const folders = folderOptions(reviewedTree);

  if (task === 'create-folder') {
    const folderNameLabel = document.createElement('label');
    folderNameLabel.htmlFor = 'folder-name';
    folderNameLabel.textContent = 'New folder name';

    const folderName = document.createElement('input');
    folderName.id = 'folder-name';
    folderName.required = true;
    folderName.maxLength = 256;

    const parentLabel = document.createElement('label');
    parentLabel.htmlFor = 'parent-folder';
    parentLabel.textContent = 'Create inside';

    const parent = document.createElement('select');
    parent.id = 'parent-folder';
    parent.required = true;
    fillSelect(parent, folders, 'Choose a folder…');

    taskFields.append(folderNameLabel, folderName, parentLabel, parent);
    return;
  }

  if (task === 'move-bookmark') {
    const bookmarkList = listNodes(reviewedTree)
      .filter(({ node }) => typeof node.url === 'string')
      .map(({ node, depth }) => ({
        id: node.id,
        label: `${'— '.repeat(Math.max(0, depth - 1))}${node.title || '(untitled)'} — ${node.url}`
      }));

    const bookmarkLabel = document.createElement('label');
    bookmarkLabel.htmlFor = 'bookmark';
    bookmarkLabel.textContent = 'Bookmark to move';

    const bookmark = document.createElement('select');
    bookmark.id = 'bookmark';
    bookmark.required = true;
    fillSelect(bookmark, bookmarkList, 'Choose a bookmark…');

    const destinationLabel = document.createElement('label');
    destinationLabel.htmlFor = 'destination-folder';
    destinationLabel.textContent = 'Move to';

    const destination = document.createElement('select');
    destination.id = 'destination-folder';
    destination.required = true;
    fillSelect(destination, folders, 'Choose a destination…');

    taskFields.append(bookmarkLabel, bookmark, destinationLabel, destination);
    return;
  }

  const duplicateGroups = analyzeTree(reviewedTree).duplicateCandidates;
  const duplicateSelect = document.createElement('select');
  duplicateSelect.id = 'duplicate-group';
  duplicateSelect.required = true;
  const options = duplicateGroups.map((group) => ({
    id: group.url,
    label: `${group.url} (${group.matches.length} exact matches)`
  }));
  fillSelect(duplicateSelect, options, 'Choose a duplicate group…');

  const keeperLabel = document.createElement('label');
  keeperLabel.htmlFor = 'duplicate-keeper';
  keeperLabel.textContent = 'Keeper bookmark';

  const keeperSelect = document.createElement('select');
  keeperSelect.id = 'duplicate-keeper';
  keeperSelect.required = true;

  const removalLabel = document.createElement('label');
  removalLabel.htmlFor = 'duplicate-removal';
  removalLabel.textContent = 'Duplicates to remove';

  const removalSelect = document.createElement('select');
  removalSelect.id = 'duplicate-removal';
  removalSelect.multiple = true;
  removalSelect.size = 6;

  function updateDuplicateChoice() {
    const url = duplicateSelect.value;
    const group = duplicateGroups.find((entry) => entry.url === url);
    if (!group) {
      keeperSelect.replaceChildren();
      removalSelect.replaceChildren();
      return;
    }

    const choices = group.matches.map((match) => ({ id: match.id, label: `${match.name} (${match.id})` }));
    fillSelect(keeperSelect, choices, 'Choose the keeper…');
    keeperSelect.disabled = false;
    removalSelect.replaceChildren();
    for (const choice of choices) {
      const item = document.createElement('option');
      item.value = choice.id;
      item.textContent = choice.label;
      if (choice.id === keeperSelect.value) {
        item.disabled = true;
      }
      removalSelect.append(item);
    }
  }

  duplicateSelect.addEventListener('change', updateDuplicateChoice);
  keeperSelect.addEventListener('change', () => {
    const keeperId = keeperSelect.value;
    for (const child of removalSelect.children) {
      child.disabled = child.value === keeperId;
    }
  });

  taskFields.append(
    document.createTextNode('Duplicate URL group'),
    duplicateSelect,
    keeperLabel,
    keeperSelect,
    removalLabel,
    removalSelect
  );
  updateDuplicateChoice();
}

function renderPlan(plan) {
  const summary = document.querySelector('#plan-summary');
  const safety = document.querySelector('#plan-safety');

  if (plan.operation === 'create-folder') {
    const parent = listNodes(reviewedTree).find(({ node }) => node.id === plan.parentId)?.node;
    summary.textContent = `Create folder “${plan.title}” inside “${parent?.title || 'Bookmarks'}”.`;
    safety.textContent = 'Only this one new folder will be created. No existing folder is renamed or deleted.';
  } else if (plan.operation === 'move-bookmark') {
    const destination = listNodes(reviewedTree).find(({ node }) => node.id === plan.destinationId)?.node;
    summary.textContent = `Move “${plan.title}” to the end of “${destination?.title || 'Bookmarks'}”.`;
    safety.textContent = 'Only this reviewed bookmark move is allowed. No directory is renamed or removed.';
  } else {
    summary.textContent = `Remove the selected exactURL duplicates while keeping “${plan.keeperTitle}” (${plan.keeperUrl}).`;
    safety.textContent = 'Only the selected exact URL duplicates are removed. The keeper remains and no other bookmarks are touched.';
  }

  planElement.hidden = false;
}

async function loadReport() {
  statusElement.textContent = 'Reading bookmarks locally…';

  try {
    reviewedTree = await api.getTree();
    const summary = analyzeTree(reviewedTree);
    document.querySelector('#counts').replaceChildren();
    addCount('Bookmarks', summary.bookmarkCount);
    addCount('Folders', summary.folderCount);
    addCount('Deepest bookmark level', summary.deepestBookmarkLevel);
    renderDuplicates(summary.duplicateCandidates);
    reportElement.hidden = false;
    statusElement.textContent = 'Report ready. No bookmark changes have been made.';
  } catch (error) {
    statusElement.textContent = `Could not read bookmarks: ${error.message}`;
  }
}

taskSelect.addEventListener('change', () => renderTaskFields(taskSelect.value));

document.querySelector('#task-form').addEventListener('submit', (event) => {
  event.preventDefault();

  try {
    if (taskSelect.value === 'create-folder') {
      reviewedPlan = createFolderPlan(reviewedTree, document.querySelector('#parent-folder').value, document.querySelector('#folder-name').value);
    } else if (taskSelect.value === 'move-bookmark') {
      reviewedPlan = moveBookmarkPlan(reviewedTree, document.querySelector('#bookmark').value, document.querySelector('#destination-folder').value);
    } else {
      const groupUrl = document.querySelector('#duplicate-group').value;
      const duplicateMatches = analyzeTree(reviewedTree).duplicateCandidates.find((group) => group.url === groupUrl)?.matches ?? [];
      const keeperId = document.querySelector('#duplicate-keeper').value;
      const removalIds = Array.from(document.querySelector('#duplicate-removal').selectedOptions).map((option) => option.value);
      reviewedPlan = removeExactDuplicatePlan(reviewedTree, keeperId, removalIds.filter((id) => id !== keeperId));
      if (duplicateMatches.length > 0 && !removalIds.length) {
        throw new Error('Select one or more duplicates to remove.');
      }
    }

    renderPlan(reviewedPlan);
    statusElement.textContent = 'Review the exact operation below. Choose whether to back up before applying.';
  } catch (error) {
    statusElement.textContent = error.message;
  }
});

function downloadFile(filename, contents, mimeType) {
  const url = URL.createObjectURL(new Blob([contents], { type: `${mimeType};charset=utf-8` }));

  return new Promise((resolve, reject) => {
    let downloadId;
    let settled = false;

    const finish = (error) => {
      if (settled) return;
      settled = true;
      chrome.downloads.onChanged.removeListener(onChanged);
      URL.revokeObjectURL(url);
      if (error) reject(error);
      else resolve();
    };

    const onChanged = (delta) => {
      if (delta.id !== downloadId) return;
      if (delta.state?.current === 'complete') {
        finish();
      } else if (delta.state?.current === 'interrupted' || delta.error) {
        finish(new Error(`Local export failed: ${delta.error?.current ?? 'download interrupted'}.`));
      }
    };

    chrome.downloads.onChanged.addListener(onChanged);
    chrome.downloads.download({
      url,
      filename: `BookmarkUp/${filename}`,
      saveAs: true,
      conflictAction: 'uniquify'
    }).then((id) => {
      downloadId = id;
    }).catch(finish);
  });
}

async function executePlan(withBackup) {
  if (!reviewedTree || !reviewedPlan) return;

  statusElement.textContent = withBackup ? 'Exporting both local backups…' : 'Checking the reviewed snapshot…';

  const result = await executeReviewedPlan({
    bookmarksApi: api,
    reviewedTree,
    plan: reviewedPlan,
    backup: withBackup ? (tree) => exportSnapshot(tree, downloadFile) : null,
    confirmRisk: () => window.confirm(
      'No completed backup is available. Applying this reviewed change without a backup may make recovery difficult if the browser fails or the result is not what you expected. Do you explicitly accept that risk and want to apply this one change?'
    )
  });

  if (result.status === 'stale') {
    statusElement.textContent = 'Bookmarks changed since review. Nothing was applied. Reload the report and review a new plan.';
  } else if (result.status === 'backup-failed') {
    statusElement.textContent = `Backup was not completed; no change was applied. ${result.error.message}`;
  } else if (result.status === 'risk-declined') {
    statusElement.textContent = 'No change was applied.';
  } else if (result.status === 'read-failed') {
    statusElement.textContent = `Could not verify the current bookmark tree. No change was applied. ${result.error.message}`;
  } else if (result.status === 'failed') {
    statusElement.textContent = `Operation failed. ${result.error.message}`;
  } else {
    statusElement.textContent = result.backedUp
      ? 'The reviewed change was applied and verified. Both local backups completed.'
      : 'The reviewed change was applied and verified without a completed backup, after separate risk confirmation.';
    document.querySelector('#backup-apply').disabled = true;
    document.querySelector('#risk-apply').disabled = true;
  }
}

document.querySelector('#backup-apply').addEventListener('click', () => {
  executePlan(true).catch((error) => {
    statusElement.textContent = `Could not apply the reviewed plan. No success is assumed. ${error.message}`;
  });
});

document.querySelector('#risk-apply').addEventListener('click', () => {
  executePlan(false).catch((error) => {
    statusElement.textContent = `Could not apply the reviewed plan. No success is assumed. ${error.message}`;
  });
});

loadReport();
