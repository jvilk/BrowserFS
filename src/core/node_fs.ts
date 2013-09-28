import file = require('file');
import api_error = require('api_error');
import file_system = require('file_system');
var ApiError = api_error.ApiError;
var ErrorType = api_error.ErrorType;
var BaseFile = file.BaseFile;
var BaseFileSystem = file.BaseFileSystem;

function wrapCb(cb: Function, numArgs: number): Function {
  if (typeof cb !== 'function') {
    throw new ApiError(ErrorType.INVALID_PARAM, 'Callback must be a function.');
  }
  // @todo This is used for unit testing. Maybe we should inject this logic
  //       dynamically rather than bundle it in 'production' code.
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
}

function checkFd(fd: file.BaseFile, async = true): any {
  if (!(fd instanceof BaseFile)) {
    var error = new ApiError(ErrorType.INVALID_PARAM, 'Invalid file descriptor.');
    if (async) {
      return error;
    } else {
      throw error;
    }
  }
  return true;
}

function nopCb() {};

export class fs {
  private static root: file_system.BaseFileSystem = null;

  public static _initialize(rootFS: file_system.BaseFileSystem): file_system.BaseFileSystem {
    if (!rootFS.constructor.isAvailable()) {
      throw new ApiError(ErrorType.INVALID_PARAM, 'Tried to instantiate BrowserFS with an unavailable file system.');
    }
    return this.root = rootFS;
  }

  public static _toUnixTimestamp(time: Date);
  public static _toUnixTimestamp(time: number);
  public static _toUnixTimestamp(time: any): number {
    if (typeof time === 'number') {
      return time;
    } else if (time instanceof Date) {
      return time.getTime() / 1000;
    }
    throw new Error("Cannot parse time: " + time);
  }

  public static getRootFS(): file_system.BaseFileSystem {
    if (this.root) {
      return this.root;
    } else {
      return null;
    }
  }

  private static _normalize(p: string): string {
    if (p.indexOf('\u0000') >= 0) {
      throw new ApiError(ErrorType.INVALID_PARAM, 'Path must be a string without null bytes.');
    } else if (p === '') {
      throw new ApiError(ErrorType.INVALID_PARAM, 'Path must not be empty.');
    }
    return path.resolve(p);
  }

  public static rename(oldPath: string, newPath: string, cb: Function = nopCb): void {
    var newCb = wrapCb(cb, 1);
    try {
      this.root.rename(this._normalize(oldPath), this._normalize(newPath), newCb);
    } catch (e) {
      newCb(e);
    }
  }

  public static renameSync(oldPath: string, newPath: string): void {
    this.root.renameSync(this._normalize(oldPath), this._normalize(newPath));
  }

  public static exists(path: string, cb: (exists: boolean) => void = nopCb): void {
    var newCb = wrapCb(callback, 1);
    try {
      return this.root.exists(this._normalize(path), newCb);
    } catch (e) {
      return newCb(false);
    }
  }

  public static existsSync(path: string): boolean {
    try {
      return this.root.existsSync(this._normalize(path));
    } catch (e) {
      return false;
    }
  }

  public static stat(path: string, cb?: (err: Error, stats: Stats) => any = nopCb): Stats {
    var newCb = wrapCb(cb, 2);
    try {
      return this.root.stat(this._normalize(path), false, newCb);
    } catch (e) {
      return newCb(e, null);
    }
  }

  public static statSync(path: string): Stats {
    return this.root.statSync(this._normalize(path), false);
  }

  public static lstat(path: string, cb: (err: Error, stats: Stats) => any = nopCb): Stats {
    var newCb = wrapCb(cb, 2);
    try {
      return this.root.stat(this._normalize(path), true, newCb);
    } catch (e) {
      return newCb(e, null);
    }
  }

  public static lstatSync(path: string): Stats {
    return this.root.statSync(this._normalize(path), true);
  }

