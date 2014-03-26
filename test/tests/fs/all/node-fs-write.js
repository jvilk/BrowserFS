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
if (fs.getRootFS().isReadOnly()) return;
var fn = path.join(common.tmpDir, 'write.txt');
var fn2 = path.join(common.tmpDir, 'write2.txt');
var expected = 'ümlaut.';

fs.open(fn, 'w', 0644, function(err, fd) {
  if (err) throw err;
  fs.write(fd, '', 0, 'utf8', function(err, written) {
    assert.equal(0, written);
  });
  fs.write(fd, expected, 0, 'utf8', function(err, written) {
    if (err) throw err;
    assert.equal(Buffer.byteLength(expected), written);
    fs.close(fd, function(err) {
      if (err) throw err;
      fs.readFile(fn, 'utf8', function(err, data) {
        if (err) throw err;
        assert.equal(expected, data,
            'expected: "' + data + '", found: "' + data + '"');
        fs.unlink(fn, function(err) { if (err) throw err; });
      });
    });
  });
});

fs.open(fn2, 'w', 0644,
    function(err, fd) {
      if (err) throw err;
      fs.write(fd, '', 0, 'utf8', function(err, written) {
        assert.equal(0, written);
      });
      fs.write(fd, expected, 0, 'utf8', function(err, written) {
        if (err) throw err;
        assert.equal(Buffer.byteLength(expected), written);
        fs.close(fd, function(err) {
          if (err) throw err;
          fs.readFile(fn2, 'utf8', function(err, data) {
            if (err) throw err;
            assert.equal(expected, data,
                'expected: "' + expected + '", found: "' + data + '"');
            fs.unlink(fn2, function(err) { if (err) throw err; });
          });
        });
      });
    });
};});
