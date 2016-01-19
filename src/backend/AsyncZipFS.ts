/**
 * AsyncZipFS is a more responsive version of ZipFS. The thread yields more often during indexing.
 * One more difference is that querying the central directory in the zip file is not supported in AsyncZipFS.
 *
 * Example usage:
 *
 * if the original ZipFS code is:
 *
 *   new ZipFS(data, name);
 *
 * then the equivalent AsyncZipFS code would be:
 *
 *   AsyncZipFS.computeIndex(data, (index) => {
 *     new AsyncZipFS(index, name);
 *   });
 */

import {ApiError, ErrorCode} from '../core/api_error';
import {default as Stats, FileType} from '../core/node_fs_stats';
import file_system = require('../core/file_system');
import file = require('../core/file');
import {FileFlag, ActionType} from '../core/file_flag';
import preload_file = require('../generic/preload_file');
import {Arrayish, buffer2Arrayish, arrayish2Buffer, copyingSlice} from '../core/util';
import ExtendedASCII from 'bfs-buffer/js/extended_ascii';

import {CentralDirectory, EndOfCentralDirectory} from './ZipFS';

var inflateRaw: {
  (data: Arrayish<number>, options?: {
    chunkSize: number;
  }): Arrayish<number>;
} = require('pako/dist/pako_inflate.min').inflateRaw;
import {FileIndex, DirInode, FileInode, isDirInode, isFileInode} from '../generic/file_index';


export default class AsyncZipFS extends file_system.SynchronousFileSystem implements file_system.FileSystem {
  /**
   * Constructs a ZipFS from the given zip file data. Name is optional, and is
   * used primarily for our unit tests' purposes to differentiate different
   * test zip files in test output.
   */
  constructor(private _index: FileIndex<CentralDirectory>, private name: string = '') {
    super();
  }

  public getName(): string {
    return 'ZipFS' + (this.name !== '' ? ' ' + this.name : '');
  }

  public static isAvailable(): boolean { return true; }

  public diskSpace(path: string, cb: (total: number, free: number) => void): void {
    // Read-only file system.
    // cb(this.data.length, 0);
    // TODO
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
    return true;
  }

  public statSync(path: string, isLstat: boolean): Stats {
    var inode = this._index.getInode(path);
    if (inode === null) {
      throw ApiError.ENOENT(path);
    }
    var stats: Stats;
    if (isFileInode<CentralDirectory>(inode)) {
      stats = inode.getData().getStats();
    } else if (isDirInode(inode)) {
      stats = inode.getStats();
    } else {
      throw new ApiError(ErrorCode.EINVAL, "Invalid inode.");
    }
    return stats;
  }

  public openSync(path: string, flags: FileFlag, mode: number): file.File {
    // INVARIANT: Cannot write to RO file systems.
    if (flags.isWriteable()) {
      throw new ApiError(ErrorCode.EPERM, path);
    }
    // Check if the path exists, and is a file.
    var inode = this._index.getInode(path);
    if (!inode) {
      throw ApiError.ENOENT(path);
    } else if (isFileInode<CentralDirectory>(inode)) {
      var cdRecord = inode.getData();
      var stats = cdRecord.getStats();
      switch (flags.pathExistsAction()) {
        case ActionType.THROW_EXCEPTION:
        case ActionType.TRUNCATE_FILE:
          throw ApiError.EEXIST(path);
        case ActionType.NOP:
          return new preload_file.NoSyncFile(this, path, flags, stats, cdRecord.getData());
        default:
          throw new ApiError(ErrorCode.EINVAL, 'Invalid FileMode object.');
      }
      return null;
    } else {
      throw ApiError.EISDIR(path);
    }
  }

  public readdirSync(path: string): string[] {
    // Check if it exists.
    var inode = this._index.getInode(path);
    if (!inode) {
      throw ApiError.ENOENT(path);
    } else if (isDirInode(inode)) {
      return inode.getListing();
    } else {
      throw ApiError.ENOTDIR(path);
    }
  }

