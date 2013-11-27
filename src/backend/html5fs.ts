/// <reference path="../../vendor/DefinitelyTyped/filesystem/filesystem.d.ts" />
/// <amd-dependency path="../../vendor/async/lib/async" />
import preload_file = require('../generic/preload_file');
import file_system = require('../core/file_system');
import api_error = require('../core/api_error');
import file_flag = require('../core/file_flag');
import node_fs_stats = require('../core/node_fs_stats');
import buffer = require('../core/buffer');
import file = require('../core/file');
import browserfs = require('../core/browserfs');
import buffer_core_arraybuffer = require('../core/buffer_core_arraybuffer');

var Buffer = buffer.Buffer;
var Stats = node_fs_stats.Stats;
var FileType = node_fs_stats.FileType;
var ApiError = api_error.ApiError;
var ErrorCode = api_error.ErrorCode;
var ActionType = file_flag.ActionType;

// XXX: The typings for async on DefinitelyTyped are out of date.
var async = require('../../vendor/async/lib/async');

var _getFS: (type:number, size:number, successCallback: FileSystemCallback, errorCallback?: ErrorCallback) => void = window.webkitRequestFileSystem || window.requestFileSystem || null;

function _requestQuota(type: number, size: number, success: (size: number) => void, errorCallback: ErrorCallback) {
  // We cast navigator and window to '<any>' because everything here is
  // nonstandard functionality, despite the fact that Chrome has the only
  // implementation of the HTML5FS and is likely driving the standardization
  // process. Thus, these objects defined off of navigator and window are not
  // present in the DefinitelyTyped TypeScript typings for FileSystem.
  if (typeof navigator['webkitPersistentStorage'] !== 'undefined') {
    switch(type) {
      case window.PERSISTENT:
        (<any> navigator).webkitPersistentStorage.requestQuota(size, success, errorCallback);
        break;
      case window.TEMPORARY:
        (<any> navigator).webkitTemporaryStorage.requestQuota(size, success, errorCallback);
        break
      default:
        // TODO: Figure out how to construct a DOMException/DOMError.
        errorCallback(null);
        break;
    }
  } else {
    (<any> window).webkitStorageInfo.requestQuota(type, size, success, errorCallback);
  }
}

function _toArray(list?: any[]): any[] {
  return Array.prototype.slice.call(list || [], 0);
}

// A note about getFile and getDirectory options:
// These methods are called at numerous places in this file, and are passed
// some combination of these two options:
//   - create: If true, the entry will be created if it doesn't exist.
//             If false, an error will be thrown if it doesn't exist.
//   - exclusive: If true, only create the entry if it doesn't already exist,
//                and throw an error if it does.

export class HTML5FSFile extends preload_file.PreloadFile implements file.File {
  constructor(_fs: HTML5FS, _path: string, _flag: file_flag.FileFlag, _stat: node_fs_stats.Stats, contents?: NodeBuffer) {
    super(_fs, _path, _flag, _stat, contents);
  }

  public sync(cb: (e?: api_error.ApiError) => void): void {
    var self = this;
    // Don't create the file (it should already have been created by `open`)
    var opts = {
      create: false
    };
    var _fs = <HTML5FS> this._fs;
    var success = function(entry) {
      entry.createWriter(function(writer) {
        // XXX: Typing hack.
        var buffer = self._buffer;
        var backing_mem: buffer_core_arraybuffer.BufferCoreArrayBuffer = <buffer_core_arraybuffer.BufferCoreArrayBuffer><any> (<buffer.BFSBuffer><any>self._buffer).getBufferCore();
        if (!(backing_mem instanceof buffer_core_arraybuffer.BufferCoreArrayBuffer)) {
          // Copy into an ArrayBuffer-backed Buffer.
          buffer = new Buffer(self._buffer.length);
          self._buffer.copy(buffer);
          backing_mem = <buffer_core_arraybuffer.BufferCoreArrayBuffer><any> (<buffer.BFSBuffer><any>buffer).getBufferCore();
        }
        // Reach into the BC, grab the DV.
        var dv = backing_mem.getDataView();
        // Create an appropriate view on the array buffer.
        var abv = new DataView(dv.buffer, dv.byteOffset + (<buffer.BFSBuffer><any>buffer).getOffset(), buffer.length);
        var blob = new Blob([abv]);
        var length = blob.size;
        writer.onwriteend = function(event) {
          writer.onwriteend = null;
          writer.truncate(length);
          cb();
        };
        writer.onerror = function(err) {
          cb(_fs.convert(err));
        };
        writer.write(blob);
      });
    };
    var error = function(err) {
      cb(_fs.convert(err));
    };
    _fs.fs.root.getFile(this._path, opts, success, error);
  }

  public close(cb: (e?: api_error.ApiError) => void): void {
    this.sync(cb);
  }
}

