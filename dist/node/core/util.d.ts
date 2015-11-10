import { FileSystem } from './file_system';
export declare var isIE: boolean;
export declare var isWebWorker: boolean;
export interface Arrayish<T> {
    [idx: number]: T;
    length: number;
}
export declare function mkdirpSync(p: string, mode: number, fs: FileSystem): void;
export declare function buffer2ArrayBuffer(buff: Buffer): ArrayBuffer;
export declare function buffer2Uint8array(buff: Buffer): Uint8Array;
export declare function buffer2Arrayish(buff: Buffer): Arrayish<number>;
export declare function arrayish2Buffer(arr: Arrayish<number>): Buffer;
export declare function uint8Array2Buffer(u8: Uint8Array): Buffer;
export declare function arrayBuffer2Buffer(ab: ArrayBuffer): Buffer;
export declare function copyingSlice(buff: Buffer, start?: number, end?: number): Buffer;
