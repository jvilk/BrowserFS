import buffer_core = require('./buffer_core');
export interface BFSBuffer extends NodeBuffer {
    get(index: number): number;
    set(index: number, value: number): void;
    getBufferCore(): buffer_core.BufferCore;
    getOffset(): number;
    sliceCopy(start?: number, end?: number): NodeBuffer;
}
export interface BFSBufferImplementation {
    new (ab: ArrayBuffer): NodeBuffer;
    new (str: string, encoding?: string): NodeBuffer;
    new (size: number): NodeBuffer;
    new (array: any[]): NodeBuffer;
    isBuffer(obj: any): obj is NodeBuffer;
    byteLength(string: string, encoding?: string): number;
    concat(list: NodeBuffer[], totalLength?: number): NodeBuffer;
}
export interface JSONBufferObject {
    type: string;
    data: number[];
}
export declare class Buffer implements BFSBuffer {
    [idx: number]: number;
    private data;
    private offset;
    length: number;
    constructor(size: number);
    constructor(data: any[]);
    constructor(data: DataView);
    constructor(data: ArrayBuffer);
    constructor(data: NodeBuffer);
    constructor(data: JSONBufferObject);
    constructor(data: string, encoding?: string);
    constructor(data: buffer_core.BufferCore, start?: number, end?: number);
    static getAvailableBufferCores(): buffer_core.BufferCoreImplementation[];
    static getPreferredBufferCore(): buffer_core.BufferCoreImplementation;
    static setPreferredBufferCore(bci: buffer_core.BufferCoreImplementation): void;
    getBufferCore(): buffer_core.BufferCore;
    getOffset(): number;
    set(index: number, value: number): number;
    get(index: number): number;
    write(str: string, offset?: number, length?: number, encoding?: string): number;
    toString(encoding?: string, start?: number, end?: number): string;
    toJSON(): JSONBufferObject;
    inspect(): string;
    toArrayBuffer(): ArrayBuffer;
    indexOf(value: string | NodeBuffer | number, byteOffset?: number): number;
    copy(target: NodeBuffer, targetStart?: number, sourceStart?: number, sourceEnd?: number): number;
    slice(start?: number, end?: number): NodeBuffer;
    sliceCopy(start?: number, end?: number): NodeBuffer;
    fill(value: any, offset?: number, end?: number): NodeBuffer;
    readUIntLE(offset: number, byteLength: number, noAssert?: boolean): number;
    readUIntBE(offset: number, byteLength: number, noAssert?: boolean): number;
    readIntLE(offset: number, byteLength: number, noAssert?: boolean): number;
    readIntBE(offset: number, byteLength: number, noAssert?: boolean): number;
    readUInt8(offset: number, noAssert?: boolean): number;
    readUInt16LE(offset: number, noAssert?: boolean): number;
    readUInt16BE(offset: number, noAssert?: boolean): number;
    readUInt32LE(offset: number, noAssert?: boolean): number;
    readUInt32BE(offset: number, noAssert?: boolean): number;
    readInt8(offset: number, noAssert?: boolean): number;
    readInt16LE(offset: number, noAssert?: boolean): number;
    readInt16BE(offset: number, noAssert?: boolean): number;
    readInt32LE(offset: number, noAssert?: boolean): number;
    readInt32BE(offset: number, noAssert?: boolean): number;
    readFloatLE(offset: number, noAssert?: boolean): number;
    readFloatBE(offset: number, noAssert?: boolean): number;
    readDoubleLE(offset: number, noAssert?: boolean): number;
    readDoubleBE(offset: number, noAssert?: boolean): number;
    writeUIntLE(value: number, offset: number, byteLength: number, noAssert?: boolean): number;
    writeUIntBE(value: number, offset: number, byteLength: number, noAssert?: boolean): number;
    writeIntLE(value: number, offset: number, byteLength: number, noAssert?: boolean): number;
    writeIntBE(value: number, offset: number, byteLength: number, noAssert?: boolean): number;
    writeUInt8(value: number, offset: number, noAssert?: boolean): number;
    writeUInt16LE(value: number, offset: number, noAssert?: boolean): number;
    writeUInt16BE(value: number, offset: number, noAssert?: boolean): number;
    writeUInt32LE(value: number, offset: number, noAssert?: boolean): number;
    writeUInt32BE(value: number, offset: number, noAssert?: boolean): number;
    writeInt8(value: number, offset: number, noAssert?: boolean): number;
    writeInt16LE(value: number, offset: number, noAssert?: boolean): number;
    writeInt16BE(value: number, offset: number, noAssert?: boolean): number;
    writeInt32LE(value: number, offset: number, noAssert?: boolean): number;
    writeInt32BE(value: number, offset: number, noAssert?: boolean): number;
    writeFloatLE(value: number, offset: number, noAssert?: boolean): number;
    writeFloatBE(value: number, offset: number, noAssert?: boolean): number;
    writeDoubleLE(value: number, offset: number, noAssert?: boolean): number;
    writeDoubleBE(value: number, offset: number, noAssert?: boolean): number;
    static isEncoding(enc: string): boolean;
    static compare(a: NodeBuffer, b: NodeBuffer): number;
    static isBuffer(obj: any): obj is NodeBuffer;
    static byteLength(str: string, encoding?: string): number;
    static concat(list: NodeBuffer[], totalLength?: number): NodeBuffer;
    equals(buffer: NodeBuffer): boolean;
    compare(buffer: NodeBuffer): number;
}
export declare class SlowBuffer extends Buffer implements NodeBuffer {
    constructor(length: any, arg2?: any, arg3?: number);
    static isBuffer(obj: any): obj is NodeBuffer;
    static byteLength(str: string, encoding?: string): number;
    static concat(list: NodeBuffer[], totalLength?: number): NodeBuffer;
}
export declare var INSPECT_MAX_BYTES: number;
