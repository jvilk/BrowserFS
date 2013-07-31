"use strict";

(function(global) {
    var create = Object.create || function(p) {
        if (!p) throw Error("no type");
        function f() {}
        f.prototype = p;
        return new f();
    };
    var util = {
        inherits: function(ctor, superCtor) {
            ctor.super_ = superCtor;
            ctor.prototype = create(superCtor.prototype, {
                constructor: {
                    value: ctor,
                    enumerable: false,
                    writable: true,
                    configurable: true
                }
            });
        }
    };
    var pSlice = Array.prototype.slice;
    var Object_keys = typeof Object.keys === "function" ? Object.keys : function(obj) {
        var keys = [];
        for (var key in obj) keys.push(key);
        return keys;
    };
    var assert = ok;
    global["assert"] = assert;
    if (typeof module === "object" && typeof module.exports === "object") {
        module.exports = assert;
    }
    assert.AssertionError = function AssertionError(options) {
        this.name = "AssertionError";
        this.message = options.message;
        this.actual = options.actual;
        this.expected = options.expected;
        this.operator = options.operator;
        var stackStartFunction = options.stackStartFunction || fail;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, stackStartFunction);
        }
    };
    util.inherits(assert.AssertionError, Error);
    function replacer(key, value) {
        if (value === undefined) {
            return "" + value;
        }
        if (typeof value === "number" && (isNaN(value) || !isFinite(value))) {
            return value.toString();
        }
        if (typeof value === "function" || value instanceof RegExp) {
            return value.toString();
        }
        return value;
    }
    function truncate(s, n) {
        if (typeof s == "string") {
            return s.length < n ? s : s.slice(0, n);
        } else {
            return s;
        }
    }
    assert.AssertionError.prototype.toString = function() {
        if (this.message) {
            return [ this.name + ":", this.message ].join(" ");
        } else {
            return [ this.name + ":", truncate(JSON.stringify(this.actual, replacer), 128), this.operator, truncate(JSON.stringify(this.expected, replacer), 128) ].join(" ");
        }
    };
    function fail(actual, expected, message, operator, stackStartFunction) {
        throw new assert.AssertionError({
            message: message,
            actual: actual,
            expected: expected,
            operator: operator,
            stackStartFunction: stackStartFunction
        });
    }
    assert.fail = fail;
    function ok(value, message) {
        if (!!!value) fail(value, true, message, "==", assert.ok);
    }
    assert.ok = ok;
    assert.equal = function equal(actual, expected, message) {
        if (actual != expected) fail(actual, expected, message, "==", assert.equal);
    };
    assert.notEqual = function notEqual(actual, expected, message) {
        if (actual == expected) {
            fail(actual, expected, message, "!=", assert.notEqual);
        }
    };
    assert.deepEqual = function deepEqual(actual, expected, message) {
        if (!_deepEqual(actual, expected)) {
            fail(actual, expected, message, "deepEqual", assert.deepEqual);
        }
    };
    function _deepEqual(actual, expected) {
        if (actual === expected) {
            return true;
        } else if (actual instanceof Date && expected instanceof Date) {
            return actual.getTime() === expected.getTime();
        } else if (actual instanceof RegExp && expected instanceof RegExp) {
            return actual.source === expected.source && actual.global === expected.global && actual.multiline === expected.multiline && actual.lastIndex === expected.lastIndex && actual.ignoreCase === expected.ignoreCase;
        } else if (typeof actual != "object" && typeof expected != "object") {
            return actual == expected;
        } else {
            return objEquiv(actual, expected);
        }
    }
    function isUndefinedOrNull(value) {
        return value === null || value === undefined;
    }
    function isArguments(object) {
        return Object.prototype.toString.call(object) == "[object Arguments]";
    }
    function objEquiv(a, b) {
        if (isUndefinedOrNull(a) || isUndefinedOrNull(b)) return false;
        if (a.prototype !== b.prototype) return false;
        if (isArguments(a)) {
            if (!isArguments(b)) {
                return false;
            }
            a = pSlice.call(a);
            b = pSlice.call(b);
            return _deepEqual(a, b);
        }
        try {
            var ka = Object_keys(a), kb = Object_keys(b), key, i;
        } catch (e) {
            return false;
        }
        if (ka.length != kb.length) return false;
        ka.sort();
        kb.sort();
        for (i = ka.length - 1; i >= 0; i--) {
            if (ka[i] != kb[i]) return false;
        }
        for (i = ka.length - 1; i >= 0; i--) {
            key = ka[i];
            if (!_deepEqual(a[key], b[key])) return false;
        }
        return true;
    }
    assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
        if (_deepEqual(actual, expected)) {
            fail(actual, expected, message, "notDeepEqual", assert.notDeepEqual);
        }
    };
    assert.strictEqual = function strictEqual(actual, expected, message) {
        if (actual !== expected) {
            fail(actual, expected, message, "===", assert.strictEqual);
        }
    };
    assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
        if (actual === expected) {
            fail(actual, expected, message, "!==", assert.notStrictEqual);
        }
    };
    function expectedException(actual, expected) {
        if (!actual || !expected) {
            return false;
        }
        if (Object.prototype.toString.call(expected) == "[object RegExp]") {
            return expected.test(actual);
        } else if (actual instanceof expected) {
            return true;
        } else if (expected.call({}, actual) === true) {
            return true;
        }
        return false;
    }
    function _throws(shouldThrow, block, expected, message) {
        var actual;
        if (typeof expected === "string") {
            message = expected;
            expected = null;
        }
        try {
            block();
        } catch (e) {
            actual = e;
        }
        message = (expected && expected.name ? " (" + expected.name + ")." : ".") + (message ? " " + message : ".");
        if (shouldThrow && !actual) {
            fail(actual, expected, "Missing expected exception" + message);
        }
        if (!shouldThrow && expectedException(actual, expected)) {
            fail(actual, expected, "Got unwanted exception" + message);
        }
        if (shouldThrow && actual && expected && !expectedException(actual, expected) || !shouldThrow && actual) {
            throw actual;
        }
    }
    assert.throws = function(block, error, message) {
        _throws.apply(this, [ true ].concat(pSlice.call(arguments)));
    };
    assert.doesNotThrow = function(block, message) {
        _throws.apply(this, [ false ].concat(pSlice.call(arguments)));
    };
    assert.ifError = function(err) {
        if (err) {
            throw err;
        }
    };
    if (typeof define === "function" && define.amd) {
        define("assert", function() {
            return assert;
        });
    }
})(this);

var ArrayBuffer, ArrayBufferView, Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array, DataView;

