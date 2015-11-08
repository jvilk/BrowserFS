import preload_file = require('../generic/preload_file');
import file_system = require('../core/file_system');
import file_flag = require('../core/file_flag');
import {default as Stats, FileType} from '../core/node_fs_stats';
import {ApiError, ErrorCode} from '../core/api_error';
import file = require('../core/file');
import async = require('async');
import path = require('path');
import {arrayBuffer2Buffer, buffer2ArrayBuffer} from '../core/util';

var errorCodeLookup: {[dropboxErrorCode: number]: ErrorCode} = null;
// Lazily construct error code lookup, since DropboxJS might be loaded *after* BrowserFS (or not at all!)
function constructErrorCodeLookup() {
  if (errorCodeLookup !== null) {
    return;
  }
  errorCodeLookup = {};
  // This indicates a network transmission error on modern browsers. Internet Explorer might cause this code to be reported on some API server errors.
  errorCodeLookup[Dropbox.ApiError.NETWORK_ERROR] = ErrorCode.EIO;
  // This happens when the contentHash parameter passed to a Dropbox.Client#readdir or Dropbox.Client#stat matches the most recent content, so the API call response is omitted, to save bandwidth.
  // errorCodeLookup[Dropbox.ApiError.NO_CONTENT];
  // The error property on {Dropbox.ApiError#response} should indicate which input parameter is invalid and why.
  errorCodeLookup[Dropbox.ApiError.INVALID_PARAM] = ErrorCode.EINVAL;
  // The OAuth token used for the request will never become valid again, so the user should be re-authenticated.
  errorCodeLookup[Dropbox.ApiError.INVALID_TOKEN] = ErrorCode.EPERM;
  // This indicates a bug in dropbox.js and should never occur under normal circumstances.
  // ^ Actually, that's false. This occurs when you try to move folders to themselves, or move a file over another file.
  errorCodeLookup[Dropbox.ApiError.OAUTH_ERROR] = ErrorCode.EPERM;
  // This happens when trying to read from a non-existing file, readdir a non-existing directory, write a file into a non-existing directory, etc.
  errorCodeLookup[Dropbox.ApiError.NOT_FOUND] = ErrorCode.ENOENT;
  // This indicates a bug in dropbox.js and should never occur under normal circumstances.
  errorCodeLookup[Dropbox.ApiError.INVALID_METHOD] = ErrorCode.EINVAL;
  // This happens when a Dropbox.Client#readdir or Dropbox.Client#stat call would return more than a maximum amount of directory entries.
  errorCodeLookup[Dropbox.ApiError.NOT_ACCEPTABLE] = ErrorCode.EINVAL;
  // This is used by some backend methods to indicate that the client needs to download server-side changes and perform conflict resolution. Under normal usage, errors with this code should never surface to the code using dropbox.js.
  errorCodeLookup[Dropbox.ApiError.CONFLICT] = ErrorCode.EINVAL;
  // Status value indicating that the application is making too many requests.
  errorCodeLookup[Dropbox.ApiError.RATE_LIMITED] = ErrorCode.EBUSY;
  // The request should be retried after some time.
  errorCodeLookup[Dropbox.ApiError.SERVER_ERROR] = ErrorCode.EBUSY;
  // Status value indicating that the user's Dropbox is over its storage quota.
  errorCodeLookup[Dropbox.ApiError.OVER_QUOTA] = ErrorCode.ENOSPC;
}

interface ICachedPathInfo {
  stat: Dropbox.File.Stat;
}

interface ICachedFileInfo extends ICachedPathInfo {
  contents: ArrayBuffer;
}

function isFileInfo(cache: ICachedPathInfo): cache is ICachedFileInfo {
  return cache && cache.stat.isFile;
}

interface ICachedDirInfo extends ICachedPathInfo {
  contents: string[];
}

function isDirInfo(cache: ICachedPathInfo): cache is ICachedDirInfo {
  return cache && cache.stat.isFolder;
}

function isArrayBuffer(ab: any): ab is ArrayBuffer {
  // Accept null / undefined, too.
  return ab === null || ab === undefined || (typeof(ab) === 'object' && typeof(ab['byteLength']) === 'number');
}

/**
 * Wraps a Dropbox client and caches operations.
 */