export class HTML5FS extends file_system.BaseFileSystem implements file_system.FileSystem {
  private size: number;
  private type: number;
  // HTML5File reaches into HTML5FS. :/
  public fs: FileSystem;
  /**
   * Arguments:
   *   - type: PERSISTENT or TEMPORARY
   *   - size: storage quota to request, in megabytes. Allocated value may be less.
   */
  constructor(size: number, type?: number) {
    super();
    this.size = size != null ? size : 5;
    this.type = type != null ? type : window.PERSISTENT;
    var kb = 1024;
    var mb = kb * kb;
    this.size *= mb;
  }

  public getName(): string {
    return 'HTML5 FileSystem';
  }

  public static isAvailable(): boolean {
    return _getFS != null;
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
    return false;
  }

  /**
   * Converts the given DOMError into an appropriate ApiError.
   * Full list of values here:
   * https://developer.mozilla.org/en-US/docs/Web/API/DOMError
   * I've only implemented the most obvious ones, but more can be added to
   * make errors more descriptive in the future.
   */
  public convert(err: DOMError, message: string = ""): api_error.ApiError {
    switch (err.name) {
      case 'QuotaExceededError':
        return new ApiError(ErrorCode.ENOSPC, message);
      case 'NotFoundError':
        return new ApiError(ErrorCode.ENOENT, message);
      case 'SecurityError':
        return new ApiError(ErrorCode.EACCES, message);
      case 'SyntaxError':
      case 'TypeMismatchError':
        return new ApiError(ErrorCode.EINVAL, message);
      default:
        console.log("Unknown Error: " + err.name);
        return new ApiError(ErrorCode.EINVAL, message);
    }
  }

  /**
   * Converts the given ErrorEvent (from a FileReader) into an appropriate
   * APIError.
   */
  public convertErrorEvent(err: ErrorEvent, message: string = ""): api_error.ApiError {
    return new ApiError(ErrorCode.ENOENT, err.message + "; " + message);
  }

  /**
   * Nonstandard
   * Requests a storage quota from the browser to back this FS.
   */
  public allocate(cb: (e?: api_error.ApiError) => void = function(){}): void {
    var self = this;
    var success = function(fs: FileSystem): void {
      self.fs = fs;
      cb()
    };
    var error = function(err: DOMException): void {
      cb(self.convert(err));
    };
    if (this.type === window.PERSISTENT) {
      _requestQuota(this.type, this.size, function(granted: number) {
        _getFS(this.type, granted, success, error);
      }, error);
    } else {
      _getFS(this.type, this.size, success, error);
    }
  }

  /**
   * Nonstandard
   * Deletes everything in the FS. Used for testing.
   * Karma clears the storage after you quit it but not between runs of the test
   * suite, and the tests expect an empty FS every time.
   */
  public empty(main_cb: (e?: api_error.ApiError) => void): void {
    var self = this;
    // Get a list of all entries in the root directory to delete them
    self._readdir('/', function(err: api_error.ApiError, entries?: Entry[]): void {
      if (err) {
        console.error('Failed to empty FS');
        main_cb(err);
      } else {
        // Called when every entry has been operated on
        var finished = function(er: api_error.ApiError): void {
          if (err) {
            console.error("Failed to empty FS");
            main_cb(err);
          } else {
            main_cb();
          }
        };
        // Removes files and recursively removes directories
        var deleteEntry = function(entry: Entry, cb: (e?: api_error.ApiError) => void): void {
          var succ = function() {
            cb();
          };
          var error = function(err: DOMException) {
            cb(self.convert(err, entry.fullPath));
          };
          if (entry.isFile) {
            entry.remove(succ, error);
          } else {
            (<DirectoryEntry> entry).removeRecursively(succ, error);
          }
        };
        // Loop through the entries and remove them, then call the callback
        // when they're all finished.
        async.each(entries, deleteEntry, finished);
      }
    });
  }

  public rename(oldPath: string, newPath: string, cb: (e?: api_error.ApiError) => void): void {
    var self = this;
    var success = function(file: Entry): void {
      // XXX: Um, I don't think this quite works, since oldPath is a string.
      // The spec says we need the DirectoryEntry corresponding to the file's
      // parent directory.
      file.moveTo((<any> oldPath), newPath);
      cb();
    };
    var error = function(err: DOMException): void {
      cb(self.convert(err, "Failed to rename " + oldPath + " to " + newPath + "."));
    };
    this.fs.root.getFile(oldPath, {}, success, error);
  }

  public stat(path: string, isLstat: boolean, cb: (err: api_error.ApiError, stat?: node_fs_stats.Stats) => void): void {
    var self = this;
    // Throw an error if the entry doesn't exist, because then there's nothing
    // to stat.
    var opts = {
      create: false
    };
    // Called when the path has been successfully loaded as a file.
    var loadAsFile = function(entry: FileEntry): void {
      var fileFromEntry = function(file: File): void {
        var stat = new Stats(FileType.FILE, file.size);
        cb(null, stat);
      };
      entry.file(fileFromEntry, failedToLoad);
    };
    // Called when the path has been successfully loaded as a directory.
    var loadAsDir = function(dir: DirectoryEntry): void {
      // Directory entry size can't be determined from the HTML5 FS API, and is
      // implementation-dependant anyway, so a dummy value is used.
      var size = 4096;
      var stat = new Stats(FileType.DIRECTORY, size);
      cb(null, stat);
    };
    // Called when the path couldn't be opened as a directory or a file.
    var failedToLoad = function(err: DOMException): void {
      cb(self.convert(err, path));
    };
    // Called when the path couldn't be opened as a file, but might still be a
    // directory.
    var failedToLoadAsFile = function(): void {
      self.fs.root.getDirectory(path, opts, loadAsDir, failedToLoad);
    };
    // No method currently exists to determine whether a path refers to a
    // directory or a file, so this implementation tries both and uses the first
    // one that succeeds.
    this.fs.root.getFile(path, opts, loadAsFile, failedToLoadAsFile);
  }

