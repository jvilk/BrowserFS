import node_fs_stats = require('../core/node_fs_stats');
declare class Inode {
    id: string;
    size: number;
    mode: number;
    atime: number;
    mtime: number;
    ctime: number;
    constructor(id: string, size: number, mode: number, atime: number, mtime: number, ctime: number);
    toStats(): node_fs_stats.Stats;
    getSize(): number;
    toBuffer(buff?: NodeBuffer): NodeBuffer;
    update(stats: node_fs_stats.Stats): boolean;
    static fromBuffer(buffer: NodeBuffer): Inode;
    isFile(): boolean;
    isDirectory(): boolean;
}
export = Inode;