  public static truncate(path: string, cb?: Function): void;
  public static truncate(path: string, len: number; cb?: Function): void;
  public static truncate(path: string, arg2: any = 0, cb: Function = nopCb): void {
    var len = 0;
    if (typeof arg2 === 'function') {
      cb = arg2;
    } else if (typeof arg2 === 'number') {
      len = arg2;
    }

    var newCb = wrapCb(cb, 1);
    try {
      return this.root.truncate(this._normalize(path), len, newCb);
    } catch (e) {
      return newCb(e);
    }
  }

  public static truncateSync(path: string, len: number = 0): void {
    return this.root.truncateSync(this._normalize(path), len);
  }

  public static unlink(path: string, cb: Function = nopCb): void {
    var newCb = wrapCb(cb, 1);
    try {
      return this.root.unlink(this._normalize(path), newCb);
    } catch (e) {
      return newCb(e);
    }
  }

  public static unlinkSync(path: string): void {
    return this.root.unlinkSync(this._normalize(path));
  }

  public static open(path: string, flags: string, cb?: (err: Error, fd: file.BaseFile) => any): void;
  public static open(path: string, flags: string, mode: string, cb?: (err: Error, fd: file.BaseFile) => any): void;
  public static open(path: string, flags: string, mode: number, cb?: (err: Error, fd: file.BaseFile) => any): void;
  public static open(path: string, flags: string, arg2?: any, cb?: (err: Error, fd: file.BaseFile) => any = nopCb): void {
    var mode: number = 0x1a4;
    if (typeof arg2 === 'undefined') {
      // (path, flags)
      cb = nopCb;
    } else if (typeof arg2 === 'function') {
      // (path, flags, cb)
      cb = arg2;
    } else if (typeof arg2 === 'number') {
      // (path, flags, mode, cb?) (cb will be set to the default if not present)
      mode = arg2;
    }

    var newCb = wrapCb(cb, 2);
    try {
      return this.root.open(this._normalize(path), BrowserFS.FileMode.getFileMode(flags), mode, newCb);
    } catch (e) {
      return newCb(e, null);
    }
  }

  public static openSync(path: string, flags: string, mode?: string): file.BaseFile;
  public static openSync(path: string, flags: string, mode?: number): file.BaseFile;
  public static openSync(path: string, flags: string, mode?: any = 0x1a4): file.BaseFile {
    return this.root.openSync(this._normalize(path), BrowserFS.FileMode.getFileMode(flags), mode);
  }

  public static readFile(filename: string, cb?: (err: Error, data: any) => void ): void;
  public static readFile(filename: string, options: {[opt: string]: any}, cb?: (err: Error, data: any) => void ): void;
  public static readFile(filename: string, encoding: string, cb?: (err: Error, data: any) => void ): void;
  public static readFile(filename: string, arg2: any = {}, cb: (err: Error, data: any) => void = nopCb ) {
    var options = {};
    switch(typeof arg2) {
      case 'function':
        // (filename, cb)
        cb = arg2;
        break;
      case 'string':
        // (filename, encoding, cb)
        options['encoding'] = arg2;
        break;
      case 'object':
        options = args;
        break;
      default:
        return cb(new ApiError(ErrorType.INVALID_PARAM, "Invalid options object."), null);
    }

    // Standardize options.
    if (options['encoding'] === undefined) {
      // Null indicates: 'give me a buffer'
      options['encoding'] = null;
    }
    if (options['flag'] == null) {
      options['flag'] = 'r';
    }

    var newCb = wrapCb(callback, 2);
    try {
      filename = this._normalize(filename);
      var flags = BrowserFS.FileMode.getFileMode(options['flag']);
      if (!flags.isReadable()) {
        return newCb(new ApiError(ErrorType.INVALID_PARAM, 'Flag passed to readFile must allow for reading.'));
      }
      return this.root.readFile(filename, options.encoding, flags, newCb);
    } catch (e) {
      return newCb(e, null);
    }
  }

