/**
 * BrowserFS's main entry point.
 * It installs all of the needed polyfills, and requires() the main module.
 */
import global from './core/global';

// IE substr does not support negative indices
if ('ab'.substr(-1) !== 'b') {
  String.prototype.substr = function(substr: (start: number, length?: number) => string) {
    return function(start: number, length?: number): string {
      // did we get a negative start, calculate how much it is from the
      // beginning of the string
      if (start < 0) start = this.length + start;
      // call the original function
      return substr.call(this, start, length);
    }
  }(String.prototype.substr);
}

// Only IE10 has setImmediate.
// @todo: Determine viability of switching to the 'proper' polyfill for this.
if (typeof setImmediate === 'undefined') {
  var gScope = global;
  var timeouts: (() => void)[] = [];
  var messageName = "zero-timeout-message";
  var canUsePostMessage = function() {
    if (typeof gScope.importScripts !== 'undefined' || !gScope.postMessage) {
      return false;
    }
    var postMessageIsAsync = true;
    var oldOnMessage = gScope.onmessage;
    gScope.onmessage = function() {
      postMessageIsAsync = false;
    };
    gScope.postMessage('', '*');
    gScope.onmessage = oldOnMessage;
    return postMessageIsAsync;
  };
  if (canUsePostMessage()) {
    gScope.setImmediate = function(fn: () => void) {
      timeouts.push(fn);
      gScope.postMessage(messageName, "*");
    };
    var handleMessage = function(event: MessageEvent) {
      if (event.source === self && event.data === messageName) {
        if (event.stopPropagation) {
          event.stopPropagation();
        } else {
          event.cancelBubble = true;
        }
        if (timeouts.length > 0) {
          var fn = timeouts.shift();
          return fn();
        }
      }
    };
    if (gScope.addEventListener) {
      gScope.addEventListener('message', handleMessage, true);
    } else {
      gScope.attachEvent('onmessage', handleMessage);
    }
  } else if (gScope.MessageChannel) {
    // WebWorker MessageChannel
    var channel = new gScope.MessageChannel();
    channel.port1.onmessage = (event: any) => {
      if (timeouts.length > 0) {
        return timeouts.shift()();
      }
    };
    gScope.setImmediate = (fn: () => void) => {
      timeouts.push(fn);
      channel.port2.postMessage('');
    };
  } else {
    gScope.setImmediate = function(fn: () => void) {
      return setTimeout(fn, 0);
    };
  }
}

// Polyfill for Uint8Array.prototype.slice.
// Safari and some other browsers do not define it.
if (typeof(ArrayBuffer) !== 'undefined' && typeof(Uint8Array) !== 'undefined') {
  if (!Uint8Array.prototype['slice']) {
    Uint8Array.prototype.slice = function(start: number = 0, end: number = this.length): Uint8Array {
      let self: Uint8Array = this;
      if (start < 0) {
        start = this.length + start;
        if (start < 0) {
          start = 0;
        }
      }
      if (end < 0) {
        end = this.length + end;
        if (end < 0) {
          end = 0;
        }
      }
      if (end < start) {
        end = start;
      }
      return new Uint8Array(self.buffer, self.byteOffset + start, end - start);
    };
  }
}

export * from './core/browserfs';
