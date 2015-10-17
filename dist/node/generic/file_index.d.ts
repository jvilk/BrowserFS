import node_fs_stats = require('../core/node_fs_stats');
export declare class FileIndex {
    private _index;
    constructor();
    private _split_path(p);
    fileIterator(cb: (file: node_fs_stats.Stats) => void): void;
    addPath(path: string, inode: Inode): boolean;
    removePath(path: string): Inode;
    ls(path: string): string[];
    getInode(path: string): Inode;
    static from_listing(listing: any): FileIndex;
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
    getStats(): node_fs_stats.Stats;
    getListing(): string[];
    getItem(p: string): Inode;
    addItem(p: string, inode: Inode): boolean;
    remItem(p: string): Inode;
}
