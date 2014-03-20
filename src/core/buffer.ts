/**
 * Buffer module. Exports an appropriate version of Buffer for the current
 * platform.
 */
import buffer_core = require('./buffer_core');
import buffer_core_array = require('./buffer_core_array');
import buffer_core_arraybuffer = require('./buffer_core_arraybuffer');
import buffer_core_imagedata = require('./buffer_core_imagedata');
import string_util = require('./string_util');

// BC implementations earlier in the array are preferred.
var BufferCorePreferences: buffer_core.BufferCoreImplementation[] = [
  buffer_core_arraybuffer.BufferCoreArrayBuffer,
  buffer_core_imagedata.BufferCoreImageData,
  buffer_core_array.BufferCoreArray
];

var PreferredBufferCore: buffer_core.BufferCoreImplementation = (function(): buffer_core.BufferCoreImplementation {
  var i: number, bci: buffer_core.BufferCoreImplementation;
  for (i = 0; i < BufferCorePreferences.length; i++) {
    bci = BufferCorePreferences[i];
    if (bci.isAvailable()) return bci;
  }
  // Should never happen; Array works in all browsers.
  throw new Error("This browser does not support any available BufferCore implementations.");
})();

/**
 * We extend Node's buffer interface to account for differences in the browser
 * environment.
 */
export interface BFSBuffer extends NodeBuffer {
  // It's not tractable to emulate array indexing by defining numeric properties
  // for each index of the buffer, so we have getters/setters.
  get(index: number): number;
  set(index: number, value: number): void;
  // Used by backends to get the backing data.
  getBufferCore(): buffer_core.BufferCore;
  // Used by backends in conjunction with getBufferCore() and the length
  // property to determine which segment of the backing memory is applicable
  // for a given operation.
  getOffset(): number;
  // Like Buffer.slice, but copies the Buffer contents.
  sliceCopy(start?: number, end?: number): NodeBuffer
}

/**
 * Superset of the Buffer singleton described in node.d.ts.
 */
export interface BFSBufferImplementation {
  new (ab: ArrayBuffer): NodeBuffer;
  new (str: string, encoding?: string): NodeBuffer;
  new (size: number): NodeBuffer;
  new (array: any[]): NodeBuffer;
  isBuffer(obj: any): boolean;
  byteLength(string: string, encoding?: string): number;
  concat(list: NodeBuffer[], totalLength?: number): NodeBuffer;
}

/**
 * Emulates Node's Buffer API. Wraps a BufferCore object that is responsible
 * for actually writing/reading data from some data representation in memory.
 */
export class Buffer implements BFSBuffer {
  // Note: This array property is *not* true, but it's required to satisfy
  //       TypeScript typings.
  [idx: number]: number;
  private data: buffer_core.BufferCore;
  private offset: number = 0;
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
  constructor (data: buffer_core.BufferCore, start?: number, end?: number);
  constructor (arg1: any, arg2: any = 'utf8', arg3?: number) {
    var i;
    // Node apparently allows you to construct buffers w/o 'new'.
    if (!(this instanceof Buffer)) {
      return new Buffer(arg1, arg2);
    }

    if (arg1 instanceof buffer_core.BufferCoreCommon) {
      // constructor (data: buffer_core.BufferCore, start?: number, end?: number)
      this.data = <buffer_core.BufferCore> arg1;
      var start = typeof arg2 === 'number' ? <number><any> arg2 : 0;
      var end = typeof arg3 === 'number' ? <number> arg3 : this.data.getLength();
      this.offset = start;
      this.length = end - start;
    } else if (typeof arg1 === 'number') {
      // constructor (size: number);
      if (arg1 !== (arg1 >>> 0)) {
        throw new TypeError('Buffer size must be a uint32.');
      }
      this.length = arg1;
      this.data = new PreferredBufferCore(arg1);
    } else if (typeof DataView !== 'undefined' && arg1 instanceof DataView) {
      // constructor (data: DataView);
      this.data = new buffer_core_arraybuffer.BufferCoreArrayBuffer(<DataView> arg1);
      this.length = arg1.byteLength;
    } else if (typeof ArrayBuffer !== 'undefined' && arg1 instanceof ArrayBuffer) {
      // constructor (data: ArrayBuffer);
      this.data = new buffer_core_arraybuffer.BufferCoreArrayBuffer(<ArrayBuffer> arg1);
      this.length = arg1.byteLength;
    } else if (arg1 instanceof Buffer) {
      // constructor (data: Buffer);
      var argBuff = <Buffer> arg1;
      this.data = new PreferredBufferCore(arg1.length);
      this.length = arg1.length;
      argBuff.copy(this);
    } else if (Array.isArray(arg1) || (arg1 != null && typeof arg1 === 'object' && typeof arg1[0] === 'number')) {
      // constructor (data: number[]);
      this.data = new PreferredBufferCore(arg1.length);
      for (i = 0; i < arg1.length; i++) {
        this.data.writeUInt8(i, arg1[i]);
      }
      this.length = arg1.length;
    } else if (typeof arg1 === 'string') {
      // constructor (data: string, encoding?: string);
      this.length = Buffer.byteLength(arg1, arg2);
      this.data = new PreferredBufferCore(this.length);
      this.write(arg1, 0, this.length, arg2);
    } else {
      throw new Error("Invalid argument to Buffer constructor: " + arg1);
    }
  }

