/**
 * Grab bag of utility functions used across the code.
 */
import {FileSystem} from './file_system';
import * as path from 'path';

/**
 * Checks for any IE version, including IE11 which removed MSIE from the
 * userAgent string.
 */
export const isIE: boolean = typeof navigator !== "undefined" && !!(/(msie) ([\w.]+)/.exec(navigator.userAgent.toLowerCase()) || navigator.userAgent.indexOf('Trident') !== -1);

/**å
 * Check if we're in a web worker.
 */
export const isWebWorker: boolean = typeof window === "undefined";

export interface Arrayish<T> {
  [idx: number]: T;
  length: number;
}

/**
 * Synchronous recursive makedir.
 */
export function mkdirpSync(p: string, mode: number, fs: FileSystem): void {
  if (!fs.existsSync(p)) {
    mkdirpSync(path.dirname(p), mode, fs);
    fs.mkdirSync(p, mode);
  }
}

/**
 * Converts a buffer into an array buffer. Attempts to do so in a
 * zero-copy manner, e.g. the array references the same memory.
 */
export function buffer2ArrayBuffer(buff: Buffer): ArrayBuffer {
  const u8 = buffer2Uint8array(buff),
    u8offset = u8.byteOffset,
    u8Len = u8.byteLength;
  if (u8offset === 0 && u8Len === u8.buffer.byteLength) {
    return u8.buffer;
  } else {
    return u8.buffer.slice(u8offset, u8offset + u8Len);
  }
}

/**
 * Converts a buffer into a Uint8Array. Attempts to do so in a
 * zero-copy manner, e.g. the array references the same memory.
 */
export function buffer2Uint8array(buff: Buffer): Uint8Array {
  if (buff instanceof Uint8Array) {
    // BFS & Node v4.0 buffers *are* Uint8Arrays.
    return <any> buff;
  } else {
    // Uint8Arrays can be constructed from arrayish numbers.
    // At this point, we assume this isn't a BFS array.
    return new Uint8Array(buff);
  }
}

/**
 * Converts the given arrayish object into a Buffer. Attempts to
 * be zero-copy.
 */
export function arrayish2Buffer(arr: Arrayish<number>): Buffer {
  if (arr instanceof Buffer) {
    return arr;
  } else if (arr instanceof Uint8Array) {
    return uint8Array2Buffer(arr);
  } else {
    return new Buffer(<number[]> arr);
  }
}

/**
 * Converts the given Uint8Array into a Buffer. Attempts to be zero-copy.
 */
export function uint8Array2Buffer(u8: Uint8Array): Buffer {
  if (u8 instanceof Buffer) {
    return u8;
  } else if (u8.byteOffset === 0 && u8.byteLength === u8.buffer.byteLength) {
    return arrayBuffer2Buffer(u8.buffer);
  } else {
    return new Buffer(u8);
  }
}

/**
 * Converts the given array buffer into a Buffer. Attempts to be
 * zero-copy.
 */
export function arrayBuffer2Buffer(ab: ArrayBuffer): Buffer {
  try {
    // Works in BFS and Node v4.2.
    return new Buffer(<any> ab);
  } catch (e) {
    // I believe this copies, but there's no avoiding it in Node < v4.2
    return new Buffer(new Uint8Array(ab));
  }
}

/**
 * Copies a slice of the given buffer
 */
export function copyingSlice(buff: Buffer, start: number = 0, end = buff.length): Buffer {
  if (start < 0 || end < 0 || end > buff.length || start > end) {
    throw new TypeError(`Invalid slice bounds on buffer of length ${buff.length}: [${start}, ${end}]`);
  }
  if (buff.length === 0) {
    // Avoid s0 corner case in ArrayBuffer case.
    return new Buffer(0);
  } else {
    let u8 = buffer2Uint8array(buff),
      s0 = buff[0],
      newS0 = (s0 + 1) % 0xFF;

    buff[0] = newS0;
    if (u8[0] === newS0) {
      // Same memory. Revert & copy.
      u8[0] = s0;
      return uint8Array2Buffer(u8.slice(start, end));
    } else {
      // Revert.
      buff[0] = s0;
      return uint8Array2Buffer(u8.subarray(start, end));
    }
  }
}
