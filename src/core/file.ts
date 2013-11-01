import api_error = require('./api_error');
import stats = require('./node_fs_stats');
import buffer = require('./buffer');
var ApiError = api_error.ApiError;
var ErrorType = api_error.ErrorType;

export interface File {
  getPos(): number;
  stat(cb: (err: api_error.ApiError, stats?: stats.Stats) => any): void;
  statSync(): stats.Stats;
  close(cb: Function): void;
  closeSync(): void;
  truncate(len: number, cb: Function): void;
  truncateSync(len: number): void;
  sync(cb: Function): void;
  syncSync(): void;
  write(buffer: buffer.Buffer, offset: number, length: number, position: number, cb: (err: api_error.ApiError, written?: number, buffer?: buffer.Buffer) => any): void;
  writeSync(buffer: buffer.Buffer, offset: number, length: number, position: number): number;
  read(buffer: buffer.Buffer, offset: number, length: number, position: number, cb: (err: api_error.ApiError, bytesRead?: number, buffer?: buffer.Buffer) => void): void;
  readSync(buffer: buffer.Buffer, offset: number, length: number, position: number): number;
  datasync(cb: Function): void;
  datasyncSync(): void;
  chown(uid: number, gid: number, cb: Function): void;
  chownSync(uid: number, gid: number): void;
  chmod(mode: number, cb: Function): void;
  chmodSync(mode: number): void;
  utimes(atime: number, mtime: number, cb: Function): void;
  utimesSync(atime: number, mtime: number): void;
}

/**
 * Base class that contains the interface for a file object. BrowserFS uses these
 * as a replacement for numeric file descriptors.
 * @class
 */
export class BaseFile implements File {
  /**
   * **Core**: Get the current file position.
   * @return [Number]
   */
  public getPos(): number {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  /**
   * **Core**: Asynchronous `stat`.
   * @param [Function(BrowserFS.ApiError, BrowserFS.node.fs.Stats)] cb
   */
  public stat(cb: (err: api_error.ApiError, stats?: stats.Stats) => any): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  /**
   * **Core**: Synchronous `stat`.
   * @param [Function(BrowserFS.ApiError, BrowserFS.node.fs.Stats)] cb
   */
  public statSync(): stats.Stats {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  /**
   * **Core**: Asynchronous close.
   * @param [Function(BrowserFS.ApiError)] cb
   */
  public close(cb: Function): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  /**
   * **Core**: Synchronous close.
   */
  public closeSync(): void {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  /**
   * **Core**: Asynchronous truncate.
   * @param [Number] len
   * @param [Function(BrowserFS.ApiError)] cb
   */
  public truncate(len: number, cb: Function): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  /**
   * **Core**: Synchronous truncate.
   * @param [Number] len
   */
  public truncateSync(len: number): void {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  /**
   * **Core**: Asynchronous sync.
   * @param [Function(BrowserFS.ApiError)] cb
   */
  public sync(cb: Function): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  /**
   * **Core**: Synchronous sync.
   */
  public syncSync(): void {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

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
  public write(buffer: buffer.Buffer, offset: number, length: number, position: number, cb: (err: api_error.ApiError, written?: number, buffer?: buffer.Buffer) => any): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

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
  public writeSync(buffer: buffer.Buffer, offset: number, length: number, position: number): number {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

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
  public read(buffer: buffer.Buffer, offset: number, length: number, position: number, cb: (err: api_error.ApiError, bytesRead?: number, buffer?: buffer.Buffer) => void): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

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
  public readSync(buffer: buffer.Buffer, offset: number, length: number, position: number): number {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  /**
   * **Supplementary**: Asynchronous `datasync`.
   *
   * Default implementation maps to `sync`.
   * @param [Function(BrowserFS.ApiError)] cb
   */
  public datasync(cb: Function): void {
    this.sync(cb);
  }

  /**
   * **Supplementary**: Synchronous `datasync`.
   *
   * Default implementation maps to `syncSync`.
   */
  public datasyncSync(): void {
    return this.syncSync();
  }

  /**
   * **Optional**: Asynchronous `chown`.
   * @param [Number] uid
   * @param [Number] gid
   * @param [Function(BrowserFS.ApiError)] cb
   */
  public chown(uid: number, gid: number, cb: Function): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  /**
   * **Optional**: Synchronous `chown`.
   * @param [Number] uid
   * @param [Number] gid
   */
  public chownSync(uid: number, gid: number): void {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  /**
   * **Optional**: Asynchronous `fchmod`.
   * @param [Number] mode
   * @param [Function(BrowserFS.ApiError)] cb
   */
  public chmod(mode: number, cb: Function): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  /**
   * **Optional**: Synchronous `fchmod`.
   * @param [Number] mode
   */
  public chmodSync(mode: number): void {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  /**
   * **Optional**: Change the file timestamps of the file.
   * @param [Date] atime
   * @param [Date] mtime
   * @param [Function(BrowserFS.ApiError)] cb
   */
  public utimes(atime: number, mtime: number, cb: Function): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  /**
   * **Optional**: Change the file timestamps of the file.
   * @param [Date] atime
   * @param [Date] mtime
   */
  public utimesSync(atime: number, mtime: number): void {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }
}
