/**
 * @module core/api_error
 */

/**
 * Standard libc error codes. Add more to this enum and ErrorStrings as they are
 * needed.
 * @url http://www.gnu.org/software/libc/manual/html_node/Error-Codes.html
 */
export enum ErrorCode {
  EPERM, ENOENT, EIO, EBADF, EACCES, EBUSY, EEXIST, ENOTDIR, EISDIR, EINVAL,
  EFBIG, ENOSPC, EROFS, ENOTEMPTY, ENOTSUP
}
/**
 * Strings associated with each error code.
 */
var ErrorStrings: {[code: string]: string} = {};
ErrorStrings[ErrorCode.EPERM] = 'Operation not permitted.';
ErrorStrings[ErrorCode.ENOENT] = 'No such file or directory.';
ErrorStrings[ErrorCode.EIO] = 'Input/output error.';
ErrorStrings[ErrorCode.EBADF] = 'Bad file descriptor.';
ErrorStrings[ErrorCode.EACCES] = 'Permission denied.';
ErrorStrings[ErrorCode.EBUSY] = 'Resource busy.';
ErrorStrings[ErrorCode.EEXIST] = 'File exists.';
ErrorStrings[ErrorCode.ENOTDIR] = 'File is not a directory.';
ErrorStrings[ErrorCode.EISDIR] = 'File is a directory.';
ErrorStrings[ErrorCode.EINVAL] = 'Invalid argument.';
ErrorStrings[ErrorCode.EFBIG] = 'File is too big.';
ErrorStrings[ErrorCode.ENOSPC] = 'No space left on disk.';
ErrorStrings[ErrorCode.EROFS] = 'Cannot modify a read-only file system.';
ErrorStrings[ErrorCode.ENOTEMPTY] = 'Directory is not empty.';
ErrorStrings[ErrorCode.ENOTSUP] = 'Operation is not supported.';

export class ApiError {
  public type: ErrorCode;
  public message: string;
  public code: string;

  /**
   * Represents a BrowserFS error. Passed back to applications after a failed
   * call to the BrowserFS API.
   *
   * Error codes were stolen from Dropbox-JS, but may be changed in the future
   * for better Node compatibility...
   * @see https://raw.github.com/dropbox/dropbox-js/master/src/api_error.coffee
   * @todo Switch to Node error codes.
   * @constructor ApiError
   * @param {number} type - The type of error. Use one of the static fields of this class as the type.
   * @param {string} [message] - A descriptive error message.
   */
  constructor(type: ErrorCode, message?:string) {
    this.type = type;
    this.code = ErrorCode[type];
    if (message != null) {
      this.message = message;
    }
  }

  /**
   * @method ApiError#toString
   * @return {string} A friendly error message.
   */
  public toString(): string {
    return this.code +  ": " + ErrorStrings[this.type] + " " + this.message;
  }
}
