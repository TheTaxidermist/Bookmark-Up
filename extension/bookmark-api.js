export function createBookmarkApi(bookmarksApi) {
  if (!bookmarksApi || typeof bookmarksApi.getTree !== 'function') {
    throw new TypeError('The browser bookmarks API is unavailable.');
  }

  return {
    getTree() {
      return bookmarksApi.getTree();
    },
    create(options) {
      if (typeof bookmarksApi.create !== 'function') {
        throw new TypeError('The browser bookmarks API does not support creating folders.');
      }
      return bookmarksApi.create(options);
    },
    move(id, options) {
      if (typeof bookmarksApi.move !== 'function') {
        throw new TypeError('The browser bookmarks API does not support moving bookmarks.');
      }
      return bookmarksApi.move(id, options);
    },
    remove(id) {
      if (typeof bookmarksApi.remove !== 'function') {
        throw new TypeError('The browser bookmarks API does not support removing bookmarks.');
      }
      return bookmarksApi.remove(id);
    }
  };
}