class CachedDropboxClient {
  private _cache: {[path: string]: ICachedPathInfo} = {};
  private _client: Dropbox.Client;

  constructor(client: Dropbox.Client) {
    this._client = client;
  }

  private getCachedInfo(p: string): ICachedPathInfo {
    return this._cache[p.toLowerCase()];
  }

  private putCachedInfo(p: string, cache: ICachedPathInfo): void {
    this._cache[p.toLowerCase()] = cache;
  }

  private deleteCachedInfo(p: string): void {
    delete this._cache[p.toLowerCase()];
  }

  private getCachedDirInfo(p: string): ICachedDirInfo {
    var info = this.getCachedInfo(p);
    if (isDirInfo(info)) {
      return info;
    } else {
      return null;
    }
  }

  private getCachedFileInfo(p: string): ICachedFileInfo {
    var info = this.getCachedInfo(p);
    if (isFileInfo(info)) {
      return info;
    } else {
      return null;
    }
  }

  private updateCachedDirInfo(p: string, stat: Dropbox.File.Stat, contents: string[] = null): void {
    var cachedInfo = this.getCachedInfo(p);
    // Dropbox uses the *contentHash* property for directories.
    // Ignore stat objects w/o a contentHash defined; those actually exist!!!
    // (Example: readdir returns an array of stat objs; stat objs for dirs in that context have no contentHash)
    if (stat.contentHash !== null && (cachedInfo === undefined || cachedInfo.stat.contentHash !== stat.contentHash)) {
      this.putCachedInfo(p, <ICachedDirInfo> {
        stat: stat,
        contents: contents
      });
    }
  }

  private updateCachedFileInfo(p: string, stat: Dropbox.File.Stat, contents: ArrayBuffer = null): void {
    var cachedInfo = this.getCachedInfo(p);
    // Dropbox uses the *versionTag* property for files.
    // Ignore stat objects w/o a versionTag defined.
    if (stat.versionTag !== null && (cachedInfo === undefined || cachedInfo.stat.versionTag !== stat.versionTag)) {
      this.putCachedInfo(p, <ICachedFileInfo> {
        stat: stat,
        contents: contents
      });
    }
  }

  private updateCachedInfo(p: string, stat: Dropbox.File.Stat, contents: ArrayBuffer | string[] = null): void {
    if (stat.isFile && isArrayBuffer(contents)) {
      this.updateCachedFileInfo(p, stat, contents);
    } else if (stat.isFolder && Array.isArray(contents)) {
      this.updateCachedDirInfo(p, stat, contents);
    }
  }

  public readdir(p: string, cb: (error: Dropbox.ApiError, contents?: string[]) => void): void {
    var cacheInfo = this.getCachedDirInfo(p);

    this._wrap((interceptCb) => {
      if (cacheInfo !== null && cacheInfo.contents) {
        this._client.readdir(p, {
          contentHash: cacheInfo.stat.contentHash
        }, interceptCb);
      } else {
        this._client.readdir(p, interceptCb);
      }
    }, (err: Dropbox.ApiError, filenames: string[], stat: Dropbox.File.Stat, folderEntries: Dropbox.File.Stat[]) => {
      if (err) {
        if (err.status === Dropbox.ApiError.NO_CONTENT && cacheInfo !== null) {
          cb(null, cacheInfo.contents.slice(0));
        } else {
          cb(err);
        }
      } else {
        this.updateCachedDirInfo(p, stat, filenames.slice(0));
        folderEntries.forEach((entry) => {
          this.updateCachedInfo(path.join(p, entry.name), entry);
        });
        cb(null, filenames);
      }
    });
  }

  public remove(p: string, cb: (error?: Dropbox.ApiError) => void): void {
    this._wrap((interceptCb) => {
      this._client.remove(p, interceptCb);
    }, (err: Dropbox.ApiError, stat?: Dropbox.File.Stat) => {
      if (!err) {
        this.updateCachedInfo(p, stat);
      }
      cb(err);
    });
  }

  public move(src: string, dest: string, cb: (error?: Dropbox.ApiError) => void): void {
    this._wrap((interceptCb) => {
      this._client.move(src, dest, interceptCb);
    }, (err: Dropbox.ApiError, stat: Dropbox.File.Stat) => {
      if (!err) {
        this.deleteCachedInfo(src);
        this.updateCachedInfo(dest, stat);
      }
      cb(err);
    });
  }

