import { ApiError } from './api_error';
import stats = require('./node_fs_stats');
export interface File {
    getPos(): number;
    stat(cb: (err: ApiError, stats?: stats.Stats) => any): void;
    statSync(): stats.Stats;
    close(cb: Function): void;
    closeSync(): void;
    truncate(len: number, cb: Function): void;
    truncateSync(len: number): void;
    sync(cb: Function): void;
    syncSync(): void;
    write(buffer: NodeBuffer, offset: number, length: number, position: number, cb: (err: ApiError, written?: number, buffer?: NodeBuffer) => any): void;
    writeSync(buffer: NodeBuffer, offset: number, length: number, position: number): number;
    read(buffer: NodeBuffer, offset: number, length: number, position: number, cb: (err: ApiError, bytesRead?: number, buffer?: NodeBuffer) => void): void;
    readSync(buffer: NodeBuffer, offset: number, length: number, position: number): number;
    datasync(cb: Function): void;
    datasyncSync(): void;
    chown(uid: number, gid: number, cb: Function): void;
    chownSync(uid: number, gid: number): void;
    chmod(mode: number, cb: Function): void;
    chmodSync(mode: number): void;
    utimes(atime: number, mtime: number, cb: Function): void;
    utimesSync(atime: number, mtime: number): void;
}
export declare class BaseFile {
    sync(cb: Function): void;
    syncSync(): void;
    datasync(cb: Function): void;
    datasyncSync(): void;
    chown(uid: number, gid: number, cb: Function): void;
    chownSync(uid: number, gid: number): void;
    chmod(mode: number, cb: Function): void;
    chmodSync(mode: number): void;
    utimes(atime: number, mtime: number, cb: Function): void;
    utimesSync(atime: number, mtime: number): void;
}
