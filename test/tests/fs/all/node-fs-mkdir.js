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

  var pathname1 = common.tmpDir + '/mkdir-test1';

  fs.mkdir(pathname1, function(err) {
    assert.equal(err, null,
        'fs.mkdir(' + pathname1 + ') reports non-null error: ' + err);
    fs.exists(pathname1, function(y){
      assert.equal(y, true,
        'Got null error from fs.mkdir, but fs.exists reports false for ' + pathname1);
    });
  });

  var pathname2 = common.tmpDir + '/mkdir-test2';

  fs.mkdir(pathname2, 511 /*=0777*/, function(err) {
    assert.equal(err, null,
        'fs.mkdir(' + pathname2 + ') reports non-null error: ' + err);
    fs.exists(pathname2, function(y){
      assert.equal(y, true,
        'Got null error from fs.mkdir, but fs.exists reports false for ' + pathname2);
    });
  });

  // Shouldn't be able to make multi-level dirs.
  var pathname3 = common.tmpDir + '/mkdir-test3/again';
  fs.mkdir(pathname3, 511 /*=0777*/, function(err) {
    assert.notEqual(err, null, 'fs.mkdir(' + pathname3 + ') reports null error');
  });

};});
