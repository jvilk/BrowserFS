var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var buffer = require('./buffer');
var api_error = require('./api_error');
var Buffer = buffer.Buffer;
var ApiError = api_error.ApiError;
var ErrorCode = api_error.ErrorCode;
var BufferedEvent = (function () {
    function BufferedEvent(data, encoding, cb) {
        this.data = data;
        this.encoding = encoding;
        this.cb = cb;
        this.size = typeof (data) !== 'string' ? data.length : Buffer.byteLength(data, encoding != null ? encoding : undefined);
        if (typeof (this.data) !== 'string') {
            this.data = this.data.sliceCopy();
        }
    }
    BufferedEvent.prototype.getData = function (encoding) {
        if (encoding == null) {
            if (typeof (this.data) === 'string') {
                return new Buffer(this.data, this.encoding != null ? this.encoding : undefined);
            }
            else {
                return this.data;
            }
        }
        else {
            if (typeof (this.data) === 'string') {
                if (encoding === this.encoding) {
                    return this.data;
                }
                else {
                    return (new Buffer(this.data, this.encoding != null ? this.encoding : undefined)).toString(encoding);
                }
            }
            else {
                return this.data.toString(encoding);
            }
        }
    };
    return BufferedEvent;
})();
var AbstractEventEmitter = (function () {
    function AbstractEventEmitter() {
        this._listeners = {};
        this.maxListeners = 10;
    }
    AbstractEventEmitter.prototype.addListener = function (event, listener) {
        if (typeof (this._listeners[event]) === 'undefined') {
            this._listeners[event] = [];
        }
        if (this._listeners[event].push(listener) > this.maxListeners) {
            process.stdout.write("Warning: Event " + event + " has more than " + this.maxListeners + " listeners.\n");
        }
        this.emit('newListener', event, listener);
        return this;
    };
    AbstractEventEmitter.prototype.on = function (event, listener) {
        return this.addListener(event, listener);
    };
    AbstractEventEmitter.prototype.once = function (event, listener) {
        var fired = false, newListener = function () {
            this.removeListener(event, newListener);
            if (!fired) {
                fired = true;
                listener.apply(this, arguments);
            }
        };
        return this.addListener(event, newListener);
    };
    AbstractEventEmitter.prototype._emitRemoveListener = function (event, listeners) {
        var i;
        if (this._listeners['removeListener'] && this._listeners['removeListener'].length > 0) {
            for (i = 0; i < listeners.length; i++) {
                this.emit('removeListener', event, listeners[i]);
            }
        }
    };
    AbstractEventEmitter.prototype.removeListener = function (event, listener) {
        var listeners = this._listeners[event];
        if (typeof (listeners) !== 'undefined') {
            var idx = listeners.indexOf(listener);
            if (idx > -1) {
                listeners.splice(idx, 1);
            }
        }
        this.emit('removeListener', event, listener);
        return this;
    };
    AbstractEventEmitter.prototype.removeAllListeners = function (event) {
        var removed, keys, i;
        if (typeof (event) !== 'undefined') {
            removed = this._listeners[event];
            this._listeners[event] = [];
            this._emitRemoveListener(event, removed);
        }
        else {
            keys = Object.keys(this._listeners);
            for (i = 0; i < keys.length; i++) {
                this.removeAllListeners(keys[i]);
            }
        }
        return this;
    };
    AbstractEventEmitter.prototype.setMaxListeners = function (n) {
        this.maxListeners = n;
    };
    AbstractEventEmitter.prototype.listeners = function (event) {
        if (typeof (this._listeners[event]) === 'undefined') {
            this._listeners[event] = [];
        }
        return this._listeners[event].slice(0);
    };
    AbstractEventEmitter.prototype.emit = function (event) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        var listeners = this._listeners[event], rv = false;
        if (typeof (listeners) !== 'undefined') {
            var i;
            for (i = 0; i < listeners.length; i++) {
                rv = true;
                listeners[i].apply(this, args);
            }
        }
        return rv;
    };
    return AbstractEventEmitter;
})();
exports.AbstractEventEmitter = AbstractEventEmitter;
var AbstractDuplexStream = (function (_super) {
    __extends(AbstractDuplexStream, _super);
    function AbstractDuplexStream(writable, readable) {
        _super.call(this);
        this.writable = writable;
        this.readable = readable;
        this.encoding = null;
        this.flowing = false;
        this.buffer = [];
        this.endEvent = null;
        this.ended = false;
        this.drained = true;
    }
    AbstractDuplexStream.prototype.addListener = function (event, listener) {
        var rv = _super.prototype.addListener.call(this, event, listener), _this = this;
        if (event === 'data' && !this.flowing) {
            this.resume();
        }
        else if (event === 'readable' && this.buffer.length > 0) {
            setTimeout(function () {
                _this.emit('readable');
            }, 0);
        }
        return rv;
    };
    AbstractDuplexStream.prototype._processArgs = function (data, arg2, arg3) {
        if (typeof (arg2) === 'string') {
            return new BufferedEvent(data, arg2, arg3);
        }
        else {
            return new BufferedEvent(data, null, arg2);
        }
    };
    AbstractDuplexStream.prototype._processEvents = function () {
        var drained = this.buffer.length === 0;
        if (this.drained !== drained) {
            if (this.drained) {
                this.emit('readable');
            }
        }
        if (this.flowing && this.buffer.length !== 0) {
            this.emit('data', this.read());
        }
        this.drained = this.buffer.length === 0;
    };
    AbstractDuplexStream.prototype.emitEvent = function (type, event) {
        this.emit(type, event.getData(this.encoding));
        if (event.cb) {
            event.cb();
        }
    };
    AbstractDuplexStream.prototype.write = function (data, arg2, arg3) {
        if (this.ended) {
            throw new ApiError(ErrorCode.EPERM, 'Cannot write to an ended stream.');
        }
        var event = this._processArgs(data, arg2, arg3);
        this._push(event);
        return this.flowing;
    };
    AbstractDuplexStream.prototype.end = function (data, arg2, arg3) {
        if (this.ended) {
            throw new ApiError(ErrorCode.EPERM, 'Stream is already closed.');
        }
        var event = this._processArgs(data, arg2, arg3);
        this.ended = true;
        this.endEvent = event;
        this._processEvents();
    };
    AbstractDuplexStream.prototype.read = function (size) {
        var events = [], eventsCbs = [], lastCb, eventsSize = 0, event, buff, trueSize, i = 0, sizeUnspecified = typeof (size) !== 'number';
        if (sizeUnspecified)
            size = 4294967295;
        for (i = 0; i < this.buffer.length && eventsSize < size; i++) {
            event = this.buffer[i];
            events.push(event.getData());
            if (event.cb) {
                eventsCbs.push(event.cb);
            }
            eventsSize += event.size;
            lastCb = event.cb;
        }
        if (!sizeUnspecified && eventsSize < size) {
            return null;
        }
        this.buffer = this.buffer.slice(events.length);
        trueSize = eventsSize > size ? size : eventsSize;
        buff = Buffer.concat(events);
        if (eventsSize > size) {
            if (lastCb)
                eventsCbs.pop();
            this._push(new BufferedEvent(buff.slice(size), null, lastCb));
        }
        if (eventsCbs.length > 0) {
            setTimeout(function () {
                var i;
                for (i = 0; i < eventsCbs.length; i++) {
                    eventsCbs[i]();
                }
            }, 0);
        }
        if (this.ended && this.buffer.length === 0 && this.endEvent !== null) {
            var endEvent = this.endEvent, _this = this;
            this.endEvent = null;
            setTimeout(function () {
                _this.emitEvent('end', endEvent);
            }, 0);
        }
        if (events.length === 0) {
            this.emit('_read');
            return null;
        }
        else if (this.encoding === null) {
            return buff.slice(0, trueSize);
        }
        else {
            return buff.toString(this.encoding, 0, trueSize);
        }
    };
    AbstractDuplexStream.prototype.setEncoding = function (encoding) {
        this.encoding = encoding;
    };
    AbstractDuplexStream.prototype.pause = function () {
        this.flowing = false;
    };
    AbstractDuplexStream.prototype.resume = function () {
        this.flowing = true;
        this._processEvents();
    };
    AbstractDuplexStream.prototype.pipe = function (destination, options) {
        throw new ApiError(ErrorCode.EPERM, "Unimplemented.");
    };
    AbstractDuplexStream.prototype.unpipe = function (destination) { };
    AbstractDuplexStream.prototype.unshift = function (chunk) {
        if (this.ended) {
            throw new ApiError(ErrorCode.EPERM, "Stream has ended.");
        }
        this.buffer.unshift(new BufferedEvent(chunk, this.encoding));
        this._processEvents();
    };
    AbstractDuplexStream.prototype._push = function (event) {
        this.buffer.push(event);
        this._processEvents();
    };
    AbstractDuplexStream.prototype.wrap = function (stream) {
        throw new ApiError(ErrorCode.EPERM, "Unimplemented.");
    };
    return AbstractDuplexStream;
})(AbstractEventEmitter);
exports.AbstractDuplexStream = AbstractDuplexStream;
//# sourceMappingURL=node_eventemitter.js.map