import { default as Stats } from '../core/node_fs_stats';
declare class Inode {
    id: string;
    size: number;
    mode: number;
    atime: number;
    mtime: number;
    ctime: number;
    constructor(id: string, size: number, mode: number, atime: number, mtime: number, ctime: number);
    toStats(): Stats;
    getSize(): number;
    toBuffer(buff?: NodeBuffer): NodeBuffer;
    update(stats: Stats): boolean;
    static fromBuffer(buffer: NodeBuffer): Inode;
    isFile(): boolean;
    isDirectory(): boolean;
}
export = Inode;
