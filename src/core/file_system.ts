import api_error = require('api_error');
import stat = require('node_fs_stats');

import file = require('file');
import file_flag = require('file_flag');

import node_path = require('node_path');
import node_fs = require('node_fs');

import buffer = require('buffer');

var ApiError = api_error.ApiError;
var ErrorType = api_error.ErrorType;
var path = node_path.path;
var fs = node_fs.fs;
var Buffer = buffer.Buffer;

export class FileSystem {

  public getName(): string {
    return 'Unspecified';
  }

  public static isAvailable(): boolean {
    return false;
  }

  public diskSpace(p: string, cb: (total: number, free: number) => any): void {
    cb(0, 0);
  }

  public isReadOnly(): boolean {
    return true;
  }

  public supportsLinks(): boolean {
    return false;
  }

  public supportsProps(): boolean {
    return false;
  }

  public supportsSynch(): boolean {
    return false;
  }

  public rename(oldPath: string, newPath: string, cb: Function): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  public renameSync(oldPath: string, newPath: string): void {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public stat(p: string, isLstat: boolean, cb: (err: api_error.ApiError, stat?: stat.Stats) => void): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  public statSync(p: string, isLstat: boolean): stat.Stats {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public open(p: string, flag:file_flag.FileFlag, mode: number, cb: (err: api_error.ApiError, fd?: file.BaseFile) => any): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  public openSync(p: string, flag: file_flag.FileFlag, mode: number): file.BaseFile {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public unlink(p: string, cb: Function): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  public unlinkSync(p: string): void {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public rmdir(p: string, cb: Function): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  public rmdirSync(p: string): void {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public mkdir(p: string, mode: number, cb: Function): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  public mkdirSync(p: string, mode: number): void {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public readdir(p: string, cb: (err: api_error.ApiError, files?: string[]) => void): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  public readdirSync(p: string): string[] {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public exists(p: string, cb: (exists: boolean) => void): void {
    this.stat(p, null, function(err) {
      cb(err == null);
    });
  }

  public existsSync(p: string): boolean {
    try {
      this.statSync(p, true);
      return true;
    } catch (e) {
      return false;
    }
  }

  public realpath(p: string, cache: {[path: string]: string}, cb: (err: api_error.ApiError, resolvedPath?: string) => any): void {
    if (this.supportsLinks()) {
      var splitPath = p.split(path.sep);
      for (var i = 0; i < splitPath.length; i++) {
        var addPaths = splitPath.slice(0, i + 1);
        splitPath[i] = path.join.apply(null, addPaths);
      }
    } else {
      this.exists(p, function(doesExist) {
        if (doesExist) {
          cb(null, p);
        } else {
          cb(new ApiError(ErrorType.NOT_FOUND, "File " + p + " not found."));
        }
      });
    }
  }

  public realpathSync(p: string, cache: {[path: string]: string}): string {
    if (this.supportsLinks()) {
      var splitPath = p.split(path.sep);
      for (var i = 0; i < splitPath.length; i++) {
        var addPaths = splitPath.slice(0, i + 1);
        splitPath[i] = path.join.apply(null, addPaths);
      }
    } else {
      if (this.existsSync(p)) {
        return p;
      } else {
        throw new ApiError(ErrorType.NOT_FOUND, "File " + p + " not found.");
      }
    }
  }

  public truncate(p: string, len: number, cb: Function): void {
    fs.open(p, 'w', (function(er: api_error.ApiError, fd?: file.BaseFile) {
      if (er) {
        return cb(er);
      }
      fs.ftruncate(fd, len, (function(er) {
        fs.close(fd, (function(er2) {
          cb(er || er2);
        }));
      }));
    }));
  }

  public truncateSync(p: string, len: number): void {
    var fd = fs.openSync(p, 'w');
    try {
      fs.ftruncateSync(fd, len);
    } catch (e) {
      throw e;
    } finally {
      fs.closeSync(fd);
    }
  }

  public readFile(fname: string, encoding: string, flag: file_flag.FileFlag, cb: (err: api_error.ApiError, data?: any) => void): void {
    var oldCb = cb;
    this.open(fname, flag, 0x1a4, function(err: api_error.ApiError, fd?: file.BaseFile) {
      if (err) {
        return cb(err);
      }
      cb = function(err: api_error.ApiError, arg?: file.BaseFile) {
        fd.close(function(err2) {
          if (err == null) {
            err = err2;
          }
          return oldCb(err, arg);
        });
      };
      fs.fstat(fd, function(err: api_error.ApiError, stat?: stat.Stats) {
        if (err != null) {
          return cb(err);
        }
        var buf = new Buffer(stat.size);
        fs.read(fd, buf, 0, stat.size, 0, function(err) {
          if (err != null) {
            return cb(err);
          } else if (encoding === null) {
            return cb(err, buf);
          }
          try {
            cb(null, buf.toString(encoding));
          } catch (e) {
            cb(e);
          }
        });
      });
    });
  }

  public readFileSync(fname: string, encoding: string, flag: file_flag.FileFlag): any {
    var fd = this.openSync(fname, flag, 0x1a4);
    try {
      var stat = fs.fstatSync(fd);
      var buf = new Buffer(stat.size);
      fs.readSync(fd, buf, 0, stat.size, 0);
      fs.closeSync(fd);
      if (encoding === null) {
        return buf;
      }
      return buf.toString(encoding);
    } catch (e) {
      fs.closeSync(fd);
      throw e;
    }
  }

  public writeFile(fname: string, data: any, encoding: string, flag: file_flag.FileFlag, mode: number, cb: (err: api_error.ApiError) => void): void {
    var oldCb = cb;
    this.open(fname, flag, 0x1a4, function(err: api_error.ApiError, fd?:file.BaseFile) {
      if (err != null) {
        return cb(err);
      }
      cb = function(err: api_error.ApiError) {
        fd.close(function(err2) {
          oldCb(err != null ? err : err2);
        });
      };

      try {
        if (typeof data === 'string') {
          data = new Buffer(data, encoding);
        }
      } catch (e) {
        return cb(e);
      }
      fd.write(data, 0, data.length, 0, cb);
    });
  }

  public writeFileSync(fname: string, data: any, encoding: string, flag: file_flag.FileFlag, mode: number): void {
    var fd = this.openSync(fname, flag, mode);
    try {
      if (typeof data === 'string') {
        data = new Buffer(data, encoding);
      }
      fd.writeSync(data, 0, data.length, 0);
    } finally {
      fs.closeSync(fd);
    }
  }

  public appendFile(fname: string, data: any, encoding: string, flag: file_flag.FileFlag, mode: number, cb: (err: api_error.ApiError) => void): void {
    var oldCb = cb;
    this.open(fname, flag, mode, function(err: api_error.ApiError, fd?: file.BaseFile) {
      if (err != null) {
        return cb(err);
      }
      cb = function(err: api_error.ApiError) {
        fd.close(function(err2) {
          oldCb(err != null ? err : err2);
        });
      };
      if (typeof data === 'string') {
        data = new Buffer(data, encoding);
      }
      fd.write(data, 0, data.length, null, cb);
    });
  }

  public appendFileSync(fname: string, data: any, encoding: string, flag: file_flag.FileFlag, mode: number): void {
    var fd = this.openSync(fname, flag, mode);
    try {
      if (typeof data === 'string') {
        data = new Buffer(data, encoding);
      }
      fd.writeSync(data, 0, data.length, null);
    } finally {
      fs.closeSync(fd);
    }
  }

  public chmod(p: string, isLchmod: boolean, mode: number, cb: Function): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  public chmodSync(p: string, isLchmod: boolean, mode: number) {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public chown(p: string, isLchown: boolean, uid: number, gid: number, cb: Function): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  public chownSync(p: string, isLchown: boolean, uid: number, gid: number): void {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public utimes(p: string, atime: Date, mtime: Date, cb: Function): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  public utimesSync(p: string, atime: Date, mtime: Date): void {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public link(srcpath: string, dstpath: string, cb: Function): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  public linkSync(srcpath: string, dstpath: string): void {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public symlink(srcpath: string, dstpath: string, type: string, cb: Function): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  public symlinkSync(srcpath: string, dstpath: string, type: string): void {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public readlink(p: string, cb: Function): void {
    cb(new ApiError(ErrorType.NOT_SUPPORTED));
  }

  public readlinkSync(p: string): string {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }
}

export class SynchronousFileSystem extends FileSystem {
  public supportsSynch(): boolean {
    return true;
  }

  public rename(oldPath: string, newPath: string, cb: Function): void {
    try {
      this.renameSync(oldPath, newPath);
      cb();
    } catch (e) {
      cb(e);
    }
  }

  public stat(p: string, isLstat: boolean, cb: Function): void {
    try {
      cb(null, this.statSync(p, isLstat));
    } catch (e) {
      cb(e);
    }
  }

  public open(p: string, flags: file_flag.FileFlag, mode: number, cb: Function): void {
    try {
      cb(null, this.openSync(p, flags, mode));
    } catch (e) {
      cb(e);
    }
  }

  public unlink(p: string, cb: Function): void {
    try {
      this.unlinkSync(p);
      cb();
    } catch (e) {
      cb(e);
    }
  }

  public rmdir(p: string, cb: Function): void {
    try {
      this.rmdirSync(p);
      cb();
    } catch (e) {
      cb(e);
    }
  }

  public mkdir(p: string, mode: number, cb: Function): void {
    try {
      this.mkdirSync(p, mode);
      cb();
    } catch (e) {
      cb(e);
    }
  }

  public readdir(p: string, cb: Function): void {
    try {
      cb(null, this.readdirSync(p));
    } catch (e) {
      cb(e);
    }
  }

  public chmod(p: string, isLchmod: boolean, mode: number, cb: Function): void {
    try {
      this.chmodSync(p, isLchmod, mode);
      cb();
    } catch (e) {
      cb(e);
    }
  }

  public chown(p: string, isLchown: boolean, uid: number, gid: number, cb: Function): void {
    try {
      this.chownSync(p, isLchown, uid, gid);
      cb();
    } catch (e) {
      cb(e);
    }
  }

  public utimes(p: string, atime: Date, mtime: Date, cb: Function): void {
    try {
      this.utimesSync(p, atime, mtime);
      cb();
    } catch (e) {
      cb(e);
    }
  }

  public link(srcpath: string, dstpath: string, cb: Function): void {
    try {
      this.linkSync(srcpath, dstpath);
      cb();
    } catch (e) {
      cb(e);
    }
  }

  public symlink(srcpath: string, dstpath: string, type: string, cb: Function): void {
    try {
      this.symlinkSync(srcpath, dstpath, type);
      cb();
    } catch (e) {
      cb(e);
    }
  }

  public readlink(p: string, cb: Function): void {
    try {
      cb(null, this.readlinkSync(p));
    } catch (e) {
      cb(e);
    }
  }
}