  public getBufferCore(): buffer_core.BufferCore {
    return this.data;
  }

  public getOffset(): number {
    return this.offset;
  }

  /**
   * **NONSTANDARD**: Set the octet at index. Emulates NodeJS buffer's index
   * operation. Octet can be signed or unsigned.
   * @param {number} index - the index to set the value at
   * @param {number} value - the value to set at the given index
   */
  public set(index: number, value: number): void {
    // In Node, the following happens:
    // buffer[0] = -1;
    // buffer[0]; // 255
    if (value < 0) {
      return this.writeInt8(value, index);
    } else {
      return this.writeUInt8(value, index);
    }
  }

  /**
   * **NONSTANDARD**: Get the octet at index.
   * @param {number} index - index to fetch the value at
   * @return {number} the value at the given index
   */
  public get(index: number): number {
    return this.readUInt8(index);
  }

  /**
   * Writes string to the buffer at offset using the given encoding.
   * If buffer did not contain enough space to fit the entire string, it will
   * write a partial amount of the string.
   * @param {string} str - Data to be written to buffer
   * @param {number} [offset=0] - Offset in the buffer to write to
   * @param {number} [length=this.length] - Number of bytes to write
   * @param {string} [encoding=utf8] - Character encoding
   * @return {number} Number of octets written.
   */
  public write(str: string, offset = 0, length = this.length, encoding = 'utf8'): number {
    // I hate Node's optional arguments.
    if (typeof offset === 'string') {
      // 'str' and 'encoding' specified
      encoding = "" + offset;
      offset = 0;
      length = this.length;
    } else if (typeof length === 'string') {
      // 'str', 'offset', and 'encoding' specified
      encoding = "" + length;
      length = this.length;
    }
    // Don't waste our time if the offset is beyond the buffer length
    if (offset >= this.length) {
      return 0;
    }
    var strUtil = string_util.FindUtil(encoding);
    // Are we trying to write past the buffer?
    length = length + offset > this.length ? this.length - offset : length;
    offset += this.offset;
    return strUtil.str2byte(str,
      // Avoid creating a slice unless it's needed.
      offset === 0 && length === this.length ? this : new Buffer(this.data, offset, length + offset));
  }

