import { default as Stats } from '../core/node_fs_stats';
export declare class FileIndex<T> {
    private _index;
    constructor();
    private _split_path(p);
    fileIterator<T>(cb: (file: T) => void): void;
    addPath(path: string, inode: Inode): boolean;
    removePath(path: string): Inode;
    ls(path: string): string[];
    getInode(path: string): Inode;
    static fromListing<T>(listing: any): FileIndex<T>;
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
export declare class DirInode<T> implements Inode {
    private data;
    private _ls;
    constructor(data?: T);
    isFile(): boolean;
    isDir(): boolean;
    getData(): T;
    getStats(): Stats;
    getListing(): string[];
    getItem(p: string): Inode;
    addItem(p: string, inode: Inode): boolean;
    remItem(p: string): Inode;
}
export declare function isFileInode<T>(inode: Inode): inode is FileInode<T>;
export declare function isDirInode<T>(inode: Inode): inode is DirInode<T>;
