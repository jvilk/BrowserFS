import file = require('../core/file');
import file_system = require('../core/file_system');
import node_fs_stats = require('../core/node_fs_stats');
import buffer = require('../core/buffer');
import file_flag = require('../core/file_flag');
import api_error = require('../core/api_error');
import node_fs = require('../core/node_fs');

var ApiError = api_error.ApiError;
var ErrorCode = api_error.ErrorCode;
var fs = node_fs.fs;
var Buffer = buffer.Buffer;
/**
 * An implementation of the File interface that operates on a file that is
 * completely in-memory. PreloadFiles are backed by a Buffer.
 *
 * This is also an abstract class, as it lacks an implementation of 'sync' and
 * 'close'. Each filesystem that wishes to use this file representation must
 * extend this class and implement those two methods.
 * @todo 'close' lever that disables functionality once closed.
 */
export class PreloadFile extends file.BaseFile {
  private _pos: number = 0;
  // XXX: Some backends manipulate these directly :(
  public _path: string;
  public _fs: file_system.FileSystem;
  public _stat: node_fs_stats.Stats;
  public _flag: file_flag.FileFlag;
  public _buffer: NodeBuffer;
  /**
   * Creates a file with the given path and, optionally, the given contents. Note
   * that, if contents is specified, it will be mutated by the file!
   * @param [BrowserFS.FileSystem] _fs The file system that created the file.
   * @param [String] _path
   * @param [BrowserFS.FileMode] _mode The mode that the file was opened using.
   *   Dictates permissions and where the file pointer starts.
   * @param [BrowserFS.node.fs.Stats] _stat The stats object for the given file.
   *   PreloadFile will mutate this object. Note that this object must contain
   *   the appropriate mode that the file was opened as.
   * @param [BrowserFS.node.Buffer?] contents A buffer containing the entire
   *   contents of the file. PreloadFile will mutate this buffer. If not
   *   specified, we assume it is a new file.
   */
  constructor(_fs: file_system.FileSystem, _path: string, _flag: file_flag.FileFlag, _stat: node_fs_stats.Stats, contents?: NodeBuffer) {
    super();
    this._fs = _fs;
    this._path = _path;
    this._flag = _flag;
    this._stat = _stat;
    if (contents != null) {
      this._buffer = contents;
    } else {
      // Empty buffer. It'll expand once we write stuff to it.
      this._buffer = new Buffer(0);
    }
    // Note: This invariant is *not* maintained once the file starts getting
    // modified.
    if (this._stat.size !== this._buffer.length) {
      throw new Error("Invalid buffer: Buffer is " + this._buffer.length + " long, yet Stats object specifies that file is " + this._stat.size + " long.");
    }
  }

  /**
   * Get the path to this file.
   * @return [String] The path to the file.
   */
  public getPath(): string {
    return this._path;
  }

  /**
   * Get the current file position.
   *
   * We emulate the following bug mentioned in the Node documentation:
   * > On Linux, positional writes don't work when the file is opened in append
   *   mode. The kernel ignores the position argument and always appends the data
   *   to the end of the file.
   * @return [Number] The current file position.
   */
  public getPos(): number {
    if (this._flag.isAppendable()) {
      return this._stat.size;
    }
    return this._pos;
  }

  /**
   * Advance the current file position by the indicated number of positions.
   * @param [Number] delta
   */
  public advancePos(delta: number): number {
    return this._pos += delta;
  }

  /**
   * Set the file position.
   * @param [Number] newPos
   */
  public setPos(newPos: number): number {
    return this._pos = newPos;
  }

  /**
   * **Core**: Asynchronous sync. Must be implemented by subclasses of this
   * class.
   * @param [Function(BrowserFS.ApiError)] cb
   */
  public sync(cb: (e?: api_error.ApiError) => void): void {
    try {
      this.syncSync();
      cb();
    } catch (e) {
      cb(e);
    }
  }

