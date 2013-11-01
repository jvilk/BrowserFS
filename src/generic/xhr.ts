/**
 * Contains utility methods for performing a variety of tasks with
 * XmlHttpRequest across browsers.
 */

import util = require('../core/util');
import buffer = require('../core/buffer');
import api_error = require('../core/api_error');

var ApiError = api_error.ApiError;
var ErrorType = api_error.ErrorType;
var Buffer = buffer.Buffer;

/**
 * IE9 and below only: Injects a VBScript function that converts the
 * 'responseBody' attribute of an XMLHttpRequest into a bytestring.
 * From ExtJS: http://docs-origin.sencha.com/extjs/4.1.3/source/Connection.html
 *
 * NOTE: We *must* perform this check, as document.write causes a full page
 *       reload in Firefox, and does something bizarre in Chrome/Safari that
 *       causes all of our unit tests to fail.
 */
if (util.isIE) {
  document.write("<!-- IEBinaryToArray_ByteStr -->\r\n" +
    "<script type='text/vbscript'>\r\n" +
    "Function getIEByteArray(byteArray, out)\r\n" +
    "  Dim len, i\r\n" + "  len = LenB(byteArray)\r\n" +
    "  For i = 1 to len\r\n" +
    "    out.push(AscB(MidB(byteArray, i, 1)))\r\n" +
    "  Next\r\n" +
    "End Function\r\n" +
    "</script>\r\n");
}
declare var getIEByteArray: (vbarr: any, arr: number[]) => void;

function downloadFileIE(async: boolean, p: string, type: string, cb: (err: api_error.ApiError, data?: any) => void): void {
  switch(type) {
    case 'buffer':
      // Fallthrough
    case 'json':
      break;
    default:
      return cb(new ApiError(ErrorType.INVALID_PARAM, "Invalid download type: " + type));
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
            getIEByteArray(req.responseBody, data_array = []);
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

function asyncDownloadFileIE(p: string, type: 'buffer', cb: (err: api_error.ApiError, data?: buffer.Buffer) => void): void;
function asyncDownloadFileIE(p: string, type: 'json', cb: (err: api_error.ApiError, data?: any) => void): void;
function asyncDownloadFileIE(p: string, type: string, cb: (err: api_error.ApiError, data?: any) => void): void;
function asyncDownloadFileIE(p: string, type: string, cb: (err: api_error.ApiError, data?: any) => void): void {
  downloadFileIE(true, p, type, cb);
}

function syncDownloadFileIE(p: string, type: 'buffer'): buffer.Buffer;
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

function asyncDownloadFileModern(p: string, type: 'buffer', cb: (err: api_error.ApiError, data?: buffer.Buffer) => void): void;
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
      return cb(new ApiError(ErrorType.INVALID_PARAM, "Invalid download type: " + type));
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

function syncDownloadFileModern(p: string, type: 'buffer'): buffer.Buffer;
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
              data.set(i, text.charCodeAt(i) & 0xff);
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
 * Asynchronously download a file as a buffer or a JSON object.
 * Note that the third function signature with a non-specialized type is
 * invalid, but TypeScript requires it when you specialize string arguments to
 * constants.
 */
export var asyncDownloadFile: {
  (p: string, type: 'buffer', cb: (err: api_error.ApiError, data?: buffer.Buffer) => void): void;
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
  (p: string, type: 'buffer'): buffer.Buffer;
  (p: string, type: 'json'): any;
  (p: string, type: string): any;
} = (util.isIE && typeof Blob === 'undefined') ? syncDownloadFileIE : syncDownloadFileModern;
