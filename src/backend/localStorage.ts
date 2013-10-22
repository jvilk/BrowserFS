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

var Buffer = buffer.Buffer;
var Stats = node_fs_stats.Stats;
var FileType = node_fs_stats.FileType;
var ApiError = api_error.ApiError;
var ErrorType = api_error.ErrorType;
var path = node_path.path;
export class LocalStorageAbstract extends indexed_filesystem.IndexedFileSystem {
  constructor() {
    super(new file_index.FileIndex());
    for (var i = 0; i < window.localStorage.length; i++) {
      var path = window.localStorage.key(i);
      if (path[0] !== '/') {
        continue;
      }
      var data = window.localStorage.getItem(path);
      if (data == null) {
        data = '';
      }
      var len = this._getFileLength(data);
      var inode = new Stats(FileType.FILE, len);
      this._index.addPath(path, inode);
    }
  }

  public _getFile(path: string, flags: file_flag.FileFlag, inode: node_fs_stats.Stats): LocalStorageFile {
    var data = window.localStorage.getItem(path);
    if (data === null) {
      return null;
    }
    return this._convertFromBinaryString(path, data, flags, inode);
  }

  public _syncSync(path: string, data: buffer.Buffer, inode: node_fs_stats.Stats): void {
    var dataStr = this._convertToBinaryString(data, inode);
    try {
      window.localStorage.setItem(path, dataStr);
      this._index.addPath(path, inode);
    } catch (e) {
      throw new ApiError(ErrorType.DRIVE_FULL, "Unable to sync " + path);
    }
  }

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
    var storageLimit = 5242880;
    var usedSpace = 0;
    for (var i = 0; i < window.localStorage.length; i++) {
      var key = window.localStorage.key(i);
      usedSpace += key.length * 2;
      var data = window.localStorage.getItem(key);
      usedSpace += data.length * 2;
    }
    if (typeof window.localStorage['remainingSpace'] !== 'undefined') {
      var remaining = window.localStorage.remainingSpace;
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

  public _truncate(path: string, flags: file_flag.FileFlag, inode: node_fs_stats.Stats): LocalStorageFile {
    inode.size = 0;
    return new LocalStorageFile(this, path, flags, inode);
  }

  public _fetch(path: string, flags: file_flag.FileFlag, inode: node_fs_stats.Stats): LocalStorageFile {
    return this._getFile(path, flags, inode);
  }

  public _create(path: string, flags: file_flag.FileFlag, inode: node_fs_stats.Stats): LocalStorageFile {
    return new LocalStorageFile(this, path, flags, inode);
  }

  public _rmdirSync(p: string, inode: file_index.DirInode): void {
    var files = inode.getListing();
    var sep = path.sep;
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      window.localStorage.removeItem("" + p + sep + file);
    }
  }

  public _convertToBinaryString(data: buffer.Buffer, inode: node_fs_stats.Stats): string {
    throw new ApiError(ErrorType.NOT_SUPPORTED, 'LocalStorageAbstract is an abstract class.');
  }
  public _convertFromBinaryString(path: string, data: string, flags: file_flag.FileFlag, inode: node_fs_stats.Stats): LocalStorageFile {
    throw new ApiError(ErrorType.NOT_SUPPORTED, 'LocalStorageAbstract is an abstract class.');
  }
  public _getFileLength(data: string): number {
    throw new ApiError(ErrorType.NOT_SUPPORTED, 'LocalStorageAbstract is an abstract class.');
  }
}

export class LocalStorageModern extends LocalStorageAbstract {
  constructor() {
    super();
  }

  public _convertToBinaryString(data: buffer.Buffer, inode: node_fs_stats.Stats): string {
    var dataStr = data.toString('binary_string');
    var headerBuff = new Buffer(18);
    headerBuff.writeUInt16BE(inode.mode, 0);
    headerBuff.writeDoubleBE(inode.mtime.getTime(), 2);
    headerBuff.writeDoubleBE(inode.atime.getTime(), 10);
    var headerDat = headerBuff.toString('binary_string');
    dataStr = headerDat + dataStr;
    return dataStr;
  }

  public _convertFromBinaryString(path: string, data: string, flags: file_flag.FileFlag, inode: node_fs_stats.Stats): LocalStorageFile {
    var headerBuff = new Buffer(data.substr(0, 10), 'binary_string');
    data = data.substr(10);
    var buffer = new Buffer(data, 'binary_string');
    var file = new LocalStorageFile(this, path, flags, inode, buffer);
    file._stat.mode = headerBuff.readUInt16BE(0);
    file._stat.mtime = new Date(headerBuff.readDoubleBE(2));
    file._stat.atime = new Date(headerBuff.readDoubleBE(10));
    return file;
  }

  public _getFileLength(data: string): number {
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

  public _convertToBinaryString(data: buffer.Buffer, inode: node_fs_stats.Stats): string {
    var dataStr = data.toString('binary_string_ie');
    var headerBuff = new Buffer(18);
    headerBuff.writeUInt16BE(inode.mode, 0);
    headerBuff.writeDoubleBE(inode.mtime.getTime(), 2);
    headerBuff.writeDoubleBE(inode.atime.getTime(), 10);
    var headerDat = headerBuff.toString('binary_string_ie');
    dataStr = headerDat + dataStr;
    return dataStr;
  }

  public _convertFromBinaryString(path: string, data: string, flags: file_flag.FileFlag, inode: node_fs_stats.Stats): LocalStorageFile {
    var headerBuff = new Buffer(data.substr(0, 18), 'binary_string_ie');
    data = data.substr(18);
    var buffer = new Buffer(data, 'binary_string_ie');
    var file = new LocalStorageFile(this, path, flags, inode, buffer);
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

export class LocalStorageFile extends preload_file.PreloadFile {
  constructor(_fs: file_system.FileSystem, _path: string, _flag: file_flag.FileFlag, _stat: node_fs_stats.Stats, contents?: buffer.Buffer) {
    super(_fs, _path, _flag, _stat, contents);
  }

  public syncSync(): void {
    (<LocalStorageAbstract> this._fs)._syncSync(this._path, this._buffer, this._stat);
  }

  public closeSync(): void {
    this.syncSync();
  }
}

var supportsBinaryString: boolean = false;
try {
  window.localStorage.setItem("__test__", String.fromCharCode(0xD800));
  supportsBinaryString = window.localStorage.getItem("__test__") === String.fromCharCode(0xD800);
} catch (e) {
}
export var LocalStorage = supportsBinaryString ? LocalStorageModern : LocalStorageOld;
