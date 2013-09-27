// Generated by CoffeeScript 1.6.2
(function() {
  var checkFd, nopCb, wrapCb,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  wrapCb = function(cb, numArgs) {
    if (typeof cb !== 'function') {
      throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, 'Callback must be a function.');
    }
    if (typeof window.__numWaiting === void 0) {
      window.__numWaiting = 0;
    }
    window.__numWaiting++;
    switch (numArgs) {
      case 1:
        return function(arg1) {
          return setImmediate(function() {
            window.__numWaiting--;
            return cb(arg1);
          });
        };
      case 2:
        return function(arg1, arg2) {
          return setImmediate(function() {
            window.__numWaiting--;
            return cb(arg1, arg2);
          });
        };
      case 3:
        return function(arg1, arg2, arg3) {
          return setImmediate(function() {
            window.__numWaiting--;
            return cb(arg1, arg2, arg3);
          });
        };
      default:
        throw new Error('Invalid invocation of wrapCb.');
    }
  };

  checkFd = function(fd, async) {
    if (async == null) {
      async = true;
    }
    if (!(fd instanceof BrowserFS.File)) {
      if (async) {
        return new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, 'Invalid file descriptor.');
      } else {
        throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, 'Invalid file descriptor.');
      }
    }
    return true;
  };

  nopCb = function() {};

  BrowserFS.node.fs = (function() {
    function fs() {}

    fs._initialize = function(rootFS) {
      if (!rootFS.constructor.isAvailable()) {
        throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, 'Tried to instantiate BrowserFS with an unavailable file system.');
      }
      return fs.root = rootFS;
    };

    fs._toUnixTimestamp = function(time) {
      if (typeof time === 'number') {
        return time;
      }
      if (time instanceof Date) {
        return time.getTime() / 1000;
      }
      throw new Error("Cannot parse time: " + time);
    };

    fs.getRootFS = function() {
      if (fs.root) {
        return fs.root;
      } else {
        return null;
      }
    };

    fs._canonicalizePath = function(p) {
      if (p.indexOf('\u0000') >= 0) {
        throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, 'Path must be a string without null bytes.');
      }
      if (p === '') {
        throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, 'Path must not be empty.');
      }
      return BrowserFS.node.path.resolve(p);
    };

    fs.rename = function(oldPath, newPath, callback) {
      var e, newCb;

      if (callback == null) {
        callback = nopCb;
      }
      try {
        newCb = wrapCb(callback, 1);
        oldPath = fs._canonicalizePath(oldPath);
        newPath = fs._canonicalizePath(newPath);
        return fs.root.rename(oldPath, newPath, newCb);
      } catch (_error) {
        e = _error;
        return newCb(e);
      }
    };

    fs.renameSync = function(oldPath, newPath) {
      oldPath = fs._canonicalizePath(oldPath);
      newPath = fs._canonicalizePath(newPath);
      return fs.root.renameSync(oldPath, newPath);
    };

    fs.exists = function(path, callback) {
      var e, newCb;

      if (callback == null) {
        callback = nopCb;
      }
      try {
        newCb = wrapCb(callback, 1);
        path = fs._canonicalizePath(path);
        return fs.root.exists(path, newCb);
      } catch (_error) {
        e = _error;
        return newCb(false);
      }
    };

    fs.existsSync = function(path) {
      var e;

      try {
        path = fs._canonicalizePath(path);
        return fs.root.existsSync(path);
      } catch (_error) {
        e = _error;
        return false;
      }
    };

    fs.stat = function(path, callback) {
      var e, newCb;

      if (callback == null) {
        callback = nopCb;
      }
      try {
        newCb = wrapCb(callback, 2);
        path = fs._canonicalizePath(path);
        return fs.root.stat(path, false, newCb);
      } catch (_error) {
        e = _error;
        return newCb(e);
      }
    };

    fs.statSync = function(path) {
      path = fs._canonicalizePath(path);
      return fs.root.statSync(path, false);
    };

    fs.lstat = function(path, callback) {
      var e, newCb;

      if (callback == null) {
        callback = nopCb;
      }
      try {
        newCb = wrapCb(callback, 2);
        path = fs._canonicalizePath(path);
        return fs.root.stat(path, true, newCb);
      } catch (_error) {
        e = _error;
        return newCb(e);
      }
    };

    fs.lstatSync = function(path) {
      path = fs._canonicalizePath(path);
      return fs.root.statSync(path, true);
    };

    fs.truncate = function(path, len, callback) {
      var e, newCb;

      if (callback == null) {
        callback = nopCb;
      }
      try {
        if (typeof len === 'function') {
          callback = len;
          len = 0;
        }
        newCb = wrapCb(callback, 1);
        path = fs._canonicalizePath(path);
        return fs.root.truncate(path, len, newCb);
      } catch (_error) {
        e = _error;
        return newCb(e);
      }
    };

    fs.truncateSync = function(path, len) {
      if (len == null) {
        len = 0;
      }
      path = fs._canonicalizePath(path);
      return fs.root.truncateSync(path, len);
    };

    fs.unlink = function(path, callback) {
      var e, newCb;

      if (callback == null) {
        callback = nopCb;
      }
      try {
        newCb = wrapCb(callback, 1);
        path = fs._canonicalizePath(path);
        return fs.root.unlink(path, newCb);
      } catch (_error) {
        e = _error;
        return newCb(e);
      }
    };

    fs.unlinkSync = function(path) {
      path = fs._canonicalizePath(path);
      return fs.root.unlinkSync(path);
    };

    fs.open = function(path, flags, mode, callback) {
      var e, newCb;

      if (callback == null) {
        callback = nopCb;
      }
      try {
        if (typeof mode === 'function') {
          callback = mode;
          mode = 0x1a4;
        }
        newCb = wrapCb(callback, 2);
        path = fs._canonicalizePath(path);
        flags = BrowserFS.FileMode.getFileMode(flags);
        return fs.root.open(path, flags, mode, newCb);
      } catch (_error) {
        e = _error;
        return newCb(e);
      }
    };

    fs.openSync = function(path, flags, mode) {
      if (mode == null) {
        mode = 0x1a4;
      }
      path = fs._canonicalizePath(path);
      flags = BrowserFS.FileMode.getFileMode(flags);
      return fs.root.openSync(path, flags, mode);
    };

    fs.readFile = function(filename, options, callback) {
      var e, flags, newCb;

      if (callback == null) {
        callback = nopCb;
      }
      try {
        if (typeof options === 'function') {
          callback = options;
          options = {};
        } else if (typeof options === 'string') {
          options = {
            encoding: options
          };
        }
        if (options === void 0) {
          options = {};
        }
        if (options.encoding === void 0) {
          options.encoding = null;
        }
        if (options.flag == null) {
          options.flag = 'r';
        }
        newCb = wrapCb(callback, 2);
        filename = fs._canonicalizePath(filename);
        flags = BrowserFS.FileMode.getFileMode(options.flag);
        if (!flags.isReadable()) {
          return newCb(new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, 'Flag passed to readFile must allow for reading.'));
        }
        return fs.root.readFile(filename, options.encoding, flags, newCb);
      } catch (_error) {
        e = _error;
        return newCb(e);
      }
    };

    fs.readFileSync = function(filename, options) {
      var flags;

      if (options == null) {
        options = {};
      }
      if (typeof options === 'string') {
        options = {
          encoding: options
        };
      }
      if (options === void 0) {
        options = {};
      }
      if (options.encoding === void 0) {
        options.encoding = null;
      }
      if (options.flag == null) {
        options.flag = 'r';
      }
      filename = fs._canonicalizePath(filename);
      flags = BrowserFS.FileMode.getFileMode(options.flag);
      if (!flags.isReadable()) {
        throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, 'Flag passed to readFile must allow for reading.');
      }
      return fs.root.readFileSync(filename, options.encoding, flags);
    };

    fs.writeFile = function(filename, data, options, callback) {
      var e, flags, newCb;

      if (options == null) {
        options = {};
      }
      if (callback == null) {
        callback = nopCb;
      }
      try {
        if (typeof options === 'function') {
          callback = options;
          options = {};
        } else if (typeof options === 'string') {
          options = {
            encoding: options
          };
        }
        if (options === void 0) {
          options = {};
        }
        if (options.encoding === void 0) {
          options.encoding = 'utf8';
        }
        if (options.flag == null) {
          options.flag = 'w';
        }
        if (options.mode == null) {
          options.mode = 0x1a4;
        }
        newCb = wrapCb(callback, 1);
        filename = fs._canonicalizePath(filename);
        flags = BrowserFS.FileMode.getFileMode(options.flag);
        if (!flags.isWriteable()) {
          return newCb(new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, 'Flag passed to writeFile must allow for writing.'));
        }
        return fs.root.writeFile(filename, data, options.encoding, flags, options.mode, newCb);
      } catch (_error) {
        e = _error;
        return newCb(e);
      }
    };

    fs.writeFileSync = function(filename, data, options) {
      var flags;

      if (options == null) {
        options = {};
      }
      if (typeof options === 'string') {
        options = {
          encoding: options
        };
      }
      if (options === void 0) {
        options = {};
      }
      if (options.encoding === void 0) {
        options.encoding = 'utf8';
      }
      if (options.flag == null) {
        options.flag = 'w';
      }
      if (options.mode == null) {
        options.mode = 0x1a4;
      }
      filename = fs._canonicalizePath(filename);
      flags = BrowserFS.FileMode.getFileMode(options.flag);
      if (!flags.isWriteable()) {
        throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, 'Flag passed to writeFile must allow for writing.');
      }
      return fs.root.writeFileSync(filename, data, options.encoding, flags, options.mode);
    };

    fs.appendFile = function(filename, data, options, callback) {
      var e, flags, newCb;

      if (callback == null) {
        callback = nopCb;
      }
      try {
        if (typeof options === 'function') {
          callback = options;
          options = {};
        } else if (typeof options === 'string') {
          options = {
            encoding: options
          };
        }
        if (options === void 0) {
          options = {};
        }
        if (options.encoding === void 0) {
          options.encoding = 'utf8';
        }
        if (options.flag == null) {
          options.flag = 'a';
        }
        if (options.mode == null) {
          options.mode = 0x1a4;
        }
        newCb = wrapCb(callback, 1);
        filename = fs._canonicalizePath(filename);
        flags = BrowserFS.FileMode.getFileMode(options.flag);
        if (!flags.isAppendable()) {
          return newCb(new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, 'Flag passed to appendFile must allow for appending.'));
        }
        return fs.root.appendFile(filename, data, options.encoding, flags, options.mode, newCb);
      } catch (_error) {
        e = _error;
        return newCb(e);
      }
    };

    fs.appendFileSync = function(filename, data, options) {
      var flags;

      if (options == null) {
        options = {};
      }
      if (typeof options === 'string') {
        options = {
          encoding: options
        };
      }
      if (options === void 0) {
        options = {};
      }
      if (options.encoding === void 0) {
        options.encoding = 'utf8';
      }
      if (options.flag == null) {
        options.flag = 'a';
      }
      if (options.mode == null) {
        options.mode = 0x1a4;
      }
      filename = fs._canonicalizePath(filename);
      flags = BrowserFS.FileMode.getFileMode(options.flag);
      if (!flags.isAppendable()) {
        throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, 'Flag passed to appendFile must allow for appending.');
      }
      return fs.root.appendFileSync(filename, data, options.encoding, flags, options.mode);
    };

    fs.fstat = function(fd, callback) {
      var e, fdChk, newCb;

      if (callback == null) {
        callback = nopCb;
      }
      try {
        newCb = wrapCb(callback, 2);
        fdChk = checkFd(fd);
        if (!fdChk) {
          return newCb(fdChk);
        }
        return fd.stat(newCb);
      } catch (_error) {
        e = _error;
        return newCb(e);
      }
    };

    fs.fstatSync = function(fd) {
      checkFd(fd, false);
      return fd.statSync();
    };

    fs.close = function(fd, callback) {
      var e, fdChk, newCb;

      if (callback == null) {
        callback = nopCb;
      }
      try {
        newCb = wrapCb(callback, 1);
        fdChk = checkFd(fd);
        if (!fdChk) {
          return newCb(fdChk);
        }
        return fd.close(newCb);
      } catch (_error) {
        e = _error;
        return newCb(e);
      }
    };

    fs.closeSync = function(fd) {
      checkFd(fd, false);
      return fd.closeSync();
    };

    fs.ftruncate = function(fd, len, callback) {
      var e, fdChk, newCb;

      if (callback == null) {
        callback = nopCb;
      }
      try {
        if (typeof len === 'function') {
          callback = len;
          len = 0;
        }
        newCb = wrapCb(callback, 1);
        fdChk = checkFd(fd);
        if (!fdChk) {
          return newCb(fdChk);
        }
        return fd.truncate(len, newCb);
      } catch (_error) {
        e = _error;
        return newCb(e);
      }
    };

    fs.ftruncateSync = function(fd, len) {
      if (len == null) {
        len = 0;
      }
      checkFd(fd, false);
      return fd.truncateSync(len);
    };

    fs.fsync = function(fd, callback) {
      var e, fdChk, newCb;

      if (callback == null) {
        callback = nopCb;
      }
      try {
        newCb = wrapCb(callback, 1);
        fdChk = checkFd(fd);
        if (!fdChk) {
          return newCb(fdChk);
        }
        return fd.sync(newCb);
      } catch (_error) {
        e = _error;
        return newCb(e);
      }
    };

    fs.fsyncSync = function(fd) {
      checkFd(fd, false);
      return fd.syncSync();
    };

    fs.fdatasync = function(fd, callback) {
      var e, fdChk, newCb;

      if (callback == null) {
        callback = nopCb;
      }
      try {
        newCb = wrapCb(callback, 1);
        fdChk = checkFd(fd);
        if (!fdChk) {
          return newCb(fdChk);
        }
        return fd.datasync(newCb);
      } catch (_error) {
        e = _error;
        return newCb(e);
      }
    };

    fs.fdatasyncSync = function(fd) {
      checkFd(fd, false);
      fd.datasyncSync();
    };

    fs.write = function(fd, buffer, offset, length, position, callback) {
      var e, encoding, fdChk, newCb;

      try {
        if (typeof buffer === 'string') {
          if (typeof position === 'function') {
            callback = position;
            encoding = length;
            position = offset;
            offset = 0;
          }
          buffer = new Buffer(buffer, encoding);
          length = buffer.length;
        }
        if (callback == null) {
          callback = position;
          position = fd.getPos();
        }
        newCb = wrapCb(callback, 3);
        fdChk = checkFd(fd);
        if (!fdChk) {
          return newCb(fdChk);
        }
        if (position == null) {
          position = fd.getPos();
        }
        return fd.write(buffer, offset, length, position, newCb);
      } catch (_error) {
        e = _error;
        return newCb(e);
      }
    };

    fs.writeSync = function(fd, buffer, offset, length, position) {
      var encoding;

      if (typeof buffer === 'string') {
        if (typeof length === 'string') {
          encoding = length;
        } else if (typeof offset === 'string') {
          encoding = offset;
        } else if (typeof offset === 'number') {
          position = offset;
        }
        offset = 0;
        buffer = new Buffer(buffer, encoding);
        length = buffer.length;
      }
      checkFd(fd, false);
      if (position == null) {
        position = fd.getPos();
      }
      return fd.writeSync(buffer, offset, length, position);
    };

    fs.read = function(fd, buffer, offset, length, position, callback) {
      var e, encoding, fdChk, newCb;

      if (callback == null) {
        callback = nopCb;
      }
      try {
        if (typeof buffer === 'number' && typeof offset === 'number' && typeof length === 'string' && typeof position === 'function') {
          callback = position;
          position = offset;
          offset = 0;
          encoding = length;
          length = buffer;
          buffer = new BrowserFS.node.Buffer(length);
          newCb = wrapCb((function(err, bytesRead, buf) {
            if (err) {
              return oldNewCb(err);
            }
            return callback(err, buf.toString(encoding), bytesRead);
          }), 3);
        } else {
          newCb = wrapCb(callback, 3);
        }
        fdChk = checkFd(fd);
        if (!fdChk) {
          return newCb(fdChk);
        }
        if (position == null) {
          position = fd.getPos();
        }
        return fd.read(buffer, offset, length, position, newCb);
      } catch (_error) {
        e = _error;
        return newCb(e);
      }
    };

    fs.readSync = function(fd, buffer, offset, length, position) {
      var encoding, rv, shenanigans;

      shenanigans = false;
      if (typeof buffer === 'number' && typeof offset === 'number' && typeof length === 'string') {
        position = offset;
        offset = 0;
        encoding = length;
        length = buffer;
        buffer = new BrowserFS.node.Buffer(length);
        shenanigans = true;
      }
      checkFd(fd, false);
      if (position == null) {
        position = fd.getPos();
      }
      rv = fd.readSync(buffer, offset, length, position);
      if (!shenanigans) {
        return rv;
      } else {
        return [buffer.toString(encoding), rv];
      }
    };

    fs.fchown = function(fd, uid, gid, callback) {
      var e, fdChk, newCb;

      if (callback == null) {
        callback = nopCb;
      }
      try {
        newCb = wrapCb(callback, 1);
        fdChk = checkFd(fd);
        if (!fdChk) {
          return newCb(fdChk);
        }
        return fd.chown(uid, gid, newCb);
      } catch (_error) {
        e = _error;
        return newCb(e);
      }
    };

    fs.fchownSync = function(fd, uid, gid) {
      checkFd(fd, false);
      return fd.chownSync(uid, gid);
    };

    fs.fchmod = function(fd, mode, callback) {
      var e, fdChk, newCb;

      if (callback == null) {
        callback = nopCb;
      }
      try {
        newCb = wrapCb(callback, 1);
        if (typeof mode === 'string') {
          mode = parseInt(mode, 8);
        }
        fdChk = checkFd(fd);
        if (!fdChk) {
          return newCb(fdChk);
        }
        return fd.chmod(mode, newCb);
      } catch (_error) {
        e = _error;
        return newCb(e);
      }
    };

    fs.fchmodSync = function(fd, mode) {
      if (typeof mode === 'string') {
        mode = parseInt(mode, 8);
      }
      checkFd(fd, false);
      return fd.chmodSync(mode);
    };

    fs.futimes = function(fd, atime, mtime, callback) {
      var e, fdChk, newCb;

      if (callback == null) {
        callback = nopCb;
      }
      try {
        newCb = wrapCb(callback, 1);
        fdChk = checkFd(fd);
        if (typeof atime === 'number') {
          atime = new Date(atime * 1000);
        }
        if (typeof mtime === 'number') {
          mtime = new Date(mtime * 1000);
        }
        if (!fdChk) {
          return newCb(fdChk);
        }
        return fd.utimes(atime, mtime, newCb);
      } catch (_error) {
        e = _error;
        return newCb(e);
      }
    };

    fs.futimesSync = function(fd, atime, mtime) {
      checkFd(fd, false);
      if (typeof atime === 'number') {
        atime = new Date(atime * 1000);
      }
      if (typeof mtime === 'number') {
        mtime = new Date(mtime * 1000);
      }
      return fd.utimesSync(atime, mtime);
    };

    fs.rmdir = function(path, callback) {
      var e, newCb;

      if (callback == null) {
        callback = nopCb;
      }
      try {
        newCb = wrapCb(callback, 1);
        path = fs._canonicalizePath(path);
        return BrowserFS.node.fs.root.rmdir(path, newCb);
      } catch (_error) {
        e = _error;
        return newCb(e);
      }
    };

    fs.rmdirSync = function(path) {
      path = fs._canonicalizePath(path);
      return BrowserFS.node.fs.root.rmdirSync(path);
    };

    fs.mkdir = function(path, mode, callback) {
      var e, newCb;

      if (callback == null) {
        callback = nopCb;
      }
      try {
        if (typeof mode === 'function') {
          callback = mode;
          mode = 0x1ff;
        }
        newCb = wrapCb(callback, 1);
        path = fs._canonicalizePath(path);
        return BrowserFS.node.fs.root.mkdir(path, mode, newCb);
      } catch (_error) {
        e = _error;
        return newCb(e);
      }
    };

    fs.mkdirSync = function(path, mode) {
      if (mode == null) {
        mode = 0x1ff;
      }
      path = fs._canonicalizePath(path);
      return BrowserFS.node.fs.root.mkdirSync(path, mode);
    };

    fs.readdir = function(path, callback) {
      var e, newCb;

      if (callback == null) {
        callback = nopCb;
      }
      try {
        newCb = wrapCb(callback, 2);
        path = fs._canonicalizePath(path);
        return fs.root.readdir(path, newCb);
      } catch (_error) {
        e = _error;
        return newCb(e);
      }
    };

    fs.readdirSync = function(path) {
      path = fs._canonicalizePath(path);
      return fs.root.readdirSync(path);
    };

    fs.link = function(srcpath, dstpath, callback) {
      var e, newCb;

      if (callback == null) {
        callback = nopCb;
      }
      try {
        newCb = wrapCb(callback, 1);
        srcpath = fs._canonicalizePath(srcpath);
        dstpath = fs._canonicalizePath(dstpath);
        return fs.root.link(srcpath, dstpath, newCb);
      } catch (_error) {
        e = _error;
        return newCb(e);
      }
    };

    fs.linkSync = function(srcpath, dstpath) {
      srcpath = fs._canonicalizePath(srcpath);
      dstpath = fs._canonicalizePath(dstpath);
      return fs.root.linkSync(srcpath, dstpath);
    };

    fs.symlink = function(srcpath, dstpath, type, callback) {
      var e, newCb;

      if (callback == null) {
        callback = nopCb;
      }
      try {
        if (typeof type === 'function') {
          callback = type;
          type = 'file';
        }
        newCb = wrapCb(callback, 1);
        if (type !== 'file' && type !== 'dir') {
          return newCb(new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, "Invalid type: " + type));
        }
        srcpath = fs._canonicalizePath(srcpath);
        dstpath = fs._canonicalizePath(dstpath);
        return fs.root.symlink(srcpath, dstpath, type, newCb);
      } catch (_error) {
        e = _error;
        return newCb(e);
      }
    };

    fs.symlink = function(srcpath, dstpath, type) {
      if (type == null) {
        type = 'file';
      }
      if (type !== 'file' && type !== 'dir') {
        throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, "Invalid type: " + type);
      }
      srcpath = fs._canonicalizePath(srcpath);
      dstpath = fs._canonicalizePath(dstpath);
      return fs.root.symlinkSync(srcpath, dstpath, type);
    };

    fs.readlink = function(path, callback) {
      var e, newCb;

      if (callback == null) {
        callback = nopCb;
      }
      try {
        newCb = wrapCb(callback, 2);
        path = fs._canonicalizePath(path);
        return fs.root.readlink(path, newCb);
      } catch (_error) {
        e = _error;
        return newCb(e);
      }
    };

    fs.readlinkSync = function(path) {
      path = fs._canonicalizePath(path);
      return fs.root.readlinkSync(path);
    };

    fs.chown = function(path, uid, gid, callback) {
      var e, newCb;

      if (callback == null) {
        callback = nopCb;
      }
      try {
        newCb = wrapCb(callback, 1);
        path = fs._canonicalizePath(path);
        return fs.root.chown(path, false, uid, gid, newCb);
      } catch (_error) {
        e = _error;
        return newCb(e);
      }
    };

    fs.chownSync = function(path, uid, gid) {
      path = fs._canonicalizePath(path);
      return fs.root.chownSync(path, false, uid, gid);
    };

    fs.lchown = function(path, uid, gid, callback) {
      var e, newCb;

      if (callback == null) {
        callback = nopCb;
      }
      try {
        newCb = wrapCb(callback, 1);
        path = fs._canonicalizePath(path);
        return fs.root.chown(path, true, uid, gid, newCb);
      } catch (_error) {
        e = _error;
        return newCb(e);
      }
    };

    fs.lchownSync = function(path, uid, gid) {
      path = fs._canonicalizePath(path);
      return fs.root.chownSync(path, true, uid, gid);
    };

    fs.chmod = function(path, mode, callback) {
      var e, newCb;

      if (callback == null) {
        callback = nopCb;
      }
      try {
        newCb = wrapCb(callback, 1);
        if (typeof mode === 'string') {
          mode = parseInt(mode, 8);
        }
        path = fs._canonicalizePath(path);
        return fs.root.chmod(path, false, mode, newCb);
      } catch (_error) {
        e = _error;
        return newCb(e);
      }
    };

    fs.chmodSync = function(path, mode) {
      if (typeof mode === 'string') {
        mode = parseInt(mode, 8);
      }
      path = fs._canonicalizePath(path);
      return fs.root.chmodSync(path, false, mode);
    };

    fs.lchmod = function(path, mode, callback) {
      var e, newCb;

      if (callback == null) {
        callback = nopCb;
      }
      try {
        newCb = wrapCb(callback, 1);
        if (typeof mode === 'string') {
          mode = parseInt(mode, 8);
        }
        path = fs._canonicalizePath(path);
        return fs.root.chmod(path, true, mode, newCb);
      } catch (_error) {
        e = _error;
        return newCb(e);
      }
    };

    fs.lchmodSync = function(path, mode) {
      path = fs._canonicalizePath(path);
      if (typeof mode === 'string') {
        mode = parseInt(mode, 8);
      }
      return fs.root.chmodSync(path, true, mode);
    };

    fs.utimes = function(path, atime, mtime, callback) {
      var e, newCb;

      if (callback == null) {
        callback = nopCb;
      }
      try {
        newCb = wrapCb(callback, 1);
        path = fs._canonicalizePath(path);
        if (typeof atime === 'number') {
          atime = new Date(atime * 1000);
        }
        if (typeof mtime === 'number') {
          mtime = new Date(mtime * 1000);
        }
        return fs.root.utimes(path, atime, mtime, newCb);
      } catch (_error) {
        e = _error;
        return newCb(e);
      }
    };

    fs.utimesSync = function(path, atime, mtime) {
      path = fs._canonicalizePath(path);
      if (typeof atime === 'number') {
        atime = new Date(atime * 1000);
      }
      if (typeof mtime === 'number') {
        mtime = new Date(mtime * 1000);
      }
      return fs.root.utimesSync(path, atime, mtime);
    };

    fs.realpath = function(path, cache, callback) {
      var e, newCb;

      if (callback == null) {
        callback = nopCb;
      }
      try {
        if (typeof cache === 'function') {
          callback = cache;
          cache = {};
        }
        newCb = wrapCb(callback, 2);
        path = fs._canonicalizePath(path);
        return fs.root.realpath(path, cache, newCb);
      } catch (_error) {
        e = _error;
        return newCb(e);
      }
    };

    fs.realpathSync = function(path, cache) {
      if (cache == null) {
        cache = {};
      }
      path = fs._canonicalizePath(path);
      return fs.root.realpathSync(path, cache);
    };

    return fs;

  }).call(this);

  BrowserFS.FileMode = (function() {
    FileMode.modeCache = {};

    FileMode.validModeStrs = ['r', 'r+', 'rs', 'rs+', 'w', 'wx', 'w+', 'wx+', 'a', 'ax', 'a+', 'ax+'];

    FileMode.getFileMode = function(modeStr) {
      var fm;

      if (__indexOf.call(FileMode.modeCache, modeStr) >= 0) {
        return FileMode.modeCache[modeStr];
      }
      fm = new BrowserFS.FileMode(modeStr);
      FileMode.modeCache[modeStr] = fm;
      return fm;
    };

    FileMode.NOP = 0;

    FileMode.THROW_EXCEPTION = 1;

    FileMode.TRUNCATE_FILE = 2;

    FileMode.CREATE_FILE = 3;

    function FileMode(modeStr) {
      this.modeStr = modeStr;
      if (__indexOf.call(BrowserFS.FileMode.validModeStrs, modeStr) < 0) {
        throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, "Invalid mode string: " + modeStr);
      }
    }

    FileMode.prototype.isReadable = function() {
      return this.modeStr.indexOf('r') !== -1 || this.modeStr.indexOf('+') !== -1;
    };

    FileMode.prototype.isWriteable = function() {
      return this.modeStr.indexOf('w') !== -1 || this.modeStr.indexOf('a') !== -1 || this.modeStr.indexOf('+') !== -1;
    };

    FileMode.prototype.isTruncating = function() {
      return this.modeStr.indexOf('w') !== -1;
    };

    FileMode.prototype.isAppendable = function() {
      return this.modeStr.indexOf('a') !== -1;
    };

    FileMode.prototype.isSynchronous = function() {
      return this.modeStr.indexOf('s') !== -1;
    };

    FileMode.prototype.isExclusive = function() {
      return this.modeStr.indexOf('x') !== -1;
    };

    FileMode.prototype.pathExistsAction = function() {
      if (this.isExclusive()) {
        return BrowserFS.FileMode.THROW_EXCEPTION;
      } else if (this.isTruncating()) {
        return BrowserFS.FileMode.TRUNCATE_FILE;
      } else {
        return BrowserFS.FileMode.NOP;
      }
    };

    FileMode.prototype.pathNotExistsAction = function() {
      if ((this.isWriteable() || this.isAppendable()) && this.modeStr !== 'r+') {
        return BrowserFS.FileMode.CREATE_FILE;
      } else {
        return BrowserFS.FileMode.THROW_EXCEPTION;
      }
    };

    return FileMode;

  }).call(this);

}).call(this);