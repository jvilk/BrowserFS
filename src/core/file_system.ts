import api_error = require('api_error');
import stat = require('node_fs_stats');

export class FileSystem {

  public getName(): string {
    return 'Unspecified';
  }

  public static isAvailable(): boolean {
    return false;
  }

  public diskSpace(path: string, cb: (number, number) => any): void {
    cb(0, 0);
  }

  public isReadOnly(): boolean {
    return true;
  }

  public supportsLinks(): boolean {
    return false;
  }

  public supportsProps(): boolean {
    return false;
  }

  public supportsSynch(): boolean {
    return false;
  }

  public rename(oldPath: string, newPath: string, cb: Function): void {
    cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
  }

  public renameSync(oldPath: string, newPath: string) {
    throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
  }

  public stat(path: string, isLstat: boolean, cb: (api_error.ApiError, stat.Stats)): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED), null);
  }

  public statSync(path: string, isLstat: boolean): stat.Stats {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public open(path: string, flags, mode, cb) {
    return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
  };

  public openSync(path, flags, mode) {
    throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
  };

  public unlink(path, cb) {
    return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
  };

  public unlinkSync(path) {
    throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
  };

  public rmdir(path, cb) {
    return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
  };

  public rmdirSync(path) {
    throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
  };

  public mkdir(path, mode, cb) {
    return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
  };

  public mkdirSync(path, mode) {
    throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
  };

  public readdir(path, cb) {
    return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
  };

  public readdirSync(path) {
    throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
  };

  public exists(path, cb) {
    return this.stat(path, null, function(err) {
      return cb(err == null);
    });
  };

  public existsSync(path) {
    var e;

    try {
      this.statSync(path);
      return true;
    } catch (_error) {
      e = _error;
      return false;
    }
  };

  public realpath(path, cache, cb) {
    var addPaths, i, splitPath, _i, _ref, _results;

    if (this.supportsLinks()) {
      splitPath = path.split(BrowserFS.node.path.sep);
      _results = [];
      for (i = _i = 0, _ref = splitPath.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
        addPaths = splitPath.slice(0, i + 1);
        _results.push(splitPath[i] = BrowserFS.node.path.join.apply(null, addPaths));
      }
      return _results;
    } else {
      return this.exists(path, function(doesExist) {
        if (doesExist) {
          return cb(null, path);
        } else {
          return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_FOUND, "File " + path + " not found."));
        }
      });
    }
  };

  public realpathSync(path, cache) {
    var addPaths, i, splitPath, _i, _ref, _results;

    if (this.supportsLinks()) {
      splitPath = path.split(BrowserFS.node.path.sep);
      _results = [];
      for (i = _i = 0, _ref = splitPath.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
        addPaths = splitPath.slice(0, i + 1);
        _results.push(splitPath[i] = BrowserFS.node.path.join.apply(null, addPaths));
      }
      return _results;
    } else {
      if (this.existsSync(path)) {
        return path;
      } else {
        throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_FOUND, "File " + path + " not found.");
      }
    }
  };

  public truncate(path, len, cb) {
    return BrowserFS.node.fs.open(path, 'w', (function(er, fd) {
      if (er) {
        return cb(er);
      }
      return BrowserFS.node.fs.ftruncate(fd, len, (function(er) {
        return BrowserFS.node.fs.close(fd, (function(er2) {
          return cb(er || er2);
        }));
      }));
    }));
  };

  public truncateSync(path, len) {
    var e, fd;

    fd = BrowserFS.node.fs.openSync(path, 'w');
    try {
      BrowserFS.node.fs.ftruncateSync(fd, len);
    } catch (_error) {
      e = _error;
    }
    BrowserFS.node.fs.closeSync(fd);
    if (e != null) {
      throw e;
    }
  };

  public readFile(fname, encoding, flag, cb) {
    var oldCb;

    oldCb = cb;
    return this.open(fname, flag, 0x1a4, function(err, fd) {
      if (err != null) {
        return cb(err);
      }
      cb(err, arg) {
        return fd.close(function(err2) {
          if (err == null) {
            err = err2;
          }
          return oldCb(err, arg);
        });
      };
      return BrowserFS.node.fs.fstat(fd, function(err, stat) {
        var buf;

        if (err != null) {
          return cb(err);
        }
        buf = new BrowserFS.node.Buffer(stat.size);
        return BrowserFS.node.fs.read(fd, buf, 0, stat.size, 0, function(err) {
          var e;

          if (err != null) {
            return cb(err);
          }
          if (encoding === null) {
            return cb(err, buf);
          }
          try {
            return cb(null, buf.toString(encoding));
          } catch (_error) {
            e = _error;
            return cb(e);
          }
        });
      });
    });
  };

  public readFileSync(fname, encoding, flag) {
    var buf, e, fd, stat;

    fd = this.openSync(fname, flag, 0x1a4);
    try {
      stat = BrowserFS.node.fs.fstatSync(fd);
      buf = new BrowserFS.node.Buffer(stat.size);
      BrowserFS.node.fs.readSync(fd, buf, 0, stat.size, 0);
      BrowserFS.node.fs.closeSync(fd);
      if (encoding === null) {
        return buf;
      }
      return buf.toString(encoding);
    } catch (_error) {
      e = _error;
      BrowserFS.node.fs.closeSync(fd);
      throw e;
    }
  };

  public writeFile(fname, data, encoding, flag, mode, cb) {
    var oldCb;

    oldCb = cb;
    return this.open(fname, flag, 0x1a4, function(err, fd) {
      if (err != null) {
        return cb(err);
      }
      cb(err) {
        return fd.close(function(err2) {
          return oldCb(err != null ? err : err2);
        });
      };
      if (typeof data === 'string') {
        data = new BrowserFS.node.Buffer(data, encoding);
      }
      return fd.write(data, 0, data.length, 0, function(err) {
        return cb(err);
      });
    });
  };

  public writeFileSync(fname, data, encoding, flag, mode) {
    var e, fd;

    fd = this.openSync(fname, flag, mode);
    if (typeof data === 'string') {
      data = new BrowserFS.node.Buffer(data, encoding);
    }
    try {
      fd.writeSync(data, 0, data.length, 0);
    } catch (_error) {
      e = _error;
    }
    BrowserFS.node.fs.closeSync(fd);
    if (e != null) {
      throw e;
    }
  };

  public appendFile(fname, data, encoding, flag, mode, cb) {
    var oldCb;

    oldCb = cb;
    return this.open(fname, flag, mode, function(err, fd) {
      if (err != null) {
        return cb(err);
      }
      cb(err) {
        return fd.close(function(err2) {
          return oldCb(err != null ? err : err2);
        });
      };
      if (typeof data === 'string') {
        data = new BrowserFS.node.Buffer(data, encoding);
      }
      return fd.write(data, 0, data.length, null, function(err) {
        return cb(err);
      });
    });
  };

  public appendFileSync(fname, data, encoding, flag, mode) {
    var e, fd;

    fd = this.openSync(fname, flag, mode);
    if (typeof data === 'string') {
      data = new BrowserFS.node.Buffer(data, encoding);
    }
    try {
      fd.writeSync(data, 0, data.length, null);
    } catch (_error) {
      e = _error;
    }
    BrowserFS.node.fs.closeSync(fd);
    if (e != null) {
      throw e;
    }
  };

  public chmod(path, isLchmod, mode, cb) {
    return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
  };

  public chmodSync(path, isLchmod, mode) {
    throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
  };

  public chown(path, isLchown, uid, gid, cb) {
    return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
  };

  public chownSync(path, isLchown, uid, gid) {
    throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
  };

  public utimes(path, atime, mtime, cb) {
    return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
  };

  public utimesSync(path, atime, mtime) {
    throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
  };

  public link(srcpath, dstpath, cb) {
    return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
  };

  public linkSync(srcpath, dstpath) {
    throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
  };

  public symlink(srcpath, dstpath, type, cb) {
    return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
  };

  public symlinkSync(srcpath, dstpath, type) {
    throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
  };

  public readlink(path, cb) {
    return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
  };

  public readlinkSync(path) {
    throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
  };

  return FileSystem;

})();

