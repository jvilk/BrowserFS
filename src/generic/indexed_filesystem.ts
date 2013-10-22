import file_system = require('../core/file_system');
import file_index = require('file_index');
import file_flag = require('../core/file_flag');
import file = require('../core/file');
import node_fs_stats = require('../core/node_fs_stats');
import api_error = require('../core/api_error');
import node_path = require('../core/node_path');

var ApiError = api_error.ApiError;
var ErrorType = api_error.ErrorType;
var ActionType = file_flag.ActionType;
var FileType = node_fs_stats.FileType;
var Stats = node_fs_stats.Stats;
var FileFlag = file_flag.FileFlag;
var path = node_path.path;
var DirInode = file_index.DirInode;
export class IndexedFileSystem extends file_system.SynchronousFileSystem {
    private _index: file_index.FileIndex;
    constructor(_index: file_index.FileIndex) {
      super();
      this._index = _index;
    }

    public renameSync(oldPath: string, newPath: string): void {
      var oldInode = this._index.removePath(oldPath);
      if (oldInode === null) {
        throw new ApiError(ErrorType.NOT_FOUND, "" + oldPath + " not found.");
      }
      this._index.removePath(newPath);
      this._index.addPath(newPath, oldInode);
    }

    public statSync(path: string, isLstat: boolean): node_fs_stats.Stats {
      var inode = this._index.getInode(path);
      if (inode === null) {
        throw new ApiError(ErrorType.NOT_FOUND, "" + path + " not found.");
      }

      var stats = typeof inode['getStats'] === 'function' ? (<file_index.DirInode> inode).getStats() : <node_fs_stats.Stats> inode;
      return stats;
    }

    public openSync(p: string, flags: file_flag.FileFlag, mode: number): file.File {
      var inode = this._index.getInode(p);
      if (inode !== null) {
        if (!inode.isFile()) {
          throw new ApiError(ErrorType.NOT_FOUND, "" + p + " is a directory.");
        } else {
          switch (flags.pathExistsAction()) {
            case ActionType.THROW_EXCEPTION:
              throw new ApiError(ErrorType.INVALID_PARAM, "" + p + " already exists.");
              break;
            case ActionType.TRUNCATE_FILE:
              return this._truncate(p, flags, inode);
            case ActionType.NOP:
              return this._fetch(p, flags, inode);
            default:
              throw new ApiError(ErrorType.INVALID_PARAM, 'Invalid FileFlag object.');
          }
        }
      } else {
        switch (flags.pathNotExistsAction()) {
          case ActionType.CREATE_FILE:
            var parentPath = path.dirname(p);
            var parentInode = this._index.getInode(parentPath);
            if (parentInode === null || parentInode.isFile()) {
              throw new ApiError(ErrorType.INVALID_PARAM, "" + parentPath + " doesn't exist.");
            }
            inode = new Stats(FileType.FILE, 0, mode);
            return this._create(p, flags, inode);
          case ActionType.THROW_EXCEPTION:
            throw new ApiError(ErrorType.INVALID_PARAM, "" + p + " doesn't exist.");
            break;
          default:
            throw new ApiError(ErrorType.INVALID_PARAM, 'Invalid FileFlag object.');
        }
      }
    }

    public unlinkSync(path: string): void {
      var inode = this._index.getInode(path);
      if (inode === null) {
        throw new ApiError(ErrorType.NOT_FOUND, "" + path + " not found.");
      } else if (!inode.isFile()) {
        throw new ApiError(ErrorType.NOT_FOUND, "" + path + " is a directory, not a file.");
      }
      this._index.removePath(path);
    }

    public rmdirSync(path: string): void {
      var inode = this._index.getInode(path);
      if (inode === null) {
        throw new ApiError(ErrorType.NOT_FOUND, "" + path + " not found.");
      } else if (inode.isFile()) {
        throw new ApiError(ErrorType.NOT_FOUND, "" + path + " is a file, not a directory.");
      }
      this._index.removePath(path);
      this._rmdirSync(path, inode);
    }

    public mkdirSync(p: string, mode: number): void {
      var inode = this._index.getInode(p);
      if (inode !== null) {
        throw new ApiError(ErrorType.INVALID_PARAM, "" + p + " already exists.");
      }
      var parent = path.dirname(p);
      if (parent !== '/' && this._index.getInode(parent) === null) {
        throw new ApiError(ErrorType.INVALID_PARAM, "Can't create " + p + " because " + parent + " doesn't exist.");
      }
      var success = this._index.addPath(p, new DirInode());
      if (success) {
        return;
      }
      throw new ApiError(ErrorType.INVALID_PARAM, "Could not add " + path + " for some reason.");
    }

    public readdirSync(path: string): string[] {
      var inode = this._index.getInode(path);
      if (inode === null) {
        throw new ApiError(ErrorType.NOT_FOUND, "" + path + " not found.");
      } else if (inode.isFile()) {
        throw new ApiError(ErrorType.NOT_FOUND, "" + path + " is a file, not a directory.");
      }
      return (<file_index.DirInode> inode).getListing();
    }

    public chmodSync(path: string, isLchmod: boolean, mode: number): void {
      var fd = this.openSync(path, FileFlag.getFileFlag('r+'), 0x1a4);
      (<any> fd)._stat.mode = mode;
      fd.closeSync();
    }

    public chownSync(path: string, isLchown: boolean, uid: number, gid: number): void {
      var fd = this.openSync(path, FileFlag.getFileFlag('r+'), 0x1a4);
      (<any> fd)._stat.uid = uid;
      (<any> fd)._stat.gid = gid;
      fd.closeSync();
    }

    public utimesSync(path: string, atime: Date, mtime: Date): void {
      var fd = this.openSync(path, FileFlag.getFileFlag('r+'), 0x1a4);
      (<any> fd)._stat.atime = atime;
      (<any> fd)._stat.mtime = mtime;
      fd.closeSync();
    }

    private _rmdirSync(path: string, inode: file_index.Inode): void {
      throw new ApiError(ErrorType.NOT_SUPPORTED, '_rmdirSync is not implemented.');
    }
    private _create(path: string, flag: file_flag.FileFlag, inode: file_index.Inode): file.File {
      throw new ApiError(ErrorType.NOT_SUPPORTED, '_create is not implemented.');
    }
    private _fetch(path: string, flag: file_flag.FileFlag, inode: file_index.Inode): file.File {
      throw new ApiError(ErrorType.NOT_SUPPORTED, '_fetch is not implemented.');
    }
    private _truncate(path: string, flag: file_flag.FileFlag, inode: file_index.Inode): file.File {
      throw new ApiError(ErrorType.NOT_SUPPORTED, '_truncate is not implemented.');
    }
}
