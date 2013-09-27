import api_error = require('api_error');
var ApiError = api_error.ApiError;
var ErrorType = api_error.ErrorType;

export class File {
  public getPos(): number {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public stat(cb) {
    return cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  public statSync() {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public close(cb) {
    return cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  public closeSync() {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public truncate(len, cb) {
    return cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  public truncateSync(len) {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public sync(cb) {
    return cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  public syncSync() {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public write(buffer, offset, length, position, cb) {
    return cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  public writeSync(buffer, offset, length, position) {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public read(buffer, offset, length, position, cb) {
    return cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  public readSync(buffer, offset, length, position) {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public datasync(cb) {
    return this.sync(cb);
  }

  public datasyncSync() {
    return this.syncSync();
  }

  public chown(uid, gid, cb) {
    return cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  public chownSync(uid, gid) {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public chmod(mode, cb) {
    return cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  public chmodSync(mode) {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public utimes(atime, mtime, cb) {
    return cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  public utimesSync(atime, mtime) {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }
}