  /**
   * Decodes a portion of the Buffer into a String.
   * @param {string} encoding - Character encoding to decode to
   * @param {number} [start=0] - Start position in the buffer
   * @param {number} [end=this.length] - Ending position in the buffer
   * @return {string} A string from buffer data encoded with encoding, beginning
   *   at start, and ending at end.
   */
  public toString(encoding = 'utf8', start = 0, end = this.length): string {
    if (!(start <= end)) {
      throw new Error("Invalid start/end positions: " + start + " - " + end);
    }
    if (start === end) {
      return '';
    }
    if (end > this.length) {
      end = this.length;
    }
    var strUtil = string_util.FindUtil(encoding);
    // Get the string representation of the given slice. Create a new buffer
    // if need be.
    return strUtil.byte2str(start === 0 && end === this.length ? this : new Buffer(this.data, start + this.offset, end + this.offset));
  }

  /**
   * Returns a JSON-representation of the Buffer instance, which is identical to
   * the output for JSON Arrays. JSON.stringify implicitly calls this function
   * when stringifying a Buffer instance.
   * @return {object} An object that can be used for JSON stringification.
   */
  public toJSON(): {type: string; data: number[]} {
    // Construct a byte array for the JSON 'data'.
    var len = this.length;
    var byteArr = new Array(len);
    for (var i = 0; i < len; i++) {
      byteArr[i] = this.readUInt8(i);
    }
    return {
      type: 'Buffer',
      data: byteArr
    };
  }

  /**
   * Does copy between buffers. The source and target regions can be overlapped.
   * All values passed that are undefined/NaN or are out of bounds are set equal
   * to their respective defaults.
   * @param {Buffer} target - Buffer to copy into
   * @param {number} [targetStart=0] - Index to start copying to in the targetBuffer
   * @param {number} [sourceStart=0] - Index in this buffer to start copying from
   * @param {number} [sourceEnd=this.length] - Index in this buffer stop copying at
   * @return {number} The number of bytes copied into the target buffer.
   */
  public copy(target: NodeBuffer, targetStart = 0, sourceStart = 0, sourceEnd = this.length): number {
    // The Node code is weird. It sets some out-of-bounds args to their defaults
    // and throws exceptions for others (sourceEnd).
    targetStart = targetStart < 0 ? 0 : targetStart;
    sourceStart = sourceStart < 0 ? 0 : sourceStart;

    // Need to sanity check all of the input. Node has really odd rules regarding
    // when to apply default arguments. I decided to copy Node's logic.
    if (sourceEnd < sourceStart) {
      throw new RangeError('sourceEnd < sourceStart');
    }
    if (sourceEnd === sourceStart) {
      return 0;
    }
    if (targetStart >= target.length) {
      throw new RangeError('targetStart out of bounds');
    }
    if (sourceStart >= this.length) {
      throw new RangeError('sourceStart out of bounds');
    }
    if (sourceEnd > this.length) {
      throw new RangeError('sourceEnd out of bounds');
    }
    var bytesCopied = Math.min(sourceEnd - sourceStart, target.length - targetStart, this.length - sourceStart);
    // TODO: Optimize.
    for (var i = 0; i < bytesCopied; i++) {
      target.writeUInt8(this.readUInt8(sourceStart + i), targetStart + i);
    }
    return bytesCopied;
  }

  /**
   * Returns a slice of this buffer.
   * @param {number} [start=0] - Index to start slicing from
   * @param {number} [end=this.length] - Index to stop slicing at
   * @return {Buffer} A new buffer which references the same
   *   memory as the old, but offset and cropped by the start (defaults to 0) and
   *   end (defaults to buffer.length) indexes. Negative indexes start from the end
   *   of the buffer.
   */
  public slice(start = 0, end = this.length): NodeBuffer {
    // Translate negative indices to positive ones.
    if (start < 0) {
      start += this.length;
      if (start < 0) {
        start = 0;
      }
    }
    if (end < 0) {
      end += this.length;
      if (end < 0) {
        end = 0;
      }
    }
    if (end > this.length) {
      end = this.length;
    }
    if (start > end) {
      start = end;
    }

    // Sanity check.
    if (start < 0 || end < 0 || start >= this.length || end > this.length) {
      throw new Error("Invalid slice indices.");
    }
    // Create a new buffer backed by the same BufferCore.
    return new Buffer(this.data, start + this.offset, end + this.offset);
  }

