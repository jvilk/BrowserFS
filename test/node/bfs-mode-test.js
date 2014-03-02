/**
 * Checks that the files in the file system have appropriate modes, if the
 * file system is read-only.
 * 
 * This test should pass even if the file system does not support permissions,
 * as the mode information is included with every stat object.
 */
window.tests.bfs_mode_test = function () {
  var rootFS = fs.getRootFS();
  
  function is_writable(mode) {
    return (mode & 146) > 0;
  }

  function process_directory(p) {
    fs.readdir(p, function (e, dirs) {
      if (e) {
        throw e;
      }
      var i;
      for (i = 0; i < dirs.length; i++) {
        process_item(path.resolve(p, dirs[i]));
      }
    });
  }

  function process_item(p) {
    fs.stat(p, function (e, stat) {
      if (e) {
        throw e;
      }
      assert(is_writable(stat.mode) === false);
      if (stat.isDirectory()) {
        process_directory(p);
      }
    });
  }

  if (rootFS.isReadOnly()) {
    process_item('/');
  }
};