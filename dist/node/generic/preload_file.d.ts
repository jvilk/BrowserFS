import file = require('../core/file');
import file_system = require('../core/file_system');
import Stats from '../core/node_fs_stats';
import { FileFlag } from '../core/file_flag';
import { ApiError } from '../core/api_error';
export declare class PreloadFile<T extends file_system.FileSystem> extends file.BaseFile {
    private _pos;
    private _path;
    protected _fs: T;
    private _stat;
    private _flag;
    private _buffer;
    private _dirty;
    constructor(_fs: T, _path: string, _flag: FileFlag, _stat: Stats, contents?: NodeBuffer);
    protected isDirty(): boolean;
    protected resetDirty(): void;
    getBuffer(): NodeBuffer;
    getStats(): Stats;
    getFlag(): FileFlag;
    getPath(): string;
    getPos(): number;
    advancePos(delta: number): number;
    setPos(newPos: number): number;
    sync(cb: (e?: ApiError) => void): void;
    syncSync(): void;
    close(cb: (e?: ApiError) => void): void;
    closeSync(): void;
    stat(cb: (e: ApiError, stat?: Stats) => void): void;
    statSync(): Stats;
    truncate(len: number, cb: (e?: ApiError) => void): void;
    truncateSync(len: number): void;
    write(buffer: NodeBuffer, offset: number, length: number, position: number, cb: (e: ApiError, len?: number, buff?: NodeBuffer) => void): void;
    writeSync(buffer: NodeBuffer, offset: number, length: number, position: number): number;
    read(buffer: NodeBuffer, offset: number, length: number, position: number, cb: (e: ApiError, len?: number, buff?: NodeBuffer) => void): void;
    readSync(buffer: NodeBuffer, offset: number, length: number, position: number): number;
    chmod(mode: number, cb: (e?: ApiError) => void): void;
    chmodSync(mode: number): void;
}
export declare class NoSyncFile<T extends file_system.FileSystem> extends PreloadFile<T> implements file.File {
    constructor(_fs: T, _path: string, _flag: FileFlag, _stat: Stats, contents?: NodeBuffer);
    sync(cb: (e?: ApiError) => void): void;
    syncSync(): void;
    close(cb: (e?: ApiError) => void): void;
    closeSync(): void;
}
