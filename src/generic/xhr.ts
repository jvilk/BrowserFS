/**
 * Contains utility methods for performing a variety of tasks with
 * XmlHttpRequest across browsers.
 */

import util = require('../core/util');
import buffer = require('../core/buffer');
import api_error = require('../core/api_error');

var ApiError = api_error.ApiError;
var ErrorCode = api_error.ErrorCode;
var Buffer = buffer.Buffer;

// See core/polyfills for the VBScript definition of these functions.
declare var IEBinaryToArray_ByteStr: (vbarr: any) => string;
declare var IEBinaryToArray_ByteStr_Last: (vbarr: any) => string;
// Converts 'responseBody' in IE into the equivalent 'responseText' that other
// browsers would generate.
function getIEByteArray(IEByteArray: any): number[] {
  var rawBytes = IEBinaryToArray_ByteStr(IEByteArray);
  var lastChr = IEBinaryToArray_ByteStr_Last(IEByteArray);
  var data_str = rawBytes.replace(/[\s\S]/g, function(match) {
    var v = match.charCodeAt(0)
    return String.fromCharCode(v&0xff, v>>8)
  }) + lastChr;
  var data_array = new Array(data_str.length);
  for (var i = 0; i < data_str.length; i++) {
    data_array[i] = data_str.charCodeAt(i);
  }
  return data_array;
}

function downloadFileIE(async: boolean, p: string, type: string, cb: (err: api_error.ApiError, data?: any) => void): void {
  switch(type) {
    case 'buffer':
      // Fallthrough
    case 'json':
      break;
    default:
      return cb(new ApiError(ErrorCode.EINVAL, "Invalid download type: " + type));
  }

  var req = new XMLHttpRequest();
  req.open('GET', p, async);
  req.setRequestHeader("Accept-Charset", "x-user-defined");
  req.onreadystatechange = function(e) {
    var data_array;
    if (req.readyState === 4) {
      if (req.status === 200) {
        switch(type) {
          case 'buffer':
            data_array = getIEByteArray(req.responseBody);
            return cb(null, new Buffer(data_array));
          case 'json':
            return cb(null, JSON.parse(req.responseText));
        }
      } else {
        return cb(new ApiError(req.status, "XHR error."));
      }
    }
  };
  req.send();
}

function asyncDownloadFileIE(p: string, type: 'buffer', cb: (err: api_error.ApiError, data?: NodeBuffer) => void): void;
function asyncDownloadFileIE(p: string, type: 'json', cb: (err: api_error.ApiError, data?: any) => void): void;
function asyncDownloadFileIE(p: string, type: string, cb: (err: api_error.ApiError, data?: any) => void): void;
function asyncDownloadFileIE(p: string, type: string, cb: (err: api_error.ApiError, data?: any) => void): void {
  downloadFileIE(true, p, type, cb);
}

function syncDownloadFileIE(p: string, type: 'buffer'): NodeBuffer;
function syncDownloadFileIE(p: string, type: 'json'): any;
function syncDownloadFileIE(p: string, type: string): any;
function syncDownloadFileIE(p: string, type: string): any {
  var rv;
  downloadFileIE(false, p, type, function(err: api_error.ApiError, data?: any) {
    if (err) throw err;
    rv = data;
  });
  return rv;
}

function asyncDownloadFileModern(p: string, type: 'buffer', cb: (err: api_error.ApiError, data?: NodeBuffer) => void): void;
function asyncDownloadFileModern(p: string, type: 'json', cb: (err: api_error.ApiError, data?: any) => void): void;
function asyncDownloadFileModern(p: string, type: string, cb: (err: api_error.ApiError, data?: any) => void): void;
function asyncDownloadFileModern(p: string, type: string, cb: (err: api_error.ApiError, data?: any) => void): void {
  var req = new XMLHttpRequest();
  req.open('GET', p, true);
  var jsonSupported = true;
  switch(type) {
    case 'buffer':
      req.responseType = 'arraybuffer';
      break;
    case 'json':
     // Some browsers don't support the JSON response type.
     // They either reset responseType, or throw an exception.
     // @see https://github.com/Modernizr/Modernizr/blob/master/src/testXhrType.js
      try {
        req.responseType = 'json';
        jsonSupported = req.responseType === 'json';
      } catch (e) {
        jsonSupported = false;
      }
      break;
    default:
      return cb(new ApiError(ErrorCode.EINVAL, "Invalid download type: " + type));
  }
  req.onreadystatechange = function(e) {
    if (req.readyState === 4) {
      if (req.status === 200) {
        switch(type) {
          case 'buffer':
            // XXX: WebKit-based browsers return *null* when XHRing an empty file.
            return cb(null, new Buffer(req.response ? req.response : 0));
          case 'json':
            if (jsonSupported) {
              return cb(null, req.response);
            } else {
              return cb(null, JSON.parse(req.responseText));
            }
        }
      } else {
        return cb(new ApiError(req.status, "XHR error."));
      }
    }
  };
  req.send();
}

