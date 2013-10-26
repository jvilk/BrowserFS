import file = require('./file');
import api_error = require('./api_error');
import file_system = require('./file_system');
import file_flag = require('./file_flag');
import buffer = require('./buffer');
import node_path = require('./node_path');
import node_fs_stats = require('./node_fs_stats');
var ApiError = api_error.ApiError;
var ErrorType = api_error.ErrorType;
var FileFlag = file_flag.FileFlag;
var Buffer = buffer.Buffer;
var path = node_path.path;

declare var __numWaiting: number;
declare var setImmediate: (cb: Function) => void;

function wrapCb(cb: Function, numArgs: number): Function {
  if (typeof cb !== 'function') {
    throw new ApiError(ErrorType.INVALID_PARAM, 'Callback must be a function.');
  }
  // @todo This is used for unit testing. Maybe we should inject this logic
  //       dynamically rather than bundle it in 'production' code.
  if (typeof __numWaiting === 'undefined') {
    __numWaiting = 0;
  }
  __numWaiting++;
  switch (numArgs) {
    case 1:
      return function(arg1) {
        setImmediate(function() {
          __numWaiting--;
          return cb(arg1);
        });
      };
    case 2:
      return function(arg1, arg2) {
        setImmediate(function() {
          __numWaiting--;
          return cb(arg1, arg2);
        });
      };
    case 3:
      return function(arg1, arg2, arg3) {
        setImmediate(function() {
          __numWaiting--;
          return cb(arg1, arg2, arg3);
        });
      };
    default:
      throw new Error('Invalid invocation of wrapCb.');
  }
}

function checkFd(fd: file.BaseFile): void {
  if (!(fd instanceof file.BaseFile)) {
    throw new ApiError(ErrorType.INVALID_PARAM, 'Invalid file descriptor.');
  }
}

