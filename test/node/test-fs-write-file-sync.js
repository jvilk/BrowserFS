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

window.tests.fs_write_file_sync = function() {

var isWindows = process.platform === 'win32';
var openCount = 0;
var mode;
var content;
var rootFS = fs.getRootFS();

// Only works for file systems that support synchronous ops.
if (rootFS.isReadOnly() || !rootFS.supportsSynch()) return;

// Need to hijack fs.open/close to make sure that things
// get closed once they're opened.
rootFS._openSync = rootFS.openSync;
rootFS.openSync = openSync;
fs._closeSync = fs.closeSync;
fs.closeSync = closeSync;

// Reset the umask for testing
// BFS: Not supported.
//var mask = process.umask(0);

// On Windows chmod is only able to manipulate read-only bit. Test if creating
// the file in read-only mode works.
if (isWindows) {
  mode = 0444;
} else {
  mode = 0755;
}

// Test writeFileSync
var file1 = path.join(common.tmpDir, 'testWriteFileSync.txt');
removeFile(file1);

fs.writeFileSync(file1, '123', {mode: mode});

content = fs.readFileSync(file1, {encoding: 'utf8'});
assert.equal('123', content);

if (rootFS.supportsProps()) {
  assert.equal(mode, fs.statSync(file1).mode & 0777);
}

removeFile(file1);

// Test appendFileSync
var file2 = path.join(common.tmpDir, 'testAppendFileSync.txt');
removeFile(file2);

fs.appendFileSync(file2, 'abc', {mode: mode});

content = fs.readFileSync(file2, {encoding: 'utf8'});
assert.equal('abc', content);

if (rootFS.supportsProps()) {
  assert.equal(mode, fs.statSync(file2).mode & mode);
}

removeFile(file2);

// Verify that all opened files were closed.
// BFS: Not necessarily applicable to mountable file system with the way
// this is counted.
if (!(rootFS instanceof BrowserFS.FileSystem.MountableFileSystem))
  assert.equal(0, openCount);

// Removes a file if it exists.
function removeFile(file) {
  try {
    if (isWindows)
      fs.chmodSync(file, 0666);
    fs.unlinkSync(file);
  } catch (err) {
    // BFS: We don't attach codes like that.
    //if (err && err.code !== 'ENOENT')
    //  throw err;
  }
}

function openSync() {
  openCount++;
  return rootFS._openSync.apply(rootFS, arguments);
}

function closeSync() {
  openCount--;
  return fs._closeSync.apply(fs, arguments);
}

// BFS: Restore old handlers.
process.on('exit', function() {
  rootFS.openSync = rootFS._openSync;
  fs.closeSync = fs._closeSync;
});

};
