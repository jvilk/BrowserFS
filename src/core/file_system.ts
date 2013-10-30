/**
 * @module core/file_system
 */
import api_error = require('./api_error');
import stat = require('./node_fs_stats');

import file = require('./file');
import file_flag = require('./file_flag');

import node_path = require('./node_path');
import node_fs = require('./node_fs');

import buffer = require('./buffer');

var ApiError = api_error.ApiError;
var ErrorType = api_error.ErrorType;
var path = node_path.path;
var fs = node_fs.fs;
var Buffer = buffer.Buffer;

/**
 * Class for a filesystem. Provides some default functionality.
 *
 * The base FileSystem class. **All** BrowserFS FileSystems should extend this
 * class.
 *
 * Below, we denote each API method as **Core**, **Supplemental**, or
 * **Optional**.
 *
 * ### Core Methods
 *
 * **Core** API methods *need* to be implemented for basic read/write
 * functionality.
 *
 * Note that read-only FileSystems can choose to not implement core methods
 * that mutate files or metadata. The default implementation will pass a
 * NOT_SUPPORTED error to the callback.
 *
 * ### Supplemental Methods
 *
 * **Supplemental** API methods do not need to be implemented by a filesystem.
 * The default implementation implements all of the supplemental API methods in
 * terms of the **core** API methods.
 *
 * Note that a file system may choose to implement supplemental methods for
 * efficiency reasons.
 *
 * The code for some supplemental methods was adapted directly from NodeJS's
 * fs.js source code.
 *
 * ### Optional Methods
 *
 * **Optional** API methods provide functionality that may not be available in
 * all filesystems. For example, all symlink/hardlink-related API methods fall
 * under this category.
 *
 * The default implementation will pass a NOT_SUPPORTED error to the callback.
 *
 * ### Argument Assumptions
 *
 * You can assume the following about arguments passed to each API method:
 *
 * * **Every path is an absolute path.** Meaning, `.`, `..`, and other items
 *   are resolved into an absolute form.
 * * **All arguments are present.** Any optional arguments at the Node API level
 *   have been passed in with their default values.
 * * **The callback will reset the stack depth.** When your filesystem calls the
 *   callback with the requested information, it will use `setImmediate` to
 *   reset the JavaScript stack depth before calling the user-supplied callback.
 * @class FileSystem
 */
export class FileSystem {
  // Callback Types

  /**
   * @callback FileSystem~diskSpaceCallback
   * @param {number} totalSpace
   * @param {number} freeSpace
   */
  /**
   * @callback FileSystem~nodeCallback
   * @param {api_error.ApiError} [error]
   */
  /**
   * @callback FileSystem~nodeStatsCallback
   * @param {api_error.ApiError} error
   * @param {node_fs_stats.Stats} [stats]
   */
  /**
   * @callback FileSystem~fileCallback
   * @param {api_error.ApiError} error
   * @param {file.File} [file]
   */
  /**
   * @callback FileSystem~readdirCallback
   * @param {api_error.ApiError} error
   * @param {string[]} [dirContents]
   */
  /**
   * @callback FileSystem~existsCallback
   * @param {boolean} doesExist
   */
  /**
   * @callback FileSystem~pathCallback
   * @param {api_error.ApiError} error
   * @param {string} [path]
   */
  /**
   * @callback FileSystem~readCallback
   * @param {api_error.ApiError} error
   * @param {(buffer.Buffer | string)} [data]
   */


  // Global information methods

  /**
   * **Optional**: Returns the name of the file system.
   * @method FileSystem#getName
   * @return {string}
   */
  public getName(): string {
    return 'Unspecified';
  }

  /**
   * **Core**: Returns 'true' if this filesystem is available in the current
   * environment. For example, a `localStorage`-backed filesystem will return
   * 'false' if the browser does not support that API.
   *
   * Defaults to 'false', as the FileSystem base class isn't usable alone.
   * @method FileSystem.isAvailable
   * @return {boolean}
   */
  public static isAvailable(): boolean {
    return false;
  }

