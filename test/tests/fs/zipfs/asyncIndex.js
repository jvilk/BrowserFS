/**
 * Unit tests for async constructor of ZipFS
 */
var fs = require('fs'),
    Buffer = require('bfs-buffer').Buffer,
    assert = require('wrapped-assert');

module.exports = function() {
  var oldRootFS = fs.getRootFS();

  var ZipFS = BrowserFS.FileSystem.ZipFS;

  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function(){
    if (xhr.readyState === XMLHttpRequest.DONE) {
      assert(xhr.status === 200);
      var data = new Buffer(xhr.response);

      ZipFS.computeIndex(data, function(index) {
        var newZFS = new BrowserFS.FileSystem.ZipFS(index, "/");
        BrowserFS.initialize(newZFS);

        var t1text = 'Invariant fail: Can query folder that contains items and a mount point.';
        var expectedTestListing = ['test'];
        var testListing = fs.readdirSync('/').sort();
        assert.deepEqual(testListing, expectedTestListing, t1text);

        fs.readdir('/', function(err, files) {
          assert(!err, t1text);
          assert.deepEqual(files.sort(), expectedTestListing, t1text);
          fs.stat("/test/fixtures/files/node/a.js", function(err, stats) {
            assert(!err, "Can stat an existing file");
            assert(stats.isFile(), "File should be interpreted as a file");
            assert(!stats.isDirectory(), "File should be interpreted as a directory");
            assert(stats.size == 1467, "file size should match");
          });

          fs.stat("/test/fixtures/", function(err, stats) {
            assert(!err, "Can stat an existing directory");
            assert(stats.isDirectory(), "directory should be interpreted as a directory");
            assert(!stats.isFile(), "directory should be interpreted as a file");
          });

          fs.stat("/test/not-existing-name", function(err, stats) {
            assert(!!err, "Non existing file should return an error");
          });

        });
      });


    }
  };

  xhr.open('GET', '/test/fixtures/zipfs/zipfs_fixtures_l4.zip');
  xhr.responseType = 'arraybuffer';
  xhr.send(null);

  // Restore test FS on test end.
  process.on('exit', function() {
    BrowserFS.initialize(oldRootFS);
  });
};
