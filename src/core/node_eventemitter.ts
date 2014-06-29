/**
 * Contains helper classes for emulating Node EventEmitters.
 * @todo Pipe / unpipe functions and events.
 * @todo 'close' event (when is it emitted?)
 * @todo Listen for user-supplied events on Writable/Readable (e.g. 'close'/'end').
 */
import buffer = require('./buffer');
import api_error = require('./api_error');
var Buffer = buffer.Buffer;
var ApiError = api_error.ApiError;
var ErrorCode = api_error.ErrorCode;

/**
 * Internal class. Represents a buffered event.
 */
class BufferedEvent {
  public size: number;
  constructor(public data: any, public encoding?: string, public cb?: Function) {
    this.size = typeof(data) !== 'string' ? data.length : Buffer.byteLength(data, encoding != null ? encoding : undefined);
    // If data is a buffer, we need to copy it.
    if (typeof(this.data) !== 'string') {
      this.data = this.data.sliceCopy();
    }
  }

  /**
   * Get data as a buffer, or as a string in the specified encoding.
   */
  public getData(): NodeBuffer;
  public getData(encoding: string): string;
  public getData(encoding?: string): any {
    if (encoding == null) {
      if (typeof(this.data) === 'string') {
        return new Buffer(this.data, this.encoding != null ? this.encoding : undefined);
      } else {
        return this.data;
      }
    } else {
      if (typeof(this.data) === 'string') {
        if (encoding === this.encoding) {
          return this.data;
        } else {
          return (new Buffer(this.data, this.encoding != null ? this.encoding : undefined)).toString(encoding);
        }
      } else {
        return this.data.toString(encoding);
      }
    }
  }
}

/**
 * Provides an abstract implementation of the EventEmitter interface.
 */
export class AbstractEventEmitter implements NodeJS.EventEmitter {
  private _listeners: {[event: string]: Function[]} = {};
  private maxListeners: number = 10;

  /**
   * Adds a listener for the particular event.
   */
  public addListener(event: string, listener: Function): NodeJS.EventEmitter {
    if (typeof(this._listeners[event]) === 'undefined') {
      this._listeners[event] = [];
    }
    if (this._listeners[event].push(listener) > this.maxListeners) {
      process.stdout.write("Warning: Event " + event + " has more than " + this.maxListeners + " listeners.\n");
    }
    this.emit('newListener', event, listener);
    return this;
  }

  /**
   * Adds a listener for the particular event.
   */
  public on(event: string, listener: Function): NodeJS.EventEmitter {
    return this.addListener(event, listener);
  }

  /**
   * Adds a listener for the particular event that fires only once.
   */
  public once(event: string, listener: Function): NodeJS.EventEmitter {
    // Create a new callback that will only fire once.
    var fired: boolean = false,
        newListener: Function = function() {
          this.removeListener(event, newListener);

          if (!fired) {
            fired = true;
            listener.apply(this, arguments);
          }
        };
    return this.addListener(event, newListener);
  }

  /**
   * Emits the 'removeListener' event for the specified listeners.
   */
  private _emitRemoveListener(event: string, listeners: Function[]): void {
    var i: number;
    // Only emit the event if someone is listening.
    if (this._listeners['removeListener'] && this._listeners['removeListener'].length > 0) {
      for (i = 0; i < listeners.length; i++) {
        this.emit('removeListener', event, listeners[i]);
      }
    }
  }

  /**
   * Removes the particular listener for the given event.
   */
  public removeListener(event: string, listener: Function): NodeJS.EventEmitter {
    var listeners = this._listeners[event];
    if (typeof(listeners) !== 'undefined') {
      // Remove listener, if present.
      var idx = listeners.indexOf(listener);
      if (idx > -1) {
        listeners.splice(idx, 1);
      }
    }
    this.emit('removeListener', event, listener);
    return this;
  }

  /**
   * Removes all listeners, or those of the specified event.
   */
  public removeAllListeners(event?: string): NodeJS.EventEmitter {
    var removed: Function[], keys: string[], i: number;
    if (typeof(event) !== 'undefined') {
      removed = this._listeners[event];
      // Clear one event.
      this._listeners[event] = [];
      this._emitRemoveListener(event, removed);
    } else {
      // Clear all events.
      keys = Object.keys(this._listeners);
      for (i = 0; i < keys.length; i++) {
        this.removeAllListeners(keys[i]);
      }
    }
    return this;
  }

