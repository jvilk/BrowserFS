/// <amd-dependency path="async" />
import preload_file = require('../generic/preload_file');
import file_system = require('../core/file_system');
import file_flag = require('../core/file_flag');
import node_fs_stats = require('../core/node_fs_stats');
import buffer = require('../core/buffer');
import api_error = require('../core/api_error');
import file = require('../core/file');
import node_path = require('../core/node_path');
import browserfs = require('../core/browserfs');
import buffer_core_arraybuffer = require('../core/buffer_core_arraybuffer');

declare var Dropbox;
var Buffer = buffer.Buffer;
var Stats = node_fs_stats.Stats;
var ApiError = api_error.ApiError;
var ErrorCode = api_error.ErrorCode;
var path = node_path.path;
var FileType = node_fs_stats.FileType;

// XXX: No typings available for the Dropbox client. :(

// XXX: The typings for async on DefinitelyTyped are out of date.
var async = require('async');
var Buffer = buffer.Buffer;

export class DropboxFile extends preload_file.PreloadFile implements file.File {
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
    (<DropboxFileSystem> this._fs)._writeFileStrict(this._path, abv, cb);
  }

  public close(cb: (e?: api_error.ApiError) => void): void {
    this.sync(cb);
  }
}

export class DropboxFileSystem extends file_system.BaseFileSystem implements file_system.FileSystem {
  // The Dropbox client.
  private client: any;
  /**
   * Arguments: an authenticated Dropbox.js client
   */
  constructor(client: any) {
    super();
    this.client = client;
  }

  public getName(): string {
    return 'Dropbox';
  }