  /**
   * **Optional**: Passes the following information to the callback:
   *
   * * Total number of bytes available on this file system.
   * * number of free bytes available on this file system.
   *
   * @method FileSystem#diskSpace
   * @todo This info is not available through the Node API. Perhaps we could do a
   *   polyfill of diskspace.js, or add a new Node API function.
   * @param {string} path The path to the location that is being queried. Only
   *   useful for filesystems that support mount points.
   * @param {FileSystem~diskSpaceCallback} cb
   */
  public diskSpace(p: string, cb: (total: number, free: number) => any): void {
    cb(0, 0);
  }

  /**
   * **Core**: Is this filesystem read-only?
   * @method FileSystem#isReadOnly
   * @return {boolean} True if this FileSystem is inherently read-only.
   */
  public isReadOnly(): boolean {
    return true;
  }

  /**
   * **Core**: Does the filesystem support optional symlink/hardlink-related
   *   commands?
   * @method FileSystem#supportsLinks
   * @return {boolean} True if the FileSystem supports the optional
   *   symlink/hardlink-related commands.
   */
  public supportsLinks(): boolean {
    return false;
  }

  /**
   * **Core**: Does the filesystem support optional property-related commands?
   * @method FileSystem#supportsProps
   * @return {boolean} True if the FileSystem supports the optional
   *   property-related commands (permissions, utimes, etc).
   */
  public supportsProps(): boolean {
    return false;
  }

  /**
   * **Core**: Does the filesystem support the optional synchronous interface?
   * @method FileSystem#supportsSynch
   * @return {boolean} True if the FileSystem supports synchronous operations.
   */
  public supportsSynch(): boolean {
    return false;
  }

  // **CORE API METHODS**

  // File or directory operations

