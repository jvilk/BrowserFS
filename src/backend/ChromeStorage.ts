import {BFSOneArgCallback, BFSCallback, FileSystemOptions} from '../core/file_system';
import {AsyncKeyValueROTransaction, AsyncKeyValueRWTransaction, AsyncKeyValueStore, AsyncKeyValueFileSystem} from '../generic/key_value_filesystem';
import {ApiError, ErrorCode} from '../core/api_error';
import global from '../core/global';

/**
 * Get the chrome global.
 * @hidden
 */
const chrome = global.chrome;

/**
 * Converts a chrome runtime error into a
 * standardized BrowserFS API error.
 * @hidden
 */
function convertError(e: {message: string}): ApiError {
  switch (e.message) {
    // case "NotFoundError":
    //   return new ApiError(ErrorCode.ENOENT, message);
    // case "QuotaExceededError":
    //   return new ApiError(ErrorCode.ENOSPC, message);
    default:
      // The rest do not seem to map cleanly to standard error codes.
      return new ApiError(ErrorCode.EIO, e.message);
  }
}

/**
 * @hidden
 */
export class ChromeStorageROTransaction implements AsyncKeyValueROTransaction {
  constructor(public store: ChromeStore) {
    this.store = store;
  }

  public get(key: string, cb: BFSCallback<Buffer>): void {
    chrome.storage[this.store.storeType].get([key], (result: any) => {
      if (result && result[key]) {
        cb(null, Buffer.from(result[key], 'base64'));
      } else if (chrome.runtime.lastError) {
        cb(convertError(chrome.runtime.lastError));
      } else {
        cb(null, undefined);
      }
    });
  }
}

/**
 * @hidden
 */
export class ChromeStorageRWTransaction extends ChromeStorageROTransaction implements AsyncKeyValueRWTransaction, AsyncKeyValueROTransaction {
  constructor(store: ChromeStore) {
    super(store);
  }

  public _put(key: string, data: Buffer, cb: BFSCallback<boolean>): void {
    const obj = {} as any;
    obj[key] = data.toString('base64');
    chrome.storage[this.store.storeType].set(obj, () => {
      if (chrome.runtime.lastError) {
        cb(convertError(chrome.runtime.lastError));
      } else {
        cb(null, true);
      }
    });
  }

  public put(key: string, data: Buffer, overwrite: boolean, cb: BFSCallback<boolean>): void {
    if (overwrite) {
      this._put(key, data, cb);
    } else {
      this.get(key, (err, l) => {
        if (err || typeof l === 'undefined' || !l.hasOwnProperty(key)) {
          this._put(key, data, cb);
        } else {
          cb(null, false);
        }
      });
    }
  }

  public del(key: string, cb: BFSOneArgCallback): void {
    chrome.storage[this.store.storeType].remove(key, () => {
      if (chrome.runtime.lastError) {
        cb(convertError(chrome.runtime.lastError));
      } else {
        cb();
      }
    });
  }

  public commit(cb: BFSOneArgCallback): void {
    // Return to the event loop to commit the transaction.
    setTimeout(cb, 0);
  }

  public abort(cb: BFSOneArgCallback): void {
    setTimeout(cb, 0);
  }
}

export class ChromeStore implements AsyncKeyValueStore {

  constructor(cb: BFSCallback<ChromeStore>, public storeType: string = 'local') {
    setTimeout(() => {
      cb(null, this);
    }, 0);
  }

  public name(): string {
    return ChromeStorageFileSystem.Name + " - " + this.storeType;
  }

  public clear(cb: BFSOneArgCallback): void {
    try {
      chrome.storage[this.storeType].clear();
    } catch (e) {
      cb(convertError(e));
    }
  }

  public beginTransaction(type: 'readonly'): AsyncKeyValueROTransaction;
  public beginTransaction(type: 'readwrite'): AsyncKeyValueRWTransaction;
  public beginTransaction(type: string = 'readonly'): AsyncKeyValueROTransaction {
    if (type === 'readwrite') {
      return new ChromeStorageRWTransaction(this);
    } else if (type === 'readonly') {
      return new ChromeStorageROTransaction(this);
    } else {
      throw new ApiError(ErrorCode.EINVAL, 'Invalid transaction type.');
    }
  }
}

/**
 * Configuration options for the chrome storage file system.
 */
export interface ChromeStorageFileSystemOptions {
  // The storage type, options are 'local' or 'sync'
  storeType?: string;
  // The size of the inode cache. Defaults to 100. A size of 0 or below disables caching.
  cacheSize?: number;
}

/**
 * A file system that uses the chrome.storage key value file system.
 */
export default class ChromeStorageFileSystem extends AsyncKeyValueFileSystem {
  public static readonly Name = "ChromeStorage";

  public static readonly Options: FileSystemOptions = {
    storeType: {
      type: "string",
      optional: true,
      description: "The storage type, options are 'local' or 'sync'."
    },
    cacheSize: {
      type: "number",
      optional: true,
      description: "The size of the inode cache. Defaults to 100. A size of 0 or below disables caching."
    }
  };

  /**
   * Constructs a ChromeStorage file system with the given options.
   */
  public static Create(opts: ChromeStorageFileSystemOptions, cb: BFSCallback<ChromeStorageFileSystem>): void {
    const store = new ChromeStore((e): void => {
      if (e) {
        cb(e);
      } else {
        const cfs = new ChromeStorageFileSystem(typeof(opts.cacheSize) === 'number' ? opts.cacheSize : 100);
        cfs.init(store, (e?) => {
          cb(e, cfs);
        });
      }
    }, opts.storeType);
  }

  private constructor(cacheSize: number) {
    super(cacheSize);
  }
}
