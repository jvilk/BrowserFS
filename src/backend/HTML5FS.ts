import preload_file = require('../generic/preload_file');
import file_system = require('../core/file_system');
import {ApiError, ErrorCode} from '../core/api_error';
import {FileFlag, ActionType} from '../core/file_flag';
import {default as Stats, FileType} from '../core/node_fs_stats';
import file = require('../core/file');
import path = require('path');
import global = require('../core/global');
import async = require('async');
import {buffer2ArrayBuffer, arrayBuffer2Buffer} from '../core/util';

function isDirectoryEntry(entry: Entry): entry is DirectoryEntry {
  return entry.isDirectory;
}

var _getFS: (type:number, size:number, successCallback: FileSystemCallback, errorCallback?: ErrorCallback) => void = global.webkitRequestFileSystem || global.requestFileSystem || null;

function _requestQuota(type: number, size: number, success: (size: number) => void, errorCallback: ErrorCallback) {
  // We cast navigator and window to '<any>' because everything here is
  // nonstandard functionality, despite the fact that Chrome has the only
  // implementation of the HTML5FS and is likely driving the standardization
  // process. Thus, these objects defined off of navigator and window are not
  // present in the DefinitelyTyped TypeScript typings for FileSystem.
  if (typeof (<any> navigator)['webkitPersistentStorage'] !== 'undefined') {
    switch(type) {
      case global.PERSISTENT:
        (<any> navigator).webkitPersistentStorage.requestQuota(size, success, errorCallback);
        break;
      case global.TEMPORARY:
        (<any> navigator).webkitTemporaryStorage.requestQuota(size, success, errorCallback);
        break
      default:
        errorCallback(new TypeError(`Invalid storage type: ${type}`));
        break;
    }
  } else {
    (<any> global).webkitStorageInfo.requestQuota(type, size, success, errorCallback);
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

export class HTML5FSFile extends preload_file.PreloadFile<HTML5FS> implements file.File {
  constructor(_fs: HTML5FS, _path: string, _flag: FileFlag, _stat: Stats, contents?: NodeBuffer) {
    super(_fs, _path, _flag, _stat, contents);
  }

  public sync(cb: (e?: ApiError) => void): void {
    if (this.isDirty()) {
      // Don't create the file (it should already have been created by `open`)
      var opts = {
        create: false
      };
      var _fs = this._fs;
      var success: FileEntryCallback = (entry) => {
        entry.createWriter((writer) => {
          var buffer = this.getBuffer();
          var blob = new Blob([buffer2ArrayBuffer(buffer)]);
          var length = blob.size;
          writer.onwriteend = () => {
            writer.onwriteend = null;
            writer.truncate(length);
            this.resetDirty();
            cb();
          };
          writer.onerror = (err: DOMError) => {
            cb(_fs.convert(err, this.getPath(), false));
          };
          writer.write(blob);
        });
      };
      var error = (err: DOMError) => {
        cb(_fs.convert(err, this.getPath(), false));
      };
      _fs.fs.root.getFile(this.getPath(), opts, success, error);
    } else {
      cb();
    }
  }

  public close(cb: (e?: ApiError) => void): void {
    this.sync(cb);
  }
}

export default class HTML5FS extends file_system.BaseFileSystem implements file_system.FileSystem {
  private size: number;
  private type: number;
  // HTML5File reaches into HTML5FS. :/
  public fs: FileSystem;
  /**
   * Arguments:
   *   - type: PERSISTENT or TEMPORARY
   *   - size: storage quota to request, in megabytes. Allocated value may be less.
   */
  constructor(size: number = 5, type: number = global.PERSISTENT) {
    super();
    // Convert MB to bytes.
    this.size = 1024 * 1024 * size;
    this.type = type;
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
   */
  public convert(err: DOMError, p: string, expectedDir: boolean): ApiError {
    switch (err.name) {
      /* The user agent failed to create a file or directory due to the existence of a file or
         directory with the same path.  */
      case "PathExistsError":
        return ApiError.EEXIST(p);
      /* The operation failed because it would cause the application to exceed its storage quota.  */
      case 'QuotaExceededError':
        return ApiError.FileError(ErrorCode.ENOSPC, p);
      /*  A required file or directory could not be found at the time an operation was processed.   */
      case 'NotFoundError':
        return ApiError.ENOENT(p);
      /* This is a security error code to be used in situations not covered by any other error codes.
         - A required file was unsafe for access within a Web application
         - Too many calls are being made on filesystem resources */
      case 'SecurityError':
        return ApiError.FileError(ErrorCode.EACCES, p);
      /* The modification requested was illegal. Examples of invalid modifications include moving a
         directory into its own child, moving a file into its parent directory without changing its name,
         or copying a directory to a path occupied by a file.  */
      case 'InvalidModificationError':
        return ApiError.FileError(ErrorCode.EPERM, p);
      /* The user has attempted to look up a file or directory, but the Entry found is of the wrong type
         [e.g. is a DirectoryEntry when the user requested a FileEntry].  */
      case 'TypeMismatchError':
        return ApiError.FileError(expectedDir ? ErrorCode.ENOTDIR : ErrorCode.EISDIR, p);
      /* A path or URL supplied to the API was malformed.  */
      case "EncodingError":
      /* An operation depended on state cached in an interface object, but that state that has changed
         since it was read from disk.  */
      case "InvalidStateError":
      /* The user attempted to write to a file or directory which could not be modified due to the state
         of the underlying filesystem.  */
      case "NoModificationAllowedError":
      default:
        return ApiError.FileError(ErrorCode.EINVAL, p);
    }
  }

  /**
   * Nonstandard
   * Requests a storage quota from the browser to back this FS.
   */
  public allocate(cb: (e?: ApiError) => void = function(){}): void {
    var success = (fs: FileSystem): void => {
      this.fs = fs;
      cb()
    };
    var error = (err: DOMException): void => {
      cb(this.convert(err, "/", true));
    };
    if (this.type === global.PERSISTENT) {
      _requestQuota(this.type, this.size, (granted: number) => {
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
  public empty(mainCb: (e?: ApiError) => void): void {
    // Get a list of all entries in the root directory to delete them
    this._readdir('/', (err: ApiError, entries?: Entry[]): void => {
      if (err) {
        console.error('Failed to empty FS');
        mainCb(err);
      } else {
        // Called when every entry has been operated on
        var finished = (er: any): void => {
          if (err) {
            console.error("Failed to empty FS");
            mainCb(err);
          } else {
            mainCb();
          }
        };
        // Removes files and recursively removes directories
        var deleteEntry = (entry: Entry, cb: (e?: any) => void): void => {
          var succ = () => {
            cb();
          };
          var error = (err: DOMException) => {
            cb(this.convert(err, entry.fullPath, !entry.isDirectory));
          };
          if (isDirectoryEntry(entry)) {
            entry.removeRecursively(succ, error);
          } else {
            entry.remove(succ, error);
          }
        };
        // Loop through the entries and remove them, then call the callback
        // when they're all finished.
        async.each(entries, deleteEntry, finished);
      }
    });
  }

  public rename(oldPath: string, newPath: string, cb: (e?: ApiError) => void): void {
    var semaphore: number = 2,
      successCount: number = 0,
      root: DirectoryEntry = this.fs.root,
      currentPath: string = oldPath,
      error = (err: DOMException): void => {
        if (--semaphore <= 0) {
            cb(this.convert(err, currentPath, false));
        }
      },
      success = (file: Entry): void => {
        if (++successCount === 2) {
          return cb(new ApiError(ErrorCode.EINVAL, "Something was identified as both a file and a directory. This should never happen."));
        }

        // SPECIAL CASE: If newPath === oldPath, and the path exists, then
        // this operation trivially succeeds.
        if (oldPath === newPath) {
          return cb();
        }

        // Get the new parent directory.
        currentPath = path.dirname(newPath);
        root.getDirectory(currentPath, {}, (parentDir: DirectoryEntry): void => {
          currentPath = path.basename(newPath);
          file.moveTo(parentDir, currentPath, (entry: Entry): void => { cb(); }, (err: DOMException): void => {
            // SPECIAL CASE: If oldPath is a directory, and newPath is a
            // file, rename should delete the file and perform the move.
            if (file.isDirectory) {
              currentPath = newPath;
              // Unlink only works on files. Try to delete newPath.
              this.unlink(newPath, (e?): void => {
                if (e) {
                  // newPath is probably a directory.
                  error(err);
                } else {
                  // Recur, now that newPath doesn't exist.
                  this.rename(oldPath, newPath, cb);
                }
              });
            } else {
              error(err);
            }
          });
        }, error);
      };

    // We don't know if oldPath is a *file* or a *directory*, and there's no
    // way to stat items. So launch both requests, see which one succeeds.
    root.getFile(oldPath, {}, success, error);
    root.getDirectory(oldPath, {}, success, error);
  }

  public stat(path: string, isLstat: boolean, cb: (err: ApiError, stat?: Stats) => void): void {
    // Throw an error if the entry doesn't exist, because then there's nothing
    // to stat.
    var opts = {
      create: false
    };
    // Called when the path has been successfully loaded as a file.
    var loadAsFile = (entry: FileEntry): void => {
      var fileFromEntry = (file: File): void => {
        var stat = new Stats(FileType.FILE, file.size);
        cb(null, stat);
      };
      entry.file(fileFromEntry, failedToLoad);
    };
    // Called when the path has been successfully loaded as a directory.
    var loadAsDir = (dir: DirectoryEntry): void => {
      // Directory entry size can't be determined from the HTML5 FS API, and is
      // implementation-dependant anyway, so a dummy value is used.
      var size = 4096;
      var stat = new Stats(FileType.DIRECTORY, size);
      cb(null, stat);
    };
    // Called when the path couldn't be opened as a directory or a file.
    var failedToLoad = (err: DOMException): void => {
      cb(this.convert(err, path, false /* Unknown / irrelevant */));
    };
    // Called when the path couldn't be opened as a file, but might still be a
    // directory.
    var failedToLoadAsFile = (): void => {
      this.fs.root.getDirectory(path, opts, loadAsDir, failedToLoad);
    };
    // No method currently exists to determine whether a path refers to a
    // directory or a file, so this implementation tries both and uses the first
    // one that succeeds.
    this.fs.root.getFile(path, opts, loadAsFile, failedToLoadAsFile);
  }

  public open(p: string, flags: FileFlag, mode: number, cb: (err: ApiError, fd?: file.File) => any): void {
    var error = (err: DOMError): void => {
      if (err.name === 'InvalidModificationError' && flags.isExclusive()) {
        cb(ApiError.EEXIST(p));
      } else {
        cb(this.convert(err, p, false));
      }
    };

    this.fs.root.getFile(p, {
      create: flags.pathNotExistsAction() === ActionType.CREATE_FILE,
      exclusive: flags.isExclusive()
    }, (entry: FileEntry): void => {
      // Try to fetch corresponding file.
      entry.file((file: File): void => {
        var reader = new FileReader();
        reader.onloadend = (event: Event): void => {
          var bfs_file = this._makeFile(p, flags, file, <ArrayBuffer> reader.result);
          cb(null, bfs_file);
        };
        reader.onerror = (ev: Event) => {
          error(reader.error);
        };
        reader.readAsArrayBuffer(file);
      }, error);
    }, error);
  }

  /**
   * Returns a BrowserFS object representing the type of a Dropbox.js stat object
   */
  private _statType(stat: Entry): FileType {
    return stat.isFile ? FileType.FILE : FileType.DIRECTORY;
  }

  /**
   * Returns a BrowserFS object representing a File, created from the data
   * returned by calls to the Dropbox API.
   */
  private _makeFile(path: string, flag: FileFlag, stat: File, data: ArrayBuffer = new ArrayBuffer(0)): HTML5FSFile {
    var stats = new Stats(FileType.FILE, stat.size);
    var buffer = arrayBuffer2Buffer(data);
    return new HTML5FSFile(this, path, flag, stats, buffer);
  }

  /**
   * Delete a file or directory from the file system
   * isFile should reflect which call was made to remove the it (`unlink` or
   * `rmdir`). If this doesn't match what's actually at `path`, an error will be
   * returned
   */
  private _remove(path: string, cb: (e?: ApiError) => void, isFile: boolean): void {
    var success = (entry: Entry): void => {
      var succ = () => {
        cb();
      };
      var err = (err: DOMException) => {
        cb(this.convert(err, path, !isFile));
      };
      entry.remove(succ, err);
    };
    var error = (err: DOMException): void => {
      cb(this.convert(err, path, !isFile));
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

  public unlink(path: string, cb: (e?: ApiError) => void): void {
    this._remove(path, cb, true);
  }

  public rmdir(path: string, cb: (e?: ApiError) => void): void {
    this._remove(path, cb, false);
  }

  public mkdir(path: string, mode: number, cb: (e?: ApiError) => void): void {
    // Create the directory, but throw an error if it already exists, as per
    // mkdir(1)
    var opts = {
      create: true,
      exclusive: true
    };
    var success = (dir: DirectoryEntry): void => {
      cb();
    };
    var error = (err: DOMException): void => {
      cb(this.convert(err, path, true));
    };
    this.fs.root.getDirectory(path, opts, success, error);
  }

  /**
   * Returns an array of `FileEntry`s. Used internally by empty and readdir.
   */
  private _readdir(path: string, cb: (e: ApiError, entries?: Entry[]) => void): void {
    var error = (err: DOMException): void => {
      cb(this.convert(err, path, true));
    };
    // Grab the requested directory.
    this.fs.root.getDirectory(path, { create: false }, (dirEntry: DirectoryEntry) => {
      var reader = dirEntry.createReader();
      var entries: Entry[] = [];

      // Call the reader.readEntries() until no more results are returned.
      var readEntries = () => {
        reader.readEntries(((results) => {
          if (results.length) {
            entries = entries.concat(_toArray(results));
            readEntries();
          } else {
            cb(null, entries);
          }
        }), error);
      };
      readEntries();
    }, error);
  }

  /**
   * Map _readdir's list of `FileEntry`s to their names and return that.
   */
  public readdir(path: string, cb: (err: ApiError, files?: string[]) => void): void {
    this._readdir(path, (e: ApiError, entries?: Entry[]): void => {
      if (e) {
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
