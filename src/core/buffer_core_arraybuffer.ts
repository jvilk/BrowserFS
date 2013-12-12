import buffer_core = require('./buffer_core');

/**
 * Represents data using an ArrayBuffer.
 */
export class BufferCoreArrayBuffer extends buffer_core.BufferCoreCommon implements buffer_core.BufferCore {
  public static isAvailable(): boolean {
    return typeof DataView !== 'undefined';
  }

  private buff: DataView;
  private length: number;
  constructor(length: number);
  constructor(buff: DataView);
  constructor(buff: ArrayBuffer);
  constructor(arg1: any) {
    super();
    if (typeof arg1 === 'number') {
      this.buff = new DataView(new ArrayBuffer(arg1));
    } else if (arg1 instanceof DataView) {
      this.buff = <DataView> arg1;
    } else {
      this.buff = new DataView(<ArrayBuffer> arg1);
    }
    this.length = this.buff.byteLength;
  }
  public getLength(): number {
    return this.length;
  }
  public writeInt8(i: number, data: number): void {
    this.buff.setInt8(i, data);
  }
  public writeInt16LE(i: number, data: number): void {
    this.buff.setInt16(i, data, true);
  }
  public writeInt16BE(i: number, data: number): void {
    this.buff.setInt16(i, data, false);
  }
  public writeInt32LE(i: number, data: number): void {
    this.buff.setInt32(i, data, true);
  }
  public writeInt32BE(i: number, data: number): void {
    this.buff.setInt32(i, data, false);
  }
  public writeUInt8(i: number, data: number): void {
    this.buff.setUint8(i, data);
  }
  public writeUInt16LE(i: number, data: number): void {
    this.buff.setUint16(i, data, true);
  }
  public writeUInt16BE(i: number, data: number): void {
    this.buff.setUint16(i, data, false);
  }
  public writeUInt32LE(i: number, data: number): void {
    this.buff.setUint32(i, data, true);
  }
  public writeUInt32BE(i: number, data: number): void {
    this.buff.setUint32(i, data, false);
  }
  public writeFloatLE(i: number, data: number): void {
    this.buff.setFloat32(i, data, true);
  }
  public writeFloatBE(i: number, data: number): void {
    this.buff.setFloat32(i, data, false);
  }
  public writeDoubleLE(i: number, data: number): void {
    this.buff.setFloat64(i, data, true);
  }
  public writeDoubleBE(i: number, data: number): void {
    this.buff.setFloat64(i, data, false);
  }
  public readInt8(i: number): number {
    return this.buff.getInt8(i);
  }
  public readInt16LE(i: number): number {
    return this.buff.getInt16(i, true);
  }
  public readInt16BE(i: number): number {
    return this.buff.getInt16(i, false);
  }
  public readInt32LE(i: number): number {
    return this.buff.getInt32(i, true);
  }
  public readInt32BE(i: number): number {
    return this.buff.getInt32(i, false);
  }
  public readUInt8(i: number): number {
    return this.buff.getUint8(i);
  }
  public readUInt16LE(i: number): number {
    return this.buff.getUint16(i, true);
  }
  public readUInt16BE(i: number): number {
    return this.buff.getUint16(i, false);
  }
  public readUInt32LE(i: number): number {
    return this.buff.getUint32(i, true);
  }
  public readUInt32BE(i: number): number {
    return this.buff.getUint32(i, false);
  }
  public readFloatLE(i: number): number {
    return this.buff.getFloat32(i, true);
  }
  public readFloatBE(i: number): number {
    return this.buff.getFloat32(i, false);
  }
  public readDoubleLE(i: number): number {
    return this.buff.getFloat64(i, true);
  }
  public readDoubleBE(i: number): number {
    return this.buff.getFloat64(i, false);
  }
  public copy(start: number, end: number): buffer_core.BufferCore {
    var aBuff = this.buff.buffer;
    var newBuff: ArrayBuffer;
    // Some ArrayBuffer implementations (IE10) do not have 'slice'.
    // XXX: Type hacks - the typings don't have slice either.
    if ((<any>ArrayBuffer).prototype.slice) {
      // ArrayBuffer.slice is copying; exactly what we want.
      newBuff = (<any> aBuff).slice(start, end);
    } else {
      var len = end - start;
      newBuff = new ArrayBuffer(len);
      // Copy the old contents in.
      var newUintArray = new Uint8Array(newBuff);
      var oldUintArray = new Uint8Array(aBuff);
      newUintArray.set(oldUintArray.subarray(start, end));
    }
    return new BufferCoreArrayBuffer(newBuff);
  }
  public fill(value: number, start: number, end: number): void {
    // Value must be a byte wide.
    value = value & 0xFF;
    var i;
    var len = end - start;
    var intBytes = (((len)/4)|0)*4;
    // Optimization: Write 4 bytes at a time.
    // TODO: Could we copy 8 bytes at a time using Float64, or could we
    //       lose precision?
    var intVal = (value << 24) | (value << 16) | (value << 8) | value
    for (i = 0; i < intBytes; i += 4) {
      this.writeInt32LE(i + start, intVal);
    }
    for (i = intBytes; i < len; i++) {
      this.writeUInt8(i + start, value);
    }
  }

  /**
   * Custom method for this buffer core. Get the backing object.
   */
  public getDataView(): DataView {
    return this.buff;
  }
}

// Type-check the class.
var _: buffer_core.BufferCoreImplementation = BufferCoreArrayBuffer;
