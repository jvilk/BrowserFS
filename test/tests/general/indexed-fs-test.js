/**
 * Tests for indexed file systems.
 */
module.exports = function() {
  // Does the root directory exist in empty file systems? It should!
  var ifs = new BrowserFS.FileSystem.InMemory();
  ifs.statSync('/', true);
};