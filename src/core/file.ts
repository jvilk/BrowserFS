import {ApiError, ErrorCode} from './api_error';
import Stats from './node_fs_stats';

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
  stat(cb: (err: ApiError, stats?: Stats) => any): void;
  /**
   * **Core**: Synchronous `stat`.
   * @param [Function(BrowserFS.ApiError, BrowserFS.node.fs.Stats)] cb
   */
  statSync(): Stats;
  /**
   * **Core**: Asynchronous close.
   * @param [Function(BrowserFS.ApiError)] cb
   */
  close(cb: (err?: ApiError) => void): void;
  /**
   * **Core**: Synchronous close.
   */
  closeSync(): void;
  /**
   * **Core**: Asynchronous truncate.
   * @param [Number] len
   * @param [Function(BrowserFS.ApiError)] cb
   */
  truncate(len: number, cb: (err?: ApiError) => void): void;
  /**
   * **Core**: Synchronous truncate.
   * @param [Number] len
   */
  truncateSync(len: number): void;
  /**
   * **Core**: Asynchronous sync.
   * @param [Function(BrowserFS.ApiError)] cb
   */
  sync(cb: (e?: ApiError) => void): void;
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
  write(buffer: Buffer, offset: number, length: number, position: number, cb: (err: ApiError, written?: number, buffer?: Buffer) => any): void;
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
  writeSync(buffer: Buffer, offset: number, length: number, position: number): number;
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
  read(buffer: Buffer, offset: number, length: number, position: number, cb: (err: ApiError, bytesRead?: number, buffer?: Buffer) => void): void;
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
  readSync(buffer: Buffer, offset: number, length: number, position: number): number;
  /**
   * **Supplementary**: Asynchronous `datasync`.
   *
   * Default implementation maps to `sync`.
   * @param [Function(BrowserFS.ApiError)] cb
   */
  datasync(cb: (e?: ApiError) => void): void;
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
  chown(uid: number, gid: number, cb: (e?: ApiError) => void): void;
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
  chmod(mode: number, cb: (e?: ApiError) => void): void;
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
  utimes(atime: Date, mtime: Date, cb: (e?: ApiError) => void): void;
  /**
   * **Optional**: Change the file timestamps of the file.
   * @param [Date] atime
   * @param [Date] mtime
   */
  utimesSync(atime: Date, mtime: Date): void;
}

/**
 * Base class that contains shared implementations of functions for the file
 * object.
 * @class
 */
export class BaseFile {
  public sync(cb: (e?: ApiError) => void): void {
    cb(new ApiError(ErrorCode.ENOTSUP));
  }
  public syncSync(): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public datasync(cb: (e?: ApiError) => void): void {
    this.sync(cb);
  }
  public datasyncSync(): void {
    return this.syncSync();
  }
  public chown(uid: number, gid: number, cb: (e?: ApiError) => void): void {
    cb(new ApiError(ErrorCode.ENOTSUP));
  }
  public chownSync(uid: number, gid: number): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public chmod(mode: number, cb: (e?: ApiError) => void): void {
    cb(new ApiError(ErrorCode.ENOTSUP));
  }
  public chmodSync(mode: number): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
  public utimes(atime: Date, mtime: Date, cb: (e?: ApiError) => void): void {
    cb(new ApiError(ErrorCode.ENOTSUP));
  }
  public utimesSync(atime: Date, mtime: Date): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }
}
