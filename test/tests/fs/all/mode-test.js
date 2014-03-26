/**
 * Checks the following invariants, assuming that the browser is the owner and
 * in the group:
 * 1 If file system is read only, no items have write permissions.
 * 2 Read permissions:
 *   - We can only readdir and readfile IFF we have read permissions.
 * 3 Write permissions:
 *   - We can only modify a file or write a file in a directory IFF we have
 *     write permissions.
 * 4 Execute permissions:
 *   - We can only stat a file in a directory IFF we have the execute bit set
 *     on the file.
 *   - No relevant checks for execute bits on files; browsers make no clear
 *     distinction between *data* and *code*.
 *
 * This test should pass even if the file system does not support permissions,
 * as the mode information is included with every stat object.
 * @todo Introduce test items to prop-supporting file systems that stress these
 *       invariants. Or only iterate on test item directory? Hard to do for
 *       e.g. ZipFS.
 */
define([], function() { return function(){
  var rootFS = fs.getRootFS(),
      isReadOnly = rootFS.isReadOnly(),
      testFileContents = new Buffer('this is a test file, plz ignore.');

  // @todo Introduce helpers for this.
  function is_writable(mode) {
    return (mode & 146) > 0;
  }

  function is_readable(mode) {
    return (mode & 0x124) > 0;
  }

  function is_executable(mode) {
    return (mode & 0x49) > 0;
  }

  function process_file(p, fileMode) {
    fs.readFile(p, function(e, data) {
      if (e) {
        if (e.code === 'EPERM') {
          // Invariant 2: We can only read a file if we have read permissions on
          // the file.
          assert(!is_readable(fileMode));
          return;
        }
        throw e;
      }
      // Invariant 2: We can only read a file if we have read permissions on
      // the file.
      assert(is_readable(fileMode));
    });
    // Try opening file for appending, but append *nothing*.
    fs.open(p, 'a', function(e, fd) {
      if (e) {
        if (e.code === 'EPERM') {
          // Invariant 3: We can only write to a file if we have write
          // permissions on the file.
          assert(!is_writable(fileMode));
          return;
        }
        throw e;
      }
      // Invariant 3: We can only write to a file if we have write permissions
      // on the file.
      assert(is_writable(fileMode));
      fs.close(function() {});
    });
  }

  function process_directory(p, dirMode) {
    fs.readdir(p, function (e, dirs) {
      if (e) {
        if (e.code === 'EPERM') {
          // Invariant 2: We can only readdir if we have read permissions on
          // the directory.
          assert(!is_readable(dirMode));
          return;
        }
        throw e;
      }
      // Invariant 2: We can only readdir if we have read permissions on the
      // directory.
      assert(is_readable(dirMode));
      var i;
      for (i = 0; i < dirs.length; i++) {
        process_item(path.resolve(p, dirs[i]), dirMode);
      }

      // Try to write a file into the directory.
      var testFile = path.resolve(p, '__test_file_plz_ignore.txt');
      fs.writeFile(testFile, testFileContents, function(e) {
        if (e) {
          if (e.code === 'EPERM') {
            // Invariant 3: We can only write to a new file if we have write
            // permissions in the directory.
            assert(!is_writable(dirMode));
            return;
          }
          throw e;
        }
        // Invariant 3: We can only write to a new file if we have write
        // permissions in the directory.
        assert(is_writable(dirMode));
        // Clean up.
        fs.unlink(testFile, function() {});
      });
    });
  }

  function process_item(p, parentMode) {
    fs.stat(p, function (e, stat) {
      if (e) {
        if (e.code === 'EPERM') {
          // Invariant 4: Ensure we do not have execute permissions on parent
          // directory.
          assert(!is_executable(parentMode));
          return;
        }
        throw e;
      }
      // Invariant 4: Ensure we have execute permissions on parent directory.
      assert(is_executable(parentMode));
      if (isReadOnly) {
        // Invariant 1: RO FS do not support write permissions.
        assert(is_writable(stat.mode) === false);
      }
      if (stat.isDirectory()) {
        process_directory(p, stat.mode);
      } else {
        process_file(p, stat.mode);
      }
    });
  }

  // Should always be able to stat the root.
  process_item('/', 0x1FF);
};});
