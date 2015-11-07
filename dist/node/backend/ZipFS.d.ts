import node_fs_stats = require('../core/node_fs_stats');
import file_system = require('../core/file_system');
import file = require('../core/file');
import { FileFlag } from '../core/file_flag';
export declare enum ExternalFileAttributeType {
    MSDOS = 0,
    AMIGA = 1,
    OPENVMS = 2,
    UNIX = 3,
    VM_CMS = 4,
    ATARI_ST = 5,
    OS2_HPFS = 6,
    MAC = 7,
    Z_SYSTEM = 8,
    CP_M = 9,
    NTFS = 10,
    MVS = 11,
    VSE = 12,
    ACORN_RISC = 13,
    VFAT = 14,
    ALT_MVS = 15,
    BEOS = 16,
    TANDEM = 17,
    OS_400 = 18,
    OSX = 19,
}
export declare enum CompressionMethod {
    STORED = 0,
    SHRUNK = 1,
    REDUCED_1 = 2,
    REDUCED_2 = 3,
    REDUCED_3 = 4,
    REDUCED_4 = 5,
    IMPLODE = 6,
    DEFLATE = 8,
    DEFLATE64 = 9,
    TERSE_OLD = 10,
    BZIP2 = 12,
    LZMA = 14,
    TERSE_NEW = 18,
    LZ77 = 19,
    WAVPACK = 97,
    PPMD = 98,
}
export declare class FileHeader {
    private data;
    constructor(data: NodeBuffer);
    versionNeeded(): number;
    flags(): number;
    compressionMethod(): CompressionMethod;
    lastModFileTime(): Date;
    crc32(): number;
    fileNameLength(): number;
    extraFieldLength(): number;
    fileName(): string;
    extraField(): NodeBuffer;
    totalSize(): number;
    useUTF8(): boolean;
}
export declare class FileData {
    private header;
    private record;
    private data;
    constructor(header: FileHeader, record: CentralDirectory, data: NodeBuffer);
    decompress(): NodeBuffer;
}
export declare class DataDescriptor {
    private data;
    constructor(data: NodeBuffer);
    crc32(): number;
    compressedSize(): number;
    uncompressedSize(): number;
}
export declare class ArchiveExtraDataRecord {
    private data;
    constructor(data: NodeBuffer);
    length(): number;
    extraFieldData(): NodeBuffer;
}
export declare class DigitalSignature {
    private data;
    constructor(data: NodeBuffer);
    size(): number;
    signatureData(): NodeBuffer;
}
export declare class CentralDirectory {
    private zipData;
    private data;
    constructor(zipData: NodeBuffer, data: NodeBuffer);
    versionMadeBy(): number;
    versionNeeded(): number;
    flag(): number;
    compressionMethod(): CompressionMethod;
    lastModFileTime(): Date;
    crc32(): number;
    compressedSize(): number;
    uncompressedSize(): number;
    fileNameLength(): number;
    extraFieldLength(): number;
    fileCommentLength(): number;
    diskNumberStart(): number;
    internalAttributes(): number;
    externalAttributes(): number;
    headerRelativeOffset(): number;
    fileName(): string;
    extraField(): NodeBuffer;
    fileComment(): string;
    totalSize(): number;
    isDirectory(): boolean;
    isFile(): boolean;
    useUTF8(): boolean;
    isEncrypted(): boolean;
    getData(): NodeBuffer;
    getStats(): node_fs_stats.Stats;
}
export declare class EndOfCentralDirectory {
    private data;
    constructor(data: NodeBuffer);
    diskNumber(): number;
    cdDiskNumber(): number;
    cdDiskEntryCount(): number;
    cdTotalEntryCount(): number;
    cdSize(): number;
    cdOffset(): number;
    cdZipComment(): string;
}
export default class ZipFS extends file_system.SynchronousFileSystem implements file_system.FileSystem {
    private data;
    private name;
    private _index;
    constructor(data: NodeBuffer, name?: string);
    getName(): string;
    static isAvailable(): boolean;
    diskSpace(path: string, cb: (total: number, free: number) => void): void;
    isReadOnly(): boolean;
    supportsLinks(): boolean;
    supportsProps(): boolean;
    supportsSynch(): boolean;
    statSync(path: string, isLstat: boolean): node_fs_stats.Stats;
    openSync(path: string, flags: FileFlag, mode: number): file.File;
    readdirSync(path: string): string[];
    readFileSync(fname: string, encoding: string, flag: FileFlag): any;
    private getEOCD();
    private populateIndex();
}
