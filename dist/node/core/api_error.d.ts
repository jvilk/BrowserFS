import buffer = require("./buffer");
import Buffer = buffer.Buffer;
export declare enum ErrorCode {
    EPERM = 0,
    ENOENT = 1,
    EIO = 2,
    EBADF = 3,
    EACCES = 4,
    EBUSY = 5,
    EEXIST = 6,
    ENOTDIR = 7,
    EISDIR = 8,
    EINVAL = 9,
    EFBIG = 10,
    ENOSPC = 11,
    EROFS = 12,
    ENOTEMPTY = 13,
    ENOTSUP = 14,
}
export declare class ApiError {
    type: ErrorCode;
    message: string;
    code: string;
    constructor(type: ErrorCode, message?: string);
    toString(): string;
    writeToBuffer(buffer?: Buffer, i?: number): Buffer;
    static fromBuffer(buffer: Buffer, i?: number): ApiError;
    bufferSize(): number;
    static FileError(code: ErrorCode, p: string): ApiError;
    static ENOENT(path: string): ApiError;
    static EEXIST(path: string): ApiError;
    static EISDIR(path: string): ApiError;
    static ENOTDIR(path: string): ApiError;
    static EPERM(path: string): ApiError;
}