  public open(path: string, flags: file_flag.FileFlag, mode: number, cb: (err: api_error.ApiError, fd?: file.File) => any): void {
    var self = this;
    var opts = {
      create: flags.pathNotExistsAction() === ActionType.CREATE_FILE,
      exclusive: flags.isExclusive()
    };
    var error = function(err: ErrorEvent): void {
      cb(self.convertErrorEvent(err, path));
    };
    var error2 = function(err: DOMError): void {
      cb(self.convert(err, path));
    };
    var success = function(entry: FileEntry): void {
      var success2 = function(file: File): void {
        var reader = new FileReader();
        reader.onloadend = function(event: Event): void {
          var bfs_file = self._makeFile(path, flags, file, <ArrayBuffer> reader.result);
          cb(null, bfs_file);
        };
        reader.onerror = error;
        reader.readAsArrayBuffer(file);
      };
      entry.file(success2, error2);
    };
    this.fs.root.getFile(path, opts, success, error);
  }

  /**
   * Returns a BrowserFS object representing the type of a Dropbox.js stat object
   */
  private _statType(stat: Entry): node_fs_stats.FileType {
    return stat.isFile ? FileType.FILE : FileType.DIRECTORY;
  }

  /**
   * Returns a BrowserFS object representing a File, created from the data
   * returned by calls to the Dropbox API.
   */
  private _makeFile(path: string, flag: file_flag.FileFlag, stat: File, data: ArrayBuffer = new ArrayBuffer(0)): HTML5FSFile {
    var stats = new Stats(FileType.FILE, stat.size);
    var buffer = new Buffer(data);
    return new HTML5FSFile(this, path, flag, stats, buffer);
  }

  /**
   * Delete a file or directory from the file system
   * isFile should reflect which call was made to remove the it (`unlink` or
   * `rmdir`). If this doesn't match what's actually at `path`, an error will be
   * returned
   */
  private _remove(path: string, cb: (e?: api_error.ApiError) => void, isFile: boolean): void {
    var self = this;
    var success = function(entry: Entry): void {
      var succ = function() {
        cb();
      };
      var err = function(err: DOMException) {
        cb(self.convert(err, path));
      };
      entry.remove(succ, err);
    };
    var error = function(err: DOMException): void {
      cb(self.convert(err, path));
    };
    // Deleting the entry, so don't create it
    var opts = {
      create: false
    };

    if (isFile) {
      this.fs.root.getFile(path, opts, success, error);
    } else {
      this.fs.root.getDirectory(path, opts, success, error);
    }
  }

  public unlink(path: string, cb: (e?: api_error.ApiError) => void): void {
    this._remove(path, cb, true);
  }

  public rmdir(path: string, cb: (e?: api_error.ApiError) => void): void {
    this._remove(path, cb, false);
  }

  public mkdir(path: string, mode: number, cb: (e?: api_error.ApiError) => void): void {
    var self = this;
    // Create the directory, but throw an error if it already exists, as per
    // mkdir(1)
    var opts = {
      create: true,
      exclusive: true
    };
    var success = function(dir: DirectoryEntry): void {
      cb();
    };
    var error = function(err: DOMException): void {
      cb(self.convert(err, path));
    };
    this.fs.root.getDirectory(path, opts, success, error);
  }

  /**
   * Returns an array of `FileEntry`s. Used internally by empty and readdir.
   */
  private _readdir(path: string, cb: (e: api_error.ApiError, entries?: Entry[]) => void): void {
    var self = this;
    var reader = this.fs.root.createReader();
    var entries = [];
    var error = function(err: DOMException): void {
      cb(self.convert(err, path));
    };
    // Call the reader.readEntries() until no more results are returned.
    var readEntries = function() {
      reader.readEntries((function(results) {
        if (results.length) {
          entries = entries.concat(_toArray(results));
          readEntries();
        } else {
          cb(null, entries);
        }
      }), error);
    };
    readEntries();
  }

  /**
   * Map _readdir's list of `FileEntry`s to their names and return that.
   */
  public readdir(path: string, cb: (err: api_error.ApiError, files?: string[]) => void): void {
    this._readdir(path, function(e: api_error.ApiError, entries?: Entry[]): void {
      if (e != null) {
        return cb(e);
      }
      var rv: string[] = [];
      for (var i = 0; i < entries.length; i++) {
        rv.push(entries[i].name);
      }
      cb(null, rv);
    });
  }
}

browserfs.registerFileSystem('HTML5FS', HTML5FS);
