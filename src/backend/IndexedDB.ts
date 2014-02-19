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
  path = node_path.path;

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
 * Represents a file or folder node in the IndexedDB.
 */
interface IDBNode {
  size: number;
  mode: number;
  atime: number;
  mtime: number;
  ctime: number;
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

    openReq.onerror = function onerror(error) {
      // Assume our request was denied, either because we're in incognito mode
      // or the user declined the prompt to grant us storage.
      cb(new ApiError(ErrorCode.EACCES));
    };
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
  private getObjectStore(mode: string = "readwrite"): IDBObjectStore {
    return this.db.transaction(fileStoreName, mode).objectStore(fileStoreName);
  }

  public _writeFile(p: string, stats: node_fs_stats.Stats, data: DataView, cb: (e?: api_error.ApiError) => void) {
    try {
      var objectStore: IDBObjectStore = this.getObjectStore(),
        request: IDBRequest = objectStore.put(data, path2datakey(p)),
        _this = this;
      request.onsuccess = function () {
        // Update stats!
        try {
          request = objectStore.put(stats, path2nodekey(p));
          request.onsuccess = function () {
            // Update directory, if needed.
            var parent = path.dirname(p);
            _this.readdir(parent, function (err, files?) {
              if (files.indexOf(path.basename(p)) === -1) {
                // New file. Add to directory listing.
                try {
                  files.push(p);
                  request = objectStore.put(files, path2nodekey(parent));
                  request.onsuccess = function () {
                    cb();
                  };
                  request.onerror = function () {
                    cb(new ApiError(ErrorCode.EIO));
                  };
                } catch (e) {
                  cb(convertError(e));
                }
              } else {
                // Old file.
                cb();
              }
            });
          };
          request.onerror = function () {
            // XXX ??
            cb(new ApiError(ErrorCode.EIO));
          };
        } catch (e) {
          cb(convertError(e));
        }
      };
      request.onerror = function () {
        cb(new ApiError(ErrorCode.EIO));
      };
    } catch (e) {
      cb(convertError(e));
    }
  }

  public empty(cb: (e?: api_error.ApiError) => void): void {
    try {
      var request: IDBRequest = this.getObjectStore().clear();
      request.onsuccess = function (event) {
        cb();
      };
      request.onerror = function (error) {
        // XXX: Properly process this error once I decipher IDB error codes.
        cb(new ApiError(ErrorCode.EIO));
      };
    } catch (e) {
      cb(convertError(e));
    }
  }

  public stat(path: string, isLstat: boolean, cb: (err: api_error.ApiError, stat?: node_fs_stats.Stats) => void): void {
    try {
      var request: IDBRequest = this.getObjectStore("readonly").get(path2nodekey(path));
      request.onsuccess = function (event) {
        var result: IDBNode = (<any>event.target).result;
        // Convert into a Node stats object.
        // @todo That 0xF000 magic number is somewhat annoying. Maybe we could
        //   make a Stats constructor that takes the full mode.
        cb(null, new node_fs_stats.Stats((result.mode & 0xF000), result.size,
          (result.mode | 0x0FFF), new Date(result.atime), new Date(result.mtime),
          new Date(result.ctime)));
      };
      request.onerror = function (error) {
        // XXX
        cb(new ApiError(ErrorCode.ENOENT, "No such file or folder: " + path));
      };
    } catch (e) {
      cb(convertError(e));
    }
  }

  public open(path: string, flags: file_flag.FileFlag, mode: number, cb: (err: api_error.ApiError, fd?: file.File) => any): void {
    var _this: IndexedDB = this;
    this.stat(path, false, function (err, stats?) {
      var request: IDBRequest;
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
          try {
            // Grab the file contents.
            request = _this.getObjectStore("readonly").get(path2datakey(path));
            request.onsuccess = function (event) {
              var data: DataView = (<any>event.target).result;
              cb(null, new IDBFile(_this, path, flags, stats, new Buffer(data)));
            };
            request.onerror = function (error) {
              // XXX
              cb(new ApiError(ErrorCode.EIO));
            };
          } catch (e) {
            cb(convertError(e));
          }
        }
      }
    });
  }

  private _delete(path: string, isDir: boolean, cb: (e?: api_error.ApiError) => void): void {
    var _this: IndexedDB = this;
    this.stat(path, false, function (e, stat?) {
      var request: IDBRequest, objectStore: IDBObjectStore,
        errorCb = function () { cb(new ApiError(ErrorCode.EIO)); };
      if (e) {
        cb(e);
      } else {
        if (stat.isDirectory() && !isDir) {
          cb(new ApiError(ErrorCode.EISDIR, path + " is a directory."));
        } else if (stat.isFile() && isDir) {
          cb(new ApiError(ErrorCode.ENOTDIR, path + " is not a directory."));
        } else {
          // Remove both the stat and data keys.
          try {
            objectStore = _this.getObjectStore();
            request = objectStore.delete(path2datakey(path));
            request.onsuccess = function () {
              try {
                request = objectStore.delete(path2nodekey(path));
                request.onsuccess = function () {
                  cb();
                };
                request.onerror = errorCb;
              } catch (e) {
                cb(convertError(e));
              }
            };
            request.onerror = errorCb;
          } catch (e) {
            cb(convertError(e));
          }
        }
      }
    });
  }

  public unlink(path: string, cb: (e?: api_error.ApiError) => void): void {
    this._delete(path, false, cb);
  }

  public rmdir(path: string, cb: (e?: api_error.ApiError) => void): void {
    this._delete(path, true, cb);
  }

  private _stats2node(stats: node_fs_stats.Stats): IDBNode {
    return {
      size: stats.size,
      mode: stats.mode,
      atime: stats.atime.getTime(),
      mtime: stats.mtime.getTime(),
      ctime: stats.ctime.getTime()
    };
  }

  public mkdir(p: string, mode: number, cb: (e?: api_error.ApiError) => void): void {
    try {
      var objectStore: IDBObjectStore = this.getObjectStore(),
        stats = new node_fs_stats.Stats(node_fs_stats.FileType.DIRECTORY, 4096),
        request: IDBRequest = objectStore.add(this._stats2node(stats), path2nodekey(p));
      request.onsuccess = function () {
        try {
          request = objectStore.add([], path2datakey(p));
          request.onsuccess = function () {
            cb();
          };
          request.onerror = function () {
            // XXX
            cb(new ApiError(ErrorCode.EEXIST, p + " already exists"));
          };
        } catch (e) {
          cb(convertError(e));
        }
      };
      request.onerror = function () {
        cb(new ApiError(ErrorCode.EEXIST, p + " already exists!"));
      };
    } catch (e) {
      cb(convertError(e));
    }
  }

  public readdir(path: string, cb: (err: api_error.ApiError, files?: string[]) => void): void {
    try {
      var request: IDBRequest = this.getObjectStore('readonly').get(path2nodekey(path));
      request.onsuccess = function (event) {
        cb(null, (<any>event.target).result);
      };
      request.onerror = function () {
        cb(new ApiError(ErrorCode.ENOENT, path + " doesn't exist"));
      };
    } catch (e) {
      cb(convertError(e));
    }
  }
}

browserfs.registerFileSystem('IndexedDB', IndexedDB);
