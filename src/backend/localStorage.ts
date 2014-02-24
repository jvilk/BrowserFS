import buffer = require('../core/buffer');
import browserfs = require('../core/browserfs');
import kvfs = require('../generic/key_value_filesystem');
import api_error = require('../core/api_error');

var Buffer = buffer.Buffer,
  ApiError = api_error.ApiError,
  ErrorCode = api_error.ErrorCode;

// Some versions of FF and all versions of IE do not support the full range of
// 16-bit numbers encoded as characters, as they enforce UTF-16 restrictions.
// http://stackoverflow.com/questions/11170716/are-there-any-characters-that-are-not-allowed-in-localstorage/11173673#11173673
var supportsBinaryString: boolean = false,
  binaryEncoding: string;
try {
  window.localStorage.setItem("__test__", String.fromCharCode(0xD800));
  supportsBinaryString = window.localStorage.getItem("__test__") === String.fromCharCode(0xD800);
} catch (e) {
  // IE throws an exception.
  supportsBinaryString = false;
}
binaryEncoding = supportsBinaryString ? 'binary_string' : 'binary_string_ie';

/**
 * Encapsulates a single transaction. Has the ability to roll back
 * modifications that occur during a transaction.
 */
export class LocalStorageRWTransaction implements kvfs.SyncKeyValueRWTransaction {
  /**
   * Stores data in the keys we modify prior to modifying them.
   * Allows us to roll back commits.
   */
  private originalData: { [key: string]: string } = {};
  /**
   * List of keys modified in this transaction, if any.
   */
  private modifiedKeys: string[] = [];
  /**
   * Stashes the key value into `originalData` prior to mutation.
   */
  private stashOldValue(key: string) {
    // Keep only the earliest value in the transaction.
    if (!this.originalData[key]) {
      this.originalData[key] = window.localStorage.getItem(key);
      this.modifiedKeys.push(key);
    }
  }

  public get(key: string): NodeBuffer {
    try {
      var data = window.localStorage.getItem(key);
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
      if (!overwrite && window.localStorage.getItem(key) !== null) {
        // Don't want to overwrite the key!
        return false;
      }
      this.stashOldValue(key);
      window.localStorage.setItem(key, data.toString(binaryEncoding));
      return true;
    } catch (e) {
      throw new ApiError(ErrorCode.ENOSPC, "LocalStorage is full.");
    }
  }

  public delete(key: string): void {
    try {
      this.stashOldValue(key);
      window.localStorage.removeItem(key);
    } catch (e) {
      throw new ApiError(ErrorCode.EIO, "Unable to delete key " + key + ": " + e);
    }
  }

  public commit(): void {/* NOP */}
  public abort(): void {
    // Rollback old values.
    var i: number, key: string, value: string;
    for (i = 0; i < this.modifiedKeys.length; i++) {
      key = this.modifiedKeys[i];
      value = this.originalData[key];
      if (value === null) {
        // Key didn't exist.
        window.localStorage.removeItem(key);
      } else {
        // Key existed. Store old value.
        window.localStorage.setItem(key, this.originalData[key]);
      }
    }
  }
}

/**
 * A synchronous key-value store backed by localStorage.
 */
export class LocalStorageStore implements kvfs.SyncKeyValueStore {
  constructor() { }

  public name(): string {
    return 'LocalStorage';
  }

  public clear(): void {
    window.localStorage.clear();
  }

  public beginTransaction(type: string): kvfs.SyncKeyValueRWTransaction {
    // No need to differentiate.
    return new LocalStorageRWTransaction();
  }
}

/**
 * A synchronous file system backed by localStorage. Connects our
 * LocalStorageStore to our SyncKeyValueFileSystem.
 */
export class LocalStorageFileSystem extends kvfs.SyncKeyValueFileSystem {
  constructor() { super({ store: new LocalStorageStore() }); }
  public static isAvailable(): boolean {
    return typeof window.localStorage !== 'undefined';
  }
}

browserfs.registerFileSystem('LocalStorage', LocalStorageFileSystem);
