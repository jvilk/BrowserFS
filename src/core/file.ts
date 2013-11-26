import api_error = require('./api_error');
import stats = require('./node_fs_stats');
import buffer = require('./buffer');
var ApiError = api_error.ApiError;
var ErrorCode = api_error.ErrorCode;

export interface File {
  /**
   * **Core**: Get the current file position.
   * @return [Number]
   */
  getPos(): number;
  /**
   * **Core**: Asynchronous `stat`.
   * @param [Function(BrowserFS.ApiError, BrowserFS.node.fs.Stats)] cb
   */
  stat(cb: (err: api_error.ApiError, stats?: stats.Stats) => any): void;
  /**
   * **Core**: Synchronous `stat`.
   * @param [Function(BrowserFS.ApiError, BrowserFS.node.fs.Stats)] cb
   */
  statSync(): stats.Stats;
  /**
   * **Core**: Asynchronous close.
   * @param [Function(BrowserFS.ApiError)] cb
   */
  close(cb: Function): void;
  /**
   * **Core**: Synchronous close.
   */
  closeSync(): void;
  /**
   * **Core**: Asynchronous truncate.
   * @param [Number] len
   * @param [Function(BrowserFS.ApiError)] cb
   */
  truncate(len: number, cb: Function): void;
  /**
   * **Core**: Synchronous truncate.
   * @param [Number] len
   */
  truncateSync(len: number): void;
  /**
   * **Core**: Asynchronous sync.
   * @param [Function(BrowserFS.ApiError)] cb
   */
  sync(cb: Function): void;
  /**
   * **Core**: Synchronous sync.
   */
  syncSync(): void;
  /**
   * **Core**: Write buffer to the file.
   * Note that it is unsafe to use fs.write multiple times on the same file
   * without waiting for the callback.
   * @param [BrowserFS.node.Buffer] buffer Buffer containing the data to write to
   *  the file.
   * @param [Number] offset Offset in the buffer to start reading data from.
   * @param [Number] length The amount of bytes to write to the file.
   * @param [Number] position Offset from the beginning of the file where this
   *   data should be written. If position is null, the data will be written at
   *   the current position.
   * @param [Function(BrowserFS.ApiError, Number, BrowserFS.node.Buffer)]
   *   cb The number specifies the number of bytes written into the file.
   */
  write(buffer: NodeBuffer, offset: number, length: number, position: number, cb: (err: api_error.ApiError, written?: number, buffer?: NodeBuffer) => any): void;
  /**
   * **Core**: Write buffer to the file.
   * Note that it is unsafe to use fs.writeSync multiple times on the same file
   * without waiting for it to return.
   * @param [BrowserFS.node.Buffer] buffer Buffer containing the data to write to
   *  the file.
   * @param [Number] offset Offset in the buffer to start reading data from.
   * @param [Number] length The amount of bytes to write to the file.
   * @param [Number] position Offset from the beginning of the file where this
   *   data should be written. If position is null, the data will be written at
   *   the current position.
   * @return [Number]
   */
  writeSync(buffer: NodeBuffer, offset: number, length: number, position: number): number;
  /**
   * **Core**: Read data from the file.
   * @param [BrowserFS.node.Buffer] buffer The buffer that the data will be
   *   written to.
   * @param [Number] offset The offset within the buffer where writing will
   *   start.
   * @param [Number] length An integer specifying the number of bytes to read.
   * @param [Number] position An integer specifying where to begin reading from
   *   in the file. If position is null, data will be read from the current file
   *   position.
   * @param [Function(BrowserFS.ApiError, Number, BrowserFS.node.Buffer)] cb The
   *   number is the number of bytes read
   */
  read(buffer: NodeBuffer, offset: number, length: number, position: number, cb: (err: api_error.ApiError, bytesRead?: number, buffer?: NodeBuffer) => void): void;
  /**
   * **Core**: Read data from the file.
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
  readSync(buffer: NodeBuffer, offset: number, length: number, position: number): number;
  /**
   * **Supplementary**: Asynchronous `datasync`.
   *
   * Default implementation maps to `sync`.
   * @param [Function(BrowserFS.ApiError)] cb
   */
  datasync(cb: Function): void;
  /**
   * **Supplementary**: Synchronous `datasync`.
   *
   * Default implementation maps to `syncSync`.
   */
  datasyncSync(): void;
  /**
   * **Optional**: Asynchronous `chown`.
   * @param [Number] uid
   * @param [Number] gid
   * @param [Function(BrowserFS.ApiError)] cb
   */
  chown(uid: number, gid: number, cb: Function): void;
  /**
   * **Optional**: Synchronous `chown`.
   * @param [Number] uid
   * @param [Number] gid
   */
  chownSync(uid: number, gid: number): void;
  /**
   * **Optional**: Asynchronous `fchmod`.
   * @param [Number] mode
   * @param [Function(BrowserFS.ApiError)] cb
   */
  chmod(mode: number, cb: Function): void;
  /**
   * **Optional**: Synchronous `fchmod`.
   * @param [Number] mode
   */
  chmodSync(mode: number): void;
  /**
   * **Optional**: Change the file timestamps of the file.
   * @param [Date] atime
   * @param [Date] mtime
   * @param [Function(BrowserFS.ApiError)] cb
   */
  utimes(atime: number, mtime: number, cb: Function): void;
  /**
   * **Optional**: Change the file timestamps of the file.
   * @param [Date] atime
   * @param [Date] mtime
   */
  utimesSync(atime: number, mtime: number): void;
}

/**
 * Base class that contains shared implementations of functions for the file
 * object.
 * @class
 */
export class BaseFile {
  public sync(cb: Function): void {
    cb(new ApiError(ErrorCode.ENOTSUP));
  }
  public syncSync(): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public datasync(cb: Function): void {
    this.sync(cb);
  }
  public datasyncSync(): void {
    return this.syncSync();
  }
  public chown(uid: number, gid: number, cb: Function): void {
    cb(new ApiError(ErrorCode.ENOTSUP));
  }
  public chownSync(uid: number, gid: number): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public chmod(mode: number, cb: Function): void {
    cb(new ApiError(ErrorCode.ENOTSUP));
  }
  public chmodSync(mode: number): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public utimes(atime: number, mtime: number, cb: Function): void {
    cb(new ApiError(ErrorCode.ENOTSUP));
  }
  public utimesSync(atime: number, mtime: number): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
}
