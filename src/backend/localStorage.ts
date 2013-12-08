import indexed_filesystem = require('../generic/indexed_filesystem');
import preload_file = require('../generic/preload_file');
import node_fs_stats = require('../core/node_fs_stats');
import file_flag = require('../core/file_flag');
import buffer = require('../core/buffer');
import file_index = require('../generic/file_index');
import string_util = require('../core/string_util');
import api_error = require('../core/api_error');
import node_path = require('../core/node_path');
import file_system = require('../core/file_system');
import browserfs = require('../core/browserfs');
import file = require('../core/file');

var Buffer = buffer.Buffer;
var Stats = node_fs_stats.Stats;
var FileType = node_fs_stats.FileType;
var ApiError = api_error.ApiError;
var ErrorCode = api_error.ErrorCode;
var path = node_path.path;
/**
 * A simple filesystem backed by local storage.
 *
 * Note that your program should only ever have one instance of this class.
 * @todo Pack names efficiently: Convert to UTF-8, then convert to a packed
 *   UTF-16 representation (each character is 2 bytes).
 * @todo Store directory information explicitly. Could do something cool, like
 *   have directory information contain the keys for each subitem, where the
 *   key doesn't have to be the full-path. That would conserve space in
 *   localStorage.
 */
export class LocalStorageAbstract extends indexed_filesystem.IndexedFileSystem implements file_system.FileSystem {
  /**
   * Constructs the file system. Loads up any existing files stored in local
   * storage into a simple file index.
   */
  constructor() {
    super(new file_index.FileIndex());
    for (var i = 0; i < window.localStorage.length; i++) {
      var path = window.localStorage.key(i);
      if (path[0] !== '/') {
        // Ignore keys that don't look like absolute paths.
        continue;
      }
      var data = window.localStorage.getItem(path);
      if (data == null) {
        // XXX: I don't know *how*, but sometimes these items become null.
        data = '';
      }
      var len = this._getFileLength(data);
      var inode = new file_index.FileInode<node_fs_stats.Stats>(new Stats(FileType.FILE, len));
      this._index.addPath(path, inode);
    }
  }

  /**
   * Retrieve the indicated file from `localStorage`.
   * @param [String] path
   * @param [BrowserFS.FileMode] flags
   * @param [BrowserFS.FileInode] stats
   * @return [BrowserFS.File.PreloadFile] Returns a preload file with the file's
   *   contents, or null if it does not exist.
   */
  public _getFile(path: string, flags: file_flag.FileFlag, stats: node_fs_stats.Stats): LocalStorageFile {
    var data = window.localStorage.getItem(path);
    if (data === null) {
      return null;
    }
    return this._convertFromBinaryString(path, data, flags, stats);
  }

  /**
   * Handles syncing file data with `localStorage`.
   * @param [String] path
   * @param [String] data
   * @param [BrowserFS.FileInode] stats
   * @return [BrowserFS.node.fs.Stats]
   */
  public _syncSync(path: string, data: NodeBuffer, stats: node_fs_stats.Stats): void {
    var dataStr = this._convertToBinaryString(data, stats);
    try {
      window.localStorage.setItem(path, dataStr);
      this._index.addPath(path, new file_index.FileInode<node_fs_stats.Stats>(stats));
    } catch (e) {
      throw new ApiError(ErrorCode.ENOSPC, "Unable to sync " + path);
    }
  }

  /**
   * Removes all data from localStorage.
   */
  public empty(): void {
    window.localStorage.clear();
    this._index = new file_index.FileIndex();
  }

  public getName(): string {
    return 'localStorage';
  }

  public static isAvailable(): boolean {
    return typeof window !== 'undefined' && window !== null && typeof window['localStorage'] !== 'undefined'
  }

  public diskSpace(path: string, cb: (total: number, free: number) => void): void {
    // Guesstimate (5MB)
    var storageLimit = 5242880;
    // Assume everything is stored as UTF-16 (2 bytes per character)
    var usedSpace = 0;
    for (var i = 0; i < window.localStorage.length; i++) {
      var key = window.localStorage.key(i);
      usedSpace += key.length * 2;
      var data = window.localStorage.getItem(key);
      usedSpace += data.length * 2;
    }

    /**
     * IE has a useful function for this purpose, but it's not available
     * elsewhere. :(
     */
    if (typeof window.localStorage['remainingSpace'] !== 'undefined') {
      var remaining = window.localStorage.remainingSpace;
      // We can extract a more precise upper-limit from this.
      storageLimit = usedSpace + remaining;
    }
    cb(storageLimit, usedSpace);
  }

  public isReadOnly(): boolean {
    return false;
  }

  public supportsLinks(): boolean {
    return false;
  }

  public supportsProps(): boolean {
    return true;
  }

  public unlinkSync(path: string): void {
    super.unlinkSync(path);
    window.localStorage.removeItem(path);
  }

  public _truncate(path: string, flags: file_flag.FileFlag, stats: node_fs_stats.Stats): LocalStorageFile {
    stats.size = 0;
    return new LocalStorageFile(this, path, flags, stats);
  }

  public _fetch(path: string, flags: file_flag.FileFlag, stats: node_fs_stats.Stats): LocalStorageFile {
    return this._getFile(path, flags, stats);
  }

  public _create(path: string, flags: file_flag.FileFlag, inode: file_index.FileInode<node_fs_stats.Stats>): LocalStorageFile {
    return new LocalStorageFile(this, path, flags, inode.getData());
  }

