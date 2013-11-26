import api_error = require('./api_error');
var FLOAT_POS_INFINITY = Math.pow(2, 128);
var FLOAT_NEG_INFINITY = -1 * FLOAT_POS_INFINITY;
var FLOAT_POS_INFINITY_AS_INT = 0x7F800000;
var FLOAT_NEG_INFINITY_AS_INT = -8388608;
var FLOAT_NaN_AS_INT = 0x7fc00000;

/**
 * The core data-writing and reading methods of any buffer.
 */
export interface BufferCore {
  /**
   * Get the size of this buffer core, in bytes.
   */
  getLength(): number;
  /**
   * Writes bottom 8 bits of the given integer at the provided index.
   */
  writeInt8(i: number, data: number): void;
  /**
   * Writes bottom 16 bits of the given integer at the provided index.
   * Little endian.
   */
  writeInt16LE(i: number, data: number): void;
  /**
   * Writes bottom 16 bits of the given integer at the provided index.
   * Big endian.
   */
  writeInt16BE(i: number, data: number): void;
  /**
   * Writes all 32 bits of the given integer at the provided index.
   * Little endian.
   */
  writeInt32LE(i: number, data: number): void;
  /**
   * Writes all 32 bits of the given integer at the provided index.
   * Big endian.
   */
  writeInt32BE(i: number, data: number): void;
  /**
   * Writes the number as an 8 bit unsigned integer.
   */
  writeUInt8(i: number, data: number): void;
  /**
   * Writes the number as a 16 bit unsigned integer.
   * Little endian.
   */
  writeUInt16LE(i: number, data: number): void;
  /**
   * Writes the number as a 16 bit unsigned integer.
   * Big endian.
   */
  writeUInt16BE(i: number, data: number): void;
  /**
   * Writes the number as a 32 bit unsigned integer.
   * Little endian.
   */
  writeUInt32LE(i: number, data: number): void;
  /**
   * Writes the number as a 32 bit unsigned integer.
   * Big endian.
   */
  writeUInt32BE(i: number, data: number): void;
  /**
   * Writes the number as a 32-bit float.
   * Little endian.
   */
  writeFloatLE(i: number, data: number): void;
  /**
   * Writes the number as a 32-bit float.
   * Big endian.
   */
  writeFloatBE(i: number, data: number): void;
  /**
   * Writes the number as a 64-bit float.
   * Little endian.
   */
  writeDoubleLE(i: number, data: number): void;
  /**
   * Writes the number as a 64-bit float.
   * Big endian.
   */
  writeDoubleBE(i: number, data: number): void;
  /**
   * Reads the byte at the given index.
   */
  readInt8(i: number): number;
  /**
   * Reads the two bytes at the given index (little endian).
   */
  readInt16LE(i: number): number;
  /**
   * Reads the two bytes at the given index (big endian).
   */
  readInt16BE(i: number): number;
  /**
   * Reads the four bytes at the given index (little endian).
   */
  readInt32LE(i: number): number;
  /**
   * Reads the four bytes at the given index (big endian).
   */
  readInt32BE(i: number): number;
  /**
   * Reads the byte at the given index as an unsigned integer.
   */
  readUInt8(i: number): number;
  /**
   * Reads the two bytes at the given index as an unsigned integer (little endian).
   */
  readUInt16LE(i: number): number;
  /**
   * Reads the two bytes at the given index as an unsigned integer (big endian).
   */
  readUInt16BE(i: number): number;
  /**
   * Reads the four bytes at the given index as an unsigned integer (little endian).
   */
  readUInt32LE(i: number): number;
  /**
   * Reads the four bytes at the given index as an unsigned integer (big endian).
   */
  readUInt32BE(i: number): number;
  /**
   * Reads a 32-bit floating point number at the given index (little endian).
   */
  readFloatLE(i: number): number;
  /**
   * Reads a 32-bit floating point number at the given index (big endian).
   */
  readFloatBE(i: number): number;
  /**
   * Reads a 64-bit floating point number at the given index (little endian).
   */
  readDoubleLE(i: number): number;
  /**
   * Reads a 64-bit floating point number at the given index (big endian).
   */
  readDoubleBE(i: number): number;
  /**
   * Copies the contents of the buffer core, from start to end, into a new
   * BufferCore.
   * (the interval [start, end)).
   */
  copy(start: number, end: number): BufferCore;
  /**
   * Fills [start, end) with the given byte value.
   */
  fill(value: number, start: number, end: number): void;
}

export interface BufferCoreImplementation {
  /**
   * The common constructor that all BufferCores need to support.
   */
  new(length: number): BufferCore;
  /**
   * Returns 'true' if the BufferCore is available in the current environment.
   */
  isAvailable(): boolean;
}

/**
 * Contains common definitions for most of the BufferCore classes.
 * Subclasses only need to implement write/readUInt8 for full functionality.
 */
