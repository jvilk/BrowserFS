this.tests.bfs_test_std = function() {
  var datStr = "hey\nhere's some data.",
      cb = function(data) {
        assert(data === datStr);
      };
  process.stdout.writeCb = cb;
  process.stderr.writeCb = cb;
  process.stdout.write(datStr);
  process.stderr.write(datStr);
  process.stdin.on('data', function(data) {
    assert(data.toString() === datStr);
  });
  process.stdin.write(new Buffer(datStr));
};