  public static isAvailable(): boolean {
    // Checks if the Dropbox library is loaded.
    // @todo Check if the Dropbox library *can be used* in the current browser.
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

  public empty(main_cb: (e?: api_error.ApiError) => void): void {
    this.client.readdir('/', (error, paths, dir, files) => {
      if (error) {
        main_cb(this.convert(error));
      } else {
        var deleteFile = (file, cb) => {
          this.client.remove(file.path, (err, stat) => {
            cb(err ? this.convert(err) : err);
          });
        };
        var finished = (err) => {
          if (err) {
            main_cb(this.convert(err));
          } else {
            main_cb();
          }
        };
        async.each(files, deleteFile, finished);
      }
    });
  }

 public rename(oldPath: string, newPath: string, cb: (e?: api_error.ApiError) => void): void {
    this.client.move(oldPath, newPath, (error, stat) => {
      if (error) {
        // XXX: Assume 404 for now.
        var missingPath = error.response.error.indexOf(oldPath) > -1 ? oldPath : newPath;
        cb(new ApiError(ErrorCode.ENOENT, missingPath + " doesn't exist"));
      } else {
        cb();
      }
    });
  }

  public stat(path: string, isLstat: boolean, cb: (err: api_error.ApiError, stat?: node_fs_stats.Stats) => void): void {
    // Ignore lstat case -- Dropbox doesn't support symlinks
    // Stat the file
    this.client.stat(path, (error, stat) => {
      // Dropbox keeps track of deleted files, so if a file has existed in the
      // past but doesn't any longer, you wont get an error
      if (error || ((stat != null) && stat.isRemoved)) {
        cb(new ApiError(ErrorCode.ENOENT, path + " doesn't exist"));
      } else {
        var stats = new Stats(this._statType(stat), stat.size);
        return cb(null, stats);
      }
    });
  }

  public open(path: string, flags: file_flag.FileFlag, mode: number, cb: (err: api_error.ApiError, fd?: file.File) => any): void {
    // Try and get the file's contents
    this.client.readFile(path, {
      arrayBuffer: true
    }, (error, content, db_stat, range) => {
      if (error) {
        // If the file's being opened for reading and doesn't exist, return an
        // error
        if (flags.isReadable()) {
          cb(new ApiError(ErrorCode.ENOENT, path + " doesn't exist"));
        } else {
          switch (error.status) {
            case 0:
              return console.error('No connection');
            // If it's being opened for writing or appending, create it so that
            // it can be written to
            case 404:
              var ab = new ArrayBuffer(0);
              return this._writeFileStrict(path, ab, (error2: api_error.ApiError, stat?: node_fs_stats.Stats) => {
                if (error2) {
                  cb(error2);
                } else {
                  var file = this._makeFile(path, flags, stat, new Buffer(ab));
                  cb(null, file);
                }
              });
            default:
              return console.log("Unhandled error: " + error);
          }
        }
      } else {
        // No error
        var buffer;
        // Dropbox.js seems to set `content` to `null` rather than to an empty
        // buffer when reading an empty file. Not sure why this is.
        if (content === null) {
          buffer = new Buffer(0);
        } else {
          buffer = new Buffer(content);
        }
        var file = this._makeFile(path, flags, db_stat, buffer);
        return cb(null, file);
      }
    });
  }

  public _writeFileStrict(p: string, data: ArrayBuffer, cb: (e: api_error.ApiError, stat?: node_fs_stats.Stats) => void): void;
  public _writeFileStrict(p: string, data: ArrayBufferView, cb: (e: api_error.ApiError, stat?: node_fs_stats.Stats) => void): void;
  public _writeFileStrict(p: string, data: any, cb: (e: api_error.ApiError, stat?: node_fs_stats.Stats) => void): void {
    var parent = path.dirname(p);
    this.stat(parent, false, (error: api_error.ApiError, stat?: node_fs_stats.Stats): void => {
      if (error) {
        cb(new ApiError(ErrorCode.ENOENT, "Can't create " + p + " because " + parent + " doesn't exist"));
      } else {
        this.client.writeFile(p, data, (error2, stat) => {
          if (error2) {
            cb(this.convert(error2));
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
  public _statType(stat): node_fs_stats.FileType {
    return stat.isFile ? FileType.FILE : FileType.DIRECTORY;
  }

  /**
   * Private
   * Returns a BrowserFS object representing a File, created from the data
   * returned by calls to the Dropbox API.
   */
  public _makeFile(path: string, flag: file_flag.FileFlag, stat, buffer: NodeBuffer): DropboxFile {
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
  public _remove(path: string, cb: (e?: api_error.ApiError) => void, isFile: boolean): void {
    this.client.stat(path, (error, stat) => {
      var message = null;
      if (error) {
        cb(new ApiError(ErrorCode.ENOENT, path + " doesn't exist"));
      } else {
        if (stat.isFile && !isFile) {
          cb(new ApiError(ErrorCode.ENOTDIR, path + " is a file."));
        } else if (!stat.isFile && isFile) {
          cb(new ApiError(ErrorCode.EISDIR, path + " is a directory."));
        } else {
          this.client.remove(path, (error, stat) => {
            if (error) {
              // @todo Make this more specific.
              cb(new ApiError(ErrorCode.EIO, "Failed to remove " + path));
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
  public unlink(path: string, cb: (e?: api_error.ApiError) => void): void {
    this._remove(path, cb, true);
  }

  /**
   * Delete a directory
   */
  public rmdir(path: string, cb: (e?: api_error.ApiError) => void): void {
    this._remove(path, cb, false);
  }

  /**
   * Create a directory
   */
  public mkdir(p: string, mode: number, cb: (e?: api_error.ApiError) => void): void {
    // Dropbox.js' client.mkdir() behaves like `mkdir -p`, i.e. it creates a
    // directory and all its ancestors if they don't exist.
    // Node's fs.mkdir() behaves like `mkdir`, i.e. it throws an error if an attempt
    // is made to create a directory without a parent.
    // To handle this inconsistency, a check for the existence of `path`'s parent
    // must be performed before it is created, and an error thrown if it does
    // not exist
    var parent = path.dirname(p);
    this.client.stat(parent, (error, stat) => {
      if (error) {
        cb(new ApiError(ErrorCode.ENOENT, "Can't create " + p + " because " + parent + " doesn't exist"));
      } else {
        this.client.mkdir(p, (error, stat) => {
          if (error) {
            cb(new ApiError(ErrorCode.EEXIST, p + " already exists"));
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
  public readdir(path: string, cb: (err: api_error.ApiError, files?: string[]) => void): void {
    this.client.readdir(path, (error, files, dir_stat, content_stats) => {
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
  public convert(err: any, message: string = ""): api_error.ApiError {
    switch(err.status) {
      case 400:
        // INVALID_PARAM
        return new ApiError(ErrorCode.EINVAL, message);
      case 401:
        // INVALID_TOKEN (OAuth)
      case 403:
        // OAUTH_ERROR
        return new ApiError(ErrorCode.EIO, message);
      case 404:
        // NOT_FOUND
        return new ApiError(ErrorCode.ENOENT, message);
      case 405:
        // INVALID_METHOD
        return new ApiError(ErrorCode.ENOTSUP, message);
      // Non-specific errors
      case 0:
        // NETWORK_ERROR
      case 304:
        // NO_CONTENT
      case 406:
        // NOT_ACCEPTABLE (too much content in result)
      case 409:
        // CONFLICT (should never happen).
      default:
        return new ApiError(ErrorCode.EIO, message);
    }
  }
}

browserfs.registerFileSystem('Dropbox', DropboxFileSystem);
