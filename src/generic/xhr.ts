/**
 * Contains utility methods for performing a variety of tasks with
 * XmlHttpRequest across browsers.
 */

import {isIE} from '../core/util';
import {ApiError, ErrorCode} from '../core/api_error';

function asyncDownloadFileModern(p: string, type: 'buffer', cb: (err: ApiError, data?: Buffer) => void): void;
function asyncDownloadFileModern(p: string, type: 'json', cb: (err: ApiError, data?: any) => void): void;
function asyncDownloadFileModern(p: string, type: string, cb: (err: ApiError, data?: any) => void): void;
function asyncDownloadFileModern(p: string, type: string, cb: (err: ApiError, data?: any) => void): void {
  let req = new XMLHttpRequest();
  req.open('GET', p, true);
  let jsonSupported = true;
  switch (type) {
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
        switch (type) {
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

function syncDownloadFileModern(p: string, type: 'buffer'): Buffer;
function syncDownloadFileModern(p: string, type: 'json'): any;
function syncDownloadFileModern(p: string, type: string): any;
function syncDownloadFileModern(p: string, type: string): any {
  let req = new XMLHttpRequest();
  req.open('GET', p, false);

  // On most platforms, we cannot set the responseType of synchronous downloads.
  // @todo Test for this; IE10 allows this, as do older versions of Chrome/FF.
  let data: any = null;
  let err: any = null;
  // Classic hack to download binary data as a string.
  req.overrideMimeType('text/plain; charset=x-user-defined');
  req.onreadystatechange = function(e) {
    if (req.readyState === 4) {
      if (req.status === 200) {
        switch (type) {
          case 'buffer':
            // Convert the text into a buffer.
            let text = req.responseText;
            data = new Buffer(text.length);
            // Throw away the upper bits of each character.
            for (let i = 0; i < text.length; i++) {
              // This will automatically throw away the upper bit of each
              // character for us.
              data[i] = text.charCodeAt(i);
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
function syncDownloadFileIE10(p: string, type: 'buffer'): Buffer;
function syncDownloadFileIE10(p: string, type: 'json'): any;
function syncDownloadFileIE10(p: string, type: string): any;
function syncDownloadFileIE10(p: string, type: string): any {
  let req = new XMLHttpRequest();
  req.open('GET', p, false);
  switch (type) {
    case 'buffer':
      req.responseType = 'arraybuffer';
      break;
    case 'json':
      // IE10 does not support the JSON type.
      break;
    default:
      throw new ApiError(ErrorCode.EINVAL, "Invalid download type: " + type);
  }
  let data: any;
  let err: any;
  req.onreadystatechange = function(e) {
    if (req.readyState === 4) {
      if (req.status === 200) {
        switch (type) {
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

function getFileSize(async: boolean, p: string, cb: (err: ApiError, size?: number) => void): void {
  let req = new XMLHttpRequest();
  req.open('HEAD', p, async);
  req.onreadystatechange = function(e) {
    if (req.readyState === 4) {
      if (req.status === 200) {
        try {
          return cb(null, parseInt(req.getResponseHeader('Content-Length') || '-1', 10));
        } catch (e) {
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
export let asyncDownloadFile: {
  (p: string, type: 'buffer', cb: (err: ApiError, data?: Buffer) => void): void;
  (p: string, type: 'json', cb: (err: ApiError, data?: any) => void): void;
  (p: string, type: string, cb: (err: ApiError, data?: any) => void): void;
} = asyncDownloadFileModern;

/**
 * Synchronously download a file as a buffer or a JSON object.
 * Note that the third function signature with a non-specialized type is
 * invalid, but TypeScript requires it when you specialize string arguments to
 * constants.
 */
export let syncDownloadFile: {
  (p: string, type: 'buffer'): Buffer;
  (p: string, type: 'json'): any;
  (p: string, type: string): any;
} = (isIE && typeof Blob !== 'undefined') ? syncDownloadFileIE10 : syncDownloadFileModern;

/**
 * Synchronously retrieves the size of the given file in bytes.
 */
export function getFileSizeSync(p: string): number {
  let rv: number;
  getFileSize(false, p, function(err: ApiError, size?: number) {
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
export function getFileSizeAsync(p: string, cb: (err: ApiError, size?: number) => void): void {
  getFileSize(true, p, cb);
}
