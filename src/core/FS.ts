import {File} from './file';
import {ApiError, ErrorCode} from './api_error';
import {FileSystem} from './file_system';
import {FileFlag} from './file_flag';
import * as path from 'path';
import Stats from './node_fs_stats';

// Typing info only.
import * as _fs from 'fs';

/**
 * Wraps a callback function. Used for unit testing. Defaults to a NOP.
 */
let wrapCb = function<T extends Function>(cb: T, numArgs: number): T {
  return cb;
};

function normalizeMode(mode: number | string, def: number): number {
  switch (typeof mode) {
    case 'number':
      // (path, flag, mode, cb?)
      return <number> mode;
    case 'string':
      // (path, flag, modeString, cb?)
      let trueMode = parseInt(<string> mode, 8);
      if (!isNaN(trueMode)) {
        return trueMode;
      }
      // Invalid string.
      return def;
    default:
      return def;
  }
}

function normalizeTime(time: number | Date): Date {
  if (time instanceof Date) {
    return time;
  } else if (typeof time === 'number') {
    return new Date(time * 1000);
  } else {
    throw new ApiError(ErrorCode.EINVAL, `Invalid time.`);
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
function nopCb() {
  // NOP.
}

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
export default class FS {
  /* tslint:disable:variable-name */
  // Exported fs.Stats.
  public static Stats = Stats;
  /* tslint:enable:variable-name */

  public F_OK: number = 0;
  public R_OK: number = 4;
  public W_OK: number = 2;
  public X_OK: number = 1;

  private root: FileSystem = null;
  private fdMap: {[fd: number]: File} = {};
  private nextFd = 100;

  public initialize(rootFS: FileSystem): FileSystem {
    if (!(<any> rootFS).constructor.isAvailable()) {
      throw new ApiError(ErrorCode.EINVAL, 'Tried to instantiate BrowserFS with an unavailable file system.');
    }
    return this.root = rootFS;
  }

  /**
   * converts Date or number to a fractional UNIX timestamp
   * Grabbed from NodeJS sources (lib/fs.js)
   */
  public _toUnixTimestamp(time: Date | number): number {
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
  public getRootFS(): FileSystem {
    if (this.root) {
      return this.root;
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
  public rename(oldPath: string, newPath: string, cb: (err?: ApiError) => void = nopCb): void {
    let newCb = wrapCb(cb, 1);
    try {
      this.root.rename(normalizePath(oldPath), normalizePath(newPath), newCb);
    } catch (e) {
      newCb(e);
    }
  }

  /**
   * Synchronous rename.
   * @param [String] oldPath
   * @param [String] newPath
   */
  public renameSync(oldPath: string, newPath: string): void {
    this.root.renameSync(normalizePath(oldPath), normalizePath(newPath));
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
  public exists(path: string, cb: (exists: boolean) => void = nopCb): void {
    let newCb = wrapCb(cb, 1);
    try {
      return this.root.exists(normalizePath(path), newCb);
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
  public existsSync(path: string): boolean {
    try {
      return this.root.existsSync(normalizePath(path));
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
  public stat(path: string, cb: (err: ApiError, stats?: Stats) => any = nopCb): void {
    let newCb = wrapCb(cb, 2);
    try {
      return this.root.stat(normalizePath(path), false, newCb);
    } catch (e) {
      return newCb(e, null);
    }
  }

  /**
   * Synchronous `stat`.
   * @param [String] path
   * @return [BrowserFS.node.fs.Stats]
   */
  public statSync(path: string): Stats {
    return this.root.statSync(normalizePath(path), false);
  }

  /**
   * Asynchronous `lstat`.
   * `lstat()` is identical to `stat()`, except that if path is a symbolic link,
   * then the link itself is stat-ed, not the file that it refers to.
   * @param [String] path
   * @param [Function(BrowserFS.ApiError, BrowserFS.node.fs.Stats)] callback
   */
  public lstat(path: string, cb: (err: ApiError, stats?: Stats) => any = nopCb): void {
    let newCb = wrapCb(cb, 2);
    try {
      return this.root.stat(normalizePath(path), true, newCb);
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
  public lstatSync(path: string): Stats {
    return this.root.statSync(normalizePath(path), true);
  }

  // FILE-ONLY METHODS

  /**
   * Asynchronous `truncate`.
   * @param [String] path
   * @param [Number] len
   * @param [Function(BrowserFS.ApiError)] callback
   */
  public truncate(path: string, cb?: (err?: ApiError) => void): void;
  public truncate(path: string, len: number, cb?: (err?: ApiError) => void): void;
  public truncate(path: string, arg2: any = 0, cb: (err?: ApiError) => void = nopCb): void {
    let len = 0;
    if (typeof arg2 === 'function') {
      cb = arg2;
    } else if (typeof arg2 === 'number') {
      len = arg2;
    }

    let newCb = wrapCb(cb, 1);
    try {
      if (len < 0) {
        throw new ApiError(ErrorCode.EINVAL);
      }
      return this.root.truncate(normalizePath(path), len, newCb);
    } catch (e) {
      return newCb(e);
    }
  }

  /**
   * Synchronous `truncate`.
   * @param [String] path
   * @param [Number] len
   */
  public truncateSync(path: string, len: number = 0): void {
    if (len < 0) {
      throw new ApiError(ErrorCode.EINVAL);
    }
    return this.root.truncateSync(normalizePath(path), len);
  }

  /**
   * Asynchronous `unlink`.
   * @param [String] path
   * @param [Function(BrowserFS.ApiError)] callback
   */
  public unlink(path: string, cb: (err?: ApiError) => void = nopCb): void {
    let newCb = wrapCb(cb, 1);
    try {
      return this.root.unlink(normalizePath(path), newCb);
    } catch (e) {
      return newCb(e);
    }
  }

  /**
   * Synchronous `unlink`.
   * @param [String] path
   */
  public unlinkSync(path: string): void {
    return this.root.unlinkSync(normalizePath(path));
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
  public open(path: string, flag: string, cb?: (err: ApiError, fd?: number) => any): void;
  public open(path: string, flag: string, mode: number|string, cb?: (err: ApiError, fd?: number) => any): void;
  public open(path: string, flag: string, arg2?: any, cb: (err: ApiError, fd?: number) => any = nopCb): void {
    let mode = normalizeMode(arg2, 0x1a4);
    cb = typeof arg2 === 'function' ? arg2 : cb;
    let newCb = wrapCb(cb, 2);
    try {
      this.root.open(normalizePath(path), FileFlag.getFileFlag(flag), mode, (e: ApiError, file?: File) => {
        if (file) {
          newCb(e, this.getFdForFile(file));
        } else {
          newCb(e);
        }
      });
    } catch (e) {
      newCb(e, null);
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
  public openSync(path: string, flag: string, mode: number|string = 0x1a4): number {
    return this.getFdForFile(
      this.root.openSync(normalizePath(path), FileFlag.getFileFlag(flag), normalizeMode(mode, 0x1a4)));
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
  public readFile(filename: string, cb: (err: ApiError, data?: Buffer) => void ): void;
  public readFile(filename: string, options: { flag?: string; }, callback: (err: ApiError, data: Buffer) => void): void;
  public readFile(filename: string, options: { encoding: string; flag?: string; }, callback: (err: ApiError, data: string) => void): void;
  public readFile(filename: string, encoding: string, cb?: (err: ApiError, data?: string) => void ): void;
  public readFile(filename: string, arg2: any = {}, cb: (err: ApiError, data?: any) => void = nopCb ) {
    let options = normalizeOptions(arg2, null, 'r', null);
    cb = typeof arg2 === 'function' ? arg2 : cb;
    let newCb = wrapCb(cb, 2);
    try {
      let flag = FileFlag.getFileFlag(options['flag']);
      if (!flag.isReadable()) {
        return newCb(new ApiError(ErrorCode.EINVAL, 'Flag passed to readFile must allow for reading.'));
      }
      return this.root.readFile(normalizePath(filename), options.encoding, flag, newCb);
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
  public readFileSync(filename: string, options?: { flag?: string; }): Buffer;
  public readFileSync(filename: string, options: { encoding: string; flag?: string; }): string;
  public readFileSync(filename: string, encoding: string): string;
  public readFileSync(filename: string, arg2: any = {}): any {
    let options = normalizeOptions(arg2, null, 'r', null);
    let flag = FileFlag.getFileFlag(options.flag);
    if (!flag.isReadable()) {
      throw new ApiError(ErrorCode.EINVAL, 'Flag passed to readFile must allow for reading.');
    }
    return this.root.readFileSync(normalizePath(filename), options.encoding, flag);
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
  public writeFile(filename: string, data: any, cb?: (err?: ApiError) => void): void;
  public writeFile(filename: string, data: any, encoding?: string, cb?: (err?: ApiError) => void): void;
  public writeFile(filename: string, data: any, options?: { encoding?: string; mode?: string | number; flag?: string; }, cb?: (err?: ApiError) => void): void;
  public writeFile(filename: string, data: any, arg3: any = {}, cb: (err?: ApiError) => void = nopCb): void {
    let options = normalizeOptions(arg3, 'utf8', 'w', 0x1a4);
    cb = typeof arg3 === 'function' ? arg3 : cb;
    let newCb = wrapCb(cb, 1);
    try {
      let flag = FileFlag.getFileFlag(options.flag);
      if (!flag.isWriteable()) {
        return newCb(new ApiError(ErrorCode.EINVAL, 'Flag passed to writeFile must allow for writing.'));
      }
      return this.root.writeFile(normalizePath(filename), data, options.encoding, flag, options.mode, newCb);
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
  public writeFileSync(filename: string, data: any, options?: { encoding?: string; mode?: number | string; flag?: string; }): void;
  public writeFileSync(filename: string, data: any, encoding?: string): void;
  public writeFileSync(filename: string, data: any, arg3?: any): void {
    let options = normalizeOptions(arg3, 'utf8', 'w', 0x1a4);
    let flag = FileFlag.getFileFlag(options.flag);
    if (!flag.isWriteable()) {
      throw new ApiError(ErrorCode.EINVAL, 'Flag passed to writeFile must allow for writing.');
    }
    return this.root.writeFileSync(normalizePath(filename), data, options.encoding, flag, options.mode);
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
  public appendFile(filename: string, data: any, cb?: (err: ApiError) => void): void;
  public appendFile(filename: string, data: any, options?: { encoding?: string; mode?: number|string; flag?: string; }, cb?: (err: ApiError) => void): void;
  public appendFile(filename: string, data: any, encoding?: string, cb?: (err: ApiError) => void): void;
  public appendFile(filename: string, data: any, arg3?: any, cb: (err: ApiError) => void = nopCb): void {
    let options = normalizeOptions(arg3, 'utf8', 'a', 0x1a4);
    cb = typeof arg3 === 'function' ? arg3 : cb;
    let newCb = wrapCb(cb, 1);
    try {
      let flag = FileFlag.getFileFlag(options.flag);
      if (!flag.isAppendable()) {
        return newCb(new ApiError(ErrorCode.EINVAL, 'Flag passed to appendFile must allow for appending.'));
      }
      this.root.appendFile(normalizePath(filename), data, options.encoding, flag, options.mode, newCb);
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
  public appendFileSync(filename: string, data: any, options?: { encoding?: string; mode?: number | string; flag?: string; }): void;
  public appendFileSync(filename: string, data: any, encoding?: string): void;
  public appendFileSync(filename: string, data: any, arg3?: any): void {
    let options = normalizeOptions(arg3, 'utf8', 'a', 0x1a4);
    let flag = FileFlag.getFileFlag(options.flag);
    if (!flag.isAppendable()) {
      throw new ApiError(ErrorCode.EINVAL, 'Flag passed to appendFile must allow for appending.');
    }
    return this.root.appendFileSync(normalizePath(filename), data, options.encoding, flag, options.mode);
  }

  // FILE DESCRIPTOR METHODS

  /**
   * Asynchronous `fstat`.
   * `fstat()` is identical to `stat()`, except that the file to be stat-ed is
   * specified by the file descriptor `fd`.
   * @param [BrowserFS.File] fd
   * @param [Function(BrowserFS.ApiError, BrowserFS.node.fs.Stats)] callback
   */
  public fstat(fd: number, cb: (err: ApiError, stats?: Stats) => any = nopCb): void {
    let newCb = wrapCb(cb, 2);
    try {
      let file = this.fd2file(fd);
      file.stat(newCb);
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
  public fstatSync(fd: number): Stats {
    return this.fd2file(fd).statSync();
  }

  /**
   * Asynchronous close.
   * @param [BrowserFS.File] fd
   * @param [Function(BrowserFS.ApiError)] callback
   */
  public close(fd: number, cb: (e?: ApiError) => void = nopCb): void {
    let newCb = wrapCb(cb, 1);
    try {
      this.fd2file(fd).close((e: ApiError) => {
        if (!e) {
          this.closeFd(fd);
        }
        newCb(e);
      });
    } catch (e) {
      newCb(e);
    }
  }

  /**
   * Synchronous close.
   * @param [BrowserFS.File] fd
   */
  public closeSync(fd: number): void {
    this.fd2file(fd).closeSync();
    this.closeFd(fd);
  }

  /**
   * Asynchronous ftruncate.
   * @param [BrowserFS.File] fd
   * @param [Number] len
   * @param [Function(BrowserFS.ApiError)] callback
   */
  public ftruncate(fd: number, cb?: (err?: ApiError) => void): void;
  public ftruncate(fd: number, len?: number, cb?: (err?: ApiError) => void): void;
  public ftruncate(fd: number, arg2?: any, cb: (err?: ApiError) => void = nopCb): void {
    let length = typeof arg2 === 'number' ? arg2 : 0;
    cb = typeof arg2 === 'function' ? arg2 : cb;
    let newCb = wrapCb(cb, 1);
    try {
      let file = this.fd2file(fd);
      if (length < 0) {
        throw new ApiError(ErrorCode.EINVAL);
      }
      file.truncate(length, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  /**
   * Synchronous ftruncate.
   * @param [BrowserFS.File] fd
   * @param [Number] len
   */
  public ftruncateSync(fd: number, len: number = 0): void {
    let file = this.fd2file(fd);
    if (len < 0) {
      throw new ApiError(ErrorCode.EINVAL);
    }
    file.truncateSync(len);
  }

  /**
   * Asynchronous fsync.
   * @param [BrowserFS.File] fd
   * @param [Function(BrowserFS.ApiError)] callback
   */
  public fsync(fd: number, cb: (err?: ApiError) => void = nopCb): void {
    let newCb = wrapCb(cb, 1);
    try {
      this.fd2file(fd).sync(newCb);
    } catch (e) {
      newCb(e);
    }
  }

  /**
   * Synchronous fsync.
   * @param [BrowserFS.File] fd
   */
  public fsyncSync(fd: number): void {
    this.fd2file(fd).syncSync();
  }

  /**
   * Asynchronous fdatasync.
   * @param [BrowserFS.File] fd
   * @param [Function(BrowserFS.ApiError)] callback
   */
  public fdatasync(fd: number, cb: (err?: ApiError) => void = nopCb): void {
    let newCb = wrapCb(cb, 1);
    try {
      this.fd2file(fd).datasync(newCb);
    } catch (e) {
      newCb(e);
    }
  }

  /**
   * Synchronous fdatasync.
   * @param [BrowserFS.File] fd
   */
  public fdatasyncSync(fd: number): void {
    this.fd2file(fd).datasyncSync();
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
  public write(fd: number, buffer: Buffer, offset: number, length: number, cb?: (err: ApiError, written: number, buffer: Buffer) => void): void;
  public write(fd: number, buffer: Buffer, offset: number, length: number, position: number, cb?: (err: ApiError, written: number, buffer: Buffer) => void): void;
  public write(fd: number, data: any, cb?: (err: ApiError, written: number, str: string) => any): void;
  public write(fd: number, data: any, position: number, cb?: (err: ApiError, written: number, str: string) => any): void;
  public write(fd: number, data: any, position: number, encoding: string, cb?: (err: ApiError, written: number, str: string) => void): void;
  public write(fd: number, arg2: any, arg3?: any, arg4?: any, arg5?: any, cb: (err: ApiError, written?: number, buffer?: Buffer) => void = nopCb): void {
    let buffer: Buffer, offset: number, length: number, position: number = null;
    if (typeof arg2 === 'string') {
      // Signature 1: (fd, string, [position?, [encoding?]], cb?)
      let encoding = 'utf8';
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

    let newCb = wrapCb(cb, 3);
    try {
      let file = this.fd2file(fd);
      if (position === undefined || position === null) {
        position = file.getPos();
      }
      file.write(buffer, offset, length, position, newCb);
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
  public writeSync(fd: number, buffer: Buffer, offset: number, length: number, position?: number): number;
  public writeSync(fd: number, data: string, position?: number, encoding?: string): number;
  public writeSync(fd: number, arg2: any, arg3?: any, arg4?: any, arg5?: any): number {
    let buffer: Buffer, offset: number = 0, length: number, position: number;
    if (typeof arg2 === 'string') {
      // Signature 1: (fd, string, [position?, [encoding?]])
      position = typeof arg3 === 'number' ? arg3 : null;
      let encoding = typeof arg4 === 'string' ? arg4 : 'utf8';
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

    let file = this.fd2file(fd);
    if (position === undefined || position === null) {
      position = file.getPos();
    }
    return file.writeSync(buffer, offset, length, position);
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
  public read(fd: number, length: number, position: number, encoding: string, cb?: (err: ApiError, data?: string, bytesRead?: number) => void): void;
  public read(fd: number, buffer: Buffer, offset: number, length: number, position: number, cb?: (err: ApiError, bytesRead?: number, buffer?: Buffer) => void): void;
  public read(fd: number, arg2: any, arg3: any, arg4: any, arg5?: any, cb: (err: ApiError, arg2?: any, arg3?: any) => void = nopCb): void {
    let position: number, offset: number, length: number, buffer: Buffer, newCb: (err: ApiError, bytesRead?: number, buffer?: Buffer) => void;
    if (typeof arg2 === 'number') {
      // legacy interface
      // (fd, length, position, encoding, callback)
      length = arg2;
      position = arg3;
      let encoding = arg4;
      cb = typeof arg5 === 'function' ? arg5 : cb;
      offset = 0;
      buffer = new Buffer(length);
      // XXX: Inefficient.
      // Wrap the cb so we shelter upper layers of the API from these
      // shenanigans.
      newCb = wrapCb((function(err: any, bytesRead: number, buf: Buffer) {
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
      newCb = wrapCb(cb, 3);
    }

    try {
      let file = this.fd2file(fd);
      if (position === undefined || position === null) {
        position = file.getPos();
      }
      file.read(buffer, offset, length, position, newCb);
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
  public readSync(fd: number, length: number, position: number, encoding: string): string;
  public readSync(fd: number, buffer: Buffer, offset: number, length: number, position: number): number;
  public readSync(fd: number, arg2: any, arg3: any, arg4: any, arg5?: any): any {
    let shenanigans = false;
    let buffer: Buffer, offset: number, length: number, position: number, encoding: string;
    if (typeof arg2 === 'number') {
      length = arg2;
      position = arg3;
      encoding = arg4;
      offset = 0;
      buffer = new Buffer(length);
      shenanigans = true;
    } else {
      buffer = arg2;
      offset = arg3;
      length = arg4;
      position = arg5;
    }
    let file = this.fd2file(fd);
    if (position === undefined || position === null) {
      position = file.getPos();
    }

    let rv = file.readSync(buffer, offset, length, position);
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
  public fchown(fd: number, uid: number, gid: number, callback: (e?: ApiError) => void = nopCb): void {
    let newCb = wrapCb(callback, 1);
    try {
      this.fd2file(fd).chown(uid, gid, newCb);
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
  public fchownSync(fd: number, uid: number, gid: number): void {
    this.fd2file(fd).chownSync(uid, gid);
  }

  /**
   * Asynchronous `fchmod`.
   * @param [BrowserFS.File] fd
   * @param [Number] mode
   * @param [Function(BrowserFS.ApiError)] callback
   */
  public fchmod(fd: number, mode: string | number, cb?: (e?: ApiError) => void): void {
    let newCb = wrapCb(cb, 1);
    try {
      let numMode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
      this.fd2file(fd).chmod(numMode, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  /**
   * Synchronous `fchmod`.
   * @param [BrowserFS.File] fd
   * @param [Number] mode
   */
  public fchmodSync(fd: number, mode: number | string): void {
    let numMode = typeof mode === 'string' ? parseInt(mode, 8) : mode;
    this.fd2file(fd).chmodSync(numMode);
  }

  /**
   * Change the file timestamps of a file referenced by the supplied file
   * descriptor.
   * @param [BrowserFS.File] fd
   * @param [Date] atime
   * @param [Date] mtime
   * @param [Function(BrowserFS.ApiError)] callback
   */
  public futimes(fd: number, atime: number | Date, mtime: number | Date, cb: (e?: ApiError) => void = nopCb): void {
    let newCb = wrapCb(cb, 1);
    try {
      let file = this.fd2file(fd);
      if (typeof atime === 'number') {
        atime = new Date(atime * 1000);
      }
      if (typeof mtime === 'number') {
        mtime = new Date(mtime * 1000);
      }
      file.utimes(atime, mtime, newCb);
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
  public futimesSync(fd: number, atime: number | Date, mtime: number | Date): void {
    this.fd2file(fd).utimesSync(normalizeTime(atime), normalizeTime(mtime));
  }

  // DIRECTORY-ONLY METHODS

  /**
   * Asynchronous `rmdir`.
   * @param [String] path
   * @param [Function(BrowserFS.ApiError)] callback
   */
  public rmdir(path: string, cb: (e?: ApiError) => void = nopCb): void {
    let newCb = wrapCb(cb, 1);
    try {
      path = normalizePath(path);
      this.root.rmdir(path, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  /**
   * Synchronous `rmdir`.
   * @param [String] path
   */
  public rmdirSync(path: string): void {
    path = normalizePath(path);
    return this.root.rmdirSync(path);
  }

  /**
   * Asynchronous `mkdir`.
   * @param [String] path
   * @param [Number?] mode defaults to `0777`
   * @param [Function(BrowserFS.ApiError)] callback
   */
  public mkdir(path: string, mode?: any, cb: (e?: ApiError) => void = nopCb): void {
    if (typeof mode === 'function') {
      cb = mode;
      mode = 0x1ff;
    }
    let newCb = wrapCb(cb, 1);
    try {
      path = normalizePath(path);
      this.root.mkdir(path, mode, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  /**
   * Synchronous `mkdir`.
   * @param [String] path
   * @param [Number?] mode defaults to `0777`
   */
  public mkdirSync(path: string, mode?: number | string): void {
    this.root.mkdirSync(normalizePath(path), normalizeMode(mode, 0x1ff));
  }

  /**
   * Asynchronous `readdir`. Reads the contents of a directory.
   * The callback gets two arguments `(err, files)` where `files` is an array of
   * the names of the files in the directory excluding `'.'` and `'..'`.
   * @param [String] path
   * @param [Function(BrowserFS.ApiError, String[])] callback
   */
  public readdir(path: string, cb: (err: ApiError, files?: string[]) => void = nopCb): void {
    let newCb = <(err: ApiError, files?: string[]) => void> wrapCb(cb, 2);
    try {
      path = normalizePath(path);
      this.root.readdir(path, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  /**
   * Synchronous `readdir`. Reads the contents of a directory.
   * @param [String] path
   * @return [String[]]
   */
  public readdirSync(path: string): string[] {
    path = normalizePath(path);
    return this.root.readdirSync(path);
  }

  // SYMLINK METHODS

  /**
   * Asynchronous `link`.
   * @param [String] srcpath
   * @param [String] dstpath
   * @param [Function(BrowserFS.ApiError)] callback
   */
  public link(srcpath: string, dstpath: string, cb: (e?: ApiError) => void = nopCb): void {
    let newCb = wrapCb(cb, 1);
    try {
      srcpath = normalizePath(srcpath);
      dstpath = normalizePath(dstpath);
      this.root.link(srcpath, dstpath, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  /**
   * Synchronous `link`.
   * @param [String] srcpath
   * @param [String] dstpath
   */
  public linkSync(srcpath: string, dstpath: string): void {
    srcpath = normalizePath(srcpath);
    dstpath = normalizePath(dstpath);
    return this.root.linkSync(srcpath, dstpath);
  }

  /**
   * Asynchronous `symlink`.
   * @param [String] srcpath
   * @param [String] dstpath
   * @param [String?] type can be either `'dir'` or `'file'` (default is `'file'`)
   * @param [Function(BrowserFS.ApiError)] callback
   */
  public symlink(srcpath: string, dstpath: string, cb?: (e?: ApiError) => void): void;
  public symlink(srcpath: string, dstpath: string, type?: string, cb?: (e?: ApiError) => void): void;
  public symlink(srcpath: string, dstpath: string, arg3?: any, cb: (e?: ApiError) => void = nopCb): void {
    let type = typeof arg3 === 'string' ? arg3 : 'file';
    cb = typeof arg3 === 'function' ? arg3 : cb;
    let newCb = wrapCb(cb, 1);
    try {
      if (type !== 'file' && type !== 'dir') {
        return newCb(new ApiError(ErrorCode.EINVAL, "Invalid type: " + type));
      }
      srcpath = normalizePath(srcpath);
      dstpath = normalizePath(dstpath);
      this.root.symlink(srcpath, dstpath, type, newCb);
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
  public symlinkSync(srcpath: string, dstpath: string, type?: string): void {
    if (!type) {
      type = 'file';
    } else if (type !== 'file' && type !== 'dir') {
      throw new ApiError(ErrorCode.EINVAL, "Invalid type: " + type);
    }
    srcpath = normalizePath(srcpath);
    dstpath = normalizePath(dstpath);
    return this.root.symlinkSync(srcpath, dstpath, type);
  }

  /**
   * Asynchronous readlink.
   * @param [String] path
   * @param [Function(BrowserFS.ApiError, String)] callback
   */
  public readlink(path: string, cb: (err: ApiError, linkString?: string) => any = nopCb): void {
    let newCb = wrapCb(cb, 2);
    try {
      path = normalizePath(path);
      this.root.readlink(path, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  /**
   * Synchronous readlink.
   * @param [String] path
   * @return [String]
   */
  public readlinkSync(path: string): string {
    path = normalizePath(path);
    return this.root.readlinkSync(path);
  }

  // PROPERTY OPERATIONS

  /**
   * Asynchronous `chown`.
   * @param [String] path
   * @param [Number] uid
   * @param [Number] gid
   * @param [Function(BrowserFS.ApiError)] callback
   */
  public chown(path: string, uid: number, gid: number, cb: (e?: ApiError) => void = nopCb): void {
    let newCb = wrapCb(cb, 1);
    try {
      path = normalizePath(path);
      this.root.chown(path, false, uid, gid, newCb);
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
  public chownSync(path: string, uid: number, gid: number): void {
    path = normalizePath(path);
    this.root.chownSync(path, false, uid, gid);
  }

  /**
   * Asynchronous `lchown`.
   * @param [String] path
   * @param [Number] uid
   * @param [Number] gid
   * @param [Function(BrowserFS.ApiError)] callback
   */
  public lchown(path: string, uid: number, gid: number, cb: (e?: ApiError) => void = nopCb): void {
    let newCb = wrapCb(cb, 1);
    try {
      path = normalizePath(path);
      this.root.chown(path, true, uid, gid, newCb);
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
  public lchownSync(path: string, uid: number, gid: number): void {
    path = normalizePath(path);
    this.root.chownSync(path, true, uid, gid);
  }

  /**
   * Asynchronous `chmod`.
   * @param [String] path
   * @param [Number] mode
   * @param [Function(BrowserFS.ApiError)] callback
   */
  public chmod(path: string, mode: number | string, cb: (e?: ApiError) => void = nopCb): void {
    let newCb = wrapCb(cb, 1);
    try {
      let numMode = normalizeMode(mode, -1);
      if (numMode < 0) {
        throw new ApiError(ErrorCode.EINVAL, `Invalid mode.`);
      }
      this.root.chmod(normalizePath(path), false, numMode, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  /**
   * Synchronous `chmod`.
   * @param [String] path
   * @param [Number] mode
   */
  public chmodSync(path: string, mode: string|number): void {
    let numMode = normalizeMode(mode, -1);
    if (numMode < 0) {
      throw new ApiError(ErrorCode.EINVAL, `Invalid mode.`);
    }
    path = normalizePath(path);
    this.root.chmodSync(path, false, numMode);
  }

  /**
   * Asynchronous `lchmod`.
   * @param [String] path
   * @param [Number] mode
   * @param [Function(BrowserFS.ApiError)] callback
   */
  public lchmod(path: string, mode: number|string, cb: (e?: ApiError) => void = nopCb): void {
    let newCb = wrapCb(cb, 1);
    try {
      let numMode = normalizeMode(mode, -1);
      if (numMode < 0) {
        throw new ApiError(ErrorCode.EINVAL, `Invalid mode.`);
      }
      this.root.chmod(normalizePath(path), true, numMode, newCb);
    } catch (e) {
      newCb(e);
    }
  }

  /**
   * Synchronous `lchmod`.
   * @param [String] path
   * @param [Number] mode
   */
  public lchmodSync(path: string, mode: number|string): void {
    let numMode = normalizeMode(mode, -1);
    if (numMode < 1) {
      throw new ApiError(ErrorCode.EINVAL, `Invalid mode.`);
    }
    this.root.chmodSync(normalizePath(path), true, numMode);
  }

  /**
   * Change file timestamps of the file referenced by the supplied path.
   * @param [String] path
   * @param [Date] atime
   * @param [Date] mtime
   * @param [Function(BrowserFS.ApiError)] callback
   */
  public utimes(path: string, atime: number|Date, mtime: number|Date, cb: (e?: ApiError) => void = nopCb): void {
    let newCb = wrapCb(cb, 1);
    try {
      this.root.utimes(normalizePath(path), normalizeTime(atime), normalizeTime(mtime), newCb);
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
  public utimesSync(path: string, atime: number|Date, mtime: number|Date): void {
    this.root.utimesSync(normalizePath(path), normalizeTime(atime), normalizeTime(mtime));
  }

  /**
   * Asynchronous `realpath`. The callback gets two arguments
   * `(err, resolvedPath)`. May use `process.cwd` to resolve relative paths.
   *
   * @example Usage example
   *   let cache = {'/etc':'/private/etc'};
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
  public realpath(path: string, cb?: (err: ApiError, resolvedPath?: string) => any): void;
  public realpath(path: string, cache: {[path: string]: string}, cb: (err: ApiError, resolvedPath?: string) => any): void;
  public realpath(path: string, arg2?: any, cb: (err: ApiError, resolvedPath?: string) => any = nopCb): void {
    let cache = typeof(arg2) === 'object' ? arg2 : {};
    cb = typeof(arg2) === 'function' ? arg2 : nopCb;
    let newCb = <(err: ApiError, resolvedPath?: string) => any> wrapCb(cb, 2);
    try {
      path = normalizePath(path);
      this.root.realpath(path, cache, newCb);
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
  public realpathSync(path: string, cache: {[path: string]: string} = {}): string {
    path = normalizePath(path);
    return this.root.realpathSync(path, cache);
  }

  public watchFile(filename: string, listener: (curr: Stats, prev: Stats) => void): void;
  public watchFile(filename: string, options: { persistent?: boolean; interval?: number; }, listener: (curr: Stats, prev: Stats) => void): void;
  public watchFile(filename: string, arg2: any, listener: (curr: Stats, prev: Stats) => void = nopCb): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }

  public unwatchFile(filename: string, listener: (curr: Stats, prev: Stats) => void = nopCb): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }

  public watch(filename: string, listener?: (event: string, filename: string) => any): _fs.FSWatcher;
  public watch(filename: string, options: { persistent?: boolean; }, listener?: (event: string, filename: string) => any): _fs.FSWatcher;
  public watch(filename: string, arg2: any, listener: (event: string, filename: string) => any = nopCb): _fs.FSWatcher {
    throw new ApiError(ErrorCode.ENOTSUP);
  }

  public access(path: string, callback: (err: ApiError) => void): void;
  public access(path: string, mode: number, callback: (err: ApiError) => void): void;
  public access(path: string, arg2: any, cb: (e: ApiError) => void = nopCb): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }

  public accessSync(path: string, mode?: number): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }

  public createReadStream(path: string, options?: {
        flags?: string;
        encoding?: string;
        fd?: number;
        mode?: number;
        autoClose?: boolean;
    }): _fs.ReadStream {
    throw new ApiError(ErrorCode.ENOTSUP);
  }

  public createWriteStream(path: string, options?: {
        flags?: string;
        encoding?: string;
        fd?: number;
        mode?: number;
    }): _fs.WriteStream {
    throw new ApiError(ErrorCode.ENOTSUP);
  }

  /**
   * For unit testing. Passes all incoming callbacks to cbWrapper for wrapping.
   */
  public wrapCallbacks(cbWrapper: (cb: Function, args: number) => Function) {
    wrapCb = cbWrapper;
  }

  private getFdForFile(file: File): number {
    let fd = this.nextFd++;
    this.fdMap[fd] = file;
    return fd;
  }
  private fd2file(fd: number): File {
    let rv = this.fdMap[fd];
    if (rv) {
      return rv;
    } else {
      throw new ApiError(ErrorCode.EBADF, 'Invalid file descriptor.');
    }
  }
  private closeFd(fd: number): void {
    delete this.fdMap[fd];
  }
}

export interface FSModule extends FS {
  /**
   * The FS constructor.
   */
  FS: typeof FS;
  /**
   * Retrieve the FS object backing the fs module.
   */
  getFSModule(): FS;
  /**
   * Set the FS object backing the fs module.
   */
  changeFSModule(newFs: FS): void;
}
