import {ApiError, ErrorCode} from './api_error';
import Stats from './node_fs_stats';
import {File, BaseFile} from './file';
import {FileFlag, ActionType} from './file_flag';
import * as path from 'path';

/**
 * Interface for a filesystem. **All** BrowserFS FileSystems should implement
 * this interface.
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
export interface FileSystem {
  /**
   * **Optional**: Returns the name of the file system.
   * @method FileSystem#getName
   * @return {string}
   */
  getName(): string;
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
  diskSpace(p: string, cb: (total: number, free: number) => any): void;
  /**
   * **Core**: Is this filesystem read-only?
   * @method FileSystem#isReadOnly
   * @return {boolean} True if this FileSystem is inherently read-only.
   */
  isReadOnly(): boolean;
  /**
   * **Core**: Does the filesystem support optional symlink/hardlink-related
   *   commands?
   * @method FileSystem#supportsLinks
   * @return {boolean} True if the FileSystem supports the optional
   *   symlink/hardlink-related commands.
   */
  supportsLinks(): boolean;
  /**
   * **Core**: Does the filesystem support optional property-related commands?
   * @method FileSystem#supportsProps
   * @return {boolean} True if the FileSystem supports the optional
   *   property-related commands (permissions, utimes, etc).
   */
  supportsProps(): boolean;
  /**
   * **Core**: Does the filesystem support the optional synchronous interface?
   * @method FileSystem#supportsSynch
   * @return {boolean} True if the FileSystem supports synchronous operations.
   */
  supportsSynch(): boolean;
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
  rename(oldPath: string, newPath: string, cb: (err?: ApiError) => void): void;
  /**
   * **Core**: Synchronous rename.
   * @method FileSystem#renameSync
   * @param {string} oldPath
   * @param {string} newPath
   */
  renameSync(oldPath: string, newPath: string): void;
  /**
   * **Core**: Asynchronous `stat` or `lstat`.
   * @method FileSystem#stat
   * @param {string} path
   * @param {boolean} isLstat True if this is `lstat`, false if this is regular
   *   `stat`.
   * @param {FileSystem~nodeStatsCallback} cb
   */
  stat(p: string, isLstat: boolean, cb: (err: ApiError, stat?: Stats) => void): void;
  /**
   * **Core**: Synchronous `stat` or `lstat`.
   * @method FileSystem#statSync
   * @param {string} path
   * @param {boolean} isLstat True if this is `lstat`, false if this is regular
   *   `stat`.
   * @return {BrowserFS.node.fs.Stats}
   */
  statSync(p: string, isLstat: boolean): Stats;
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
  open(p: string, flag: FileFlag, mode: number, cb: (err: ApiError, fd?: File) => any): void;
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
  openSync(p: string, flag: FileFlag, mode: number): File;
  /**
   * **Core**: Asynchronous `unlink`.
   * @method FileSystem#unlink
   * @param [string] path
   * @param [FileSystem~nodeCallback] cb
   */
  unlink(p: string, cb: (e?: ApiError) => void): void;
  /**
   * **Core**: Synchronous `unlink`.
   * @method FileSystem#unlinkSync
   * @param {string} path
   */
  unlinkSync(p: string): void;
  // Directory operations
  /**
   * **Core**: Asynchronous `rmdir`.
   * @method FileSystem#rmdir
   * @param {string} path
   * @param {FileSystem~nodeCallback} cb
   */
  rmdir(p: string, cb: (e?: ApiError) => void): void;
  /**
   * **Core**: Synchronous `rmdir`.
   * @method FileSystem#rmdirSync
   * @param {string} path
   */
  rmdirSync(p: string): void;
  /**
   * **Core**: Asynchronous `mkdir`.
   * @method FileSystem#mkdir
   * @param {string} path
   * @param {number?} mode Mode to make the directory using. Can be ignored if
   *   the filesystem doesn't support permissions.
   * @param {FileSystem~nodeCallback} cb
   */
  mkdir(p: string, mode: number, cb: (e?: ApiError) => void): void;
  /**
   * **Core**: Synchronous `mkdir`.
   * @method FileSystem#mkdirSync
   * @param {string} path
   * @param {number} mode Mode to make the directory using. Can be ignored if
   *   the filesystem doesn't support permissions.
   */
  mkdirSync(p: string, mode: number): void;
  /**
   * **Core**: Asynchronous `readdir`. Reads the contents of a directory.
   *
   * The callback gets two arguments `(err, files)` where `files` is an array of
   * the names of the files in the directory excluding `'.'` and `'..'`.
   * @method FileSystem#readdir
   * @param {string} path
   * @param {FileSystem~readdirCallback} cb
   */
  readdir(p: string, cb: (err: ApiError, files?: string[]) => void): void;
  /**
   * **Core**: Synchronous `readdir`. Reads the contents of a directory.
   * @method FileSystem#readdirSync
   * @param {string} path
   * @return {string[]}
   */
  readdirSync(p: string): string[];
  // **SUPPLEMENTAL INTERFACE METHODS**
  // File or directory operations
  /**
   * **Supplemental**: Test whether or not the given path exists by checking with
   * the file system. Then call the callback argument with either true or false.
   * @method FileSystem#exists
   * @param {string} path
   * @param {FileSystem~existsCallback} cb
   */
  exists(p: string, cb: (exists: boolean) => void): void;
  /**
   * **Supplemental**: Test whether or not the given path exists by checking with
   * the file system.
   * @method FileSystem#existsSync
   * @param {string} path
   * @return {boolean}
   */
  existsSync(p: string): boolean;
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
  realpath(p: string, cache: {[path: string]: string}, cb: (err: ApiError, resolvedPath?: string) => any): void;
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
  realpathSync(p: string, cache: {[path: string]: string}): string;
  // File operations
  /**
   *
   * **Supplemental**: Asynchronous `truncate`.
   * @method FileSystem#truncate
   * @param {string} path
   * @param {number} len
   * @param {FileSystem~nodeCallback} cb
   */
  truncate(p: string, len: number, cb: (e?: ApiError) => void): void;
  /**
   * **Supplemental**: Synchronous `truncate`.
   * @method FileSystem#truncateSync
   * @param {string} path
   * @param {number} len
   */
  truncateSync(p: string, len: number): void;
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
  readFile(fname: string, encoding: string | null, flag: FileFlag, cb: (err: ApiError, data?: any) => void): void;
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
  readFileSync(fname: string, encoding: string, flag: FileFlag): any;
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
  writeFile(fname: string, data: any, encoding: string, flag: FileFlag, mode: number, cb: (err: ApiError) => void): void;
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
  writeFileSync(fname: string, data: string | Buffer, encoding: string | null, flag: FileFlag, mode: number): void;
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
  appendFile(fname: string, data: string | Buffer, encoding: string | null, flag: FileFlag, mode: number, cb: (err: ApiError) => void): void;
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
  appendFileSync(fname: string, data: string | Buffer, encoding: string | null, flag: FileFlag, mode: number): void;
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
  chmod(p: string, isLchmod: boolean, mode: number, cb: (e?: ApiError) => void): void;
  /**
   * **Optional**: Synchronous `chmod` or `lchmod`.
   * @method FileSystem#chmodSync
   * @param {string} path
   * @param {boolean} isLchmod `True` if `lchmod`, false if `chmod`. Has no
   *   bearing on result if links aren't supported.
   * @param {number} mode
   */
  chmodSync(p: string, isLchmod: boolean, mode: number): void;
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
  chown(p: string, isLchown: boolean, uid: number, gid: number, cb: (e?: ApiError) => void): void;
  /**
   * **Optional**: Synchronous `chown` or `lchown`.
   * @method FileSystem#chownSync
   * @param {string} path
   * @param {boolean} isLchown `True` if `lchown`, false if `chown`. Has no
   *   bearing on result if links aren't supported.
   * @param {number} uid
   * @param {number} gid
   */
  chownSync(p: string, isLchown: boolean, uid: number, gid: number): void;
  /**
   * **Optional**: Change file timestamps of the file referenced by the supplied
   * path.
   * @method FileSystem#utimes
   * @param {string} path
   * @param {Date} atime
   * @param {Date} mtime
   * @param {FileSystem~nodeCallback} cb
   */
  utimes(p: string, atime: Date, mtime: Date, cb: (e?: ApiError) => void): void;
  /**
   * **Optional**: Change file timestamps of the file referenced by the supplied
   * path.
   * @method FileSystem#utimesSync
   * @param {string} path
   * @param {Date} atime
   * @param {Date} mtime
   */
  utimesSync(p: string, atime: Date, mtime: Date): void;
  // Symlink operations
  // Symlinks aren't always supported.
  /**
   * **Optional**: Asynchronous `link`.
   * @method FileSystem#link
   * @param {string} srcpath
   * @param {string} dstpath
   * @param {FileSystem~nodeCallback} cb
   */
  link(srcpath: string, dstpath: string, cb: (e?: ApiError) => void): void;
  /**
   * **Optional**: Synchronous `link`.
   * @method FileSystem#linkSync
   * @param {string} srcpath
   * @param {string} dstpath
   */
  linkSync(srcpath: string, dstpath: string): void;
  /**
   * **Optional**: Asynchronous `symlink`.
   * @method FileSystem#symlink
   * @param {string} srcpath
   * @param {string} dstpath
   * @param {string} type can be either `'dir'` or `'file'`
   * @param {FileSystem~nodeCallback} cb
   */
  symlink(srcpath: string, dstpath: string, type: string, cb: (e?: ApiError) => void): void;
  /**
   * **Optional**: Synchronous `symlink`.
   * @method FileSystem#symlinkSync
   * @param {string} srcpath
   * @param {string} dstpath
   * @param {string} type can be either `'dir'` or `'file'`
   */
  symlinkSync(srcpath: string, dstpath: string, type: string): void;
  /**
   * **Optional**: Asynchronous readlink.
   * @method FileSystem#readlink
   * @param {string} path
   * @param {FileSystem~pathCallback} callback
   */
  readlink(p: string, cb: (e: ApiError, p?: string) => void): void;
  /**
   * **Optional**: Synchronous readlink.
   * @method FileSystem#readlinkSync
   * @param {string} path
   */
  readlinkSync(p: string): string;
}

