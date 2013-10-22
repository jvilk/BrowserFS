import file = require('../core/file');
import file_system = require('../core/file_system');
import node_fs_stats = require('../core/node_fs_stats');
import buffer = require('../core/buffer');
import file_flag = require('../core/file_flag');
import api_error = require('../core/api_error');
import node_fs = require('../core/node_fs');

var ApiError = api_error.ApiError;
var ErrorType = api_error.ErrorType;
var fs = node_fs.fs;
var Buffer = buffer.Buffer;
export class PreloadFile extends file.BaseFile {
  private _fs: file_system.FileSystem;
  private _path: string;
  private _stat: node_fs_stats.Stats;
  private _pos: number = 0;
  // XXX: Some backends manipulate these directly :(
  public _flag: file_flag.FileFlag;
  public _buffer: buffer.Buffer;
  constructor(_fs: file_system.FileSystem, _path: string, _flag: file_flag.FileFlag, _stat: node_fs_stats.Stats, contents?: buffer.Buffer) {
    super();
    this._fs = _fs;
    this._path = _path;
    this._flag = _flag;
    this._stat = _stat;
    if (contents != null) {
      this._buffer = contents;
    } else {
      this._buffer = new Buffer(0);
    }
    if (this._stat.size !== this._buffer.length) {
      throw new Error("Invalid buffer: Buffer is " + this._buffer.length + " long, yet Stats object specifies that file is " + this._stat.size + " long.");
    }
  }

  public getPath(): string {
    return this._path;
  }

  public getPos(): number {
    if (this._flag.isAppendable()) {
      return this._stat.size;
    }
    return this._pos;
  }

  public advancePos(delta: number): number {
    return this._pos += delta;
  }

  public setPos(newPos: number): number {
    return this._pos = newPos;
  }

  public sync(cb: (e?: api_error.ApiError) => void): void {
    try {
      this.syncSync();
      cb();
    } catch (e) {
      cb(e);
    }
  }

  public syncSync(): void {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public close(cb: (e?: api_error.ApiError) => void): void {
    try {
      this.closeSync();
      cb();
    } catch (e) {
      cb(e);
    }
  }

  public closeSync(): void {
    throw new ApiError(ErrorType.NOT_SUPPORTED);
  }

  public stat(cb: (e: api_error.ApiError, stat?: node_fs_stats.Stats) => void): void {
    try {
      cb(null, this._stat.clone());
    } catch (e) {
      cb(e);
    }
  }

  public statSync(): node_fs_stats.Stats {
    return this._stat.clone();
  }

  public truncate(len: number, cb: (e?: api_error.ApiError) => void): void {
    try {
      this.truncateSync(len);
      if (this._flag.isSynchronous() && !fs.getRootFS().supportsSynch()) {
        this.sync(cb);
      }
      cb();
    } catch (e) {
      return cb(e);
    }
  }

  public truncateSync(len: number): void {
    if (!this._flag.isWriteable()) {
      throw new ApiError(ErrorType.PERMISSIONS_ERROR, 'File not opened with a writeable mode.');
    }
    this._stat.mtime = new Date();
    if (len > this._buffer.length) {
      var buf = new Buffer(len - this._buffer.length);
      buf.fill(0);
      this.writeSync(buf, 0, buf.length, this._buffer.length);
      if (this._flag.isSynchronous() && fs.getRootFS().supportsSynch()) {
        this.syncSync();
      }
      return;
    }
    this._stat.size = len;
    var newBuff = new Buffer(len);
    this._buffer.copy(newBuff, 0, 0, len);
    this._buffer = newBuff;
    if (this._flag.isSynchronous() && fs.getRootFS().supportsSynch()) {
      this.syncSync();
    }
  }

  public write(buffer: buffer.Buffer, offset: number, length: number, position: number, cb: (e: api_error.ApiError, len?: number, buff?: buffer.Buffer) => void): void {
    try {
      cb(null, this.writeSync(buffer, offset, length, position), buffer);
    } catch (e) {
      cb(e);
    }
  }

  public writeSync(buffer: buffer.Buffer, offset: number, length: number, position: number): number {
    if (position == null) {
      position = this.getPos();
    }
    if (!this._flag.isWriteable()) {
      throw new ApiError(ErrorType.PERMISSIONS_ERROR, 'File not opened with a writeable mode.');
    }
    var endFp = position + length;
    if (endFp > this._stat.size) {
      this._stat.size = endFp;
      if (endFp > this._buffer.length) {
        var newBuff = new Buffer(endFp);
        this._buffer.copy(newBuff);
        this._buffer = newBuff;
      }
    }
    var len = buffer.copy(this._buffer, position, offset, offset + length);
    this._stat.mtime = new Date();
    if (this._flag.isSynchronous()) {
      this.syncSync();
      return len;
    }
    this.setPos(position + len);
    return len;
  }

  public read(buffer: buffer.Buffer, offset: number, length: number, position: number, cb: (e: api_error.ApiError, len?: number, buff?: buffer.Buffer) => void): void {
    try {
      cb(null, this.readSync(buffer, offset, length, position), buffer);
    } catch (e) {
      cb(e);
    }
  }

  public readSync(buffer: buffer.Buffer, offset: number, length: number, position: number): number {
    if (!this._flag.isReadable()) {
      throw new ApiError(ErrorType.PERMISSIONS_ERROR, 'File not opened with a readable mode.');
    }
    if (position == null) {
      position = this.getPos();
    }
    var endRead = position + length;
    if (endRead > this._stat.size) {
      length = this._stat.size - position;
    }
    var rv = this._buffer.copy(buffer, offset, position, position + length);
    this._stat.atime = new Date();
    this._pos = position + length;
    return rv;
  }

  public chmod(mode: number, cb: (e?: api_error.ApiError) => void): void {
    try {
      this.chmodSync(mode);
      cb();
    } catch (e) {
      cb(e);
    }
  }

  public chmodSync(mode: number): void {
    if (!this._fs.supportsProps()) {
      throw new ApiError(ErrorType.NOT_SUPPORTED);
    }
    this._stat.mode = mode;
    this.syncSync();
  }
}

export class NoSyncFile extends PreloadFile {
  constructor(_fs: file_system.FileSystem, _path: string, _flag: file_flag.FileFlag, _stat: node_fs_stats.Stats, contents?: buffer.Buffer) {
    super(_fs, _path, _flag, _stat, contents);
  }

  public sync(cb: (e?: api_error.ApiError) => void): void {
    cb();
  }

  public syncSync(): void {}

  public close(cb: (e?: api_error.ApiError) => void): void {
    cb();
  }

  public closeSync(): void {}
}
