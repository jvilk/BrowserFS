var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var buffer_core = require('./buffer_core');
var clearMasks = [0xFFFFFF00, 0xFFFF00FF, 0xFF00FFFF, 0x00FFFFFF];
var BufferCoreArray = (function (_super) {
    __extends(BufferCoreArray, _super);
    function BufferCoreArray(length) {
        _super.call(this);
        this.length = length;
        this.buff = new Array(Math.ceil(length / 4));
        var bufflen = this.buff.length;
        for (var i = 0; i < bufflen; i++) {
            this.buff[i] = 0;
        }
    }
    BufferCoreArray.isAvailable = function () {
        return true;
    };
    BufferCoreArray.prototype.getLength = function () {
        return this.length;
    };
    BufferCoreArray.prototype.writeUInt8 = function (i, data) {
        data &= 0xFF;
        var arrIdx = i >> 2;
        var intIdx = i & 3;
        this.buff[arrIdx] = this.buff[arrIdx] & clearMasks[intIdx];
        this.buff[arrIdx] = this.buff[arrIdx] | (data << (intIdx << 3));
    };
    BufferCoreArray.prototype.readUInt8 = function (i) {
        var arrIdx = i >> 2;
        var intIdx = i & 3;
        return (this.buff[arrIdx] >> (intIdx << 3)) & 0xFF;
    };
    BufferCoreArray.prototype.copy = function (start, end) {
        var newBC = new BufferCoreArray(end - start);
        for (var i = start; i < end; i++) {
            newBC.writeUInt8(i - start, this.readUInt8(i));
        }
        return newBC;
    };
    BufferCoreArray.name = "Array";
    return BufferCoreArray;
})(buffer_core.BufferCoreCommon);
var _ = BufferCoreArray;
module.exports = BufferCoreArray;
//# sourceMappingURL=buffer_core_array.js.map