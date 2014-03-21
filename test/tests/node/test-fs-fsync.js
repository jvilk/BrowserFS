// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

define([], function() { return function(){
var successes = 0;

var file = path.join(common.fixturesDir, 'a.js');
var rootFS = fs.getRootFS();
if (rootFS.isReadOnly()) return;

fs.open(file, 'a', 0777, function(err, fd) {
  if (err) throw err;

  if (rootFS.supportsSynch()) {
    fs.fdatasyncSync(fd);
    successes++;

    fs.fsyncSync(fd);
    successes++;
  }

  fs.fdatasync(fd, function(err) {
    if (err) throw err;
    successes++;
    fs.fsync(fd, function(err) {
      if (err) throw err;
      successes++;
    });
  });
});

process.on('exit', function() {
  if (rootFS.supportsSynch()) {
    assert.equal(4, successes);
  } else {
    assert.equal(2, successes);
  }
});

};});
