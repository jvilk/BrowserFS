import { ApiError } from './api_error';
import Stats from './node_fs_stats';
export interface File {
    getPos(): number;
    stat(cb: (err: ApiError, stats?: Stats) => any): void;
    statSync(): Stats;
    close(cb: Function): void;
    closeSync(): void;
    truncate(len: number, cb: Function): void;
    truncateSync(len: number): void;
    sync(cb: (e?: ApiError) => void): void;
    syncSync(): void;
    write(buffer: NodeBuffer, offset: number, length: number, position: number, cb: (err: ApiError, written?: number, buffer?: NodeBuffer) => any): void;
    writeSync(buffer: NodeBuffer, offset: number, length: number, position: number): number;
    read(buffer: NodeBuffer, offset: number, length: number, position: number, cb: (err: ApiError, bytesRead?: number, buffer?: NodeBuffer) => void): void;
    readSync(buffer: NodeBuffer, offset: number, length: number, position: number): number;
    datasync(cb: (e?: ApiError) => void): void;
    datasyncSync(): void;
    chown(uid: number, gid: number, cb: (e?: ApiError) => void): void;
    chownSync(uid: number, gid: number): void;
    chmod(mode: number, cb: (e?: ApiError) => void): void;
    chmodSync(mode: number): void;
    utimes(atime: Date, mtime: Date, cb: (e?: ApiError) => void): void;
    utimesSync(atime: Date, mtime: Date): void;
}
export declare class BaseFile {
    sync(cb: (e?: ApiError) => void): void;
    syncSync(): void;
    datasync(cb: (e?: ApiError) => void): void;
    datasyncSync(): void;
    chown(uid: number, gid: number, cb: (e?: ApiError) => void): void;
    chownSync(uid: number, gid: number): void;
    chmod(mode: number, cb: (e?: ApiError) => void): void;
    chmodSync(mode: number): void;
    utimes(atime: Date, mtime: Date, cb: (e?: ApiError) => void): void;
    utimesSync(atime: Date, mtime: Date): void;
}
