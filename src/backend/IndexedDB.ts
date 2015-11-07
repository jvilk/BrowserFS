import kvfs = require('../generic/key_value_filesystem');
import {ApiError, ErrorCode} from '../core/api_error';
import global = require('../core/global');
import {arrayBuffer2Buffer, buffer2ArrayBuffer} from '../core/util';
/**
 * Get the indexedDB constructor for the current browser.
 */
var indexedDB: IDBFactory = global.indexedDB ||
                          (<any>global).mozIndexedDB ||
                          (<any>global).webkitIndexedDB ||
                          global.msIndexedDB;

/**
 * Converts a DOMException or a DOMError from an IndexedDB event into a
 * standardized BrowserFS API error.
 */
function convertError(e: {name: string}, message: string = e.toString()): ApiError {
  switch(e.name) {
    case "NotFoundError":
      return new ApiError(ErrorCode.ENOENT, message);
    case "QuotaExceededError":
      return new ApiError(ErrorCode.ENOSPC, message);
    default:
      // The rest do not seem to map cleanly to standard error codes.
      return new ApiError(ErrorCode.EIO, message);
  }
}

/**
 * Produces a new onerror handler for IDB. Our errors are always fatal, so we
 * handle them generically: Call the user-supplied callback with a translated
 * version of the error, and let the error bubble up.
 */
function onErrorHandler(cb: (e: ApiError) => void,
  code: ErrorCode = ErrorCode.EIO, message: string = null): (e?: any) => void {
  return function (e?: any): void {
    // Prevent the error from canceling the transaction.
    e.preventDefault();
    cb(new ApiError(code, message));
  };
}

export class IndexedDBROTransaction implements kvfs.AsyncKeyValueROTransaction {
  constructor(public tx: IDBTransaction, public store: IDBObjectStore) { }

  get(key: string, cb: (e: ApiError, data?: NodeBuffer) => void): void {
    try {
      var r: IDBRequest = this.store.get(key);
      r.onerror = onErrorHandler(cb);
      r.onsuccess = (event) => {
        // IDB returns the value 'undefined' when you try to get keys that
        // don't exist. The caller expects this behavior.
        var result: any = (<any>event.target).result;
        if (result === undefined) {
          cb(null, result);
        } else {
          // IDB data is stored as an ArrayBuffer
          cb(null, arrayBuffer2Buffer(result));
        }
      };
    } catch (e) {
      cb(convertError(e));
    }
  }
}

export class IndexedDBRWTransaction extends IndexedDBROTransaction implements kvfs.AsyncKeyValueRWTransaction, kvfs.AsyncKeyValueROTransaction {
  constructor(tx: IDBTransaction, store: IDBObjectStore) {
    super(tx, store);
  }

  public put(key: string, data: NodeBuffer, overwrite: boolean, cb: (e: ApiError, committed?: boolean) => void): void {
    try {
      var arraybuffer = buffer2ArrayBuffer(data),
        r: IDBRequest;
      if (overwrite) {
        r = this.store.put(arraybuffer, key);
      } else {
        // 'add' will never overwrite an existing key.
        r = this.store.add(arraybuffer, key);
      }
      // XXX: NEED TO RETURN FALSE WHEN ADD HAS A KEY CONFLICT. NO ERROR.
      r.onerror = onErrorHandler(cb);
      r.onsuccess = (event) => {
        cb(null, true);
      };
    } catch (e) {
      cb(convertError(e));
    }
  }

  public del(key: string, cb: (e?: ApiError) => void): void {
    try {
      // NOTE: IE8 has a bug with identifiers named 'delete' unless used as a string
      // like this.
      // http://stackoverflow.com/a/26479152
      var r: IDBRequest = this.store['delete'](key);
      r.onerror = onErrorHandler(cb);
      r.onsuccess = (event) => {
        cb();
      };
    } catch (e) {
      cb(convertError(e));
    }
  }

  public commit(cb: (e?: ApiError) => void): void {
    // Return to the event loop to commit the transaction.
    setTimeout(cb, 0);
  }

  public abort(cb: (e?: ApiError) => void): void {
    var _e: ApiError;
    try {
      this.tx.abort();
    } catch (e) {
      _e = convertError(e);
    } finally {
      cb(_e);
    }
  }
}

export class IndexedDBStore implements kvfs.AsyncKeyValueStore {
  private db: IDBDatabase;

  /**
   * Constructs an IndexedDB file system.
   * @param cb Called once the database is instantiated and ready for use.
   *   Passes an error if there was an issue instantiating the database.
   * @param objectStoreName The name of this file system. You can have
   *   multiple IndexedDB file systems operating at once, but each must have
   *   a different name.
   */
  constructor(cb: (e: ApiError, store?: IndexedDBStore) => void, private storeName: string = 'browserfs') {
    var openReq: IDBOpenDBRequest = indexedDB.open(this.storeName, 1);

    openReq.onupgradeneeded = (event) => {
      var db: IDBDatabase = (<any>event.target).result;
      // Huh. This should never happen; we're at version 1. Why does another
      // database exist?
      if (db.objectStoreNames.contains(this.storeName)) {
        db.deleteObjectStore(this.storeName);
      }
      db.createObjectStore(this.storeName);
    };

    openReq.onsuccess = (event) => {
      this.db = (<any>event.target).result;
      cb(null, this);
    };

    openReq.onerror = onErrorHandler(cb, ErrorCode.EACCES);
  }

  public name(): string {
    return "IndexedDB - " + this.storeName;
  }

  public clear(cb: (e?: ApiError) => void): void {
    try {
      var tx = this.db.transaction(this.storeName, 'readwrite'),
        objectStore = tx.objectStore(this.storeName),
        r: IDBRequest = objectStore.clear();
      r.onsuccess = (event) => {
        // Use setTimeout to commit transaction.
        setTimeout(cb, 0);
      };
      r.onerror = onErrorHandler(cb);
    } catch (e) {
      cb(convertError(e));
    }
  }

  public beginTransaction(type: string = 'readonly'): kvfs.AsyncKeyValueROTransaction {
    var tx = this.db.transaction(this.storeName, type),
      objectStore = tx.objectStore(this.storeName);
    if (type === 'readwrite') {
      return new IndexedDBRWTransaction(tx, objectStore);
    } else if (type === 'readonly') {
      return new IndexedDBROTransaction(tx, objectStore);
    } else {
      throw new ApiError(ErrorCode.EINVAL, 'Invalid transaction type.');
    }
  }
}

/**
 * A file system that uses the IndexedDB key value file system.
 */
export default class IndexedDBFileSystem extends kvfs.AsyncKeyValueFileSystem {
  constructor(cb: (e: ApiError, fs?: IndexedDBFileSystem) => void, storeName?: string) {
    super();
    new IndexedDBStore((e, store?): void => {
      if (e) {
        cb(e);
      } else {
        this.init(store, (e?) => {
          cb(e, this);
        });
      }
    }, storeName);
  }

  public static isAvailable(): boolean {
    // In Safari's private browsing mode, indexedDB.open returns NULL.
    // In Firefox, it throws an exception.
    // In Chrome, it "just works", and clears the database when you leave the page.
    // Untested: Opera, IE.
    try {
      return typeof indexedDB !== 'undefined' && null !== indexedDB.open("__browserfs_test__");
    } catch (e) {
      return false;
    }
  }
}
