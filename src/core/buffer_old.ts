/// <reference path="../../vendor/DefinitelyTyped/node/node.d.ts" />
import string_util = require('./string_util');
import buffer_common = require('./buffer_common');
import api_error = require('./api_error');
import buffer = require('./buffer');

var ApiError = api_error.ApiError;
var ErrorType = api_error.ErrorType;
var FLOAT_POS_INFINITY = Math.pow(2, 128);
var FLOAT_NEG_INFINITY = -1 * FLOAT_POS_INFINITY;
var FLOAT_POS_INFINITY_AS_INT = 0x7F800000;
var FLOAT_NEG_INFINITY_AS_INT = -8388608;
var FLOAT_NaN_AS_INT = 0x7fc00000;

/**
 * Emulation of Node's `Buffer` class for antiquated browsers without
 * typed array support.
 *
 * @see http://nodejs.org/api/buffer.html
 */
export class Buffer extends buffer_common.BufferCommon implements buffer.BFSBuffer {
  /**
   * Added to satisfy TypeScript NodeBuffer typing.
   */
  public static INSPECT_MAX_BYTES: number = 0;
  // buff is an array of bytes.
  // @todo This is massively inefficient from a memory standpoint (each array
  //       index could be 64bits in memory)
  public buff: number[];
  // NOTE: buff.length !== this.length
  // We may be reading into the backing array at an offset!
  public length: number;
  public offset: number = 0;

