import kvfs = require('../generic/key_value_filesystem');
import {ApiError, ErrorCode} from '../core/api_error';
import global = require('../core/global');

// Some versions of FF and all versions of IE do not support the full range of
// 16-bit numbers encoded as characters, as they enforce UTF-16 restrictions.
// http://stackoverflow.com/questions/11170716/are-there-any-characters-that-are-not-allowed-in-localstorage/11173673#11173673
var supportsBinaryString: boolean = false,
  binaryEncoding: string;
try {
  global.localStorage.setItem("__test__", String.fromCharCode(0xD800));
  supportsBinaryString = global.localStorage.getItem("__test__") === String.fromCharCode(0xD800);
} catch (e) {
  // IE throws an exception.
  supportsBinaryString = false;
}
binaryEncoding = supportsBinaryString ? 'binary_string' : 'binary_string_ie';
if (!Buffer.isEncoding(binaryEncoding)) {
  // Fallback for non BrowserFS implementations of buffer that lack a
  // binary_string format.
  binaryEncoding = "base64";
}

/**
 * A synchronous key-value store backed by localStorage.
 */
export class LocalStorageStore implements kvfs.SyncKeyValueStore, kvfs.SimpleSyncStore {
  constructor() { }

  public name(): string {
    return 'LocalStorage';
  }

  public clear(): void {
    global.localStorage.clear();
  }

  public beginTransaction(type: string): kvfs.SyncKeyValueRWTransaction {
    // No need to differentiate.
    return new kvfs.SimpleSyncRWTransaction(this);
  }

  public get(key: string): NodeBuffer {
    try {
      var data = global.localStorage.getItem(key);
      if (data !== null) {
        return new Buffer(data, binaryEncoding);
      }
    } catch (e) {

    }
    // Key doesn't exist, or a failure occurred.
    return undefined;
  }

  public put(key: string, data: NodeBuffer, overwrite: boolean): boolean {
    try {
      if (!overwrite && global.localStorage.getItem(key) !== null) {
        // Don't want to overwrite the key!
        return false;
      }
      global.localStorage.setItem(key, data.toString(binaryEncoding));
      return true;
    } catch (e) {
      throw new ApiError(ErrorCode.ENOSPC, "LocalStorage is full.");
    }
  }

  public del(key: string): void {
    try {
      global.localStorage.removeItem(key);
    } catch (e) {
      throw new ApiError(ErrorCode.EIO, "Unable to delete key " + key + ": " + e);
    }
  }
}

/**
 * A synchronous file system backed by localStorage. Connects our
 * LocalStorageStore to our SyncKeyValueFileSystem.
 */
export default class LocalStorageFileSystem extends kvfs.SyncKeyValueFileSystem {
  constructor() { super({ store: new LocalStorageStore() }); }
  public static isAvailable(): boolean {
    return typeof global.localStorage !== 'undefined';
  }
}