  /**
   * Specially-optimized readfile.
   */
  public readFileSync(fname: string, encoding: string, flag: FileFlag): any {
    // Get file.
    var fd = this.openSync(fname, flag, 0x1a4);
    try {
      var fdCast = <preload_file.NoSyncFile<AsyncZipFS>> fd;
      var fdBuff = <Buffer> fdCast.getBuffer();
      if (encoding === null) {
        return copyingSlice(fdBuff);
      }
      return fdBuff.toString(encoding);
    } finally {
      fd.closeSync();
    }
  }

  /**
   * Locates the end of central directory record at the end of the file.
   * Throws an exception if it cannot be found.
   */
  private static getEOCD(data: NodeBuffer): EndOfCentralDirectory {
    // Unfortunately, the comment is variable size and up to 64K in size.
    // We assume that the magic signature does not appear in the comment, and
    // in the bytes between the comment and the signature. Other ZIP
    // implementations make this same assumption, since the alternative is to
    // read thread every entry in the file to get to it. :(
    // These are *negative* offsets from the end of the file.
    var startOffset = 22;
    var endOffset = Math.min(startOffset + 0xFFFF, data.length - 1);
    // There's not even a byte alignment guarantee on the comment so we need to
    // search byte by byte. *grumble grumble*
    for (var i = startOffset; i < endOffset; i++) {
      // Magic number: EOCD Signature
      if (data.readUInt32LE(data.length - i) === 0x06054b50) {
        return new EndOfCentralDirectory(data.slice(data.length - i));
      }
    }
    throw new ApiError(ErrorCode.EINVAL, "Invalid ZIP file: Could not locate End of Central Directory signature.");
  }

  private static addToIndex(cd: CentralDirectory, index: FileIndex<CentralDirectory>) {
    // Paths must be absolute, yet zip file paths are always relative to the
    // zip root. So we append '/' and call it a day.
    let filename = cd.fileName();
    if (filename.charAt(0) === '/') throw new Error("WHY IS THIS ABSOLUTE");
    // XXX: For the file index, strip the trailing '/'.
    if (filename.charAt(filename.length - 1) === '/') {
      filename = filename.substr(0, filename.length-1);
    }

    if (cd.isDirectory()) {
      index.addPathFast('/' + filename, new DirInode<CentralDirectory>(cd));
    } else {
      index.addPathFast('/' + filename, new FileInode<CentralDirectory>(cd));
    }
  }

  static computeIndexResponsive(data: NodeBuffer, index: FileIndex<CentralDirectory>, cdPtr: number, cdEnd: number, cb: (index: FileIndex<CentralDirectory>) => void) {
    if (cdPtr < cdEnd) {
      let count = 0;
      while (count++ < 200 && cdPtr < cdEnd) {
        const cd: CentralDirectory = new CentralDirectory(data, data.slice(cdPtr));
        AsyncZipFS.addToIndex(cd, index);
        cdPtr += cd.totalSize();
      }
      setImmediate(() => {
        AsyncZipFS.computeIndexResponsive(data, index, cdPtr, cdEnd, cb);
      });
    } else {
      console.log("done", cdPtr);
      cb(index);
    }
  }

  static computeIndex(data: NodeBuffer, cb: (index: FileIndex<CentralDirectory>) => void) {
    const index: FileIndex<CentralDirectory> = new FileIndex<CentralDirectory>();
    const eocd: EndOfCentralDirectory = AsyncZipFS.getEOCD(data);
    if (eocd.diskNumber() !== eocd.cdDiskNumber())
      throw new ApiError(ErrorCode.EINVAL, "ZipFS does not support spanned zip files.");

    const cdPtr = eocd.cdOffset();
    if (cdPtr === 0xFFFFFFFF)
      throw new ApiError(ErrorCode.EINVAL, "ZipFS does not support Zip64.");
    const cdEnd = cdPtr + eocd.cdSize();
    AsyncZipFS.computeIndexResponsive(data, index, cdPtr, cdEnd, cb);
  }
}