  /**
   * [NONSTANDARD] A copy-based version of Buffer.slice.
   */
  public sliceCopy(start: number = 0, end: number = this.length): NodeBuffer {
    // Translate negative indices to positive ones.
    if (start < 0) {
      start += this.length;
      if (start < 0) {
        start = 0;
      }
    }
    if (end < 0) {
      end += this.length;
      if (end < 0) {
        end = 0;
      }
    }
    if (end > this.length) {
      end = this.length;
    }
    if (start > end) {
      start = end;
    }

    // Sanity check.
    if (start < 0 || end < 0 || start >= this.length || end > this.length) {
      throw new Error("Invalid slice indices.");
    }

    // Copy the BufferCore.
    return new Buffer(this.data.copy(start + this.offset, end + this.offset));
  }

  /**
   * Fills the buffer with the specified value. If the offset and end are not
   * given it will fill the entire buffer.
   * @param {(string|number)} value - The value to fill the buffer with
   * @param {number} [offset=0]
   * @param {number} [end=this.length]
   */
  public fill(value: any, offset = 0, end = this.length): void {
    var i;
    var valType = typeof value;
    switch (valType) {
      case "string":
        // Trim to a byte.
        value = value.charCodeAt(0) & 0xFF;
        break;
      case "number":
        break;
      default:
        throw new Error('Invalid argument to fill.');
    }
    offset += this.offset;
    end += this.offset;
    this.data.fill(value, offset, end);
  }

  public readUInt8(offset: number, noAssert = false): number {
    offset += this.offset;
    return this.data.readUInt8(offset);
  }

  public readUInt16LE(offset: number, noAssert = false): number {
    offset += this.offset;
    return this.data.readUInt16LE(offset);
  }

  public readUInt16BE(offset: number, noAssert = false): number {
    offset += this.offset;
    return this.data.readUInt16BE(offset);
  }

  public readUInt32LE(offset: number, noAssert = false): number {
    offset += this.offset;
    return this.data.readUInt32LE(offset);
  }

  public readUInt32BE(offset: number, noAssert = false): number {
    offset += this.offset;
    return this.data.readUInt32BE(offset);
  }

  public readInt8(offset: number, noAssert = false): number {
    offset += this.offset;
    return this.data.readInt8(offset);
  }

  public readInt16LE(offset: number, noAssert = false): number {
    offset += this.offset;
    return this.data.readInt16LE(offset);
  }

  public readInt16BE(offset: number, noAssert = false): number {
    offset += this.offset;
    return this.data.readInt16BE(offset);
  }

  public readInt32LE(offset: number, noAssert = false): number {
    offset += this.offset;
    return this.data.readInt32LE(offset);
  }

  public readInt32BE(offset: number, noAssert = false): number {
    offset += this.offset;
    return this.data.readInt32BE(offset);
  }

  public readFloatLE(offset: number, noAssert = false): number {
    offset += this.offset;
    return this.data.readFloatLE(offset);
  }

  public readFloatBE(offset: number, noAssert = false): number {
    offset += this.offset;
    return this.data.readFloatBE(offset);
  }

  public readDoubleLE(offset: number, noAssert = false): number {
    offset += this.offset;
    return this.data.readDoubleLE(offset);
  }

  public readDoubleBE(offset: number, noAssert = false): number {
    offset += this.offset;
    return this.data.readDoubleBE(offset);
  }

  public writeUInt8(value: number, offset: number, noAssert = false): void {
    offset += this.offset;
    this.data.writeUInt8(offset, value);
  }

  public writeUInt16LE(value: number, offset: number, noAssert = false): void {
    offset += this.offset;
    this.data.writeUInt16LE(offset, value);
  }

  public writeUInt16BE(value: number, offset: number, noAssert = false): void {
    offset += this.offset;
    this.data.writeUInt16BE(offset, value);
  }

  public writeUInt32LE(value: number, offset: number, noAssert = false): void {
    offset += this.offset;
    this.data.writeUInt32LE(offset, value);
  }

