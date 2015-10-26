import { Stats } from '../core/node_fs_stats';
export declare class FileIndex {
    private _index;
    constructor();
    private _split_path(p);
    fileIterator<T>(cb: (file: T) => void): void;
    addPath(path: string, inode: Inode): boolean;
    removePath(path: string): Inode;
    ls(path: string): string[];
    getInode(path: string): Inode;
    static fromListing(listing: any): FileIndex;
}
export interface Inode {
    isFile(): boolean;
    isDir(): boolean;
}
export declare class FileInode<T> implements Inode {
    private data;
    constructor(data: T);
    isFile(): boolean;
    isDir(): boolean;
    getData(): T;
    setData(data: T): void;
}
export declare class DirInode implements Inode {
    private _ls;
    constructor();
    isFile(): boolean;
    isDir(): boolean;
    getStats(): Stats;
    getListing(): string[];
    getItem(p: string): Inode;
    addItem(p: string, inode: Inode): boolean;
    remItem(p: string): Inode;
}
export declare function isFileInode<T>(inode: Inode): inode is FileInode<T>;
export declare function isDirInode(inode: Inode): inode is DirInode;