  /**
   * EventEmitters print a warning when an event has greater than this specified
   * number of listeners.
   */
  public setMaxListeners(n: number): void {
    this.maxListeners = n;
  }

  /**
   * Returns the listeners for the given event.
   */
  public listeners(event: string): Function[] {
    if (typeof(this._listeners[event]) === 'undefined') {
      this._listeners[event] = [];
    }
    // Return a *copy* of our internal structure.
    return this._listeners[event].slice(0);
  }

  /**
   * Emits the specified event to all listeners of the particular event.
   */
  public emit(event: string, ...args: any[]): boolean {
    var listeners = this._listeners[event],
        rv: boolean = false;
    if (typeof(listeners) !== 'undefined') {
      var i;
      for (i = 0; i < listeners.length; i++) {
        rv = true;
        listeners[i].apply(this, args);
      }
    }
    return rv;
  }
}

/**
 * Provides an abstract implementation of the WritableStream and ReadableStream
 * interfaces.
 * @todo: Check readable/writable status.
 */
export class AbstractDuplexStream extends AbstractEventEmitter implements NodeJS.ReadWriteStream {
  /**
   * How should the data output be encoded? 'null' means 'Buffer'.
   */
  private encoding: string = null;
  /**
   * Is this stream currently flowing (resumed) or non-flowing (paused)?
   */
  private flowing: boolean = false;
  /**
   * Event buffer. Simply queues up all write requests.
   */
  private buffer: BufferedEvent[] = [];
  /**
   * Once set, the stream is closed. Emitted once 'buffer' is empty.
   */
  private endEvent: BufferedEvent = null;
  /**
   * Has the stream ended?
   */
  private ended: boolean = false;
  /**
   * The last time we checked, was the buffer empty?
   * We emit 'readable' events when this transitions from 'true' -> 'false'.
   */
  private drained: boolean = true;

  /**
   * Abstract stream implementation that can be configured to be readable and/or
   * writable.
   */
  constructor(public writable: boolean, public readable: boolean) {
    super();
  }

  /**
   * Adds a listener for the particular event.
   * Implemented here so that we can capture data EventListeners, which trigger
   * us to 'resume'.
   */
  public addListener(event: string, listener: Function): NodeJS.EventEmitter {
    var rv = super.addListener(event, listener),
        _this = this;
    if (event === 'data' && !this.flowing) {
      this.resume();
    } else if (event === 'readable' && this.buffer.length > 0) {
      setTimeout(function() {
        _this.emit('readable');
      }, 0);
    }
    return rv;
  }

  /**
   * Helper function for 'write' and 'end' functions.
   */
  private _processArgs(data?: any, arg2?: any, arg3?: any): BufferedEvent {
    if (typeof(arg2) === 'string') {
      // data, encoding, cb?
      return new BufferedEvent(data, arg2, arg3);
    } else {
      // data, cb?
      return new BufferedEvent(data, null, arg2);
    }
  }

  /**
   * If flowing, this will process pending events.
   */
  private _processEvents(): void {
    var drained = this.buffer.length === 0;
    if (this.drained !== drained) {
      if (this.drained) {
        // Went from drained to not drained. New stuff is available.
        // @todo: Is this event relevant in flowing mode?
        this.emit('readable');
      }
    }

    if (this.flowing && this.buffer.length !== 0) {
      this.emit('data', this.read());
    }
    // Are we drained? Check.
    this.drained = this.buffer.length === 0;
  }

  /**
   * Emits the given buffered event.
   */
  private emitEvent(type: string, event: BufferedEvent) {
    this.emit(type, event.getData(this.encoding));
    if (event.cb) {
      event.cb();
    }
  }

  /**
   * Write data to the stream.
   */
  public write(data: string, cb?: Function): boolean;
  public write(data: string, encoding?: string, cb?: Function): boolean;
  public write(data: NodeBuffer, cb?: Function): boolean;
  public write(data: any, arg2?: any, arg3?: Function): boolean {
    if (this.ended) {
      throw new ApiError(ErrorCode.EPERM, 'Cannot write to an ended stream.');
    }
    var event = this._processArgs(data, arg2, arg3);
    this._push(event);
    return this.flowing;
  }

  /**
   * Emit an 'end' event to close the stream.
   */
  public end(): void;
  public end(data: string, cb?: Function): void;
  public end(data: string, encoding?: string, cb?: Function): void;
  public end(data: NodeBuffer): void;
  public end(data?: any, arg2?: any, arg3?: Function): void {
    if (this.ended) {
      throw new ApiError(ErrorCode.EPERM, 'Stream is already closed.');
    }
    var event = this._processArgs(data, arg2, arg3);
    this.ended = true;
    this.endEvent = event;
    this._processEvents();
  }

