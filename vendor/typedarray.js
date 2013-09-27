/*
$LicenseInfo:firstyear=2010&license=mit$

Copyright (c) 2010, Linden Research, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
$/LicenseInfo$
*/
/*global document*/

//
// ES3/ES5 implementation of the Krhonos TypedArray Working Draft (work in progress):
//   Ref: https://cvs.khronos.org/svn/repos/registry/trunk/public/webgl/doc/spec/TypedArray-spec.html
//   Date: 2011-02-01
//
// Variations:
//  * Float/Double -> Float32/Float64, per WebGL-Public mailing list conversations (post 5/17)
//  * Allows typed_array.get/set() as alias for subscripts (typed_array[])

var ArrayBuffer, ArrayBufferView,
    Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array,
    DataView;

(function () {
    "use strict";
    /*jslint bitwise: false, nomen: false */

    // Approximations of internal ECMAScript conversion functions
    var ECMAScript = {
        ToInt32: function (v) { return v >> 0; },
        ToUint32: function (v) { return v >>> 0; }
    };

    // Raise an INDEX_SIZE_ERR event - intentionally induces a DOM error
    function raise_INDEX_SIZE_ERR() {
        if (typeof document !== 'undefined') {
            // raises DOMException(INDEX_SIZE_ERR)
            document.createTextNode("").splitText(1);
        }
        throw new RangeError("INDEX_SIZE_ERR");
    }

    // Internal conversion functions:
    //    pack<Type>()   - take a number (interpreted as Type), output a byte array
    //    unpack<Type>() - take a byte array, output a Type-like number

    function as_signed(value, bits) { var s = 32 - bits; return (value << s) >> s; }
    function as_unsigned(value, bits) { var s = 32 - bits; return (value << s) >>> s; }

    function packInt8(n) { return [n & 0xff]; }
    function unpackInt8(bytes) { return as_signed(bytes[0], 8); }

    function packUint8(n) { return [n & 0xff]; }
    function unpackUint8(bytes) { return as_unsigned(bytes[0], 8); }

    function packInt16(n) { return [(n >> 8) & 0xff, n & 0xff]; }
    function unpackInt16(bytes) { return as_signed(bytes[0] << 8 | bytes[1], 16); }

    function packUint16(n) { return [(n >> 8) & 0xff, n & 0xff]; }
    function unpackUint16(bytes) { return as_unsigned(bytes[0] << 8 | bytes[1], 16); }

    function packInt32(n) { return [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]; }
    function unpackInt32(bytes) { return as_signed(bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3], 32); }

    function packUint32(n) { return [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]; }
    function unpackUint32(bytes) { return as_unsigned(bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3], 32); }

    function packIEEE754(v, ebits, fbits) {

        var bias = (1 << (ebits - 1)) - 1,
            s, e, f, ln,
            i, bits, str, bytes;

        // Compute sign, exponent, fraction
        if (isNaN(v)) {
            // http://dev.w3.org/2006/webapi/WebIDL/#es-type-mapping
            e = (1 << bias) - 1; f = Math.pow(2, fbits - 1); s = 0;
        }
        else if (v === Infinity || v === -Infinity) {
            e = (1 << bias) - 1; f = 0; s = (v < 0) ? 1 : 0;
        }
        else if (v === 0) {
            e = 0; f = 0; s = (1 / v === -Infinity) ? 1 : 0;
        }
        else {
            s = v < 0;
            v = Math.abs(v);

            if (v >= Math.pow(2, 1 - bias)) {
                // Normalized
                ln = Math.min(Math.floor(Math.log(v) / Math.LN2), bias);
                e = ln + bias;
                f = Math.round(v * Math.pow(2, fbits - ln) - Math.pow(2, fbits));
            }
            else {
                // Denormalized
                e = 0;
                f = Math.round(v / Math.pow(2, 1 - bias - fbits));
            }
        }

        // Pack sign, exponent, fraction
        bits = [];
        for (i = fbits; i; i -= 1) { bits.push(f % 2 ? 1 : 0); f = Math.floor(f / 2); }
        for (i = ebits; i; i -= 1) { bits.push(e % 2 ? 1 : 0); e = Math.floor(e / 2); }
        bits.push(s ? 1 : 0);
        bits.reverse();
        str = bits.join('');

        // Bits to bytes
        bytes = [];
        while (str.length) {
            bytes.push(parseInt(str.substring(0, 8), 2));
            str = str.substring(8);
        }
        return bytes;
    }

    function unpackIEEE754(bytes, ebits, fbits) {

        // Bytes to bits
        var bits = [], i, j, b, str,
            bias, s, e, f;

        for (i = bytes.length; i; i -= 1) {
            b = bytes[i - 1];
            for (j = 8; j; j -= 1) {
                bits.push(b % 2 ? 1 : 0); b = b >> 1;
            }
        }
        bits.reverse();
        str = bits.join('');

        // Unpack sign, exponent, fraction
        bias = (1 << (ebits - 1)) - 1;
        s = parseInt(str.substring(0, 1), 2) ? -1 : 1;
        e = parseInt(str.substring(1, 1 + ebits), 2);
        f = parseInt(str.substring(1 + ebits), 2);

        // Produce number
        if (e === (1 << ebits) - 1) {
            return f !== 0 ? NaN : s * Infinity;
        }
        else if (e > 0) {
            // Normalized
            return s * Math.pow(2, e - bias) * (1 + f / Math.pow(2, fbits));
        }
        else if (f !== 0) {
            // Denormalized
            return s * Math.pow(2, -(bias - 1)) * (f / Math.pow(2, fbits));
        }
        else {
            return s < 0 ? -0 : 0;
        }
    }

    function unpackFloat64(b) { return unpackIEEE754(b, 11, 52); }
    function packFloat64(v) { return packIEEE754(v, 11, 52); }
    function unpackFloat32(b) { return unpackIEEE754(b, 8, 23); }
    function packFloat32(v) { return packIEEE754(v, 8, 23); }

    if (!DataView) {
        (function () {

            //
            // 3 The ArrayBuffer Type
            //

            ArrayBuffer = function (length) {
                if (Array.isArray(length)) {
                    this._bytes = length;
                    this.byteLenth = length.length;
                } else {
                    length = ECMAScript.ToInt32(length);
                    if (length < 0) { throw new RangeError('ArrayBuffer size is not a small enough positive integer.'); }
                    this._bytes = [];
                    this._bytes.length = length;
                    this.byteLength = length;

                    var i;
                    for (i = 0; i < this.byteLength; i += 1) {
                        this._bytes[i] = 0;
                    }
                }
            };


            //
            // 4 The ArrayBufferView Type
            //

            // NOTE: this constructor is not exported
            ArrayBufferView = function () {
                //this.buffer = null;
                //this.byteOffset = 0;
                //this.byteLength = 0;
            };

            //
            // 6 The DataView View Type
            //

            // We use our polyfill, so fix it to BE.
            var IS_BIG_ENDIAN = true;

            // TODO: Does not take advantage of older FF / Chrome / Opera versions
            // w/ TA support but no DV support. This will cause issues in those
            // browsers.
            //
            // Constructor(ArrayBuffer buffer,
            //             optional unsigned long byteOffset,
            //             optional unsigned long byteLength)
            DataView = function (buffer, byteOffset, byteLength) {
                if (!(typeof buffer === 'object' && buffer instanceof ArrayBuffer)) {
                    throw new TypeError("TypeError");
                }

                this.buffer = buffer;

                this.byteOffset = ECMAScript.ToUint32(byteOffset);
                if (this.byteOffset > this.buffer.byteLength) {
                    raise_INDEX_SIZE_ERR(); // byteOffset out of range
                }

                if (arguments.length < 3) {
                    this.byteLength = this.buffer.byteLength - this.byteOffset;
                }
                else {
                    this.byteLength = ECMAScript.ToUint32(byteLength);
                }

                if ((this.byteOffset + this.byteLength) > this.buffer.byteLength) {
                    raise_INDEX_SIZE_ERR(); // byteOffset and length reference an area beyond the end of the buffer
                }
            };

            if (ArrayBufferView) {
                DataView.prototype = new ArrayBufferView();
            }

            function makeDataView_getter(unpacker, numBytes) {
                return function (byteOffset, littleEndian) {
                    /*jslint newcap: false*/
                    byteOffset = ECMAScript.ToUint32(byteOffset);

                    if (byteOffset + numBytes > this.byteLength) {
                        raise_INDEX_SIZE_ERR(); // Array index out of range
                    }
                    byteOffset += this.byteOffset;

                    var bytes = [], i;
                    for (i = 0; i < numBytes; i += 1) {
                        bytes.push(this.buffer._bytes[byteOffset+i]);
                    }

                    if (Boolean(littleEndian) === Boolean(IS_BIG_ENDIAN)) {
                        bytes.reverse();
                    }

                    return unpacker(bytes);
                };
            }

            DataView.isPolyfill = true;
            DataView.prototype.getUint8 = makeDataView_getter(unpackUint8, 1);
            DataView.prototype.getInt8 = makeDataView_getter(unpackInt8, 1);
            DataView.prototype.getUint16 = makeDataView_getter(unpackUint16, 2);
            DataView.prototype.getInt16 = makeDataView_getter(unpackInt16, 2);
            DataView.prototype.getUint32 = makeDataView_getter(unpackUint32, 4);
            DataView.prototype.getInt32 = makeDataView_getter(unpackInt32, 4);
            DataView.prototype.getFloat32 = makeDataView_getter(unpackFloat32, 4);
            DataView.prototype.getFloat64 = makeDataView_getter(unpackFloat64, 8);

            function makeDataView_setter(packer, numBytes) {
                return function (byteOffset, value, littleEndian) {
                    /*jslint newcap: false*/
                    byteOffset = ECMAScript.ToUint32(byteOffset);
                    if (byteOffset + numBytes > this.byteLength) {
                        raise_INDEX_SIZE_ERR(); // Array index out of range
                    }

                    // Get bytes
                    var bytes = packer(value);

                    // Flip if necessary
                    if (Boolean(littleEndian) === Boolean(IS_BIG_ENDIAN)) {
                        bytes.reverse();
                    }

                    // Write them
                    byteOffset += this.byteOffset;
                    for (var i = 0; i < bytes.length; i++) {
                        this.buffer._bytes[byteOffset+i] = bytes[i];
                    }
                };
            }

            DataView.prototype.setUint8 = makeDataView_setter(packUint8, 1);
            DataView.prototype.setInt8 = makeDataView_setter(packInt8, 1);
            DataView.prototype.setUint16 = makeDataView_setter(packUint16, 2);
            DataView.prototype.setInt16 = makeDataView_setter(packInt16, 2);
            DataView.prototype.setUint32 = makeDataView_setter(packUint32, 4);
            DataView.prototype.setInt32 = makeDataView_setter(packInt32, 4);
            DataView.prototype.setFloat32 = makeDataView_setter(packFloat32, 4);
            DataView.prototype.setFloat64 = makeDataView_setter(packFloat64, 8);

        } ());
    }

} ());
