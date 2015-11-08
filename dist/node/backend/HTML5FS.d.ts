import preload_file = require('../generic/preload_file');
import file_system = require('../core/file_system');
import { ApiError } from '../core/api_error';
import { FileFlag } from '../core/file_flag';
import { default as Stats } from '../core/node_fs_stats';
import file = require('../core/file');
export declare class HTML5FSFile extends preload_file.PreloadFile<HTML5FS> implements file.File {
    constructor(_fs: HTML5FS, _path: string, _flag: FileFlag, _stat: Stats, contents?: NodeBuffer);
    sync(cb: (e?: ApiError) => void): void;
    close(cb: (e?: ApiError) => void): void;
}
export default class HTML5FS extends file_system.BaseFileSystem implements file_system.FileSystem {
    private size;
    private type;
    fs: FileSystem;
    constructor(size?: number, type?: number);
    getName(): string;
    static isAvailable(): boolean;
    isReadOnly(): boolean;
    supportsSymlinks(): boolean;
    supportsProps(): boolean;
    supportsSynch(): boolean;
    convert(err: DOMError, p: string, expectedDir: boolean): ApiError;
    allocate(cb?: (e?: ApiError) => void): void;
    empty(mainCb: (e?: ApiError) => void): void;
    rename(oldPath: string, newPath: string, cb: (e?: ApiError) => void): void;
    stat(path: string, isLstat: boolean, cb: (err: ApiError, stat?: Stats) => void): void;
    open(p: string, flags: FileFlag, mode: number, cb: (err: ApiError, fd?: file.File) => any): void;
    private _statType(stat);
    private _makeFile(path, flag, stat, data?);
    private _remove(path, cb, isFile);
    unlink(path: string, cb: (e?: ApiError) => void): void;
    rmdir(path: string, cb: (e?: ApiError) => void): void;
    mkdir(path: string, mode: number, cb: (e?: ApiError) => void): void;
    private _readdir(path, cb);
    readdir(path: string, cb: (err: ApiError, files?: string[]) => void): void;
}
