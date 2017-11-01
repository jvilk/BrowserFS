import {BFSOneArgCallback, BFSCallback, FileSystemOptions} from '../core/file_system';
import {AsyncKeyValueROTransaction, AsyncKeyValueRWTransaction, AsyncKeyValueStore, AsyncKeyValueFileSystem} from '../generic/key_value_filesystem';
import {ApiError, ErrorCode} from '../core/api_error';
import global from '../core/global';
import {arrayBuffer2Buffer, buffer2ArrayBuffer} from '../core/util';

/**
 * Converts a DOMException or a DOMError from an Cache event into a
 * standardized BrowserFS API error.
 * @hidden
 */
function convertError(e: {name: string}, message: string = e.toString()): ApiError {
  switch (e.name) {
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
 * @hidden
 */
export class CacheStorageROTransaction implements AsyncKeyValueROTransaction {
  constructor(public store: Cache) { }

  public get(key: string, cb: BFSCallback<Buffer>): void {
    this.store.match(key)
    .then((res: any) => {
      if (res === undefined) {
        setTimeout(() => cb(null, res), 0);
      } else {
        res.arrayBuffer()
        .then((buffer: ArrayBuffer) => cb(null, arrayBuffer2Buffer(buffer)))
        .catch((err: any) => cb(convertError(err)));
      }
    })
    .catch((err) => cb(convertError(err)));
  }
}

/**
 * @hidden
 */
export class CacheStorageRWTransaction extends CacheStorageROTransaction implements AsyncKeyValueRWTransaction, AsyncKeyValueROTransaction {
  constructor(store: Cache) {
    super(store);
  }

  public put(key: string, data: Buffer, overwrite: boolean, cb: BFSCallback<boolean>): void {
    try {
      const arraybuffer = buffer2ArrayBuffer(data);
      if (overwrite) {
        this.store.put(key, new Response(arraybuffer))
        .then(() => cb(null, true))
        .catch((err) => cb(convertError(err)));
      } else {
        this.store.match(key)
        .then((match) => {
          if (match === undefined) {
            this.store.put(key, new Response(arraybuffer))
            .then(() => cb(null, true))
            .catch((err) => cb(convertError(err)));
          } else {
            cb(null, false);
          }
        })
        .catch((err) => {
          cb(convertError(err));
        });
      }
    } catch (e) {
      cb(convertError(e));
    }
  }

  public del(key: string, cb: BFSOneArgCallback): void {
    this.store.delete(key)
    .then(() => cb())
    .catch((err) => cb(convertError(err)));
  }

  public commit(cb: BFSOneArgCallback): void {
    // Return to the event loop to commit the transaction.
    setTimeout(cb, 0);
  }

  public abort(cb: BFSOneArgCallback): void {
    if (cb) {
      setTimeout(cb, 0);
    }
  }
}

export class CacheStore implements AsyncKeyValueStore {
  public static Create(storeName: string, cb: BFSCallback<CacheStore>): void {
    caches.open(storeName)
    .then((cache) => {
      cb(null, new CacheStore(cache, storeName));
    })
    .catch((err) => {
      cb(new ApiError(ErrorCode.EACCES));
    });
  }

  constructor(private cache: Cache, private storeName: string) {

  }

  public name(): string {
    return CacheStorageFileSystem.Name + " - " + this.storeName;
  }

  public clear(cb: BFSOneArgCallback): void {
    caches.delete(this.storeName)
    .then(() => {
      caches.open(this.storeName)
      .then((cache) => {
        this.cache = cache;
        cb();
      })
      .catch((err) => {
        cb(convertError(err));
      });
    })
    .catch((err) => {
      cb(convertError(err));
    });
  }

  public beginTransaction(type: 'readonly'): AsyncKeyValueROTransaction;
  public beginTransaction(type: 'readwrite'): AsyncKeyValueRWTransaction;
  public beginTransaction(type: 'readonly' | 'readwrite' = 'readonly'): AsyncKeyValueROTransaction {
    if (type === 'readwrite') {
      return new CacheStorageRWTransaction(this.cache);
    } else if (type === 'readonly') {
      return new CacheStorageROTransaction(this.cache);
    } else {
      throw new ApiError(ErrorCode.EINVAL, 'Invalid transaction type.');
    }
  }
}

/**
 * Configuration options for the CacheStorage file system.
 */
export interface CacheStorageFileSystemOptions {
  // The name of this file system. You can have multiple CacheStorage file systems operating
  // at once, but each must have a different name.
  storeName?: string;
}

/**
 * A file system that uses the Cache Storage API.
 */
export default class CacheStorageFileSystem extends AsyncKeyValueFileSystem {
  public static readonly Name = "CacheStorage";

  public static readonly Options: FileSystemOptions = {
    storeName: {
      type: "string",
      optional: true,
      description: "The name of this file system. You can have multiple CacheStorageFS file systems operating at once, but each must have a different name."
    }
  };

  /**
   * Constructs an CacheStorage file system with the given options.
   */
  public static Create(opts: CacheStorageFileSystemOptions, cb: BFSCallback<CacheStorageFileSystem>): void {
    CacheStore.Create(opts.storeName ? opts.storeName : 'browserfs', (e, store?) => {
      if (store) {
        const csfs = new CacheStorageFileSystem();
        csfs.init(store, (e) => {
          if (e) {
            cb(e);
          } else {
            cb(null, csfs);
          }
        });
      } else {
        cb(e);
      }
    });
  }
  public static isAvailable(): boolean {
    return global.caches !== undefined;
  }
  private constructor() {
    super();
  }

  public supportsSynch(): boolean {
    // The Cache API doesn't have any support for synchronous operations. It's all Promise based.
    return false;
  }

  // public supportsLinks(): boolean {
  //   return false;
  // }

  // public supportsProps(): boolean {
  //   return false;
  // }

}
