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
          assert(!is_readable(fileMode), p + " is readable, yet reading it yielded a permissions error!");
          return;
        }
        throw e;
      }
      // Invariant 2: We can only read a file if we have read permissions on
      // the file.
      assert(is_readable(fileMode)), p + " is not readable, yet we were able to read it!";
    });
    // Try opening file for appending, but append *nothing*.
    fs.open(p, 'a', function(e, fd) {
      if (e) {
        if (e.code === 'EPERM') {
          // Invariant 3: We can only write to a file if we have write
          // permissions on the file.
          assert(!is_writable(fileMode), p + " is writeable, yet we could not open it for appending!");
          return;
        }
        throw e;
      }
      // Invariant 3: We can only write to a file if we have write permissions
      // on the file.
      assert(is_writable(fileMode), p + " is not writeable, yet we could open it for appending!");
      fs.close(function() {});
    });
  }

  function process_directory(p, dirMode) {
    fs.readdir(p, function (e, dirs) {
      if (e) {
        if (e.code === 'EPERM') {
          // Invariant 2: We can only readdir if we have read permissions on
          // the directory.
          assert(!is_readable(dirMode), p + " is a readable directory, yet we could not read its contents!");
          return;
        }
        throw e;
      }
      // Invariant 2: We can only readdir if we have read permissions on the
      // directory.
      assert(is_readable(dirMode), p + " is not a readable directory, yet we could read its contents!");
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
            assert(!is_writable(dirMode), p + " is a writeable directory, yet we could not write a new file into it!");
            return;
          }
          throw e;
        }
        // Invariant 3: We can only write to a new file if we have write
        // permissions in the directory.
        assert(is_writable(dirMode), p + " is not a writeable directory, yet we could write a new file into it!");
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
          assert(!is_executable(parentMode), p + " is an executable directory, yet we could not stat it!");
          return;
        }
        throw e;
      }
      // Invariant 4: Ensure we have execute permissions on parent directory.
      assert(is_executable(parentMode), p + " is not an executable directory, yet we could stat it!");
      if (isReadOnly) {
        // Invariant 1: RO FS do not support write permissions.
        assert(!is_writable(stat.mode), p + " is writeable, yet it is in a read-only file system!");
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