  public stat(p: string, cb: (error: Dropbox.ApiError, stat?: Dropbox.File.Stat) => void): void {
    this._wrap((interceptCb) => {
      this._client.stat(p, interceptCb);
    }, (err: Dropbox.ApiError, stat: Dropbox.File.Stat) => {
      if (!err) {
        this.updateCachedInfo(p, stat);
      }
      cb(err, stat);
    });
  }

  public readFile(p: string, cb: (error: Dropbox.ApiError, file?: ArrayBuffer, stat?: Dropbox.File.Stat) => void): void {
    var cacheInfo = this.getCachedFileInfo(p);
    if (cacheInfo !== null && cacheInfo.contents !== null) {
      // Try to use cached info; issue a stat to see if contents are up-to-date.
      this.stat(p, (error, stat?) => {
        if (error) {
          cb(error);
        } else if (stat.contentHash === cacheInfo.stat.contentHash) {
          // No file changes.
          cb(error, cacheInfo.contents.slice(0), cacheInfo.stat);
        } else {
          // File changes; rerun to trigger actual readFile.
          this.readFile(p, cb);
        }
      });
    } else {
      this._wrap((interceptCb) => {
        this._client.readFile(p, { arrayBuffer: true }, interceptCb);
      }, (err: Dropbox.ApiError, contents: any, stat: Dropbox.File.Stat) => {
        if (!err) {
          this.updateCachedInfo(p, stat, contents.slice(0));
        }
        cb(err, contents, stat);
      });
    }
  }

  public writeFile(p: string, contents: ArrayBuffer, cb: (error: Dropbox.ApiError, stat?: Dropbox.File.Stat) => void): void {
    this._wrap((interceptCb) => {
      this._client.writeFile(p, contents, interceptCb);
    },(err: Dropbox.ApiError, stat: Dropbox.File.Stat) => {
      if (!err) {
        this.updateCachedInfo(p, stat, contents.slice(0));
      }
      cb(err, stat);
    });
  }

  public mkdir(p: string, cb: (error?: Dropbox.ApiError) => void): void {
    this._wrap((interceptCb) => {
      this._client.mkdir(p, interceptCb);
    }, (err: Dropbox.ApiError, stat: Dropbox.File.Stat) => {
      if (!err) {
        this.updateCachedInfo(p, stat, []);
      }
      cb(err);
    });
  }

  /**
   * Wraps an operation such that we retry a failed operation 3 times.
   * Necessary to deal with Dropbox rate limiting.
   *
   * @param performOp Function that performs the operation. Will be called up to three times.
   * @param cb Called when the operation succeeds, fails in a non-temporary manner, or fails three times.
   */
  private _wrap(performOp: (interceptCb: (error: Dropbox.ApiError) => void) => void, cb: Function): void {
    var numRun = 0,
      interceptCb = function (error: Dropbox.ApiError): void {
        // Timeout duration, in seconds.
        var timeoutDuration: number = 2;
        if (error && 3 > (++numRun)) {
          switch(error.status) {
            case Dropbox.ApiError.SERVER_ERROR:
            case Dropbox.ApiError.NETWORK_ERROR:
            case Dropbox.ApiError.RATE_LIMITED:
              setTimeout(() => {
                performOp(interceptCb);
              }, timeoutDuration * 1000);
              break;
            default:
              cb.apply(null, arguments);
              break;
          }
        } else {
          cb.apply(null, arguments);
        }
      };

    performOp(interceptCb);
  }
}

export class DropboxFile extends preload_file.PreloadFile<DropboxFileSystem> implements file.File {
  constructor(_fs: DropboxFileSystem, _path: string, _flag: file_flag.FileFlag, _stat: Stats, contents?: NodeBuffer) {
    super(_fs, _path, _flag, _stat, contents)
  }

  public sync(cb: (e?: ApiError) => void): void {
    if (this.isDirty()) {
      var buffer = this.getBuffer(),
        arrayBuffer = buffer2ArrayBuffer(buffer);
      this._fs._writeFileStrict(this.getPath(), arrayBuffer, (e?: ApiError) => {
        if (!e) {
          this.resetDirty();
        }
        cb(e);
      });
    } else {
      cb();
    }
  }

