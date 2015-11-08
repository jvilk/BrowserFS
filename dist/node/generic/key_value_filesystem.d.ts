import file_system = require('../core/file_system');
import { ApiError } from '../core/api_error';
import { default as Stats } from '../core/node_fs_stats';
import file = require('../core/file');
import file_flag = require('../core/file_flag');
import preload_file = require('../generic/preload_file');
export interface SyncKeyValueStore {
    name(): string;
    clear(): void;
    beginTransaction(type: "readonly"): SyncKeyValueROTransaction;
    beginTransaction(type: "readwrite"): SyncKeyValueRWTransaction;
    beginTransaction(type: string): SyncKeyValueROTransaction;
}
export interface SyncKeyValueROTransaction {
    get(key: string): NodeBuffer;
}
export interface SyncKeyValueRWTransaction extends SyncKeyValueROTransaction {
    put(key: string, data: NodeBuffer, overwrite: boolean): boolean;
    del(key: string): void;
    commit(): void;
    abort(): void;
}
export interface SimpleSyncStore {
    get(key: string): NodeBuffer;
    put(key: string, data: NodeBuffer, overwrite: boolean): boolean;
    del(key: string): void;
}
export declare class SimpleSyncRWTransaction implements SyncKeyValueRWTransaction {
    private store;
    constructor(store: SimpleSyncStore);
    private originalData;
    private modifiedKeys;
    private stashOldValue(key, value);
    private markModified(key);
    get(key: string): NodeBuffer;
    put(key: string, data: NodeBuffer, overwrite: boolean): boolean;
    del(key: string): void;
    commit(): void;
    abort(): void;
}
export interface SyncKeyValueFileSystemOptions {
    store: SyncKeyValueStore;
}
export declare class SyncKeyValueFile extends preload_file.PreloadFile<SyncKeyValueFileSystem> implements file.File {
    constructor(_fs: SyncKeyValueFileSystem, _path: string, _flag: file_flag.FileFlag, _stat: Stats, contents?: NodeBuffer);
    syncSync(): void;
    closeSync(): void;
}
export declare class SyncKeyValueFileSystem extends file_system.SynchronousFileSystem {
    private store;
    constructor(options: SyncKeyValueFileSystemOptions);
    static isAvailable(): boolean;
    getName(): string;
    isReadOnly(): boolean;
    supportsSymlinks(): boolean;
    supportsProps(): boolean;
    supportsSynch(): boolean;
    private makeRootDirectory();
    private _findINode(tx, parent, filename);
    private findINode(tx, p);
    private getINode(tx, p, id);
    private getDirListing(tx, p, inode);
    private addNewNode(tx, data);
    private commitNewFile(tx, p, type, mode, data);
    empty(): void;
    renameSync(oldPath: string, newPath: string): void;
    statSync(p: string, isLstat: boolean): Stats;
    createFileSync(p: string, flag: file_flag.FileFlag, mode: number): file.File;
    openFileSync(p: string, flag: file_flag.FileFlag): file.File;
    private removeEntry(p, isDir);
    unlinkSync(p: string): void;
    rmdirSync(p: string): void;
    mkdirSync(p: string, mode: number): void;
    readdirSync(p: string): string[];
    _syncSync(p: string, data: NodeBuffer, stats: Stats): void;
}
export interface AsyncKeyValueStore {
    name(): string;
    clear(cb: (e?: ApiError) => void): void;
    beginTransaction(type: 'readwrite'): AsyncKeyValueRWTransaction;
    beginTransaction(type: 'readonly'): AsyncKeyValueROTransaction;
    beginTransaction(type: string): AsyncKeyValueROTransaction;
}
export interface AsyncKeyValueROTransaction {
    get(key: string, cb: (e: ApiError, data?: NodeBuffer) => void): void;
}
export interface AsyncKeyValueRWTransaction extends AsyncKeyValueROTransaction {
    put(key: string, data: NodeBuffer, overwrite: boolean, cb: (e: ApiError, committed?: boolean) => void): void;
    del(key: string, cb: (e?: ApiError) => void): void;
    commit(cb: (e?: ApiError) => void): void;
    abort(cb: (e?: ApiError) => void): void;
}
export declare class AsyncKeyValueFile extends preload_file.PreloadFile<AsyncKeyValueFileSystem> implements file.File {
    constructor(_fs: AsyncKeyValueFileSystem, _path: string, _flag: file_flag.FileFlag, _stat: Stats, contents?: NodeBuffer);
    sync(cb: (e?: ApiError) => void): void;
    close(cb: (e?: ApiError) => void): void;
}
export declare class AsyncKeyValueFileSystem extends file_system.BaseFileSystem {
    private store;
    init(store: AsyncKeyValueStore, cb: (e?: ApiError) => void): void;
    static isAvailable(): boolean;
    getName(): string;
    isReadOnly(): boolean;
    supportsSymlinks(): boolean;
    supportsProps(): boolean;
    supportsSynch(): boolean;
    private makeRootDirectory(cb);
    private _findINode(tx, parent, filename, cb);
    private findINode(tx, p, cb);
    private getINode(tx, p, id, cb);
    private getDirListing(tx, p, inode, cb);
    private findINodeAndDirListing(tx, p, cb);
    private addNewNode(tx, data, cb);
    private commitNewFile(tx, p, type, mode, data, cb);
    empty(cb: (e?: ApiError) => void): void;
    rename(oldPath: string, newPath: string, cb: (e?: ApiError) => void): void;
    stat(p: string, isLstat: boolean, cb: (err: ApiError, stat?: Stats) => void): void;
    createFile(p: string, flag: file_flag.FileFlag, mode: number, cb: (e: ApiError, file?: file.File) => void): void;
    openFile(p: string, flag: file_flag.FileFlag, cb: (e: ApiError, file?: file.File) => void): void;
    private removeEntry(p, isDir, cb);
    unlink(p: string, cb: (e?: ApiError) => void): void;
    rmdir(p: string, cb: (e?: ApiError) => void): void;
    mkdir(p: string, mode: number, cb: (e?: ApiError) => void): void;
    readdir(p: string, cb: (err: ApiError, files?: string[]) => void): void;
    _sync(p: string, data: NodeBuffer, stats: Stats, cb: (e?: ApiError) => void): void;
}
