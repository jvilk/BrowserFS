import preload_file = require('../generic/preload_file');
import file_system = require('../core/file_system');
import file_flag = require('../core/file_flag');
import { default as Stats, FileType } from '../core/node_fs_stats';
import { ApiError } from '../core/api_error';
import file = require('../core/file');
export declare class DropboxFile extends preload_file.PreloadFile<DropboxFileSystem> implements file.File {
    constructor(_fs: DropboxFileSystem, _path: string, _flag: file_flag.FileFlag, _stat: Stats, contents?: NodeBuffer);
    sync(cb: (e?: ApiError) => void): void;
    close(cb: (e?: ApiError) => void): void;
}
export default class DropboxFileSystem extends file_system.BaseFileSystem implements file_system.FileSystem {
    private _client;
    constructor(client: Dropbox.Client);
    getName(): string;
    static isAvailable(): boolean;
    isReadOnly(): boolean;
    supportsSymlinks(): boolean;
    supportsProps(): boolean;
    supportsSynch(): boolean;
    empty(mainCb: (e?: ApiError) => void): void;
    rename(oldPath: string, newPath: string, cb: (e?: ApiError) => void): void;
    stat(path: string, isLstat: boolean, cb: (err: ApiError, stat?: Stats) => void): void;
    open(path: string, flags: file_flag.FileFlag, mode: number, cb: (err: ApiError, fd?: file.File) => any): void;
    _writeFileStrict(p: string, data: ArrayBuffer, cb: (e: ApiError, stat?: Dropbox.File.Stat) => void): void;
    _statType(stat: Dropbox.File.Stat): FileType;
    _makeFile(path: string, flag: file_flag.FileFlag, stat: Dropbox.File.Stat, buffer: NodeBuffer): DropboxFile;
    _remove(path: string, cb: (e?: ApiError) => void, isFile: boolean): void;
    unlink(path: string, cb: (e?: ApiError) => void): void;
    rmdir(path: string, cb: (e?: ApiError) => void): void;
    mkdir(p: string, mode: number, cb: (e?: ApiError) => void): void;
    readdir(path: string, cb: (err: ApiError, files?: string[]) => void): void;
    convert(err: Dropbox.ApiError, path?: string): ApiError;
}