  public close(cb: (e?: ApiError) => void): void {
    this.sync(cb);
  }
}

export default class DropboxFileSystem extends file_system.BaseFileSystem implements file_system.FileSystem {
  // The Dropbox client.
  private _client: CachedDropboxClient;

  /**
   * Arguments: an authenticated Dropbox.js client
   */
  constructor(client: Dropbox.Client) {
    super();
    this._client = new CachedDropboxClient(client);
    constructErrorCodeLookup();
  }

  public getName(): string {
    return 'Dropbox';
  }

  public static isAvailable(): boolean {
    // Checks if the Dropbox library is loaded.
    return typeof Dropbox !== 'undefined';
  }

  public isReadOnly(): boolean {
    return false;
  }

  // Dropbox doesn't support symlinks, properties, or synchronous calls

  public supportsSymlinks(): boolean {
    return false;
  }

  public supportsProps(): boolean {
    return false;
  }

  public supportsSynch(): boolean {
    return false;
  }

  public empty(mainCb: (e?: ApiError) => void): void {
    this._client.readdir('/', (error, files) => {
      if (error) {
        mainCb(this.convert(error, '/'));
      } else {
        var deleteFile = (file: string, cb: (err?: ApiError) => void) => {
          var p = path.join('/', file);
          this._client.remove(p, (err) => {
            cb(err ? this.convert(err, p) : null);
          });
        };
        var finished = (err?: ApiError) => {
          if (err) {
            mainCb(err);
          } else {
            mainCb();
          }
        };
        // XXX: <any> typing is to get around overly-restrictive ErrorCallback typing.
        async.each(files, <any> deleteFile, <any> finished);
      }
    });
  }

 public rename(oldPath: string, newPath: string, cb: (e?: ApiError) => void): void {
    this._client.move(oldPath, newPath, (error) => {
      if (error) {
        // the move is permitted if newPath is a file.
        // Check if this is the case, and remove if so.
        this._client.stat(newPath, (error2, stat) => {
          if (error2 || stat.isFolder) {
            var missingPath = (<any> error.response).error.indexOf(oldPath) > -1 ? oldPath : newPath;
            cb(this.convert(error, missingPath));
          } else {
            // Delete file, repeat rename.
            this._client.remove(newPath, (error2) => {
              if (error2) {
                cb(this.convert(error2, newPath));
              } else {
                this.rename(oldPath, newPath, cb);
              }
            });
          }
        });
      } else {
        cb();
      }
    });
  }

  public stat(path: string, isLstat: boolean, cb: (err: ApiError, stat?: Stats) => void): void {
    // Ignore lstat case -- Dropbox doesn't support symlinks
    // Stat the file
    this._client.stat(path, (error, stat) => {
      if (error) {
        cb(this.convert(error, path));
      } else if ((stat != null) && stat.isRemoved) {
        // Dropbox keeps track of deleted files, so if a file has existed in the
        // past but doesn't any longer, you wont get an error
        cb(ApiError.FileError(ErrorCode.ENOENT, path));
      } else {
        var stats = new Stats(this._statType(stat), stat.size);
        return cb(null, stats);
      }
    });
  }

  public open(path: string, flags: file_flag.FileFlag, mode: number, cb: (err: ApiError, fd?: file.File) => any): void {
    // Try and get the file's contents
    this._client.readFile(path, (error, content, dbStat) => {
      if (error) {
        // If the file's being opened for reading and doesn't exist, return an
        // error
        if (flags.isReadable()) {
          cb(this.convert(error, path));
        } else {
          switch (error.status) {
            // If it's being opened for writing or appending, create it so that
            // it can be written to
            case Dropbox.ApiError.NOT_FOUND:
              var ab = new ArrayBuffer(0);
              return this._writeFileStrict(path, ab, (error2: ApiError, stat?: Dropbox.File.Stat) => {
                if (error2) {
                  cb(error2);
                } else {
                  var file = this._makeFile(path, flags, stat, arrayBuffer2Buffer(ab));
                  cb(null, file);
                }
              });
            default:
              return cb(this.convert(error, path));
          }
        }
      } else {
        // No error
        var buffer: Buffer;
        // Dropbox.js seems to set `content` to `null` rather than to an empty
        // buffer when reading an empty file. Not sure why this is.
        if (content === null) {
          buffer = new Buffer(0);
        } else {
          buffer = arrayBuffer2Buffer(content);
        }
        var file = this._makeFile(path, flags, dbStat, buffer);
        return cb(null, file);
      }
    });
  }

