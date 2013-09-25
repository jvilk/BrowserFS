this.tests.bfs_read_binary_file = function () {
  // Read a file and check its binary bytes.
  fs.readFile(path.join(common.fixturesDir, 'elipses.txt'), function(err, buff) {
    if (err) throw err;
    assert(buff.readUInt16LE(0) === 32994);
  });
};