  public static readFileSync(filename: string, encoding?: string): buffer.Buffer;
  public static readFileSync(filename: string, options?: { encoding?: string; flag?: string; }): buffer.Buffer;
  public static readFileSync(filename: string, arg2: any = {}): buffer.Buffer {
    var options = {};
    switch (typeof arg2) {
      case 'string':
        // (filename, encoding)
        options['encoding'] = arg2;
        break;
      case 'object':
        // (filename, options)
        options = arg2;
        break;
      default:
        throw new ApiError(ErrorType.INVALID_PARAM, 'Invalid options argument');
    }

    if (options['encoding'] === undefined) {
      options['encoding'] = null;
    }
    if (options['flag'] == null) {
      options['flag'] = 'r';
    }

    filename = this._normalize(filename);
    var flags = BrowserFS.FileMode.getFileMode(options.flag);
    if (!flags.isReadable()) {
      throw new ApiError(ErrorType.INVALID_PARAM, 'Flag passed to readFile must allow for reading.');
    }
    return this.root.readFileSync(filename, options.encoding, flags);
  }

  public static writeFile(filename: string, data: any, callback?: Function);
  public static writeFile(filename: string, data: any, encoding?: string, callback?: Function);
  public static writeFile(filename: string, data: any, arg3: any = {}, callback: Function = nopCb): void {
    var e, flags, newCb;

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
      filename = this._normalize(filename);
      flags = BrowserFS.FileMode.getFileMode(options.flag);
      if (!flags.isWriteable()) {
        return newCb(new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, 'Flag passed to writeFile must allow for writing.'));
      }
      return this.root.writeFile(filename, data, options.encoding, flags, options.mode, newCb);
    } catch (_error) {
      e = _error;
      return newCb(e);
    }
  }

  public static writeFileSync(filename: string, data: any, encoding?: string): void {
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
    filename = this._normalize(filename);
    flags = BrowserFS.FileMode.getFileMode(options.flag);
    if (!flags.isWriteable()) {
      throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, 'Flag passed to writeFile must allow for writing.');
    }
    return this.root.writeFileSync(filename, data, options.encoding, flags, options.mode);
  }

  public static appendFile(filename: string, data: any, encoding?: string, callback?: Function): void {
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
      filename = this._normalize(filename);
      flags = BrowserFS.FileMode.getFileMode(options.flag);
      if (!flags.isAppendable()) {
        return newCb(new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, 'Flag passed to appendFile must allow for appending.'));
      }
      return this.root.appendFile(filename, data, options.encoding, flags, options.mode, newCb);
    } catch (_error) {
      e = _error;
      return newCb(e);
    }
  }

  public static appendFileSync(filename: string, data: any, encoding?: string): void {
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
    filename = this._normalize(filename);
    flags = BrowserFS.FileMode.getFileMode(options.flag);
    if (!flags.isAppendable()) {
      throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, 'Flag passed to appendFile must allow for appending.');
    }
    return this.root.appendFileSync(filename, data, options.encoding, flags, options.mode);
  }

  public static fstat(fd: number, callback?: (err: Error, stats: Stats) =>any): Stats {
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
  }

  public static fstatSync(fd: number): Stats {
    checkFd(fd, false);
    return fd.statSync();
  }

  public static close(fd: number, callback?: Function): void {
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
  }

  public static closeSync(fd: number): void {
    checkFd(fd, false);
    return fd.closeSync();
  }

  public static ftruncate(fd, len, callback) {
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
  }

  public static ftruncateSync(fd, len) {
    if (len == null) {
      len = 0;
    }
    checkFd(fd, false);
    return fd.truncateSync(len);
  }

  public static fsync(fd: number, callback?: Function): void {
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
  }

  public static fsyncSync(fd: number): void {
    checkFd(fd, false);
    return fd.syncSync();
  }

  public static fdatasync(fd: number, callback?: Function): void {
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
  }

  public static fdatasyncSync(fd: number): void {
    checkFd(fd, false);
    fd.datasyncSync();
  }

  public static write(fd: number, buffer: NodeBuffer, offset: number, length: number, position: number, callback?: (err: Error, written: number, buffer: NodeBuffer) =>any): void {
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
  }

  public static writeSync(fd: number, buffer: NodeBuffer, offset: number, length: number, position: number): number {
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
  }

  public static read(fd: number, buffer: NodeBuffer, offset: number, length: number, position: number, callback?: (err: Error, bytesRead: number, buffer: NodeBuffer) => void): void {
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
  }

  public static readSync(fd: number, buffer: NodeBuffer, offset: number, length: number, position: number): number {
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
  }

  public static fchown(fd: number, uid: number, gid: number, callback?: Function): void {
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
  }

  public static fchownSync(fd: number, uid: number, gid: number): void {
    checkFd(fd, false);
    return fd.chownSync(uid, gid);
  }

  public static fchmod(fd: number, mode: string, callback?: Function): void;
  public static fchmod(fd: number, mode: number, callback?: Function): void {
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
  }

  public static fchmodSync(fd: number, mode: string): void;
  public static fchmodSync(fd: number, mode: number): void {
    if (typeof mode === 'string') {
      mode = parseInt(mode, 8);
    }
    checkFd(fd, false);
    return fd.chmodSync(mode);
  }

  public static futimes(fd: number, atime: number, mtime: number, callback?: Function): void {
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
  }

  public static futimesSync(fd: number, atime: number, mtime: number): void {
    checkFd(fd, false);
    if (typeof atime === 'number') {
      atime = new Date(atime * 1000);
    }
    if (typeof mtime === 'number') {
      mtime = new Date(mtime * 1000);
    }
    return fd.utimesSync(atime, mtime);
  }

  public static rmdir(path: string, callback?: Function): void {
    var e, newCb;

    if (callback == null) {
      callback = nopCb;
    }
    try {
      newCb = wrapCb(callback, 1);
      path = this._normalize(path);
      return BrowserFS.node.public static root.rmdir(path, newCb);
    } catch (_error) {
      e = _error;
      return newCb(e);
    }
  }

  public static rmdirSync(path: string): void {
    path = this._normalize(path);
    return BrowserFS.node.public static root.rmdirSync(path);
  }

  public static mkdir(path: string, mode?: any, callback?: Function): void {
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
      path = this._normalize(path);
      return BrowserFS.node.public static root.mkdir(path, mode, newCb);
    } catch (_error) {
      e = _error;
      return newCb(e);
    }
  }

  public static mkdirSync(path: string, mode?: string): void;
  public static mkdirSync(path: string, mode?: number): void {
    if (mode == null) {
      mode = 0x1ff;
    }
    path = this._normalize(path);
    return BrowserFS.node.public static root.mkdirSync(path, mode);
  }

  public static readdir(path: string, callback?: (err: Error, files: string[]) => void): void {
    var e, newCb;

    if (callback == null) {
      callback = nopCb;
    }
    try {
      newCb = wrapCb(callback, 2);
      path = this._normalize(path);
      return this.root.readdir(path, newCb);
    } catch (_error) {
      e = _error;
      return newCb(e);
    }
  }

  public static readdirSync(path: string): string[] {
    path = this._normalize(path);
    return this.root.readdirSync(path);
  }

  public static link(srcpath: string, dstpath: string, callback?: Function): void {
    var e, newCb;

    if (callback == null) {
      callback = nopCb;
    }
    try {
      newCb = wrapCb(callback, 1);
      srcpath = this._normalize(srcpath);
      dstpath = this._normalize(dstpath);
      return this.root.link(srcpath, dstpath, newCb);
    } catch (_error) {
      e = _error;
      return newCb(e);
    }
  }

  public static linkSync(srcpath: string, dstpath: string): void {
    srcpath = this._normalize(srcpath);
    dstpath = this._normalize(dstpath);
    return this.root.linkSync(srcpath, dstpath);
  }

  public static symlink(srcpath: string, dstpath: string, type?: string, callback?: Function): void {
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
      srcpath = this._normalize(srcpath);
      dstpath = this._normalize(dstpath);
      return this.root.symlink(srcpath, dstpath, type, newCb);
    } catch (_error) {
      e = _error;
      return newCb(e);
    }
  }

  public static symlinkSync(srcpath: string, dstpath: string, type?: string): void {
    if (type == null) {
      type = 'file';
    }
    if (type !== 'file' && type !== 'dir') {
      throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, "Invalid type: " + type);
    }
    srcpath = this._normalize(srcpath);
    dstpath = this._normalize(dstpath);
    return this.root.symlinkSync(srcpath, dstpath, type);
  }

  public static readlink(path: string, callback?: (err: Error, linkString: string) =>any): void {
    var e, newCb;

    if (callback == null) {
      callback = nopCb;
    }
    try {
      newCb = wrapCb(callback, 2);
      path = this._normalize(path);
      return this.root.readlink(path, newCb);
    } catch (_error) {
      e = _error;
      return newCb(e);
    }
  }

  public static readlinkSync(path: string): string {
    path = this._normalize(path);
    return this.root.readlinkSync(path);
  }

  public static chown(path: string, uid: number, gid: number, callback?: Function): void {
    var e, newCb;

    if (callback == null) {
      callback = nopCb;
    }
    try {
      newCb = wrapCb(callback, 1);
      path = this._normalize(path);
      return this.root.chown(path, false, uid, gid, newCb);
    } catch (_error) {
      e = _error;
      return newCb(e);
    }
  }

  public static chownSync(path: string, uid: number, gid: number): void {
    path = this._normalize(path);
    return this.root.chownSync(path, false, uid, gid);
  }

  public static lchown(path: string, uid: number, gid: number, callback?: Function): void {
    var e, newCb;

    if (callback == null) {
      callback = nopCb;
    }
    try {
      newCb = wrapCb(callback, 1);
      path = this._normalize(path);
      return this.root.chown(path, true, uid, gid, newCb);
    } catch (_error) {
      e = _error;
      return newCb(e);
    }
  }

  public static lchownSync(path: string, uid: number, gid: number): void {
    path = this._normalize(path);
    return this.root.chownSync(path, true, uid, gid);
  }

  public static chmod(path: string, mode: string, callback?: Function): void;
  public static chmod(path: string, mode: number, callback?: Function): void {
    var e, newCb;

    if (callback == null) {
      callback = nopCb;
    }
    try {
      newCb = wrapCb(callback, 1);
      if (typeof mode === 'string') {
        mode = parseInt(mode, 8);
      }
      path = this._normalize(path);
      return this.root.chmod(path, false, mode, newCb);
    } catch (_error) {
      e = _error;
      return newCb(e);
    }
  }

  public static chmodSync(path: string, mode: string): void;
  public static chmodSync(path: string, mode: number): void {
    if (typeof mode === 'string') {
      mode = parseInt(mode, 8);
    }
    path = this._normalize(path);
    return this.root.chmodSync(path, false, mode);
  }

  public static lchmod(path: string, mode: string, callback?: Function): void;
  public static lchmod(path: string, mode: number, callback?: Function): void {
    var e, newCb;

    if (callback == null) {
      callback = nopCb;
    }
    try {
      newCb = wrapCb(callback, 1);
      if (typeof mode === 'string') {
        mode = parseInt(mode, 8);
      }
      path = this._normalize(path);
      return this.root.chmod(path, true, mode, newCb);
    } catch (_error) {
      e = _error;
      return newCb(e);
    }
  }

  public static lchmodSync(path: string, mode: number): void;
  public static lchmodSync(path: string, mode: string): void {
    path = this._normalize(path);
    if (typeof mode === 'string') {
      mode = parseInt(mode, 8);
    }
    return this.root.chmodSync(path, true, mode);
  }

  public static utimes(path: string, atime: number, mtime: number, callback?: Function): void {
    var e, newCb;

    if (callback == null) {
      callback = nopCb;
    }
    try {
      newCb = wrapCb(callback, 1);
      path = this._normalize(path);
      if (typeof atime === 'number') {
        atime = new Date(atime * 1000);
      }
      if (typeof mtime === 'number') {
        mtime = new Date(mtime * 1000);
      }
      return this.root.utimes(path, atime, mtime, newCb);
    } catch (_error) {
      e = _error;
      return newCb(e);
    }
  }

  public static utimesSync(path: string, atime: number, mtime: number): void {
    path = this._normalize(path);
    if (typeof atime === 'number') {
      atime = new Date(atime * 1000);
    }
    if (typeof mtime === 'number') {
      mtime = new Date(mtime * 1000);
    }
    return this.root.utimesSync(path, atime, mtime);
  }

  public static realpath(path: string, callback?: (err: Error, resolvedPath: string) =>any): void;
  public static realpath(path: string, cache: {[path: string]: string}, callback: (err: Error, resolvedPath: string) =>any): void {
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
      path = this._normalize(path);
      return this.root.realpath(path, cache, newCb);
    } catch (_error) {
      e = _error;
      return newCb(e);
    }
  }

  public static realpathSync(path: string, cache?: {[path: string]: string}): string {
    if (cache == null) {
      cache = {};
    }
    path = this._normalize(path);
    return this.root.realpathSync(path, cache);
  }
}

