import fs = require('fs');
export declare enum FileType {
    FILE = 32768,
    DIRECTORY = 16384,
    SYMLINK = 40960,
}
export default class Stats implements fs.Stats {
    size: number;
    mode: number;
    atime: Date;
    mtime: Date;
    ctime: Date;
    blocks: number;
    dev: number;
    ino: number;
    rdev: number;
    nlink: number;
    blksize: number;
    uid: number;
    gid: number;
    birthtime: Date;
    file_data: NodeBuffer;
    constructor(item_type: FileType, size: number, mode?: number, atime?: Date, mtime?: Date, ctime?: Date);
    toBuffer(): Buffer;
    static fromBuffer(buffer: Buffer): Stats;
    clone(): Stats;
    isFile(): boolean;
    isDirectory(): boolean;
    isSymbolicLink(): boolean;
    chmod(mode: number): void;
    isSocket(): boolean;
    isBlockDevice(): boolean;
    isCharacterDevice(): boolean;
    isFIFO(): boolean;
}
