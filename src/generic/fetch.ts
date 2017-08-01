/**
 * Contains utility methods using 'fetch'.
 */

import {ApiError, ErrorCode} from '../core/api_error';
import {BFSCallback} from '../core/file_system';

/**
 * Asynchronously download a file as a buffer or a JSON object.
 * Note that the third function signature with a non-specialized type is
 * invalid, but TypeScript requires it when you specialize string arguments to
 * constants.
 * @hidden
 */
export function fetchFileAsync(p: string, type: 'buffer', cb: BFSCallback<Buffer>): void;
export function fetchFileAsync(p: string, type: 'json', cb: BFSCallback<any>): void;
export function fetchFileAsync(p: string, type: string, cb: BFSCallback<any>): void;
export function fetchFileAsync(p: string, type: string, cb: BFSCallback<any>): void {
  fetch(p)
    .then((res) => {
      if (!res.ok) {
        return cb(new ApiError(res.status, "fetch error."));
      } else {
        switch (type) {
          case 'buffer':
            res.arrayBuffer()
              .then((buf) => cb(null, Buffer.from(buf)))
              .catch((err) => cb(new ApiError(0, err.message)));
            break;
          case 'json':
            res.json()
              .then((json) => cb(null, json))
              .catch((err) => cb(new ApiError(0, err.message)));
            break;
          default:
            throw new ApiError(ErrorCode.EINVAL, "Invalid download type: " + type);
        }
      }
    })
    .catch((err) => cb(new ApiError(0, err.message)));
}

/**
 * Asynchronously retrieves the size of the given file in bytes.
 * @hidden
 */
export function fetchFileSizeAsync(p: string, cb: BFSCallback<number>): void {
  fetch(p, { method: 'HEAD' })
    .then((res) => {
      if (!res.ok) {
        return cb(new ApiError(res.status, "fetch HEAD error."));
      } else {
        return cb(null, parseInt(res.headers.get('Content-Length') || '-1', 10));
      }
    })
    .catch((err) => cb(new ApiError(0, err.message)));
}
