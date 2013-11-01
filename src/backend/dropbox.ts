/// <amd-dependency path="../../vendor/async/lib/async" />
import preload_file = require('../generic/preload_file');
import file_system = require('../core/file_system');
import file_flag = require('../core/file_flag');
import node_fs_stats = require('../core/node_fs_stats');
import buffer = require('../core/buffer');
import api_error = require('../core/api_error');
import file = require('../core/file');
import node_path = require('../core/node_path');
import browserfs = require('../core/browserfs');

var Buffer = buffer.Buffer;
var Stats = node_fs_stats.Stats;
var ApiError = api_error.ApiError;
var ErrorType = api_error.ErrorType;
var path = node_path.path;
var FileType = node_fs_stats.FileType;

// The name `Dropbox` gets clobbered by the filesystem, so save a reference
// to the Dropbox.js client library
// @todo Don't do this.
window['db'] = window['Dropbox'];

declare var db;

// XXX: No typings available for the Dropbox client. :(

// XXX: The typings for async on DefinitelyTyped are out of date.
var async = require('../../vendor/async/lib/async');
var Buffer = buffer.Buffer;

export class DropboxFile extends preload_file.PreloadFile {
  constructor(_fs: file_system.FileSystem, _path: string, _flag: file_flag.FileFlag, _stat: node_fs_stats.Stats, contents?: buffer.Buffer) {
    super(_fs, _path, _flag, _stat, contents)
  }

  public sync(cb: (e?: api_error.ApiError) => void): void {
    (<Dropbox> this._fs)._writeFileStrict(this._path, this._buffer.buff.buffer, cb);
  }

  public close(cb: (e?: api_error.ApiError) => void): void {
    this.sync(cb);
  }
}

export class Dropbox extends file_system.FileSystem {
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
    return typeof db !== 'undefined';
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
    var self = this;
    self.client.readdir('/', function(error, paths, dir, files) {
      if (error) {
        main_cb(error);
      } else {
        var deleteFile = function(file, cb) {
          self.client.remove(file.path, function(err, stat) {
            cb(err);
          });
        };
        var finished = function(err) {
          if (err) {
            main_cb(err);
          } else {
            main_cb();
          }
        };
        async.each(files, deleteFile, finished);
      }
    });
  }

 public rename(oldPath: string, newPath: string, cb: (e?: api_error.ApiError) => void): void {
    var self = this;
    self.client.move(oldPath, newPath, function(error, stat) {
      if (error) {
        self._sendError(cb, "" + oldPath + " doesn't exist");
      } else {
        cb();
      }
    });
  }

  public stat(path: string, isLstat: boolean, cb: (err: api_error.ApiError, stat?: node_fs_stats.Stats) => void): void {
    var self = this;
    // Ignore lstat case -- Dropbox doesn't support symlinks
    // Stat the file
    self.client.stat(path, function(error, stat) {
      // Dropbox keeps track of deleted files, so if a file has existed in the
      // past but doesn't any longer, you wont get an error
      if (error || ((stat != null) && stat.isRemoved)) {
        return self._sendError(cb, "" + path + " doesn't exist");
      } else {
        var stats = new Stats(self._statType(stat), stat.size);
        return cb(null, stats);
      }
    });
  }

  public open(path: string, flags: file_flag.FileFlag, mode: number, cb: (err: api_error.ApiError, fd?: file.BaseFile) => any): void {
    var self = this,
      _this = this;
    // Try and get the file's contents
    self.client.readFile(path, {
      arrayBuffer: true
    }, function(error, content, db_stat, range) {
      if (error) {
        // If the file's being opened for reading and doesn't exist, return an
        // error
        if (flags.isReadable()) {
          return self._sendError(cb, "" + path + " doesn't exist");
        } else {
          switch (error.status) {
            case 0:
              return console.error('No connection');
            // If it's being opened for writing or appending, create it so that
            // it can be written to
            case 404:
              var ab = new ArrayBuffer(0);
              return self._writeFileStrict(path, ab, function(error2, stat) {
                if (error2) {
                  self._sendError(cb, error2);
                } else {
                  var file = self._makeFile(path, flags, stat, new Buffer(ab));
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
        var file = self._makeFile(path, flags, db_stat, buffer);
        return cb(null, file);
      }
    });
  }

  public _writeFileStrict(p: string, data: ArrayBuffer, cb): void {
    var self = this;
    var parent = path.dirname(p);
    self.stat(parent, false, function(error: api_error.ApiError, stat?: node_fs_stats.Stats): void {
      if (error) {
        self._sendError(cb, "Can't create " + p + " because " + parent + " doesn't exist");
      } else {
        self.client.writeFile(p, data, function(error2, stat) {
          if (error2) {
            cb(error2);
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
  public _makeFile(path: string, flag: file_flag.FileFlag, stat, buffer: buffer.Buffer): DropboxFile {
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
    var self = this;
    self.client.stat(path, function(error, stat) {
      var message = null;
      if (error) {
        self._sendError(cb, "" + path + " doesn't exist");
      } else {
        if (stat.isFile && !isFile) {
          self._sendError(cb, "Can't remove " + path + " with rmdir -- it's a file, not a directory. Use `unlink` instead.");
        } else if (!stat.isFile && isFile) {
          self._sendError(cb, "Can't remove " + path + " with unlink -- it's a directory, not a file. Use `rmdir` instead.");
        } else {
          self.client.remove(path, function(error, stat) {
            if (error) {
              self._sendError(cb, "Failed to remove " + path);
            } else {
              cb(null);
            }
          });
        }
      }
    });
  }

  /**
   * Private
   * Create a BrowserFS error object with message msg and pass it to cb
   */
  public _sendError(cb: (e: api_error.ApiError) => void, msg: string): void {
    cb(new ApiError(ErrorType.INVALID_PARAM, msg));
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
    var self = this;
    var parent = path.dirname(p);
    self.client.stat(parent, function(error, stat) {
      if (error) {
        self._sendError(cb, "Can't create " + p + " because " + parent + " doesn't exist");
      } else {
        self.client.mkdir(p, function(error, stat) {
          if (error) {
            self._sendError(cb, "" + p + " already exists");
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
    this.client.readdir(path, function(error, files, dir_stat, content_stats) {
      if (error) {
        return cb(error);
      } else {
        return cb(null, files);
      }
    });
  }
}

browserfs.registerFileSystem('Dropbox', Dropbox);
