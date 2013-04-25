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
        if (document) {
            // raises DOMException(INDEX_SIZE_ERR)
            document.createTextNode("").splitText(1);
        }
        throw new RangeError("INDEX_SIZE_ERR");
    }

    // ES5: lock down object properties
    function configureProperties(obj) {
        if (Object.getOwnPropertyNames && Object.defineProperty) {
            var props = Object.getOwnPropertyNames(obj), i;
            for (i = 0; i < props.length; i += 1) {
                Object.defineProperty(obj, props[i], {
                    value: obj[props[i]],
                    writable: false,
                    enumerable: false,
                    configurable: false
                });
            }
        }
    }

    // emulate ES5 getter/setter API using legacy APIs
    // http://blogs.msdn.com/b/ie/archive/2010/09/07/transitioning-existing-code-to-the-es5-getter-setter-apis.aspx
    if (Object.prototype.__defineGetter__ && !Object.defineProperty) {
        Object.defineProperty = function (obj, prop, desc) {
            if (desc.hasOwnProperty('get')) { obj.__defineGetter__(prop, desc.get); }
            if (desc.hasOwnProperty('set')) { obj.__defineSetter__(prop, desc.set); }
        };
    }

    // ES5: Make obj[index] an alias for obj._getter(index)/obj._setter(index, value)
    // for index in 0 ... obj.length
    function makeArrayAccessors(obj) {
        if (!Object.defineProperty) { return; }

        function makeArrayAccessor(index) {
            Object.defineProperty(obj, index, {
                'get': function () { return obj._getter(index); },
                'set': function (v) { obj._setter(index, v); },
                enumerable: true,
                configurable: false
            });
        }

        var i;
        for (i = 0; i < obj.length; i += 1) {
            makeArrayAccessor(i);
        }
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


    if (!ArrayBuffer) {
        (function () {

            //
            // 3 The ArrayBuffer Type
            //

            ArrayBuffer = function (length) {
                length = ECMAScript.ToInt32(length);
                if (length < 0) { throw new RangeError('ArrayBuffer size is not a small enough positive integer.'); }

                this.byteLength = length;
                this._bytes = [];
                this._bytes.length = length;

                var i;
                for (i = 0; i < this.byteLength; i += 1) {
                    this._bytes[i] = 0;
                }

                configureProperties(this);
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
            // 5 The Typed Array View Types
            //

            function makeTypedArrayConstructor(bytesPerElement, pack, unpack) {
                // Each TypedArray type requires a distinct constructor instance with
                // identical logic, which this produces.

                var ctor;
                ctor = function (buffer, byteOffset, length) {
                    var array, sequence, i, s;

                    // Constructor(unsigned long length)
                    if (!arguments.length || typeof arguments[0] === 'number') {
                        this.length = ECMAScript.ToInt32(arguments[0]);
                        if (length < 0) { throw new RangeError('ArrayBufferView size is not a small enough positive integer.'); }

                        this.byteLength = this.length * this.BYTES_PER_ELEMENT;
                        this.buffer = new ArrayBuffer(this.byteLength);
                        this.byteOffset = 0;
                    }

                    // Constructor(TypedArray array)
                    else if (typeof arguments[0] === 'object' && arguments[0].constructor === ctor) {
                        array = arguments[0];

                        this.length = array.length;
                        this.byteLength = this.length * this.BYTES_PER_ELEMENT;
                        this.buffer = new ArrayBuffer(this.byteLength);
                        this.byteOffset = 0;

                        for (i = 0; i < this.length; i += 1) {
                            this._setter(i, array._getter(i));
                        }
                    }

                    // Constructor(sequence<type> array)
                    else if (typeof arguments[0] === 'object' && !(arguments[0] instanceof ArrayBuffer)) {
                        sequence = arguments[0];

                        this.length = ECMAScript.ToUint32(sequence.length);
                        this.byteLength = this.length * this.BYTES_PER_ELEMENT;
                        this.buffer = new ArrayBuffer(this.byteLength);
                        this.byteOffset = 0;

                        for (i = 0; i < this.length; i += 1) {
                            s = sequence[i];
                            this._setter(i, Number(s));
                        }
                    }

                    // Constructor(ArrayBuffer buffer,
                    //             optional unsigned long byteOffset, optional unsigned long length)
                    else if (typeof arguments[0] === 'object' && arguments[0] instanceof ArrayBuffer) {
                        this.buffer = buffer;

                        this.byteOffset = ECMAScript.ToUint32(byteOffset);
                        if (this.byteOffset > this.buffer.byteLength) {
                            raise_INDEX_SIZE_ERR(); // byteOffset out of range
                        }

                        if (this.byteOffset % this.BYTES_PER_ELEMENT) {
                            // The given byteOffset must be a multiple of the element
                            // size of the specific type, otherwise an exception is raised.
                            //raise_INDEX_SIZE_ERR();
                            throw new RangeError("ArrayBuffer length minus the byteOffset is not a multiple of the element size.");
                        }

                        if (arguments.length < 3) {
                            this.byteLength = this.buffer.byteLength - this.byteOffset;

                            if (this.byteLength % this.BYTES_PER_ELEMENT) {
                                raise_INDEX_SIZE_ERR(); // length of buffer minus byteOffset not a multiple of the element size
                            }
                            this.length = this.byteLength / this.BYTES_PER_ELEMENT;
                        }
                        else {
                            this.length = ECMAScript.ToUint32(length);
                            this.byteLength = this.length * this.BYTES_PER_ELEMENT;
                        }

                        if ((this.byteOffset + this.byteLength) > this.buffer.byteLength) {
                            raise_INDEX_SIZE_ERR(); // byteOffset and length reference an area beyond the end of the buffer
                        }
                    }
                    else {
                        throw new TypeError("Unexpected argument type(s)");
                    }

                    this.constructor = ctor;

                    // ES5-only magic
                    configureProperties(this);
                    makeArrayAccessors(this);
                };

                ctor.prototype = new ArrayBufferView();
                ctor.prototype.BYTES_PER_ELEMENT = bytesPerElement;
                ctor.prototype._pack = pack;
                ctor.prototype._unpack = unpack;
                ctor.BYTES_PER_ELEMENT = bytesPerElement;

                // getter type (unsigned long index);
                ctor.prototype._getter = function (index) {
                    if (arguments.length < 1) { throw new SyntaxError("Not enough arguments"); }

                    index = ECMAScript.ToUint32(index);
                    if (index >= this.length) {
                        //raise_INDEX_SIZE_ERR(); // Array index out of range
                        return; // undefined
                    }

                    var bytes = [], i, o;
                    for (i = 0, o = this.byteOffset + index * this.BYTES_PER_ELEMENT;
                        i < this.BYTES_PER_ELEMENT;
                        i += 1, o += 1) {
                        bytes.push(this.buffer._bytes[o]);
                    }
                    return this._unpack(bytes);
                };

                // NONSTANDARD: convenience alias for getter: type get(unsigned long index);
                ctor.prototype.get = ctor.prototype._getter;

                // setter void (unsigned long index, type value);
                ctor.prototype._setter = function (index, value) {
                    if (arguments.length < 2) { throw new SyntaxError("Not enough arguments"); }

                    index = ECMAScript.ToUint32(index);
                    if (index >= this.length) {
                        //raise_INDEX_SIZE_ERR(); // Array index out of range
                        return;
                    }

                    var bytes = this._pack(value), i, o;
                    for (i = 0, o = this.byteOffset + index * this.BYTES_PER_ELEMENT;
                        i < this.BYTES_PER_ELEMENT;
                        i += 1, o += 1) {
                        this.buffer._bytes[o] = bytes[i];
                    }
                };

                // void set(TypedArray array, optional unsigned long offset);
                // void set(sequence<type> array, optional unsigned long offset);
                ctor.prototype.set = function (index, value) {
                    if (arguments.length < 1) { throw new SyntaxError("Not enough arguments"); }
                    var array, sequence, offset, len,
                        i, s, d,
                        byteOffset, byteLength, tmp;

                    // void set(TypedArray array, optional unsigned long offset);
                    if (typeof arguments[0] === 'object' && arguments[0].constructor === this.constructor) {
                        array = arguments[0];
                        offset = ECMAScript.ToUint32(arguments[1]);

                        if (offset + array.length > this.length) {
                            raise_INDEX_SIZE_ERR(); // Offset plus length of array is out of range
                        }

                        byteOffset = this.byteOffset + offset * this.BYTES_PER_ELEMENT;
                        byteLength = array.length * this.BYTES_PER_ELEMENT;

                        if (array.buffer === this.buffer) {
                            tmp = [];
                            for (i = 0, s = array.byteOffset; i < byteLength; i += 1, s += 1) {
                                tmp[i] = array.buffer._bytes[s];
                            }
                            for (i = 0, d = byteOffset; i < byteLength; i += 1, d += 1) {
                                this.buffer._bytes[d] = tmp[i];
                            }
                        }
                        else {
                            for (i = 0, s = array.byteOffset, d = byteOffset;
                                i < byteLength; i += 1, s += 1, d += 1) {
                                this.buffer._bytes[d] = array.buffer._bytes[s];
                            }
                        }
                    }

                    // void set(sequence<type> array, optional unsigned long offset);
                    else if (typeof arguments[0] === 'object' && typeof arguments[0].length !== 'undefined') {
                        sequence = arguments[0];
                        len = ECMAScript.ToUint32(sequence.length);
                        offset = ECMAScript.ToUint32(arguments[1]);

                        if (offset + len > this.length) {
                            raise_INDEX_SIZE_ERR(); // Offset plus length of array is out of range
                        }

                        for (i = 0; i < len; i += 1) {
                            s = sequence[i];
                            this._setter(offset + i, Number(s));
                        }
                    }

                    else {
                        throw new TypeError("Unexpected argument type(s)");
                    }
                };

                // TypedArray subarray(long begin, optional long end);
                ctor.prototype.subarray = function (start, end) {
                    function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }

                    start = ECMAScript.ToInt32(start);
                    end = ECMAScript.ToInt32(end);

                    if (arguments.length < 1) { start = 0; }
                    if (arguments.length < 2) { end = this.length; }

                    if (start < 0) { start = this.length + start; }
                    if (end < 0) { end = this.length + end; }

                    start = clamp(start, 0, this.length);
                    end = clamp(end, 0, this.length);

                    var len = end - start;
                    if (len < 0) {
                        len = 0;
                    }

                    return new this.constructor(this.buffer, start * this.BYTES_PER_ELEMENT, len);
                };

                return ctor;
            }

            Int8Array = Int8Array || makeTypedArrayConstructor(1, packInt8, unpackInt8);
            Uint8Array = Uint8Array || makeTypedArrayConstructor(1, packUint8, unpackUint8);
            Int16Array = Int16Array || makeTypedArrayConstructor(2, packInt16, unpackInt16);
            Uint16Array = Uint16Array || makeTypedArrayConstructor(2, packUint16, unpackUint16);
            Int32Array = Int32Array || makeTypedArrayConstructor(4, packInt32, unpackInt32);
            Uint32Array = Uint32Array || makeTypedArrayConstructor(4, packUint32, unpackUint32);
            Float32Array = Float32Array || makeTypedArrayConstructor(4, packFloat32, unpackFloat32);
            Float64Array = Float64Array || makeTypedArrayConstructor(8, packFloat64, unpackFloat64);

        } ());
    }


    if (!DataView) {
        (function () {

            //
            // 6 The DataView View Type
            //

            function r(array, index) {
                if (typeof array.get === 'function') {
                    return array.get(index);
                }
                else {
                    return array[index];
                }
            }


            var IS_BIG_ENDIAN = (function () {
                var u16array = new Uint16Array([0x1234]),
                u8array = new Uint8Array(u16array.buffer);
                return r(u8array, 0) === 0x12;
            } ());

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

                // ES5-only magic
                configureProperties(this);
            };

            if (ArrayBufferView) {
                DataView.prototype = new ArrayBufferView();
            }

            function makeDataView_getter(arrayType) {
                return function (byteOffset, littleEndian) {
                    /*jslint newcap: false*/
                    byteOffset = ECMAScript.ToUint32(byteOffset);

                    if (byteOffset + arrayType.BYTES_PER_ELEMENT > this.byteLength) {
                        raise_INDEX_SIZE_ERR(); // Array index out of range
                    }
                    byteOffset += this.byteOffset;

                    var uint8Array = new Uint8Array(this.buffer, byteOffset, arrayType.BYTES_PER_ELEMENT),
                        bytes = [], i;
                    for (i = 0; i < arrayType.BYTES_PER_ELEMENT; i += 1) {
                        bytes.push(r(uint8Array, i));
                    }

                    if (Boolean(littleEndian) === Boolean(IS_BIG_ENDIAN)) {
                        bytes.reverse();
                    }

                    return r(new arrayType(new Uint8Array(bytes).buffer), 0);
                };
            }

            DataView.prototype.getUint8 = makeDataView_getter(Uint8Array);
            DataView.prototype.getInt8 = makeDataView_getter(Int8Array);
            DataView.prototype.getUint16 = makeDataView_getter(Uint16Array);
            DataView.prototype.getInt16 = makeDataView_getter(Int16Array);
            DataView.prototype.getUint32 = makeDataView_getter(Uint32Array);
            DataView.prototype.getInt32 = makeDataView_getter(Int32Array);
            DataView.prototype.getFloat32 = makeDataView_getter(Float32Array);
            DataView.prototype.getFloat64 = makeDataView_getter(Float64Array);

            function makeDataView_setter(arrayType) {
                return function (byteOffset, value, littleEndian) {
                    /*jslint newcap: false*/
                    byteOffset = ECMAScript.ToUint32(byteOffset);
                    if (byteOffset + arrayType.BYTES_PER_ELEMENT > this.byteLength) {
                        raise_INDEX_SIZE_ERR(); // Array index out of range
                    }

                    // Get bytes
                    var typeArray = new arrayType([value]),
                        byteArray = new Uint8Array(typeArray.buffer),
                        bytes = [], i, byteView;

                    for (i = 0; i < arrayType.BYTES_PER_ELEMENT; i += 1) {
                        bytes.push(r(byteArray, i));
                    }

                    // Flip if necessary
                    if (Boolean(littleEndian) === Boolean(IS_BIG_ENDIAN)) {
                        bytes.reverse();
                    }

                    // Write them
                    byteView = new Uint8Array(this.buffer, byteOffset, arrayType.BYTES_PER_ELEMENT);
                    byteView.set(bytes);
                };
            }

            DataView.prototype.setUint8 = makeDataView_setter(Uint8Array);
            DataView.prototype.setInt8 = makeDataView_setter(Int8Array);
            DataView.prototype.setUint16 = makeDataView_setter(Uint16Array);
            DataView.prototype.setInt16 = makeDataView_setter(Int16Array);
            DataView.prototype.setUint32 = makeDataView_setter(Uint32Array);
            DataView.prototype.setInt32 = makeDataView_setter(Int32Array);
            DataView.prototype.setFloat32 = makeDataView_setter(Float32Array);
            DataView.prototype.setFloat64 = makeDataView_setter(Float64Array);

        } ());
    }

} ());
