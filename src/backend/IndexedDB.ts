import browserfs = require('../core/browserfs');
import api_error = require('../core/api_error');
import file_system = require('../core/file_system');
import file_flag = require('../core/file_flag');
import node_fs_stats = require('../core/node_fs_stats');
import preload_file = require('../generic/preload_file');
import buffer = require('../core/buffer');
import file = require('../core/file');
import buffer_core_arraybuffer = require('../core/buffer_core_arraybuffer');
import node_path = require('../core/node_path');
var Buffer = buffer.Buffer,
  ApiError = api_error.ApiError,
  ErrorCode = api_error.ErrorCode,
  ActionType = file_flag.ActionType,
  path = node_path.path,
  RW: string = 'readwrite',
  RO: string = 'readonly';

/**
 * Get the indexedDB constructor for the current browser.
 */
var indexedDB: IDBFactory = window.indexedDB              ||
                            (<any>window).mozIndexedDB    ||
                            (<any>window).webkitIndexedDB ||
                            window.msIndexedDB,
    fileStoreName: string = "files";

/**
 * Converts a DOMException or a DOMError from an IndexedDB event into a
 * standardized BrowserFS API error.
 */
function convertError(e: {name: string}, message: string = e.toString()): api_error.ApiError {
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
 * Returns the key to the node for the given file path.
 */
function path2nodekey(path: string): string {
  return '/nodes' + path;
}

/**
 * Returns the key to the data for the given file path.
 */
function path2datakey(path: string): string {
  return '/data' + path;
}

/**
 * Produces a new onerror handler for IDB. Our errors are always fatal, so we
 * handle them generically: Call the user-supplied callback with a translated
 * version of the error, and let the error bubble up.
 */
function onErrorHandler(cb: (e: api_error.ApiError) => void,
  code: api_error.ErrorCode = ErrorCode.EIO, message: string = null): (e?: any) => void {
  return function(e?: any): void {
    console.error("RECEIVED ERROR: " + e);
    cb(new ApiError(code, message));
  };
}

/**
 * Represents a file or folder node in the IndexedDB.
 */
interface IDBNode {
  size: number;
  mode: number;
  atime: number;
  mtime: number;
  ctime: number;
}

/**
 * Converts a Stats object into an IDBNode.
 */
function stats2node(stats: node_fs_stats.Stats): IDBNode {
  return {
    size: stats.size,
    mode: stats.mode,
    atime: stats.atime.getTime(),
    mtime: stats.mtime.getTime(),
    ctime: stats.ctime.getTime()
  };
}

/**
 * Converts an IDBNode into a Stats object.
 */
function node2stats(node: IDBNode): node_fs_stats.Stats {
  // @todo Try to get rid of these magic numbers. Maybe add a Stats constructor?
  return new node_fs_stats.Stats((node.mode & 0xF000), node.size,
    (node.mode | 0x0FFF), new Date(node.atime), new Date(node.mtime),
    new Date(node.ctime))
}

export class IDBFile extends preload_file.PreloadFile implements file.File {
  constructor(_fs: file_system.FileSystem, _path: string, _flag: file_flag.FileFlag, _stat: node_fs_stats.Stats, contents?: NodeBuffer) {
    super(_fs, _path, _flag, _stat, contents)
  }

  public sync(cb: (e?: api_error.ApiError) => void): void {
    var buffer = this._buffer;
    // XXX: Typing hack.
    var backing_mem: buffer_core_arraybuffer.BufferCoreArrayBuffer = <buffer_core_arraybuffer.BufferCoreArrayBuffer><any> (<buffer.BFSBuffer><any>this._buffer).getBufferCore();
    if (!(backing_mem instanceof buffer_core_arraybuffer.BufferCoreArrayBuffer)) {
      // Copy into an ArrayBuffer-backed Buffer.
      buffer = new Buffer(this._buffer.length);
      this._buffer.copy(buffer);
      backing_mem = <buffer_core_arraybuffer.BufferCoreArrayBuffer><any> (<buffer.BFSBuffer><any>buffer).getBufferCore();
    }
    // Reach into the BC, grab the DV.
    var dv = backing_mem.getDataView();
    // Create an appropriate view on the array buffer.
    var abv = new DataView(dv.buffer, dv.byteOffset + (<buffer.BFSBuffer><any>buffer).getOffset(), buffer.length);
    (<any> this._fs)._writeFile(this._path, abv, cb);
  }

  public close(cb: (e?: api_error.ApiError) => void): void {
    this.sync(cb);
  }
}

/**
 * A file system backed by the IndexedDB storage technology.
 * @url https://developer.mozilla.org/en-US/docs/IndexedDB
 */
class IndexedDB extends file_system.BaseFileSystem implements file_system.FileSystem {
  private db: IDBDatabase;

  /**
   * Constructs an IndexedDB file system.
   * @param cb Called once the database is instantiated and ready for use.
   *   Passes an error if there was an issue instantiating the database.
   * @param objectStoreName The name of this file system. You can have
   *   multiple IndexedDB file systems operating at once, but each must have
   *   a different name.
   */
  constructor(cb: (e: api_error.ApiError, fs?: IndexedDB) => void, private objectStoreName: string = "default") {
    super();

    var openReq: IDBOpenDBRequest = indexedDB.open(this.objectStoreName, 1),
        _this: IndexedDB = this;

    openReq.onupgradeneeded = function onupgradeneeded(event) {
      var db: IDBDatabase = (<any>event.target).result;
      // Huh. This should never happen; we're at version 1. Why does another
      // database exist?
      if(db.objectStoreNames.contains(fileStoreName)) {
        db.deleteObjectStore(fileStoreName);
      }
      db.createObjectStore(fileStoreName);
    };

    openReq.onsuccess = function onsuccess(event) {
      _this.db = (<any>event.target).result;
      _this.mkdir('/', 0, function (e?) {
        cb(e, _this);
      });
    };

    openReq.onerror = onErrorHandler(cb, ErrorCode.EACCES);
  }

  public getName(): string {
    return 'IndexedDB:' + this.objectStoreName;
  }

  public static isAvailable(): boolean {
    return typeof indexedDB !== 'undefined';
  }

  public isReadOnly(): boolean {
    return false;
  }

  public supportsSymlinks(): boolean {
    return false;
  }

  public supportsProps(): boolean {
    return false;
  }

  public supportsSynch(): boolean {
    // @todo Check for synchronous interface.
    return false;
  }

  /**
   * Begins a new transaction, and returns the object store we're using to store
   * our files.
   */
  private _beginTransaction(mode: string = RW): IDBObjectStore {
    if (mode !== RW && mode !== RO) {
      throw new Error("Invalid transaction mode!");
    }
    return this.db.transaction(fileStoreName, mode).objectStore(fileStoreName);
  }

  /**
   * Retrieves a key from the file store.
   */
  private _get<T>(key: string, objStore: IDBObjectStore, cb: (e: api_error.ApiError, result?: T) => void): void {
    var request: IDBRequest;
    try {
      request = objStore.get(key);
      request.onerror = onErrorHandler(cb);
      request.onsuccess = (event) => {
        cb(null, (<any>event.target).result);
      };
    } catch(e) {
      cb(convertError(e));
    }
  }

  /**
   * Puts data at the particular key in the file store. If `overwrite` is false,
   * then it will trigger an error if the key exists.
   */
  private _put<T>(key: string, data: T, overwrite: boolean, objStore: IDBObjectStore, cb: (e?: api_error.ApiError) => void): void {
    var request: IDBRequest;
    try {
      if (overwrite) {
        request = objStore.put(data, key);
      } else {
        request = objStore.add(data, key);
      }

      request.onerror = onErrorHandler(cb);
      request.onsuccess = (event) => {
        cb();
      };
    } catch (e) {
      cb(convertError(e));
    }
  }

  /**
   * Deletes a key and the content associated with it from the object store.
   */
  private _delete(key: string, objStore: IDBObjectStore, cb: (e?: api_error.ApiError) => void): void {
    var request: IDBRequest;
    try {
      request = objStore.delete(key);
      request.onerror = onErrorHandler(cb);
      request.onsuccess = (event) => {
        cb();
      };
    } catch(e) {
      cb(convertError(e));
    }
  }

  /**
   * Gets the data associated with the given path.
   */
  private _getData(p: string, objStore: IDBObjectStore, cb: (e: api_error.ApiError, data?: any) => void): void {
    this._get<any>(path2datakey(p), objStore, cb);
  }

  /**
   * Gets the stats object associated with the given path.
   */
  private _getStats(p: string, objStore: IDBObjectStore, cb: (e: api_error.ApiError, stats?: node_fs_stats.Stats) => void): void {
    this._get<IDBNode>(path2nodekey(p), objStore, (e: api_error.ApiError, node?: IDBNode): void => {
      cb(e, node ? node2stats(node) : undefined);
    });
  }

  /**
   * Stores the stats object for the given path.
   */
  private _putStats(p: string, stats: node_fs_stats.Stats, overwrite: boolean, objStore: IDBObjectStore, cb: (e?: api_error.ApiError) => void): void {
    this._put<IDBNode>(path2nodekey(p), stats2node(stats), overwrite, objStore, cb);
  }

  /**
   * Stores the data for the given path.
   */
  private _putData(p: string, data: any, overwrite: boolean, objStore: IDBObjectStore, cb: (e?: api_error.ApiError) => void): void {
    this._put<any>(path2datakey(p), data, overwrite, objStore, cb);
  }

  /**
   * Deletes all data associated with the given path.
   * DO NOT CALL THIS DIRECTLY, EVER! If you call _del on a non-empty directory,
   * then its contents will be orphaned in IndexedDB. `rmdir` performs the
   * empty check for us. This is a convenience function that both `rmdir` and
   * `unlink` share.
   */
  private _deletePath(p: string, objStore: IDBObjectStore, cb: (e?: api_error.ApiError) => void): void {
    try {
      // Query 1: Delete data.
      var _this: IndexedDB = this, objStore: IDBObjectStore = this._beginTransaction();
      this._delete(path2datakey(p), objStore, (e?: api_error.ApiError) => {
        if (e) {
          cb(e);
        } else {
          // Query 2: Delete stats.
          _this._delete(path2nodekey(p), objStore, (e?: api_error.ApiError) => {
            if (e) {
              cb(e);
            } else {
              // Query 3: Get data from parent.
              var parent: string = path.dirname(p);
              _this._getData(parent, objStore, (e: api_error.ApiError, data?: any) => {
                var dirList: string[] = data, index: number,
                    fileName: string = path.basename(p);
                if (e) {
                  cb(e);
                } else {
                  // Remove self from directory listing.
                  index = dirList.indexOf(fileName);
                  if (index === -1) {
                    cb(new ApiError(ErrorCode.EIO, "File was missing in parent's directory listing."));
                  } else {
                    dirList.splice(index, 1);
                    // Query 4: Update parent's directory listing.
                    _this._putData(parent, dirList, true, objStore, cb);
                  }
                }
              });
            }
          });
        }
      });
    } catch (e) {
      cb(convertError(e));
    }
  }

  /**
   * Ensures that the directory listing of directory `parent` contains `filename`.
   */
  private _updateDirectory(parent: string, filename: string, objStore: IDBObjectStore, cb: (e?: api_error.ApiError) => void): void {
    var _this = this;
    this._getData(parent, objStore, (e: api_error.ApiError, data?: any) => {
      var dirList: string[] = data;
      if (e) {
        cb(e);
      } else {
        // Check if the file needs to be added to the parent's directory listing
        if (dirList.indexOf(filename) === -1) {
          // It does.
          dirList.push(filename);
          // Update directory listing.
          _this._putData(parent, dirList, true, objStore, cb);
        } else {
          // It doesn't. We're done.
          cb();
        }
      }
    });
  }

  public _writeFile(p: string, stats: node_fs_stats.Stats, data: DataView, cb: (e?: api_error.ApiError) => void): void {
    try {
      var objectStore: IDBObjectStore = this._beginTransaction(),
          _this = this;
      // Query 1: Store node object.
      this._putStats(p, stats, true, objectStore, (e?: api_error.ApiError) => {
        if (e) {
          cb(e);
        } else {
          // Query 2: Store data.
          _this._putData(p, data, true, objectStore, (e?: api_error.ApiError) => {
            if (e) {
              cb(e);
            } else {
              // Query 3/4: Update parent directory listing, if needed.
              var parent: string = path.dirname(p),
                  filename: string = path.basename(p);
              _this._updateDirectory(parent, filename, objectStore, cb);
            }
          });
        }
      });
    } catch (e) {
      cb(convertError(e));
    }
  }

  public empty(cb: (e?: api_error.ApiError) => void): void {
    try {
      var request: IDBRequest = this._beginTransaction().clear();
      request.onsuccess = function (event) {
        cb();
      };
      request.onerror = onErrorHandler(cb);
    } catch (e) {
      cb(convertError(e));
    }
  }

  public stat(path: string, isLstat: boolean, cb: (err: api_error.ApiError, stat?: node_fs_stats.Stats) => void): void {
    try {
      this._getStats(path, this._beginTransaction(RO), cb);
    } catch (e) {
      cb(convertError(e));
    }
  }

  public open(path: string, flags: file_flag.FileFlag, mode: number, cb: (err: api_error.ApiError, fd?: file.File) => any): void {
    try {
      var _this: IndexedDB = this, objStore: IDBObjectStore = this._beginTransaction();
      this._getStats(path, objStore, function (err, stats?) {
        if (err) {
          switch (flags.pathNotExistsAction()) {
            case ActionType.CREATE_FILE:
              return cb(null, new IDBFile(this, path, flags, new node_fs_stats.Stats(node_fs_stats.FileType.FILE, 0, mode), new Buffer(0)));
            case ActionType.THROW_EXCEPTION:
              return cb(new ApiError(ErrorCode.ENOENT, path + " does not exist."));
          }
        } else {
          if (stats.isDirectory()) {
            cb(new ApiError(ErrorCode.EISDIR, path + " is a directory."));
          } else {
            // We're accessing it, so update its access time. It will be synced
            // when the file is closed.
            stats.atime = new Date();
            switch (flags.pathExistsAction()) {
              case ActionType.THROW_EXCEPTION:
                return cb(new ApiError(ErrorCode.EEXIST, path + " exists."));
              case ActionType.TRUNCATE_FILE:
                stats.size = 0;
                stats.mtime = new Date();
                return cb(null, new IDBFile(_this, path, flags, stats, new Buffer(0)));
            }
            // case ActionType.NOP: Below.
            _this._getData(path, objStore, (e: api_error.ApiError, data?: any) => {
              if (e) {
                cb(e);
              } else {
                cb(null, new IDBFile(_this, path, flags, stats, new Buffer(data)));
              }
            });
          }
        }
      });
    } catch (e) {
      cb(convertError(e));
    }
  }

  public unlink(path: string, cb: (e?: api_error.ApiError) => void): void {
    try {
      var objStore: IDBObjectStore = this._beginTransaction(),
          _this = this;
      this._getStats(path, objStore, (e: api_error.ApiError, stats?: node_fs_stats.Stats) => {
        if (e) {
          cb(e);
        } else if (stats.isDirectory()) {
          cb(new ApiError(ErrorCode.EISDIR, path + " is a directory"));
        } else {
          _this._deletePath(path, objStore, cb);
        }
      });
    } catch (e) {
      cb(convertError(e));
    }
  }

  public rmdir(path: string, cb: (e?: api_error.ApiError) => void): void {
    try {
      var objStore: IDBObjectStore = this._beginTransaction(),
          _this = this;
      this._getData(path, objStore, (e: api_error.ApiError, data?: any) => {
        if (e) {
          cb(e);
        } else if (!Array.isArray(data)) {
          cb(new ApiError(ErrorCode.ENOTDIR, path + " is not a directory"));
        } else {
          _this._deletePath(path, objStore, cb);
        }
      });
    } catch (e) {
      cb(convertError(e));
    }
  }

  public mkdir(p: string, mode: number, cb: (e?: api_error.ApiError) => void): void {
    try {
      var objStore: IDBObjectStore = this._beginTransaction(),
        stats = new node_fs_stats.Stats(node_fs_stats.FileType.DIRECTORY, 4096),
        _this = this;
      this._putStats(p, stats, false, objStore, (e?: api_error.ApiError): void => {
        if (e) {
          cb(e);
        } else {
          _this._putData(p, [], false, objStore, (e?: api_error.ApiError): void => {
            if (e) {
              cb(e);
            } else {
              _this._updateDirectory(path.dirname(p), path.basename(p), objStore, cb);
            }
          });
        }
      });
    } catch (e) {
      cb(convertError(e));
    }
  }

  public readdir(path: string, cb: (err: api_error.ApiError, files?: string[]) => void): void {
    try {
      var objStore: IDBObjectStore = this._beginTransaction(RO);
      this._getData(path, objStore, (e: api_error.ApiError, data?: any): void => {
        if (Array.isArray(data)) {
          cb(e, data);
        } else {
          cb(new ApiError(ErrorCode.ENOTDIR, path + " is not a directory."));
        }
      });
    } catch (e) {
      cb(convertError(e));
    }
  }
}

browserfs.registerFileSystem('IndexedDB', IndexedDB);
