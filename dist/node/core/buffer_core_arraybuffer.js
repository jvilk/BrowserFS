var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var buffer_core = require('./buffer_core');
var BufferCoreArrayBuffer = (function (_super) {
    __extends(BufferCoreArrayBuffer, _super);
    function BufferCoreArrayBuffer(arg1) {
        _super.call(this);
        if (typeof arg1 === 'number') {
            this.buff = new DataView(new ArrayBuffer(arg1));
        }
        else if (arg1 instanceof DataView) {
            this.buff = arg1;
        }
        else {
            this.buff = new DataView(arg1);
        }
        this.length = this.buff.byteLength;
    }
    BufferCoreArrayBuffer.isAvailable = function () {
        return typeof DataView !== 'undefined';
    };
    BufferCoreArrayBuffer.prototype.getLength = function () {
        return this.length;
    };
    BufferCoreArrayBuffer.prototype.writeInt8 = function (i, data) {
        this.buff.setInt8(i, data);
    };
    BufferCoreArrayBuffer.prototype.writeInt16LE = function (i, data) {
        this.buff.setInt16(i, data, true);
    };
    BufferCoreArrayBuffer.prototype.writeInt16BE = function (i, data) {
        this.buff.setInt16(i, data, false);
    };
    BufferCoreArrayBuffer.prototype.writeInt32LE = function (i, data) {
        this.buff.setInt32(i, data, true);
    };
    BufferCoreArrayBuffer.prototype.writeInt32BE = function (i, data) {
        this.buff.setInt32(i, data, false);
    };
    BufferCoreArrayBuffer.prototype.writeUInt8 = function (i, data) {
        this.buff.setUint8(i, data);
    };
    BufferCoreArrayBuffer.prototype.writeUInt16LE = function (i, data) {
        this.buff.setUint16(i, data, true);
    };
    BufferCoreArrayBuffer.prototype.writeUInt16BE = function (i, data) {
        this.buff.setUint16(i, data, false);
    };
    BufferCoreArrayBuffer.prototype.writeUInt32LE = function (i, data) {
        this.buff.setUint32(i, data, true);
    };
    BufferCoreArrayBuffer.prototype.writeUInt32BE = function (i, data) {
        this.buff.setUint32(i, data, false);
    };
    BufferCoreArrayBuffer.prototype.writeFloatLE = function (i, data) {
        this.buff.setFloat32(i, data, true);
    };
    BufferCoreArrayBuffer.prototype.writeFloatBE = function (i, data) {
        this.buff.setFloat32(i, data, false);
    };
    BufferCoreArrayBuffer.prototype.writeDoubleLE = function (i, data) {
        this.buff.setFloat64(i, data, true);
    };
    BufferCoreArrayBuffer.prototype.writeDoubleBE = function (i, data) {
        this.buff.setFloat64(i, data, false);
    };
    BufferCoreArrayBuffer.prototype.readInt8 = function (i) {
        return this.buff.getInt8(i);
    };
    BufferCoreArrayBuffer.prototype.readInt16LE = function (i) {
        return this.buff.getInt16(i, true);
    };
    BufferCoreArrayBuffer.prototype.readInt16BE = function (i) {
        return this.buff.getInt16(i, false);
    };
    BufferCoreArrayBuffer.prototype.readInt32LE = function (i) {
        return this.buff.getInt32(i, true);
    };
    BufferCoreArrayBuffer.prototype.readInt32BE = function (i) {
        return this.buff.getInt32(i, false);
    };
    BufferCoreArrayBuffer.prototype.readUInt8 = function (i) {
        return this.buff.getUint8(i);
    };
    BufferCoreArrayBuffer.prototype.readUInt16LE = function (i) {
        return this.buff.getUint16(i, true);
    };
    BufferCoreArrayBuffer.prototype.readUInt16BE = function (i) {
        return this.buff.getUint16(i, false);
    };
    BufferCoreArrayBuffer.prototype.readUInt32LE = function (i) {
        return this.buff.getUint32(i, true);
    };
    BufferCoreArrayBuffer.prototype.readUInt32BE = function (i) {
        return this.buff.getUint32(i, false);
    };
    BufferCoreArrayBuffer.prototype.readFloatLE = function (i) {
        return this.buff.getFloat32(i, true);
    };
    BufferCoreArrayBuffer.prototype.readFloatBE = function (i) {
        return this.buff.getFloat32(i, false);
    };
    BufferCoreArrayBuffer.prototype.readDoubleLE = function (i) {
        return this.buff.getFloat64(i, true);
    };
    BufferCoreArrayBuffer.prototype.readDoubleBE = function (i) {
        return this.buff.getFloat64(i, false);
    };
    BufferCoreArrayBuffer.prototype.copy = function (start, end) {
        var aBuff = this.buff.buffer;
        var newBuff;
        if (ArrayBuffer.prototype.slice) {
            newBuff = aBuff.slice(start, end);
        }
        else {
            var len = end - start;
            newBuff = new ArrayBuffer(len);
            var newUintArray = new Uint8Array(newBuff);
            var oldUintArray = new Uint8Array(aBuff);
            newUintArray.set(oldUintArray.subarray(start, end));
        }
        return new BufferCoreArrayBuffer(newBuff);
    };
    BufferCoreArrayBuffer.prototype.fill = function (value, start, end) {
        value = value & 0xFF;
        var i;
        var len = end - start;
        var intBytes = (((len) / 4) | 0) * 4;
        var intVal = (value << 24) | (value << 16) | (value << 8) | value;
        for (i = 0; i < intBytes; i += 4) {
            this.writeInt32LE(i + start, intVal);
        }
        for (i = intBytes; i < len; i++) {
            this.writeUInt8(i + start, value);
        }
    };
    BufferCoreArrayBuffer.prototype.getDataView = function () {
        return this.buff;
    };
    BufferCoreArrayBuffer.name = "ArrayBuffer";
    return BufferCoreArrayBuffer;
})(buffer_core.BufferCoreCommon);
var _ = BufferCoreArrayBuffer;
module.exports = BufferCoreArrayBuffer;
//# sourceMappingURL=buffer_core_arraybuffer.js.map