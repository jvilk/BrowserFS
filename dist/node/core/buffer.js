var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var buffer_core = require('./buffer_core');
var buffer_core_array = require('./buffer_core_array');
var buffer_core_arraybuffer = require('./buffer_core_arraybuffer');
var buffer_core_imagedata = require('./buffer_core_imagedata');
var string_util = require('./string_util');
var BufferCorePreferences = [
    buffer_core_arraybuffer.BufferCoreArrayBuffer,
    buffer_core_imagedata.BufferCoreImageData,
    buffer_core_array.BufferCoreArray
];
var PreferredBufferCore = (function () {
    var i, bci;
    for (i = 0; i < BufferCorePreferences.length; i++) {
        bci = BufferCorePreferences[i];
        if (bci.isAvailable())
            return bci;
    }
    throw new Error("This browser does not support any available BufferCore implementations.");
})();
function checkInt(buffer, value, offset, ext, max, min) {
    if (value > max || value < min) {
        throw new TypeError('value is out of bounds');
    }
    else if (offset + ext > buffer.length) {
        throw new RangeError('index out of range');
    }
}
function checkFloat(buffer, value, offset, ext) {
    if (offset + ext > buffer.length) {
        throw new RangeError('index out of range');
    }
}
function checkOffset(offset, ext, length) {
    if (offset + ext > length) {
        throw new RangeError('index out of range');
    }
}
var MaxInt;
(function (MaxInt) {
    MaxInt[MaxInt["INT0"] = 0] = "INT0";
    MaxInt[MaxInt["INT8"] = 127] = "INT8";
    MaxInt[MaxInt["INT16"] = 32767] = "INT16";
    MaxInt[MaxInt["INT24"] = 8388607] = "INT24";
    MaxInt[MaxInt["INT32"] = 2147483647] = "INT32";
    MaxInt[MaxInt["INT40"] = 549755813887] = "INT40";
    MaxInt[MaxInt["INT48"] = 140737488355327] = "INT48";
})(MaxInt || (MaxInt = {}));
var MinInt;
(function (MinInt) {
    MinInt[MinInt["INT0"] = 0] = "INT0";
    MinInt[MinInt["INT8"] = -128] = "INT8";
    MinInt[MinInt["INT16"] = -32768] = "INT16";
    MinInt[MinInt["INT24"] = -8388608] = "INT24";
    MinInt[MinInt["INT32"] = -2147483648] = "INT32";
    MinInt[MinInt["INT40"] = -549755813888] = "INT40";
    MinInt[MinInt["INT48"] = -140737488355328] = "INT48";
})(MinInt || (MinInt = {}));
var MaxUInt;
(function (MaxUInt) {
    MaxUInt[MaxUInt["INT0"] = 0] = "INT0";
    MaxUInt[MaxUInt["INT8"] = 255] = "INT8";
    MaxUInt[MaxUInt["INT16"] = 65535] = "INT16";
    MaxUInt[MaxUInt["INT24"] = 16777215] = "INT24";
    MaxUInt[MaxUInt["INT32"] = 4294967295] = "INT32";
    MaxUInt[MaxUInt["INT40"] = 1099511627775] = "INT40";
    MaxUInt[MaxUInt["INT48"] = 281474976710655] = "INT48";
})(MaxUInt || (MaxUInt = {}));
var byte2maxint = {};
byte2maxint[0] = 0;
byte2maxint[1] = 127;
byte2maxint[2] = 32767;
byte2maxint[3] = 8388607;
byte2maxint[4] = 2147483647;
byte2maxint[5] = 549755813887;
byte2maxint[6] = 140737488355327;
var byte2minint = {};
byte2minint[0] = 0;
byte2minint[1] = -128;
byte2minint[2] = -32768;
byte2minint[3] = -8388608;
byte2minint[4] = -2147483648;
byte2minint[5] = -549755813888;
byte2minint[6] = -140737488355328;
var byte2maxuint = {};
byte2maxuint[0] = 0;
byte2maxuint[1] = 255;
byte2maxuint[2] = 65535;
byte2maxuint[3] = 16777215;
byte2maxuint[4] = 4294967295;
byte2maxuint[5] = 1099511627775;
byte2maxuint[6] = 281474976710655;
var Buffer = (function () {
    function Buffer(arg1, arg2, arg3) {
        if (arg2 === void 0) { arg2 = 'utf8'; }
        this.offset = 0;
        var i;
        if (!(this instanceof Buffer)) {
            return new Buffer(arg1, arg2);
        }
        if (arg1 instanceof buffer_core.BufferCoreCommon) {
            this.data = arg1;
            var start = typeof arg2 === 'number' ? arg2 : 0;
            var end = typeof arg3 === 'number' ? arg3 : this.data.getLength();
            this.offset = start;
            this.length = end - start;
        }
        else if (typeof arg1 === 'number') {
            if (arg1 !== (arg1 >>> 0)) {
                throw new RangeError('Buffer size must be a uint32.');
            }
            this.length = arg1;
            this.data = new PreferredBufferCore(arg1);
        }
        else if (typeof DataView !== 'undefined' && arg1 instanceof DataView) {
            this.data = new buffer_core_arraybuffer.BufferCoreArrayBuffer(arg1);
            this.length = arg1.byteLength;
        }
        else if (typeof ArrayBuffer !== 'undefined' && typeof arg1.byteLength === 'number') {
            this.data = new buffer_core_arraybuffer.BufferCoreArrayBuffer(arg1);
            this.length = arg1.byteLength;
        }
        else if (arg1 instanceof Buffer) {
            var argBuff = arg1;
            this.data = new PreferredBufferCore(arg1.length);
            this.length = arg1.length;
            argBuff.copy(this);
        }
        else if (Array.isArray(arg1) || (arg1 != null && typeof arg1 === 'object' && typeof arg1[0] === 'number')) {
            this.data = new PreferredBufferCore(arg1.length);
            for (i = 0; i < arg1.length; i++) {
                this.data.writeUInt8(i, arg1[i]);
            }
            this.length = arg1.length;
        }
        else if (typeof arg1 === 'string') {
            this.length = Buffer.byteLength(arg1, arg2);
            this.data = new PreferredBufferCore(this.length);
            this.write(arg1, 0, this.length, arg2);
        }
        else {
            if (arg1['type'] === 'Buffer' && Array.isArray(arg1['data'])) {
                this.data = new PreferredBufferCore(arg1.data.length);
                for (i = 0; i < arg1.data.length; i++) {
                    this.data.writeUInt8(i, arg1.data[i]);
                }
                this.length = arg1.data.length;
            }
            else {
                throw new Error("Invalid argument to Buffer constructor: " + arg1);
            }
        }
    }
    Buffer.getAvailableBufferCores = function () {
        return BufferCorePreferences.filter(function (bci) { return bci.isAvailable(); });
    };
    Buffer.getPreferredBufferCore = function () {
        return PreferredBufferCore;
    };
    Buffer.setPreferredBufferCore = function (bci) {
        PreferredBufferCore = bci;
    };
    Buffer.prototype.getBufferCore = function () {
        return this.data;
    };
    Buffer.prototype.getOffset = function () {
        return this.offset;
    };
    Buffer.prototype.set = function (index, value) {
        if (value < 0) {
            return this.writeInt8(value, index);
        }
        else {
            return this.writeUInt8(value, index);
        }
    };
    Buffer.prototype.get = function (index) {
        return this.readUInt8(index);
    };
    Buffer.prototype.write = function (str, offset, length, encoding) {
        if (offset === void 0) { offset = 0; }
        if (length === void 0) { length = this.length; }
        if (encoding === void 0) { encoding = 'utf8'; }
        if (typeof offset === 'string') {
            encoding = "" + offset;
            offset = 0;
            length = this.length;
        }
        else if (typeof length === 'string') {
            encoding = "" + length;
            length = this.length;
        }
        if (offset > this.length || offset < 0) {
            throw new RangeError("Invalid offset.");
        }
        var strUtil = string_util.FindUtil(encoding);
        length = length + offset > this.length ? this.length - offset : length;
        offset += this.offset;
        return strUtil.str2byte(str, offset === 0 && length === this.length ? this : new Buffer(this.data, offset, length + offset));
    };
    Buffer.prototype.toString = function (encoding, start, end) {
        if (encoding === void 0) { encoding = 'utf8'; }
        if (start === void 0) { start = 0; }
        if (end === void 0) { end = this.length; }
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
        return strUtil.byte2str(start === 0 && end === this.length ? this : new Buffer(this.data, start + this.offset, end + this.offset));
    };
    Buffer.prototype.toJSON = function () {
        var len = this.length;
        var byteArr = new Array(len);
        for (var i = 0; i < len; i++) {
            byteArr[i] = this.readUInt8(i);
        }
        return {
            type: 'Buffer',
            data: byteArr
        };
    };
    Buffer.prototype.inspect = function () {
        var digits = [], i, len = this.length < exports.INSPECT_MAX_BYTES ? this.length : exports.INSPECT_MAX_BYTES;
        for (i = 0; i < len; i++) {
            digits.push(this.readUInt8(i).toString(16));
        }
        return "<Buffer " + digits.join(" ") + (this.length > len ? " ... " : "") + ">";
    };
    Buffer.prototype.toArrayBuffer = function () {
        var buffCore = this.getBufferCore();
        if (buffCore instanceof buffer_core_arraybuffer.BufferCoreArrayBuffer) {
            var dv = buffCore.getDataView(), ab = dv.buffer;
            if (this.offset === 0 && dv.byteOffset === 0 && dv.byteLength === ab.byteLength && this.length === dv.byteLength) {
                return ab;
            }
            else {
                return ab.slice(this.offset + dv.byteOffset, this.length);
            }
        }
        else {
            var ab = new ArrayBuffer(this.length), newBuff = new Buffer(ab);
            this.copy(newBuff, 0, 0, this.length);
            return ab;
        }
    };
    Buffer.prototype.indexOf = function (value, byteOffset) {
        if (byteOffset === void 0) { byteOffset = 0; }
        var normalizedValue;
        if (typeof (value) === 'string') {
            normalizedValue = new Buffer(value, 'utf8');
        }
        else if (Buffer.isBuffer(value)) {
            normalizedValue = value;
        }
        else if (typeof (value) === 'number') {
            normalizedValue = new Buffer([value]);
        }
        else {
            throw new TypeError("indexOf only operates on strings, buffers, and numbers.");
        }
        if (byteOffset > 0x7fffffff) {
            byteOffset = 0x7fffffff;
        }
        else if (byteOffset < -0x80000000) {
            byteOffset = -0x80000000;
        }
        byteOffset >>= 0;
        if (byteOffset < 0) {
            byteOffset = this.length + byteOffset;
            if (byteOffset < 0) {
                byteOffset = 0;
            }
        }
        var valOffset = 0, currentVal, valLen = normalizedValue.length, bufLen = this.length;
        if (valLen === 0) {
            return -1;
        }
        while (valOffset < valLen && byteOffset < bufLen) {
            if (normalizedValue.readUInt8(valOffset) == this.readUInt8(byteOffset)) {
                valOffset++;
            }
            else {
                valOffset = 0;
            }
            byteOffset++;
        }
        if (valOffset == valLen) {
            return byteOffset - valLen;
        }
        else {
            return -1;
        }
    };
    Buffer.prototype.copy = function (target, targetStart, sourceStart, sourceEnd) {
        if (targetStart === void 0) { targetStart = 0; }
        if (sourceStart === void 0) { sourceStart = 0; }
        if (sourceEnd === void 0) { sourceEnd = this.length; }
        if (sourceStart < 0) {
            throw new RangeError('sourceStart out of bounds');
        }
        if (sourceEnd < 0) {
            throw new RangeError('sourceEnd out of bounds');
        }
        if (targetStart < 0) {
            throw new RangeError("targetStart out of bounds");
        }
        if (sourceEnd <= sourceStart || sourceStart >= this.length || targetStart > target.length) {
            return 0;
        }
        var bytesCopied = Math.min(sourceEnd - sourceStart, target.length - targetStart, this.length - sourceStart), i;
        for (i = 0; i < bytesCopied - 3; i += 4) {
            target.writeInt32LE(this.readInt32LE(sourceStart + i), targetStart + i);
        }
        for (i = bytesCopied & 0xFFFFFFFC; i < bytesCopied; i++) {
            target.writeUInt8(this.readUInt8(sourceStart + i), targetStart + i);
        }
        return bytesCopied;
    };
    Buffer.prototype.slice = function (start, end) {
        if (start === void 0) { start = 0; }
        if (end === void 0) { end = this.length; }
        start = start >> 0;
        end = end >> 0;
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
        if (start < 0 || end < 0 || start > this.length || end > this.length) {
            throw new Error("Invalid slice indices.");
        }
        return new Buffer(this.data, start + this.offset, end + this.offset);
    };
    Buffer.prototype.sliceCopy = function (start, end) {
        if (start === void 0) { start = 0; }
        if (end === void 0) { end = this.length; }
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
        if (start < 0 || end < 0 || start >= this.length || end > this.length) {
            throw new Error("Invalid slice indices.");
        }
        return new Buffer(this.data.copy(start + this.offset, end + this.offset));
    };
    Buffer.prototype.fill = function (value, offset, end) {
        if (offset === void 0) { offset = 0; }
        if (end === void 0) { end = this.length; }
        var i;
        offset = offset >> 0;
        end = end >> 0;
        if (offset < 0 || end > this.length) {
            throw new RangeError('out of range index');
        }
        else if (end <= offset) {
            return this;
        }
        if (typeof value !== 'string') {
            value = value >>> 0;
        }
        else if (value.length === 1) {
            var code = value.charCodeAt(0);
            if (code < 256) {
                value = code;
            }
        }
        if (typeof value === 'number') {
            offset += this.offset;
            end += this.offset;
            this.data.fill(value, offset, end);
        }
        else if (value.length > 0) {
            var byteLen = Buffer.byteLength(value, 'utf8'), lastBulkWrite = end - byteLen;
            while (offset < lastBulkWrite) {
                this.write(value, offset, byteLen, 'utf8');
                offset += byteLen;
            }
            if (offset < end) {
                this.write(value, offset, end - offset, 'utf8');
            }
        }
        return this;
    };
    Buffer.prototype.readUIntLE = function (offset, byteLength, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        byteLength = byteLength >>> 0;
        if (!noAssert) {
            checkOffset(offset, byteLength, this.length);
        }
        offset += this.offset;
        var value = 0;
        switch (byteLength) {
            case 1:
                return this.data.readUInt8(offset);
            case 2:
                return this.data.readUInt16LE(offset);
            case 3:
                return this.data.readUInt8(offset) | (this.data.readUInt16LE(offset + 1) << 8);
            case 4:
                return this.data.readUInt32LE(offset);
            case 6:
                value += (this.data.readUInt8(offset + 5) << 23) * 0x20000;
            case 5:
                value += (this.data.readUInt8(offset + 4) << 23) * 0x200;
                return value + this.data.readUInt32LE(offset);
            default:
                throw new Error("Invalid byteLength: " + byteLength);
        }
    };
    Buffer.prototype.readUIntBE = function (offset, byteLength, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        byteLength = byteLength >>> 0;
        if (!noAssert) {
            checkOffset(offset, byteLength, this.length);
        }
        offset += this.offset;
        var value = 0;
        switch (byteLength) {
            case 1:
                return this.data.readUInt8(offset);
            case 2:
                return this.data.readUInt16BE(offset);
            case 3:
                return this.data.readUInt8(offset + 2) | (this.data.readUInt16BE(offset) << 8);
            case 4:
                return this.data.readUInt32BE(offset);
            case 6:
                value += (this.data.readUInt8(offset) << 23) * 0x20000;
                offset++;
            case 5:
                value += (this.data.readUInt8(offset) << 23) * 0x200;
                return value + this.data.readUInt32BE(offset + 1);
            default:
                throw new Error("Invalid byteLength: " + byteLength);
        }
    };
    Buffer.prototype.readIntLE = function (offset, byteLength, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        byteLength = byteLength >>> 0;
        if (!noAssert) {
            checkOffset(offset, byteLength, this.length);
        }
        offset += this.offset;
        switch (byteLength) {
            case 1:
                return this.data.readInt8(offset);
            case 2:
                return this.data.readInt16LE(offset);
            case 3:
                return this.data.readUInt8(offset) | (this.data.readInt16LE(offset + 1) << 8);
            case 4:
                return this.data.readInt32LE(offset);
            case 6:
                return ((this.data.readInt8(offset + 5) << 23) * 0x20000) + this.readUIntLE(offset - this.offset, 5, noAssert);
            case 5:
                return ((this.data.readInt8(offset + 4) << 23) * 0x200) + this.data.readUInt32LE(offset);
            default:
                throw new Error("Invalid byteLength: " + byteLength);
        }
    };
    Buffer.prototype.readIntBE = function (offset, byteLength, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        byteLength = byteLength >>> 0;
        if (!noAssert) {
            checkOffset(offset, byteLength, this.length);
        }
        offset += this.offset;
        switch (byteLength) {
            case 1:
                return this.data.readInt8(offset);
            case 2:
                return this.data.readInt16BE(offset);
            case 3:
                return this.data.readUInt8(offset + 2) | (this.data.readInt16BE(offset) << 8);
            case 4:
                return this.data.readInt32BE(offset);
            case 6:
                return ((this.data.readInt8(offset) << 23) * 0x20000) + this.readUIntBE(offset - this.offset + 1, 5, noAssert);
            case 5:
                return ((this.data.readInt8(offset) << 23) * 0x200) + this.data.readUInt32BE(offset + 1);
            default:
                throw new Error("Invalid byteLength: " + byteLength);
        }
    };
    Buffer.prototype.readUInt8 = function (offset, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkOffset(offset, 1, this.length);
        }
        offset += this.offset;
        return this.data.readUInt8(offset);
    };
    Buffer.prototype.readUInt16LE = function (offset, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkOffset(offset, 2, this.length);
        }
        offset += this.offset;
        return this.data.readUInt16LE(offset);
    };
    Buffer.prototype.readUInt16BE = function (offset, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkOffset(offset, 2, this.length);
        }
        offset += this.offset;
        return this.data.readUInt16BE(offset);
    };
    Buffer.prototype.readUInt32LE = function (offset, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkOffset(offset, 4, this.length);
        }
        offset += this.offset;
        return this.data.readUInt32LE(offset);
    };
    Buffer.prototype.readUInt32BE = function (offset, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkOffset(offset, 4, this.length);
        }
        offset += this.offset;
        return this.data.readUInt32BE(offset);
    };
    Buffer.prototype.readInt8 = function (offset, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkOffset(offset, 1, this.length);
        }
        offset += this.offset;
        return this.data.readInt8(offset);
    };
    Buffer.prototype.readInt16LE = function (offset, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkOffset(offset, 2, this.length);
        }
        offset += this.offset;
        return this.data.readInt16LE(offset);
    };
    Buffer.prototype.readInt16BE = function (offset, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkOffset(offset, 2, this.length);
        }
        offset += this.offset;
        return this.data.readInt16BE(offset);
    };
    Buffer.prototype.readInt32LE = function (offset, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkOffset(offset, 4, this.length);
        }
        offset += this.offset;
        return this.data.readInt32LE(offset);
    };
    Buffer.prototype.readInt32BE = function (offset, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkOffset(offset, 4, this.length);
        }
        offset += this.offset;
        return this.data.readInt32BE(offset);
    };
    Buffer.prototype.readFloatLE = function (offset, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkOffset(offset, 4, this.length);
        }
        offset += this.offset;
        return this.data.readFloatLE(offset);
    };
    Buffer.prototype.readFloatBE = function (offset, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkOffset(offset, 4, this.length);
        }
        offset += this.offset;
        return this.data.readFloatBE(offset);
    };
    Buffer.prototype.readDoubleLE = function (offset, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkOffset(offset, 8, this.length);
        }
        offset += this.offset;
        return this.data.readDoubleLE(offset);
    };
    Buffer.prototype.readDoubleBE = function (offset, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkOffset(offset, 8, this.length);
        }
        offset += this.offset;
        return this.data.readDoubleBE(offset);
    };
    Buffer.prototype.writeUIntLE = function (value, offset, byteLength, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkInt(this, value, offset, byteLength, byte2maxuint[byteLength], 0);
        }
        var rv = offset + byteLength;
        offset += this.offset;
        switch (byteLength) {
            case 1:
                this.data.writeUInt8(offset, value);
                break;
            case 2:
                this.data.writeUInt16LE(offset, value);
                break;
            case 3:
                this.data.writeUInt8(offset, value & 0xFF);
                this.data.writeUInt16LE(offset + 1, value >> 8);
                break;
            case 4:
                this.data.writeUInt32LE(offset, value);
                break;
            case 6:
                this.data.writeUInt8(offset, value & 0xFF);
                value = Math.floor(value / 256);
                offset++;
            case 5:
                this.data.writeUInt8(offset, value & 0xFF);
                value = Math.floor(value / 256);
                this.data.writeUInt32LE(offset + 1, value);
                break;
            default:
                throw new Error("Invalid byteLength: " + byteLength);
        }
        return rv;
    };
    Buffer.prototype.writeUIntBE = function (value, offset, byteLength, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkInt(this, value, offset, byteLength, byte2maxuint[byteLength], 0);
        }
        var rv = offset + byteLength;
        offset += this.offset;
        switch (byteLength) {
            case 1:
                this.data.writeUInt8(offset, value);
                break;
            case 2:
                this.data.writeUInt16BE(offset, value);
                break;
            case 3:
                this.data.writeUInt8(offset + 2, value & 0xFF);
                this.data.writeUInt16BE(offset, value >> 8);
                break;
            case 4:
                this.data.writeUInt32BE(offset, value);
                break;
            case 6:
                this.data.writeUInt8(offset + 5, value & 0xFF);
                value = Math.floor(value / 256);
            case 5:
                this.data.writeUInt8(offset + 4, value & 0xFF);
                value = Math.floor(value / 256);
                this.data.writeUInt32BE(offset, value);
                break;
            default:
                throw new Error("Invalid byteLength: " + byteLength);
        }
        return rv;
    };
    Buffer.prototype.writeIntLE = function (value, offset, byteLength, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkInt(this, value, offset, byteLength, byte2maxint[byteLength], byte2minint[byteLength]);
        }
        var rv = offset + byteLength;
        offset += this.offset;
        switch (byteLength) {
            case 1:
                this.data.writeInt8(offset, value);
                break;
            case 2:
                this.data.writeInt16LE(offset, value);
                break;
            case 3:
                this.data.writeUInt8(offset, value & 0xFF);
                this.data.writeInt16LE(offset + 1, value >> 8);
                break;
            case 4:
                this.data.writeInt32LE(offset, value);
                break;
            case 6:
                this.data.writeUInt8(offset, value & 0xFF);
                value = Math.floor(value / 256);
                offset++;
            case 5:
                this.data.writeUInt8(offset, value & 0xFF);
                value = Math.floor(value / 256);
                this.data.writeInt32LE(offset + 1, value);
                break;
            default:
                throw new Error("Invalid byteLength: " + byteLength);
        }
        return rv;
    };
    Buffer.prototype.writeIntBE = function (value, offset, byteLength, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkInt(this, value, offset, byteLength, byte2maxint[byteLength], byte2minint[byteLength]);
        }
        var rv = offset + byteLength;
        offset += this.offset;
        switch (byteLength) {
            case 1:
                this.data.writeInt8(offset, value);
                break;
            case 2:
                this.data.writeInt16BE(offset, value);
                break;
            case 3:
                this.data.writeUInt8(offset + 2, value & 0xFF);
                this.data.writeInt16BE(offset, value >> 8);
                break;
            case 4:
                this.data.writeInt32BE(offset, value);
                break;
            case 6:
                this.data.writeUInt8(offset + 5, value & 0xFF);
                value = Math.floor(value / 256);
            case 5:
                this.data.writeUInt8(offset + 4, value & 0xFF);
                value = Math.floor(value / 256);
                this.data.writeInt32BE(offset, value);
                break;
            default:
                throw new Error("Invalid byteLength: " + byteLength);
        }
        return rv;
    };
    Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkInt(this, value, offset, 1, 255, 0);
        }
        this.data.writeUInt8(offset + this.offset, value);
        return offset + 1;
    };
    Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkInt(this, value, offset, 2, 65535, 0);
        }
        this.data.writeUInt16LE(offset + this.offset, value);
        return offset + 2;
    };
    Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkInt(this, value, offset, 2, 65535, 0);
        }
        this.data.writeUInt16BE(offset + this.offset, value);
        return offset + 2;
    };
    Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkInt(this, value, offset, 4, 4294967295, 0);
        }
        this.data.writeUInt32LE(offset + this.offset, value);
        return offset + 4;
    };
    Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkInt(this, value, offset, 4, 4294967295, 0);
        }
        this.data.writeUInt32BE(offset + this.offset, value);
        return offset + 4;
    };
    Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkInt(this, value, offset, 1, 127, -128);
        }
        this.data.writeInt8(offset + this.offset, value);
        return offset + 1;
    };
    Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkInt(this, value, offset, 2, 32767, -32768);
        }
        this.data.writeInt16LE(offset + this.offset, value);
        return offset + 2;
    };
    Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkInt(this, value, offset, 2, 32767, -32768);
        }
        this.data.writeInt16BE(offset + this.offset, value);
        return offset + 2;
    };
    Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkInt(this, value, offset, 4, 2147483647, -2147483648);
        }
        this.data.writeInt32LE(offset + this.offset, value);
        return offset + 4;
    };
    Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkInt(this, value, offset, 4, 2147483647, -2147483648);
        }
        this.data.writeInt32BE(offset + this.offset, value);
        return offset + 4;
    };
    Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkFloat(this, value, offset, 4);
        }
        this.data.writeFloatLE(offset + this.offset, value);
        return offset + 4;
    };
    Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkFloat(this, value, offset, 4);
        }
        this.data.writeFloatBE(offset + this.offset, value);
        return offset + 4;
    };
    Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkFloat(this, value, offset, 8);
        }
        this.data.writeDoubleLE(offset + this.offset, value);
        return offset + 8;
    };
    Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
        if (noAssert === void 0) { noAssert = false; }
        offset = offset >>> 0;
        if (!noAssert) {
            checkFloat(this, value, offset, 8);
        }
        this.data.writeDoubleBE(offset + this.offset, value);
        return offset + 8;
    };
    Buffer.isEncoding = function (enc) {
        try {
            string_util.FindUtil(enc);
        }
        catch (e) {
            return false;
        }
        return true;
    };
    Buffer.compare = function (a, b) {
        if (a === b) {
            return 0;
        }
        else {
            var i, aLen = a.length, bLen = b.length, cmpLength = Math.min(aLen, bLen), u1, u2;
            for (i = 0; i < cmpLength; i++) {
                u1 = a.readUInt8(i);
                u2 = b.readUInt8(i);
                if (u1 !== u2) {
                    return u1 > u2 ? 1 : -1;
                }
            }
            if (aLen === bLen) {
                return 0;
            }
            else {
                return aLen > bLen ? 1 : -1;
            }
        }
    };
    Buffer.isBuffer = function (obj) {
        return obj instanceof Buffer;
    };
    Buffer.byteLength = function (str, encoding) {
        if (encoding === void 0) { encoding = 'utf8'; }
        var strUtil;
        try {
            strUtil = string_util.FindUtil(encoding);
        }
        catch (e) {
            strUtil = string_util.FindUtil('utf8');
        }
        if (typeof (str) !== 'string') {
            str = "" + str;
        }
        return strUtil.byteLength(str);
    };
    Buffer.concat = function (list, totalLength) {
        var item;
        if (list.length === 0 || totalLength === 0) {
            return new Buffer(0);
        }
        else {
            if (totalLength === undefined) {
                totalLength = 0;
                for (var i = 0; i < list.length; i++) {
                    item = list[i];
                    if (!Buffer.isBuffer(item)) {
                        throw new TypeError("Concat only operates on Buffer objects.");
                    }
                    totalLength += item.length;
                }
            }
            var buf = new Buffer(totalLength);
            var curPos = 0;
            for (var j = 0; j < list.length; j++) {
                item = list[j];
                if (!Buffer.isBuffer(item)) {
                    throw new TypeError("Concat only operates on Buffer objects.");
                }
                curPos += item.copy(buf, curPos);
            }
            return buf;
        }
    };
    Buffer.prototype.equals = function (buffer) {
        if (Buffer.isBuffer(buffer)) {
            var i;
            if (buffer.length !== this.length) {
                return false;
            }
            else {
                for (i = 0; i < this.length; i++) {
                    if (this.readUInt8(i) !== buffer.readUInt8(i)) {
                        return false;
                    }
                }
                return true;
            }
        }
        else {
            throw new TypeError("Argument must be a buffer.");
        }
    };
    Buffer.prototype.compare = function (buffer) {
        return Buffer.compare(this, buffer);
    };
    return Buffer;
})();
exports.Buffer = Buffer;
var _ = Buffer;
var SlowBuffer = (function (_super) {
    __extends(SlowBuffer, _super);
    function SlowBuffer(length, arg2, arg3) {
        if (!(this instanceof SlowBuffer)) {
            return new SlowBuffer(length, arg2, arg3);
        }
        if (+length != length) {
            length = 0;
        }
        _super.call(this, +length);
    }
    SlowBuffer.isBuffer = function (obj) {
        return Buffer.isBuffer(obj);
    };
    SlowBuffer.byteLength = function (str, encoding) {
        return Buffer.byteLength(str, encoding);
    };
    SlowBuffer.concat = function (list, totalLength) {
        return Buffer.concat(list, totalLength);
    };
    return SlowBuffer;
})(Buffer);
exports.SlowBuffer = SlowBuffer;
_ = SlowBuffer;
exports.INSPECT_MAX_BYTES = 50;
//# sourceMappingURL=buffer.js.map