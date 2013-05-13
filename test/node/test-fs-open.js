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

this.tests.fs_open = function(){
var filename = 'open-test-filename';

/*
var caughtException = false;
try {
  // should throw ENOENT, not EBADF
  // see https://github.com/joyent/node/pull/1228
  fs.openSync('/path/to/file/that/does/not/exist', 'r');
}
catch (e) {
  assert.equal(e.code, 'ENOENT');
  caughtException = true;
}
assert.ok(caughtException);
*/
fs.open(filename, 'w', function(err, fd){
  fs.close(fd, function(){
    // file is now created
    fs.open(filename, 'r', function(err, fd) {
      if (err) {
        throw err;
      }
      assert.ok(fd);
      console.log("opened with mode `r`: "+filename);
    });

    fs.open(filename, 'rs', function(err, fd) {
      if (err) {
        throw err;
      }
      assert.ok(fd);
      console.log("opened with mode `rs`: "+filename);
    });
  });
});

/*process.on('exit', function() {
  assert.ok(openFd);
  assert.ok(openFd2);
});*/
};
