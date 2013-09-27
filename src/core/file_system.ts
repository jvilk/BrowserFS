// Generated by CoffeeScript 1.6.2
(function() {
  var _ref,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  BrowserFS.FileSystem = (function() {
    function FileSystem() {}

    FileSystem.prototype.getName = function() {
      return 'Unspecified';
    };

    FileSystem.isAvailable = function() {
      return false;
    };

    FileSystem.prototype.diskSpace = function(path, cb) {
      return cb(0, 0);
    };

    FileSystem.prototype.isReadOnly = function() {
      return true;
    };

    FileSystem.prototype.supportsLinks = function() {
      return false;
    };

    FileSystem.prototype.supportsProps = function() {
      return false;
    };

    FileSystem.prototype.supportsSynch = function() {
      return false;
    };

    FileSystem.prototype.rename = function(oldPath, newPath, cb) {
      return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
    };

    FileSystem.prototype.renameSync = function(oldPath, newPath) {
      throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
    };

    FileSystem.prototype.stat = function(path, isLstat, cb) {
      return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
    };

    FileSystem.prototype.statSync = function(path, isLstat) {
      throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
    };

    FileSystem.prototype.open = function(path, flags, mode, cb) {
      return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
    };

    FileSystem.prototype.openSync = function(path, flags, mode) {
      throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
    };

    FileSystem.prototype.unlink = function(path, cb) {
      return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
    };

    FileSystem.prototype.unlinkSync = function(path) {
      throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
    };

    FileSystem.prototype.rmdir = function(path, cb) {
      return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
    };

    FileSystem.prototype.rmdirSync = function(path) {
      throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
    };

    FileSystem.prototype.mkdir = function(path, mode, cb) {
      return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
    };

    FileSystem.prototype.mkdirSync = function(path, mode) {
      throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
    };

    FileSystem.prototype.readdir = function(path, cb) {
      return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
    };

    FileSystem.prototype.readdirSync = function(path) {
      throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
    };

    FileSystem.prototype.exists = function(path, cb) {
      return this.stat(path, null, function(err) {
        return cb(err == null);
      });
    };

    FileSystem.prototype.existsSync = function(path) {
      var e;

      try {
        this.statSync(path);
        return true;
      } catch (_error) {
        e = _error;
        return false;
      }
    };

    FileSystem.prototype.realpath = function(path, cache, cb) {
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

    FileSystem.prototype.realpathSync = function(path, cache) {
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

    FileSystem.prototype.truncate = function(path, len, cb) {
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

    FileSystem.prototype.truncateSync = function(path, len) {
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

    FileSystem.prototype.readFile = function(fname, encoding, flag, cb) {
      var oldCb;

      oldCb = cb;
      return this.open(fname, flag, 0x1a4, function(err, fd) {
        if (err != null) {
          return cb(err);
        }
        cb = function(err, arg) {
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

    FileSystem.prototype.readFileSync = function(fname, encoding, flag) {
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

    FileSystem.prototype.writeFile = function(fname, data, encoding, flag, mode, cb) {
      var oldCb;

      oldCb = cb;
      return this.open(fname, flag, 0x1a4, function(err, fd) {
        if (err != null) {
          return cb(err);
        }
        cb = function(err) {
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

    FileSystem.prototype.writeFileSync = function(fname, data, encoding, flag, mode) {
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

    FileSystem.prototype.appendFile = function(fname, data, encoding, flag, mode, cb) {
      var oldCb;

      oldCb = cb;
      return this.open(fname, flag, mode, function(err, fd) {
        if (err != null) {
          return cb(err);
        }
        cb = function(err) {
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

    FileSystem.prototype.appendFileSync = function(fname, data, encoding, flag, mode) {
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

    FileSystem.prototype.chmod = function(path, isLchmod, mode, cb) {
      return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
    };

    FileSystem.prototype.chmodSync = function(path, isLchmod, mode) {
      throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
    };

    FileSystem.prototype.chown = function(path, isLchown, uid, gid, cb) {
      return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
    };

    FileSystem.prototype.chownSync = function(path, isLchown, uid, gid) {
      throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
    };

    FileSystem.prototype.utimes = function(path, atime, mtime, cb) {
      return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
    };

    FileSystem.prototype.utimesSync = function(path, atime, mtime) {
      throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
    };

    FileSystem.prototype.link = function(srcpath, dstpath, cb) {
      return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
    };

    FileSystem.prototype.linkSync = function(srcpath, dstpath) {
      throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
    };

    FileSystem.prototype.symlink = function(srcpath, dstpath, type, cb) {
      return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
    };

    FileSystem.prototype.symlinkSync = function(srcpath, dstpath, type) {
      throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
    };

    FileSystem.prototype.readlink = function(path, cb) {
      return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
    };

    FileSystem.prototype.readlinkSync = function(path) {
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

    SynchronousFileSystem.prototype.supportsSynch = function() {
      return true;
    };

    SynchronousFileSystem.prototype.rename = function(oldPath, newPath, cb) {
      var e;

      try {
        this.renameSync(oldPath, newPath);
        return cb();
      } catch (_error) {
        e = _error;
        return cb(e);
      }
    };

    SynchronousFileSystem.prototype.stat = function(path, isLstat, cb) {
      var e;

      try {
        return cb(null, this.statSync(path, isLstat));
      } catch (_error) {
        e = _error;
        return cb(e);
      }
    };

    SynchronousFileSystem.prototype.open = function(path, flags, mode, cb) {
      var e;

      try {
        return cb(null, this.openSync(path, flags, mode, cb));
      } catch (_error) {
        e = _error;
        return cb(e);
      }
    };

    SynchronousFileSystem.prototype.unlink = function(path, cb) {
      var e;

      try {
        this.unlinkSync(path);
        return cb();
      } catch (_error) {
        e = _error;
        return cb(e);
      }
    };

    SynchronousFileSystem.prototype.rmdir = function(path, cb) {
      var e;

      try {
        this.rmdirSync(path);
        return cb();
      } catch (_error) {
        e = _error;
        return cb(e);
      }
    };

    SynchronousFileSystem.prototype.mkdir = function(path, mode, cb) {
      var e;

      try {
        this.mkdirSync(path, mode);
        return cb();
      } catch (_error) {
        e = _error;
        return cb(e);
      }
    };

    SynchronousFileSystem.prototype.readdir = function(path, cb) {
      var e;

      try {
        return cb(null, this.readdirSync(path));
      } catch (_error) {
        e = _error;
        return cb(e);
      }
    };

    SynchronousFileSystem.prototype.chmod = function(path, isLchmod, mode, cb) {
      var e;

      try {
        this.chmodSync(path, isLchmod, mode);
        return cb();
      } catch (_error) {
        e = _error;
        return cb(e);
      }
    };

    SynchronousFileSystem.prototype.chown = function(path, isLchown, uid, gid, cb) {
      var e;

      try {
        this.chownSync(path, isLchown, uid, gid);
        return cb();
      } catch (_error) {
        e = _error;
        return cb(e);
      }
    };

    SynchronousFileSystem.prototype.utimes = function(path, atime, mtime, cb) {
      var e;

      try {
        this.utimesSync(path, atime, mtime);
        return cb();
      } catch (_error) {
        e = _error;
        return cb(e);
      }
    };

    SynchronousFileSystem.prototype.link = function(srcpath, dstpath, cb) {
      var e;

      try {
        this.linkSync(srcpath, dstpath);
        return cb();
      } catch (_error) {
        e = _error;
        return cb(e);
      }
    };

    SynchronousFileSystem.prototype.symlink = function(srcpath, dstpath, type, cb) {
      var e;

      try {
        this.symlinkSync(srcpath, dstpath, type);
        return cb();
      } catch (_error) {
        e = _error;
        return cb(e);
      }
    };

    SynchronousFileSystem.prototype.readlink = function(path, cb) {
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