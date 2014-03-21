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
var got_error = false;
var success_count = 0;
var existing_dir = common.fixturesDir;
var existing_file = path.join(common.fixturesDir, 'x.txt');

// Empty string is not a valid file path.
fs.stat('', function(err, stats) {
  if (err) {
    success_count++;
  } else {
    got_error = true;
  }
});

fs.stat(existing_dir, function(err, stats) {
  if (err) {
    got_error = true;
  } else {
    assert.ok(stats.mtime instanceof Date);
    success_count++;
  }
});

fs.lstat(existing_dir, function(err, stats) {
  if (err) {
    got_error = true;
  } else {
    assert.ok(stats.mtime instanceof Date);
    success_count++;
  }
});

// fstat
fs.open(existing_file, 'r', undefined, function(err, fd) {
  assert.ok(!err);
  assert.ok(fd);

  fs.fstat(fd, function(err, stats) {
    if (err) {
      got_error = true;
    } else {
      assert.ok(stats.mtime instanceof Date);
      success_count++;
      fs.close(fd);
    }
  });
});

if (fs.getRootFS().supportsSynch()) {
  // fstatSync
  fs.open(existing_file, 'r', undefined, function(err, fd) {
    var stats;
    try {
      stats = fs.fstatSync(fd);
    } catch (e) {
      got_error = true;
    }
    if (stats) {
      // BFS: IE9 doesn't define console until you open dev tools, so this
      // fails.
      if (console['dir']) console.dir(stats);
      assert.ok(stats.mtime instanceof Date);
      success_count++;
    }
    fs.close(fd);
  });
}

fs.stat(existing_file, function(err, s) {
  if (err) {
    got_error = true;
  } else {
    success_count++;
    assert.equal(false, s.isDirectory());
    assert.equal(true, s.isFile());
    assert.equal(false, s.isSocket());
    //assert.equal(false, s.isBlockDevice());
    assert.equal(false, s.isCharacterDevice());
    assert.equal(false, s.isFIFO());
    assert.equal(false, s.isSymbolicLink());

    assert.ok(s.mtime instanceof Date);
  }
});

process.on('exit', function() {
  var expected_success = 5;
  if (fs.getRootFS().supportsSynch()) expected_success++;
  assert.equal(expected_success, success_count);
  assert.equal(false, got_error);
});

};});
