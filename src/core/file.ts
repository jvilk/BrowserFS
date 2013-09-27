import api_error = require('api_error');
import stats = require('node_fs_stats');
import buffer = require('buffer');
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

export class BaseFile implements File {
  public getPos(): number {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public stat(cb: (err: api_error.ApiError, stats?: stats.Stats) => any): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  public statSync(): stats.Stats {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public close(cb: Function): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  public closeSync(): void {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public truncate(len: number, cb: Function): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  public truncateSync(len: number): void {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public sync(cb: Function): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  public syncSync(): void {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public write(buffer: buffer.Buffer, offset: number, length: number, position: number, cb: (err: api_error.ApiError, written?: number, buffer?: buffer.Buffer) => any): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  public writeSync(buffer: buffer.Buffer, offset: number, length: number, position: number): number {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public read(buffer: buffer.Buffer, offset: number, length: number, position: number, cb: (err: api_error.ApiError, bytesRead?: number, buffer?: buffer.Buffer) => void): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  public readSync(buffer: buffer.Buffer, offset: number, length: number, position: number): number {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public datasync(cb: Function): void {
    this.sync(cb);
  }

  public datasyncSync(): void {
    return this.syncSync();
  }

  public chown(uid: number, gid: number, cb: Function): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  public chownSync(uid: number, gid: number): void {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public chmod(mode: number, cb: Function): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  public chmodSync(mode: number): void {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public utimes(atime: number, mtime: number, cb: Function): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  public utimesSync(atime: number, mtime: number): void {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }
}
