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

function checkFd(fd: file.BaseFile): void {
  if (!(fd instanceof BaseFile)) {
    throw new ApiError(ErrorType.INVALID_PARAM, 'Invalid file descriptor.');
  }
}

function normalizeMode(mode: any, def: number): number {
  switch(typeof arg2) {
    case 'number':
      // (path, flags, mode, cb?)
      return arg2;
    case 'string':
      // (path, flags, modeString, cb?)
      var trueMode = parseInt(mode, 8);
      if (trueMode !== NaN) {
        return trueMode;
      }
      // FALL THROUGH if mode is an invalid string!
    default:
      return def;
  }
}

function normalizePath(p: string): string {
  if (p.indexOf('\u0000') >= 0) {
    throw new ApiError(ErrorType.INVALID_PARAM, 'Path must be a string without null bytes.');
  } else if (p === '') {
    throw new ApiError(ErrorType.INVALID_PARAM, 'Path must not be empty.');
  }
  return path.resolve(p);
}

function normalizeOptions(options: any, defEnc: string, defFlag: string, defMode: number): {encoding: string, flag: string, mode: number} {
  switch (typeof options) {
    case 'object':
      return {
        encoding: typeof options['encoding'] !== undefined ? options['encoding'] : defEnc,
        flag: typeof options['flag'] !== undefined ? options['flag'] : defFlag,
        mode: normalizeMode(options['mode'], defMode)
      };
    case 'string':
      return {
        encoding: options,
        flag: defFlag,
        mode: defMode
      };
    default:
      return {
        encoding: defEnc,
        flag: defFlag,
        mode: defMode
      };
  }
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

  public static rename(oldPath: string, newPath: string, cb: Function = nopCb): void {
    var newCb = wrapCb(cb, 1);
    try {
      this.root.rename(normalizePath(oldPath), normalizePath(newPath), newCb);
    } catch (e) {
      newCb(e);
    }
  }

  public static renameSync(oldPath: string, newPath: string): void {
    this.root.renameSync(normalizePath(oldPath), normalizePath(newPath));
  }

  public static exists(path: string, cb: (exists: boolean) => void = nopCb): void {
    var newCb = wrapCb(callback, 1);
    try {
      return this.root.exists(normalizePath(path), newCb);
    } catch (e) {
      return newCb(false);
    }
  }

  public static existsSync(path: string): boolean {
    try {
      return this.root.existsSync(normalizePath(path));
    } catch (e) {
      return false;
    }
  }

  public static stat(path: string, cb?: (err: Error, stats: Stats) => any = nopCb): Stats {
    var newCb = wrapCb(cb, 2);
    try {
      return this.root.stat(normalizePath(path), false, newCb);
    } catch (e) {
      return newCb(e, null);
    }
  }

  public static statSync(path: string): Stats {
    return this.root.statSync(normalizePath(path), false);
  }

  public static lstat(path: string, cb: (err: Error, stats: Stats) => any = nopCb): Stats {
    var newCb = wrapCb(cb, 2);
    try {
      return this.root.stat(normalizePath(path), true, newCb);
    } catch (e) {
      return newCb(e, null);
    }
  }

  public static lstatSync(path: string): Stats {
    return this.root.statSync(normalizePath(path), true);
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
      return this.root.truncate(normalizePath(path), len, newCb);
    } catch (e) {
      return newCb(e);
    }
  }

  public static truncateSync(path: string, len: number = 0): void {
    return this.root.truncateSync(normalizePath(path), len);
  }

  public static unlink(path: string, cb: Function = nopCb): void {
    var newCb = wrapCb(cb, 1);
    try {
      return this.root.unlink(normalizePath(path), newCb);
    } catch (e) {
      return newCb(e);
    }
  }

  public static unlinkSync(path: string): void {
    return this.root.unlinkSync(normalizePath(path));
  }

  public static open(path: string, flags: string, cb?: (err: Error, fd: file.BaseFile) => any): void;
  public static open(path: string, flags: string, mode: string, cb?: (err: Error, fd: file.BaseFile) => any): void;
  public static open(path: string, flags: string, mode: number, cb?: (err: Error, fd: file.BaseFile) => any): void;
  public static open(path: string, flags: string, arg2: any, cb: (err: Error, fd: file.BaseFile) => any = nopCb): void {
    var mode = normalizeMode(arg2, 0x1a4);
    cb = typeof arg2 === 'function' ? arg2 : cb;
    var newCb = wrapCb(cb, 2);
    try {
      return this.root.open(normalizePath(path), BrowserFS.FileMode.getFileMode(flags), mode, newCb);
    } catch (e) {
      return newCb(e, null);
    }
  }

  public static openSync(path: string, flags: string, mode?: string): file.BaseFile;
  public static openSync(path: string, flags: string, mode?: number): file.BaseFile;
  public static openSync(path: string, flags: string, mode?: any = 0x1a4): file.BaseFile {
    return this.root.openSync(normalizePath(path), BrowserFS.FileMode.getFileMode(flags), mode);
  }

  public static readFile(filename: string, cb?: (err: Error, data: any) => void ): void;
  public static readFile(filename: string, options: {[opt: string]: any}, cb?: (err: Error, data: any) => void ): void;
  public static readFile(filename: string, encoding: string, cb?: (err: Error, data: any) => void ): void;
  public static readFile(filename: string, arg2: any = {}, cb: (err: Error, data: any) => void = nopCb ) {
    var options = normalizeOptions(arg2, null, 'r', null);
    cb = typeof arg2 === 'function' ? arg2 : cb;
    var newCb = wrapCb(callback, 2);
    try {
      var flags = BrowserFS.FileMode.getFileMode(options['flag']);
      if (!flags.isReadable()) {
        return newCb(new ApiError(ErrorType.INVALID_PARAM, 'Flag passed to readFile must allow for reading.'));
      }
      return this.root.readFile(normalizePath(filename), options.encoding, flags, newCb);
    } catch (e) {
      return newCb(e, null);
    }
  }

  public static readFileSync(filename: string, encoding?: string): buffer.Buffer;
  public static readFileSync(filename: string, options?: { encoding?: string; flag?: string; }): buffer.Buffer;
  public static readFileSync(filename: string, arg2: any = {}): buffer.Buffer {
    var options = normalizeOptions(arg2, null, 'r', null);
    var flags = BrowserFS.FileMode.getFileMode(options.flag);
    if (!flags.isReadable()) {
      throw new ApiError(ErrorType.INVALID_PARAM, 'Flag passed to readFile must allow for reading.');
    }
    return this.root.readFileSync(normalizePath(filename), options.encoding, flags);
  }

  public static writeFile(filename: string, data: any, cb?: Function);
  public static writeFile(filename: string, data: any, encoding?: string, cb?: Function);
  public static writeFile(filename: string, data: any, options?: object, cb?: Function);
  public static writeFile(filename: string, data: any, arg3: any = {}, cb: Function = nopCb): void {
    var options = normalizeOptions(arg3, 'utf8', 'w', 0x1a4);
    cb = typeof arg3 === 'function' ? arg3 : cb;
    var newCb = wrapCb(cb, 1);
    try {
      var flags = BrowserFS.FileMode.getFileMode(options.flag);
      if (!flags.isWriteable()) {
        return newCb(new ApiError(ErrorType.INVALID_PARAM, 'Flag passed to writeFile must allow for writing.'));
      }
      return this.root.writeFile(normalizePath(filename), data, options.encoding, flags, options.mode, newCb);
    } catch (e) {
      return newCb(e);
    }
  }

  public static writeFileSync(filename: string, data: any, options?: object): void;
  public static writeFileSync(filename: string, data: any, encoding?: string): void;
  public static writeFileSync(filename: string, data: any, arg3?: any): void {
    var options = normalizeOptions(arg3, 'utf8', 'w', 0x1a4);
    var flags = BrowserFS.FileMode.getFileMode(options.flag);
    if (!flags.isWriteable()) {
      throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, 'Flag passed to writeFile must allow for writing.');
    }
    return this.root.writeFileSync(normalizePath(filename), data, options.encoding, flags, options.mode);
  }

  public static appendFile(filename: string, data: any, cb?: Function): void;
  public static appendFile(filename: string, data: any, options?: object, cb?: Function): void;
  public static appendFile(filename: string, data: any, encoding?: string, cb?: Function): void;
  public static appendFile(filename: string, data: any, arg3?: string, cb: Function = nopCb): void {
    var options = normalizeOptions(arg3, 'utf8', 'a', 0x1a4);
    cb = typeof arg3 === 'function' ? arg3 : cb;
    var newCb = wrapCb(cb, 1);
    try {
      var flags = BrowserFS.FileMode.getFileMode(options.flag);
      if (!flags.isAppendable()) {
        return newCb(new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, 'Flag passed to appendFile must allow for appending.'));
      }
      this.root.appendFile(normalizePath(filename), data, options.encoding, flags, options.mode, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  public static appendFileSync(filename: string, data: any, options?: object): void;
  public static appendFileSync(filename: string, data: any, encoding?: string): void;
  public static appendFileSync(filename: string, data: any, arg3?: any): void {
    var options = normalizeOptions(arg3, 'utf8', 'a', 0x1a4);
    var flags = BrowserFS.FileMode.getFileMode(options.flag);
    if (!flags.isAppendable()) {
      throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, 'Flag passed to appendFile must allow for appending.');
    }
    return this.root.appendFileSync(normalizePath(filename), data, options.encoding, flags, options.mode);
  }

  public static fstat(fd: file.BaseFile, cb: (err: Error, stats: Stats) => any = nopCb): void {
    var newCb = wrapCb(callback, 2);
    try {
      checkFd(fd);
      fd.stat(newCb);
    } catch (e) {
      newCb(e);
    }
  }

  public static fstatSync(fd: file.BaseFile): Stats {
    checkFd(fd);
    return fd.statSync();
  }

  public static close(fd: file.BaseFile, cb: Function = nopCb): void {
    var newCb = wrapCb(callback, 1);
    try {
      checkFd(fd);
      fd.close(newCb);
    } catch (e) {
      newCb(e);
    }
  }

  public static closeSync(fd: file.BaseFile): void {
    checkFd(fd);
    return fd.closeSync();
  }

  public static ftruncate(fd: file.BaseFile, cb?:Function);
  public static ftruncate(fd: file.BaseFile, len?: number, cb?:Function);
  public static ftruncate(fd: file.BaseFile, arg2?: any, cb:Function = nopCb) {
    var length = typeof arg2 === 'number' ? arg2 : 0;
    cb = typeof arg2 === 'function' ? arg2 : cb;
    var newCb = wrapCb(cb, 1);
    try {
      checkFd(fd);
      fd.truncate(len, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  public static ftruncateSync(fd: file.BaseFile, len: number = 0) {
    checkFd(fd);
    return fd.truncateSync(len);
  }

  public static fsync(fd: file.BaseFile, cb: Function = nopCb): void {
    var newCb = wrapCb(cb, 1);
    try {
      checkFd(fd);
      fd.sync(newCb);
    } catch (e) {
      newCb(e);
    }
  }

  public static fsyncSync(fd: file.BaseFile): void {
    checkFd(fd);
    return fd.syncSync();
  }

  public static fdatasync(fd: file.BaseFile, cb: Function = nopCb): void {
    var newCb = wrapCb(cb, 1);
    try {
      checkFd(fd);
      fd.datasync(newCb);
    } catch (e) {
      newCb(e);
    }
  }

  public static fdatasyncSync(fd: file.BaseFile): void {
    checkFd(fd);
    fd.datasyncSync();
  }

  /*
// fs.write(fd, buffer, offset, length[, position], callback);
// OR
// fs.write(fd, string[, position[, encoding]], callback);
  */
  public static write(fd: file.BaseFile, buffer: buffer.Buffer, offset: number, length: number, cb?: (err: Error, written: number, buffer: buffer.Buffer) => any): void;
  public static write(fd: file.BaseFile, buffer: buffer.Buffer, offset: number, length: number, position?: number, cb?: (err: Error, written: number, buffer: buffer.Buffer) => any): void;
  public static write(fd: file.BaseFile, data: string, cb?: (err: Error, written: number, buffer: buffer.Buffer) => any): void;
  public static write(fd: file.BaseFile, data: string, position: number, cb?: (err: Error, written: number, buffer: buffer.Buffer) => any): void;
  public static write(fd: file.BaseFile, data: string, position: number, encoding: string, cb?: (err: Error, written: number, buffer: buffer.Buffer) => any): void;
  public static write(fd: file.BaseFile, arg2: any, arg3?: number, arg4?: number, arg5?: number, cb: (err: Error, written: number, buffer: buffer.Buffer) => any = nopCb): void {
    var buffer: buffer.Buffer, offset: number, length: number, position: number = null;
    if (typeof arg2 === 'string') {
      // Signature 1: (fd, string, [position?, [encoding?]], cb?)
      var encoding = 'utf8';
      switch (typeof arg3) {
        case 'function':
          // (fd, string, cb)
          cb = arg3;
          break;
        case 'number':
          // (fd, string, position, encoding?, cb?)
          position = arg3;
          encoding = typeof arg4 === 'string' ? arg4 : 'utf8';
          cb = typeof arg5 === 'function' ? arg5 : cb;
          break;
        default:
          // ...try to find the callback and get out of here!
          cb = typeof arg4 === 'function' ? arg4 : typeof arg5 === 'function' ? arg5 : cb;
          return cb(new ApiError(ErrorType.INVALID_PARAM, 'Invalid arguments.'));
      }
      buffer = new buffer.Buffer(arg2, encoding);
      offset = 0;
      length = buffer.length;
    } else {
      // Signature 2: (fd, buffer, offset, length, position?, cb?)
      buffer = arg2;
      offset = arg3;
      length = arg4;
      position = typeof arg5 === 'number' ? arg5 : null;
      cb = typeof arg5 === 'function' ? arg5 : cb;
    }

    var newCb = wrapCb(cb, 3);
    try {
      checkFd(fd);
      if (position == null) {
        position = fd.getPos();
      }
      fd.write(buffer, offset, length, position, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  public static writeSync(fd: file.BaseFile, buffer: buffer.Buffer, offset: number, length: number, position?: number): void;
  public static writeSync(fd: file.BaseFile, data: string, position?: number, encoding?: string): void;
  public static writeSync(fd: number, arg2: any, arg3: any, arg4: any, arg5: any): number {
    var buffer: buffer.Buffer, offset: 0, length: number, position: number;
    if (typeof arg2 === 'string') {
      // Signature 1: (fd, string, [position?, [encoding?]])
      position = typeof arg3 === 'number' ? arg3 : null;
      var encoding = typeof arg4 === 'string' ? arg4 : 'utf8';
      offset = 0;
      buffer = new buffer.Buffer(arg2, encoding);
      length = buffer.length;
    } else {
      // Signature 2: (fd, buffer, offset, length, position?)
      buffer = arg2;
      offset = arg3;
      length = arg4;
      position = typeof arg5 === 'number' ? arg5 : null;
    }

    checkFd(fd);
    if (position == null) {
      position = fd.getPos();
    }
    return fd.writeSync(buffer, offset, length, position);
  }

  // legacy string interface (fd, length, position, encoding, callback)
  public static read(fd: file.BaseFile, length: number, position: number, encoding: string, cb?: (err: Error, data: string, bytesRead: number) => void): void;
  public static read(fd: file.BaseFile, buffer: NodeBuffer, offset: number, length: number, position: number, cb?: (err: Error, bytesRead: number, buffer: NodeBuffer) => void): void;
  public static read(fd: file.BaseFile, buffer: NodeBuffer, offset: number, length: number, position: number, cb: Function => void = nopCb): void {
    var newCb;
    if (typeof buffer === 'number') {
      cb = position;
      position = offset;
      offset = 0;
      encoding = length;
      length = buffer;
      buffer = new BrowserFS.node.Buffer(length);
      newCb = wrapCb((function(err, bytesRead, buf) {
        if (err) {
          return oldNewCb(err);
        }
        cb(err, buf.toString(encoding), bytesRead);
      }), 3);
    } else {
      newCb = wrapCb(cb, 3);
    }

    try {
      checkFd(fd);
      if (position == null) {
        position = fd.getPos();
      }
      fd.read(buffer, offset, length, position, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  public static readSync(fd: file.BaseFile, length: number, position: number, encoding: string): string;
  public static readSync(fd: file.BaseFile, buffer: NodeBuffer, offset: number, length: number, position: number): number;
  public static readSync(fd: file.BaseFile, buffer: any, offset: number, length: number, position: number): any {
    var shenanigans = false;
    var encoding;
    if (typeof buffer === 'number') {
      position = offset;
      offset = 0;
      encoding = length;
      length = buffer;
      buffer = new BrowserFS.node.Buffer(length);
      shenanigans = true;
    }
    checkFd(fd);
    if (position == null) {
      position = fd.getPos();
    }

    var rv = fd.readSync(buffer, offset, length, position);
    if (!shenanigans) {
      return rv;
    } else {
      return [buffer.toString(encoding), rv];
    }
  }

  public static fchown(fd: file.BaseFile, uid: number, gid: number, callback: Function = nopCb): void {
    var newCb = wrapCb(callback, 1);
    try {
      checkFd(fd);
      fd.chown(uid, gid, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  public static fchownSync(fd: number, uid: number, gid: number): void {
    checkFd(fd);
    return fd.chownSync(uid, gid);
  }

  public static fchmod(fd: number, mode: string, cb?: Function): void;
  public static fchmod(fd: number, mode: number, cb?: Function): void;
  public static fchmod(fd: number, mode: any, cb: Function = nopCb): void {
    var newCb = wrapCb(cb, 1);
    try {
      mode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
      checkFd(fd);
      fd.chmod(mode, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  public static fchmodSync(fd: number, mode: string): void;
  public static fchmodSync(fd: number, mode: number): void;
  public static fchmodSync(fd: number, mode: any): void {
    mode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
    checkFd(fd);
    return fd.chmodSync(mode);
  }

  public static futimes(fd: number, atime: number, mtime: number, cb: Function = nopCb): void {
    var newCb = wrapCb(cb, 1);
    try {
      checkFd(fd);
      if (typeof atime === 'number') {
        atime = new Date(atime * 1000);
      }
      if (typeof mtime === 'number') {
        mtime = new Date(mtime * 1000);
      }
      fd.utimes(atime, mtime, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  public static futimesSync(fd: number, atime: number, mtime: number): void {
    checkFd(fd);
    if (typeof atime === 'number') {
      atime = new Date(atime * 1000);
    }
    if (typeof mtime === 'number') {
      mtime = new Date(mtime * 1000);
    }
    return fd.utimesSync(atime, mtime);
  }

  public static rmdir(path: string, cb: Function = nopCb): void {
    var newCb = wrapCb(callback, 1);
    try {
      path = normalizePath(path);
      fs.root.rmdir(path, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  public static rmdirSync(path: string): void {
    path = normalizePath(path);
    return fs.root.rmdirSync(path);
  }

  public static mkdir(path: string, mode?: any, cb: Function = nopCb): void {
    if (typeof mode === 'function') {
      cb = mode;
      mode = 0x1ff;
    }
    var newCb = wrapCb(cb, 1);
    try {
      path = normalizePath(path);
      fs.root.mkdir(path, mode, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  public static mkdirSync(path: string, mode?: string): void;
  public static mkdirSync(path: string, mode?: number): void;
  public static mkdirSync(path: string, mode?: any = 0x1ff): void {
    mode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
    path = normalizePath(path);
    return fs.root.mkdirSync(path, mode);
  }

  public static readdir(path: string, cb: (err: Error, files: string[]) => void = nopCb): void {
    var newCb = wrapCb(cb, 2);
    try {
      path = normalizePath(path);
      this.root.readdir(path, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  public static readdirSync(path: string): string[] {
    path = normalizePath(path);
    return this.root.readdirSync(path);
  }

  public static link(srcpath: string, dstpath: string, cb: Function = nopCb): void {
    var newCb = wrapCb(callback, 1);
    try {
      srcpath = normalizePath(srcpath);
      dstpath = normalizePath(dstpath);
      this.root.link(srcpath, dstpath, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  public static linkSync(srcpath: string, dstpath: string): void {
    srcpath = normalizePath(srcpath);
    dstpath = normalizePath(dstpath);
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
      srcpath = normalizePath(srcpath);
      dstpath = normalizePath(dstpath);
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
    srcpath = normalizePath(srcpath);
    dstpath = normalizePath(dstpath);
    return this.root.symlinkSync(srcpath, dstpath, type);
  }

  public static readlink(path: string, callback?: (err: Error, linkString: string) =>any): void {
    var e, newCb;

    if (callback == null) {
      callback = nopCb;
    }
    try {
      newCb = wrapCb(callback, 2);
      path = normalizePath(path);
      return this.root.readlink(path, newCb);
    } catch (_error) {
      e = _error;
      return newCb(e);
    }
  }

  public static readlinkSync(path: string): string {
    path = normalizePath(path);
    return this.root.readlinkSync(path);
  }

  public static chown(path: string, uid: number, gid: number, callback?: Function): void {
    var e, newCb;

    if (callback == null) {
      callback = nopCb;
    }
    try {
      newCb = wrapCb(callback, 1);
      path = normalizePath(path);
      return this.root.chown(path, false, uid, gid, newCb);
    } catch (_error) {
      e = _error;
      return newCb(e);
    }
  }

  public static chownSync(path: string, uid: number, gid: number): void {
    path = normalizePath(path);
    return this.root.chownSync(path, false, uid, gid);
  }

  public static lchown(path: string, uid: number, gid: number, callback?: Function): void {
    var e, newCb;

    if (callback == null) {
      callback = nopCb;
    }
    try {
      newCb = wrapCb(callback, 1);
      path = normalizePath(path);
      return this.root.chown(path, true, uid, gid, newCb);
    } catch (_error) {
      e = _error;
      return newCb(e);
    }
  }

  public static lchownSync(path: string, uid: number, gid: number): void {
    path = normalizePath(path);
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
      path = normalizePath(path);
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
    path = normalizePath(path);
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
      path = normalizePath(path);
      return this.root.chmod(path, true, mode, newCb);
    } catch (_error) {
      e = _error;
      return newCb(e);
    }
  }

  public static lchmodSync(path: string, mode: number): void;
  public static lchmodSync(path: string, mode: string): void {
    path = normalizePath(path);
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
      path = normalizePath(path);
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
    path = normalizePath(path);
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
      path = normalizePath(path);
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
    path = normalizePath(path);
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