function syncDownloadFileModern(p: string, type: 'buffer'): NodeBuffer;
function syncDownloadFileModern(p: string, type: 'json'): any;
function syncDownloadFileModern(p: string, type: string): any;
function syncDownloadFileModern(p: string, type: string): any {
  var req = new XMLHttpRequest();
  req.open('GET', p, false);

  // On most platforms, we cannot set the responseType of synchronous downloads.
  // @todo Test for this; IE10 allows this, as do older versions of Chrome/FF.
  var data = null;
  var err = null;
  // Classic hack to download binary data as a string.
  req.overrideMimeType('text/plain; charset=x-user-defined');
  req.onreadystatechange = function(e) {
    if (req.readyState === 4) {
      if (req.status === 200) {
        switch(type) {
          case 'buffer':
            // Convert the text into a buffer.
            var text = req.responseText;
            data = new Buffer(text.length);
            // Throw away the upper bits of each character.
            for (var i = 0; i < text.length; i++) {
              // This will automatically throw away the upper bit of each
              // character for us.
              data.writeUInt8(text.charCodeAt(i), i);
            }
            return;
          case 'json':
            data = JSON.parse(req.responseText);
            return;
        }
      } else {
        err = new ApiError(req.status, "XHR error.");
        return;
      }
    }
  };
  req.send();
  if (err) {
    throw err;
  }
  return data;
}

/**
 * IE10 allows us to perform synchronous binary file downloads.
 * @todo Feature detect this, as older versions of FF/Chrome do too!
 */
function syncDownloadFileIE10(p: string, type: 'buffer'): NodeBuffer;
function syncDownloadFileIE10(p: string, type: 'json'): any;
function syncDownloadFileIE10(p: string, type: string): any;
function syncDownloadFileIE10(p: string, type: string): any {
  var req = new XMLHttpRequest();
  req.open('GET', p, false);
  switch(type) {
    case 'buffer':
      req.responseType = 'arraybuffer';
      break;
    case 'json':
      // IE10 does not support the JSON type.
      break;
    default:
      throw new ApiError(ErrorCode.EINVAL, "Invalid download type: " + type);
  }
  var data;
  var err;
  req.onreadystatechange = function(e) {
    if (req.readyState === 4) {
      if (req.status === 200) {
        switch(type) {
          case 'buffer':
            data = new Buffer(req.response);
            break;
          case 'json':
            data = JSON.parse(req.response);
            break;
        }
      } else {
        err = new ApiError(req.status, "XHR error.");
      }
    }
  };
  req.send();
  if (err) {
    throw err;
  }
  return data;
}

function getFileSize(async: boolean, p: string, cb: (err: api_error.ApiError, size?: number) => void): void {
  var req = new XMLHttpRequest();
  req.open('HEAD', p, async);
  req.onreadystatechange = function(e) {
    if (req.readyState === 4) {
      if (req.status == 200) {
        try {
          return cb(null, parseInt(req.getResponseHeader('Content-Length'), 10));
        } catch(e) {
          // In the event that the header isn't present or there is an error...
          return cb(new ApiError(ErrorCode.EIO, "XHR HEAD error: Could not read content-length."));
        }
      } else {
        return cb(new ApiError(req.status, "XHR HEAD error."));
      }
    }
  };
  req.send();
}

/**
 * Asynchronously download a file as a buffer or a JSON object.
 * Note that the third function signature with a non-specialized type is
 * invalid, but TypeScript requires it when you specialize string arguments to
 * constants.
 */
export var asyncDownloadFile: {
  (p: string, type: 'buffer', cb: (err: api_error.ApiError, data?: NodeBuffer) => void): void;
  (p: string, type: 'json', cb: (err: api_error.ApiError, data?: any) => void): void;
  (p: string, type: string, cb: (err: api_error.ApiError, data?: any) => void): void;
} = (util.isIE && typeof Blob === 'undefined') ? asyncDownloadFileIE : asyncDownloadFileModern;

/**
 * Synchronously download a file as a buffer or a JSON object.
 * Note that the third function signature with a non-specialized type is
 * invalid, but TypeScript requires it when you specialize string arguments to
 * constants.
 */
export var syncDownloadFile: {
  (p: string, type: 'buffer'): NodeBuffer;
  (p: string, type: 'json'): any;
  (p: string, type: string): any;
} = (util.isIE && typeof Blob === 'undefined') ? syncDownloadFileIE : (util.isIE && typeof Blob !== 'undefined') ? syncDownloadFileIE10 : syncDownloadFileModern;

/**
 * Synchronously retrieves the size of the given file in bytes.
 */
export function getFileSizeSync(p: string): number {
  var rv: number;
  getFileSize(false, p, function(err: api_error.ApiError, size?: number) {
    if (err) {
      throw err;
    }
    rv = size;
  });
  return rv;
}

/**
 * Asynchronously retrieves the size of the given file in bytes.
 */
export function getFileSizeAsync(p: string, cb: (err: api_error.ApiError, size?: number) => void): void {
  getFileSize(true, p, cb);
}