function normalizeMode(mode: any, def: number): number {
  switch(typeof def) {
    case 'number':
      // (path, flag, mode, cb?)
      return def;
    case 'string':
      // (path, flag, modeString, cb?)
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

function normalizeOptions(options: any, defEnc: string, defFlag: string, defMode: number): {encoding: string; flag: string; mode: number} {
  switch (typeof options) {
    case 'object':
      return {
        encoding: typeof options['encoding'] !== 'undefined' ? options['encoding'] : defEnc,
        flag: typeof options['flag'] !== 'undefined' ? options['flag'] : defFlag,
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
  private static root: file_system.FileSystem = null;

  public static _initialize(rootFS: file_system.FileSystem): file_system.FileSystem {
    if (!(<any> rootFS).constructor.isAvailable()) {
      throw new ApiError(ErrorType.INVALID_PARAM, 'Tried to instantiate BrowserFS with an unavailable file system.');
    }
    return fs.root = rootFS;
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

  public static getRootFS(): file_system.FileSystem {
    if (fs.root) {
      return fs.root;
    } else {
      return null;
    }
  }

  public static rename(oldPath: string, newPath: string, cb: Function = nopCb): void {
    var newCb = wrapCb(cb, 1);
    try {
      fs.root.rename(normalizePath(oldPath), normalizePath(newPath), newCb);
    } catch (e) {
      newCb(e);
    }
  }

  public static renameSync(oldPath: string, newPath: string): void {
    fs.root.renameSync(normalizePath(oldPath), normalizePath(newPath));
  }

  public static exists(path: string, cb: (exists: boolean) => void = nopCb): void {
    var newCb = <(exists: boolean) => void> wrapCb(cb, 1);
    try {
      return fs.root.exists(normalizePath(path), newCb);
    } catch (e) {
      return newCb(false);
    }
  }

  public static existsSync(path: string): boolean {
    try {
      return fs.root.existsSync(normalizePath(path));
    } catch (e) {
      return false;
    }
  }

  public static stat(path: string, cb: (err: api_error.ApiError, stats?: node_fs_stats.Stats) => any = nopCb): void {
    var newCb = <(err: api_error.ApiError, stats?: node_fs_stats.Stats) => any> wrapCb(cb, 2);
    try {
      return fs.root.stat(normalizePath(path), false, newCb);
    } catch (e) {
      return newCb(e, null);
    }
  }

  public static statSync(path: string): node_fs_stats.Stats {
    return fs.root.statSync(normalizePath(path), false);
  }

  public static lstat(path: string, cb: (err: api_error.ApiError, stats?: node_fs_stats.Stats) => any = nopCb): void {
    var newCb = <(err: api_error.ApiError, stats?: node_fs_stats.Stats) => any> wrapCb(cb, 2);
    try {
      return fs.root.stat(normalizePath(path), true, newCb);
    } catch (e) {
      return newCb(e, null);
    }
  }

  public static lstatSync(path: string): node_fs_stats.Stats {
    return fs.root.statSync(normalizePath(path), true);
  }

  public static truncate(path: string, cb?: Function): void;
  public static truncate(path: string, len: number, cb?: Function): void;
  public static truncate(path: string, arg2: any = 0, cb: Function = nopCb): void {
    var len = 0;
    if (typeof arg2 === 'function') {
      cb = arg2;
    } else if (typeof arg2 === 'number') {
      len = arg2;
    }

    var newCb = wrapCb(cb, 1);
    try {
      return fs.root.truncate(normalizePath(path), len, newCb);
    } catch (e) {
      return newCb(e);
    }
  }

  public static truncateSync(path: string, len: number = 0): void {
    return fs.root.truncateSync(normalizePath(path), len);
  }

  public static unlink(path: string, cb: Function = nopCb): void {
    var newCb = wrapCb(cb, 1);
    try {
      return fs.root.unlink(normalizePath(path), newCb);
    } catch (e) {
      return newCb(e);
    }
  }

  public static unlinkSync(path: string): void {
    return fs.root.unlinkSync(normalizePath(path));
  }

  public static open(path: string, flag: string, cb?: (err: api_error.ApiError, fd?: file.BaseFile) => any): void;
  public static open(path: string, flag: string, mode: string, cb?: (err: api_error.ApiError, fd?: file.BaseFile) => any): void;
  public static open(path: string, flag: string, mode: number, cb?: (err: api_error.ApiError, fd?: file.BaseFile) => any): void;
  public static open(path: string, flag: string, arg2?: any, cb: (err: api_error.ApiError, fd?: file.BaseFile) => any = nopCb): void {
    var mode = normalizeMode(arg2, 0x1a4);
    cb = typeof arg2 === 'function' ? arg2 : cb;
    var newCb = <(err: api_error.ApiError, fd?: file.BaseFile) => any> wrapCb(cb, 2);
    try {
      return fs.root.open(normalizePath(path), FileFlag.getFileFlag(flag), mode, newCb);
    } catch (e) {
      return newCb(e, null);
    }
  }

  public static openSync(path: string, flag: string, mode?: string): file.BaseFile;
  public static openSync(path: string, flag: string, mode?: number): file.BaseFile;
  public static openSync(path: string, flag: string, mode: any = 0x1a4): file.BaseFile {
    return fs.root.openSync(normalizePath(path), FileFlag.getFileFlag(flag), mode);
  }

  public static readFile(filename: string, cb?: (err: api_error.ApiError, data?: any) => void ): void;
  public static readFile(filename: string, options: {[opt: string]: any}, cb?: (err: api_error.ApiError, data?: any) => void ): void;
  public static readFile(filename: string, encoding: string, cb?: (err: api_error.ApiError, data?: any) => void ): void;
  public static readFile(filename: string, arg2: any = {}, cb: (err: api_error.ApiError, data?: any) => void = nopCb ) {
    var options = normalizeOptions(arg2, null, 'r', null);
    cb = typeof arg2 === 'function' ? arg2 : cb;
    var newCb = <(err: api_error.ApiError, data?: any) => void> wrapCb(cb, 2);
    try {
      var flag = FileFlag.getFileFlag(options['flag']);
      if (!flag.isReadable()) {
        return newCb(new ApiError(ErrorType.INVALID_PARAM, 'Flag passed to readFile must allow for reading.'));
      }
      return fs.root.readFile(normalizePath(filename), options.encoding, flag, newCb);
    } catch (e) {
      return newCb(e, null);
    }
  }

  public static readFileSync(filename: string, encoding?: string): buffer.Buffer;
  public static readFileSync(filename: string, options?: { encoding?: string; flag?: string; }): buffer.Buffer;
  public static readFileSync(filename: string, arg2: any = {}): buffer.Buffer {
    var options = normalizeOptions(arg2, null, 'r', null);
    var flag = FileFlag.getFileFlag(options.flag);
    if (!flag.isReadable()) {
      throw new ApiError(ErrorType.INVALID_PARAM, 'Flag passed to readFile must allow for reading.');
    }
    return fs.root.readFileSync(normalizePath(filename), options.encoding, flag);
  }

  public static writeFile(filename: string, data: any, cb?: (err?: api_error.ApiError) => void);
  public static writeFile(filename: string, data: any, encoding?: string, cb?: (err?: api_error.ApiError) => void);
  public static writeFile(filename: string, data: any, options?: Object, cb?: (err?: api_error.ApiError) => void);
  public static writeFile(filename: string, data: any, arg3: any = {}, cb: (err?: api_error.ApiError) => void = nopCb): void {
    var options = normalizeOptions(arg3, 'utf8', 'w', 0x1a4);
    cb = typeof arg3 === 'function' ? arg3 : cb;
    var newCb = <(err?: api_error.ApiError) => void> wrapCb(cb, 1);
    try {
      var flag = FileFlag.getFileFlag(options.flag);
      if (!flag.isWriteable()) {
        return newCb(new ApiError(ErrorType.INVALID_PARAM, 'Flag passed to writeFile must allow for writing.'));
      }
      return fs.root.writeFile(normalizePath(filename), data, options.encoding, flag, options.mode, newCb);
    } catch (e) {
      return newCb(e);
    }
  }

  public static writeFileSync(filename: string, data: any, options?: Object): void;
  public static writeFileSync(filename: string, data: any, encoding?: string): void;
  public static writeFileSync(filename: string, data: any, arg3?: any): void {
    var options = normalizeOptions(arg3, 'utf8', 'w', 0x1a4);
    var flag = FileFlag.getFileFlag(options.flag);
    if (!flag.isWriteable()) {
      throw new ApiError(ErrorType.INVALID_PARAM, 'Flag passed to writeFile must allow for writing.');
    }
    return fs.root.writeFileSync(normalizePath(filename), data, options.encoding, flag, options.mode);
  }

  public static appendFile(filename: string, data: any, cb?: (err: api_error.ApiError) => void): void;
  public static appendFile(filename: string, data: any, options?: Object, cb?: (err: api_error.ApiError) => void): void;
  public static appendFile(filename: string, data: any, encoding?: string, cb?: (err: api_error.ApiError) => void): void;
  public static appendFile(filename: string, data: any, arg3?: any, cb: (err: api_error.ApiError) => void = nopCb): void {
    var options = normalizeOptions(arg3, 'utf8', 'a', 0x1a4);
    cb = typeof arg3 === 'function' ? arg3 : cb;
    var newCb = <(err: api_error.ApiError) => void> wrapCb(cb, 1);
    try {
      var flag = FileFlag.getFileFlag(options.flag);
      if (!flag.isAppendable()) {
        return newCb(new ApiError(ErrorType.INVALID_PARAM, 'Flag passed to appendFile must allow for appending.'));
      }
      fs.root.appendFile(normalizePath(filename), data, options.encoding, flag, options.mode, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  public static appendFileSync(filename: string, data: any, options?: Object): void;
  public static appendFileSync(filename: string, data: any, encoding?: string): void;
  public static appendFileSync(filename: string, data: any, arg3?: any): void {
    var options = normalizeOptions(arg3, 'utf8', 'a', 0x1a4);
    var flag = FileFlag.getFileFlag(options.flag);
    if (!flag.isAppendable()) {
      throw new ApiError(ErrorType.INVALID_PARAM, 'Flag passed to appendFile must allow for appending.');
    }
    return fs.root.appendFileSync(normalizePath(filename), data, options.encoding, flag, options.mode);
  }

  public static fstat(fd: file.BaseFile, cb: (err: api_error.ApiError, stats?: node_fs_stats.Stats) => any = nopCb): void {
    var newCb = <(err: api_error.ApiError, stats?: node_fs_stats.Stats) => any> wrapCb(cb, 2);
    try {
      checkFd(fd);
      fd.stat(newCb);
    } catch (e) {
      newCb(e);
    }
  }

  public static fstatSync(fd: file.BaseFile): node_fs_stats.Stats {
    checkFd(fd);
    return fd.statSync();
  }

  public static close(fd: file.BaseFile, cb: Function = nopCb): void {
    var newCb = wrapCb(cb, 1);
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
      fd.truncate(length, newCb);
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
  public static write(fd: file.BaseFile, buffer: buffer.Buffer, offset: number, length: number, cb?: (err: api_error.ApiError, written?: number, buffer?: buffer.Buffer) => any): void;
  public static write(fd: file.BaseFile, buffer: buffer.Buffer, offset: number, length: number, position?: number, cb?: (err: api_error.ApiError, written?: number, buffer?: buffer.Buffer) => any): void;
  public static write(fd: file.BaseFile, data: string, cb?: (err: api_error.ApiError, written?: number, buffer?: buffer.Buffer) => any): void;
  public static write(fd: file.BaseFile, data: string, position: number, cb?: (err: api_error.ApiError, written?: number, buffer?: buffer.Buffer) => any): void;
  public static write(fd: file.BaseFile, data: string, position: number, encoding: string, cb?: (err: api_error.ApiError, written?: number, buffer?: buffer.Buffer) => any): void;
  public static write(fd: file.BaseFile, arg2: any, arg3?: any, arg4?: any, arg5?: any, cb: (err: api_error.ApiError, written?: number, buffer?: buffer.Buffer) => any = nopCb): void {
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
      buffer = new Buffer(arg2, encoding);
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

    var newCb = <(err: api_error.ApiError, written?: number, buffer?: buffer.Buffer) => any> wrapCb(cb, 3);
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
  public static writeSync(fd: file.BaseFile, arg2: any, arg3?: any, arg4?: any, arg5?: any): number {
    var buffer: buffer.Buffer, offset: number = 0, length: number, position: number;
    if (typeof arg2 === 'string') {
      // Signature 1: (fd, string, [position?, [encoding?]])
      position = typeof arg3 === 'number' ? arg3 : null;
      var encoding = typeof arg4 === 'string' ? arg4 : 'utf8';
      offset = 0;
      buffer = new Buffer(arg2, encoding);
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

  public static read(fd: file.BaseFile, length: number, position: number, encoding: string, cb?: (err: api_error.ApiError, data?: string, bytesRead?: number) => void): void;
  public static read(fd: file.BaseFile, buffer: buffer.Buffer, offset: number, length: number, position: number, cb?: (err: api_error.ApiError, bytesRead?: number, buffer?: buffer.Buffer) => void): void;
  public static read(fd: file.BaseFile, arg2: any, arg3: any, arg4: any, arg5?: any, cb: (err: api_error.ApiError, arg2?: any, arg3?: any) => void = nopCb): void {
    var position: number, offset: number, length: number, buffer: buffer.Buffer, newCb: (err: api_error.ApiError, bytesRead?: number, buffer?: buffer.Buffer) => void;
    if (typeof arg2 === 'number') {
      // legacy interface
      // (fd, length, position, encoding, callback)
      length = arg2;
      position = arg3;
      var encoding = arg4;
      cb = typeof arg5 === 'function' ? arg5 : cb;
      offset = 0;
      buffer = new Buffer(length);
      newCb = <(err: api_error.ApiError, bytesRead?: number, buffer?: buffer.Buffer) => void> wrapCb((function(err, bytesRead, buf) {
        if (err) {
          return cb(err);
        }
        cb(err, buf.toString(encoding), bytesRead);
      }), 3);
    } else {
      buffer = arg2;
      offset = arg3;
      length = arg4;
      position = arg5;
      newCb = <(err: api_error.ApiError, bytesRead?: number, buffer?: buffer.Buffer) => void> wrapCb(cb, 3);
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
  public static readSync(fd: file.BaseFile, buffer: buffer.Buffer, offset: number, length: number, position: number): number;
  public static readSync(fd: file.BaseFile, arg2: any, arg3: any, arg4: any, arg5?: any): any {
    var shenanigans = false;
    var buffer: buffer.Buffer, offset: number, length: number, position: number;
    if (typeof arg2 === 'number') {
      length = arg2;
      position = arg3;
      var encoding = arg4;
      offset = 0;
      buffer = new Buffer(length);
      shenanigans = true;
    } else {
      buffer = arg2;
      offset = arg3;
      length = arg4;
      position = arg5;
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

  public static fchownSync(fd: file.BaseFile, uid: number, gid: number): void {
    checkFd(fd);
    return fd.chownSync(uid, gid);
  }

  public static fchmod(fd: file.BaseFile, mode: string, cb?: Function): void;
  public static fchmod(fd: file.BaseFile, mode: number, cb?: Function): void;
  public static fchmod(fd: file.BaseFile, mode: any, cb: Function = nopCb): void {
    var newCb = wrapCb(cb, 1);
    try {
      mode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
      checkFd(fd);
      fd.chmod(mode, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  public static fchmodSync(fd: file.BaseFile, mode: string): void;
  public static fchmodSync(fd: file.BaseFile, mode: number): void;
  public static fchmodSync(fd: file.BaseFile, mode: any): void {
    mode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
    checkFd(fd);
    return fd.chmodSync(mode);
  }

  public static futimes(fd: file.BaseFile, atime: number, mtime: number, cb: Function): void;
  public static futimes(fd: file.BaseFile, atime: Date, mtime: Date, cb: Function): void;
  public static futimes(fd: file.BaseFile, atime: any, mtime: any, cb: Function = nopCb): void {
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

  public static futimesSync(fd: file.BaseFile, atime: number, mtime: number): void;
  public static futimesSync(fd: file.BaseFile, atime: Date, mtime: Date): void;
  public static futimesSync(fd: file.BaseFile, atime: any, mtime: any): void {
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
    var newCb = wrapCb(cb, 1);
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
  public static mkdirSync(path: string, mode: any = 0x1ff): void {
    mode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
    path = normalizePath(path);
    return fs.root.mkdirSync(path, mode);
  }

  public static readdir(path: string, cb: (err: api_error.ApiError, files?: string[]) => void = nopCb): void {
    var newCb = <(err: api_error.ApiError, files?: string[]) => void> wrapCb(cb, 2);
    try {
      path = normalizePath(path);
      fs.root.readdir(path, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  public static readdirSync(path: string): string[] {
    path = normalizePath(path);
    return fs.root.readdirSync(path);
  }

  public static link(srcpath: string, dstpath: string, cb: Function = nopCb): void {
    var newCb = wrapCb(cb, 1);
    try {
      srcpath = normalizePath(srcpath);
      dstpath = normalizePath(dstpath);
      fs.root.link(srcpath, dstpath, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  public static linkSync(srcpath: string, dstpath: string): void {
    srcpath = normalizePath(srcpath);
    dstpath = normalizePath(dstpath);
    return fs.root.linkSync(srcpath, dstpath);
  }

  public static symlink(srcpath: string, dstpath: string, cb?: Function): void;
  public static symlink(srcpath: string, dstpath: string, type?: string, cb?: Function): void;
  public static symlink(srcpath: string, dstpath: string, arg3?: any, cb: Function = nopCb): void {
    var type = typeof arg3 === 'string' ? arg3 : 'file';
    cb = typeof arg3 === 'function' ? arg3 : cb;
    var newCb = wrapCb(cb, 1);
    try {
      if (type !== 'file' && type !== 'dir') {
        return newCb(new ApiError(ErrorType.INVALID_PARAM, "Invalid type: " + type));
      }
      srcpath = normalizePath(srcpath);
      dstpath = normalizePath(dstpath);
      fs.root.symlink(srcpath, dstpath, type, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  public static symlinkSync(srcpath: string, dstpath: string, type?: string): void {
    if (type == null) {
      type = 'file';
    } else if (type !== 'file' && type !== 'dir') {
      throw new ApiError(ErrorType.INVALID_PARAM, "Invalid type: " + type);
    }
    srcpath = normalizePath(srcpath);
    dstpath = normalizePath(dstpath);
    return fs.root.symlinkSync(srcpath, dstpath, type);
  }

  public static readlink(path: string, cb: (err: api_error.ApiError, linkString: string) => any = nopCb): void {
    var newCb = wrapCb(cb, 2);
    try {
      path = normalizePath(path);
      fs.root.readlink(path, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  public static readlinkSync(path: string): string {
    path = normalizePath(path);
    return fs.root.readlinkSync(path);
  }

  public static chown(path: string, uid: number, gid: number, cb: Function = nopCb): void {
    var newCb = wrapCb(cb, 1);
    try {
      path = normalizePath(path);
      fs.root.chown(path, false, uid, gid, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  public static chownSync(path: string, uid: number, gid: number): void {
    path = normalizePath(path);
    fs.root.chownSync(path, false, uid, gid);
  }

  public static lchown(path: string, uid: number, gid: number, cb: Function = nopCb): void {
    var newCb = wrapCb(cb, 1);
    try {
      path = normalizePath(path);
      fs.root.chown(path, true, uid, gid, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  public static lchownSync(path: string, uid: number, gid: number): void {
    path = normalizePath(path);
    return fs.root.chownSync(path, true, uid, gid);
  }

  public static chmod(path: string, mode: string, cb?: Function): void;
  public static chmod(path: string, mode: number, cb?: Function): void;
  public static chmod(path: string, mode: any, cb: Function = nopCb): void {
    var newCb = wrapCb(cb, 1);
    try {
      mode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
      path = normalizePath(path);
      fs.root.chmod(path, false, mode, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  public static chmodSync(path: string, mode: string): void;
  public static chmodSync(path: string, mode: number): void;
  public static chmodSync(path: string, mode: any): void {
    mode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
    path = normalizePath(path);
    return fs.root.chmodSync(path, false, mode);
  }

  public static lchmod(path: string, mode: string, cb?: Function): void;
  public static lchmod(path: string, mode: number, cb?: Function): void;
  public static lchmod(path: string, mode: any, cb: Function = nopCb): void {
    var newCb = wrapCb(cb, 1);
    try {
      mode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
      path = normalizePath(path);
      fs.root.chmod(path, true, mode, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  public static lchmodSync(path: string, mode: number): void;
  public static lchmodSync(path: string, mode: string): void;
  public static lchmodSync(path: string, mode: any): void {
    path = normalizePath(path);
    mode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
    return fs.root.chmodSync(path, true, mode);
  }

  public static utimes(path: string, atime: number, mtime: number, cb: Function): void;
  public static utimes(path: string, atime: Date, mtime: Date, cb: Function): void;
  public static utimes(path: string, atime: any, mtime: any, cb: Function = nopCb): void {
    var newCb = wrapCb(cb, 1);
    try {
      path = normalizePath(path);
      if (typeof atime === 'number') {
        atime = new Date(atime * 1000);
      }
      if (typeof mtime === 'number') {
        mtime = new Date(mtime * 1000);
      }
      fs.root.utimes(path, atime, mtime, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  public static utimesSync(path: string, atime: number, mtime: number): void;
  public static utimesSync(path: string, atime: Date, mtime: Date): void;
  public static utimesSync(path: string, atime: any, mtime: any): void {
    path = normalizePath(path);
    if (typeof atime === 'number') {
      atime = new Date(atime * 1000);
    }
    if (typeof mtime === 'number') {
      mtime = new Date(mtime * 1000);
    }
    return fs.root.utimesSync(path, atime, mtime);
  }

  public static realpath(path: string, cb?: (err: api_error.ApiError, resolvedPath?: string) =>any): void;
  public static realpath(path: string, cache: {[path: string]: string}, cb: (err: api_error.ApiError, resolvedPath?: string) =>any): void;
  public static realpath(path: string, arg2?: any, cb: (err: api_error.ApiError, resolvedPath?: string) =>any = nopCb): void {
    var cache = typeof arg2 === 'object' ? arg2 : {};
    cb = typeof arg2 === 'function' ? arg2 : nopCb;
    var newCb = <(err: api_error.ApiError, resolvedPath?: string) =>any> wrapCb(cb, 2);
    try {
      path = normalizePath(path);
      fs.root.realpath(path, cache, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  public static realpathSync(path: string, cache: {[path: string]: string} = {}): string {
    path = normalizePath(path);
    return fs.root.realpathSync(path, cache);
  }
}
