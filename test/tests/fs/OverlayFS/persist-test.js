/**
 * Ensures that changes to OverlayFS appropriately persists across instantiations.
 * Side effect: Discards doubly-loaded files (files are present in ZipFS, but are
 * accidentally re-written and reloaded by test runner). This is a Good Thing.
 */
var fs = require('fs'),
    path = require('path'),
    assert = require('wrapped-assert'),
    common = require('../../../harness/common'),
    Buffer = require('buffer').Buffer;

module.exports = function() {
  var rootFS = fs.getRootFS(),
    fses = rootFS.getOverlayedFileSystems(),
    // XXX: Make these proper API calls.
    readable = fses.readable,
    writable = fses.writable;

  // Ensure no files are doubled.
  var seenMap = [];
  fs.readdirSync('/test/fixtures/files/node').forEach(function(file) {
    assert(seenMap.indexOf(file) === -1, "File " + file + " cannot exist multiple times.");
    seenMap.push(file);
    fs.unlinkSync('/test/fixtures/files/node/' + file);
  });

  fs.rmdirSync('/test/fixtures/files/node');

  assert(fs.existsSync('/test/fixtures/files/node') === false, 'Directory must be deleted');
  assert(fs.readdirSync('/test/fixtures/files').length === 0, 'File system must be empty.');

  var newCombined = new BrowserFS.FileSystem.OverlayFS(writable, readable);
  newCombined.initialize(function() {
    assert(newCombined.existsSync('/test/fixtures/files/node') === false, 'Directory must still be deleted.');
    assert(newCombined.readdirSync('/test/fixtures/files').length === 0, "File system must still be empty.");

    var newFs = new BrowserFS.FileSystem.OverlayFS(new BrowserFS.FileSystem.InMemory(), readable);
    newFs.initialize(function() {
      BrowserFS.initialize(newFs);
      assert(fs.existsSync('/test/fixtures/files/node') === true, "Directory must be back");
      assert(fs.readdirSync('/test/fixtures/files').length > 0, "Directory must be back.");
      // XXX: Remake the tmpdir.
      fs.mkdirSync(common.tmpDir);
    });
  });
};