/**
 * Contains typings for static functions on the file system constructor.
 */
export interface FileSystemConstructor {
  /**
   * **Core**: Returns 'true' if this filesystem is available in the current
   * environment. For example, a `localStorage`-backed filesystem will return
   * 'false' if the browser does not support that API.
   *
   * Defaults to 'false', as the FileSystem base class isn't usable alone.
   * @method FileSystem.isAvailable
   * @return {boolean}
   */
  isAvailable(): boolean;
}

/**
 * Basic filesystem class. Most filesystems should extend this class, as it
 * provides default implementations for a handful of methods.
 */
export class BaseFileSystem {
  public supportsLinks(): boolean {
    return false;
  }
  public diskSpace(p: string, cb: (total: number, free: number) => any): void {
    cb(0, 0);
  }
  /**
   * Opens the file at path p with the given flag. The file must exist.
   * @param p The path to open.
   * @param flag The flag to use when opening the file.
   */
  public openFile(p: string, flag: FileFlag, cb: (e: ApiError, file?: File) => void): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  /**
   * Create the file at path p with the given mode. Then, open it with the given
   * flag.
   */
  public createFile(p: string, flag: FileFlag, mode: number, cb: (e: ApiError, file?: File) => void): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public open(p: string, flag: FileFlag, mode: number, cb: (err: ApiError, fd?: BaseFile) => any): void {
    let mustBeFile = (e: ApiError, stats?: Stats): void => {
      if (e) {
        // File does not exist.
        switch (flag.pathNotExistsAction()) {
          case ActionType.CREATE_FILE:
            // Ensure parent exists.
            return this.stat(path.dirname(p), false, (e: ApiError, parentStats?: Stats) => {
              if (e) {
                cb(e);
              } else if (!parentStats.isDirectory()) {
                cb(ApiError.ENOTDIR(path.dirname(p)));
              } else {
                this.createFile(p, flag, mode, cb);
              }
            });
          case ActionType.THROW_EXCEPTION:
            return cb(ApiError.ENOENT(p));
          default:
            return cb(new ApiError(ErrorCode.EINVAL, 'Invalid FileFlag object.'));
        }
      } else {
        // File exists.
        if (stats.isDirectory()) {
          return cb(ApiError.EISDIR(p));
        }
        switch (flag.pathExistsAction()) {
          case ActionType.THROW_EXCEPTION:
            return cb(ApiError.EEXIST(p));
          case ActionType.TRUNCATE_FILE:
            // NOTE: In a previous implementation, we deleted the file and
            // re-created it. However, this created a race condition if another
            // asynchronous request was trying to read the file, as the file
            // would not exist for a small period of time.
            return this.openFile(p, flag, (e: ApiError, fd?: File): void => {
              if (e) {
                cb(e);
              } else {
                fd.truncate(0, () => {
                  fd.sync(() => {
                    cb(null, fd);
                  });
                });
              }
            });
          case ActionType.NOP:
            return this.openFile(p, flag, cb);
          default:
            return cb(new ApiError(ErrorCode.EINVAL, 'Invalid FileFlag object.'));
        }
      }
    };
    this.stat(p, false, mustBeFile);
  }
  public rename(oldPath: string, newPath: string, cb: (err?: ApiError) => void): void {
    cb(new ApiError(ErrorCode.ENOTSUP));
  }
  public renameSync(oldPath: string, newPath: string): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public stat(p: string, isLstat: boolean, cb: (err: ApiError, stat?: Stats) => void): void {
    cb(new ApiError(ErrorCode.ENOTSUP));
  }
  public statSync(p: string, isLstat: boolean): Stats {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  /**
   * Opens the file at path p with the given flag. The file must exist.
   * @param p The path to open.
   * @param flag The flag to use when opening the file.
   * @return A File object corresponding to the opened file.
   */
  public openFileSync(p: string, flag: FileFlag, mode: number): File {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  /**
   * Create the file at path p with the given mode. Then, open it with the given
   * flag.
   */
  public createFileSync(p: string, flag: FileFlag, mode: number): File {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public openSync(p: string, flag: FileFlag, mode: number): File {
    // Check if the path exists, and is a file.
    let stats: Stats;
    try {
      stats = this.statSync(p, false);
    } catch (e) {
      // File does not exist.
      switch (flag.pathNotExistsAction()) {
        case ActionType.CREATE_FILE:
          // Ensure parent exists.
          let parentStats = this.statSync(path.dirname(p), false);
          if (!parentStats.isDirectory()) {
            throw ApiError.ENOTDIR(path.dirname(p));
          }
          return this.createFileSync(p, flag, mode);
        case ActionType.THROW_EXCEPTION:
          throw ApiError.ENOENT(p);
        default:
          throw new ApiError(ErrorCode.EINVAL, 'Invalid FileFlag object.');
      }
    }

    // File exists.
    if (stats.isDirectory()) {
      throw ApiError.EISDIR(p);
    }
    switch (flag.pathExistsAction()) {
      case ActionType.THROW_EXCEPTION:
        throw ApiError.EEXIST(p);
      case ActionType.TRUNCATE_FILE:
        // Delete file.
        this.unlinkSync(p);
        // Create file. Use the same mode as the old file.
        // Node itself modifies the ctime when this occurs, so this action
        // will preserve that behavior if the underlying file system
        // supports those properties.
        return this.createFileSync(p, flag, stats.mode);
      case ActionType.NOP:
        return this.openFileSync(p, flag, mode);
      default:
        throw new ApiError(ErrorCode.EINVAL, 'Invalid FileFlag object.');
    }
  }
  public unlink(p: string, cb: Function): void {
    cb(new ApiError(ErrorCode.ENOTSUP));
  }
  public unlinkSync(p: string): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public rmdir(p: string, cb: Function): void {
    cb(new ApiError(ErrorCode.ENOTSUP));
  }
  public rmdirSync(p: string): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public mkdir(p: string, mode: number, cb: Function): void {
    cb(new ApiError(ErrorCode.ENOTSUP));
  }
  public mkdirSync(p: string, mode: number): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public readdir(p: string, cb: (err: ApiError, files?: string[]) => void): void {
    cb(new ApiError(ErrorCode.ENOTSUP));
  }
  public readdirSync(p: string): string[] {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public exists(p: string, cb: (exists: boolean) => void): void {
    this.stat(p, null, function(err) {
      cb(!err);
    });
  }
  public existsSync(p: string): boolean {
    try {
      this.statSync(p, true);
      return true;
    } catch (e) {
      return false;
    }
  }
  public realpath(p: string, cache: {[path: string]: string}, cb: (err: ApiError, resolvedPath?: string) => any): void {
    if (this.supportsLinks()) {
      // The path could contain symlinks. Split up the path,
      // resolve any symlinks, return the resolved string.
      let splitPath = p.split(path.sep);
      // TODO: Simpler to just pass through file, find sep and such.
      for (let i = 0; i < splitPath.length; i++) {
        let addPaths = splitPath.slice(0, i + 1);
        splitPath[i] = path.join.apply(null, addPaths);
      }
    } else {
      // No symlinks. We just need to verify that it exists.
      this.exists(p, function(doesExist) {
        if (doesExist) {
          cb(null, p);
        } else {
          cb(ApiError.ENOENT(p));
        }
      });
    }
  }
  public realpathSync(p: string, cache: {[path: string]: string}): string {
    if (this.supportsLinks()) {
      // The path could contain symlinks. Split up the path,
      // resolve any symlinks, return the resolved string.
      let splitPath = p.split(path.sep);
      // TODO: Simpler to just pass through file, find sep and such.
      for (let i = 0; i < splitPath.length; i++) {
        let addPaths = splitPath.slice(0, i + 1);
        splitPath[i] = path.join.apply(path, addPaths);
      }
      return splitPath.join(path.sep);
    } else {
      // No symlinks. We just need to verify that it exists.
      if (this.existsSync(p)) {
        return p;
      } else {
        throw ApiError.ENOENT(p);
      }
    }
  }
  public truncate(p: string, len: number, cb: Function): void {
    this.open(p, FileFlag.getFileFlag('r+'), 0x1a4, (function(er: ApiError, fd?: File) {
      if (er) {
        return cb(er);
      }
      fd.truncate(len, (function(er: any) {
        fd.close((function(er2: any) {
          cb(er || er2);
        }));
      }));
    }));
  }
  public truncateSync(p: string, len: number): void {
    let fd = this.openSync(p, FileFlag.getFileFlag('r+'), 0x1a4);
    // Need to safely close FD, regardless of whether or not truncate succeeds.
    try {
      fd.truncateSync(len);
    } catch (e) {
      throw e;
    } finally {
      fd.closeSync();
    }
  }
  public readFile(fname: string, encoding: string, flag: FileFlag, cb: (err: ApiError, data?: any) => void): void {
    // Wrap cb in file closing code.
    let oldCb = cb;
    // Get file.
    this.open(fname, flag, 0x1a4, function(err: ApiError, fd?: File) {
      if (err) {
        return cb(err);
      }
      cb = function(err: ApiError, arg?: File) {
        fd.close(function(err2: any) {
          if (!err) {
            err = err2;
          }
          return oldCb(err, arg);
        });
      };
      fd.stat(function(err: ApiError, stat?: Stats) {
        if (err) {
          return cb(err);
        }
        // Allocate buffer.
        let buf = new Buffer(stat.size);
        fd.read(buf, 0, stat.size, 0, function(err) {
          if (err) {
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
  public readFileSync(fname: string, encoding: string, flag: FileFlag): any {
    // Get file.
    let fd = this.openSync(fname, flag, 0x1a4);
    try {
      let stat = fd.statSync();
      // Allocate buffer.
      let buf = new Buffer(stat.size);
      fd.readSync(buf, 0, stat.size, 0);
      fd.closeSync();
      if (encoding === null) {
        return buf;
      }
      return buf.toString(encoding);
    } finally {
      fd.closeSync();
    }
  }
  public writeFile(fname: string, data: any, encoding: string, flag: FileFlag, mode: number, cb: (err: ApiError) => void): void {
    // Wrap cb in file closing code.
    let oldCb = cb;
    // Get file.
    this.open(fname, flag, 0x1a4, function(err: ApiError, fd?: File) {
      if (err) {
        return cb(err);
      }
      cb = function(err: ApiError) {
        fd.close(function(err2: any) {
          oldCb(err ? err : err2);
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
  public writeFileSync(fname: string, data: any, encoding: string, flag: FileFlag, mode: number): void {
    // Get file.
    let fd = this.openSync(fname, flag, mode);
    try {
      if (typeof data === 'string') {
        data = new Buffer(data, encoding);
      }
      // Write into file.
      fd.writeSync(data, 0, data.length, 0);
    } finally {
      fd.closeSync();
    }
  }
  public appendFile(fname: string, data: any, encoding: string, flag: FileFlag, mode: number, cb: (err: ApiError) => void): void {
    // Wrap cb in file closing code.
    let oldCb = cb;
    this.open(fname, flag, mode, function(err: ApiError, fd?: File) {
      if (err) {
        return cb(err);
      }
      cb = function(err: ApiError) {
        fd.close(function(err2: any) {
          oldCb(err ? err : err2);
        });
      };
      if (typeof data === 'string') {
        data = new Buffer(data, encoding);
      }
      fd.write(data, 0, data.length, null, cb);
    });
  }
  public appendFileSync(fname: string, data: any, encoding: string, flag: FileFlag, mode: number): void {
    let fd = this.openSync(fname, flag, mode);
    try {
      if (typeof data === 'string') {
        data = new Buffer(data, encoding);
      }
      fd.writeSync(data, 0, data.length, null);
    } finally {
      fd.closeSync();
    }
  }
  public chmod(p: string, isLchmod: boolean, mode: number, cb: Function): void {
    cb(new ApiError(ErrorCode.ENOTSUP));
  }
  public chmodSync(p: string, isLchmod: boolean, mode: number) {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public chown(p: string, isLchown: boolean, uid: number, gid: number, cb: Function): void {
    cb(new ApiError(ErrorCode.ENOTSUP));
  }
  public chownSync(p: string, isLchown: boolean, uid: number, gid: number): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public utimes(p: string, atime: Date, mtime: Date, cb: Function): void {
    cb(new ApiError(ErrorCode.ENOTSUP));
  }
  public utimesSync(p: string, atime: Date, mtime: Date): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public link(srcpath: string, dstpath: string, cb: Function): void {
    cb(new ApiError(ErrorCode.ENOTSUP));
  }
  public linkSync(srcpath: string, dstpath: string): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public symlink(srcpath: string, dstpath: string, type: string, cb: Function): void {
    cb(new ApiError(ErrorCode.ENOTSUP));
  }
  public symlinkSync(srcpath: string, dstpath: string, type: string): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public readlink(p: string, cb: Function): void {
    cb(new ApiError(ErrorCode.ENOTSUP));
  }
  public readlinkSync(p: string): string {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
}

/**
 * Implements the asynchronous API in terms of the synchronous API.
 * @class SynchronousFileSystem
 */
export class SynchronousFileSystem extends BaseFileSystem {
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

  public open(p: string, flags: FileFlag, mode: number, cb: Function): void {
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
