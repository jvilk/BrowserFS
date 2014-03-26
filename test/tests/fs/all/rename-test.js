/**
 * Tests basic file and directory renaming in writable file systems.
 */
define([], function() { return function(){
  var rootFS = fs.getRootFS(),
    isReadOnly = rootFS.isReadOnly(),
    oldParentName = '/_renameTest',
    newParentName = '/_renameTest2';

  if (isReadOnly) {
    return;
  }

  /**
   * Creates the following directory structure within the given dir:
   * - _rename_me
   *   - lol.txt
   * - file.dat
   */
  function populate_directory(dir, cb) {
    var dir1 = path.resolve(dir, '_rename_me'),
      file1 = path.resolve(dir, 'file.dat'),
      file2 = path.resolve(dir1, 'lol.txt');
    fs.mkdir(dir1, function(e) {
      if (e) {
        throw e;
      }
      fs.writeFile(file1, new Buffer('filedata'), function (e) {
        if (e) {
          throw e;
        }
        fs.writeFile(file2, new Buffer('lololol'), function (e) {
          if (e) {
            throw e;
          }
          cb();
        });
      });
    });
  }

  /**
   * Check that the directory structure created in populate_directory remains.
   */
  function check_directory(dir, cb) {
    var dir1 = path.resolve(dir, '_rename_me'),
      file1 = path.resolve(dir, 'file.dat'),
      file2 = path.resolve(dir1, 'lol.txt');
    fs.readdir(dir, function (e, contents) {
      if (e) {
        throw e;
      }
      assert(contents.length === 2);
      fs.readdir(dir1, function (e, contents) {
        if (e) {
          throw e;
        }
        assert(contents.length === 1);
        fs.exists(file1, function (exists) {
          assert(exists);
          fs.exists(file2, function (exists) {
            assert(exists);
            cb();
          });
        });
      });
    });
  }

  var oldDir = '/rename_test',
    newDir = '/rename_test2';

  // Directory rename.
  fs.mkdir(oldDir, function (e) {
    if (e) {
      throw e;
    }
    populate_directory(oldDir, function () {
      fs.rename(oldDir, oldDir, function (e) {
        if (e) {
          throw new Error("Failed invariant: CAN rename a directory to itself.");
        }
        check_directory(oldDir, function () {
          fs.mkdir(newDir, function (e) {
            if (e) {
              throw e;
            }
            fs.rmdir(newDir, function (e) {
              if (e) {
                throw e;
              }
              fs.rename(oldDir, newDir, function (e) {
                if (e) {
                  throw new Error("Failed to rename directory.");
                }
                check_directory(newDir, function () {
                  fs.exists(oldDir, function (exists) {
                    if (exists) {
                      throw new Error("Failed invariant: Renamed directory still exists at old name.");
                    }
                    // Renaming directories with *different* parent directories.
                    fs.mkdir(oldDir, function (e) {
                      if (e) {
                        throw e;
                      }
                      populate_directory(oldDir, function () {
                        fs.rename(oldDir, path.resolve(newDir, 'newDir'), function (e) {
                          if (e) {
                            throw new Error("Failed to rename directories with different parents.");
                          }
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });

  // File rename.
  var fileDir = '/rename_file_test',
    file1 = path.resolve(fileDir, 'fun.js'),
    file2 = path.resolve(fileDir, 'fun2.js');
  fs.mkdir(fileDir, function (e) {
    if (e) {
      throw e;
    }
    fs.writeFile(file1, new Buffer('while(1) alert("Hey! Listen!");'), function (e) {
      fs.rename(file1, file1, function (e) {
        if (e) {
          throw new Error("Failed invariant: CAN rename file to itself.");
        }
        fs.rename(file1, file2, function (e) {
          if (e) {
            throw new Error("Failed invariant: Failed to rename file.");
          }
          fs.writeFile(file1, new Buffer('hey'), function (e) {
            if (e) {
              throw e;
            }
            fs.rename(file1, file2, function (e) {
              if (e) {
                throw new Error("Failed invariant: Renaming a file to an existing file overwrites the file.");
              }
              fs.readFile(file2, function (e, contents) {
                if (e) {
                  throw e;
                }
                assert(contents.toString() === 'hey');
                fs.exists(file1, function (exists) {
                  assert(!exists);
                });
              });
            });
          });
        });
      });
    });
  });

  // file-2-dir and dir-2-file rename
  var dir = '/rename_filedir_test',
    file = '/rename_filedir_test.txt';
  fs.mkdir(dir, function (e) {
    if (e) {
      throw e;
    }
    fs.writeFile(file, new Buffer("file contents go here"), function (e) {
      if (e) {
        throw e;
      }
      fs.rename(file, dir, function (e) {
        if (e == null) {
          throw new Error("Failed invariant: Cannot rename a file over an existing directory.");
        } else {
          // it's a permissions error for some reason (tested in node).
          assert(e.code === 'EPERM');
        }
        fs.rename(dir, file, function (e) {
          if (e) {
            throw new Error("Failed invariant: Can rename a directory over a file.");
          }
        });
      });
    });
  });

  // cannot rename a directory inside itself
  var renDir1 = '/renamedir_1', renDir2 = '/renamedir_1/lol';
  fs.mkdir(renDir1, function (e) {
    if (e) {
      throw e;
    }
    fs.rename(renDir1, renDir2, function (e) {
      if (e == null) {
        throw new Error("Failed invariant: Cannot move a directory inside itself.");
      } else {
        //assert(e.code === 'EBUSY');
      }
    });
  });
};});
