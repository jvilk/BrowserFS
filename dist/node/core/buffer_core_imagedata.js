var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var buffer_core = require('./buffer_core');
var BufferCoreImageData = (function (_super) {
    __extends(BufferCoreImageData, _super);
    function BufferCoreImageData(length) {
        _super.call(this);
        this.length = length;
        this.buff = BufferCoreImageData.getCanvasPixelArray(length);
    }
    BufferCoreImageData.getCanvasPixelArray = function (bytes) {
        var ctx = BufferCoreImageData.imageDataFactory;
        if (ctx === undefined) {
            BufferCoreImageData.imageDataFactory = ctx = document.createElement('canvas').getContext('2d');
        }
        if (bytes === 0)
            bytes = 1;
        return ctx.createImageData(Math.ceil(bytes / 4), 1).data;
    };
    BufferCoreImageData.isAvailable = function () {
        return typeof (CanvasPixelArray) !== 'undefined' && document.createElement('canvas')['getContext'] !== undefined;
    };
    BufferCoreImageData.prototype.getLength = function () {
        return this.length;
    };
    BufferCoreImageData.prototype.writeUInt8 = function (i, data) {
        this.buff[i] = data;
    };
    BufferCoreImageData.prototype.readUInt8 = function (i) {
        return this.buff[i];
    };
    BufferCoreImageData.prototype.copy = function (start, end) {
        var newBC = new BufferCoreImageData(end - start);
        for (var i = start; i < end; i++) {
            newBC.writeUInt8(i - start, this.buff[i]);
        }
        return newBC;
    };
    BufferCoreImageData.name = "ImageData";
    return BufferCoreImageData;
})(buffer_core.BufferCoreCommon);
var _ = BufferCoreImageData;
module.exports = BufferCoreImageData;
//# sourceMappingURL=buffer_core_imagedata.js.map