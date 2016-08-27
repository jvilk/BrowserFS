/**
 * Ensures that the deletion log works properly.
 */
var fs = require('fs'),
    path = require('path'),
    assert = require('wrapped-assert'),
    common = require('../../../harness/common'),
    Buffer = require('buffer').Buffer,
    logPath = '/.deletedFiles.log';

module.exports = function() {
  var rootFS = fs.getRootFS().unwrap(),
    fses = rootFS.getOverlayedFileSystems(),
    // XXX: Make these proper API calls.
    readable = fses.readable,
    writable = fses.writable;
  // Back up the current log.
  var deletionLog = rootFS.getDeletionLog();
  var aContents = fs.readFileSync('/test/fixtures/files/node/a.js').toString('utf8');
  // Delete a file in the underlay.
  fs.unlinkSync('/test/fixtures/files/node/a.js');
  assert(!fs.existsSync('/test/fixtures/files/node/a.js'), 'Failed to properly delete a.js.');
  // Try to move the deletion log.
  assert.throws(function() { fs.renameSync(logPath, logPath + "2"); }, 'Should not be able to rename the deletion log.');
  // Move another file over the deletion log.
  assert.throws(function() { fs.renameSync('/test/fixtures/files/node/a1.js', logPath); }, 'Should not be able to rename a file over the deletion log.');
  // Remove the deletion log.
  assert.throws(function() { fs.unlinkSync(logPath); }, 'Should not be able to delete the deletion log.');
  // Open the deletion log.
  assert.throws(function() { fs.openSync(logPath, 'r'); }, 'Should not be able to open the deletion log.');
  // Re-write a.js.
  fs.writeFileSync('/test/fixtures/files/node/a.js', new Buffer("hi", "utf8"));
  assert(fs.existsSync('/test/fixtures/files/node/a.js'), 'Failed to properly restore a.js.');
  // Remove something else.
  fs.unlinkSync('/test/fixtures/files/node/a1.js');
  assert(!fs.existsSync('/test/fixtures/files/node/a1.js'), 'Failed to properly delete a1.js.');
  // Wait for OverlayFS to persist delete log changes.
  __numWaiting++;
  var interval = setInterval(function() {
    if (!rootFS._deleteLogUpdatePending) {
      clearInterval(interval);
      next();
    }
  }, 4);
  function next() {
    __numWaiting--;
    // Re-mount OverlayFS.
    rootFS = new BrowserFS.FileSystem.OverlayFS(writable, readable);
    rootFS.initialize(function(e) {
      assert(!e, 'Received initialization error.');
      fs.initialize(rootFS);
      rootFS = rootFS.unwrap();
      assert(fs.existsSync('/test/fixtures/files/node/a.js'), 'a.js\'s restoration was not persisted.');
      rootFS.restoreDeletionLog('');
      assert(fs.existsSync('/test/fixtures/files/node/a1.js'), 'a1.js\'s restoration was not persisted.');
      // Manually restore original deletion log.
      rootFS.restoreDeletionLog(deletionLog);
    });
  }
};