(function() {
    "use strict";
    var ECMAScript = {
        ToInt32: function(v) {
            return v >> 0;
        },
        ToUint32: function(v) {
            return v >>> 0;
        }
    };
    function raise_INDEX_SIZE_ERR() {
        if (typeof document !== "undefined") {
            document.createTextNode("").splitText(1);
        }
        throw new RangeError("INDEX_SIZE_ERR");
    }
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
    if (Object.prototype.__defineGetter__ && !Object.defineProperty) {
        Object.defineProperty = function(obj, prop, desc) {
            if (desc.hasOwnProperty("get")) {
                obj.__defineGetter__(prop, desc.get);
            }
            if (desc.hasOwnProperty("set")) {
                obj.__defineSetter__(prop, desc.set);
            }
        };
    }
    function makeArrayAccessors(obj) {
        if (!Object.defineProperty) {
            return;
        }
        function makeArrayAccessor(index) {
            Object.defineProperty(obj, index, {
                get: function() {
                    return obj._getter(index);
                },
                set: function(v) {
                    obj._setter(index, v);
                },
                enumerable: true,
                configurable: false
            });
        }
        var i;
        for (i = 0; i < obj.length; i += 1) {
            makeArrayAccessor(i);
        }
    }
    function as_signed(value, bits) {
        var s = 32 - bits;
        return value << s >> s;
    }
    function as_unsigned(value, bits) {
        var s = 32 - bits;
        return value << s >>> s;
    }
    function packInt8(n) {
        return [ n & 255 ];
    }
    function unpackInt8(bytes) {
        return as_signed(bytes[0], 8);
    }
    function packUint8(n) {
        return [ n & 255 ];
    }
    function unpackUint8(bytes) {
        return as_unsigned(bytes[0], 8);
    }
    function packInt16(n) {
        return [ n >> 8 & 255, n & 255 ];
    }
    function unpackInt16(bytes) {
        return as_signed(bytes[0] << 8 | bytes[1], 16);
    }
    function packUint16(n) {
        return [ n >> 8 & 255, n & 255 ];
    }
    function unpackUint16(bytes) {
        return as_unsigned(bytes[0] << 8 | bytes[1], 16);
    }
    function packInt32(n) {
        return [ n >> 24 & 255, n >> 16 & 255, n >> 8 & 255, n & 255 ];
    }
    function unpackInt32(bytes) {
        return as_signed(bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3], 32);
    }
    function packUint32(n) {
        return [ n >> 24 & 255, n >> 16 & 255, n >> 8 & 255, n & 255 ];
    }
    function unpackUint32(bytes) {
        return as_unsigned(bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3], 32);
    }
    function packIEEE754(v, ebits, fbits) {
        var bias = (1 << ebits - 1) - 1, s, e, f, ln, i, bits, str, bytes;
        if (isNaN(v)) {
            e = (1 << bias) - 1;
            f = Math.pow(2, fbits - 1);
            s = 0;
        } else if (v === Infinity || v === -Infinity) {
            e = (1 << bias) - 1;
            f = 0;
            s = v < 0 ? 1 : 0;
        } else if (v === 0) {
            e = 0;
            f = 0;
            s = 1 / v === -Infinity ? 1 : 0;
        } else {
            s = v < 0;
            v = Math.abs(v);
            if (v >= Math.pow(2, 1 - bias)) {
                ln = Math.min(Math.floor(Math.log(v) / Math.LN2), bias);
                e = ln + bias;
                f = Math.round(v * Math.pow(2, fbits - ln) - Math.pow(2, fbits));
            } else {
                e = 0;
                f = Math.round(v / Math.pow(2, 1 - bias - fbits));
            }
        }
        bits = [];
        for (i = fbits; i; i -= 1) {
            bits.push(f % 2 ? 1 : 0);
            f = Math.floor(f / 2);
        }
        for (i = ebits; i; i -= 1) {
            bits.push(e % 2 ? 1 : 0);
            e = Math.floor(e / 2);
        }
        bits.push(s ? 1 : 0);
        bits.reverse();
        str = bits.join("");
        bytes = [];
        while (str.length) {
            bytes.push(parseInt(str.substring(0, 8), 2));
            str = str.substring(8);
        }
        return bytes;
    }
    function unpackIEEE754(bytes, ebits, fbits) {
        var bits = [], i, j, b, str, bias, s, e, f;
        for (i = bytes.length; i; i -= 1) {
            b = bytes[i - 1];
            for (j = 8; j; j -= 1) {
                bits.push(b % 2 ? 1 : 0);
                b = b >> 1;
            }
        }
        bits.reverse();
        str = bits.join("");
        bias = (1 << ebits - 1) - 1;
        s = parseInt(str.substring(0, 1), 2) ? -1 : 1;
        e = parseInt(str.substring(1, 1 + ebits), 2);
        f = parseInt(str.substring(1 + ebits), 2);
        if (e === (1 << ebits) - 1) {
            return f !== 0 ? NaN : s * Infinity;
        } else if (e > 0) {
            return s * Math.pow(2, e - bias) * (1 + f / Math.pow(2, fbits));
        } else if (f !== 0) {
            return s * Math.pow(2, -(bias - 1)) * (f / Math.pow(2, fbits));
        } else {
            return s < 0 ? -0 : 0;
        }
    }
    function unpackFloat64(b) {
        return unpackIEEE754(b, 11, 52);
    }
    function packFloat64(v) {
        return packIEEE754(v, 11, 52);
    }
    function unpackFloat32(b) {
        return unpackIEEE754(b, 8, 23);
    }
    function packFloat32(v) {
        return packIEEE754(v, 8, 23);
    }
    if (!ArrayBuffer) {
        (function() {
            ArrayBuffer = function(length) {
                length = ECMAScript.ToInt32(length);
                if (length < 0) {
                    throw new RangeError("ArrayBuffer size is not a small enough positive integer.");
                }
                this.byteLength = length;
                this._bytes = [];
                this._bytes.length = length;
                var i;
                for (i = 0; i < this.byteLength; i += 1) {
                    this._bytes[i] = 0;
                }
                configureProperties(this);
            };
            ArrayBufferView = function() {};
            function makeTypedArrayConstructor(bytesPerElement, pack, unpack) {
                var ctor;
                ctor = function(buffer, byteOffset, length) {
                    var array, sequence, i, s;
                    if (!arguments.length || typeof arguments[0] === "number") {
                        this.length = ECMAScript.ToInt32(arguments[0]);
                        if (length < 0) {
                            throw new RangeError("ArrayBufferView size is not a small enough positive integer.");
                        }
                        this.byteLength = this.length * this.BYTES_PER_ELEMENT;
                        this.buffer = new ArrayBuffer(this.byteLength);
                        this.byteOffset = 0;
                    } else if (typeof arguments[0] === "object" && arguments[0].constructor === ctor) {
                        array = arguments[0];
                        this.length = array.length;
                        this.byteLength = this.length * this.BYTES_PER_ELEMENT;
                        this.buffer = new ArrayBuffer(this.byteLength);
                        this.byteOffset = 0;
                        for (i = 0; i < this.length; i += 1) {
                            this._setter(i, array._getter(i));
                        }
                    } else if (typeof arguments[0] === "object" && !(arguments[0] instanceof ArrayBuffer)) {
                        sequence = arguments[0];
                        this.length = ECMAScript.ToUint32(sequence.length);
                        this.byteLength = this.length * this.BYTES_PER_ELEMENT;
                        this.buffer = new ArrayBuffer(this.byteLength);
                        this.byteOffset = 0;
                        for (i = 0; i < this.length; i += 1) {
                            s = sequence[i];
                            this._setter(i, Number(s));
                        }
                    } else if (typeof arguments[0] === "object" && arguments[0] instanceof ArrayBuffer) {
                        this.buffer = buffer;
                        this.byteOffset = ECMAScript.ToUint32(byteOffset);
                        if (this.byteOffset > this.buffer.byteLength) {
                            raise_INDEX_SIZE_ERR();
                        }
                        if (this.byteOffset % this.BYTES_PER_ELEMENT) {
                            throw new RangeError("ArrayBuffer length minus the byteOffset is not a multiple of the element size.");
                        }
                        if (arguments.length < 3) {
                            this.byteLength = this.buffer.byteLength - this.byteOffset;
                            if (this.byteLength % this.BYTES_PER_ELEMENT) {
                                raise_INDEX_SIZE_ERR();
                            }
                            this.length = this.byteLength / this.BYTES_PER_ELEMENT;
                        } else {
                            this.length = ECMAScript.ToUint32(length);
                            this.byteLength = this.length * this.BYTES_PER_ELEMENT;
                        }
                        if (this.byteOffset + this.byteLength > this.buffer.byteLength) {
                            raise_INDEX_SIZE_ERR();
                        }
                    } else {
                        throw new TypeError("Unexpected argument type(s)");
                    }
                    this.constructor = ctor;
                };
                ctor.prototype = new ArrayBufferView();
                ctor.prototype.BYTES_PER_ELEMENT = bytesPerElement;
                ctor.prototype._pack = pack;
                ctor.prototype._unpack = unpack;
                ctor.BYTES_PER_ELEMENT = bytesPerElement;
                ctor.prototype._getter = function(index) {
                    if (arguments.length < 1) {
                        throw new SyntaxError("Not enough arguments");
                    }
                    index = ECMAScript.ToUint32(index);
                    if (index >= this.length) {
                        return;
                    }
                    var bytes = [], i, o;
                    for (i = 0, o = this.byteOffset + index * this.BYTES_PER_ELEMENT; i < this.BYTES_PER_ELEMENT; i += 1, 
                    o += 1) {
                        bytes.push(this.buffer._bytes[o]);
                    }
                    return this._unpack(bytes);
                };
                ctor.prototype.get = ctor.prototype._getter;
                ctor.prototype._setter = function(index, value) {
                    if (arguments.length < 2) {
                        throw new SyntaxError("Not enough arguments");
                    }
                    index = ECMAScript.ToUint32(index);
                    if (index >= this.length) {
                        return;
                    }
                    var bytes = this._pack(value), i, o;
                    for (i = 0, o = this.byteOffset + index * this.BYTES_PER_ELEMENT; i < this.BYTES_PER_ELEMENT; i += 1, 
                    o += 1) {
                        this.buffer._bytes[o] = bytes[i];
                    }
                };
                ctor.prototype.set = function(index, value) {
                    if (arguments.length < 1) {
                        throw new SyntaxError("Not enough arguments");
                    }
                    var array, sequence, offset, len, i, s, d, byteOffset, byteLength, tmp;
                    if (typeof arguments[0] === "object" && arguments[0].constructor === this.constructor) {
                        array = arguments[0];
                        offset = ECMAScript.ToUint32(arguments[1]);
                        if (offset + array.length > this.length) {
                            raise_INDEX_SIZE_ERR();
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
                        } else {
                            for (i = 0, s = array.byteOffset, d = byteOffset; i < byteLength; i += 1, s += 1, 
                            d += 1) {
                                this.buffer._bytes[d] = array.buffer._bytes[s];
                            }
                        }
                    } else if (typeof arguments[0] === "object" && typeof arguments[0].length !== "undefined") {
                        sequence = arguments[0];
                        len = ECMAScript.ToUint32(sequence.length);
                        offset = ECMAScript.ToUint32(arguments[1]);
                        if (offset + len > this.length) {
                            raise_INDEX_SIZE_ERR();
                        }
                        for (i = 0; i < len; i += 1) {
                            s = sequence[i];
                            this._setter(offset + i, Number(s));
                        }
                    } else {
                        throw new TypeError("Unexpected argument type(s)");
                    }
                };
                ctor.prototype.subarray = function(start, end) {
                    function clamp(v, min, max) {
                        return v < min ? min : v > max ? max : v;
                    }
                    start = ECMAScript.ToInt32(start);
                    end = ECMAScript.ToInt32(end);
                    if (arguments.length < 1) {
                        start = 0;
                    }
                    if (arguments.length < 2) {
                        end = this.length;
                    }
                    if (start < 0) {
                        start = this.length + start;
                    }
                    if (end < 0) {
                        end = this.length + end;
                    }
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
        })();
    }
    if (!DataView) {
        (function() {
            function r(array, index) {
                if (typeof array.get === "function") {
                    return array.get(index);
                } else {
                    return array[index];
                }
            }
            var IS_BIG_ENDIAN = function() {
                var u16array = new Uint16Array([ 4660 ]), u8array = new Uint8Array(u16array.buffer);
                return r(u8array, 0) === 18;
            }();
            DataView = function(buffer, byteOffset, byteLength) {
                if (!(typeof buffer === "object" && buffer instanceof ArrayBuffer)) {
                    throw new TypeError("TypeError");
                }
                this.buffer = buffer;
                this.byteOffset = ECMAScript.ToUint32(byteOffset);
                if (this.byteOffset > this.buffer.byteLength) {
                    raise_INDEX_SIZE_ERR();
                }
                if (arguments.length < 3) {
                    this.byteLength = this.buffer.byteLength - this.byteOffset;
                } else {
                    this.byteLength = ECMAScript.ToUint32(byteLength);
                }
                if (this.byteOffset + this.byteLength > this.buffer.byteLength) {
                    raise_INDEX_SIZE_ERR();
                }
                configureProperties(this);
            };
            if (ArrayBufferView) {
                DataView.prototype = new ArrayBufferView();
            }
            function makeDataView_getter(arrayType) {
                return function(byteOffset, littleEndian) {
                    byteOffset = ECMAScript.ToUint32(byteOffset);
                    if (byteOffset + arrayType.BYTES_PER_ELEMENT > this.byteLength) {
                        raise_INDEX_SIZE_ERR();
                    }
                    byteOffset += this.byteOffset;
                    var uint8Array = new Uint8Array(this.buffer, byteOffset, arrayType.BYTES_PER_ELEMENT), bytes = [], i;
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
                return function(byteOffset, value, littleEndian) {
                    byteOffset = ECMAScript.ToUint32(byteOffset);
                    if (byteOffset + arrayType.BYTES_PER_ELEMENT > this.byteLength) {
                        raise_INDEX_SIZE_ERR();
                    }
                    var typeArray = new arrayType([ value ]), byteArray = new Uint8Array(typeArray.buffer), bytes = [], i, byteView;
                    for (i = 0; i < arrayType.BYTES_PER_ELEMENT; i += 1) {
                        bytes.push(r(byteArray, i));
                    }
                    if (Boolean(littleEndian) === Boolean(IS_BIG_ENDIAN)) {
                        bytes.reverse();
                    }
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
        })();
    }
})();

(function() {
    var BrowserFS, canUsePostMessage, checkFd, handleMessage, makeArrayAccessors, messageName, name, nopCb, startTime, timeouts, value, wrapCb, _ref, _ref1, _ref2, __indexOf = [].indexOf || function(item) {
        for (var i = 0, l = this.length; i < l; i++) {
            if (i in this && this[i] === item) return i;
        }
        return -1;
    }, __hasProp = {}.hasOwnProperty, __extends = function(child, parent) {
        for (var key in parent) {
            if (__hasProp.call(parent, key)) child[key] = parent[key];
        }
        function ctor() {
            this.constructor = child;
        }
        ctor.prototype = parent.prototype;
        child.prototype = new ctor();
        child.__super__ = parent.prototype;
        return child;
    }, __slice = [].slice;
    BrowserFS = function() {
        function BrowserFS() {}
        BrowserFS.node = {};
        BrowserFS.install = function(obj) {
            var oldRequire;
            obj.Buffer = BrowserFS.node.Buffer;
            obj.process = BrowserFS.node.process;
            oldRequire = obj.require != null ? obj.require : null;
            return obj.require = function(arg, herp) {
                if (herp != null && arg == null) {
                    arg = herp;
                }
                switch (arg) {
                  case "fs":
                    return BrowserFS.node.fs;

                  case "path":
                    return BrowserFS.node.path;

                  case "process":
                    return BrowserFS.node.process;

                  case "buffer":
                    return BrowserFS.node;

                  default:
                    if (oldRequire != null) {
                        return oldRequire.apply(this, arguments);
                    } else {
                        throw new Error("Module not found: " + arg);
                    }
                }
            };
        };
        BrowserFS.initialize = function(rootfs) {
            return BrowserFS.node.fs._initialize(rootfs);
        };
        BrowserFS.util = {
            roughSizeOfObject: function(object) {
                var bytes, key, objectList, prop, stack, value;
                objectList = [];
                stack = [ object ];
                bytes = 0;
                while (stack.length !== 0) {
                    value = stack.pop();
                    if (typeof value === "boolean") {
                        bytes += 4;
                    } else if (typeof value === "string") {
                        bytes += value.length * 2;
                    } else if (typeof value === "number") {
                        bytes += 8;
                    } else if (typeof value === "object" && __indexOf.call(objectList, value) < 0) {
                        objectList.push(value);
                        bytes += 4;
                        for (key in value) {
                            prop = value[key];
                            bytes += key.length * 2;
                            stack.push(prop);
                        }
                    }
                }
                return bytes;
            }
        };
        BrowserFS.isIE = /(msie) ([\w.]+)/.exec(navigator.userAgent.toLowerCase());
        return BrowserFS;
    }();
    BrowserFS.ApiError = function() {
        ApiError.NETWORK_ERROR = 0;
        ApiError.INVALID_PARAM = 400;
        ApiError.INVALID_TOKEN = 401;
        ApiError.AUTH_ERROR = 403;
        ApiError.NOT_FOUND = 404;
        ApiError.DRIVE_FULL = 507;
        ApiError.NOT_SUPPORTED = 405;
        ApiError.PERMISSIONS_ERROR = 900;
        function ApiError(type, message) {
            this.type = type;
            this.message = message != null ? message : "";
        }
        ApiError.prototype.toString = function() {
            var typeStr;
            typeStr = function() {
                switch (this.type) {
                  case BrowserFS.ApiError.NETWORK_ERROR:
                    return "Network Error";

                  case BrowserFS.ApiError.INVALID_PARAM:
                    return "Invalid Param";

                  case BrowserFS.ApiError.INVALID_TOKEN:
                    return "Invalid Token";

                  case BrowserFS.ApiError.AUTH_ERROR:
                    return "Auth Error";

                  case BrowserFS.ApiError.NOT_FOUND:
                    return "Not Found";

                  case BrowserFS.ApiError.DRIVE_FULL:
                    return "Drive Full";

                  case BrowserFS.ApiError.NOT_SUPPORTED:
                    return "Not Supported";

                  case BrowserFS.ApiError.PERMISSIONS_ERROR:
                    return "Permissions Error";

                  default:
                    return "Error";
                }
            }.call(this);
            return "BrowserFS " + typeStr + ": " + this.message;
        };
        return ApiError;
    }();
    if (Object.prototype.__defineGetter__ && !Object.defineProperty) {
        Object.defineProperty = function(obj, prop, desc) {
            if (desc.hasOwnProperty("get")) {
                obj.__defineGetter__(prop, desc.get);
            }
            if (desc.hasOwnProperty("set")) {
                return obj.__defineSetter__(prop, desc.set);
            }
        };
    }
    makeArrayAccessors = function(obj) {
        var i, makeArrayAccessor, _i, _ref;
        if (!Object.defineProperty) {
            return;
        }
        makeArrayAccessor = function(index) {
            return Object.defineProperty(obj, index, {
                get: function() {
                    return obj.get(index);
                },
                set: function(v) {
                    return obj.set(index, v);
                },
                enumerable: true,
                configurable: false
            });
        };
        for (i = _i = 0, _ref = obj.length; _i < _ref; i = _i += 1) {
            makeArrayAccessor(i);
        }
    };
    BrowserFS.node.Buffer = function() {
        Buffer.isEncoding = function(enc) {
            var e;
            try {
                BrowserFS.StringUtil.FindUtil(enc);
            } catch (_error) {
                e = _error;
                return false;
            }
            return true;
        };
        Buffer.isBuffer = function(obj) {
            return obj instanceof BrowserFS.node.Buffer;
        };
        Buffer.byteLength = function(str, encoding) {
            var strUtil;
            if (encoding == null) {
                encoding = "utf8";
            }
            strUtil = BrowserFS.StringUtil.FindUtil(encoding);
            return strUtil.byteLength(str);
        };
        Buffer.concat = function(list, totalLength) {
            var buf, curPos, item, _i, _j, _len, _len1;
            if (list.length === 0 || totalLength === 0) {
                return new BrowserFS.node.Buffer(0);
            } else if (list.length === 1) {
                return list[0];
            } else {
                if (totalLength == null) {
                    totalLength = 0;
                    for (_i = 0, _len = list.length; _i < _len; _i++) {
                        item = list[_i];
                        totalLength += item.length;
                    }
                }
                buf = new BrowserFS.node.Buffer(totalLength);
                curPos = 0;
                for (_j = 0, _len1 = list.length; _j < _len1; _j++) {
                    item = list[_j];
                    curPos += item.copy(buf, curPos);
                }
                return buf;
            }
        };
        function Buffer(arg1, arg2) {
            var datum, i, rv, _i, _j, _len, _ref;
            if (arg2 == null) {
                arg2 = "utf8";
            }
            if (!(this instanceof BrowserFS.node.Buffer)) {
                return new BrowserFS.node.Buffer(arg1, arg2);
            }
            this._charsWritten = 0;
            if (typeof arg1 === "number") {
                if (arg1 !== arg1 >>> 0) {
                    throw new TypeError("Buffer size must be a uint32.");
                }
                this.length = arg1;
                this.buff = new DataView(new ArrayBuffer(this.length));
            } else if (arg1 instanceof DataView) {
                this.buff = arg1;
                this.length = arg1.byteLength;
            } else if (arg1 instanceof ArrayBuffer) {
                this.buff = new DataView(arg1);
                this.length = arg1.byteLength;
            } else if (arg1 instanceof BrowserFS.node.Buffer) {
                this.buff = new DataView(new ArrayBuffer(arg1.length));
                for (i = _i = 0, _ref = arg1.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
                    this.buff.setUint8(i, arg1.get(i));
                }
                this.length = arg1.length;
            } else if (Array.isArray(arg1) || arg1[0] != null && typeof arg1[0] === "number") {
                this.buff = new DataView(new ArrayBuffer(arg1.length));
                for (i = _j = 0, _len = arg1.length; _j < _len; i = _j += 1) {
                    datum = arg1[i];
                    this.buff.setUint8(i, datum);
                }
                this.length = arg1.length;
            } else if (typeof arg1 === "string") {
                this.length = BrowserFS.node.Buffer.byteLength(arg1, arg2);
                this.buff = new DataView(new ArrayBuffer(this.length));
                rv = this.write(arg1, 0, this.length, arg2);
            } else {
                throw new Error("Invalid argument to Buffer constructor: " + arg1);
            }
        }
        Buffer.prototype.set = function(index, value) {
            return this.buff.setUint8(index, value);
        };
        Buffer.prototype.get = function(index) {
            return this.buff.getUint8(index);
        };
        Buffer.prototype.write = function(str, offset, length, encoding) {
            var strUtil;
            if (offset == null) {
                offset = 0;
            }
            if (length == null) {
                length = this.length;
            }
            if (encoding == null) {
                encoding = "utf8";
            }
            if (typeof offset === "string") {
                encoding = offset;
                offset = 0;
                length = this.length;
            } else if (typeof length === "string") {
                encoding = length;
                length = this.length;
            }
            if (offset >= this.length) {
                return 0;
            }
            strUtil = BrowserFS.StringUtil.FindUtil(encoding);
            length = length + offset > this.length ? this.length - offset : length;
            return strUtil.str2byte(this, str, offset, length);
        };
        Buffer.prototype.toString = function(encoding, start, end) {
            var byteArr, i, len, strUtil, _i;
            if (encoding == null) {
                encoding = "utf8";
            }
            if (start == null) {
                start = 0;
            }
            if (end == null) {
                end = this.length;
            }
            if (!(start <= end)) {
                throw new Error("Invalid start/end positions: " + start + " - " + end);
            }
            if (start === end) {
                return "";
            }
            if (end > this.length) {
                end = this.length;
            }
            strUtil = BrowserFS.StringUtil.FindUtil(encoding);
            len = end - start;
            byteArr = new Array(len);
            for (i = _i = 0; _i < len; i = _i += 1) {
                byteArr[i] = this.readUInt8(start + i);
            }
            return strUtil.byte2str(byteArr);
        };
        Buffer.prototype.toJSON = function() {
            var arr, i, _i, _ref;
            arr = new Array(this.length);
            for (i = _i = 0, _ref = this.length; _i < _ref; i = _i += 1) {
                arr[i] = this.buff.getUint8(i);
            }
            return {
                type: "Buffer",
                data: arr
            };
        };
        Buffer.prototype.copy = function(target, targetStart, sourceStart, sourceEnd) {
            var bytesCopied, i, _i;
            if (targetStart == null) {
                targetStart = 0;
            }
            if (sourceStart == null) {
                sourceStart = 0;
            }
            if (sourceEnd == null) {
                sourceEnd = this.length;
            }
            targetStart = targetStart < 0 ? 0 : targetStart;
            sourceStart = sourceStart < 0 ? 0 : sourceStart;
            if (sourceEnd < sourceStart) {
                throw new RangeError("sourceEnd < sourceStart");
            }
            if (sourceEnd === sourceStart) {
                return 0;
            }
            if (targetStart >= target.length) {
                throw new RangeError("targetStart out of bounds");
            }
            if (sourceStart >= this.length) {
                throw new RangeError("sourceStart out of bounds");
            }
            if (sourceEnd > this.length) {
                throw new RangeError("sourceEnd out of bounds");
            }
            bytesCopied = Math.min(sourceEnd - sourceStart, target.length - targetStart, this.length - sourceStart);
            for (i = _i = 0; 0 <= bytesCopied ? _i < bytesCopied : _i > bytesCopied; i = 0 <= bytesCopied ? ++_i : --_i) {
                target.writeUInt8(this.readUInt8(sourceStart + i), targetStart + i);
            }
            return bytesCopied;
        };
        Buffer.prototype.slice = function(start, end) {
            if (start == null) {
                start = 0;
            }
            if (end == null) {
                end = this.length;
            }
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
            return new BrowserFS.node.Buffer(new DataView(this.buff.buffer, this.buff.byteOffset + start, end - start));
        };
        Buffer.prototype.fill = function(value, offset, end) {
            var i, num32, remSt, val32, valType, _i, _j;
            if (offset == null) {
                offset = 0;
            }
            if (end == null) {
                end = this.length;
            }
            valType = typeof value;
            switch (valType) {
              case "string":
                value = value.charCodeAt(0) & 255;
                break;

              case "number":
                break;

              default:
                throw new Error("Invalid argument to fill.");
            }
            val32 = value | value << 8 | value << 16 | value << 24;
            num32 = Math.floor((end - offset) / 4);
            remSt = offset + num32 * 4;
            for (i = _i = 0; 0 <= num32 ? _i < num32 : _i > num32; i = 0 <= num32 ? ++_i : --_i) {
                this.writeUInt32LE(val32, offset + i * 4);
            }
            for (i = _j = remSt; remSt <= end ? _j < end : _j > end; i = remSt <= end ? ++_j : --_j) {
                this.writeUInt8(value, i);
            }
        };
        Buffer.prototype.readUInt8 = function(offset, noAssert) {
            if (noAssert == null) {
                noAssert = false;
            }
            return this.buff.getUint8(offset);
        };
        Buffer.prototype.readUInt16LE = function(offset, noAssert) {
            if (noAssert == null) {
                noAssert = false;
            }
            return this.buff.getUint16(offset, true);
        };
        Buffer.prototype.readUInt16BE = function(offset, noAssert) {
            if (noAssert == null) {
                noAssert = false;
            }
            return this.buff.getUint16(offset, false);
        };
        Buffer.prototype.readUInt32LE = function(offset, noAssert) {
            if (noAssert == null) {
                noAssert = false;
            }
            return this.buff.getUint32(offset, true);
        };
        Buffer.prototype.readUInt32BE = function(offset, noAssert) {
            if (noAssert == null) {
                noAssert = false;
            }
            return this.buff.getUint32(offset, false);
        };
        Buffer.prototype.readInt8 = function(offset, noAssert) {
            if (noAssert == null) {
                noAssert = false;
            }
            return this.buff.getInt8(offset);
        };
        Buffer.prototype.readInt16LE = function(offset, noAssert) {
            if (noAssert == null) {
                noAssert = false;
            }
            return this.buff.getInt16(offset, true);
        };
        Buffer.prototype.readInt16BE = function(offset, noAssert) {
            if (noAssert == null) {
                noAssert = false;
            }
            return this.buff.getInt16(offset, false);
        };
        Buffer.prototype.readInt32LE = function(offset, noAssert) {
            if (noAssert == null) {
                noAssert = false;
            }
            return this.buff.getInt32(offset, true);
        };
        Buffer.prototype.readInt32BE = function(offset, noAssert) {
            if (noAssert == null) {
                noAssert = false;
            }
            return this.buff.getInt32(offset, false);
        };
        Buffer.prototype.readFloatLE = function(offset, noAssert) {
            if (noAssert == null) {
                noAssert = false;
            }
            return this.buff.getFloat32(offset, true);
        };
        Buffer.prototype.readFloatBE = function(offset, noAssert) {
            if (noAssert == null) {
                noAssert = false;
            }
            return this.buff.getFloat32(offset, false);
        };
        Buffer.prototype.readDoubleLE = function(offset, noAssert) {
            if (noAssert == null) {
                noAssert = false;
            }
            return this.buff.getFloat64(offset, true);
        };
        Buffer.prototype.readDoubleBE = function(offset, noAssert) {
            if (noAssert == null) {
                noAssert = false;
            }
            return this.buff.getFloat64(offset, false);
        };
        Buffer.prototype.writeUInt8 = function(value, offset, noAssert) {
            if (noAssert == null) {
                noAssert = false;
            }
            return this.buff.setUint8(offset, value);
        };
        Buffer.prototype.writeUInt16LE = function(value, offset, noAssert) {
            if (noAssert == null) {
                noAssert = false;
            }
            return this.buff.setUint16(offset, value, true);
        };
        Buffer.prototype.writeUInt16BE = function(value, offset, noAssert) {
            if (noAssert == null) {
                noAssert = false;
            }
            return this.buff.setUint16(offset, value, false);
        };
        Buffer.prototype.writeUInt32LE = function(value, offset, noAssert) {
            if (noAssert == null) {
                noAssert = false;
            }
            return this.buff.setUint32(offset, value, true);
        };
        Buffer.prototype.writeUInt32BE = function(value, offset, noAssert) {
            if (noAssert == null) {
                noAssert = false;
            }
            return this.buff.setUint32(offset, value, false);
        };
        Buffer.prototype.writeInt8 = function(value, offset, noAssert) {
            if (noAssert == null) {
                noAssert = false;
            }
            return this.buff.setInt8(offset, value);
        };
        Buffer.prototype.writeInt16LE = function(value, offset, noAssert) {
            if (noAssert == null) {
                noAssert = false;
            }
            return this.buff.setInt16(offset, value, true);
        };
        Buffer.prototype.writeInt16BE = function(value, offset, noAssert) {
            if (noAssert == null) {
                noAssert = false;
            }
            return this.buff.setInt16(offset, value, false);
        };
        Buffer.prototype.writeInt32LE = function(value, offset, noAssert) {
            if (noAssert == null) {
                noAssert = false;
            }
            return this.buff.setInt32(offset, value, true);
        };
        Buffer.prototype.writeInt32BE = function(value, offset, noAssert) {
            if (noAssert == null) {
                noAssert = false;
            }
            return this.buff.setInt32(offset, value, false);
        };
        Buffer.prototype.writeFloatLE = function(value, offset, noAssert) {
            if (noAssert == null) {
                noAssert = false;
            }
            return this.buff.setFloat32(offset, value, true);
        };
        Buffer.prototype.writeFloatBE = function(value, offset, noAssert) {
            if (noAssert == null) {
                noAssert = false;
            }
            return this.buff.setFloat32(offset, value, false);
        };
        Buffer.prototype.writeDoubleLE = function(value, offset, noAssert) {
            if (noAssert == null) {
                noAssert = false;
            }
            return this.buff.setFloat64(offset, value, true);
        };
        Buffer.prototype.writeDoubleBE = function(value, offset, noAssert) {
            if (noAssert == null) {
                noAssert = false;
            }
            return this.buff.setFloat64(offset, value, false);
        };
        return Buffer;
    }();
    BrowserFS.File = function() {
        function File() {}
        File.prototype.getPos = function() {
            throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
        };
        File.prototype.stat = function(cb) {
            return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
        };
        File.prototype.statSync = function() {
            throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
        };
        File.prototype.close = function(cb) {
            return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
        };
        File.prototype.closeSync = function() {
            throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
        };
        File.prototype.truncate = function(len, cb) {
            return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
        };
        File.prototype.truncateSync = function(len) {
            throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
        };
        File.prototype.sync = function(cb) {
            return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
        };
        File.prototype.syncSync = function() {
            throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
        };
        File.prototype.write = function(buffer, offset, length, position, cb) {
            return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
        };
        File.prototype.writeSync = function(buffer, offset, length, position) {
            throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
        };
        File.prototype.read = function(buffer, offset, length, position, cb) {
            return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
        };
        File.prototype.readSync = function(buffer, offset, length, position) {
            throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
        };
        File.prototype.datasync = function(cb) {
            return this.sync(cb);
        };
        File.prototype.datasyncSync = function() {
            return this.syncSync();
        };
        File.prototype.chown = function(uid, gid, cb) {
            return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
        };
        File.prototype.chownSync = function(uid, gid) {
            throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
        };
        File.prototype.chmod = function(mode, cb) {
            return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
        };
        File.prototype.chmodSync = function(mode) {
            throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
        };
        File.prototype.utimes = function(atime, mtime, cb) {
            return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
        };
        File.prototype.utimesSync = function(atime, mtime) {
            throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
        };
        return File;
    }();
    BrowserFS.FileSystem = function() {
        function FileSystem() {}
        FileSystem.prototype.getName = function() {
            return "Unspecified";
        };
        FileSystem.isAvailable = function() {
            return false;
        };
        FileSystem.prototype.diskSpace = function(path, cb) {
            return cb(0, 0);
        };
        FileSystem.prototype.isReadOnly = function() {
            return true;
        };
        FileSystem.prototype.supportsLinks = function() {
            return false;
        };
        FileSystem.prototype.supportsProps = function() {
            return false;
        };
        FileSystem.prototype.supportsSynch = function() {
            return false;
        };
        FileSystem.prototype.rename = function(oldPath, newPath, cb) {
            return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
        };
        FileSystem.prototype.renameSync = function(oldPath, newPath) {
            throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
        };
        FileSystem.prototype.stat = function(path, isLstat, cb) {
            return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
        };
        FileSystem.prototype.statSync = function(path, isLstat) {
            throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
        };
        FileSystem.prototype.open = function(path, flags, mode, cb) {
            return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
        };
        FileSystem.prototype.openSync = function(path, flags, mode) {
            throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
        };
        FileSystem.prototype.unlink = function(path, cb) {
            return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
        };
        FileSystem.prototype.unlinkSync = function(path) {
            throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
        };
        FileSystem.prototype.rmdir = function(path, cb) {
            return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
        };
        FileSystem.prototype.rmdirSync = function(path) {
            throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
        };
        FileSystem.prototype.mkdir = function(path, mode, cb) {
            return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
        };
        FileSystem.prototype.mkdirSync = function(path, mode) {
            throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
        };
        FileSystem.prototype.readdir = function(path, cb) {
            return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
        };
        FileSystem.prototype.readdirSync = function(path) {
            throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
        };
        FileSystem.prototype.exists = function(path, cb) {
            return this.stat(path, null, function(err) {
                return cb(err == null);
            });
        };
        FileSystem.prototype.existsSync = function(path) {
            var e;
            try {
                this.statSync(path);
                return true;
            } catch (_error) {
                e = _error;
                return false;
            }
        };
        FileSystem.prototype.realpath = function(path, cache, cb) {
            var addPaths, i, splitPath, _i, _ref, _results;
            if (this.supportsLinks()) {
                splitPath = path.split(BrowserFS.node.path.sep);
                _results = [];
                for (i = _i = 0, _ref = splitPath.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
                    addPaths = splitPath.slice(0, i + 1);
                    _results.push(splitPath[i] = BrowserFS.node.path.join.apply(null, addPaths));
                }
                return _results;
            } else {
                return this.exists(path, function(doesExist) {
                    if (doesExist) {
                        return cb(null, path);
                    } else {
                        return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_FOUND, "File " + path + " not found."));
                    }
                });
            }
        };
        FileSystem.prototype.realpathSync = function(path, cache) {
            var addPaths, i, splitPath, _i, _ref, _results;
            if (this.supportsLinks()) {
                splitPath = path.split(BrowserFS.node.path.sep);
                _results = [];
                for (i = _i = 0, _ref = splitPath.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
                    addPaths = splitPath.slice(0, i + 1);
                    _results.push(splitPath[i] = BrowserFS.node.path.join.apply(null, addPaths));
                }
                return _results;
            } else {
                if (this.existsSync(path)) {
                    return path;
                } else {
                    throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_FOUND, "File " + path + " not found.");
                }
            }
        };
        FileSystem.prototype.truncate = function(path, len, cb) {
            return BrowserFS.node.fs.open(path, "w", function(er, fd) {
                if (er) {
                    return cb(er);
                }
                return BrowserFS.node.fs.ftruncate(fd, len, function(er) {
                    return BrowserFS.node.fs.close(fd, function(er2) {
                        return cb(er || er2);
                    });
                });
            });
        };
        FileSystem.prototype.truncateSync = function(path, len) {
            var e, fd;
            fd = BrowserFS.node.fs.openSync(path, "w");
            try {
                BrowserFS.node.fs.ftruncateSync(fd, len);
            } catch (_error) {
                e = _error;
            }
            BrowserFS.node.fs.closeSync(fd);
            if (e != null) {
                throw e;
            }
        };
        FileSystem.prototype.readFile = function(fname, encoding, flag, cb) {
            var oldCb;
            oldCb = cb;
            return this.open(fname, flag, 420, function(err, fd) {
                if (err != null) {
                    return cb(err);
                }
                cb = function(err, arg) {
                    return fd.close(function(err2) {
                        if (err == null) {
                            err = err2;
                        }
                        return oldCb(err, arg);
                    });
                };
                return BrowserFS.node.fs.fstat(fd, function(err, stat) {
                    var buf;
                    if (err != null) {
                        return cb(err);
                    }
                    buf = new BrowserFS.node.Buffer(stat.size);
                    return BrowserFS.node.fs.read(fd, buf, 0, stat.size, 0, function(err) {
                        var e;
                        if (err != null) {
                            return cb(err);
                        }
                        if (encoding === null) {
                            return cb(err, buf);
                        }
                        try {
                            return cb(null, buf.toString(encoding));
                        } catch (_error) {
                            e = _error;
                            return cb(e);
                        }
                    });
                });
            });
        };
        FileSystem.prototype.readFileSync = function(fname, encoding, flag) {
            var buf, e, fd, stat;
            fd = this.openSync(fname, flag, 420);
            try {
                stat = BrowserFS.node.fs.fstatSync(fd);
                buf = new BrowserFS.node.Buffer(stat.size);
                BrowserFS.node.fs.readSync(fd, buf, 0, stat.size, 0);
                BrowserFS.node.fs.closeSync(fd);
                if (encoding === null) {
                    return buf;
                }
                return buf.toString(encoding);
            } catch (_error) {
                e = _error;
                BrowserFS.node.fs.closeSync(fd);
                throw e;
            }
        };
        FileSystem.prototype.writeFile = function(fname, data, encoding, flag, mode, cb) {
            var oldCb;
            oldCb = cb;
            return this.open(fname, flag, 420, function(err, fd) {
                if (err != null) {
                    return cb(err);
                }
                cb = function(err) {
                    return fd.close(function(err2) {
                        return oldCb(err != null ? err : err2);
                    });
                };
                if (typeof data === "string") {
                    data = new BrowserFS.node.Buffer(data, encoding);
                }
                return fd.write(data, 0, data.length, 0, function(err) {
                    return cb(err);
                });
            });
        };
        FileSystem.prototype.writeFileSync = function(fname, data, encoding, flag, mode) {
            var e, fd;
            fd = this.openSync(fname, flag, mode);
            if (typeof data === "string") {
                data = new BrowserFS.node.Buffer(data, encoding);
            }
            try {
                fd.writeSync(data, 0, data.length, 0);
            } catch (_error) {
                e = _error;
            }
            BrowserFS.node.fs.closeSync(fd);
            if (e != null) {
                throw e;
            }
        };
        FileSystem.prototype.appendFile = function(fname, data, encoding, flag, mode, cb) {
            var oldCb;
            oldCb = cb;
            return this.open(fname, flag, mode, function(err, fd) {
                if (err != null) {
                    cb(err);
                }
                cb = function(err) {
                    return fd.close(function(err2) {
                        return oldCb(err != null ? err : err2);
                    });
                };
                if (typeof data === "string") {
                    data = new BrowserFS.node.Buffer(data, encoding);
                }
                return fd.write(data, 0, data.length, null, function(err) {
                    return cb(err);
                });
            });
        };
        FileSystem.prototype.appendFileSync = function(fname, data, encoding, flag, mode) {
            var e, fd;
            fd = this.openSync(fname, flag, mode);
            if (typeof data === "string") {
                data = new BrowserFS.node.Buffer(data, encoding);
            }
            try {
                fd.writeSync(data, 0, data.length, null);
            } catch (_error) {
                e = _error;
            }
            BrowserFS.node.fs.closeSync(fd);
            if (e != null) {
                throw e;
            }
        };
        FileSystem.prototype.chmod = function(path, isLchmod, mode, cb) {
            return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
        };
        FileSystem.prototype.chmodSync = function(path, isLchmod, mode) {
            throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
        };
        FileSystem.prototype.chown = function(path, isLchown, uid, gid, cb) {
            return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
        };
        FileSystem.prototype.chownSync = function(path, isLchown, uid, gid) {
            throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
        };
        FileSystem.prototype.utimes = function(path, atime, mtime, cb) {
            return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
        };
        FileSystem.prototype.utimesSync = function(path, atime, mtime) {
            throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
        };
        FileSystem.prototype.link = function(srcpath, dstpath, cb) {
            return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
        };
        FileSystem.prototype.linkSync = function(srcpath, dstpath) {
            throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
        };
        FileSystem.prototype.symlink = function(srcpath, dstpath, type, cb) {
            return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
        };
        FileSystem.prototype.symlinkSync = function(srcpath, dstpath, type) {
            throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
        };
        FileSystem.prototype.readlink = function(path, cb) {
            return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED));
        };
        FileSystem.prototype.readlinkSync = function(path) {
            throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
        };
        return FileSystem;
    }();
    BrowserFS.SynchronousFileSystem = function(_super) {
        __extends(SynchronousFileSystem, _super);
        function SynchronousFileSystem() {
            _ref = SynchronousFileSystem.__super__.constructor.apply(this, arguments);
            return _ref;
        }
        SynchronousFileSystem.prototype.supportsSynch = function() {
            return true;
        };
        SynchronousFileSystem.prototype.rename = function(oldPath, newPath, cb) {
            var e;
            try {
                this.renameSync(oldPath, newPath);
                return cb();
            } catch (_error) {
                e = _error;
                return cb(e);
            }
        };
        SynchronousFileSystem.prototype.stat = function(path, isLstat, cb) {
            var e;
            try {
                return cb(null, this.statSync(path, isLstat));
            } catch (_error) {
                e = _error;
                return cb(e);
            }
        };
        SynchronousFileSystem.prototype.open = function(path, flags, mode, cb) {
            var e;
            try {
                return cb(null, this.openSync(path, flags, mode, cb));
            } catch (_error) {
                e = _error;
                return cb(e);
            }
        };
        SynchronousFileSystem.prototype.unlink = function(path, cb) {
            var e;
            try {
                this.unlinkSync(path);
                return cb();
            } catch (_error) {
                e = _error;
                return cb(e);
            }
        };
        SynchronousFileSystem.prototype.rmdir = function(path, cb) {
            var e;
            try {
                this.rmdirSync(path);
                return cb();
            } catch (_error) {
                e = _error;
                return cb(e);
            }
        };
        SynchronousFileSystem.prototype.mkdir = function(path, mode, cb) {
            var e;
            try {
                this.mkdirSync(path, mode);
                return cb();
            } catch (_error) {
                e = _error;
                return cb(e);
            }
        };
        SynchronousFileSystem.prototype.readdir = function(path, cb) {
            var e;
            try {
                return cb(null, this.readdirSync(path));
            } catch (_error) {
                e = _error;
                return cb(e);
            }
        };
        SynchronousFileSystem.prototype.chmod = function(path, isLchmod, mode, cb) {
            var e;
            try {
                this.chmodSync(path, isLchmod, mode);
                return cb();
            } catch (_error) {
                e = _error;
                return cb(e);
            }
        };
        SynchronousFileSystem.prototype.chown = function(path, isLchown, uid, gid, cb) {
            var e;
            try {
                this.chownSync(path, isLchown, uid, gid);
                return cb();
            } catch (_error) {
                e = _error;
                return cb(e);
            }
        };
        SynchronousFileSystem.prototype.utimes = function(path, atime, mtime, cb) {
            var e;
            try {
                this.utimesSync(path, atime, mtime);
                return cb();
            } catch (_error) {
                e = _error;
                return cb(e);
            }
        };
        SynchronousFileSystem.prototype.link = function(srcpath, dstpath, cb) {
            var e;
            try {
                this.linkSync(srcpath, dstpath);
                return cb();
            } catch (_error) {
                e = _error;
                return cb(e);
            }
        };
        SynchronousFileSystem.prototype.symlink = function(srcpath, dstpath, type, cb) {
            var e;
            try {
                this.symlinkSync(srcpath, dstpath, type);
                return cb();
            } catch (_error) {
                e = _error;
                return cb(e);
            }
        };
        SynchronousFileSystem.prototype.readlink = function(path, cb) {
            var e;
            try {
                return cb(null, this.readlinkSync(path));
            } catch (_error) {
                e = _error;
                return cb(e);
            }
        };
        return SynchronousFileSystem;
    }(BrowserFS.FileSystem);
    wrapCb = function(cb, numArgs) {
        if (typeof cb !== "function") {
            throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, "Callback must be a function.");
        }
        if (typeof window.__numWaiting === void 0) {
            window.__numWaiting = 0;
        }
        window.__numWaiting++;
        switch (numArgs) {
          case 1:
            return function(arg1) {
                return setImmediate(function() {
                    window.__numWaiting--;
                    return cb(arg1);
                });
            };

          case 2:
            return function(arg1, arg2) {
                return setImmediate(function() {
                    window.__numWaiting--;
                    return cb(arg1, arg2);
                });
            };

          case 3:
            return function(arg1, arg2, arg3) {
                return setImmediate(function() {
                    window.__numWaiting--;
                    return cb(arg1, arg2, arg3);
                });
            };

          default:
            throw new Error("Invalid invocation of wrapCb.");
        }
    };
    checkFd = function(fd, async) {
        if (async == null) {
            async = true;
        }
        if (!(fd instanceof BrowserFS.File)) {
            if (async) {
                return new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, "Invalid file descriptor.");
            } else {
                throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, "Invalid file descriptor.");
            }
        }
        return true;
    };
    nopCb = function() {};
    BrowserFS.node.fs = function() {
        function fs() {}
        fs._initialize = function(rootFS) {
            if (!rootFS.constructor.isAvailable()) {
                throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, "Tried to instantiate BrowserFS with an unavailable file system.");
            }
            return fs.root = rootFS;
        };
        fs._toUnixTimestamp = function(time) {
            if (typeof time === "number") {
                return time;
            }
            if (time instanceof Date) {
                return time.getTime() / 1e3;
            }
            throw new Error("Cannot parse time: " + time);
        };
        fs.getRootFS = function() {
            if (fs.root) {
                return fs.root;
            } else {
                return null;
            }
        };
        fs._canonicalizePath = function(p) {
            if (p.indexOf("\0") >= 0) {
                throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, "Path must be a string without null bytes.");
            }
            if (p === "") {
                return p;
            }
            return BrowserFS.node.path.resolve(p);
        };
        fs.rename = function(oldPath, newPath, callback) {
            var e, newCb;
            if (callback == null) {
                callback = nopCb;
            }
            try {
                newCb = wrapCb(callback, 1);
                oldPath = fs._canonicalizePath(oldPath);
                newPath = fs._canonicalizePath(newPath);
                return fs.root.rename(oldPath, newPath, newCb);
            } catch (_error) {
                e = _error;
                return newCb(e);
            }
        };
        fs.renameSync = function(oldPath, newPath) {
            oldPath = fs._canonicalizePath(oldPath);
            newPath = fs._canonicalizePath(newPath);
            return fs.root.renameSync(oldPath, newPath);
        };
        fs.exists = function(path, callback) {
            var e, newCb;
            if (callback == null) {
                callback = nopCb;
            }
            try {
                newCb = wrapCb(callback, 1);
                path = fs._canonicalizePath(path);
                return fs.root.exists(path, newCb);
            } catch (_error) {
                e = _error;
                return newCb(false);
            }
        };
        fs.existsSync = function(path) {
            var e;
            try {
                path = fs._canonicalizePath(path);
                return fs.root.existsSync(path);
            } catch (_error) {
                e = _error;
                return false;
            }
        };
        fs.stat = function(path, callback) {
            var e, newCb;
            if (callback == null) {
                callback = nopCb;
            }
            try {
                newCb = wrapCb(callback, 2);
                path = fs._canonicalizePath(path);
                return fs.root.stat(path, false, newCb);
            } catch (_error) {
                e = _error;
                return newCb(e);
            }
        };
        fs.statSync = function(path) {
            path = fs._canonicalizePath(path);
            return fs.root.statSync(path, false);
        };
        fs.lstat = function(path, callback) {
            var e, newCb;
            if (callback == null) {
                callback = nopCb;
            }
            try {
                newCb = wrapCb(callback, 2);
                path = fs._canonicalizePath(path);
                return fs.root.stat(path, true, newCb);
            } catch (_error) {
                e = _error;
                return newCb(e);
            }
        };
        fs.lstatSync = function(path) {
            path = fs._canonicalizePath(path);
            return fs.root.statSync(path, true);
        };
        fs.truncate = function(path, len, callback) {
            var e, newCb;
            if (callback == null) {
                callback = nopCb;
            }
            try {
                if (typeof len === "function") {
                    callback = len;
                    len = 0;
                }
                newCb = wrapCb(callback, 1);
                path = fs._canonicalizePath(path);
                return fs.root.truncate(path, len, newCb);
            } catch (_error) {
                e = _error;
                return newCb(e);
            }
        };
        fs.truncateSync = function(path, len) {
            if (len == null) {
                len = 0;
            }
            path = fs._canonicalizePath(path);
            return fs.root.truncateSync(path, len);
        };
        fs.unlink = function(path, callback) {
            var e, newCb;
            if (callback == null) {
                callback = nopCb;
            }
            try {
                newCb = wrapCb(callback, 1);
                path = fs._canonicalizePath(path);
                return fs.root.unlink(path, newCb);
            } catch (_error) {
                e = _error;
                return newCb(e);
            }
        };
        fs.unlinkSync = function(path) {
            path = fs._canonicalizePath(path);
            return fs.root.unlinkSync(path);
        };
        fs.open = function(path, flags, mode, callback) {
            var e, newCb;
            if (callback == null) {
                callback = nopCb;
            }
            try {
                if (typeof mode === "function") {
                    callback = mode;
                    mode = 420;
                }
                newCb = wrapCb(callback, 2);
                path = fs._canonicalizePath(path);
                flags = BrowserFS.FileMode.getFileMode(flags);
                return fs.root.open(path, flags, mode, newCb);
            } catch (_error) {
                e = _error;
                return newCb(e);
            }
        };
        fs.openSync = function(path, flags, mode) {
            if (mode == null) {
                mode = 420;
            }
            path = fs._canonicalizePath(path);
            flags = BrowserFS.FileMode.getFileMode(flags);
            return fs.root.openSync(path, flags, mode);
        };
        fs.readFile = function(filename, options, callback) {
            var e, flags, newCb;
            if (callback == null) {
                callback = nopCb;
            }
            try {
                if (typeof options === "function") {
                    callback = options;
                    options = {};
                } else if (typeof options === "string") {
                    options = {
                        encoding: options
                    };
                }
                if (options === void 0) {
                    options = {};
                }
                if (options.encoding === void 0) {
                    options.encoding = null;
                }
                if (options.flag == null) {
                    options.flag = "r";
                }
                newCb = wrapCb(callback, 2);
                filename = fs._canonicalizePath(filename);
                flags = BrowserFS.FileMode.getFileMode(options.flag);
                if (!flags.isReadable()) {
                    return newCb(new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, "Flag passed to readFile must allow for reading."));
                }
                return fs.root.readFile(filename, options.encoding, flags, newCb);
            } catch (_error) {
                e = _error;
                return newCb(e);
            }
        };
        fs.readFileSync = function(filename, options) {
            var flags;
            if (options == null) {
                options = {};
            }
            if (typeof options === "string") {
                options = {
                    encoding: options
                };
            }
            if (options === void 0) {
                options = {};
            }
            if (options.encoding === void 0) {
                options.encoding = null;
            }
            if (options.flag == null) {
                options.flag = "r";
            }
            filename = fs._canonicalizePath(filename);
            flags = BrowserFS.FileMode.getFileMode(options.flag);
            if (!flags.isReadable()) {
                throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, "Flag passed to readFile must allow for reading.");
            }
            return fs.root.readFileSync(filename, options.encoding, flags);
        };
        fs.writeFile = function(filename, data, options, callback) {
            var e, flags, newCb;
            if (options == null) {
                options = {};
            }
            if (callback == null) {
                callback = nopCb;
            }
            try {
                if (typeof options === "function") {
                    callback = options;
                    options = {};
                } else if (typeof options === "string") {
                    options = {
                        encoding: options
                    };
                }
                if (options === void 0) {
                    options = {};
                }
                if (options.encoding === void 0) {
                    options.encoding = "utf8";
                }
                if (options.flag == null) {
                    options.flag = "w";
                }
                if (options.mode == null) {
                    options.mode = 420;
                }
                newCb = wrapCb(callback, 1);
                filename = fs._canonicalizePath(filename);
                flags = BrowserFS.FileMode.getFileMode(options.flag);
                if (!flags.isWriteable()) {
                    return newCb(new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, "Flag passed to writeFile must allow for writing."));
                }
                return fs.root.writeFile(filename, data, options.encoding, flags, options.mode, newCb);
            } catch (_error) {
                e = _error;
                return newCb(e);
            }
        };
        fs.writeFileSync = function(filename, data, options) {
            var flags;
            if (options == null) {
                options = {};
            }
            if (typeof options === "string") {
                options = {
                    encoding: options
                };
            }
            if (options === void 0) {
                options = {};
            }
            if (options.encoding === void 0) {
                options.encoding = "utf8";
            }
            if (options.flag == null) {
                options.flag = "w";
            }
            if (options.mode == null) {
                options.mode = 420;
            }
            filename = fs._canonicalizePath(filename);
            flags = BrowserFS.FileMode.getFileMode(options.flag);
            if (!flags.isWriteable()) {
                throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, "Flag passed to writeFile must allow for writing.");
            }
            return fs.root.writeFileSync(filename, data, options.encoding, flags, options.mode);
        };
        fs.appendFile = function(filename, data, options, callback) {
            var e, flags, newCb;
            if (callback == null) {
                callback = nopCb;
            }
            try {
                if (typeof options === "function") {
                    callback = options;
                    options = {};
                } else if (typeof options === "string") {
                    options = {
                        encoding: options
                    };
                }
                if (options === void 0) {
                    options = {};
                }
                if (options.encoding === void 0) {
                    options.encoding = "utf8";
                }
                if (options.flag == null) {
                    options.flag = "a";
                }
                if (options.mode == null) {
                    options.mode = 420;
                }
                newCb = wrapCb(callback, 1);
                filename = fs._canonicalizePath(filename);
                flags = BrowserFS.FileMode.getFileMode(options.flag);
                if (!flags.isAppendable()) {
                    return newCb(new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, "Flag passed to appendFile must allow for appending."));
                }
                return fs.root.appendFile(filename, data, options.encoding, flags, options.mode, newCb);
            } catch (_error) {
                e = _error;
                return newCb(e);
            }
        };
        fs.appendFileSync = function(filename, data, options) {
            var flags;
            if (options == null) {
                options = {};
            }
            if (typeof options === "string") {
                options = {
                    encoding: options
                };
            }
            if (options === void 0) {
                options = {};
            }
            if (options.encoding === void 0) {
                options.encoding = "utf8";
            }
            if (options.flag == null) {
                options.flag = "a";
            }
            if (options.mode == null) {
                options.mode = 420;
            }
            filename = fs._canonicalizePath(filename);
            flags = BrowserFS.FileMode.getFileMode(options.flag);
            if (!flags.isAppendable()) {
                throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, "Flag passed to appendFile must allow for appending.");
            }
            return fs.root.appendFileSync(filename, data, options.encoding, flags, options.mode);
        };
        fs.fstat = function(fd, callback) {
            var e, fdChk, newCb;
            if (callback == null) {
                callback = nopCb;
            }
            try {
                newCb = wrapCb(callback, 2);
                fdChk = checkFd(fd);
                if (!fdChk) {
                    return newCb(fdChk);
                }
                return fd.stat(newCb);
            } catch (_error) {
                e = _error;
                return newCb(e);
            }
        };
        fs.fstatSync = function(fd) {
            checkFd(fd, false);
            return fd.statSync();
        };
        fs.close = function(fd, callback) {
            var e, fdChk, newCb;
            if (callback == null) {
                callback = nopCb;
            }
            try {
                newCb = wrapCb(callback, 1);
                fdChk = checkFd(fd);
                if (!fdChk) {
                    return newCb(fdChk);
                }
                return fd.close(newCb);
            } catch (_error) {
                e = _error;
                return newCb(e);
            }
        };
        fs.closeSync = function(fd) {
            checkFd(fd, false);
            return fd.closeSync();
        };
        fs.ftruncate = function(fd, len, callback) {
            var e, fdChk, newCb;
            if (callback == null) {
                callback = nopCb;
            }
            try {
                if (typeof len === "function") {
                    callback = len;
                    len = 0;
                }
                newCb = wrapCb(callback, 1);
                fdChk = checkFd(fd);
                if (!fdChk) {
                    return newCb(fdChk);
                }
                return fd.truncate(len, newCb);
            } catch (_error) {
                e = _error;
                return newCb(e);
            }
        };
        fs.ftruncateSync = function(fd, len) {
            if (len == null) {
                len = 0;
            }
            checkFd(fd, false);
            return fd.truncateSync(len);
        };
        fs.fsync = function(fd, callback) {
            var e, fdChk, newCb;
            if (callback == null) {
                callback = nopCb;
            }
            try {
                newCb = wrapCb(callback, 1);
                fdChk = checkFd(fd);
                if (!fdChk) {
                    return newCb(fdChk);
                }
                return fd.sync(newCb);
            } catch (_error) {
                e = _error;
                return newCb(e);
            }
        };
        fs.fsyncSync = function(fd) {
            checkFd(fd, false);
            return fd.syncSync();
        };
        fs.fdatasync = function(fd, callback) {
            var e, fdChk, newCb;
            if (callback == null) {
                callback = nopCb;
            }
            try {
                newCb = wrapCb(callback, 1);
                fdChk = checkFd(fd);
                if (!fdChk) {
                    return newCb(fdChk);
                }
                return fd.datasync(newCb);
            } catch (_error) {
                e = _error;
                return newCb(e);
            }
        };
        fs.fdatasyncSync = function(fd) {
            checkFd(fd, false);
            fd.datasyncSync();
        };
        fs.write = function(fd, buffer, offset, length, position, callback) {
            var e, encoding, fdChk, newCb;
            try {
                if (typeof buffer === "string") {
                    if (typeof position === "function") {
                        callback = position;
                        encoding = length;
                        position = offset;
                        offset = 0;
                    }
                    buffer = new Buffer(buffer, encoding);
                    length = buffer.length;
                }
                if (callback == null) {
                    callback = position;
                    position = fd.getPos();
                }
                newCb = wrapCb(callback, 3);
                fdChk = checkFd(fd);
                if (!fdChk) {
                    return newCb(fdChk);
                }
                if (position == null) {
                    position = fd.getPos();
                }
                return fd.write(buffer, offset, length, position, newCb);
            } catch (_error) {
                e = _error;
                return newCb(e);
            }
        };
        fs.writeSync = function(fd, buffer, offset, length, position) {
            var encoding;
            if (typeof buffer === "string") {
                if (typeof length === "string") {
                    encoding = length;
                } else if (typeof offset === "string") {
                    encoding = offset;
                } else if (typeof offset === "number") {
                    position = offset;
                }
                offset = 0;
                buffer = new Buffer(buffer, encoding);
                length = buffer.length;
            }
            checkFd(fd, false);
            if (position == null) {
                position = fd.getPos();
            }
            return fd.writeSync(buffer, offset, length, position);
        };
        fs.read = function(fd, buffer, offset, length, position, callback) {
            var e, encoding, fdChk, newCb;
            if (callback == null) {
                callback = nopCb;
            }
            try {
                if (typeof buffer === "number" && typeof offset === "number" && typeof length === "string" && typeof position === "function") {
                    callback = position;
                    position = offset;
                    offset = 0;
                    encoding = length;
                    length = buffer;
                    buffer = new BrowserFS.node.Buffer(length);
                    newCb = wrapCb(function(err, bytesRead, buf) {
                        if (err) {
                            return oldNewCb(err);
                        }
                        return callback(err, buf.toString(encoding), bytesRead);
                    }, 3);
                } else {
                    newCb = wrapCb(callback, 3);
                }
                fdChk = checkFd(fd);
                if (!fdChk) {
                    return newCb(fdChk);
                }
                if (position == null) {
                    position = fd.getPos();
                }
                return fd.read(buffer, offset, length, position, newCb);
            } catch (_error) {
                e = _error;
                return newCb(e);
            }
        };
        fs.readSync = function(fd, buffer, offset, length, position) {
            var encoding, rv, shenanigans;
            shenanigans = false;
            if (typeof buffer === "number" && typeof offset === "number" && typeof length === "string") {
                position = offset;
                offset = 0;
                encoding = length;
                length = buffer;
                buffer = new BrowserFS.node.Buffer(length);
                shenanigans = true;
            }
            checkFd(fd, false);
            if (position == null) {
                position = fd.getPos();
            }
            rv = fd.readSync(buffer, offset, length, position);
            if (!shenanigans) {
                return rv;
            } else {
                return [ buffer.toString(encoding), rv ];
            }
        };
        fs.fchown = function(fd, uid, gid, callback) {
            var e, fdChk, newCb;
            if (callback == null) {
                callback = nopCb;
            }
            try {
                newCb = wrapCb(callback, 1);
                fdChk = checkFd(fd);
                if (!fdChk) {
                    return newCb(fdChk);
                }
                return fd.chown(uid, gid, newCb);
            } catch (_error) {
                e = _error;
                return newCb(e);
            }
        };
        fs.fchownSync = function(fd, uid, gid) {
            checkFd(fd, false);
            return fd.chownSync(uid, gid);
        };
        fs.fchmod = function(fd, mode, callback) {
            var e, fdChk, newCb;
            if (callback == null) {
                callback = nopCb;
            }
            try {
                newCb = wrapCb(callback, 1);
                if (typeof mode === "string") {
                    mode = parseInt(mode, 8);
                }
                fdChk = checkFd(fd);
                if (!fdChk) {
                    return newCb(fdChk);
                }
                return fd.chmod(mode, newCb);
            } catch (_error) {
                e = _error;
                return newCb(e);
            }
        };
        fs.fchmodSync = function(fd, mode) {
            if (typeof mode === "string") {
                mode = parseInt(mode, 8);
            }
            checkFd(fd, false);
            return fd.chmodSync(mode);
        };
        fs.futimes = function(fd, atime, mtime, callback) {
            var e, fdChk, newCb;
            if (callback == null) {
                callback = nopCb;
            }
            try {
                newCb = wrapCb(callback, 1);
                fdChk = checkFd(fd);
                if (typeof atime === "number") {
                    atime = new Date(atime * 1e3);
                }
                if (typeof mtime === "number") {
                    mtime = new Date(mtime * 1e3);
                }
                if (!fdChk) {
                    return newCb(fdChk);
                }
                return fd.utimes(atime, mtime, newCb);
            } catch (_error) {
                e = _error;
                return newCb(e);
            }
        };
        fs.futimesSync = function(fd, atime, mtime) {
            checkFd(fd, false);
            if (typeof atime === "number") {
                atime = new Date(atime * 1e3);
            }
            if (typeof mtime === "number") {
                mtime = new Date(mtime * 1e3);
            }
            return fd.utimesSync(atime, mtime);
        };
        fs.rmdir = function(path, callback) {
            var e, newCb;
            if (callback == null) {
                callback = nopCb;
            }
            try {
                newCb = wrapCb(callback, 1);
                path = fs._canonicalizePath(path);
                return BrowserFS.node.fs.root.rmdir(path, newCb);
            } catch (_error) {
                e = _error;
                return newCb(e);
            }
        };
        fs.rmdirSync = function(path) {
            path = fs._canonicalizePath(path);
            return BrowserFS.node.fs.root.rmdirSync(path);
        };
        fs.mkdir = function(path, mode, callback) {
            var e, newCb;
            if (callback == null) {
                callback = nopCb;
            }
            try {
                if (typeof mode === "function") {
                    callback = mode;
                    mode = 511;
                }
                newCb = wrapCb(callback, 1);
                path = fs._canonicalizePath(path);
                return BrowserFS.node.fs.root.mkdir(path, mode, newCb);
            } catch (_error) {
                e = _error;
                return newCb(e);
            }
        };
        fs.mkdirSync = function(path, mode) {
            if (mode == null) {
                mode = 511;
            }
            path = fs._canonicalizePath(path);
            return BrowserFS.node.fs.root.mkdirSync(path, mode);
        };
        fs.readdir = function(path, callback) {
            var e, newCb;
            if (callback == null) {
                callback = nopCb;
            }
            try {
                newCb = wrapCb(callback, 2);
                path = fs._canonicalizePath(path);
                return fs.root.readdir(path, newCb);
            } catch (_error) {
                e = _error;
                return newCb(e);
            }
        };
        fs.readdirSync = function(path) {
            path = fs._canonicalizePath(path);
            return fs.root.readdirSync(path);
        };
        fs.link = function(srcpath, dstpath, callback) {
            var e, newCb;
            if (callback == null) {
                callback = nopCb;
            }
            try {
                newCb = wrapCb(callback, 1);
                srcpath = fs._canonicalizePath(srcpath);
                dstpath = fs._canonicalizePath(dstpath);
                return fs.root.link(srcpath, dstpath, newCb);
            } catch (_error) {
                e = _error;
                return newCb(e);
            }
        };
        fs.linkSync = function(srcpath, dstpath) {
            srcpath = fs._canonicalizePath(srcpath);
            dstpath = fs._canonicalizePath(dstpath);
            return fs.root.linkSync(srcpath, dstpath);
        };
        fs.symlink = function(srcpath, dstpath, type, callback) {
            var e, newCb;
            if (callback == null) {
                callback = nopCb;
            }
            try {
                if (typeof type === "function") {
                    callback = type;
                    type = "file";
                }
                newCb = wrapCb(callback, 1);
                if (type !== "file" && type !== "dir") {
                    return newCb(new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, "Invalid type: " + type));
                }
                srcpath = fs._canonicalizePath(srcpath);
                dstpath = fs._canonicalizePath(dstpath);
                return fs.root.symlink(srcpath, dstpath, type, newCb);
            } catch (_error) {
                e = _error;
                return newCb(e);
            }
        };
        fs.symlink = function(srcpath, dstpath, type) {
            if (type == null) {
                type = "file";
            }
            if (type !== "file" && type !== "dir") {
                throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, "Invalid type: " + type);
            }
            srcpath = fs._canonicalizePath(srcpath);
            dstpath = fs._canonicalizePath(dstpath);
            return fs.root.symlinkSync(srcpath, dstpath, type);
        };
        fs.readlink = function(path, callback) {
            var e, newCb;
            if (callback == null) {
                callback = nopCb;
            }
            try {
                newCb = wrapCb(callback, 2);
                path = fs._canonicalizePath(path);
                return fs.root.readlink(path, newCb);
            } catch (_error) {
                e = _error;
                return newCb(e);
            }
        };
        fs.readlinkSync = function(path) {
            path = fs._canonicalizePath(path);
            return fs.root.readlinkSync(path);
        };
        fs.chown = function(path, uid, gid, callback) {
            var e, newCb;
            if (callback == null) {
                callback = nopCb;
            }
            try {
                newCb = wrapCb(callback, 1);
                path = fs._canonicalizePath(path);
                return fs.root.chown(path, false, uid, gid, newCb);
            } catch (_error) {
                e = _error;
                return newCb(e);
            }
        };
        fs.chownSync = function(path, uid, gid) {
            path = fs._canonicalizePath(path);
            return fs.root.chownSync(path, false, uid, gid);
        };
        fs.lchown = function(path, uid, gid, callback) {
            var e, newCb;
            if (callback == null) {
                callback = nopCb;
            }
            try {
                newCb = wrapCb(callback, 1);
                path = fs._canonicalizePath(path);
                return fs.root.chown(path, true, uid, gid, newCb);
            } catch (_error) {
                e = _error;
                return newCb(e);
            }
        };
        fs.lchownSync = function(path, uid, gid) {
            path = fs._canonicalizePath(path);
            return fs.root.chownSync(path, true, uid, gid);
        };
        fs.chmod = function(path, mode, callback) {
            var e, newCb;
            if (callback == null) {
                callback = nopCb;
            }
            try {
                newCb = wrapCb(callback, 1);
                if (typeof mode === "string") {
                    mode = parseInt(mode, 8);
                }
                path = fs._canonicalizePath(path);
                return fs.root.chmod(path, false, mode, newCb);
            } catch (_error) {
                e = _error;
                return newCb(e);
            }
        };
        fs.chmodSync = function(path, mode) {
            if (typeof mode === "string") {
                mode = parseInt(mode, 8);
            }
            path = fs._canonicalizePath(path);
            return fs.root.chmodSync(path, false, mode);
        };
        fs.lchmod = function(path, mode, callback) {
            var e, newCb;
            if (callback == null) {
                callback = nopCb;
            }
            try {
                newCb = wrapCb(callback, 1);
                if (typeof mode === "string") {
                    mode = parseInt(mode, 8);
                }
                path = fs._canonicalizePath(path);
                return fs.root.chmod(path, true, mode, newCb);
            } catch (_error) {
                e = _error;
                return newCb(e);
            }
        };
        fs.lchmodSync = function(path, mode) {
            path = fs._canonicalizePath(path);
            if (typeof mode === "string") {
                mode = parseInt(mode, 8);
            }
            return fs.root.chmodSync(path, true, mode);
        };
        fs.utimes = function(path, atime, mtime, callback) {
            var e, newCb;
            if (callback == null) {
                callback = nopCb;
            }
            try {
                newCb = wrapCb(callback, 1);
                path = fs._canonicalizePath(path);
                if (typeof atime === "number") {
                    atime = new Date(atime * 1e3);
                }
                if (typeof mtime === "number") {
                    mtime = new Date(mtime * 1e3);
                }
                return fs.root.utimes(path, atime, mtime, newCb);
            } catch (_error) {
                e = _error;
                return newCb(e);
            }
        };
        fs.utimesSync = function(path, atime, mtime) {
            path = fs._canonicalizePath(path);
            if (typeof atime === "number") {
                atime = new Date(atime * 1e3);
            }
            if (typeof mtime === "number") {
                mtime = new Date(mtime * 1e3);
            }
            return fs.root.utimesSync(path, atime, mtime);
        };
        fs.realpath = function(path, cache, callback) {
            var e, newCb;
            if (callback == null) {
                callback = nopCb;
            }
            try {
                if (typeof cache === "function") {
                    callback = cache;
                    cache = {};
                }
                newCb = wrapCb(callback, 2);
                path = fs._canonicalizePath(path);
                return fs.root.realpath(path, cache, newCb);
            } catch (_error) {
                e = _error;
                return newCb(e);
            }
        };
        fs.realpathSync = function(path, cache) {
            if (cache == null) {
                cache = {};
            }
            path = fs._canonicalizePath(path);
            return fs.root.realpathSync(path, cache);
        };
        return fs;
    }.call(this);
    BrowserFS.FileMode = function() {
        FileMode.modeCache = {};
        FileMode.validModeStrs = [ "r", "r+", "rs", "rs+", "w", "wx", "w+", "wx+", "a", "ax", "a+", "ax+" ];
        FileMode.getFileMode = function(modeStr) {
            var fm;
            if (__indexOf.call(FileMode.modeCache, modeStr) >= 0) {
                return FileMode.modeCache[modeStr];
            }
            fm = new BrowserFS.FileMode(modeStr);
            FileMode.modeCache[modeStr] = fm;
            return fm;
        };
        FileMode.NOP = 0;
        FileMode.THROW_EXCEPTION = 1;
        FileMode.TRUNCATE_FILE = 2;
        FileMode.CREATE_FILE = 3;
        function FileMode(modeStr) {
            this.modeStr = modeStr;
            if (__indexOf.call(BrowserFS.FileMode.validModeStrs, modeStr) < 0) {
                throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, "Invalid mode string: " + modeStr);
            }
        }
        FileMode.prototype.isReadable = function() {
            return this.modeStr.indexOf("r") !== -1 || this.modeStr.indexOf("+") !== -1;
        };
        FileMode.prototype.isWriteable = function() {
            return this.modeStr.indexOf("w") !== -1 || this.modeStr.indexOf("a") !== -1 || this.modeStr.indexOf("+") !== -1;
        };
        FileMode.prototype.isTruncating = function() {
            return this.modeStr.indexOf("w") !== -1;
        };
        FileMode.prototype.isAppendable = function() {
            return this.modeStr.indexOf("a") !== -1;
        };
        FileMode.prototype.isSynchronous = function() {
            return this.modeStr.indexOf("s") !== -1;
        };
        FileMode.prototype.isExclusive = function() {
            return this.modeStr.indexOf("x") !== -1;
        };
        FileMode.prototype.pathExistsAction = function() {
            if (this.isExclusive()) {
                return BrowserFS.FileMode.THROW_EXCEPTION;
            } else if (this.isTruncating()) {
                return BrowserFS.FileMode.TRUNCATE_FILE;
            } else {
                return BrowserFS.FileMode.NOP;
            }
        };
        FileMode.prototype.pathNotExistsAction = function() {
            if ((this.isWriteable() || this.isAppendable()) && this.modeStr !== "r+") {
                return BrowserFS.FileMode.CREATE_FILE;
            } else {
                return BrowserFS.FileMode.THROW_EXCEPTION;
            }
        };
        return FileMode;
    }.call(this);
    BrowserFS.node.fs.Stats = function() {
        Stats.FILE = 1;
        Stats.DIRECTORY = 2;
        Stats.SYMLINK = 3;
        Stats.SOCKET = 4;
        function Stats(item_type, size, mode, atime, mtime, ctime) {
            this.item_type = item_type;
            this.size = size;
            this.mode = mode != null ? mode : 420;
            this.atime = atime != null ? atime : new Date();
            this.mtime = mtime != null ? mtime : new Date();
            this.ctime = ctime != null ? ctime : new Date();
            this.blocks = Math.ceil(size / 512);
            this.dev = 0;
            this.ino = 0;
            this.rdev = 0;
            this.nlink = 1;
            this.blksize = 4096;
            this.uid = 0;
            this.gid = 0;
        }
        Stats.prototype.clone = function() {
            return new BrowserFS.node.fs.Stats(this.item_type, this.size, this.mode, this.atime, this.mtime, this.ctime);
        };
        Stats.prototype.isFile = function() {
            return this.item_type === Stats.FILE;
        };
        Stats.prototype.isDirectory = function() {
            return this.item_type === Stats.DIRECTORY;
        };
        Stats.prototype.isSymbolicLink = function() {
            return this.item_type === Stats.SYMLINK;
        };
        Stats.prototype.isSocket = function() {
            return this.item_type === Stats.SOCKET;
        };
        Stats.prototype.isBlockDevice = function() {
            return true;
        };
        Stats.prototype.isCharacterDevice = function() {
            return false;
        };
        Stats.prototype.isFIFO = function() {
            return false;
        };
        return Stats;
    }();
    BrowserFS.node.path = function() {
        function path() {}
        path.normalize = function(p) {
            var absolute, c, components, goodComponents, idx, _i, _len;
            if (p === "") {
                p = ".";
            }
            absolute = p.charAt(0) === path.sep;
            p = path._removeDuplicateSeps(p);
            components = p.split(path.sep);
            goodComponents = [];
            for (idx = _i = 0, _len = components.length; _i < _len; idx = ++_i) {
                c = components[idx];
                if (c === ".") {
                    continue;
                } else if (c === ".." && (absolute || !absolute && goodComponents.length > 0 && goodComponents[0] !== "..")) {
                    goodComponents.pop();
                } else {
                    goodComponents.push(c);
                }
            }
            if (!absolute && goodComponents.length < 2) {
                switch (goodComponents.length) {
                  case 1:
                    if (goodComponents[0] === "") {
                        goodComponents.unshift(".");
                    }
                    break;

                  default:
                    goodComponents.push(".");
                }
            }
            p = goodComponents.join(path.sep);
            if (absolute && p.charAt(0) !== path.sep) {
                p = path.sep + p;
            }
            return p;
        };
        path.join = function() {
            var paths, processed, segment, _i, _len;
            paths = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
            processed = [];
            for (_i = 0, _len = paths.length; _i < _len; _i++) {
                segment = paths[_i];
                if (typeof segment !== "string") {
                    throw new TypeError("Invalid argument type to path.join: " + typeof segment);
                } else if (segment !== "") {
                    processed.push(segment);
                }
            }
            return path.normalize(processed.join(path.sep));
        };
        path.resolve = function() {
            var cwd, p, paths, processed, resolved, _i, _len;
            paths = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
            processed = [];
            for (_i = 0, _len = paths.length; _i < _len; _i++) {
                p = paths[_i];
                if (typeof p !== "string") {
                    throw new TypeError("Invalid argument type to path.join: " + typeof p);
                } else if (p !== "") {
                    if (p.charAt(0) === path.sep) {
                        processed = [];
                    }
                    processed.push(p);
                }
            }
            resolved = path.normalize(processed.join(path.sep));
            if (resolved.length > 1 && resolved.charAt(resolved.length - 1) === path.sep) {
                return resolved.substr(0, resolved.length - 1);
            }
            if (resolved.charAt(0) !== path.sep) {
                if (resolved.charAt(0) === "." && (resolved.length === 1 || resolved.charAt(1) === path.sep)) {
                    resolved = resolved.length === 1 ? "" : resolved.substr(2);
                }
                cwd = BrowserFS.node.process.cwd();
                if (resolved !== "") {
                    resolved = BrowserFS.node.path.normalize(cwd + (cwd !== "/" ? path.sep : "") + resolved);
                } else {
                    resolved = cwd;
                }
            }
            return resolved;
        };
        path.relative = function(from, to) {
            var downSegs, fromSegs, i, rv, seg, toSegs, upCount, _i, _j, _len;
            from = path.resolve(from);
            to = path.resolve(to);
            fromSegs = from.split(path.sep);
            toSegs = to.split(path.sep);
            toSegs.shift();
            fromSegs.shift();
            upCount = 0;
            downSegs = [];
            for (i = _i = 0, _len = fromSegs.length; _i < _len; i = ++_i) {
                seg = fromSegs[i];
                if (seg === toSegs[i]) {
                    continue;
                }
                upCount = fromSegs.length - i;
                break;
            }
            downSegs = toSegs.slice(i);
            if (fromSegs.length === 1 && fromSegs[0] === "") {
                upCount = 0;
            }
            if (upCount > fromSegs.length) {
                upCount = fromSegs.length;
            }
            rv = "";
            for (i = _j = 0; 0 <= upCount ? _j < upCount : _j > upCount; i = 0 <= upCount ? ++_j : --_j) {
                rv += "../";
            }
            rv += downSegs.join(path.sep);
            if (rv.length > 1 && rv.charAt(rv.length - 1) === path.sep) {
                rv = rv.substr(0, rv.length - 1);
            }
            return rv;
        };
        path.dirname = function(p) {
            var absolute, sections;
            p = path._removeDuplicateSeps(p);
            absolute = p.charAt(0) === path.sep;
            sections = p.split(path.sep);
            if (sections.pop() === "" && sections.length > 0) {
                sections.pop();
            }
            if (sections.length > 1) {
                return sections.join(path.sep);
            } else if (absolute) {
                return path.sep;
            } else {
                return ".";
            }
        };
        path.basename = function(p, ext) {
            var lastPart, lastPartExt, sections;
            if (ext == null) {
                ext = "";
            }
            if (p === "") {
                return p;
            }
            p = path.normalize(p);
            sections = p.split(path.sep);
            lastPart = sections[sections.length - 1];
            if (lastPart === "" && sections.length > 1) {
                return sections[sections.length - 2];
            }
            if (ext.length > 0) {
                lastPartExt = lastPart.substr(lastPart.length - ext.length);
                if (lastPartExt === ext) {
                    return lastPart.substr(0, lastPart.length - ext.length);
                }
            }
            return lastPart;
        };
        path.extname = function(p) {
            var i, sections;
            p = path.normalize(p);
            sections = p.split(path.sep);
            p = sections.pop();
            if (p === "" && sections.length > 0) {
                p = sections.pop();
            }
            if (p === "..") {
                return "";
            }
            i = p.lastIndexOf(".");
            if (i === -1 || i === 0) {
                return "";
            }
            return p.substr(i);
        };
        path.isAbsolute = function(p) {
            return p.length > 0 && p.charAt(0) === path.sep;
        };
        path._makeLong = function(p) {
            return p;
        };
        path.sep = "/";
        path._replaceRegex = new RegExp("//+", "g");
        path._removeDuplicateSeps = function(p) {
            p = p.replace(this._replaceRegex, this.sep);
            return p;
        };
        path.delimiter = ":";
        return path;
    }.call(this);
    startTime = Date.now();
    BrowserFS.node.process = function() {
        function process() {}
        process._cwd = "/";
        process.chdir = function(dir) {
            return this._cwd = BrowserFS.node.path.resolve(dir);
        };
        process.cwd = function() {
            return this._cwd;
        };
        process.platform = function() {
            return "browser";
        };
        process.uptime = function() {
            return (Date.now() - startTime) / 1e3 | 0;
        };
        return process;
    }();
    if (typeof setImmediate === "undefined") {
        timeouts = [];
        messageName = "zero-timeout-message";
        canUsePostMessage = function() {
            var oldOnMessage, postMessageIsAsync;
            if (!window.postMessage) {
                return false;
            }
            postMessageIsAsync = true;
            oldOnMessage = window.onmessage;
            window.onmessage = function() {
                return postMessageIsAsync = false;
            };
            window.postMessage("", "*");
            window.onmessage = oldOnMessage;
            return postMessageIsAsync;
        };
        if (canUsePostMessage()) {
            window.setImmediate = function(fn) {
                timeouts.push(fn);
                return window.postMessage(messageName, "*");
            };
            handleMessage = function(event) {
                var fn;
                if (event.source === self && event.data === messageName) {
                    if (event.stopPropagation) {
                        event.stopPropagation();
                    } else {
                        event.cancelBubble = true;
                    }
                    if (timeouts.length > 0) {
                        fn = timeouts.shift();
                        return fn();
                    }
                }
            };
            if (window.addEventListener) {
                window.addEventListener("message", handleMessage, true);
            } else {
                window.attachEvent("onmessage", handleMessage);
            }
        } else {
            window.setImmediate = function(fn) {
                var scriptEl;
                return setTimeout(fn, 0);
                scriptEl = window.document.createElement("script");
                scriptEl.onreadystatechange = function() {
                    fn();
                    scriptEl.onreadystatechange = null;
                    scriptEl.parentNode.removeChild(scriptEl);
                    return scriptEl = null;
                };
                window.document.documentElement.appendChild(scriptEl);
            };
        }
    }
    BrowserFS.StringUtil = function() {
        function StringUtil() {}
        StringUtil.FindUtil = function(encoding) {
            encoding = function() {
                switch (typeof encoding) {
                  case "object":
                    return "" + encoding;

                  case "string":
                    return encoding;

                  default:
                    throw new Error("Invalid encoding argument specified");
                }
            }();
            encoding = encoding.toLowerCase();
            switch (encoding) {
              case "utf8":
              case "utf-8":
                return BrowserFS.StringUtil.UTF8;

              case "ascii":
              case "binary":
                return BrowserFS.StringUtil.ASCII;

              case "ucs2":
              case "ucs-2":
              case "utf16le":
              case "utf-16le":
                return BrowserFS.StringUtil.UCS2;

              case "hex":
                return BrowserFS.StringUtil.HEX;

              case "base64":
                return BrowserFS.StringUtil.BASE64;

              case "binary_string":
                return BrowserFS.StringUtil.BINSTR;

              case "binary_string_ie":
                return BrowserFS.StringUtil.BINSTRIE;

              default:
                throw new Error("Unknown encoding: " + encoding);
            }
        };
        return StringUtil;
    }();
    BrowserFS.StringUtil.UTF8 = function() {
        function UTF8() {}
        UTF8.str2byte = function(buf, str, offset, length) {
            var code, codePoint, i, j, maxJ, next, numChars, rv;
            i = 0;
            j = offset;
            maxJ = offset + length;
            rv = [];
            numChars = 0;
            while (i < str.length && j < maxJ) {
                code = str.charCodeAt(i++);
                next = str.charCodeAt(i);
                if (55296 <= code && code <= 56319 && 56320 <= next && next <= 57343) {
                    if (j + 3 >= maxJ) {
                        break;
                    } else {
                        numChars++;
                    }
                    codePoint = (code & 1023 | 1024) << 10 | next & 1023;
                    buf.writeUInt8(codePoint >> 18 | 240, j++);
                    buf.writeUInt8(codePoint >> 12 & 63 | 128, j++);
                    buf.writeUInt8(codePoint >> 6 & 63 | 128, j++);
                    buf.writeUInt8(codePoint & 63 | 128, j++);
                    i++;
                } else if (code < 128) {
                    buf.writeUInt8(code, j++);
                    numChars++;
                } else if (code < 2048) {
                    if (j + 1 >= maxJ) {
                        break;
                    } else {
                        numChars++;
                    }
                    buf.writeUInt8(code >> 6 | 192, j++);
                    buf.writeUInt8(code & 63 | 128, j++);
                } else if (code < 65536) {
                    if (j + 2 >= maxJ) {
                        break;
                    } else {
                        numChars++;
                    }
                    buf.writeUInt8(code >> 12 | 224, j++);
                    buf.writeUInt8(code >> 6 & 63 | 128, j++);
                    buf.writeUInt8(code & 63 | 128, j++);
                }
            }
            buf._charsWritten = numChars;
            return j - offset;
        };
        UTF8.byte2str = function(byteArray) {
            var byte3, chars, code, i;
            chars = [];
            i = 0;
            while (i < byteArray.length) {
                code = byteArray[i++];
                if (code < 128) {
                    chars.push(String.fromCharCode(code));
                } else if (code < 192) {
                    throw new Error("Found incomplete part of character in string.");
                } else if (code < 224) {
                    chars.push(String.fromCharCode((code & 31) << 6 | byteArray[i++] & 63));
                } else if (code < 240) {
                    chars.push(String.fromCharCode((code & 15) << 12 | (byteArray[i++] & 63) << 6 | byteArray[i++] & 63));
                } else if (code < 248) {
                    byte3 = byteArray[i + 2];
                    chars.push(String.fromCharCode(((code & 7) << 8 | (byteArray[i++] & 63) << 2 | (byteArray[i++] & 63) >> 4) & 1023 | 55296));
                    chars.push(String.fromCharCode((byte3 & 15) << 6 | byteArray[i++] & 63 | 56320));
                } else {
                    throw new Error("Unable to represent UTF-8 string as UTF-16 JavaScript string.");
                }
            }
            return chars.join("");
        };
        UTF8.byteLength = function(str) {
            var m;
            m = encodeURIComponent(str).match(/%[89ABab]/g);
            return str.length + (m ? m.length : 0);
        };
        return UTF8;
    }();
    BrowserFS.StringUtil.ASCII = function() {
        function ASCII() {}
        ASCII.str2byte = function(buf, str, offset, length) {
            var i, _i;
            length = str.length > length ? length : str.length;
            for (i = _i = 0; 0 <= length ? _i < length : _i > length; i = 0 <= length ? ++_i : --_i) {
                buf.writeUInt8(str.charCodeAt(i) % 256, offset + i);
            }
            buf._charsWritten = length;
            return length;
        };
        ASCII.byte2str = function(byteArray) {
            var chars, i, _i, _ref1;
            chars = new Array(byteArray.length);
            for (i = _i = 0, _ref1 = byteArray.length; 0 <= _ref1 ? _i < _ref1 : _i > _ref1; i = 0 <= _ref1 ? ++_i : --_i) {
                chars[i] = String.fromCharCode(byteArray[i] & 127);
            }
            return chars.join("");
        };
        ASCII.byteLength = function(str) {
            return str.length;
        };
        return ASCII;
    }();
    BrowserFS.StringUtil.BASE64 = function() {
        function BASE64() {}
        BASE64.num2b64 = function() {
            var i, idx, obj, _i, _len, _ref1;
            obj = {};
            _ref1 = [ "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "/", "=" ];
            for (idx = _i = 0, _len = _ref1.length; _i < _len; idx = ++_i) {
                i = _ref1[idx];
                obj[idx] = i;
            }
            return obj;
        }();
        BASE64.b642num = function() {
            var i, idx, obj, _i, _len, _ref1;
            obj = {};
            _ref1 = [ "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "/", "=" ];
            for (idx = _i = 0, _len = _ref1.length; _i < _len; idx = ++_i) {
                i = _ref1[idx];
                obj[i] = idx;
            }
            obj["-"] = 62;
            obj["_"] = 63;
            return obj;
        }();
        BASE64.byte2str = function(byteArray) {
            var chr1, chr2, chr3, enc1, enc2, enc3, enc4, i, output;
            output = "";
            i = 0;
            while (i < byteArray.length) {
                chr1 = byteArray[i++];
                chr2 = byteArray[i++];
                chr3 = byteArray[i++];
                enc1 = chr1 >> 2;
                enc2 = (chr1 & 3) << 4 | chr2 >> 4;
                enc3 = (chr2 & 15) << 2 | chr3 >> 6;
                enc4 = chr3 & 63;
                if (isNaN(chr2)) {
                    enc3 = enc4 = 64;
                } else if (isNaN(chr3)) {
                    enc4 = 64;
                }
                output = output + BrowserFS.StringUtil.BASE64.num2b64[enc1] + BrowserFS.StringUtil.BASE64.num2b64[enc2] + BrowserFS.StringUtil.BASE64.num2b64[enc3] + BrowserFS.StringUtil.BASE64.num2b64[enc4];
            }
            return output;
        };
        BASE64.str2byte = function(buf, str, offset, length) {
            var chr1, chr2, chr3, enc1, enc2, enc3, enc4, i, j, output;
            output = "";
            i = 0;
            str = str.replace(/[^A-Za-z0-9\+\/\=\-\_]/g, "");
            j = 0;
            while (i < str.length) {
                enc1 = BrowserFS.StringUtil.BASE64.b642num[str.charAt(i++)];
                enc2 = BrowserFS.StringUtil.BASE64.b642num[str.charAt(i++)];
                enc3 = BrowserFS.StringUtil.BASE64.b642num[str.charAt(i++)];
                enc4 = BrowserFS.StringUtil.BASE64.b642num[str.charAt(i++)];
                chr1 = enc1 << 2 | enc2 >> 4;
                chr2 = (enc2 & 15) << 4 | enc3 >> 2;
                chr3 = (enc3 & 3) << 6 | enc4;
                buf.writeUInt8(chr1, offset + j++);
                if (j === length) {
                    break;
                }
                if (enc3 !== 64) {
                    output += buf.writeUInt8(chr2, offset + j++);
                }
                if (j === length) {
                    break;
                }
                if (enc4 !== 64) {
                    output += buf.writeUInt8(chr3, offset + j++);
                }
                if (j === length) {
                    break;
                }
            }
            buf._charsWritten = i > str.length ? str.length : i;
            return j;
        };
        BASE64.byteLength = function(str) {
            return Math.floor(str.replace(/[^A-Za-z0-9\+\/\-\_]/g, "").length * 6 / 8);
        };
        return BASE64;
    }();
    BrowserFS.StringUtil.UCS2 = function() {
        function UCS2() {}
        UCS2.str2byte = function(buf, str, offset, length) {
            var i, len, _i;
            len = str.length;
            if (len * 2 > length) {
                len = length % 2 === 1 ? (length - 1) / 2 : length / 2;
            }
            for (i = _i = 0; 0 <= len ? _i < len : _i > len; i = 0 <= len ? ++_i : --_i) {
                buf.writeUInt16LE(str.charCodeAt(i), offset + i * 2);
            }
            buf._charsWritten = len;
            return len * 2;
        };
        UCS2.byte2str = function(byteArray) {
            var chars, i, _i, _ref1;
            if (byteArray.length % 2 !== 0) {
                throw new Error("Invalid UCS2 byte array.");
            }
            chars = new Array(byteArray.length / 2);
            for (i = _i = 0, _ref1 = byteArray.length; _i < _ref1; i = _i += 2) {
                chars[i / 2] = String.fromCharCode(byteArray[i] | byteArray[i + 1] << 8);
            }
            return chars.join("");
        };
        UCS2.byteLength = function(str) {
            return str.length * 2;
        };
        return UCS2;
    }();
    BrowserFS.StringUtil.HEX = function() {
        var HEXCHARS;
        function HEX() {}
        HEXCHARS = "0123456789abcdef";
        HEX.num2hex = function() {
            var i, idx, obj, _i, _len;
            obj = {};
            for (idx = _i = 0, _len = HEXCHARS.length; _i < _len; idx = ++_i) {
                i = HEXCHARS[idx];
                obj[idx] = i;
            }
            return obj;
        }();
        HEX.hex2num = function() {
            var i, idx, obj, _i, _j, _len, _len1, _ref1;
            obj = {};
            for (idx = _i = 0, _len = HEXCHARS.length; _i < _len; idx = ++_i) {
                i = HEXCHARS[idx];
                obj[i] = idx;
            }
            _ref1 = "ABCDEF";
            for (idx = _j = 0, _len1 = _ref1.length; _j < _len1; idx = ++_j) {
                i = _ref1[idx];
                obj[i] = idx + 10;
            }
            return obj;
        }();
        HEX.str2byte = function(buf, str, offset, length) {
            var char1, char2, i, numBytes, _i;
            if (str.length % 2 === 1) {
                throw new Error("Invalid hex string");
            }
            numBytes = str.length / 2;
            if (numBytes > length) {
                numBytes = length;
            }
            for (i = _i = 0; 0 <= numBytes ? _i < numBytes : _i > numBytes; i = 0 <= numBytes ? ++_i : --_i) {
                char1 = BrowserFS.StringUtil.HEX.hex2num[str.charAt(2 * i)];
                char2 = BrowserFS.StringUtil.HEX.hex2num[str.charAt(2 * i + 1)];
                buf.writeUInt8(char1 << 4 | char2, offset + i);
            }
            buf._charsWritten = 2 * numBytes;
            return numBytes;
        };
        HEX.byte2str = function(byteArray) {
            var chars, hex1, hex2, i, j, len, _i;
            len = byteArray.length;
            chars = new Array(len * 2);
            j = 0;
            for (i = _i = 0; 0 <= len ? _i < len : _i > len; i = 0 <= len ? ++_i : --_i) {
                hex2 = byteArray[i] & 15;
                hex1 = byteArray[i] >> 4;
                chars[j++] = BrowserFS.StringUtil.HEX.num2hex[hex1];
                chars[j++] = BrowserFS.StringUtil.HEX.num2hex[hex2];
            }
            return chars.join("");
        };
        HEX.byteLength = function(str) {
            return str.length / 2;
        };
        return HEX;
    }();
    BrowserFS.StringUtil.BINSTR = function() {
        function BINSTR() {}
        BINSTR.str2byte = function(buf, str, offset, length) {
            var chr, endByte, firstChar, i, j, numBytes, startByte, _i;
            if (str.length === 0) {
                buf._charsWritten = 0;
                return 0;
            }
            numBytes = BINSTR.byteLength(str);
            if (numBytes > length) {
                numBytes = length;
            }
            j = 0;
            startByte = offset;
            endByte = startByte + numBytes;
            firstChar = str.charCodeAt(j++);
            if (firstChar !== 0) {
                buf.writeUInt8(firstChar & 255, offset);
                startByte = offset + 1;
            }
            for (i = _i = startByte; _i < endByte; i = _i += 2) {
                chr = str.charCodeAt(j++);
                if (endByte - i === 1) {
                    buf.writeUInt8(chr >> 8, i);
                }
                if (endByte - i >= 2) {
                    buf.writeUInt16BE(chr, i);
                }
            }
            buf._charsWritten = Math.floor(numBytes / 2) + 1;
            return numBytes;
        };
        BINSTR.byte2str = function(byteArray) {
            var chars, i, j, len, _i, _ref1;
            len = byteArray.length;
            if (len === 0) {
                return "";
            }
            chars = new Array(Math.floor(len / 2) + 1);
            j = 0;
            for (i = _i = 0, _ref1 = chars.length; _i < _ref1; i = _i += 1) {
                if (i === 0) {
                    if (len % 2 === 1) {
                        chars[i] = String.fromCharCode(1 << 8 | byteArray[j++]);
                    } else {
                        chars[i] = String.fromCharCode(0);
                    }
                } else {
                    chars[i] = String.fromCharCode(byteArray[j++] << 8 | byteArray[j++]);
                }
            }
            return chars.join("");
        };
        BINSTR.byteLength = function(str) {
            var bytelen, firstChar;
            if (str.length === 0) {
                return 0;
            }
            firstChar = str.charCodeAt(0);
            bytelen = (str.length - 1) * 2;
            if (firstChar !== 0) {
                bytelen++;
            }
            return bytelen;
        };
        return BINSTR;
    }.call(this);
    BrowserFS.StringUtil.BINSTRIE = function() {
        function BINSTRIE() {}
        BINSTRIE.str2byte = function(buf, str, offset, length) {
            var i, _i;
            length = str.length > length ? length : str.length;
            for (i = _i = 0; 0 <= length ? _i < length : _i > length; i = 0 <= length ? ++_i : --_i) {
                buf.writeUInt8(str.charCodeAt(i) - 32, offset + i);
            }
            buf._charsWritten = length;
            return length;
        };
        BINSTRIE.byte2str = function(byteArray) {
            var chars, i, _i, _ref1;
            chars = new Array(byteArray.length);
            for (i = _i = 0, _ref1 = byteArray.length; 0 <= _ref1 ? _i < _ref1 : _i > _ref1; i = 0 <= _ref1 ? ++_i : --_i) {
                chars[i] = String.fromCharCode(byteArray[i] + 32);
            }
            return chars.join("");
        };
        BINSTRIE.byteLength = function(str) {
            return str.length;
        };
        return BINSTRIE;
    }();
    if (typeof window !== "undefined" && window !== null) {
        if (window.BrowserFS) {
            for (name in BrowserFS) {
                if (!__hasProp.call(BrowserFS, name)) continue;
                value = BrowserFS[name];
                window.BrowserFS[name] = value;
            }
        } else {
            window.BrowserFS = BrowserFS;
        }
    } else if (typeof self !== "undefined" && self !== null) {
        self.BrowserFS = BrowserFS;
    } else {
        throw new Error("This library only supports node.js and modern browsers.");
    }
    BrowserFS.FileIndex = function() {
        function FileIndex() {
            this._index = {};
        }
        FileIndex.prototype._split_path = function(path) {
            var dirpath, itemname;
            dirpath = BrowserFS.node.path.dirname(path);
            itemname = path.substr(dirpath.length + (dirpath === "/" ? 0 : 1));
            return [ dirpath, itemname ];
        };
        FileIndex.prototype.addPath = function(path, inode) {
            var dirpath, itemname, parent, _ref1;
            if (inode == null) {
                throw new Error("Inode must be specified");
            }
            if (path[0] !== "/") {
                throw new Error("Path must be absolute, got: " + path);
            }
            if (this._index[path] !== void 0) {
                return this._index[path] === inode;
            }
            _ref1 = this._split_path(path), dirpath = _ref1[0], itemname = _ref1[1];
            parent = this._index[dirpath];
            if (parent === void 0 && path !== "/") {
                parent = new BrowserFS.DirInode();
                if (!this.addPath(dirpath, parent)) {
                    return false;
                }
            }
            if (path !== "/") {
                if (!parent.addItem(itemname, inode)) {
                    return false;
                }
            }
            if (!inode.isFile()) {
                this._index[path] = inode;
            }
            return true;
        };
        FileIndex.prototype.removePath = function(path) {
            var dirpath, inode, itemname, parent, _ref1;
            _ref1 = this._split_path(path), dirpath = _ref1[0], itemname = _ref1[1];
            parent = this._index[dirpath];
            if (parent === void 0) {
                return null;
            }
            inode = parent.remItem(itemname);
            if (inode === null) {
                return null;
            }
            if (!inode.isFile()) {
                delete this._index[path];
            }
            return inode;
        };
        FileIndex.prototype.ls = function(path) {
            var item;
            item = this._index[path];
            if (item === void 0) {
                return null;
            }
            return item.getListing();
        };
        FileIndex.prototype.getInode = function(path) {
            var dirpath, itemname, parent, _ref1;
            _ref1 = this._split_path(path), dirpath = _ref1[0], itemname = _ref1[1];
            parent = this._index[dirpath];
            if (parent === void 0) {
                return null;
            }
            if (dirpath === path) {
                return parent;
            }
            return parent.getItem(itemname);
        };
        return FileIndex;
    }();
    BrowserFS.FileIndex.from_listing = function(listing) {
        var children, idx, inode, node, parent, pwd, queue, rootInode, tree, _ref1;
        idx = new BrowserFS.FileIndex();
        rootInode = new BrowserFS.DirInode();
        idx._index["/"] = rootInode;
        queue = [ [ "", listing, rootInode ] ];
        while (queue.length > 0) {
            _ref1 = queue.pop(), pwd = _ref1[0], tree = _ref1[1], parent = _ref1[2];
            for (node in tree) {
                children = tree[node];
                name = "" + pwd + "/" + node;
                if (children != null) {
                    idx._index[name] = inode = new BrowserFS.DirInode();
                    queue.push([ name, children, inode ]);
                } else {
                    idx._index[name] = inode = new BrowserFS.FileInode(BrowserFS.node.fs.Stats.FILE, -1);
                }
                if (parent != null) {
                    parent._ls[node] = inode;
                }
            }
        }
        return idx;
    };
    BrowserFS.FileInode = BrowserFS.node.fs.Stats;
    BrowserFS.DirInode = function() {
        function DirInode() {
            this._ls = {};
        }
        DirInode.prototype.isFile = function() {
            return false;
        };
        DirInode.prototype.isDirectory = function() {
            return true;
        };
        DirInode.prototype.getStats = function() {
            return new BrowserFS.node.fs.Stats(BrowserFS.node.fs.Stats.DIRECTORY, 4096);
        };
        DirInode.prototype.getListing = function() {
            return Object.keys(this._ls);
        };
        DirInode.prototype.getItem = function(p) {
            var _ref1;
            return (_ref1 = this._ls[p]) != null ? _ref1 : null;
        };
        DirInode.prototype.addItem = function(p, inode) {
            if (p in this._ls) {
                return false;
            }
            this._ls[p] = inode;
            return true;
        };
        DirInode.prototype.remItem = function(p) {
            var item;
            item = this._ls[p];
            if (item === void 0) {
                return null;
            }
            delete this._ls[p];
            return item;
        };
        return DirInode;
    }();
    BrowserFS.IndexedFileSystem = function(_super) {
        __extends(IndexedFileSystem, _super);
        function IndexedFileSystem(_index) {
            this._index = _index;
        }
        IndexedFileSystem.prototype.renameSync = function(oldPath, newPath) {
            var oldInode;
            oldInode = this._index.removePath(oldPath);
            if (oldInode === null) {
                throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_FOUND, "" + oldPath + " not found.");
            }
            this._index.removePath(newPath);
            this._index.addPath(newPath, oldInode);
        };
        IndexedFileSystem.prototype.statSync = function(path, isLstat) {
            var inode, stats, _ref1;
            inode = this._index.getInode(path);
            if (inode === null) {
                throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_FOUND, "" + path + " not found.");
            }
            stats = (_ref1 = typeof inode.getStats === "function" ? inode.getStats() : void 0) != null ? _ref1 : inode;
            return stats;
        };
        IndexedFileSystem.prototype.openSync = function(path, flags, mode) {
            var inode;
            inode = this._index.getInode(path);
            if (inode !== null) {
                if (!inode.isFile()) {
                    throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_FOUND, "" + path + " is a directory.");
                } else {
                    switch (flags.pathExistsAction()) {
                      case BrowserFS.FileMode.THROW_EXCEPTION:
                        throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, "" + path + " already exists.");
                        break;

                      case BrowserFS.FileMode.TRUNCATE_FILE:
                        return this._truncate(path, flags, inode);

                      case BrowserFS.FileMode.NOP:
                        return this._fetch(path, flags, inode);

                      default:
                        throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, "Invalid FileMode object.");
                    }
                }
            } else {
                switch (flags.pathNotExistsAction()) {
                  case BrowserFS.FileMode.CREATE_FILE:
                    inode = new BrowserFS.node.fs.Stats(BrowserFS.node.fs.Stats.FILE, 0, mode);
                    return this._create(path, flags, inode);

                  case BrowserFS.FileMode.THROW_EXCEPTION:
                    throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, "" + path + " doesn't exist.");
                    break;

                  default:
                    throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, "Invalid FileMode object.");
                }
            }
        };
        IndexedFileSystem.prototype.unlinkSync = function(path) {
            var inode;
            inode = this._index.getInode(path);
            if (inode === null) {
                throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_FOUND, "" + path + " not found.");
            } else if (!inode.isFile()) {
                throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_FOUND, "" + path + " is a directory, not a file.");
            }
            this._index.removePath(path);
        };
        IndexedFileSystem.prototype.rmdirSync = function(path) {
            var inode;
            inode = this._index.getInode(path);
            if (inode === null) {
                throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_FOUND, "" + path + " not found.");
            } else if (inode.isFile()) {
                throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_FOUND, "" + path + " is a file, not a directory.");
            }
            this._index.removePath(path);
            return this._rmdirSync(path, inode);
        };
        IndexedFileSystem.prototype.mkdirSync = function(path, mode) {
            var inode, parent, success;
            inode = this._index.getInode(path);
            if (inode !== null) {
                throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, "" + path + " already exists.");
            }
            parent = BrowserFS.node.path.dirname(path);
            if (parent !== "/" && this._index.getInode(parent) === null) {
                throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, "Can't create " + path + " because " + parent + " doesn't exist.");
            }
            success = this._index.addPath(path, new BrowserFS.DirInode());
            if (success) {
                return;
            }
            throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, "Could not add " + path + " for some reason.");
        };
        IndexedFileSystem.prototype.readdirSync = function(path) {
            var inode;
            inode = this._index.getInode(path);
            if (inode === null) {
                throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_FOUND, "" + path + " not found.");
            } else if (inode.isFile()) {
                throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_FOUND, "" + path + " is a file, not a directory.");
            }
            return inode.getListing();
        };
        IndexedFileSystem.prototype.chmodSync = function(path, isLchmod, mode) {
            var fd;
            fd = this.openSync(path, BrowserFS.FileMode.getFileMode("r+"), 420);
            fd._stat.mode = mode;
            fd.closeSync();
        };
        IndexedFileSystem.prototype.chownSync = function(path, isLchown, uid, gid) {
            var fd;
            fd = this.openSync(path, BrowserFS.FileMode.getFileMode("r+"), 420);
            fd._stat.uid = uid;
            fd._stat.gid = gid;
            fd.closeSync();
        };
        IndexedFileSystem.prototype.utimesSync = function(path, atime, mtime) {
            var fd;
            fd = this.openSync(path, BrowserFS.FileMode.getFileMode("r+"), 420);
            fd._stat.atime = atime;
            fd._stat.mtime = mtime;
            fd.closeSync();
        };
        return IndexedFileSystem;
    }(BrowserFS.SynchronousFileSystem);
    BrowserFS.File.PreloadFile = function(_super) {
        __extends(PreloadFile, _super);
        function PreloadFile(_fs, _path, _mode, _stat, contents) {
            this._fs = _fs;
            this._path = _path;
            this._mode = _mode;
            this._stat = _stat;
            this._pos = 0;
            if (contents != null && contents instanceof BrowserFS.node.Buffer) {
                this._buffer = contents;
            } else {
                this._buffer = new BrowserFS.node.Buffer(0);
            }
            if (this._stat.size !== this._buffer.length) {
                throw new Error("Invalid buffer: Buffer is " + this._buffer.length + " long, yet Stats object specifies that file is " + this._stat.size + " long.");
            }
        }
        PreloadFile.prototype.getPath = function() {
            return this._path;
        };
        PreloadFile.prototype.getPos = function() {
            if (this._mode.isAppendable()) {
                return this._stat.size;
            }
            return this._pos;
        };
        PreloadFile.prototype.advancePos = function(delta) {
            return this._pos += delta;
        };
        PreloadFile.prototype.setPos = function(newPos) {
            return this._pos = newPos;
        };
        PreloadFile.prototype.sync = function(cb) {
            var e;
            try {
                this.syncSync();
                return cb();
            } catch (_error) {
                e = _error;
                return cb(e);
            }
        };
        PreloadFile.prototype.syncSync = function() {
            throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
        };
        PreloadFile.prototype.close = function(cb) {
            var e;
            try {
                this.closeSync();
                return cb();
            } catch (_error) {
                e = _error;
                return cb(e);
            }
        };
        PreloadFile.prototype.closeSync = function() {
            throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
        };
        PreloadFile.prototype.stat = function(cb) {
            var e;
            try {
                return cb(null, this._stat.clone());
            } catch (_error) {
                e = _error;
                return cb(e);
            }
        };
        PreloadFile.prototype.statSync = function() {
            return this._stat.clone();
        };
        PreloadFile.prototype.truncate = function(len, cb) {
            var e;
            try {
                this.truncateSync(len);
                return cb();
            } catch (_error) {
                e = _error;
                return cb(e);
            }
        };
        PreloadFile.prototype.truncateSync = function(len, cb) {
            var buf;
            if (!this._mode.isWriteable()) {
                throw new BrowserFS.ApiError(BrowserFS.ApiError.PERMISSIONS_ERROR, "File not opened with a writeable mode.");
            }
            this._stat.mtime = new Date();
            if (len > this._buffer.length) {
                buf = new Buffer(len - this._buffer.length);
                buf.fill(0);
                this.writeSync(buf, 0, buf.length, this._buffer.length);
                if (this._mode.isSynchronous()) {
                    this.syncSync();
                }
                return;
            }
            this._stat.size = len;
            if (this._mode.isSynchronous()) {
                this.syncSync();
            }
        };
        PreloadFile.prototype.write = function(buffer, offset, length, position, cb) {
            var e;
            try {
                return cb(null, this.writeSync(buffer, offset, length, position), buffer);
            } catch (_error) {
                e = _error;
                return cb(e);
            }
        };
        PreloadFile.prototype.writeSync = function(buffer, offset, length, position) {
            var endFp, len, newBuff;
            if (position == null) {
                position = this.getPos();
            }
            if (!this._mode.isWriteable()) {
                throw new BrowserFS.ApiError(BrowserFS.ApiError.PERMISSIONS_ERROR, "File not opened with a writeable mode.");
            }
            endFp = position + length;
            if (endFp > this._stat.size) {
                this._stat.size = endFp;
                if (endFp > this._buffer.length) {
                    newBuff = new Buffer(endFp);
                    this._buffer.copy(newBuff);
                    this._buffer = newBuff;
                }
            }
            len = buffer.copy(this._buffer, position, offset, offset + length);
            this._stat.mtime = new Date();
            if (this._mode.isSynchronous()) {
                this.syncSync();
                return len;
            }
            this.setPos(position + len);
            return len;
        };
        PreloadFile.prototype.read = function(buffer, offset, length, position, cb) {
            var e;
            try {
                return cb(null, this.readSync(buffer, offset, length, position), buffer);
            } catch (_error) {
                e = _error;
                return cb(e);
            }
        };
        PreloadFile.prototype.readSync = function(buffer, offset, length, position) {
            var endRead, rv;
            if (!this._mode.isReadable()) {
                throw new BrowserFS.ApiError(BrowserFS.ApiError.PERMISSIONS_ERROR, "File not opened with a readable mode.");
            }
            if (position == null) {
                position = this.getPos();
            }
            endRead = position + length;
            if (endRead > this._stat.size) {
                length = this._stat.size - position;
            }
            rv = this._buffer.copy(buffer, offset, position, position + length);
            this._stat.atime = new Date();
            this._pos = position + length;
            return rv;
        };
        PreloadFile.prototype.chmod = function(mode, cb) {
            var e;
            try {
                this.chmodSync(mode);
                return cb();
            } catch (_error) {
                e = _error;
                return cb(e);
            }
        };
        PreloadFile.prototype.chmodSync = function(mode) {
            if (!this._fs.supportsProps()) {
                throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_SUPPORTED);
            }
            this._stat.mode = mode;
            this.syncSync();
        };
        return PreloadFile;
    }(BrowserFS.File);
    BrowserFS.File.NoSyncFile = function(_super) {
        __extends(NoSyncFile, _super);
        function NoSyncFile() {
            _ref1 = NoSyncFile.__super__.constructor.apply(this, arguments);
            return _ref1;
        }
        NoSyncFile.prototype.sync = function(cb) {
            return cb();
        };
        NoSyncFile.prototype.syncSync = function() {};
        NoSyncFile.prototype.close = function(cb) {
            return cb();
        };
        NoSyncFile.prototype.closeSync = function() {};
        return NoSyncFile;
    }(BrowserFS.File.PreloadFile);
    document.write("<!-- IEBinaryToArray_ByteStr -->\r\n" + "<script type='text/vbscript'>\r\n" + "Function IEBinaryToArray_ByteStr(Binary)\r\n" + " IEBinaryToArray_ByteStr = CStr(Binary)\r\n" + "End Function\r\n" + "Function IEBinaryToArray_ByteStr_Last(Binary)\r\n" + " Dim lastIndex\r\n" + " lastIndex = LenB(Binary)\r\n" + " if lastIndex mod 2 Then\r\n" + " IEBinaryToArray_ByteStr_Last = Chr( AscB( MidB( Binary, lastIndex, 1 ) ) )\r\n" + " Else\r\n" + " IEBinaryToArray_ByteStr_Last = " + '""' + "\r\n" + " End If\r\n" + "End Function\r\n" + "</script>\r\n");
    BrowserFS.FileSystem.XmlHttpRequest = function(_super) {
        __extends(XmlHttpRequest, _super);
        function XmlHttpRequest(listing_url) {
            var listing;
            if (listing_url == null) {
                listing_url = "index.json";
            }
            listing = JSON.parse(this._request_file(listing_url, "json"));
            if (listing == null) {
                throw new Error("Unable to find listing at URL: " + listing_url);
            }
            this._index = BrowserFS.FileIndex.from_listing(listing);
        }
        XmlHttpRequest.prototype.empty = function() {
            var k, v, _ref2, _results;
            _ref2 = this._index._index;
            _results = [];
            for (k in _ref2) {
                v = _ref2[k];
                if (v.file_data != null) {
                    _results.push(v.file_data = void 0);
                }
            }
            return _results;
        };
        XmlHttpRequest.prototype._request_file_modern = function(path, data_type, cb) {
            var data, req;
            req = new XMLHttpRequest();
            req.open("GET", path, cb != null);
            if (cb != null) {
                req.responseType = data_type;
            }
            data = null;
            req.onerror = function(e) {
                return console.error(req.statusText);
            };
            req.onload = function(e) {
                var _ref2;
                if (!(req.readyState === 4 && req.status === 200)) {
                    console.error(req.statusText);
                }
                data = BrowserFS.node.Buffer((_ref2 = req.response) != null ? _ref2 : 0);
                return typeof cb === "function" ? cb(data) : void 0;
            };
            req.send();
            if (data != null && data !== "NOT FOUND") {
                return data;
            }
        };
        XmlHttpRequest.prototype._request_file_size = function(path, cb) {
            var req;
            req = new XMLHttpRequest();
            req.open("HEAD", path);
            req.onerror = function(e) {
                return console.error(req.statusText);
            };
            req.onload = function(e) {
                if (!(req.readyState === 4 && req.status === 200)) {
                    console.error(req.statusText);
                }
                return cb(req.getResponseHeader("Content-Length"));
            };
            return req.send();
        };
        XmlHttpRequest.prototype._GetIEByteArray_ByteStr = function(IEByteArray) {
            var lastChr, rawBytes;
            rawBytes = IEBinaryToArray_ByteStr(IEByteArray);
            lastChr = IEBinaryToArray_ByteStr_Last(IEByteArray);
            return rawBytes.replace(/[\s\S]/g, function(match) {
                var v;
                v = match.charCodeAt(0);
                return String.fromCharCode(v & 255, v >> 8);
            }) + lastChr;
        };
        XmlHttpRequest.prototype._request_file_IE = function(path, data_type, cb) {
            var data, req, _this = this;
            req = new XMLHttpRequest();
            req.open("GET", path, cb != null);
            req.setRequestHeader("Accept-Charset", "x-user-defined");
            data = null;
            req.onerror = function(e) {
                return console.error(req.statusText);
            };
            req.onload = function(e) {
                var data_array;
                if (!(req.readyState === 4 && req.status === 200)) {
                    console.error(req.statusText);
                }
                data_array = _this._GetIEByteArray_ByteStr(req.responseBody);
                data = BrowserFS.node.Buffer(data_array);
                return typeof cb === "function" ? cb(data) : void 0;
            };
            req.send();
            if (data != null && data !== "NOT FOUND") {
                return data;
            }
        };
        if (BrowserFS.isIE && !window.Blob) {
            XmlHttpRequest.prototype._request_file = XmlHttpRequest.prototype._request_file_IE;
        } else {
            XmlHttpRequest.prototype._request_file = XmlHttpRequest.prototype._request_file_modern;
        }
        XmlHttpRequest.prototype.getName = function() {
            return "XmlHttpRequest";
        };
        XmlHttpRequest.isAvailable = function() {
            return typeof XMLHttpRequest !== "undefined" && XMLHttpRequest !== null;
        };
        XmlHttpRequest.prototype.diskSpace = function(path, cb) {
            return cb(0, 0);
        };
        XmlHttpRequest.prototype.isReadOnly = function() {
            return true;
        };
        XmlHttpRequest.prototype.supportsLinks = function() {
            return false;
        };
        XmlHttpRequest.prototype.supportsProps = function() {
            return false;
        };
        XmlHttpRequest.prototype.preloadFile = function(path, buffer) {
            var inode;
            inode = this._index.getInode(path);
            if (inode === null) {
                throw new BrowserFS.ApiError(BrowserFS.ApiError.NOT_FOUND, "" + path + " not found.");
            }
            inode.size = buffer.length;
            inode.file_data = new BrowserFS.File.NoSyncFile(this, path, BrowserFS.FileMode.getFileMode("r"), inode, buffer);
        };
        XmlHttpRequest.prototype.stat = function(path, isLstat, cb) {
            var inode, stats, _ref2;
            inode = this._index.getInode(path);
            if (inode === null) {
                return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_FOUND, "" + path + " not found."));
            }
            if (inode.size < 0) {
                this._request_file_size(path, function(size) {
                    inode.size = size;
                    return cb(null, inode);
                });
            } else {
                stats = (_ref2 = typeof inode.getStats === "function" ? inode.getStats() : void 0) != null ? _ref2 : inode;
                cb(null, stats);
            }
        };
        XmlHttpRequest.prototype.open = function(path, flags, mode, cb) {
            var inode, _this = this;
            inode = this._index.getInode(path);
            if (inode === null) {
                return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_FOUND, "" + path + " is not in the FileIndex."));
            }
            if (inode.isDirectory()) {
                return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_FOUND, "" + path + " is a directory."));
            }
            switch (flags.pathExistsAction()) {
              case BrowserFS.FileMode.THROW_EXCEPTION:
              case BrowserFS.FileMode.TRUNCATE_FILE:
                return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_FOUND, "" + path + " already exists."));

              case BrowserFS.FileMode.NOP:
                if (inode.file_data != null) {
                    return cb(null, inode.file_data);
                }
                this._request_file(path, "arraybuffer", function(buffer) {
                    inode.size = buffer.length;
                    inode.file_data = new BrowserFS.File.NoSyncFile(_this, path, flags, inode, buffer);
                    return cb(null, inode.file_data);
                });
                break;

              default:
                return cb(new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, "Invalid FileMode object."));
            }
        };
        XmlHttpRequest.prototype.readdir = function(path, cb) {
            var inode;
            inode = this._index.getInode(path);
            if (inode === null) {
                return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_FOUND, "" + path + " not found."));
            } else if (inode.isFile()) {
                return cb(new BrowserFS.ApiError(BrowserFS.ApiError.NOT_FOUND, "" + path + " is a file, not a directory."));
            }
            return cb(null, inode.getListing());
        };
        return XmlHttpRequest;
    }(BrowserFS.FileSystem);
    BrowserFS.FileSystem.InMemory = function(_super) {
        __extends(InMemory, _super);
        function InMemory() {
            this.empty();
        }
        InMemory.prototype.empty = function() {
            return this._index = new BrowserFS.FileIndex();
        };
        InMemory.prototype.getName = function() {
            return "In-memory";
        };
        InMemory.isAvailable = function() {
            return true;
        };
        InMemory.prototype.diskSpace = function(path, cb) {
            return cb(Infinity, BrowserFS.util.roughSizeOfObject(this._index));
        };
        InMemory.prototype.isReadOnly = function() {
            return false;
        };
        InMemory.prototype.supportsLinks = function() {
            return false;
        };
        InMemory.prototype.supportsProps = function() {
            return false;
        };
        InMemory.prototype._truncate = function(path, flags, inode) {
            var file;
            inode.size = 0;
            inode.mtime = new Date();
            file = inode.file_data;
            file._mode = flags;
            file._buffer = new BrowserFS.node.Buffer(0);
            return file;
        };
        InMemory.prototype._fetch = function(path, flags, inode) {
            var file;
            file = inode.file_data;
            file._mode = flags;
            return file;
        };
        InMemory.prototype._create = function(path, flags, inode) {
            var file;
            file = new BrowserFS.File.NoSyncFile(this, path, flags, inode);
            inode.file_data = file;
            this._index.addPath(path, inode);
            return file;
        };
        InMemory.prototype._rmdirSync = function(path, inode) {};
        return InMemory;
    }(BrowserFS.IndexedFileSystem);
    BrowserFS.FileSystem.LocalStorage = function(_super) {
        var e, supportsBinaryString;
        __extends(LocalStorage, _super);
        function LocalStorage() {
            var data, i, inode, len, path, _i, _ref2, _ref3;
            this._index = new BrowserFS.FileIndex();
            for (i = _i = 0, _ref2 = window.localStorage.length; _i < _ref2; i = _i += 1) {
                path = window.localStorage.key(i);
                if (path[0] !== "/") {
                    continue;
                }
                data = (_ref3 = window.localStorage.getItem(path)) != null ? _ref3 : "";
                len = this._getFileLength(data);
                inode = new BrowserFS.FileInode(BrowserFS.node.fs.Stats.FILE, len);
                this._index.addPath(path, inode);
            }
        }
        LocalStorage.prototype._getFile = function(path, flags, inode) {
            var data;
            data = window.localStorage.getItem(path);
            if (data === null) {
                return null;
            }
            return this._convertFromBinaryString(path, data, flags, inode);
        };
        LocalStorage.prototype._syncSync = function(path, data, inode) {
            var e;
            data = this._convertToBinaryString(data, inode);
            try {
                window.localStorage.setItem(path, data);
                this._index.addPath(path, inode);
            } catch (_error) {
                e = _error;
                throw new BrowserFS.ApiError(BrowserFS.ApiError.DRIVE_FULL, "Unable to sync " + path);
            }
        };
        try {
            window.localStorage.setItem("__test__", String.fromCharCode(55296));
            supportsBinaryString = window.localStorage.getItem("__test__") === String.fromCharCode(55296);
        } catch (_error) {
            e = _error;
            supportsBinaryString = false;
        }
        if (supportsBinaryString) {
            LocalStorage.prototype._convertToBinaryString = function(data, inode) {
                var headerBuff, headerDat;
                data = data.toString("binary_string");
                headerBuff = new BrowserFS.node.Buffer(18);
                headerBuff.writeUInt16BE(inode.mode, 0);
                headerBuff.writeDoubleBE(inode.mtime.getTime(), 2);
                headerBuff.writeDoubleBE(inode.atime.getTime(), 10);
                headerDat = headerBuff.toString("binary_string");
                data = headerDat + data;
                return data;
            };
            LocalStorage.prototype._convertFromBinaryString = function(path, data, flags, inode) {
                var buffer, file, headerBuff;
                headerBuff = new BrowserFS.node.Buffer(data.substr(0, 10), "binary_string");
                data = data.substr(10);
                buffer = new BrowserFS.node.Buffer(data, "binary_string");
                file = new BrowserFS.File.PreloadFile.LocalStorageFile(this, path, flags, inode, buffer);
                file._stat.mode = headerBuff.readUInt16BE(0);
                file._stat.mtime = new Date(headerBuff.readDoubleBE(2));
                file._stat.atime = new Date(headerBuff.readDoubleBE(10));
                return file;
            };
            LocalStorage.prototype._getFileLength = function(data) {
                if (data.length > 10) {
                    return BrowserFS.StringUtil.FindUtil("binary_string").byteLength(data.substr(10));
                } else {
                    return 0;
                }
            };
        } else {
            LocalStorage.prototype._convertToBinaryString = function(data, inode) {
                var headerBuff, headerDat;
                data = data.toString("binary_string_ie");
                headerBuff = new BrowserFS.node.Buffer(18);
                headerBuff.writeUInt16BE(inode.mode, 0);
                headerBuff.writeDoubleBE(inode.mtime.getTime(), 2);
                headerBuff.writeDoubleBE(inode.atime.getTime(), 10);
                headerDat = headerBuff.toString("binary_string_ie");
                data = headerDat + data;
                return data;
            };
            LocalStorage.prototype._convertFromBinaryString = function(path, data, flags, inode) {
                var buffer, file, headerBuff;
                headerBuff = new BrowserFS.node.Buffer(data.substr(0, 18), "binary_string_ie");
                data = data.substr(18);
                buffer = new BrowserFS.node.Buffer(data, "binary_string_ie");
                file = new BrowserFS.File.PreloadFile.LocalStorageFile(this, path, flags, inode, buffer);
                file._stat.mode = headerBuff.readUInt16BE(0);
                file._stat.mtime = new Date(headerBuff.readDoubleBE(2));
                file._stat.atime = new Date(headerBuff.readDoubleBE(10));
                return file;
            };
            LocalStorage.prototype._getFileLength = function(data) {
                if (data.length > 0) {
                    return data.length - 18;
                } else {
                    return 0;
                }
            };
        }
        LocalStorage.prototype.empty = function() {
            window.localStorage.clear();
            return this._index = new BrowserFS.FileIndex();
        };
        LocalStorage.prototype.getName = function() {
            return "localStorage";
        };
        LocalStorage.isAvailable = function() {
            return (typeof window !== "undefined" && window !== null ? window.localStorage : void 0) != null;
        };
        LocalStorage.prototype.diskSpace = function(path, cb) {
            var data, i, key, remaining, storageLimit, usedSpace, _i;
            storageLimit = 5242880;
            usedSpace = 0;
            for (i = _i = 0; 0 <= length ? _i < length : _i > length; i = 0 <= length ? ++_i : --_i) {
                key = window.localStorage.key(i);
                usedSpace += key.length * 2;
                data = window.localStorage.getItem(key);
                usedSpace += data.length * 2;
            }
            if (window.localStorage.remainingSpace != null) {
                remaining = window.localStorage.remainingSpace();
                storageLimit = usedSpace + remaining;
            }
            return cb(storageLimit, usedSpace);
        };
        LocalStorage.prototype.isReadOnly = function() {
            return false;
        };
        LocalStorage.prototype.supportsLinks = function() {
            return false;
        };
        LocalStorage.prototype.supportsProps = function() {
            return true;
        };
        LocalStorage.prototype.unlinkSync = function(path) {
            LocalStorage.__super__.unlinkSync.call(this, path);
            return window.localStorage.removeItem(path);
        };
        LocalStorage.prototype._truncate = function(path, flags, inode) {
            inode.size = 0;
            return new BrowserFS.File.PreloadFile.LocalStorageFile(this, path, flags, inode);
        };
        LocalStorage.prototype._fetch = function(path, flags, inode) {
            return this._getFile(path, flags, inode);
        };
        LocalStorage.prototype._create = function(path, flags, inode) {
            return new BrowserFS.File.PreloadFile.LocalStorageFile(this, path, flags, inode);
        };
        LocalStorage.prototype._rmdirSync = function(path, inode) {
            var file, files, sep, _i, _len;
            files = inode.getListing();
            sep = BrowserFS.node.path.sep;
            for (_i = 0, _len = files.length; _i < _len; _i++) {
                file = files[_i];
                window.localStorage.removeItem("" + path + sep + file);
            }
        };
        return LocalStorage;
    }(BrowserFS.IndexedFileSystem);
    BrowserFS.File.PreloadFile.LocalStorageFile = function(_super) {
        __extends(LocalStorageFile, _super);
        function LocalStorageFile() {
            _ref2 = LocalStorageFile.__super__.constructor.apply(this, arguments);
            return _ref2;
        }
        LocalStorageFile.prototype.syncSync = function() {
            this._fs._syncSync(this._path, this._buffer, this._stat);
        };
        LocalStorageFile.prototype.closeSync = function() {
            return this.syncSync();
        };
        return LocalStorageFile;
    }(BrowserFS.File.PreloadFile);
    BrowserFS.FileSystem.MountableFileSystem = function(_super) {
        var cmds, defineFcn, fnName, fsCmdMap, i, j, _i, _j, _ref3, _ref4;
        __extends(MountableFileSystem, _super);
        function MountableFileSystem() {
            this.mntMap = {};
            this.rootFs = new BrowserFS.FileSystem.InMemory();
        }
        MountableFileSystem.prototype.mount = function(mnt_pt, fs) {
            if (this.mntMap[mnt_pt]) {
                throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, "Mount point " + mnt_pt + " is already taken.");
            }
            this.rootFs.mkdirSync(mnt_pt);
            return this.mntMap[mnt_pt] = fs;
        };
        MountableFileSystem.prototype.umount = function(mnt_pt) {
            if (!this.mntMap[mnt_pt]) {
                throw new BrowserFS.ApiError(BrowserFS.ApiError.INVALID_PARAM, "Mount point " + mnt_pt + " is already unmounted.");
            }
            delete this.mntMap[mnt_pt];
            return this.rootFs.rmdirSync(mnt_pt);
        };
        MountableFileSystem.prototype._get_fs = function(path) {
            var fs, mnt_pt, _ref3;
            _ref3 = this.mntMap;
            for (mnt_pt in _ref3) {
                fs = _ref3[mnt_pt];
                if (path.indexOf(mnt_pt) === 0) {
                    path = path.substr(mnt_pt.length > 1 ? mnt_pt.length : 0);
                    if (path === "") {
                        path = "/";
                    }
                    return [ fs, path ];
                }
            }
            return [ this.rootFs, path ];
        };
        MountableFileSystem.prototype.getName = function() {
            return "MountableFileSystem";
        };
        MountableFileSystem.isAvailable = function() {
            return true;
        };
        MountableFileSystem.prototype.diskSpace = function(path, cb) {
            return cb(0, 0);
        };
        MountableFileSystem.prototype.isReadOnly = function() {
            return false;
        };
        MountableFileSystem.prototype.supportsLinks = function() {
            return false;
        };
        MountableFileSystem.prototype.supportsProps = function() {
            return false;
        };
        MountableFileSystem.prototype.supportsSynch = function() {
            return true;
        };
        defineFcn = function(name, isSync, numArgs) {
            return function() {
                var args, rv;
                args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
                rv = this._get_fs(args[0]);
                args[0] = rv[1];
                return rv[0][name].apply(rv[0], args);
            };
        };
        fsCmdMap = [ [ "readdir", "exists", "unlink", "rmdir", "readlink" ], [ "stat", "mkdir", "realpath", "truncate" ], [ "open", "readFile", "chmod", "utimes" ], [ "chown" ], [ "writeFile", "appendFile" ] ];
        for (i = _i = 0, _ref3 = fsCmdMap.length; _i < _ref3; i = _i += 1) {
            cmds = fsCmdMap[i];
            for (j = _j = 0, _ref4 = cmds.length; _j < _ref4; j = _j += 1) {
                fnName = cmds[j];
                MountableFileSystem.prototype[fnName] = defineFcn(fnName, false, i + 1);
                MountableFileSystem.prototype[fnName + "Sync"] = defineFcn(fnName + "Sync", true, i + 1);
            }
        }
        MountableFileSystem.prototype.rename = function(oldPath, newPath, cb) {
            var fs1_rv, fs2_rv;
            fs1_rv = this._get_fs(oldPath);
            fs2_rv = this._get_fs(newPath);
            if (fs1_rv instanceof BrowserFS.ApiError) {
                return cb(fs1_rv);
            }
            if (fs2_rv instanceof BrowserFS.ApiError) {
                return cb(fs2_rv);
            }
            if (fs1_rv[0] === fs2_rv[0]) {
                return fs1_rv[0].rename(fs1_rv[1], fs2_rv[1], cb);
            }
            return BrowserFS.node.fs.readFile(oldPath, function(err, data) {
                if (err) {
                    return cb(err);
                }
                return BrowserFS.node.fs.writeFile(newPath, data, function(err) {
                    if (err) {
                        return cb(err);
                    }
                    return BrowserFS.node.fs.unlink(oldPath, cb);
                });
            });
        };
        MountableFileSystem.prototype.renameSync = function(oldPath, newPath) {
            var data, fs1_rv, fs2_rv;
            fs1_rv = this._get_fs(oldPath);
            fs2_rv = this._get_fs(newPath);
            if (fs1_rv instanceof BrowserFS.ApiError) {
                throw fs1_rv;
            }
            if (fs2_rv instanceof BrowserFS.ApiError) {
                throw fs2_rv;
            }
            if (fs1_rv[0] === fs2_rv[0]) {
                return fs1_rv[0].renameSync(fs1_rv[1], fs2_rv[1]);
            }
            data = BrowserFS.node.fs.readFileSync(oldPath);
            BrowserFS.node.fs.writeFileSync(newPath, data);
            return BrowserFS.node.fs.unlinkSync(oldPath);
        };
        return MountableFileSystem;
    }(BrowserFS.FileSystem);
}).call(this);
//# sourceMappingURL=lib/browserfs.map