BrowserFS.SynchronousFileSystem = (function(_super) {
  __extends(SynchronousFileSystem, _super);

  function SynchronousFileSystem() {
    _ref = SynchronousFileSystem.__super__.constructor.apply(this, arguments);
    return _ref;
  }

  Synchronouspublic supportsSynch() {
    return true;
  };

  Synchronouspublic rename(oldPath, newPath, cb) {
    var e;

    try {
      this.renameSync(oldPath, newPath);
      return cb();
    } catch (_error) {
      e = _error;
      return cb(e);
    }
  };

  Synchronouspublic stat(path, isLstat, cb) {
    var e;

    try {
      return cb(null, this.statSync(path, isLstat));
    } catch (_error) {
      e = _error;
      return cb(e);
    }
  };

  Synchronouspublic open(path, flags, mode, cb) {
    var e;

    try {
      return cb(null, this.openSync(path, flags, mode, cb));
    } catch (_error) {
      e = _error;
      return cb(e);
    }
  };

  Synchronouspublic unlink(path, cb) {
    var e;

    try {
      this.unlinkSync(path);
      return cb();
    } catch (_error) {
      e = _error;
      return cb(e);
    }
  };

  Synchronouspublic rmdir(path, cb) {
    var e;

    try {
      this.rmdirSync(path);
      return cb();
    } catch (_error) {
      e = _error;
      return cb(e);
    }
  };

  Synchronouspublic mkdir(path, mode, cb) {
    var e;

    try {
      this.mkdirSync(path, mode);
      return cb();
    } catch (_error) {
      e = _error;
      return cb(e);
    }
  };

  Synchronouspublic readdir(path, cb) {
    var e;

    try {
      return cb(null, this.readdirSync(path));
    } catch (_error) {
      e = _error;
      return cb(e);
    }
  };

  Synchronouspublic chmod(path, isLchmod, mode, cb) {
    var e;

    try {
      this.chmodSync(path, isLchmod, mode);
      return cb();
    } catch (_error) {
      e = _error;
      return cb(e);
    }
  };

  Synchronouspublic chown(path, isLchown, uid, gid, cb) {
    var e;

    try {
      this.chownSync(path, isLchown, uid, gid);
      return cb();
    } catch (_error) {
      e = _error;
      return cb(e);
    }
  };

  Synchronouspublic utimes(path, atime, mtime, cb) {
    var e;

    try {
      this.utimesSync(path, atime, mtime);
      return cb();
    } catch (_error) {
      e = _error;
      return cb(e);
    }
  };

  Synchronouspublic link(srcpath, dstpath, cb) {
    var e;

    try {
      this.linkSync(srcpath, dstpath);
      return cb();
    } catch (_error) {
      e = _error;
      return cb(e);
    }
  };

  Synchronouspublic symlink(srcpath, dstpath, type, cb) {
    var e;

    try {
      this.symlinkSync(srcpath, dstpath, type);
      return cb();
    } catch (_error) {
      e = _error;
      return cb(e);
    }
  };

  Synchronouspublic readlink(path, cb) {
    var e;

    try {
      return cb(null, this.readlinkSync(path));
    } catch (_error) {
      e = _error;
      return cb(e);
    }
  };

  return SynchronousFileSystem;

})(BrowserFS.FileSystem);

}).call(this);