export class BufferCoreCommon {
  public getLength(): number {
    throw new api_error.ApiError(api_error.ErrorCode.ENOTSUP, 'BufferCore implementations should implement getLength.');
  }
  public writeInt8(i: number, data: number): void {
    // Pack the sign bit as the highest bit.
    // Note that we keep the highest bit in the value byte as the sign bit if it
    // exists.
    this.writeUInt8(i, (data & 0xFF) | ((data & 0x80000000) >>> 24));
  }
  public writeInt16LE(i: number, data: number): void {
    this.writeUInt8(i, data & 0xFF);
    // Pack the sign bit as the highest bit.
    // Note that we keep the highest bit in the value byte as the sign bit if it
    // exists.
    this.writeUInt8(i+1, ((data >>> 8) & 0xFF) | ((data & 0x80000000) >>> 24));
  }
  public writeInt16BE(i: number, data: number): void {
    this.writeUInt8(i+1, data & 0xFF);
    // Pack the sign bit as the highest bit.
    // Note that we keep the highest bit in the value byte as the sign bit if it
    // exists.
    this.writeUInt8(i, ((data >>> 8) & 0xFF) | ((data & 0x80000000) >>> 24));
  }
  public writeInt32LE(i: number, data: number): void {
    this.writeUInt8(i, data & 0xFF);
    this.writeUInt8(i+1, (data >>> 8) & 0xFF);
    this.writeUInt8(i+2, (data >>> 16) & 0xFF);
    this.writeUInt8(i+3, (data >>> 24) & 0xFF);
  }
  public writeInt32BE(i: number, data: number): void {
    this.writeUInt8(i+3, data & 0xFF);
    this.writeUInt8(i+2, (data >>> 8) & 0xFF);
    this.writeUInt8(i+1, (data >>> 16) & 0xFF);
    this.writeUInt8(i, (data >>> 24) & 0xFF);
  }
  public writeUInt8(i: number, data: number): void {
    throw new api_error.ApiError(api_error.ErrorCode.ENOTSUP, 'BufferCore implementations should implement writeUInt8.');
  }
  public writeUInt16LE(i: number, data: number): void {
    this.writeUInt8(i, data & 0xFF);
    this.writeUInt8(i+1, (data >> 8) & 0xFF);
  }
  public writeUInt16BE(i: number, data: number): void {
    this.writeUInt8(i+1, data & 0xFF);
    this.writeUInt8(i, (data >> 8) & 0xFF);
  }
  public writeUInt32LE(i: number, data: number): void {
    this.writeInt32LE(i, data|0);
  }
  public writeUInt32BE(i: number, data: number): void {
    this.writeInt32BE(i, data|0);
  }
  public writeFloatLE(i: number, data: number): void {
    this.writeInt32LE(i, this.float2intbits(data));
  }
  public writeFloatBE(i: number, data: number): void {
    this.writeInt32BE(i, this.float2intbits(data));
  }
  public writeDoubleLE(i: number, data: number): void {
    var doubleBits = this.double2longbits(data);
    this.writeInt32LE(i, doubleBits[0]);
    this.writeInt32LE(i+4, doubleBits[1]);
  }
  public writeDoubleBE(i: number, data: number): void {
    var doubleBits = this.double2longbits(data);
    this.writeInt32BE(i+4, doubleBits[0]);
    this.writeInt32BE(i, doubleBits[1]);
  }
  public readInt8(i: number): number {
    var val = this.readUInt8(i);
    if (val & 0x80) {
      // Sign bit is set, so perform sign extension.
      return val | 0xFFFFFF80;
    } else {
      return val;
    }
  }
  public readInt16LE(i: number): number {
    var val = this.readUInt16LE(i);
    if (val & 0x8000) {
      // Sign bit is set, so perform sign extension.
      return val | 0xFFFF8000;
    } else {
      return val;
    }
  }
  public readInt16BE(i: number): number {
    var val = this.readUInt16BE(i);
    if (val & 0x8000) {
      // Sign bit is set, so perform sign extension.
      return val | 0xFFFF8000;
    } else {
      return val;
    }
  }
  public readInt32LE(i: number): number {
    return this.readUInt32LE(i) | 0;
  }
  public readInt32BE(i: number): number {
    return this.readUInt32BE(i) | 0;
  }
  public readUInt8(i: number): number {
    throw new api_error.ApiError(api_error.ErrorCode.ENOTSUP, 'BufferCore implementations should implement readUInt8.');
  }
  public readUInt16LE(i: number): number {
    return (this.readUInt8(i+1) << 8) | this.readUInt8(i);
  }
  public readUInt16BE(i: number): number {
    return (this.readUInt8(i) << 8) | this.readUInt8(i+1);
  }
  public readUInt32LE(i: number): number {
    return ((this.readUInt8(i+3) << 24) | (this.readUInt8(i+2) << 16) | (this.readUInt8(i+1) << 8) | this.readUInt8(i)) >>> 0;
  }
  public readUInt32BE(i: number): number {
    return ((this.readUInt8(i) << 24) | (this.readUInt8(i+1) << 16) | (this.readUInt8(i+2) << 8) | this.readUInt8(i+3)) >>> 0;
  }
  public readFloatLE(i: number): number {
    return this.intbits2float(this.readInt32LE(i));
  }
  public readFloatBE(i: number): number {
    return this.intbits2float(this.readInt32BE(i));
  }
  public readDoubleLE(i: number): number {
    return this.longbits2double(this.readInt32LE(i+4), this.readInt32LE(i));
  }
  public readDoubleBE(i: number): number {
    return this.longbits2double(this.readInt32BE(i), this.readInt32BE(i+4));
  }
  public copy(start: number, end: number): BufferCore {
    throw new api_error.ApiError(api_error.ErrorCode.ENOTSUP, 'BufferCore implementations should implement copy.');
  }
  public fill(value: number, start: number, end: number): void {
    // Stupid unoptimized fill: Byte-by-byte.
    for (var i = start; i < end; i++) {
      this.writeUInt8(i, value);
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
