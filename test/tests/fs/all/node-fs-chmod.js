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
var mode_async;
var mode_sync;
var is_windows = process.platform === 'win32';
var rootFS = fs.getRootFS();

// BFS: This is only for writable file systems that support properties.
if (rootFS.isReadOnly() || rootFS.supportsProps() === false) return;

var openCount = 0;

var open = function() {
  openCount++;
  return fs._open.apply(fs, arguments);
};

var openSync = function() {
  openCount++;
  return fs._openSync.apply(fs, arguments);
};

var close = function() {
  openCount--;
  return fs._close.apply(fs, arguments);
};

var closeSync = function() {
  openCount--;
  return fs._closeSync.apply(fs, arguments);
};

// Need to hijack fs.open/close to make sure that things
// get closed once they're opened.
fs._open = fs.open;
fs.open = open;
fs._close = fs.close;
fs.close = close;
if (rootFS.supportsSynch()) {
  fs._openSync = fs.openSync;
  fs.openSync = openSync;
  fs._closeSync = fs.closeSync;
  fs.closeSync = closeSync;
}

// On Windows chmod is only able to manipulate read-only bit
if (is_windows) {
  mode_async = 0400;   // read-only
  mode_sync = 0600;    // read-write
} else {
  mode_async = 0777;
  mode_sync = 0644;
}

var file1 = path.join(common.fixturesDir, 'a.js'),
    file2 = path.join(common.fixturesDir, 'a1.js');

fs.chmod(file1, mode_async.toString(8), function(err) {
  if (err) {
    got_error = true;
  } else {
    if (is_windows) {
      assert.ok((fs.statSync(file1).mode & 0777) & mode_async);
    } else {
      assert.equal(mode_async, fs.statSync(file1).mode & 0777);
    }

    fs.chmodSync(file1, mode_sync);
    if (is_windows) {
      assert.ok((fs.statSync(file1).mode & 0777) & mode_sync);
    } else {
      assert.equal(mode_sync, fs.statSync(file1).mode & 0777);
    }
    success_count++;
  }
});

fs.open(file2, 'a', function(err, fd) {
  if (err) {
    got_error = true;
    console.log(err.stack);
    return;
  }
  fs.fchmod(fd, mode_async.toString(8), function(err) {
    if (err) {
      got_error = true;
    } else {
      if (is_windows) {
        assert.ok((fs.fstatSync(fd).mode & 0777) & mode_async);
      } else {
        assert.equal(mode_async, fs.fstatSync(fd).mode & 0777);
      }

      fs.fchmodSync(fd, mode_sync);
      if (is_windows) {
        assert.ok((fs.fstatSync(fd).mode & 0777) & mode_sync);
      } else {
        assert.equal(mode_sync, fs.fstatSync(fd).mode & 0777);
      }
      success_count++;
      fs.close(fd);
    }
  });
});

// lchmod
if (rootFS.supportsLinks()) {
  if (fs.lchmod) {
    var link = path.join(common.tmpDir, 'symbolic-link');

    try {
      fs.unlinkSync(link);
    } catch (er) {}
    fs.symlinkSync(file2, link);

    fs.lchmod(link, mode_async, function(err) {
      if (err) {
        got_error = true;
      } else {
        console.log(fs.lstatSync(link).mode);
        assert.equal(mode_async, fs.lstatSync(link).mode & 0777);

        fs.lchmodSync(link, mode_sync);
        assert.equal(mode_sync, fs.lstatSync(link).mode & 0777);
        success_count++;
      }
    });
  } else {
    success_count++;
  }
}


process.on('exit', function() {
  // BFS: Restore methods so we can continue unit testing.
  fs.open = fs._open;
  fs.close = fs._close;
  if (rootFS.supportsSynch()) {
    fs.openSync = fs._openSync;
    fs.closeSync = fs._closeSync;
  }
  if (rootFS.supportsLinks())
    assert.equal(3, success_count);
  else
    assert.equal(2, success_count);
  assert.equal(0, openCount);
  assert.equal(false, got_error);
});

};});
