/**
 * Tests for indexed file systems.
 */
window.tests.bfs_indexed_fs_test = function() {
  // Does the root directory exist in empty file systems? It should!
  var ifs = new BrowserFS.FileSystem.InMemory();
  ifs.statSync('/', true);
};