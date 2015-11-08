import { ApiError } from './api_error';
import Stats from './node_fs_stats';
import file = require('./file');
import { FileFlag } from './file_flag';
export interface FileSystem {
    getName(): string;
    diskSpace(p: string, cb: (total: number, free: number) => any): void;
    isReadOnly(): boolean;
    supportsLinks(): boolean;
    supportsProps(): boolean;
    supportsSynch(): boolean;
    rename(oldPath: string, newPath: string, cb: (err?: ApiError) => void): void;
    renameSync(oldPath: string, newPath: string): void;
    stat(p: string, isLstat: boolean, cb: (err: ApiError, stat?: Stats) => void): void;
    statSync(p: string, isLstat: boolean): Stats;
    open(p: string, flag: FileFlag, mode: number, cb: (err: ApiError, fd?: file.File) => any): void;
    openSync(p: string, flag: FileFlag, mode: number): file.File;
    unlink(p: string, cb: Function): void;
    unlinkSync(p: string): void;
    rmdir(p: string, cb: Function): void;
    rmdirSync(p: string): void;
    mkdir(p: string, mode: number, cb: Function): void;
    mkdirSync(p: string, mode: number): void;
    readdir(p: string, cb: (err: ApiError, files?: string[]) => void): void;
    readdirSync(p: string): string[];
    exists(p: string, cb: (exists: boolean) => void): void;
    existsSync(p: string): boolean;
    realpath(p: string, cache: {
        [path: string]: string;
    }, cb: (err: ApiError, resolvedPath?: string) => any): void;
    realpathSync(p: string, cache: {
        [path: string]: string;
    }): string;
    truncate(p: string, len: number, cb: Function): void;
    truncateSync(p: string, len: number): void;
    readFile(fname: string, encoding: string, flag: FileFlag, cb: (err: ApiError, data?: any) => void): void;
    readFileSync(fname: string, encoding: string, flag: FileFlag): any;
    writeFile(fname: string, data: any, encoding: string, flag: FileFlag, mode: number, cb: (err: ApiError) => void): void;
    writeFileSync(fname: string, data: any, encoding: string, flag: FileFlag, mode: number): void;
    appendFile(fname: string, data: any, encoding: string, flag: FileFlag, mode: number, cb: (err: ApiError) => void): void;
    appendFileSync(fname: string, data: any, encoding: string, flag: FileFlag, mode: number): void;
    chmod(p: string, isLchmod: boolean, mode: number, cb: Function): void;
    chmodSync(p: string, isLchmod: boolean, mode: number): void;
    chown(p: string, isLchown: boolean, uid: number, gid: number, cb: Function): void;
    chownSync(p: string, isLchown: boolean, uid: number, gid: number): void;
    utimes(p: string, atime: Date, mtime: Date, cb: Function): void;
    utimesSync(p: string, atime: Date, mtime: Date): void;
    link(srcpath: string, dstpath: string, cb: Function): void;
    linkSync(srcpath: string, dstpath: string): void;
    symlink(srcpath: string, dstpath: string, type: string, cb: Function): void;
    symlinkSync(srcpath: string, dstpath: string, type: string): void;
    readlink(p: string, cb: Function): void;
    readlinkSync(p: string): string;
}
export interface FileSystemConstructor {
    isAvailable(): boolean;
}
export declare class BaseFileSystem {
    supportsLinks(): boolean;
    diskSpace(p: string, cb: (total: number, free: number) => any): void;
    openFile(p: string, flag: FileFlag, cb: (e: ApiError, file?: file.File) => void): void;
    createFile(p: string, flag: FileFlag, mode: number, cb: (e: ApiError, file?: file.File) => void): void;
    open(p: string, flag: FileFlag, mode: number, cb: (err: ApiError, fd?: file.BaseFile) => any): void;
    rename(oldPath: string, newPath: string, cb: (err?: ApiError) => void): void;
    renameSync(oldPath: string, newPath: string): void;
    stat(p: string, isLstat: boolean, cb: (err: ApiError, stat?: Stats) => void): void;
    statSync(p: string, isLstat: boolean): Stats;
    openFileSync(p: string, flag: FileFlag): file.File;
    createFileSync(p: string, flag: FileFlag, mode: number): file.File;
    openSync(p: string, flag: FileFlag, mode: number): file.File;
    unlink(p: string, cb: Function): void;
    unlinkSync(p: string): void;
    rmdir(p: string, cb: Function): void;
    rmdirSync(p: string): void;
    mkdir(p: string, mode: number, cb: Function): void;
    mkdirSync(p: string, mode: number): void;
    readdir(p: string, cb: (err: ApiError, files?: string[]) => void): void;
    readdirSync(p: string): string[];
    exists(p: string, cb: (exists: boolean) => void): void;
    existsSync(p: string): boolean;
    realpath(p: string, cache: {
        [path: string]: string;
    }, cb: (err: ApiError, resolvedPath?: string) => any): void;
    realpathSync(p: string, cache: {
        [path: string]: string;
    }): string;
    truncate(p: string, len: number, cb: Function): void;
    truncateSync(p: string, len: number): void;
    readFile(fname: string, encoding: string, flag: FileFlag, cb: (err: ApiError, data?: any) => void): void;
    readFileSync(fname: string, encoding: string, flag: FileFlag): any;
    writeFile(fname: string, data: any, encoding: string, flag: FileFlag, mode: number, cb: (err: ApiError) => void): void;
    writeFileSync(fname: string, data: any, encoding: string, flag: FileFlag, mode: number): void;
    appendFile(fname: string, data: any, encoding: string, flag: FileFlag, mode: number, cb: (err: ApiError) => void): void;
    appendFileSync(fname: string, data: any, encoding: string, flag: FileFlag, mode: number): void;
    chmod(p: string, isLchmod: boolean, mode: number, cb: Function): void;
    chmodSync(p: string, isLchmod: boolean, mode: number): void;
    chown(p: string, isLchown: boolean, uid: number, gid: number, cb: Function): void;
    chownSync(p: string, isLchown: boolean, uid: number, gid: number): void;
    utimes(p: string, atime: Date, mtime: Date, cb: Function): void;
    utimesSync(p: string, atime: Date, mtime: Date): void;
    link(srcpath: string, dstpath: string, cb: Function): void;
    linkSync(srcpath: string, dstpath: string): void;
    symlink(srcpath: string, dstpath: string, type: string, cb: Function): void;
    symlinkSync(srcpath: string, dstpath: string, type: string): void;
    readlink(p: string, cb: Function): void;
    readlinkSync(p: string): string;
}
export declare class SynchronousFileSystem extends BaseFileSystem {
    supportsSynch(): boolean;
    rename(oldPath: string, newPath: string, cb: Function): void;
    stat(p: string, isLstat: boolean, cb: Function): void;
    open(p: string, flags: FileFlag, mode: number, cb: Function): void;
    unlink(p: string, cb: Function): void;
    rmdir(p: string, cb: Function): void;
    mkdir(p: string, mode: number, cb: Function): void;
    readdir(p: string, cb: Function): void;
    chmod(p: string, isLchmod: boolean, mode: number, cb: Function): void;
    chown(p: string, isLchown: boolean, uid: number, gid: number, cb: Function): void;
    utimes(p: string, atime: Date, mtime: Date, cb: Function): void;
    link(srcpath: string, dstpath: string, cb: Function): void;
    symlink(srcpath: string, dstpath: string, type: string, cb: Function): void;
    readlink(p: string, cb: Function): void;
}
