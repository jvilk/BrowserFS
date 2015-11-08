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
export declare class ApiError extends Error implements NodeJS.ErrnoException {
    errno: ErrorCode;
    code: string;
    path: string;
    syscall: string;
    stack: string;
    constructor(type: ErrorCode, message?: string, path?: string);
    toString(): string;
    toJSON(): any;
    static fromJSON(json: any): ApiError;
    writeToBuffer(buffer?: Buffer, i?: number): Buffer;
    static fromBuffer(buffer: Buffer, i?: number): ApiError;
    bufferSize(): number;
    static FileError(code: ErrorCode, p: string): ApiError;
    static ENOENT(path: string): ApiError;
    static EEXIST(path: string): ApiError;
    static EISDIR(path: string): ApiError;
    static ENOTDIR(path: string): ApiError;
    static EPERM(path: string): ApiError;
    static ENOTEMPTY(path: string): ApiError;
}
