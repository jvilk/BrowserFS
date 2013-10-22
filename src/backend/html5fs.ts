/// <reference path="../../vendor/DefinitelyTyped/filesystem/filesystem.d.ts" />
import preload_file = require('../generic/preload_file');
import file_system = require('../core/file_system');
import api_error = require('../core/api_error');
import file_flag = require('../core/file_flag');
import node_fs_stats = require('../core/node_fs_stats');
import buffer = require('../core/buffer');
import file = require('../core/file');

var Buffer = buffer.Buffer;
var Stats = node_fs_stats.Stats;
var FileType = node_fs_stats.FileType;
var ApiError = api_error.ApiError;
var ErrorType = api_error.ErrorType;
var ActionType = file_flag.ActionType;

// XXX: The typings for async on DefinitelyTyped are out of date.
declare var async: any;

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

export class HTML5FSFile extends preload_file.PreloadFile {
  constructor(_fs: HTML5FS, _path: string, _flag: file_flag.FileFlag, _stat: node_fs_stats.Stats, contents?: buffer.Buffer) {
    super(_fs, _path, _flag, _stat, contents);
  }

  public sync(cb: (e?: api_error.ApiError) => void): void {
    var self = this;
    var opts = {
      create: false
    };
    var _fs = <HTML5FS> this._fs;
    var success = function(entry) {
      entry.createWriter(function(writer) {
        var blob = new Blob([self._buffer.buff]);
        var length = blob.size;
        writer.onwriteend = function(event) {
          writer.onwriteend = null;
          writer.truncate(length);
          cb();
        };
        writer.onerror = function(err) {
          _fs._sendError(cb, 'Write failed');
        };
        writer.write(blob);
      });
    };
    var error = function(err) {
      _fs._sendError(cb, err);
    };
    _fs.fs.root.getFile(this._path, opts, success, error);
  }

  public close(cb: (e?: api_error.ApiError) => void): void {
    this.sync(cb);
  }
}

export class HTML5FS extends file_system.FileSystem {
  private size: number;
  private type: number;
  // HTML5File reaches into HTML5FS. :/
  public fs: FileSystem;
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

  public _humanise(err: DOMException): string {
    switch (err.code) {
      case DOMException.QUOTA_EXCEEDED_ERR:
        return 'Filesystem full. Please delete some files to free up space.';
      case DOMException.NOT_FOUND_ERR:
        return 'File does not exist.';
      case DOMException.SECURITY_ERR:
        return 'Insecure file access.';
      default:
        return "Unknown Error: " + err.name;
    }
  }

  public allocate(cb: (e?: api_error.ApiError) => void = function(){}): void {
    var self = this;
    var success = function(fs: FileSystem): void {
      self.fs = fs;
      cb()
    };
    var error = function(err: DOMException): void {
      var msg = self._humanise(err);
      console.error("Failed to create FS");
      console.error(msg);
      self._sendError(cb, err);
    };
    if (this.type === window.PERSISTENT) {
      _requestQuota(this.type, this.size, function(granted: number) {
        _getFS(this.type, granted, success, error);
      }, error);
    } else {
      _getFS(this.type, this.size, success, error);
    }
  }

  public empty(main_cb: (e?: api_error.ApiError) => void): void {
    var self = this;
    self._readdir('/', function(err: api_error.ApiError, entries?: Entry[]): void {
      if (err) {
        console.error('Failed to empty FS');
        main_cb(err);
      } else {
        var finished = function(er: api_error.ApiError): void {
          if (err) {
            console.error("Failed to empty FS");
            main_cb(err);
          } else {
            main_cb();
          }
        };
        var deleteEntry = function(entry: Entry, cb: (e?: api_error.ApiError) => void): void {
          var succ = function() {
            cb();
          };
          var error = function() {
            self._sendError(cb, "Failed to remove " + entry.fullPath);
          };
          if (entry.isFile) {
            entry.remove(succ, error);
          } else {
            (<DirectoryEntry> entry).removeRecursively(succ, error);
          }
        };
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
      self._sendError(cb, "Could not rename " + oldPath + " to " + newPath);
    };
    this.fs.root.getFile(oldPath, {}, success, error);
  }

  public stat(path: string, isLstat: boolean, cb: (err: api_error.ApiError, stat?: node_fs_stats.Stats) => void): void {
    var self = this;
    var opts = {
      create: false
    };
    var loadAsFile = function(entry: FileEntry): void {
      var fileFromEntry = function(file: File): void {
        var stat = new Stats(FileType.FILE, file.size);
        cb(null, stat);
      };
      entry.file(fileFromEntry, failedToLoad);
    };
    var loadAsDir = function(dir: DirectoryEntry): void {
      var size = 4096;
      var stat = new Stats(FileType.DIRECTORY, size);
      cb(null, stat);
    };
    var failedToLoad = function(err: DOMException): void {
      self._sendError(cb, "Could not stat " + path);
    };
    var failedToLoadAsFile = function(): void {
      self.fs.root.getDirectory(path, opts, loadAsDir, failedToLoad);
    };
    this.fs.root.getFile(path, opts, loadAsFile, failedToLoadAsFile);
  }

  public open(path: string, flags: file_flag.FileFlag, mode: number, cb: (err: api_error.ApiError, fd?: file.BaseFile) => any): void {
    var self = this;
    var opts = {
      create: flags.pathNotExistsAction() === ActionType.CREATE_FILE,
      exclusive: flags.isExclusive()
    };
    // Type of err differs between getFile and file.
    var error = function(err: any): void {
      self._sendError(cb, "Could not open " + path);
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
      entry.file(success2, error);
    };
    this.fs.root.getFile(path, opts, success, error);
  }

  public _sendError(cb: (e: api_error.ApiError) => void, err: any): void {
    var msg = typeof err === 'string' ? err : this._humanise(err);
    cb(new ApiError(ErrorType.INVALID_PARAM, msg));
  }

  public _statType(stat: Entry): node_fs_stats.FileType {
    return stat.isFile ? FileType.FILE : FileType.DIRECTORY;
  }

  public _makeFile(path: string, flag: file_flag.FileFlag, stat: File, data: ArrayBuffer = new ArrayBuffer(0)): HTML5FSFile {
    var stats = new Stats(FileType.FILE, stat.size);
    var buffer = new Buffer(data);
    return new HTML5FSFile(this, path, flag, stats, buffer);
  }

  public _remove(path: string, cb: (e?: api_error.ApiError) => void, isFile: boolean): void {
    var self = this;
    var success = function(entry: Entry): void {
      var succ = function() {
        cb();
      };
      var err = function() {
        self._sendError(cb, "Failed to remove " + path);
      };
      entry.remove(succ, err);
    };
    var error = function(err: DOMException): void {
      self._sendError(cb, "Failed to remove " + path);
    };
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
    var opts = {
      create: true,
      exclusive: true
    };
    var success = function(dir: DirectoryEntry): void {
      cb();
    };
    var error = function(err: DOMException): void {
      self._sendError(cb, "Could not create directory: " + path);
    };
    this.fs.root.getDirectory(path, opts, success, error);
  }

  public _readdir(path: string, cb: (e: api_error.ApiError, entries?: Entry[]) => void): void {
    var self = this;
    var reader = this.fs.root.createReader();
    var entries = [];
    var error = function(err: DOMException): void {
      self._sendError(cb, err);
    };
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
