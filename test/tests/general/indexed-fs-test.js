/**
 * Tests for indexed file systems.
 */
var assert = require('wrapped-assert');

module.exports = function() {
  // Does the root directory exist in empty file systems? It should!
  var ifs = new BrowserFS.FileSystem.InMemory();
  try {
    ifs.statSync('/', true);
  } catch (e) {
    assert(false, "Root directory does not exist.");
  }
};