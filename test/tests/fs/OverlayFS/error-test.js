/**
 * Ensures that OverlayFS throws initialization errors.
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
  fs.initialize(new BrowserFS.FileSystem.OverlayFS(writable, readable));

  var err = null;
  try {
    fs.readdirSync('/');
  } catch (e) {
    err = e;
  }
  assert(err !== null, 'OverlayFS should throw an exception if it is not initialized.');

  try {
    fs.readdir('/', function(err) {
      assert(!!err, 'OverlayFS should pass an exception to its callback if it is not initialized.');
    });
  } catch (e) {
    assert(false, 'OverlayFS should never *throw* an exception on an asynchronous API call.');
  }

  process.on('exit', function() {
    // Restore saved file system.
    fs.initialize(rootFS);
  });
};