  public writeUInt32BE(value: number, offset: number, noAssert = false): void {
    offset += this.offset;
    this.data.writeUInt32BE(offset, value);
  }

  public writeInt8(value: number, offset: number, noAssert = false): void {
    offset += this.offset;
    this.data.writeInt8(offset, value);
  }

  public writeInt16LE(value: number, offset: number, noAssert = false): void {
    offset += this.offset;
    this.data.writeInt16LE(offset, value);
  }

  public writeInt16BE(value: number, offset: number, noAssert = false): void {
    offset += this.offset;
    this.data.writeInt16BE(offset, value);
  }

  public writeInt32LE(value: number, offset: number, noAssert = false): void {
    offset += this.offset;
    this.data.writeInt32LE(offset, value);
  }

  public writeInt32BE(value: number, offset: number, noAssert = false): void {
    offset += this.offset;
    this.data.writeInt32BE(offset, value);
  }

  public writeFloatLE(value: number, offset: number, noAssert = false): void {
    offset += this.offset;
    this.data.writeFloatLE(offset, value);
  }

  public writeFloatBE(value: number, offset: number, noAssert = false): void {
    offset += this.offset;
    this.data.writeFloatBE(offset, value);
  }

  public writeDoubleLE(value: number, offset: number, noAssert = false): void {
    offset += this.offset;
    this.data.writeDoubleLE(offset, value);
  }

  public writeDoubleBE(value: number, offset: number, noAssert = false): void {
    offset += this.offset;
    this.data.writeDoubleBE(offset, value);
  }

  ///**************************STATIC METHODS********************************///

  /**
   * Checks if enc is a valid string encoding type.
   * @param {string} enc - Name of a string encoding type.
   * @return {boolean} Whether or not enc is a valid encoding type.
   */
  public static isEncoding(enc: string): boolean {
    try {
      string_util.FindUtil(enc);
    } catch (e) {
      return false;
    }
    return true;
  }

  /**
   * Tests if obj is a Buffer.
   * @param {object} obj - An arbitrary object
   * @return {boolean} True if this object is a Buffer.
   */
  public static isBuffer(obj: any): boolean {
    return obj instanceof Buffer;
  }

  /**
   * Gives the actual byte length of a string. This is not the same as
   * String.prototype.length since that returns the number of characters in a
   * string.
   * @param {string} str - The string to get the byte length of
   * @param {string} [encoding=utf8] - Character encoding of the string
   * @return {number} The number of bytes in the string
   */
  public static byteLength(str: string, encoding: string = 'utf8'): number {
    var strUtil = string_util.FindUtil(encoding);
    return strUtil.byteLength(str);
  }

  /**
   * Returns a buffer which is the result of concatenating all the buffers in the
   * list together.
   * If the list has no items, or if the totalLength is 0, then it returns a
   * zero-length buffer.
   * If the list has exactly one item, then the first item of the list is
   * returned.
   * If the list has more than one item, then a new Buffer is created.
   * If totalLength is not provided, it is read from the buffers in the list.
   * However, this adds an additional loop to the function, so it is faster to
   * provide the length explicitly.
   * @param {Buffer[]} list - List of Buffer objects to concat
   * @param {number} [totalLength] - Total length of the buffers when concatenated
   * @return {Buffer}
   */
  public static concat(list: NodeBuffer[], totalLength?: number): NodeBuffer {
    var item;
    if (list.length === 0 || totalLength === 0) {
      return new Buffer(0);
    } else if (list.length === 1) {
      return list[0];
    } else {
      if (totalLength == null) {
        // Calculate totalLength
        totalLength = 0;
        for (var i = 0; i < list.length; i++) {
          item = list[i];
          totalLength += item.length;
        }
      }
      var buf = new Buffer(totalLength);
      var curPos = 0;
      for (var j = 0; j < list.length; j++) {
        item = list[j];
        curPos += item.copy(buf, curPos);
      }
      return buf;
    }
  }
}

// Type-check the class.
var _: BFSBufferImplementation = Buffer;