  /**
   * **Core**: Synchronous sync.
   */
  public syncSync(): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }

  /**
   * **Core**: Asynchronous close. Must be implemented by subclasses of this
   * class.
   * @param [Function(BrowserFS.ApiError)] cb
   */
  public close(cb: (e?: api_error.ApiError) => void): void {
    try {
      this.closeSync();
      cb();
    } catch (e) {
      cb(e);
    }
  }

  /**
   * **Core**: Synchronous close.
   */
  public closeSync(): void {
    throw new ApiError(ErrorCode.ENOTSUP);
  }

  /**
   * Asynchronous `stat`.
   * @param [Function(BrowserFS.ApiError, BrowserFS.node.fs.Stats)] cb
   */
  public stat(cb: (e: api_error.ApiError, stat?: node_fs_stats.Stats) => void): void {
    try {
      cb(null, this._stat.clone());
    } catch (e) {
      cb(e);
    }
  }

  /**
   * Synchronous `stat`.
   */
  public statSync(): node_fs_stats.Stats {
    return this._stat.clone();
  }

  /**
   * Asynchronous truncate.
   * @param [Number] len
   * @param [Function(BrowserFS.ApiError)] cb
   */
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

  /**
   * Synchronous truncate.
   * @param [Number] len
   */
  public truncateSync(len: number): void {
    if (!this._flag.isWriteable()) {
      throw new ApiError(ErrorCode.EPERM, 'File not opened with a writeable mode.');
    }
    this._stat.mtime = new Date();
    if (len > this._buffer.length) {
      var buf = new Buffer(len - this._buffer.length);
      buf.fill(0);
      // Write will set @_stat.size for us.
      this.writeSync(buf, 0, buf.length, this._buffer.length);
      if (this._flag.isSynchronous() && fs.getRootFS().supportsSynch()) {
        this.syncSync();
      }
      return;
    }
    this._stat.size = len;
    // Truncate buffer to 'len'.
    var newBuff = new Buffer(len);
    this._buffer.copy(newBuff, 0, 0, len);
    this._buffer = newBuff;
    if (this._flag.isSynchronous() && fs.getRootFS().supportsSynch()) {
      this.syncSync();
    }
  }

  /**
   * Write buffer to the file.
   * Note that it is unsafe to use fs.write multiple times on the same file
   * without waiting for the callback.
   * @param [BrowserFS.node.Buffer] buffer Buffer containing the data to write to
   *  the file.
   * @param [Number] offset Offset in the buffer to start reading data from.
   * @param [Number] length The amount of bytes to write to the file.
   * @param [Number] position Offset from the beginning of the file where this
   *   data should be written. If position is null, the data will be written at
   *   the current position.
   * @param [Function(BrowserFS.ApiError, Number, BrowserFS.node.Buffer)]
   *   cb The number specifies the number of bytes written into the file.
   */
  public write(buffer: NodeBuffer, offset: number, length: number, position: number, cb: (e: api_error.ApiError, len?: number, buff?: NodeBuffer) => void): void {
    try {
      cb(null, this.writeSync(buffer, offset, length, position), buffer);
    } catch (e) {
      cb(e);
    }
  }

  /**
   * Write buffer to the file.
   * Note that it is unsafe to use fs.writeSync multiple times on the same file
   * without waiting for the callback.
   * @param [BrowserFS.node.Buffer] buffer Buffer containing the data to write to
   *  the file.
   * @param [Number] offset Offset in the buffer to start reading data from.
   * @param [Number] length The amount of bytes to write to the file.
   * @param [Number] position Offset from the beginning of the file where this
   *   data should be written. If position is null, the data will be written at
   *   the current position.
   * @return [Number]
   */
  public writeSync(buffer: NodeBuffer, offset: number, length: number, position: number): number {
    if (position == null) {
      position = this.getPos();
    }
    if (!this._flag.isWriteable()) {
      throw new ApiError(ErrorCode.EPERM, 'File not opened with a writeable mode.');
    }
    var endFp = position + length;
    if (endFp > this._stat.size) {
      this._stat.size = endFp;
      if (endFp > this._buffer.length) {
        // Extend the buffer!
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

  /**
   * Read data from the file.
   * @param [BrowserFS.node.Buffer] buffer The buffer that the data will be
   *   written to.
   * @param [Number] offset The offset within the buffer where writing will
   *   start.
   * @param [Number] length An integer specifying the number of bytes to read.
   * @param [Number] position An integer specifying where to begin reading from
   *   in the file. If position is null, data will be read from the current file
   *   position.
   * @param [Function(BrowserFS.ApiError, Number, BrowserFS.node.Buffer)] cb The
   *   number is the number of bytes read
   */
  public read(buffer: NodeBuffer, offset: number, length: number, position: number, cb: (e: api_error.ApiError, len?: number, buff?: NodeBuffer) => void): void {
    try {
      cb(null, this.readSync(buffer, offset, length, position), buffer);
    } catch (e) {
      cb(e);
    }
  }

  /**
   * Read data from the file.
   * @param [BrowserFS.node.Buffer] buffer The buffer that the data will be
   *   written to.
   * @param [Number] offset The offset within the buffer where writing will
   *   start.
   * @param [Number] length An integer specifying the number of bytes to read.
   * @param [Number] position An integer specifying where to begin reading from
   *   in the file. If position is null, data will be read from the current file
   *   position.
   * @return [Number]
   */
  public readSync(buffer: NodeBuffer, offset: number, length: number, position: number): number {
    if (!this._flag.isReadable()) {
      throw new ApiError(ErrorCode.EPERM, 'File not opened with a readable mode.');
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

  /**
   * Asynchronous `fchmod`.
   * @param [Number|String] mode
   * @param [Function(BrowserFS.ApiError)] cb
   */
  public chmod(mode: number, cb: (e?: api_error.ApiError) => void): void {
    try {
      this.chmodSync(mode);
      cb();
    } catch (e) {
      cb(e);
    }
  }

  /**
   * Asynchronous `fchmod`.
   * @param [Number] mode
   */
  public chmodSync(mode: number): void {
    if (!this._fs.supportsProps()) {
      throw new ApiError(ErrorCode.ENOTSUP);
    }
    this._stat.chmod(mode);
    this.syncSync();
  }
}

/**
 * File class for the InMemory and XHR file systems.
 * Doesn't sync to anything, so it works nicely for memory-only files.
 */
export class NoSyncFile extends PreloadFile implements file.File {
  constructor(_fs: file_system.FileSystem, _path: string, _flag: file_flag.FileFlag, _stat: node_fs_stats.Stats, contents?: NodeBuffer) {
    super(_fs, _path, _flag, _stat, contents);
  }
  /**
   * Asynchronous sync. Doesn't do anything, simply calls the cb.
   * @param [Function(BrowserFS.ApiError)] cb
   */
  public sync(cb: (e?: api_error.ApiError) => void): void {
    cb();
  }
  /**
   * Synchronous sync. Doesn't do anything.
   */
  public syncSync(): void {}
  /**
   * Asynchronous close. Doesn't do anything, simply calls the cb.
   * @param [Function(BrowserFS.ApiError)] cb
   */
  public close(cb: (e?: api_error.ApiError) => void): void {
    cb();
  }
  /**
   * Synchronous close. Doesn't do anything.
   */
  public closeSync(): void {}
}
