import buffer_core = require('./buffer_core');

// Used to clear segments of an array index.
var clearMasks: number[] = [0xFFFFFF00, 0xFFFF00FF, 0xFF00FFFF, 0x00FFFFFF];

/**
 * Implementation of BufferCore that is backed by an array of 32-bit ints.
 * Data is stored little endian.
 * Example: Bytes 0 through 3 are present in the first int:
 *  BYTE 3      BYTE 2      BYTE 1      BYTE 0
 * 0000 0000 | 0000 0000 | 0000 0000 | 0000 0000
 */
export class BufferCoreArray extends buffer_core.BufferCoreCommon implements buffer_core.BufferCore {
  public static isAvailable(): boolean {
    return true;
  }

  private buff: number[];
  private length: number;
  constructor(length: number) {
    super();
    this.length = length;
    this.buff = new Array(Math.ceil(length/4));
    // Zero-fill the array.
    var bufflen = this.buff.length;
    for (var i = 0; i < bufflen; i++) {
      this.buff[i] = 0;
    }
  }
  public getLength(): number {
    return this.length;
  }
  public writeUInt8(i: number, data: number): void {
    data &= 0xFF;
    // Which int? (Equivalent to (i/4)|0)
    var arrIdx = i >> 2;
    // Which offset? (Equivalent to i - arrIdx*4)
    var intIdx = i & 3;
    this.buff[arrIdx] = this.buff[arrIdx] & clearMasks[intIdx];
    this.buff[arrIdx] = this.buff[arrIdx] | (data << (intIdx << 3));
  }
  public readUInt8(i: number): number {
    // Which int?
    var arrIdx = i >> 2;
    // Which offset?
    var intIdx = i & 3;
    // Bring the data we want into the lowest 8 bits, and truncate.
    return (this.buff[arrIdx] >> (intIdx << 3)) & 0xFF;
  }
  public copy(start: number, end: number): buffer_core.BufferCore {
    // Stupid unoptimized copy. Later, we could do optimizations when aligned.
    var newBC = new BufferCoreArray(end - start);
    for (var i = start; i < end; i++) {
      newBC.writeUInt8(i - start, this.readUInt8(i));
    }
    return newBC;
  }
}

// Type-check the class.
var _: buffer_core.BufferCoreImplementation = BufferCoreArray;