  /**
   * **Core**: Asynchronous rename. No arguments other than a possible exception
   * are given to the completion callback.
   * @method FileSystem#rename
   * @param {string} oldPath
   * @param {string} newPath
   * @param {FileSystem~nodeCallback} cb
   */
  public rename(oldPath: string, newPath: string, cb: (err?: api_error.ApiError) => void): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  /**
   * **Core**: Synchronous rename.
   * @method FileSystem#renameSync
   * @param {string} oldPath
   * @param {string} newPath
   */
  public renameSync(oldPath: string, newPath: string): void {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  /**
   * **Core**: Asynchronous `stat` or `lstat`.
   * @method FileSystem#stat
   * @param {string} path
   * @param {boolean} isLstat True if this is `lstat`, false if this is regular
   *   `stat`.
   * @param {FileSystem~nodeStatsCallback} cb
   */
  public stat(p: string, isLstat: boolean, cb: (err: api_error.ApiError, stat?: stat.Stats) => void): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  /**
   * **Core**: Synchronous `stat` or `lstat`.
   * @method FileSystem#statSync
   * @param {string} path
   * @param {boolean} isLstat True if this is `lstat`, false if this is regular
   *   `stat`.
   * @return {BrowserFS.node.fs.Stats}
   */
  public statSync(p: string, isLstat: boolean): stat.Stats {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  // File operations

  /**
   * **Core**: Asynchronous file open.
   * @see http://www.manpagez.com/man/2/open/
   * @method FileSystem#open
   * @param {string} path
   * @param {BrowserFS.FileMode} flags Handles the complexity of the various file
   *   modes. See its API for more details.
   * @param {number} mode Mode to use to open the file. Can be ignored if the
   *   filesystem doesn't support permissions.
   * @param {FileSystem~fileCallback} cb
   */
  public open(p: string, flag:file_flag.FileFlag, mode: number, cb: (err: api_error.ApiError, fd?: file.BaseFile) => any): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  /**
   * **Core**: Synchronous file open.
   * @see http://www.manpagez.com/man/2/open/
   * @method FileSystem#openSync
   * @param {string} path
   * @param {BrowserFS.FileMode} flags Handles the complexity of the various file
   *   modes. See its API for more details.
   * @param {number} mode Mode to use to open the file. Can be ignored if the
   *   filesystem doesn't support permissions.
   * @return {BrowserFS.File}
   */
  public openSync(p: string, flag: file_flag.FileFlag, mode: number): file.BaseFile {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  /**
   * **Core**: Asynchronous `unlink`.
   * @method FileSystem#unlink
   * @param [string] path
   * @param [FileSystem~nodeCallback] cb
   */
  public unlink(p: string, cb: Function): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  /**
   * **Core**: Synchronous `unlink`.
   * @method FileSystem#unlinkSync
   * @param {string} path
   */
  public unlinkSync(p: string): void {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  // Directory operations

  /**
   * **Core**: Asynchronous `rmdir`.
   * @method FileSystem#rmdir
   * @param {string} path
   * @param {FileSystem~nodeCallback} cb
   */
  public rmdir(p: string, cb: Function): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  /**
   * **Core**: Synchronous `rmdir`.
   * @method FileSystem#rmdirSync
   * @param {string} path
   */
  public rmdirSync(p: string): void {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  /**
   * **Core**: Asynchronous `mkdir`.
   * @method FileSystem#mkdir
   * @param {string} path
   * @param {number?} mode Mode to make the directory using. Can be ignored if
   *   the filesystem doesn't support permissions.
   * @param {FileSystem~nodeCallback} cb
   */
  public mkdir(p: string, mode: number, cb: Function): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  /**
   * **Core**: Synchronous `mkdir`.
   * @method FileSystem#mkdirSync
   * @param {string} path
   * @param {number} mode Mode to make the directory using. Can be ignored if
   *   the filesystem doesn't support permissions.
   */
  public mkdirSync(p: string, mode: number): void {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  /**
   * **Core**: Asynchronous `readdir`. Reads the contents of a directory.
   *
   * The callback gets two arguments `(err, files)` where `files` is an array of
   * the names of the files in the directory excluding `'.'` and `'..'`.
   * @method FileSystem#readdir
   * @param {string} path
   * @param {FileSystem~readdirCallback} cb
   */
  public readdir(p: string, cb: (err: api_error.ApiError, files?: string[]) => void): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  /**
   * **Core**: Synchronous `readdir`. Reads the contents of a directory.
   * @method FileSystem#readdirSync
   * @param {string} path
   * @return {string[]}
   */
  public readdirSync(p: string): string[] {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  // **SUPPLEMENTAL INTERFACE METHODS**

  // File or directory operations

  /**
   * **Supplemental**: Test whether or not the given path exists by checking with
   * the file system. Then call the callback argument with either true or false.
   * @method FileSystem#exists
   * @param {string} path
   * @param {FileSystem~existsCallback} cb
   */
  public exists(p: string, cb: (exists: boolean) => void): void {
    this.stat(p, null, function(err) {
      cb(err == null);
    });
  }

  /**
   * **Supplemental**: Test whether or not the given path exists by checking with
   * the file system.
   * @method FileSystem#existsSync
   * @param {string} path
   * @return {boolean}
   */
  public existsSync(p: string): boolean {
    try {
      this.statSync(p, true);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * **Supplemental**: Asynchronous `realpath`. The callback gets two arguments
   * `(err, resolvedPath)`.
   *
   * Note that the Node API will resolve `path` to an absolute path.
   * @method FileSystem#realpath
   * @param {string} path
   * @param {Object} cache An object literal of mapped paths that can be used to
   *   force a specific path resolution or avoid additional `fs.stat` calls for
   *   known real paths. If not supplied by the user, it'll be an empty object.
   * @param {FileSystem~pathCallback} cb
   */
  public realpath(p: string, cache: {[path: string]: string}, cb: (err: api_error.ApiError, resolvedPath?: string) => any): void {
    if (this.supportsLinks()) {
      // The path could contain symlinks. Split up the path,
      // resolve any symlinks, return the resolved string.
      var splitPath = p.split(path.sep);
      // TODO: Simpler to just pass through file, find sep and such.
      for (var i = 0; i < splitPath.length; i++) {
        var addPaths = splitPath.slice(0, i + 1);
        splitPath[i] = path.join.apply(null, addPaths);
      }
    } else {
      // No symlinks. We just need to verify that it exists.
      this.exists(p, function(doesExist) {
        if (doesExist) {
          cb(null, p);
        } else {
          cb(new ApiError(ErrorType.NOT_FOUND, "File " + p + " not found."));
        }
      });
    }
  }

  /**
   * **Supplemental**: Synchronous `realpath`.
   *
   * Note that the Node API will resolve `path` to an absolute path.
   * @method FileSystem#realpathSync
   * @param {string} path
   * @param {Object} cache An object literal of mapped paths that can be used to
   *   force a specific path resolution or avoid additional `fs.stat` calls for
   *   known real paths. If not supplied by the user, it'll be an empty object.
   * @return {string}
   */
  public realpathSync(p: string, cache: {[path: string]: string}): string {
    if (this.supportsLinks()) {
      // The path could contain symlinks. Split up the path,
      // resolve any symlinks, return the resolved string.
      var splitPath = p.split(path.sep);
      // TODO: Simpler to just pass through file, find sep and such.
      for (var i = 0; i < splitPath.length; i++) {
        var addPaths = splitPath.slice(0, i + 1);
        splitPath[i] = path.join.apply(null, addPaths);
      }
    } else {
      // No symlinks. We just need to verify that it exists.
      if (this.existsSync(p)) {
        return p;
      } else {
        throw new ApiError(ErrorType.NOT_FOUND, "File " + p + " not found.");
      }
    }
  }

  // File operations

  /**
   *
   * **Supplemental**: Asynchronous `truncate`.
   * @method FileSystem#truncate
   * @param {string} path
   * @param {number} len
   * @param {FileSystem~nodeCallback} cb
   */
  public truncate(p: string, len: number, cb: Function): void {
    fs.open(p, 'w', (function(er: api_error.ApiError, fd?: file.BaseFile) {
      if (er) {
        return cb(er);
      }
      fs.ftruncate(fd, len, (function(er) {
        fs.close(fd, (function(er2) {
          cb(er || er2);
        }));
      }));
    }));
  }

  /**
   * **Supplemental**: Synchronous `truncate`.
   * @method FileSystem#truncateSync
   * @param {string} path
   * @param {number} len
   */
  public truncateSync(p: string, len: number): void {
    var fd = fs.openSync(p, 'w');
    // Need to safely close FD, regardless of whether or not truncate succeeds.
    try {
      fs.ftruncateSync(fd, len);
    } catch (e) {
      throw e;
    } finally {
      fs.closeSync(fd);
    }
  }

  /**
   * **Supplemental**: Asynchronously reads the entire contents of a file.
   * @method FileSystem#readFile
   * @param {string} filename
   * @param {string} encoding If non-null, the file's contents should be decoded
   *   into a string using that encoding. Otherwise, if encoding is null, fetch
   *   the file's contents as a Buffer.
   * @param {BrowserFS.FileMode} flag
   * @param {FileSystem~readCallback} cb If no encoding is specified, then the
   *   raw buffer is returned.
   */
  public readFile(fname: string, encoding: string, flag: file_flag.FileFlag, cb: (err: api_error.ApiError, data?: any) => void): void {
    // Wrap cb in file closing code.
    var oldCb = cb;
    // Get file.
    this.open(fname, flag, 0x1a4, function(err: api_error.ApiError, fd?: file.BaseFile) {
      if (err) {
        return cb(err);
      }
      cb = function(err: api_error.ApiError, arg?: file.BaseFile) {
        fd.close(function(err2) {
          if (err == null) {
            err = err2;
          }
          return oldCb(err, arg);
        });
      };
      fs.fstat(fd, function(err: api_error.ApiError, stat?: stat.Stats) {
        if (err != null) {
          return cb(err);
        }
        // Allocate buffer.
        var buf = new Buffer(stat.size);
        fs.read(fd, buf, 0, stat.size, 0, function(err) {
          if (err != null) {
            return cb(err);
          } else if (encoding === null) {
            return cb(err, buf);
          }
          try {
            cb(null, buf.toString(encoding));
          } catch (e) {
            cb(e);
          }
        });
      });
    });
  }

  /**
   * **Supplemental**: Synchronously reads the entire contents of a file.
   * @method FileSystem#readFileSync
   * @param {string} filename
   * @param {string} encoding If non-null, the file's contents should be decoded
   *   into a string using that encoding. Otherwise, if encoding is null, fetch
   *   the file's contents as a Buffer.
   * @param {BrowserFS.FileMode} flag
   * @return {(string|BrowserFS.Buffer)}
   */
  public readFileSync(fname: string, encoding: string, flag: file_flag.FileFlag): any {
    // Get file.
    var fd = this.openSync(fname, flag, 0x1a4);
    try {
      var stat = fs.fstatSync(fd);
      // Allocate buffer.
      var buf = new Buffer(stat.size);
      fs.readSync(fd, buf, 0, stat.size, 0);
      fs.closeSync(fd);
      if (encoding === null) {
        return buf;
      }
      return buf.toString(encoding);
    } catch (e) {
      fs.closeSync(fd);
      throw e;
    }
  }

  /**
   * **Supplemental**: Asynchronously writes data to a file, replacing the file
   * if it already exists.
   *
   * The encoding option is ignored if data is a buffer.
   * @method FileSystem#writeFile
   * @param {string} filename
   * @param {(string | BrowserFS.node.Buffer)} data
   * @param {string} encoding
   * @param {BrowserFS.FileMode} flag
   * @param {number} mode
   * @param {FileSystem~nodeCallback} cb
   */
  public writeFile(fname: string, data: any, encoding: string, flag: file_flag.FileFlag, mode: number, cb: (err: api_error.ApiError) => void): void {
    // Wrap cb in file closing code.
    var oldCb = cb;
    // Get file.
    this.open(fname, flag, 0x1a4, function(err: api_error.ApiError, fd?:file.BaseFile) {
      if (err != null) {
        return cb(err);
      }
      cb = function(err: api_error.ApiError) {
        fd.close(function(err2) {
          oldCb(err != null ? err : err2);
        });
      };

      try {
        if (typeof data === 'string') {
          data = new Buffer(data, encoding);
        }
      } catch (e) {
        return cb(e);
      }
      // Write into file.
      fd.write(data, 0, data.length, 0, cb);
    });
  }

  /**
   * **Supplemental**: Synchronously writes data to a file, replacing the file
   * if it already exists.
   *
   * The encoding option is ignored if data is a buffer.
   * @method FileSystem#writeFileSync
   * @param {string} filename
   * @param {(string | BrowserFS.node.Buffer)} data
   * @param {string} encoding
   * @param {BrowserFS.FileMode} flag
   * @param {number} mode
   */
  public writeFileSync(fname: string, data: any, encoding: string, flag: file_flag.FileFlag, mode: number): void {
    // Get file.
    var fd = this.openSync(fname, flag, mode);
    try {
      if (typeof data === 'string') {
        data = new Buffer(data, encoding);
      }
      // Write into file.
      fd.writeSync(data, 0, data.length, 0);
    } finally {
      fs.closeSync(fd);
    }
  }

  /**
   * **Supplemental**: Asynchronously append data to a file, creating the file if
   * it not yet exists.
   * @method FileSystem#appendFile
   * @param {string} filename
   * @param {(string | BrowserFS.node.Buffer)} data
   * @param {string} encoding
   * @param {BrowserFS.FileMode} flag
   * @param {number} mode
   * @param {FileSystem~nodeCallback} cb
   */
  public appendFile(fname: string, data: any, encoding: string, flag: file_flag.FileFlag, mode: number, cb: (err: api_error.ApiError) => void): void {
    // Wrap cb in file closing code.
    var oldCb = cb;
    this.open(fname, flag, mode, function(err: api_error.ApiError, fd?: file.BaseFile) {
      if (err != null) {
        return cb(err);
      }
      cb = function(err: api_error.ApiError) {
        fd.close(function(err2) {
          oldCb(err != null ? err : err2);
        });
      };
      if (typeof data === 'string') {
        data = new Buffer(data, encoding);
      }
      fd.write(data, 0, data.length, null, cb);
    });
  }

  /**
   * **Supplemental**: Synchronously append data to a file, creating the file if
   * it not yet exists.
   * @method FileSystem#appendFileSync
   * @param {string} filename
   * @param {(string | BrowserFS.node.Buffer)} data
   * @param {string} encoding
   * @param {BrowserFS.FileMode} flag
   * @param {number} mode
   */
  public appendFileSync(fname: string, data: any, encoding: string, flag: file_flag.FileFlag, mode: number): void {
    var fd = this.openSync(fname, flag, mode);
    try {
      if (typeof data === 'string') {
        data = new Buffer(data, encoding);
      }
      fd.writeSync(data, 0, data.length, null);
    } finally {
      fs.closeSync(fd);
    }
  }

  // **OPTIONAL INTERFACE METHODS**

  // Property operations
  // This isn't always possible on some filesystem types (e.g. Dropbox).

  /**
   * **Optional**: Asynchronous `chmod` or `lchmod`.
   * @method FileSystem#chmod
   * @param {string} path
   * @param {boolean} isLchmod `True` if `lchmod`, false if `chmod`. Has no
   *   bearing on result if links aren't supported.
   * @param {number} mode
   * @param {FileSystem~nodeCallback} cb
   */
  public chmod(p: string, isLchmod: boolean, mode: number, cb: Function): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  /**
   * **Optional**: Synchronous `chmod` or `lchmod`.
   * @method FileSystem#chmodSync
   * @param {string} path
   * @param {boolean} isLchmod `True` if `lchmod`, false if `chmod`. Has no
   *   bearing on result if links aren't supported.
   * @param {number} mode
   */
  public chmodSync(p: string, isLchmod: boolean, mode: number) {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  /**
   * **Optional**: Asynchronous `chown` or `lchown`.
   * @method FileSystem#chown
   * @param {string} path
   * @param {boolean} isLchown `True` if `lchown`, false if `chown`. Has no
   *   bearing on result if links aren't supported.
   * @param {number} uid
   * @param {number} gid
   * @param {FileSystem~nodeCallback} cb
   */
  public chown(p: string, isLchown: boolean, uid: number, gid: number, cb: Function): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  /**
   * **Optional**: Synchronous `chown` or `lchown`.
   * @method FileSystem#chownSync
   * @param {string} path
   * @param {boolean} isLchown `True` if `lchown`, false if `chown`. Has no
   *   bearing on result if links aren't supported.
   * @param {number} uid
   * @param {number} gid
   */
  public chownSync(p: string, isLchown: boolean, uid: number, gid: number): void {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  /**
   * **Optional**: Change file timestamps of the file referenced by the supplied
   * path.
   * @method FileSystem#utimes
   * @param {string} path
   * @param {Date} atime
   * @param {Date} mtime
   * @param {FileSystem~nodeCallback} cb
   */
  public utimes(p: string, atime: Date, mtime: Date, cb: Function): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  /**
   * **Optional**: Change file timestamps of the file referenced by the supplied
   * path.
   * @method FileSystem#utimesSync
   * @param {string} path
   * @param {Date} atime
   * @param {Date} mtime
   */
  public utimesSync(p: string, atime: Date, mtime: Date): void {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  // Symlink operations
  // Symlinks aren't always supported.

  /**
   * **Optional**: Asynchronous `link`.
   * @method FileSystem#link
   * @param {string} srcpath
   * @param {string} dstpath
   * @param {FileSystem~nodeCallback} cb
   */
  public link(srcpath: string, dstpath: string, cb: Function): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  /**
   * **Optional**: Synchronous `link`.
   * @method FileSystem#linkSync
   * @param {string} srcpath
   * @param {string} dstpath
   */
  public linkSync(srcpath: string, dstpath: string): void {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  /**
   * **Optional**: Asynchronous `symlink`.
   * @method FileSystem#symlink
   * @param {string} srcpath
   * @param {string} dstpath
   * @param {string} type can be either `'dir'` or `'file'`
   * @param {FileSystem~nodeCallback} cb
   */
  public symlink(srcpath: string, dstpath: string, type: string, cb: Function): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  /**
   * **Optional**: Synchronous `symlink`.
   * @method FileSystem#symlinkSync
   * @param {string} srcpath
   * @param {string} dstpath
   * @param {string} type can be either `'dir'` or `'file'`
   */
  public symlinkSync(srcpath: string, dstpath: string, type: string): void {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  /**
   * **Optional**: Asynchronous readlink.
   * @method FileSystem#readlink
   * @param {string} path
   * @param {FileSystem~pathCallback} callback
   */
  public readlink(p: string, cb: Function): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  /**
   * **Optional**: Synchronous readlink.
   * @method FileSystem#readlinkSync
   * @param {string} path
   */
  public readlinkSync(p: string): string {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }
}

/**
 * Implements the asynchronous API in terms of the synchronous API.
 * @class SynchronousFileSystem
 */
export class SynchronousFileSystem extends FileSystem {
  public supportsSynch(): boolean {
    return true;
  }

  public rename(oldPath: string, newPath: string, cb: Function): void {
    try {
      this.renameSync(oldPath, newPath);
      cb();
    } catch (e) {
      cb(e);
    }
  }

  public stat(p: string, isLstat: boolean, cb: Function): void {
    try {
      cb(null, this.statSync(p, isLstat));
    } catch (e) {
      cb(e);
    }
  }

  public open(p: string, flags: file_flag.FileFlag, mode: number, cb: Function): void {
    try {
      cb(null, this.openSync(p, flags, mode));
    } catch (e) {
      cb(e);
    }
  }

  public unlink(p: string, cb: Function): void {
    try {
      this.unlinkSync(p);
      cb();
    } catch (e) {
      cb(e);
    }
  }

  public rmdir(p: string, cb: Function): void {
    try {
      this.rmdirSync(p);
      cb();
    } catch (e) {
      cb(e);
    }
  }

  public mkdir(p: string, mode: number, cb: Function): void {
    try {
      this.mkdirSync(p, mode);
      cb();
    } catch (e) {
      cb(e);
    }
  }

  public readdir(p: string, cb: Function): void {
    try {
      cb(null, this.readdirSync(p));
    } catch (e) {
      cb(e);
    }
  }

  public chmod(p: string, isLchmod: boolean, mode: number, cb: Function): void {
    try {
      this.chmodSync(p, isLchmod, mode);
      cb();
    } catch (e) {
      cb(e);
    }
  }

  public chown(p: string, isLchown: boolean, uid: number, gid: number, cb: Function): void {
    try {
      this.chownSync(p, isLchown, uid, gid);
      cb();
    } catch (e) {
      cb(e);
    }
  }

  public utimes(p: string, atime: Date, mtime: Date, cb: Function): void {
    try {
      this.utimesSync(p, atime, mtime);
      cb();
    } catch (e) {
      cb(e);
    }
  }

  public link(srcpath: string, dstpath: string, cb: Function): void {
    try {
      this.linkSync(srcpath, dstpath);
      cb();
    } catch (e) {
      cb(e);
    }
  }

  public symlink(srcpath: string, dstpath: string, type: string, cb: Function): void {
    try {
      this.symlinkSync(srcpath, dstpath, type);
      cb();
    } catch (e) {
      cb(e);
    }
  }

  public readlink(p: string, cb: Function): void {
    try {
      cb(null, this.readlinkSync(p));
    } catch (e) {
      cb(e);
    }
  }
}
