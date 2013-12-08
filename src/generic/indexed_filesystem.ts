import file_system = require('../core/file_system');
import file_index = require('./file_index');
import file_flag = require('../core/file_flag');
import file = require('../core/file');
import node_fs_stats = require('../core/node_fs_stats');
import api_error = require('../core/api_error');
import node_path = require('../core/node_path');

var ApiError = api_error.ApiError;
var ErrorCode = api_error.ErrorCode;
var ActionType = file_flag.ActionType;
var FileType = node_fs_stats.FileType;
var Stats = node_fs_stats.Stats;
var FileFlag = file_flag.FileFlag;
var path = node_path.path;
var DirInode = file_index.DirInode;
/**
 * A simple filesystem base class that uses an in-memory FileIndex.
 */
export class IndexedFileSystem extends file_system.SynchronousFileSystem {
  // XXX: Subclasses access the index directly.
  public _index: file_index.FileIndex;
  /**
   * Constructs the file system with the given FileIndex.
   * @param [BrowserFS.FileIndex] _index
   */
  constructor(_index: file_index.FileIndex) {
    super();
    this._index = _index;
  }

  // File or directory operations

  public renameSync(oldPath: string, newPath: string): void {
    var oldInode = this._index.removePath(oldPath);
    if (oldInode === null) {
      throw new ApiError(ErrorCode.ENOENT, "" + oldPath + " not found.");
    }
    // Remove the given path if it exists.
    this._index.removePath(newPath);
    this._index.addPath(newPath, oldInode);
  }

  public statSync(path: string, isLstat: boolean): node_fs_stats.Stats {
    var inode = this._index.getInode(path);
    if (inode === null) {
      throw new ApiError(ErrorCode.ENOENT, "" + path + " not found.");
    }
    return inode.isDir() ? (<file_index.DirInode> inode).getStats() : (<file_index.FileInode<node_fs_stats.Stats>> inode).getData();
  }

  // File operations

  public openSync(p: string, flags: file_flag.FileFlag, mode: number): file.File {
    // Check if the path exists, and is a file.
    var inode = this._index.getInode(p);
    if (inode !== null) {
      if (!inode.isFile()) {
        throw new ApiError(ErrorCode.EISDIR, "" + p + " is a directory.");
      } else {
        var stats = (<file_index.FileInode<node_fs_stats.Stats>> inode).getData();
        switch (flags.pathExistsAction()) {
          case ActionType.THROW_EXCEPTION:
            throw new ApiError(ErrorCode.EEXIST, "" + p + " already exists.");
            break;
          case ActionType.TRUNCATE_FILE:
            return this._truncate(p, flags, stats);
          case ActionType.NOP:
            return this._fetch(p, flags, stats);
          default:
            throw new ApiError(ErrorCode.EINVAL, 'Invalid FileFlag object.');
        }
      }
    } else {
      switch (flags.pathNotExistsAction()) {
        case ActionType.CREATE_FILE:
          // Ensure the parent exists!
          var parentPath = path.dirname(p);
          var parentInode = this._index.getInode(parentPath);
          if (parentInode === null || parentInode.isFile()) {
            throw new ApiError(ErrorCode.ENOENT, "" + parentPath + " doesn't exist.");
          }
          var fileInode = new file_index.FileInode<node_fs_stats.Stats>(new Stats(FileType.FILE, 0, mode));
          return this._create(p, flags, fileInode);
        case ActionType.THROW_EXCEPTION:
          throw new ApiError(ErrorCode.ENOENT, "" + p + " doesn't exist.");
          break;
        default:
          throw new ApiError(ErrorCode.EINVAL, 'Invalid FileFlag object.');
      }
    }
  }

  // Directory operations

  public unlinkSync(path: string): void {
    // Check if it exists, and is a file.
    var inode = this._index.getInode(path);
    if (inode === null) {
      throw new ApiError(ErrorCode.ENOENT, "" + path + " not found.");
    } else if (!inode.isFile()) {
      throw new ApiError(ErrorCode.EISDIR, "" + path + " is a directory, not a file.");
    }
    this._index.removePath(path);
  }

  public rmdirSync(path: string): void {
    // Check if it exists, and is a directory.
    var inode = <file_index.DirInode> this._index.getInode(path);
    if (inode === null) {
      throw new ApiError(ErrorCode.ENOENT, "" + path + " not found.");
    } else if (inode.isFile()) {
      throw new ApiError(ErrorCode.ENOTDIR, "" + path + " is a file, not a directory.");
    }
    this._index.removePath(path);
    this._rmdirSync(path, inode);
  }

  public mkdirSync(p: string, mode: number): void {
    // Check if it exists.
    var inode = this._index.getInode(p);
    if (inode !== null) {
      throw new ApiError(ErrorCode.EEXIST, "" + p + " already exists.");
    }
    // Check if it lives below an existing dir (that is, we can't mkdir -p).
    var parent = path.dirname(p);
    if (parent !== '/' && this._index.getInode(parent) === null) {
      throw new ApiError(ErrorCode.ENOENT, "Can't create " + p + " because " + parent + " doesn't exist.");
    }
    var success = this._index.addPath(p, new DirInode());
    if (success) {
      return;
    }
    throw new ApiError(ErrorCode.EINVAL, "Could not add " + path + " for some reason.");
  }

  public readdirSync(path: string): string[] {
    // Check if it exists.
    var inode = this._index.getInode(path);
    if (inode === null) {
      throw new ApiError(ErrorCode.ENOENT, "" + path + " not found.");
    } else if (inode.isFile()) {
      throw new ApiError(ErrorCode.ENOTDIR, "" + path + " is a file, not a directory.");
    }
    return (<file_index.DirInode> inode).getListing();
  }

  public chmodSync(path: string, isLchmod: boolean, mode: number): void {
    var fd = this.openSync(path, FileFlag.getFileFlag('r+'), 0x1a4);
    // XXX: This is terrible.
    (<any> fd)._stat.chmod(mode);
    fd.closeSync();
  }

  public chownSync(path: string, isLchown: boolean, uid: number, gid: number): void {
    var fd = this.openSync(path, FileFlag.getFileFlag('r+'), 0x1a4);
    // XXX: This is terrible.
    (<any> fd)._stat.uid = uid;
    (<any> fd)._stat.gid = gid;
    fd.closeSync();
  }

  public utimesSync(path: string, atime: Date, mtime: Date): void {
    var fd = this.openSync(path, FileFlag.getFileFlag('r+'), 0x1a4);
    // XXX: This is terrible.
    (<any> fd)._stat.atime = atime;
    (<any> fd)._stat.mtime = mtime;
    fd.closeSync();
  }

  public _rmdirSync(path: string, inode: file_index.DirInode): void {
    throw new ApiError(ErrorCode.ENOTSUP, '_rmdirSync is not implemented.');
  }
  public _create(path: string, flag: file_flag.FileFlag, inode: file_index.FileInode<node_fs_stats.Stats>): file.File {
    throw new ApiError(ErrorCode.ENOTSUP, '_create is not implemented.');
  }
  public _fetch(path: string, flag: file_flag.FileFlag, stats: node_fs_stats.Stats): file.File {
    throw new ApiError(ErrorCode.ENOTSUP, '_fetch is not implemented.');
  }
  public _truncate(path: string, flag: file_flag.FileFlag, stats: node_fs_stats.Stats): file.File {
    throw new ApiError(ErrorCode.ENOTSUP, '_truncate is not implemented.');
  }
}
