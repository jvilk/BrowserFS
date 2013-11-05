/// <reference path="../../vendor/DefinitelyTyped/node/node.d.ts" />
import string_util = require('./string_util');
import buffer_common = require('./buffer_common');
import buffer = require('./buffer');

/**
 * Emulation of Node's `Buffer` class. Normally, this is declared globally, but I
 * make that behavior optional.
 *
 * The buffer is backed by a `DataView`; we have a polyfill in `vendor` that
 * handles compatibility for us.
 *
 * @see http://nodejs.org/api/buffer.html
 * @todo Add option to add array accessors, if someone doesn't mind the *huge*
 *       speed hit for compatibility.
 * @class
 */
export class Buffer extends buffer_common.BufferCommon implements buffer.BFSBuffer {
  /**
   * Added to satisfy TypeScript NodeBuffer typing.
   */
  public static INSPECT_MAX_BYTES: number = 0;
  // XXX: :| HTML5FS directly copies this.
  public buff: DataView;
  public length: number;

  /**
   * Constructs a buffer.
   * @param {(number|DataView|ArrayBuffer|Buffer|string)} arg1 - Instantiate a buffer of the indicated size, or
   *   from the indicated Array or String.
   * @param {string} [arg2=utf8] - Encoding to use if arg1 is a string
   */
  constructor (size: number);
  constructor (data: any[]);
  constructor (data: DataView);
  constructor (data: ArrayBuffer);
  constructor (data: NodeBuffer);
  constructor (data: string, encoding?: string);
  constructor (arg1: any, arg2='utf8') {
    super();
    var i;
    // Node apparently allows you to construct buffers w/o 'new'.
    if (!(this instanceof Buffer)) {
      return new Buffer(arg1, arg2);
    }

    if (typeof arg1 === 'number') {
      // constructor (size: number);
      if (arg1 !== (arg1 >>> 0)) {
        throw new TypeError('Buffer size must be a uint32.');
      }
      this.length = arg1;
      this.buff = new DataView(new ArrayBuffer(this.length));
    } else if (arg1 instanceof DataView) {
      // constructor (data: DataView);
      this.buff = arg1;
      this.length = arg1.byteLength;
    } else if (arg1 instanceof ArrayBuffer) {
      // constructor (data: ArrayBuffer);
      this.buff = new DataView(arg1);
      this.length = arg1.byteLength;
    } else if (arg1 instanceof Buffer) {
      // constructor (data: Buffer);
      this.buff = new DataView(new ArrayBuffer(arg1.length));
      for (i = 0; i < arg1.length; i++) {
        this.buff.setUint8(i, arg1.get(i));
      }
      this.length = arg1.length;
    } else if (Array.isArray(arg1) || (arg1 != null && typeof arg1 === 'object' && typeof arg1[0] === 'number')) {
      // constructor (data: number[]);
      this.buff = new DataView(new ArrayBuffer(arg1.length));
      for (i = 0; i < arg1.length; i++) {
        this.buff.setUint8(i, arg1[i]);
      }
      this.length = arg1.length;
    } else if (typeof arg1 === 'string') {
      // constructor (data: string, encoding?: string);
      this.length = Buffer.byteLength(arg1, arg2);
      this.buff = new DataView(new ArrayBuffer(this.length));
      this.write(arg1, 0, this.length, arg2);
    } else {
      throw new Error("Invalid argument to Buffer constructor: " + arg1);
    }
  }

  public _getByteArray(start: number, end: number): number[] {
    var len = end - start;
    var byteArr = new Array(len);
    for (var i = 0; i < len; i++) {
      byteArr[i] = this.readUInt8(start + i);
    }
    return byteArr;
  }

  public _slice(start: number, end: number): NodeBuffer {
    return new Buffer(new DataView(this.buff.buffer, this.buff.byteOffset + start, end - start));
  }

