var fs = require('fs'),
    path = require('path'),
    assert = require('assert'),
    common = require('../../../harness/common'),
    Buffer = require('buffer').Buffer;
    
module.exports = function() {
  // Read a file and check its binary bytes.
  fs.readFile(path.join(common.fixturesDir, 'elipses.txt'), function(err, buff) {
    if (err) throw err;
    assert(buff.readUInt16LE(0) === 32994);
  });
  // Same, but synchronous.
  var rootFS = fs.getRootFS();
  if (rootFS.supportsSynch()) {
    var buff = fs.readFileSync(path.join(common.fixturesDir, 'elipses.txt'));
    assert(buff.readUInt16LE(0) === 32994);
  }
};
