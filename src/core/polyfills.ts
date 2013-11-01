/**
 * This file installs all of the polyfills that BrowserFS requires.
 */

// IE < 9 does not define this function.
if (!Date.now) {
  Date.now = function now() {
    return new Date().getTime();
  };
}

// IE < 9 does not define this function.
if(!Array.isArray) {
  Array.isArray = function (vArg) {
    return Object.prototype.toString.call(vArg) === "[object Array]";
  };
}

// IE < 9 does not define this function.
// From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys
if (!Object.keys) {
  Object.keys = (function () {
    'use strict';
    var hasOwnProperty = Object.prototype.hasOwnProperty,
        hasDontEnumBug = !({toString: null}).propertyIsEnumerable('toString'),
        dontEnums = [
          'toString',
          'toLocaleString',
          'valueOf',
          'hasOwnProperty',
          'isPrototypeOf',
          'propertyIsEnumerable',
          'constructor'
        ],
        dontEnumsLength = dontEnums.length;

    return function (obj) {
      if (typeof obj !== 'object' && (typeof obj !== 'function' || obj === null)) {
        throw new TypeError('Object.keys called on non-object');
      }

      var result = [], prop, i;

      for (prop in obj) {
        if (hasOwnProperty.call(obj, prop)) {
          result.push(prop);
        }
      }

      if (hasDontEnumBug) {
        for (i = 0; i < dontEnumsLength; i++) {
          if (hasOwnProperty.call(obj, dontEnums[i])) {
            result.push(dontEnums[i]);
          }
        }
      }
      return result;
    };
  }());
}

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

// IE < 9 does not support forEach
if (!Array.prototype.forEach) {
  Array.prototype.forEach = function(fn: (value: string, index: number, array: string[]) => void, scope?: any): void {
    for (var i = 0; i < this.length; ++i) {
      if (i in this) {
        fn.call(scope, this[i], i, this);
      }
    }
  };
}

// Only IE10 has setImmediate.
// @todo: Determine viability of switching to the 'proper' polyfill for this.
if (typeof setImmediate === 'undefined') {
  var timeouts = [];
  var messageName = "zero-timeout-message";
  var canUsePostMessage = function() {
    if (!window.postMessage) {
      return false;
    }
    var postMessageIsAsync = true;
    var oldOnMessage = window.onmessage;
    window.onmessage = function() {
      postMessageIsAsync = false;
    };
    window.postMessage('', '*');
    window.onmessage = oldOnMessage;
    return postMessageIsAsync;
  };
  if (canUsePostMessage()) {
    window['set'+'Immediate'] = function(fn) {
      timeouts.push(fn);
      window.postMessage(messageName, "*");
    };
    var handleMessage = function(event) {
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
    if (window.addEventListener) {
      window.addEventListener('message', handleMessage, true);
    } else {
      window.attachEvent('onmessage', handleMessage);
    }
  } else {
    window['set'+'Immediate'] = function(fn) {
      return setTimeout(fn, 0);
      var scriptEl = window.document.createElement("script");
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