  /**** Readable Interface ****/

  /**
   * Read a given number of bytes from the buffer. Should only be called in
   * non-flowing mode.
   * If we do not have `size` bytes available, return null.
   */
  public read(size?: number): any {
    var events: NodeBuffer[] = [],
        eventsCbs: Function[] = [],
        lastCb: Function,
        eventsSize: number = 0,
        event: BufferedEvent,
        buff: NodeBuffer,
        trueSize: number,
        i: number = 0,
        sizeUnspecified: boolean = typeof(size) !== 'number';

    // I do this so I do not need to specialize the loop below.
    if (sizeUnspecified) size = 4294967295;

    // Figure out how many scheduled write events we need to process before we
    // satisfy the requested size.
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
      // For some reason, the Node stream API specifies that we either return
      // 'size' bytes of data, or nothing at all.
      return null;
    }

    // Remove all of the events we are processing from the buffer.
    this.buffer = this.buffer.slice(events.length);

    // The 'true size' of the final event we're going to send out.
    trueSize = eventsSize > size ? size : eventsSize;

    // Concat at all of the events into one buffer.
    buff = Buffer.concat(events);
    if (eventsSize > size) {
      // If last event had a cb, ignore it -- we trigger it when that *entire*
      // write finishes.
      if (lastCb) eventsCbs.pop();
      // Make a new event for the remaining data.
      this._push(new BufferedEvent(buff.slice(size), null, lastCb));
    }

    // Schedule the relevant cbs to fire *after* we've returned these values.
    if (eventsCbs.length > 0) {
      setTimeout(function() {
        var i;
        for (i = 0; i < eventsCbs.length; i++) {
          eventsCbs[i]();
        }
      }, 0);
    }

    // If we're at the end of the buffer and an endEvent is specified, schedule
    // the event to fire.
    if (this.ended && this.buffer.length === 0 && this.endEvent !== null) {
      var endEvent = this.endEvent,
          _this = this;
      // Erase it so we don't accidentally trigger it again.
      this.endEvent = null;
      setTimeout(function() {
        _this.emitEvent('end', endEvent);
      }, 0);
    }

    // Return in correct encoding.
    if (events.length === 0) {
      // Buffer was empty. We're supposed to return 'null', as opposed to an
      // empty buffer or string.
      // [BFS] Emit a '_read' event to signal that maybe the write-end of this
      //       should push some data into the pipe.
      this.emit('_read');
      return null;
    } else if (this.encoding === null) {
      return buff.slice(0, trueSize);
    } else {
      return buff.toString(this.encoding, 0, trueSize);
    }
  }

  /**
   * Set the encoding for the 'data' event.
   */
  public setEncoding(encoding: string): void {
    this.encoding = encoding;
  }

  /**
   * Pause the stream.
   */
  public pause(): void {
    this.flowing = false;
  }

  /**
   * Resume the stream.
   */
  public resume(): void {
    this.flowing = true;
    // Process any buffered writes.
    this._processEvents();
  }

  /**
   * Pipe a readable stream into a writable stream. Currently unimplemented.
   */
  public pipe<T extends NodeJS.WritableStream>(destination: T, options?: { end?: boolean; }): T {
    throw new ApiError(ErrorCode.EPERM, "Unimplemented.");
  }
  public unpipe<T extends NodeJS.WritableStream>(destination?: T): void {}

  /**
   * 'Unshift' the given piece of data back into the buffer.
   */
  public unshift(chunk: String): void;
  public unshift(chunk: NodeBuffer): void;
  public unshift(chunk: any): void {
    if (this.ended) {
      throw new ApiError(ErrorCode.EPERM, "Stream has ended.");
    }
    this.buffer.unshift(new BufferedEvent(chunk, this.encoding));
    this._processEvents();
  }

  /**
   * 'Push' the given piece of data to the back of the buffer.
   * Returns true if the event was sent out, false if buffered.
   */
  private _push(event: BufferedEvent): void {
    this.buffer.push(event);
    this._processEvents();
  }

  /**
   * Enables backwards-compatibility with older versions of Node and their
   * stream interface. Unimplemented.
   */
  public wrap(stream: NodeJS.ReadableStream): NodeJS.ReadableStream {
    throw new ApiError(ErrorCode.EPERM, "Unimplemented.");
  }
}