  /**
   * Constructs a buffer.
   * @param {(number|DataView|ArrayBuffer|Buffer|string)} arg1 - Instantiate a buffer of the indicated size, or
   *   from the indicated Array or String.
   * @param {string} [arg2=utf8] - Encoding to use if arg1 is a string
   */
  constructor (size: number);
  constructor (data: any[]);
  constructor (data: NodeBuffer);
  constructor (ab: ArrayBuffer); // XXX: Added to satisfy type interface.
  constructor (data: string, encoding?: string);
  constructor (arg1: any, arg2: any='utf8') {
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
      this.buff = new Array(this.length);
      // Need to explicitly initialize the array to zeroes.
      this.fill(0);
    } else if (arg1 instanceof Buffer) {
      // constructor (data: Buffer);
      this.buff = new Array(arg1.length);
      for (i = 0; i < arg1.length; i++) {
        this.buff[i] = arg1.get(i);
      }
      this.length = arg1.length;
    } else if (Array.isArray(arg1)) {
      // constructor (data: number[]);
      this.buff = arg1.slice(0);
      this.length = arg1.length;
    } else if (arg1 != null && typeof arg1 === 'object' && typeof arg1[0] === 'number') {
      // constructor (data: arrayish object)
      this.buff = new Array(arg1.length);
      this.length = arg1.length;
      for (i = 0; i < arg1.length; i++) {
        this.buff[i] = arg1[i];
      }
    } else if (typeof arg1 === 'string') {
      // constructor (data: string, encoding?: string);
      this.length = Buffer.byteLength(arg1, arg2);
      this.buff = new Array(this.length);
      this.write(arg1, 0, this.length, arg2);
    } else {
      throw new Error("Invalid argument to Buffer constructor: " + arg1);
    }
  }

  public _getByteArray(start: number, end: number): number[] {
    start += this.offset;
    end   += this.offset;
    return this.buff.slice(start, end);
  }

  public _slice(start: number, end: number): NodeBuffer {
    start += this.offset;
    end   += this.offset;
    // XXX: Bypass constructor logic; manually instantiate.
    var buff = new Buffer(0);
    buff.buff = this.buff;
    buff.offset = start;
    buff.length = end - start;
    return buff;
  }

  public _fill(value: number, start: number, end: number): void {
    for (var i = start; i < end; i++) {
      this.writeUInt8(value, i);
    }
  }

  // Numerical read/write methods
  // @todo Actually care about noAssert.

  public readUInt8(offset: number, noAssert = false): number {
    this.boundsCheck(offset);
    offset += this.offset;
    return this.buff[offset];
  }

  public readUInt16LE(offset: number, noAssert = false): number {
    this.boundsCheck(offset+1);
    offset += this.offset;
    return (this.buff[offset+1] << 8) | this.buff[offset];
  }

  public readUInt16BE(offset: number, noAssert = false): number {
    this.boundsCheck(offset+1);
    offset += this.offset;
    return (this.buff[offset] << 8) | this.buff[offset+1];
  }

  public readUInt32LE(offset: number, noAssert = false): number {
    this.boundsCheck(offset+3);
    offset += this.offset;
    return ((this.buff[offset+3] << 24) | (this.buff[offset+2] << 16) | (this.buff[offset+1] << 8) | this.buff[offset]) >>> 0;
  }

  public readUInt32BE(offset: number, noAssert = false): number {
    this.boundsCheck(offset+3);
    offset += this.offset;
    return ((this.buff[offset] << 24) | (this.buff[offset+1] << 16) | (this.buff[offset+2] << 8) | this.buff[offset+3]) >>> 0;
  }

  public readInt8(offset: number, noAssert = false): number {
    this.boundsCheck(offset);
    offset += this.offset;
    var val = this.buff[offset];
    if (val & 0x80) {
      // Sign bit is set, so perform sign extension.
      return val | 0xFFFFFF80;
    } else {
      return val;
    }
  }

  public readInt16LE(offset: number, noAssert = false): number {
    var val = this.readUInt16LE(offset, noAssert);
    if (val & 0x8000) {
      // Sign bit is set, so perform sign extension.
      return val | 0xFFFF8000;
    } else {
      return val;
    }
  }

  public readInt16BE(offset: number, noAssert = false): number {
    var val = this.readUInt16BE(offset, noAssert);
    if (val & 0x8000) {
      // Sign bit is set, so perform sign extension.
      return val | 0xFFFF8000;
    } else {
      return val;
    }
  }

  public readInt32LE(offset: number, noAssert = false): number {
    return this.readUInt32LE(offset, noAssert) | 0;
  }

  public readInt32BE(offset: number, noAssert = false): number {
    return this.readUInt32BE(offset, noAssert) | 0;
  }

  public readFloatLE(offset: number, noAssert = false): number {
    return this.intbits2float(this.readInt32LE(offset, noAssert));
  }

  public readFloatBE(offset: number, noAssert = false): number {
    return this.intbits2float(this.readInt32BE(offset, noAssert));
  }

  public readDoubleLE(offset: number, noAssert = false): number {
    this.boundsCheck(offset+7);
    return this.longbits2double(this.readInt32LE(offset+4, noAssert), this.readInt32LE(offset, noAssert));
  }

  public readDoubleBE(offset: number, noAssert = false): number {
    this.boundsCheck(offset+7);
    return this.longbits2double(this.readInt32BE(offset, noAssert), this.readInt32BE(offset+4, noAssert));
  }

  public writeUInt8(value: number, offset: number, noAssert = false): void {
    this.boundsCheck(offset);
    offset += this.offset;
    this.buff[offset] = value & 0xFF;
  }

  public writeUInt16LE(value: number, offset: number, noAssert = false): void {
    this.boundsCheck(offset+1);
    offset += this.offset;
    this.buff[offset] = value & 0xFF;
    this.buff[offset+1] = (value >> 8) & 0xFF;
  }

  public writeUInt16BE(value: number, offset: number, noAssert = false): void {
    this.boundsCheck(offset+1);
    offset += this.offset;
    this.buff[offset] = (value >> 8) & 0xFF;
    this.buff[offset+1] = value & 0xFF;
  }

  public writeUInt32LE(value: number, offset: number, noAssert = false): void {
    this.boundsCheck(offset+3);
    offset += this.offset;
    this.buff[offset] = (value >>> 0) & 0xFF;
    this.buff[offset+1] = (value >>> 8) & 0xFF;
    this.buff[offset+2] = (value >>> 16) & 0xFF;
    this.buff[offset+3] = (value >>> 24) & 0xFF;
  }

  public writeUInt32BE(value: number, offset: number, noAssert = false): void {
    this.boundsCheck(offset+3);
    offset += this.offset;
    this.buff[offset+3] = (value >>> 0) & 0xFF;
    this.buff[offset+2] = (value >>> 8) & 0xFF;
    this.buff[offset+1] = (value >>> 16) & 0xFF;
    this.buff[offset] = (value >>> 24) & 0xFF;
  }

  public writeInt8(value: number, offset: number, noAssert = false): void {
    this.boundsCheck(offset);
    offset += this.offset;
    // Pack the sign bit as the highest bit.
    // Note that we keep the highest bit in the value byte as the sign bit if it
    // exists.
    this.buff[offset] = (value & 0xFF) | ((value & 0x80000000) >>> 24);
  }

  public writeInt16LE(value: number, offset: number, noAssert = false): void {
    this.boundsCheck(offset+1);
    offset += this.offset;
    this.buff[offset] = value & 0xFF;
    // Pack the sign bit as the highest bit.
    // Note that we keep the highest bit in the value byte as the sign bit if it
    // exists.
    this.buff[offset+1] = ((value >>> 8) & 0xFF) | ((value & 0x80000000) >>> 24);
  }

  public writeInt16BE(value: number, offset: number, noAssert = false): void {
    this.boundsCheck(offset+1);
    offset += this.offset;
    this.buff[offset+1] = value & 0xFF;
    // Pack the sign bit as the highest bit.
    // Note that we keep the highest bit in the value byte as the sign bit if it
    // exists.
    this.buff[offset] = ((value >>> 8) & 0xFF) | ((value & 0x80000000) >>> 24);
  }

  public writeInt32LE(value: number, offset: number, noAssert = false): void {
    this.boundsCheck(offset+3);
    offset += this.offset;
    this.buff[offset] = value & 0xFF;
    this.buff[offset+1] = (value >>> 8) & 0xFF;
    this.buff[offset+2] = (value >>> 16) & 0xFF;
    this.buff[offset+3] = (value >>> 24) & 0xFF;
  }

  public writeInt32BE(value: number, offset: number, noAssert = false): void {
    this.boundsCheck(offset+3);
    offset += this.offset;
    this.buff[offset+3] = value & 0xFF;
    this.buff[offset+2] = (value >>> 8) & 0xFF;
    this.buff[offset+1] = (value >>> 16) & 0xFF;
    this.buff[offset] = (value >>> 24) & 0xFF;
  }

  public writeFloatLE(value: number, offset: number, noAssert = false): void {
    this.boundsCheck(offset+3);
    this.writeInt32LE(this.float2intbits(value), offset, noAssert);
  }

  public writeFloatBE(value: number, offset: number, noAssert = false): void {
    this.boundsCheck(offset+3);
    this.writeInt32BE(this.float2intbits(value), offset, noAssert);
  }

  public writeDoubleLE(value: number, offset: number, noAssert = false): void {
    this.boundsCheck(offset+7);
    var doubleBits = this.double2longbits(value);
    this.writeInt32LE(doubleBits[0], offset, noAssert);
    this.writeInt32LE(doubleBits[1], offset+4, noAssert);
  }

  public writeDoubleBE(value: number, offset: number, noAssert = false): void {
    this.boundsCheck(offset+7);
    var doubleBits = this.double2longbits(value);
    this.writeInt32BE(doubleBits[0], offset+4, noAssert);
    this.writeInt32BE(doubleBits[1], offset, noAssert);
  }

  private boundsCheck(bounds) {
    if (bounds >= this.length) {
      throw new ApiError(ErrorType.INVALID_PARAM, "Index out of bounds.");
    }
  }

  private float2intbits(f_val: number) : number {
    var exp, f_view, i_view, sig, sign;

    // Special cases!
    if (f_val === 0) {
      return 0;
    }
    // We map the infinities to JavaScript infinities. Map them back.
    if (f_val === Number.POSITIVE_INFINITY) {
      return FLOAT_POS_INFINITY_AS_INT;
    }
    if (f_val === Number.NEGATIVE_INFINITY) {
      return FLOAT_NEG_INFINITY_AS_INT;
    }
    // Convert JavaScript NaN to Float NaN value.
    if (isNaN(f_val)) {
      return FLOAT_NaN_AS_INT;
    }

    // We have more bits of precision than a float, so below we round to
    // the nearest significand. This appears to be what the x86
    // Java does for normal floating point operations.

    sign = f_val < 0 ? 1 : 0;
    f_val = Math.abs(f_val);
    // Subnormal zone!
    // (−1)^signbits×2^−126×0.significandbits
    // Largest subnormal magnitude:
    // 0000 0000 0111 1111 1111 1111 1111 1111
    // Smallest subnormal magnitude:
    // 0000 0000 0000 0000 0000 0000 0000 0001
    if (f_val <= 1.1754942106924411e-38 && f_val >= 1.4012984643248170e-45) {
      exp = 0;
      sig = Math.round((f_val / Math.pow(2, -126)) * Math.pow(2, 23));
      return (sign << 31) | (exp << 23) | sig;
    } else {
      // Regular FP numbers
      exp = Math.floor(Math.log(f_val) / Math.LN2);
      sig = Math.round((f_val / Math.pow(2, exp) - 1) * Math.pow(2, 23));
      return (sign << 31) | ((exp + 127) << 23) | sig;
    }
  }

  private double2longbits(d_val: number): number[] {
    var d_view, exp, high_bits, i_view, sig, sign;

    // Special cases
    if (d_val === 0) {
      return [0, 0];
    }
    if (d_val === Number.POSITIVE_INFINITY) {
      // High bits: 0111 1111 1111 0000 0000 0000 0000 0000
      //  Low bits: 0000 0000 0000 0000 0000 0000 0000 0000
      return [0, 2146435072];
    } else if (d_val === Number.NEGATIVE_INFINITY) {
      // High bits: 1111 1111 1111 0000 0000 0000 0000 0000
      //  Low bits: 0000 0000 0000 0000 0000 0000 0000 0000
      return [0, -1048576];
    } else if (isNaN(d_val)) {
      // High bits: 0111 1111 1111 1000 0000 0000 0000 0000
      //  Low bits: 0000 0000 0000 0000 0000 0000 0000 0000
      return [0, 2146959360];
    }
    sign = d_val < 0 ? 1 << 31 : 0;
    d_val = Math.abs(d_val);

    // Check if it is a subnormal number.
    // (-1)s × 0.f × 2-1022
    // Largest subnormal magnitude:
    // 0000 0000 0000 1111 1111 1111 1111 1111
    // 1111 1111 1111 1111 1111 1111 1111 1111
    // Smallest subnormal magnitude:
    // 0000 0000 0000 0000 0000 0000 0000 0000
    // 0000 0000 0000 0000 0000 0000 0000 0001
    if (d_val <= 2.2250738585072010e-308 && d_val >= 5.0000000000000000e-324) {
      exp = 0;
      sig = (d_val / Math.pow(2, -1022)) * Math.pow(2, 52);
    } else {
      exp = Math.floor(Math.log(d_val) / Math.LN2);
      // If d_val is close to a power of two, there's a chance that exp
      // will be 1 greater than it should due to loss of accuracy in the
      // log result.
      if (d_val < Math.pow(2, exp)) {
        exp = exp - 1;
      }
      sig = (d_val / Math.pow(2, exp) - 1) * Math.pow(2, 52);
      exp = (exp + 1023) << 20;
    }

    // Simulate >> 32
    high_bits = ((sig * Math.pow(2, -32)) | 0) | sign | exp;
    return [sig & 0xFFFF, high_bits];
  }

  private intbits2float(int32: number) {
    // Map +/- infinity to JavaScript equivalents
    if (int32 === FLOAT_POS_INFINITY_AS_INT) {
      return Number.POSITIVE_INFINITY;
    } else if (int32 === FLOAT_NEG_INFINITY_AS_INT) {
      return Number.NEGATIVE_INFINITY;
    }
    var sign = (int32 & 0x80000000) >>> 31;
    var exponent = (int32 & 0x7F800000) >>> 23;
    var significand = int32 & 0x007FFFFF;
    var value : number;
    if (exponent === 0) {  // we must denormalize!
      value = Math.pow(-1, sign) * significand * Math.pow(2, -149);
    } else {
      value = Math.pow(-1, sign) * (1 + significand * Math.pow(2, -23)) * Math.pow(2, exponent - 127);
    }
    // NaN check
    if (value < FLOAT_NEG_INFINITY || value > FLOAT_POS_INFINITY) {
      value = NaN;
    }
    return value;
  }

  private longbits2double(uint32_a: number, uint32_b: number): number {
    var sign = (uint32_a & 0x80000000) >>> 31;
    var exponent = (uint32_a & 0x7FF00000) >>> 20;
    var significand = ((uint32_a & 0x000FFFFF) * Math.pow(2, 32)) + uint32_b;

    // Special values!
    if (exponent === 0 && significand === 0) {
      return 0;
    }
    if (exponent === 2047) {
      if (significand === 0) {
        if (sign === 1) {
          return Number.NEGATIVE_INFINITY;
        }
        return Number.POSITIVE_INFINITY;
      } else {
        return NaN;
      }
    }
    if (exponent === 0)  // we must denormalize!
      return Math.pow(-1, sign) * significand * Math.pow(2, -1074);
    return Math.pow(-1, sign) * (1 + significand * Math.pow(2, -52)) * Math.pow(2, exponent - 1023);
  }
}
