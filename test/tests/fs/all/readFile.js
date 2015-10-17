var fs = require('fs'),
    path = require('path'),
    assert = require('wrapped-assert'),
    common = require('../../../harness/common'),
    Buffer = require('buffer').Buffer;

module.exports = function() {
  var rootFS = fs.getRootFS(), wasThrown = false;
  if (rootFS.supportsSynch()) {
    try {
      fs.readFileSync(path.join(common.fixturesDir, 'a.js'), 'wrongencoding');
    } catch (e) {
      wasThrown = true;
    }
    assert(wasThrown, "Failed invariant: Cannot read a file with an invalid encoding.");
  }
  
  fs.readFile(path.join(common.fixturesDir, 'a.js'), 'wrongencoding', function(err, data) {
    assert(err, "Failed invariant: Cannot read a file with an invalid encoding.");
  });
};