  public _writeFileStrict(p: string, data: ArrayBuffer, cb: (e: ApiError, stat?: Dropbox.File.Stat) => void): void {
    var parent = path.dirname(p);
    this.stat(parent, false, (error: ApiError, stat?: Stats): void => {
      if (error) {
        cb(ApiError.FileError(ErrorCode.ENOENT, parent));
      } else {
        this._client.writeFile(p, data, (error2, stat) => {
          if (error2) {
            cb(this.convert(error2, p));
          } else {
            cb(null, stat);
          }
        });
      }
    });
  }

  /**
   * Private
   * Returns a BrowserFS object representing the type of a Dropbox.js stat object
   */
  public _statType(stat: Dropbox.File.Stat): FileType {
    return stat.isFile ? FileType.FILE : FileType.DIRECTORY;
  }

  /**
   * Private
   * Returns a BrowserFS object representing a File, created from the data
   * returned by calls to the Dropbox API.
   */
  public _makeFile(path: string, flag: file_flag.FileFlag, stat: Dropbox.File.Stat, buffer: NodeBuffer): DropboxFile {
    var type = this._statType(stat);
    var stats = new Stats(type, stat.size);
    return new DropboxFile(this, path, flag, stats, buffer);
  }

  /**
   * Private
   * Delete a file or directory from Dropbox
   * isFile should reflect which call was made to remove the it (`unlink` or
   * `rmdir`). If this doesn't match what's actually at `path`, an error will be
   * returned
   */
  public _remove(path: string, cb: (e?: ApiError) => void, isFile: boolean): void {
    this._client.stat(path, (error, stat) => {
      if (error) {
        cb(this.convert(error, path));
      } else {
        if (stat.isFile && !isFile) {
          cb(ApiError.FileError(ErrorCode.ENOTDIR, path));
        } else if (!stat.isFile && isFile) {
          cb(ApiError.FileError(ErrorCode.EISDIR, path));
        } else {
          this._client.remove(path, (error) => {
            if (error) {
              cb(this.convert(error, path));
            } else {
              cb(null);
            }
          });
        }
      }
    });
  }

  /**
   * Delete a file
   */
  public unlink(path: string, cb: (e?: ApiError) => void): void {
    this._remove(path, cb, true);
  }

  /**
   * Delete a directory
   */
  public rmdir(path: string, cb: (e?: ApiError) => void): void {
    this._remove(path, cb, false);
  }

  /**
   * Create a directory
   */
  public mkdir(p: string, mode: number, cb: (e?: ApiError) => void): void {
    // Dropbox.js' client.mkdir() behaves like `mkdir -p`, i.e. it creates a
    // directory and all its ancestors if they don't exist.
    // Node's fs.mkdir() behaves like `mkdir`, i.e. it throws an error if an attempt
    // is made to create a directory without a parent.
    // To handle this inconsistency, a check for the existence of `path`'s parent
    // must be performed before it is created, and an error thrown if it does
    // not exist
    var parent = path.dirname(p);
    this._client.stat(parent, (error, stat) => {
      if (error) {
        cb(this.convert(error, parent));
      } else {
        this._client.mkdir(p, (error) => {
          if (error) {
            cb(ApiError.FileError(ErrorCode.EEXIST, p));
          } else {
            cb(null);
          }
        });
      }
    });
  }

  /**
   * Get the names of the files in a directory
   */
  public readdir(path: string, cb: (err: ApiError, files?: string[]) => void): void {
    this._client.readdir(path, (error, files) => {
      if (error) {
        return cb(this.convert(error));
      } else {
        return cb(null, files);
      }
    });
  }

  /**
   * Converts a Dropbox-JS error into a BFS error.
   */
  public convert(err: Dropbox.ApiError, path: string = null): ApiError {
    var errorCode = errorCodeLookup[err.status];
    if (errorCode === undefined) {
      errorCode = ErrorCode.EIO;
    }

    if (path == null) {
      return new ApiError(errorCode);
    } else {
      return ApiError.FileError(errorCode, path);
    }
  }
}