  public _rmdirSync(p: string, inode: file_index.DirInode): void {
    // Remove all files belonging to the path from `localStorage`.
    var files = inode.getListing();
    var sep = path.sep;
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      window.localStorage.removeItem("" + p + sep + file);
    }
  }

  public _convertToBinaryString(data: NodeBuffer, stats: node_fs_stats.Stats): string {
    throw new ApiError(ErrorCode.ENOTSUP, 'LocalStorageAbstract is an abstract class.');
  }
  public _convertFromBinaryString(path: string, data: string, flags: file_flag.FileFlag, stats: node_fs_stats.Stats): LocalStorageFile {
    throw new ApiError(ErrorCode.ENOTSUP, 'LocalStorageAbstract is an abstract class.');
  }
  public _getFileLength(data: string): number {
    throw new ApiError(ErrorCode.ENOTSUP, 'LocalStorageAbstract is an abstract class.');
  }
}

export class LocalStorageModern extends LocalStorageAbstract {
  constructor() {
    super();
  }

  public _convertToBinaryString(data: NodeBuffer, stats: node_fs_stats.Stats): string {
    var dataStr = data.toString('binary_string');
    // Append fixed-size header with mode (16-bits) and mtime/atime (64-bits each).
    // I don't care about uid/gid right now.
    // That amounts to 18 bytes/9 characters + 1 character header
    var headerBuff = new Buffer(18);
    headerBuff.writeUInt16BE(stats.mode, 0);
    // Well, they're doubles and are going to be 64-bit regardless...
    headerBuff.writeDoubleBE(stats.mtime.getTime(), 2);
    headerBuff.writeDoubleBE(stats.atime.getTime(), 10);
    var headerDat = headerBuff.toString('binary_string');
    dataStr = headerDat + dataStr;
    return dataStr;
  }

  public _convertFromBinaryString(path: string, data: string, flags: file_flag.FileFlag, stats: node_fs_stats.Stats): LocalStorageFile {
    var headerBuff = new Buffer(data.substr(0, 10), 'binary_string');
    data = data.substr(10);
    var buffer = new Buffer(data, 'binary_string');
    var file = new LocalStorageFile(this, path, flags, stats, buffer);
    file._stat.mode = headerBuff.readUInt16BE(0);
    file._stat.mtime = new Date(headerBuff.readDoubleBE(2));
    file._stat.atime = new Date(headerBuff.readDoubleBE(10));
    return file;
  }

  public _getFileLength(data: string): number {
    // 10 character header for metadata (9 char data + 1 char header)
    if (data.length > 10) {
      return string_util.FindUtil('binary_string').byteLength(data.substr(10));
    } else {
      return 0;
    }
  }
}

export class LocalStorageOld extends LocalStorageAbstract {
  constructor() {
    super();
  }

  public _convertToBinaryString(data: NodeBuffer, stats: node_fs_stats.Stats): string {
    var dataStr = data.toString('binary_string_ie');
    var headerBuff = new Buffer(18);
    headerBuff.writeUInt16BE(stats.mode, 0);
    // Well, they're doubles and are going to be 64-bit regardless...
    headerBuff.writeDoubleBE(stats.mtime.getTime(), 2);
    headerBuff.writeDoubleBE(stats.atime.getTime(), 10);
    var headerDat = headerBuff.toString('binary_string_ie');
    dataStr = headerDat + dataStr;
    return dataStr;
  }

  public _convertFromBinaryString(path: string, data: string, flags: file_flag.FileFlag, stats: node_fs_stats.Stats): LocalStorageFile {
    var headerBuff = new Buffer(data.substr(0, 18), 'binary_string_ie');
    data = data.substr(18);
    var buffer = new Buffer(data, 'binary_string_ie');
    var file = new LocalStorageFile(this, path, flags, stats, buffer);
    file._stat.mode = headerBuff.readUInt16BE(0);
    file._stat.mtime = new Date(headerBuff.readDoubleBE(2));
    file._stat.atime = new Date(headerBuff.readDoubleBE(10));
    return file;
  }

  public _getFileLength(data: string): number {
    if (data.length > 0) {
      return data.length - 18;
    } else {
      return 0;
    }
  }
}

export class LocalStorageFile extends preload_file.PreloadFile implements file.File {
  constructor(_fs: LocalStorageAbstract, _path: string, _flag: file_flag.FileFlag, _stat: node_fs_stats.Stats, contents?: NodeBuffer) {
    super(_fs, _path, _flag, _stat, contents);
  }

  public syncSync(): void {
    (<LocalStorageAbstract> this._fs)._syncSync(this._path, this._buffer, this._stat);
  }

  public closeSync(): void {
    this.syncSync();
  }
}

// Some versions of FF and all versions of IE do not support the full range of
// 16-bit numbers encoded as characters, as they enforce UTF-16 restrictions.
// http://stackoverflow.com/questions/11170716/are-there-any-characters-that-are-not-allowed-in-localstorage/11173673#11173673
var supportsBinaryString: boolean = false;
try {
  window.localStorage.setItem("__test__", String.fromCharCode(0xD800));
  supportsBinaryString = window.localStorage.getItem("__test__") === String.fromCharCode(0xD800);
} catch (e) {
  // IE throws an exception.
  supportsBinaryString = false;
}
export var LocalStorage = supportsBinaryString ? LocalStorageModern : LocalStorageOld;

browserfs.registerFileSystem('LocalStorage', LocalStorage);
