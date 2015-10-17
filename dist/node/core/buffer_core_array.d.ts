import buffer_core = require('./buffer_core');
export declare class BufferCoreArray extends buffer_core.BufferCoreCommon implements buffer_core.BufferCore {
    static isAvailable(): boolean;
    static name: string;
    private buff;
    private length;
    constructor(length: number);
    getLength(): number;
    writeUInt8(i: number, data: number): void;
    readUInt8(i: number): number;
    copy(start: number, end: number): buffer_core.BufferCore;
}
