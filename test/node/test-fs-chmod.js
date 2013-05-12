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

var BrowserFS = BrowserFS ? BrowserFS : require('../../lib/browserfs.js');
var assert = require('assert');
var path = BrowserFS.node.path;
var fs = BrowserFS.node.fs;
var common = BrowserFS.common;

var mode = 0777;

var file1 = path.join(common.tmpDir, 'a.js'),
    file2 = path.join(common.tmpDir, 'a1.js');
fs.open(file1, 'wx', function(){
  fs.chmod(file1, mode.toString(8), function(err) {
    if (err) {
      console.log('XXX(chmod): '+err);
      assert.ok(false);  // chmod shouldn't throw an error
    } else {
      fs.stat(file1, function(err, stats){
        assert.equal(mode, stats.mode & 0777);
        fs.chmod(file1, mode, function(){
          fs.stat(file1, function(err2, stats2){
            assert.equal(mode, stats2.mode & 0777);
          });
        });
      });
    }
  });
});

fs.open(file2, 'a', function(err, fd) {
  if (err) {
    console.error(err.stack);
    return;
  }
  fs.fchmod(fd, mode.toString(8), function(err) {
    if (err) {
      console.log('XXX(fchmod): '+err);
      assert.ok(false);  // fchmod shouldn't throw an error
    } else {
      fs.fstat(fd, function(err,stats){
        assert.equal(mode, stats.mode & 0777);
        fs.fchmod(fd, mode, function(){
          fs.fstat(fd, function(err2,stats2){
            assert.equal(mode, stats2.mode & 0777);
          });
        });
      });
    }
  });
});

// lchmod
if (fs.lchmod) {
  var link = path.join(common.tmpDir, 'symbolic-link');

  fs.unlink(link, function (){
    fs.symlink(file2, link, function (){
      fs.lchmod(link, mode, function(err) {
        if (err) {
          console.log('XXX(lchmod): '+err);
          assert.ok(false);  // lchmod shouldn't throw an error
        } else {
          fs.lstat(link, function (err, stats){
            assert.equal(mode, stats.mode & 0777);
          });
        }
      });
    });
  });
}