  public _fill(value: number, start: number, end: number): void {
    var i;
    var val32 = value | (value << 8) | (value << 16) | (value << 24);
    var num32 = Math.floor((end - start) / 4);
    var remSt = start + num32 * 4;
    // OPTIMIZATION: 4X faster to write 32 bits at a time.
    for (i = 0; i < num32; i++) {
      this.writeUInt32LE(val32, start + i * 4);
    }
    for (i = remSt; i < end; i++) {
      this.writeUInt8(value, i);
    }
  }

  // Numerical read/write methods
  // @todo Actually care about noAssert.

  public readUInt8(offset: number, noAssert = false): number {
    return this.buff.getUint8(offset);
  }

  public readUInt16LE(offset: number, noAssert = false): number {
    return this.buff.getUint16(offset, true);
  }

  public readUInt16BE(offset: number, noAssert = false): number {
    return this.buff.getUint16(offset, false);
  }

  public readUInt32LE(offset: number, noAssert = false): number {
    return this.buff.getUint32(offset, true);
  }

  public readUInt32BE(offset: number, noAssert = false): number {
    return this.buff.getUint32(offset, false);
  }

  public readInt8(offset: number, noAssert = false): number {
    return this.buff.getInt8(offset);
  }

  public readInt16LE(offset: number, noAssert = false): number {
    return this.buff.getInt16(offset, true);
  }

  public readInt16BE(offset: number, noAssert = false): number {
    return this.buff.getInt16(offset, false);
  }

  public readInt32LE(offset: number, noAssert = false): number {
    return this.buff.getInt32(offset, true);
  }

  public readInt32BE(offset: number, noAssert = false): number {
    return this.buff.getInt32(offset, false);
  }

  public readFloatLE(offset: number, noAssert = false): number {
    return this.buff.getFloat32(offset, true);
  }

  public readFloatBE(offset: number, noAssert = false): number {
    return this.buff.getFloat32(offset, false);
  }

  public readDoubleLE(offset: number, noAssert = false): number {
    return this.buff.getFloat64(offset, true);
  }

  public readDoubleBE(offset: number, noAssert = false): number {
    return this.buff.getFloat64(offset, false);
  }

  public writeUInt8(value: number, offset: number, noAssert = false): void {
    this.buff.setUint8(offset, value);
  }

  public writeUInt16LE(value: number, offset: number, noAssert = false): void {
    this.buff.setUint16(offset, value, true);
  }

  public writeUInt16BE(value: number, offset: number, noAssert = false): void {
    this.buff.setUint16(offset, value, false);
  }

  public writeUInt32LE(value: number, offset: number, noAssert = false): void {
    this.buff.setUint32(offset, value, true);
  }

  public writeUInt32BE(value: number, offset: number, noAssert = false): void {
    this.buff.setUint32(offset, value, false);
  }

  public writeInt8(value: number, offset: number, noAssert = false): void {
    this.buff.setInt8(offset, value);
  }

  public writeInt16LE(value: number, offset: number, noAssert = false): void {
    this.buff.setInt16(offset, value, true);
  }

  public writeInt16BE(value: number, offset: number, noAssert = false): void {
    this.buff.setInt16(offset, value, false);
  }

  public writeInt32LE(value: number, offset: number, noAssert = false): void {
    this.buff.setInt32(offset, value, true);
  }

  public writeInt32BE(value: number, offset: number, noAssert = false): void {
    this.buff.setInt32(offset, value, false);
  }

  public writeFloatLE(value: number, offset: number, noAssert = false): void {
    this.buff.setFloat32(offset, value, true);
  }

  public writeFloatBE(value: number, offset: number, noAssert = false): void {
    this.buff.setFloat32(offset, value, false);
  }

  public writeDoubleLE(value: number, offset: number, noAssert = false): void {
    this.buff.setFloat64(offset, value, true);
  }

  public writeDoubleBE(value: number, offset: number, noAssert = false): void {
    this.buff.setFloat64(offset, value, false);
  }
}
