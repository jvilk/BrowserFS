import { ApiError } from './api_error';
import file_system = require('./file_system');
import Stats from './node_fs_stats';
import _fs = require('fs');
export default class FS {
    static Stats: typeof Stats;
    private root;
    private fdMap;
    private nextFd;
    private getFdForFile(file);
    private fd2file(fd);
    private closeFd(fd);
    initialize(rootFS: file_system.FileSystem): file_system.FileSystem;
    _toUnixTimestamp(time: Date | number): number;
    getRootFS(): file_system.FileSystem;
    rename(oldPath: string, newPath: string, cb?: (err?: ApiError) => void): void;
    renameSync(oldPath: string, newPath: string): void;
    exists(path: string, cb?: (exists: boolean) => void): void;
    existsSync(path: string): boolean;
    stat(path: string, cb?: (err: ApiError, stats?: Stats) => any): void;
    statSync(path: string): Stats;
    lstat(path: string, cb?: (err: ApiError, stats?: Stats) => any): void;
    lstatSync(path: string): Stats;
    truncate(path: string, cb?: (err?: ApiError) => void): void;
    truncate(path: string, len: number, cb?: (err?: ApiError) => void): void;
    truncateSync(path: string, len?: number): void;
    unlink(path: string, cb?: (err?: ApiError) => void): void;
    unlinkSync(path: string): void;
    open(path: string, flag: string, cb?: (err: ApiError, fd?: number) => any): void;
    open(path: string, flag: string, mode: number | string, cb?: (err: ApiError, fd?: number) => any): void;
    openSync(path: string, flag: string, mode?: number | string): number;
    readFile(filename: string, cb: (err: ApiError, data?: Buffer) => void): void;
    readFile(filename: string, options: {
        flag?: string;
    }, callback: (err: ApiError, data: Buffer) => void): void;
    readFile(filename: string, options: {
        encoding: string;
        flag?: string;
    }, callback: (err: ApiError, data: string) => void): void;
    readFile(filename: string, encoding: string, cb?: (err: ApiError, data?: string) => void): void;
    readFileSync(filename: string, options?: {
        flag?: string;
    }): Buffer;
    readFileSync(filename: string, options: {
        encoding: string;
        flag?: string;
    }): string;
    readFileSync(filename: string, encoding: string): string;
    writeFile(filename: string, data: any, cb?: (err?: ApiError) => void): void;
    writeFile(filename: string, data: any, encoding?: string, cb?: (err?: ApiError) => void): void;
    writeFile(filename: string, data: any, options?: {
        encoding?: string;
        mode?: string | number;
        flag?: string;
    }, cb?: (err?: ApiError) => void): void;
    writeFileSync(filename: string, data: any, options?: {
        encoding?: string;
        mode?: number | string;
        flag?: string;
    }): void;
    writeFileSync(filename: string, data: any, encoding?: string): void;
    appendFile(filename: string, data: any, cb?: (err: ApiError) => void): void;
    appendFile(filename: string, data: any, options?: {
        encoding?: string;
        mode?: number | string;
        flag?: string;
    }, cb?: (err: ApiError) => void): void;
    appendFile(filename: string, data: any, encoding?: string, cb?: (err: ApiError) => void): void;
    appendFileSync(filename: string, data: any, options?: {
        encoding?: string;
        mode?: number | string;
        flag?: string;
    }): void;
    appendFileSync(filename: string, data: any, encoding?: string): void;
    fstat(fd: number, cb?: (err: ApiError, stats?: Stats) => any): void;
    fstatSync(fd: number): Stats;
    close(fd: number, cb?: (e?: ApiError) => void): void;
    closeSync(fd: number): void;
    ftruncate(fd: number, cb?: (err?: ApiError) => void): void;
    ftruncate(fd: number, len?: number, cb?: (err?: ApiError) => void): void;
    ftruncateSync(fd: number, len?: number): void;
    fsync(fd: number, cb?: (err?: ApiError) => void): void;
    fsyncSync(fd: number): void;
    fdatasync(fd: number, cb?: (err?: ApiError) => void): void;
    fdatasyncSync(fd: number): void;
    write(fd: number, buffer: Buffer, offset: number, length: number, cb?: (err: ApiError, written: number, buffer: Buffer) => void): void;
    write(fd: number, buffer: Buffer, offset: number, length: number, position: number, cb?: (err: ApiError, written: number, buffer: Buffer) => void): void;
    write(fd: number, data: any, cb?: (err: ApiError, written: number, str: string) => any): void;
    write(fd: number, data: any, position: number, cb?: (err: ApiError, written: number, str: string) => any): void;
    write(fd: number, data: any, position: number, encoding: string, cb?: (err: ApiError, written: number, str: string) => void): void;
    writeSync(fd: number, buffer: Buffer, offset: number, length: number, position?: number): number;
    writeSync(fd: number, data: string, position?: number, encoding?: string): number;
    read(fd: number, length: number, position: number, encoding: string, cb?: (err: ApiError, data?: string, bytesRead?: number) => void): void;
    read(fd: number, buffer: Buffer, offset: number, length: number, position: number, cb?: (err: ApiError, bytesRead?: number, buffer?: Buffer) => void): void;
    readSync(fd: number, length: number, position: number, encoding: string): string;
    readSync(fd: number, buffer: Buffer, offset: number, length: number, position: number): number;
    fchown(fd: number, uid: number, gid: number, callback?: (e?: ApiError) => void): void;
    fchownSync(fd: number, uid: number, gid: number): void;
    fchmod(fd: number, mode: string | number, cb?: (e?: ApiError) => void): void;
    fchmodSync(fd: number, mode: number | string): void;
    futimes(fd: number, atime: number, mtime: number, cb: (e?: ApiError) => void): void;
    futimes(fd: number, atime: Date, mtime: Date, cb: (e?: ApiError) => void): void;
    futimesSync(fd: number, atime: number | Date, mtime: number | Date): void;
    rmdir(path: string, cb?: (e?: ApiError) => void): void;
    rmdirSync(path: string): void;
    mkdir(path: string, mode?: any, cb?: (e?: ApiError) => void): void;
    mkdirSync(path: string, mode?: number | string): void;
    readdir(path: string, cb?: (err: ApiError, files?: string[]) => void): void;
    readdirSync(path: string): string[];
    link(srcpath: string, dstpath: string, cb?: (e?: ApiError) => void): void;
    linkSync(srcpath: string, dstpath: string): void;
    symlink(srcpath: string, dstpath: string, cb?: (e?: ApiError) => void): void;
    symlink(srcpath: string, dstpath: string, type?: string, cb?: (e?: ApiError) => void): void;
    symlinkSync(srcpath: string, dstpath: string, type?: string): void;
    readlink(path: string, cb?: (err: ApiError, linkString?: string) => any): void;
    readlinkSync(path: string): string;
    chown(path: string, uid: number, gid: number, cb?: (e?: ApiError) => void): void;
    chownSync(path: string, uid: number, gid: number): void;
    lchown(path: string, uid: number, gid: number, cb?: (e?: ApiError) => void): void;
    lchownSync(path: string, uid: number, gid: number): void;
    chmod(path: string, mode: number | string, cb?: (e?: ApiError) => void): void;
    chmodSync(path: string, mode: string | number): void;
    lchmod(path: string, mode: number | string, cb?: Function): void;
    lchmodSync(path: string, mode: number | string): void;
    utimes(path: string, atime: number | Date, mtime: number | Date, cb?: (e?: ApiError) => void): void;
    utimesSync(path: string, atime: number | Date, mtime: number | Date): void;
    realpath(path: string, cb?: (err: ApiError, resolvedPath?: string) => any): void;
    realpath(path: string, cache: {
        [path: string]: string;
    }, cb: (err: ApiError, resolvedPath?: string) => any): void;
    realpathSync(path: string, cache?: {
        [path: string]: string;
    }): string;
    watchFile(filename: string, listener: (curr: Stats, prev: Stats) => void): void;
    watchFile(filename: string, options: {
        persistent?: boolean;
        interval?: number;
    }, listener: (curr: Stats, prev: Stats) => void): void;
    unwatchFile(filename: string, listener?: (curr: Stats, prev: Stats) => void): void;
    watch(filename: string, listener?: (event: string, filename: string) => any): _fs.FSWatcher;
    watch(filename: string, options: {
        persistent?: boolean;
    }, listener?: (event: string, filename: string) => any): _fs.FSWatcher;
    F_OK: number;
    R_OK: number;
    W_OK: number;
    X_OK: number;
    access(path: string, callback: (err: ApiError) => void): void;
    access(path: string, mode: number, callback: (err: ApiError) => void): void;
    accessSync(path: string, mode?: number): void;
    createReadStream(path: string, options?: {
        flags?: string;
        encoding?: string;
        fd?: number;
        mode?: number;
        autoClose?: boolean;
    }): _fs.ReadStream;
    createWriteStream(path: string, options?: {
        flags?: string;
        encoding?: string;
        fd?: number;
        mode?: number;
    }): _fs.WriteStream;
    _wrapCb: (cb: Function, args: number) => Function;
}
export interface FSModule extends FS {
    getFSModule(): FS;
    changeFSModule(newFs: FS): void;
    FS: typeof FS;
}
