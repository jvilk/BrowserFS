import file = require('./file');
import api_error = require('./api_error');
import file_system = require('./file_system');
import file_flag = require('./file_flag');
import buffer = require('./buffer');
import node_path = require('./node_path');
import node_fs_stats = require('./node_fs_stats');
var ApiError = api_error.ApiError;
var ErrorCode = api_error.ErrorCode;
var FileFlag = file_flag.FileFlag;
var Buffer = buffer.Buffer;
var path = node_path.path;

declare var __numWaiting: number;
declare var setImmediate: (cb: Function) => void;

/**
 * Wraps a callback with a setImmediate call.
 * @param [Function] cb The callback to wrap.
 * @param [Number] numArgs The number of arguments that the callback takes.
 * @return [Function] The wrapped callback.
 */
function wrapCb(cb: Function, numArgs: number): Function {
  if (typeof cb !== 'function') {
    throw new ApiError(ErrorCode.EINVAL, 'Callback must be a function.');
  }
  // @todo This is used for unit testing. Maybe we should inject this logic
  //       dynamically rather than bundle it in 'production' code.
  if (typeof __numWaiting === 'undefined') {
    __numWaiting = 0;
  }
  __numWaiting++;
  // We could use `arguments`, but Function.call/apply is expensive. And we only
  // need to handle 1-3 arguments
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

/**
 * Checks if the fd is valid.
 * @param [BrowserFS.File] fd A file descriptor (in BrowserFS, it's a File object)
 * @return [Boolean, BrowserFS.ApiError] Returns `true` if the FD is OK,
 *   otherwise returns an ApiError.
 */
function checkFd(fd: file.File): void {
  if (typeof fd['write'] !== 'function') {
    throw new ApiError(ErrorCode.EBADF, 'Invalid file descriptor.');
  }
}

function normalizeMode(mode: any, def: number): number {
  switch(typeof mode) {
    case 'number':
      // (path, flag, mode, cb?)
      return mode;
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
  // Node doesn't allow null characters in paths.
  if (p.indexOf('\u0000') >= 0) {
    throw new ApiError(ErrorCode.EINVAL, 'Path must be a string without null bytes.');
  } else if (p === '') {
    throw new ApiError(ErrorCode.EINVAL, 'Path must not be empty.');
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

// The default callback is a NOP.
function nopCb() {};

/**
 * The node frontend to all filesystems.
 * This layer handles:
 *
 * * Sanity checking inputs.
 * * Normalizing paths.
 * * Resetting stack depth for asynchronous operations which may not go through
 *   the browser by wrapping all input callbacks using `setImmediate`.
 * * Performing the requested operation through the filesystem or the file
 *   descriptor, as appropriate.
 * * Handling optional arguments and setting default arguments.
 * @see http://nodejs.org/api/fs.html
 * @class
 */
export class fs {
  private static root: file_system.FileSystem = null;

  public static _initialize(rootFS: file_system.FileSystem): file_system.FileSystem {
    if (!(<any> rootFS).constructor.isAvailable()) {
      throw new ApiError(ErrorCode.EINVAL, 'Tried to instantiate BrowserFS with an unavailable file system.');
    }
    return fs.root = rootFS;
  }

  /**
   * converts Date or number to a fractional UNIX timestamp
   * Grabbed from NodeJS sources (lib/fs.js)
   */
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

  /**
   * **NONSTANDARD**: Grab the FileSystem instance that backs this API.
   * @return [BrowserFS.FileSystem | null] Returns null if the file system has
   *   not been initialized.
   */
  public static getRootFS(): file_system.FileSystem {
    if (fs.root) {
      return fs.root;
    } else {
      return null;
    }
  }

  // FILE OR DIRECTORY METHODS

  /**
   * Asynchronous rename. No arguments other than a possible exception are given
   * to the completion callback.
   * @param [String] oldPath
   * @param [String] newPath
   * @param [Function(BrowserFS.ApiError)] callback
   */
  public static rename(oldPath: string, newPath: string, cb: (err?: api_error.ApiError) => void = nopCb): void {
    var newCb = <(err?: api_error.ApiError) => void> wrapCb(cb, 1);
    try {
      fs.root.rename(normalizePath(oldPath), normalizePath(newPath), newCb);
    } catch (e) {
      newCb(e);
    }
  }

  /**
   * Synchronous rename.
   * @param [String] oldPath
   * @param [String] newPath
   */
  public static renameSync(oldPath: string, newPath: string): void {
    fs.root.renameSync(normalizePath(oldPath), normalizePath(newPath));
  }

  /**
   * Test whether or not the given path exists by checking with the file system.
   * Then call the callback argument with either true or false.
   * @example Sample invocation
   *   fs.exists('/etc/passwd', function (exists) {
   *     util.debug(exists ? "it's there" : "no passwd!");
   *   });
   * @param [String] path
   * @param [Function(Boolean)] callback
   */
  public static exists(path: string, cb: (exists: boolean) => void = nopCb): void {
    var newCb = <(exists: boolean) => void> wrapCb(cb, 1);
    try {
      return fs.root.exists(normalizePath(path), newCb);
    } catch (e) {
      // Doesn't return an error. If something bad happens, we assume it just
      // doesn't exist.
      return newCb(false);
    }
  }

  /**
   * Test whether or not the given path exists by checking with the file system.
   * @param [String] path
   * @return [boolean]
   */
  public static existsSync(path: string): boolean {
    try {
      return fs.root.existsSync(normalizePath(path));
    } catch (e) {
      // Doesn't return an error. If something bad happens, we assume it just
      // doesn't exist.
      return false;
    }
  }

  /**
   * Asynchronous `stat`.
   * @param [String] path
   * @param [Function(BrowserFS.ApiError, BrowserFS.node.fs.Stats)] callback
   */
  public static stat(path: string, cb: (err: api_error.ApiError, stats?: node_fs_stats.Stats) => any = nopCb): void {
    var newCb = <(err: api_error.ApiError, stats?: node_fs_stats.Stats) => any> wrapCb(cb, 2);
    try {
      return fs.root.stat(normalizePath(path), false, newCb);
    } catch (e) {
      return newCb(e, null);
    }
  }

  /**
   * Synchronous `stat`.
   * @param [String] path
   * @return [BrowserFS.node.fs.Stats]
   */
  public static statSync(path: string): node_fs_stats.Stats {
    return fs.root.statSync(normalizePath(path), false);
  }

  /**
   * Asynchronous `lstat`.
   * `lstat()` is identical to `stat()`, except that if path is a symbolic link,
   * then the link itself is stat-ed, not the file that it refers to.
   * @param [String] path
   * @param [Function(BrowserFS.ApiError, BrowserFS.node.fs.Stats)] callback
   */
  public static lstat(path: string, cb: (err: api_error.ApiError, stats?: node_fs_stats.Stats) => any = nopCb): void {
    var newCb = <(err: api_error.ApiError, stats?: node_fs_stats.Stats) => any> wrapCb(cb, 2);
    try {
      return fs.root.stat(normalizePath(path), true, newCb);
    } catch (e) {
      return newCb(e, null);
    }
  }

  /**
   * Synchronous `lstat`.
   * `lstat()` is identical to `stat()`, except that if path is a symbolic link,
   * then the link itself is stat-ed, not the file that it refers to.
   * @param [String] path
   * @return [BrowserFS.node.fs.Stats]
   */
  public static lstatSync(path: string): node_fs_stats.Stats {
    return fs.root.statSync(normalizePath(path), true);
  }

  // FILE-ONLY METHODS

  /**
   * Asynchronous `truncate`.
   * @param [String] path
   * @param [Number] len
   * @param [Function(BrowserFS.ApiError)] callback
   */
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
      if (len < 0) {
        throw new ApiError(ErrorCode.EINVAL);
      }
      return fs.root.truncate(normalizePath(path), len, newCb);
    } catch (e) {
      return newCb(e);
    }
  }

  /**
   * Synchronous `truncate`.
   * @param [String] path
   * @param [Number] len
   */
  public static truncateSync(path: string, len: number = 0): void {
    if (len < 0) {
      throw new ApiError(ErrorCode.EINVAL);
    }
    return fs.root.truncateSync(normalizePath(path), len);
  }

  /**
   * Asynchronous `unlink`.
   * @param [String] path
   * @param [Function(BrowserFS.ApiError)] callback
   */
  public static unlink(path: string, cb: Function = nopCb): void {
    var newCb = wrapCb(cb, 1);
    try {
      return fs.root.unlink(normalizePath(path), newCb);
    } catch (e) {
      return newCb(e);
    }
  }

  /**
   * Synchronous `unlink`.
   * @param [String] path
   */
  public static unlinkSync(path: string): void {
    return fs.root.unlinkSync(normalizePath(path));
  }

  /**
   * Asynchronous file open.
   * Exclusive mode ensures that path is newly created.
   *
   * `flags` can be:
   *
   * * `'r'` - Open file for reading. An exception occurs if the file does not exist.
   * * `'r+'` - Open file for reading and writing. An exception occurs if the file does not exist.
   * * `'rs'` - Open file for reading in synchronous mode. Instructs the filesystem to not cache writes.
   * * `'rs+'` - Open file for reading and writing, and opens the file in synchronous mode.
   * * `'w'` - Open file for writing. The file is created (if it does not exist) or truncated (if it exists).
   * * `'wx'` - Like 'w' but opens the file in exclusive mode.
   * * `'w+'` - Open file for reading and writing. The file is created (if it does not exist) or truncated (if it exists).
   * * `'wx+'` - Like 'w+' but opens the file in exclusive mode.
   * * `'a'` - Open file for appending. The file is created if it does not exist.
   * * `'ax'` - Like 'a' but opens the file in exclusive mode.
   * * `'a+'` - Open file for reading and appending. The file is created if it does not exist.
   * * `'ax+'` - Like 'a+' but opens the file in exclusive mode.
   *
   * @see http://www.manpagez.com/man/2/open/
   * @param [String] path
   * @param [String] flags
   * @param [Number?] mode defaults to `0644`
   * @param [Function(BrowserFS.ApiError, BrowserFS.File)] callback
   */
  public static open(path: string, flag: string, cb?: (err: api_error.ApiError, fd?: file.File) => any): void;
  public static open(path: string, flag: string, mode: string, cb?: (err: api_error.ApiError, fd?: file.File) => any): void;
  public static open(path: string, flag: string, mode: number, cb?: (err: api_error.ApiError, fd?: file.File) => any): void;
  public static open(path: string, flag: string, arg2?: any, cb: (err: api_error.ApiError, fd?: file.File) => any = nopCb): void {
    var mode = normalizeMode(arg2, 0x1a4);
    cb = typeof arg2 === 'function' ? arg2 : cb;
    var newCb = <(err: api_error.ApiError, fd?: file.File) => any> wrapCb(cb, 2);
    try {
      return fs.root.open(normalizePath(path), FileFlag.getFileFlag(flag), mode, newCb);
    } catch (e) {
      return newCb(e, null);
    }
  }

  /**
   * Synchronous file open.
   * @see http://www.manpagez.com/man/2/open/
   * @param [String] path
   * @param [String] flags
   * @param [Number?] mode defaults to `0644`
   * @return [BrowserFS.File]
   */
  public static openSync(path: string, flag: string, mode?: string): file.File;
  public static openSync(path: string, flag: string, mode?: number): file.File;
  public static openSync(path: string, flag: string, mode: any = 0x1a4): file.File {
    return fs.root.openSync(normalizePath(path), FileFlag.getFileFlag(flag), mode);
  }

  /**
   * Asynchronously reads the entire contents of a file.
   * @example Usage example
   *   fs.readFile('/etc/passwd', function (err, data) {
   *     if (err) throw err;
   *     console.log(data);
   *   });
   * @param [String] filename
   * @param [Object?] options
   * @option options [String] encoding The string encoding for the file contents. Defaults to `null`.
   * @option options [String] flag Defaults to `'r'`.
   * @param [Function(BrowserFS.ApiError, String | BrowserFS.node.Buffer)] callback If no encoding is specified, then the raw buffer is returned.
   */
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
        return newCb(new ApiError(ErrorCode.EINVAL, 'Flag passed to readFile must allow for reading.'));
      }
      return fs.root.readFile(normalizePath(filename), options.encoding, flag, newCb);
    } catch (e) {
      return newCb(e, null);
    }
  }

  /**
   * Synchronously reads the entire contents of a file.
   * @param [String] filename
   * @param [Object?] options
   * @option options [String] encoding The string encoding for the file contents. Defaults to `null`.
   * @option options [String] flag Defaults to `'r'`.
   * @return [String | BrowserFS.node.Buffer]
   */
  public static readFileSync(filename: string, encoding?: string): NodeBuffer;
  public static readFileSync(filename: string, options?: { encoding?: string; flag?: string; }): NodeBuffer;
  public static readFileSync(filename: string, arg2: any = {}): NodeBuffer {
    var options = normalizeOptions(arg2, null, 'r', null);
    var flag = FileFlag.getFileFlag(options.flag);
    if (!flag.isReadable()) {
      throw new ApiError(ErrorCode.EINVAL, 'Flag passed to readFile must allow for reading.');
    }
    return fs.root.readFileSync(normalizePath(filename), options.encoding, flag);
  }

  /**
   * Asynchronously writes data to a file, replacing the file if it already
   * exists.
   *
   * The encoding option is ignored if data is a buffer.
   *
   * @example Usage example
   *   fs.writeFile('message.txt', 'Hello Node', function (err) {
   *     if (err) throw err;
   *     console.log('It\'s saved!');
   *   });
   * @param [String] filename
   * @param [String | BrowserFS.node.Buffer] data
   * @param [Object?] options
   * @option options [String] encoding Defaults to `'utf8'`.
   * @option options [Number] mode Defaults to `0644`.
   * @option options [String] flag Defaults to `'w'`.
   * @param [Function(BrowserFS.ApiError)] callback
   */
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
        return newCb(new ApiError(ErrorCode.EINVAL, 'Flag passed to writeFile must allow for writing.'));
      }
      return fs.root.writeFile(normalizePath(filename), data, options.encoding, flag, options.mode, newCb);
    } catch (e) {
      return newCb(e);
    }
  }

  /**
   * Synchronously writes data to a file, replacing the file if it already
   * exists.
   *
   * The encoding option is ignored if data is a buffer.
   * @param [String] filename
   * @param [String | BrowserFS.node.Buffer] data
   * @param [Object?] options
   * @option options [String] encoding Defaults to `'utf8'`.
   * @option options [Number] mode Defaults to `0644`.
   * @option options [String] flag Defaults to `'w'`.
   */
  public static writeFileSync(filename: string, data: any, options?: Object): void;
  public static writeFileSync(filename: string, data: any, encoding?: string): void;
  public static writeFileSync(filename: string, data: any, arg3?: any): void {
    var options = normalizeOptions(arg3, 'utf8', 'w', 0x1a4);
    var flag = FileFlag.getFileFlag(options.flag);
    if (!flag.isWriteable()) {
      throw new ApiError(ErrorCode.EINVAL, 'Flag passed to writeFile must allow for writing.');
    }
    return fs.root.writeFileSync(normalizePath(filename), data, options.encoding, flag, options.mode);
  }

  /**
   * Asynchronously append data to a file, creating the file if it not yet
   * exists.
   *
   * @example Usage example
   *   fs.appendFile('message.txt', 'data to append', function (err) {
   *     if (err) throw err;
   *     console.log('The "data to append" was appended to file!');
   *   });
   * @param [String] filename
   * @param [String | BrowserFS.node.Buffer] data
   * @param [Object?] options
   * @option options [String] encoding Defaults to `'utf8'`.
   * @option options [Number] mode Defaults to `0644`.
   * @option options [String] flag Defaults to `'a'`.
   * @param [Function(BrowserFS.ApiError)] callback
   */
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
        return newCb(new ApiError(ErrorCode.EINVAL, 'Flag passed to appendFile must allow for appending.'));
      }
      fs.root.appendFile(normalizePath(filename), data, options.encoding, flag, options.mode, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  /**
   * Asynchronously append data to a file, creating the file if it not yet
   * exists.
   *
   * @example Usage example
   *   fs.appendFile('message.txt', 'data to append', function (err) {
   *     if (err) throw err;
   *     console.log('The "data to append" was appended to file!');
   *   });
   * @param [String] filename
   * @param [String | BrowserFS.node.Buffer] data
   * @param [Object?] options
   * @option options [String] encoding Defaults to `'utf8'`.
   * @option options [Number] mode Defaults to `0644`.
   * @option options [String] flag Defaults to `'a'`.
   */
  public static appendFileSync(filename: string, data: any, options?: Object): void;
  public static appendFileSync(filename: string, data: any, encoding?: string): void;
  public static appendFileSync(filename: string, data: any, arg3?: any): void {
    var options = normalizeOptions(arg3, 'utf8', 'a', 0x1a4);
    var flag = FileFlag.getFileFlag(options.flag);
    if (!flag.isAppendable()) {
      throw new ApiError(ErrorCode.EINVAL, 'Flag passed to appendFile must allow for appending.');
    }
    return fs.root.appendFileSync(normalizePath(filename), data, options.encoding, flag, options.mode);
  }

  // FILE DESCRIPTOR METHODS

  /**
   * Asynchronous `fstat`.
   * `fstat()` is identical to `stat()`, except that the file to be stat-ed is
   * specified by the file descriptor `fd`.
   * @param [BrowserFS.File] fd
   * @param [Function(BrowserFS.ApiError, BrowserFS.node.fs.Stats)] callback
   */
  public static fstat(fd: file.File, cb: (err: api_error.ApiError, stats?: node_fs_stats.Stats) => any = nopCb): void {
    var newCb = <(err: api_error.ApiError, stats?: node_fs_stats.Stats) => any> wrapCb(cb, 2);
    try {
      checkFd(fd);
      fd.stat(newCb);
    } catch (e) {
      newCb(e);
    }
  }

  /**
   * Synchronous `fstat`.
   * `fstat()` is identical to `stat()`, except that the file to be stat-ed is
   * specified by the file descriptor `fd`.
   * @param [BrowserFS.File] fd
   * @return [BrowserFS.node.fs.Stats]
   */
  public static fstatSync(fd: file.File): node_fs_stats.Stats {
    checkFd(fd);
    return fd.statSync();
  }

  /**
   * Asynchronous close.
   * @param [BrowserFS.File] fd
   * @param [Function(BrowserFS.ApiError)] callback
   */
  public static close(fd: file.File, cb: Function = nopCb): void {
    var newCb = wrapCb(cb, 1);
    try {
      checkFd(fd);
      fd.close(newCb);
    } catch (e) {
      newCb(e);
    }
  }

  /**
   * Synchronous close.
   * @param [BrowserFS.File] fd
   */
  public static closeSync(fd: file.File): void {
    checkFd(fd);
    return fd.closeSync();
  }

  /**
   * Asynchronous ftruncate.
   * @param [BrowserFS.File] fd
   * @param [Number] len
   * @param [Function(BrowserFS.ApiError)] callback
   */
  public static ftruncate(fd: file.File, cb?:Function);
  public static ftruncate(fd: file.File, len?: number, cb?:Function);
  public static ftruncate(fd: file.File, arg2?: any, cb:Function = nopCb) {
    var length = typeof arg2 === 'number' ? arg2 : 0;
    cb = typeof arg2 === 'function' ? arg2 : cb;
    var newCb = wrapCb(cb, 1);
    try {
      checkFd(fd);
      if (length < 0) {
        throw new ApiError(ErrorCode.EINVAL);
      }
      fd.truncate(length, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  /**
   * Synchronous ftruncate.
   * @param [BrowserFS.File] fd
   * @param [Number] len
   */
  public static ftruncateSync(fd: file.File, len: number = 0) {
    checkFd(fd);
    return fd.truncateSync(len);
  }

  /**
   * Asynchronous fsync.
   * @param [BrowserFS.File] fd
   * @param [Function(BrowserFS.ApiError)] callback
   */
  public static fsync(fd: file.File, cb: Function = nopCb): void {
    var newCb = wrapCb(cb, 1);
    try {
      checkFd(fd);
      fd.sync(newCb);
    } catch (e) {
      newCb(e);
    }
  }

  /**
   * Synchronous fsync.
   * @param [BrowserFS.File] fd
   */
  public static fsyncSync(fd: file.File): void {
    checkFd(fd);
    return fd.syncSync();
  }

  /**
   * Asynchronous fdatasync.
   * @param [BrowserFS.File] fd
   * @param [Function(BrowserFS.ApiError)] callback
   */
  public static fdatasync(fd: file.File, cb: Function = nopCb): void {
    var newCb = wrapCb(cb, 1);
    try {
      checkFd(fd);
      fd.datasync(newCb);
    } catch (e) {
      newCb(e);
    }
  }

  /**
   * Synchronous fdatasync.
   * @param [BrowserFS.File] fd
   */
  public static fdatasyncSync(fd: file.File): void {
    checkFd(fd);
    fd.datasyncSync();
  }

  /**
   * Write buffer to the file specified by `fd`.
   * Note that it is unsafe to use fs.write multiple times on the same file
   * without waiting for the callback.
   * @param [BrowserFS.File] fd
   * @param [BrowserFS.node.Buffer] buffer Buffer containing the data to write to
   *   the file.
   * @param [Number] offset Offset in the buffer to start reading data from.
   * @param [Number] length The amount of bytes to write to the file.
   * @param [Number] position Offset from the beginning of the file where this
   *   data should be written. If position is null, the data will be written at
   *   the current position.
   * @param [Function(BrowserFS.ApiError, Number, BrowserFS.node.Buffer)]
   *   callback The number specifies the number of bytes written into the file.
   */
  public static write(fd: file.File, buffer: NodeBuffer, offset: number, length: number, cb?: (err: api_error.ApiError, written?: number, buffer?: NodeBuffer) => any): void;
  public static write(fd: file.File, buffer: NodeBuffer, offset: number, length: number, position?: number, cb?: (err: api_error.ApiError, written?: number, buffer?: NodeBuffer) => any): void;
  public static write(fd: file.File, data: string, cb?: (err: api_error.ApiError, written?: number, buffer?: NodeBuffer) => any): void;
  public static write(fd: file.File, data: string, position: number, cb?: (err: api_error.ApiError, written?: number, buffer?: NodeBuffer) => any): void;
  public static write(fd: file.File, data: string, position: number, encoding: string, cb?: (err: api_error.ApiError, written?: number, buffer?: NodeBuffer) => any): void;
  public static write(fd: file.File, arg2: any, arg3?: any, arg4?: any, arg5?: any, cb: (err: api_error.ApiError, written?: number, buffer?: NodeBuffer) => any = nopCb): void {
    var buffer: NodeBuffer, offset: number, length: number, position: number = null;
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
          return cb(new ApiError(ErrorCode.EINVAL, 'Invalid arguments.'));
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

    var newCb = <(err: api_error.ApiError, written?: number, buffer?: NodeBuffer) => any> wrapCb(cb, 3);
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

  /**
   * Write buffer to the file specified by `fd`.
   * Note that it is unsafe to use fs.write multiple times on the same file
   * without waiting for it to return.
   * @param [BrowserFS.File] fd
   * @param [BrowserFS.node.Buffer] buffer Buffer containing the data to write to
   *   the file.
   * @param [Number] offset Offset in the buffer to start reading data from.
   * @param [Number] length The amount of bytes to write to the file.
   * @param [Number] position Offset from the beginning of the file where this
   *   data should be written. If position is null, the data will be written at
   *   the current position.
   * @return [Number]
   */
  public static writeSync(fd: file.File, buffer: NodeBuffer, offset: number, length: number, position?: number): void;
  public static writeSync(fd: file.File, data: string, position?: number, encoding?: string): void;
  public static writeSync(fd: file.File, arg2: any, arg3?: any, arg4?: any, arg5?: any): number {
    var buffer: NodeBuffer, offset: number = 0, length: number, position: number;
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

  /**
   * Read data from the file specified by `fd`.
   * @param [BrowserFS.File] fd
   * @param [BrowserFS.node.Buffer] buffer The buffer that the data will be
   *   written to.
   * @param [Number] offset The offset within the buffer where writing will
   *   start.
   * @param [Number] length An integer specifying the number of bytes to read.
   * @param [Number] position An integer specifying where to begin reading from
   *   in the file. If position is null, data will be read from the current file
   *   position.
   * @param [Function(BrowserFS.ApiError, Number, BrowserFS.node.Buffer)]
   *   callback The number is the number of bytes read
   */
  public static read(fd: file.File, length: number, position: number, encoding: string, cb?: (err: api_error.ApiError, data?: string, bytesRead?: number) => void): void;
  public static read(fd: file.File, buffer: NodeBuffer, offset: number, length: number, position: number, cb?: (err: api_error.ApiError, bytesRead?: number, buffer?: NodeBuffer) => void): void;
  public static read(fd: file.File, arg2: any, arg3: any, arg4: any, arg5?: any, cb: (err: api_error.ApiError, arg2?: any, arg3?: any) => void = nopCb): void {
    var position: number, offset: number, length: number, buffer: NodeBuffer, newCb: (err: api_error.ApiError, bytesRead?: number, buffer?: NodeBuffer) => void;
    if (typeof arg2 === 'number') {
      // legacy interface
      // (fd, length, position, encoding, callback)
      length = arg2;
      position = arg3;
      var encoding = arg4;
      cb = typeof arg5 === 'function' ? arg5 : cb;
      offset = 0;
      buffer = new Buffer(length);
      // XXX: Inefficient.
      // Wrap the cb so we shelter upper layers of the API from these
      // shenanigans.
      newCb = <(err: api_error.ApiError, bytesRead?: number, buffer?: NodeBuffer) => void> wrapCb((function(err, bytesRead, buf) {
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
      newCb = <(err: api_error.ApiError, bytesRead?: number, buffer?: NodeBuffer) => void> wrapCb(cb, 3);
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

  /**
   * Read data from the file specified by `fd`.
   * @param [BrowserFS.File] fd
   * @param [BrowserFS.node.Buffer] buffer The buffer that the data will be
   *   written to.
   * @param [Number] offset The offset within the buffer where writing will
   *   start.
   * @param [Number] length An integer specifying the number of bytes to read.
   * @param [Number] position An integer specifying where to begin reading from
   *   in the file. If position is null, data will be read from the current file
   *   position.
   * @return [Number]
   */
  public static readSync(fd: file.File, length: number, position: number, encoding: string): string;
  public static readSync(fd: file.File, buffer: NodeBuffer, offset: number, length: number, position: number): number;
  public static readSync(fd: file.File, arg2: any, arg3: any, arg4: any, arg5?: any): any {
    var shenanigans = false;
    var buffer: NodeBuffer, offset: number, length: number, position: number;
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

  /**
   * Asynchronous `fchown`.
   * @param [BrowserFS.File] fd
   * @param [Number] uid
   * @param [Number] gid
   * @param [Function(BrowserFS.ApiError)] callback
   */
  public static fchown(fd: file.File, uid: number, gid: number, callback: Function = nopCb): void {
    var newCb = wrapCb(callback, 1);
    try {
      checkFd(fd);
      fd.chown(uid, gid, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  /**
   * Synchronous `fchown`.
   * @param [BrowserFS.File] fd
   * @param [Number] uid
   * @param [Number] gid
   */
  public static fchownSync(fd: file.File, uid: number, gid: number): void {
    checkFd(fd);
    return fd.chownSync(uid, gid);
  }

  /**
   * Asynchronous `fchmod`.
   * @param [BrowserFS.File] fd
   * @param [Number] mode
   * @param [Function(BrowserFS.ApiError)] callback
   */
  public static fchmod(fd: file.File, mode: string, cb?: Function): void;
  public static fchmod(fd: file.File, mode: number, cb?: Function): void;
  public static fchmod(fd: file.File, mode: any, cb: Function = nopCb): void {
    var newCb = wrapCb(cb, 1);
    try {
      mode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
      checkFd(fd);
      fd.chmod(mode, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  /**
   * Synchronous `fchmod`.
   * @param [BrowserFS.File] fd
   * @param [Number] mode
   */
  public static fchmodSync(fd: file.File, mode: string): void;
  public static fchmodSync(fd: file.File, mode: number): void;
  public static fchmodSync(fd: file.File, mode: any): void {
    mode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
    checkFd(fd);
    return fd.chmodSync(mode);
  }

  /**
   * Change the file timestamps of a file referenced by the supplied file
   * descriptor.
   * @param [BrowserFS.File] fd
   * @param [Date] atime
   * @param [Date] mtime
   * @param [Function(BrowserFS.ApiError)] callback
   */
  public static futimes(fd: file.File, atime: number, mtime: number, cb: Function): void;
  public static futimes(fd: file.File, atime: Date, mtime: Date, cb: Function): void;
  public static futimes(fd: file.File, atime: any, mtime: any, cb: Function = nopCb): void {
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

  /**
   * Change the file timestamps of a file referenced by the supplied file
   * descriptor.
   * @param [BrowserFS.File] fd
   * @param [Date] atime
   * @param [Date] mtime
   */
  public static futimesSync(fd: file.File, atime: number, mtime: number): void;
  public static futimesSync(fd: file.File, atime: Date, mtime: Date): void;
  public static futimesSync(fd: file.File, atime: any, mtime: any): void {
    checkFd(fd);
    if (typeof atime === 'number') {
      atime = new Date(atime * 1000);
    }
    if (typeof mtime === 'number') {
      mtime = new Date(mtime * 1000);
    }
    return fd.utimesSync(atime, mtime);
  }

  // DIRECTORY-ONLY METHODS

  /**
   * Asynchronous `rmdir`.
   * @param [String] path
   * @param [Function(BrowserFS.ApiError)] callback
   */
  public static rmdir(path: string, cb: Function = nopCb): void {
    var newCb = wrapCb(cb, 1);
    try {
      path = normalizePath(path);
      fs.root.rmdir(path, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  /**
   * Synchronous `rmdir`.
   * @param [String] path
   */
  public static rmdirSync(path: string): void {
    path = normalizePath(path);
    return fs.root.rmdirSync(path);
  }

  /**
   * Asynchronous `mkdir`.
   * @param [String] path
   * @param [Number?] mode defaults to `0777`
   * @param [Function(BrowserFS.ApiError)] callback
   */
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

  /**
   * Synchronous `mkdir`.
   * @param [String] path
   * @param [Number?] mode defaults to `0777`
   */
  public static mkdirSync(path: string, mode?: string): void;
  public static mkdirSync(path: string, mode?: number): void;
  public static mkdirSync(path: string, mode: any = 0x1ff): void {
    mode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
    path = normalizePath(path);
    return fs.root.mkdirSync(path, mode);
  }

  /**
   * Asynchronous `readdir`. Reads the contents of a directory.
   * The callback gets two arguments `(err, files)` where `files` is an array of
   * the names of the files in the directory excluding `'.'` and `'..'`.
   * @param [String] path
   * @param [Function(BrowserFS.ApiError, String[])] callback
   */
  public static readdir(path: string, cb: (err: api_error.ApiError, files?: string[]) => void = nopCb): void {
    var newCb = <(err: api_error.ApiError, files?: string[]) => void> wrapCb(cb, 2);
    try {
      path = normalizePath(path);
      fs.root.readdir(path, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  /**
   * Synchronous `readdir`. Reads the contents of a directory.
   * @param [String] path
   * @return [String[]]
   */
  public static readdirSync(path: string): string[] {
    path = normalizePath(path);
    return fs.root.readdirSync(path);
  }

  // SYMLINK METHODS

  /**
   * Asynchronous `link`.
   * @param [String] srcpath
   * @param [String] dstpath
   * @param [Function(BrowserFS.ApiError)] callback
   */
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

  /**
   * Synchronous `link`.
   * @param [String] srcpath
   * @param [String] dstpath
   */
  public static linkSync(srcpath: string, dstpath: string): void {
    srcpath = normalizePath(srcpath);
    dstpath = normalizePath(dstpath);
    return fs.root.linkSync(srcpath, dstpath);
  }

  /**
   * Asynchronous `symlink`.
   * @param [String] srcpath
   * @param [String] dstpath
   * @param [String?] type can be either `'dir'` or `'file'` (default is `'file'`)
   * @param [Function(BrowserFS.ApiError)] callback
   */
  public static symlink(srcpath: string, dstpath: string, cb?: Function): void;
  public static symlink(srcpath: string, dstpath: string, type?: string, cb?: Function): void;
  public static symlink(srcpath: string, dstpath: string, arg3?: any, cb: Function = nopCb): void {
    var type = typeof arg3 === 'string' ? arg3 : 'file';
    cb = typeof arg3 === 'function' ? arg3 : cb;
    var newCb = wrapCb(cb, 1);
    try {
      if (type !== 'file' && type !== 'dir') {
        return newCb(new ApiError(ErrorCode.EINVAL, "Invalid type: " + type));
      }
      srcpath = normalizePath(srcpath);
      dstpath = normalizePath(dstpath);
      fs.root.symlink(srcpath, dstpath, type, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  /**
   * Synchronous `symlink`.
   * @param [String] srcpath
   * @param [String] dstpath
   * @param [String?] type can be either `'dir'` or `'file'` (default is `'file'`)
   */
  public static symlinkSync(srcpath: string, dstpath: string, type?: string): void {
    if (type == null) {
      type = 'file';
    } else if (type !== 'file' && type !== 'dir') {
      throw new ApiError(ErrorCode.EINVAL, "Invalid type: " + type);
    }
    srcpath = normalizePath(srcpath);
    dstpath = normalizePath(dstpath);
    return fs.root.symlinkSync(srcpath, dstpath, type);
  }

  /**
   * Asynchronous readlink.
   * @param [String] path
   * @param [Function(BrowserFS.ApiError, String)] callback
   */
  public static readlink(path: string, cb: (err: api_error.ApiError, linkString: string) => any = nopCb): void {
    var newCb = wrapCb(cb, 2);
    try {
      path = normalizePath(path);
      fs.root.readlink(path, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  /**
   * Synchronous readlink.
   * @param [String] path
   * @return [String]
   */
  public static readlinkSync(path: string): string {
    path = normalizePath(path);
    return fs.root.readlinkSync(path);
  }

  // PROPERTY OPERATIONS

  /**
   * Asynchronous `chown`.
   * @param [String] path
   * @param [Number] uid
   * @param [Number] gid
   * @param [Function(BrowserFS.ApiError)] callback
   */
  public static chown(path: string, uid: number, gid: number, cb: Function = nopCb): void {
    var newCb = wrapCb(cb, 1);
    try {
      path = normalizePath(path);
      fs.root.chown(path, false, uid, gid, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  /**
   * Synchronous `chown`.
   * @param [String] path
   * @param [Number] uid
   * @param [Number] gid
   */
  public static chownSync(path: string, uid: number, gid: number): void {
    path = normalizePath(path);
    fs.root.chownSync(path, false, uid, gid);
  }

  /**
   * Asynchronous `lchown`.
   * @param [String] path
   * @param [Number] uid
   * @param [Number] gid
   * @param [Function(BrowserFS.ApiError)] callback
   */
  public static lchown(path: string, uid: number, gid: number, cb: Function = nopCb): void {
    var newCb = wrapCb(cb, 1);
    try {
      path = normalizePath(path);
      fs.root.chown(path, true, uid, gid, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  /**
   * Synchronous `lchown`.
   * @param [String] path
   * @param [Number] uid
   * @param [Number] gid
   */
  public static lchownSync(path: string, uid: number, gid: number): void {
    path = normalizePath(path);
    return fs.root.chownSync(path, true, uid, gid);
  }

  /**
   * Asynchronous `chmod`.
   * @param [String] path
   * @param [Number] mode
   * @param [Function(BrowserFS.ApiError)] callback
   */
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

  /**
   * Synchronous `chmod`.
   * @param [String] path
   * @param [Number] mode
   */
  public static chmodSync(path: string, mode: string): void;
  public static chmodSync(path: string, mode: number): void;
  public static chmodSync(path: string, mode: any): void {
    mode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
    path = normalizePath(path);
    return fs.root.chmodSync(path, false, mode);
  }

  /**
   * Asynchronous `lchmod`.
   * @param [String] path
   * @param [Number] mode
   * @param [Function(BrowserFS.ApiError)] callback
   */
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

  /**
   * Synchronous `lchmod`.
   * @param [String] path
   * @param [Number] mode
   */
  public static lchmodSync(path: string, mode: number): void;
  public static lchmodSync(path: string, mode: string): void;
  public static lchmodSync(path: string, mode: any): void {
    path = normalizePath(path);
    mode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
    return fs.root.chmodSync(path, true, mode);
  }

  /**
   * Change file timestamps of the file referenced by the supplied path.
   * @param [String] path
   * @param [Date] atime
   * @param [Date] mtime
   * @param [Function(BrowserFS.ApiError)] callback
   */
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

  /**
   * Change file timestamps of the file referenced by the supplied path.
   * @param [String] path
   * @param [Date] atime
   * @param [Date] mtime
   */
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

  /**
   * Asynchronous `realpath`. The callback gets two arguments
   * `(err, resolvedPath)`. May use `process.cwd` to resolve relative paths.
   *
   * @example Usage example
   *   var cache = {'/etc':'/private/etc'};
   *   fs.realpath('/etc/passwd', cache, function (err, resolvedPath) {
   *     if (err) throw err;
   *     console.log(resolvedPath);
   *   });
   *
   * @param [String] path
   * @param [Object?] cache An object literal of mapped paths that can be used to
   *   force a specific path resolution or avoid additional `fs.stat` calls for
   *   known real paths.
   * @param [Function(BrowserFS.ApiError, String)] callback
   */
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

  /**
   * Synchronous `realpath`.
   * @param [String] path
   * @param [Object?] cache An object literal of mapped paths that can be used to
   *   force a specific path resolution or avoid additional `fs.stat` calls for
   *   known real paths.
   * @return [String]
   */
  public static realpathSync(path: string, cache: {[path: string]: string} = {}): string {
    path = normalizePath(path);
    return fs.root.realpathSync(path, cache);
  }
}