export enum ActionType {
  NOP = 0,
  THROW_EXCEPTION = 1,
  TRUNCATE_FILE = 2,
  CREATE_FILE = 3
}

export class FileMode {
  private static modeCache: { [mode: string]: FileMode } = {};
  private static validModeStrs = ['r', 'r+', 'rs', 'rs+', 'w', 'wx', 'w+', 'wx+', 'a', 'ax', 'a+', 'ax+'];

  public static getFileMode(modeStr: string): FileMode {
    if (__indexOf.call(FileMode.modeCache, modeStr) >= 0) {
      return FileMode.modeCache[modeStr];
    }
    return FileMode.modeCache[modeStr] = new BrowserFS.FileMode(modeStr);
  }

  private modeStr: string;
  constructor(modeStr: string) {
    this.modeStr = modeStr;
    if (__indexOf.call(BrowserFS.FileMode.validModeStrs, modeStr) < 0) {
      throw new ApiError(ErrorType.INVALID_PARAM, "Invalid mode string: " + modeStr);
    }
  }

  public isReadable(): boolean {
    return this.modeStr.indexOf('r') !== -1 || this.modeStr.indexOf('+') !== -1;
  }

  public isWriteable(): boolean {
    return this.modeStr.indexOf('w') !== -1 || this.modeStr.indexOf('a') !== -1 || this.modeStr.indexOf('+') !== -1;
  }

  public isTruncating(): boolean {
    return this.modeStr.indexOf('w') !== -1;
  }

  public isAppendable(): boolean {
    return this.modeStr.indexOf('a') !== -1;
  }

  public isSynchronous(): boolean {
    return this.modeStr.indexOf('s') !== -1;
  }

  public isExclusive(): boolean {
    return this.modeStr.indexOf('x') !== -1;
  }

  public pathExistsAction(): ActionType {
    if (this.isExclusive()) {
      return ActionType.THROW_EXCEPTION;
    } else if (this.isTruncating()) {
      return ActionType.TRUNCATE_FILE;
    } else {
      return ActionType.NOP;
    }
  }

  public pathNotExistsAction(): ActionType {
    if ((this.isWriteable() || this.isAppendable()) && this.modeStr !== 'r+') {
      return ActionType.CREATE_FILE;
    } else {
      return ActionType.THROW_EXCEPTION;
    }
  }
}
