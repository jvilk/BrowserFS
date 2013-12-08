import indexed_filesystem = require('../generic/indexed_filesystem');
import file_index = require('../generic/file_index');
import file = require('../core/file');
import file_flag = require('../core/file_flag');
import node_fs_stats = require('../core/node_fs_stats');
import buffer = require('../core/buffer');
import preload_file = require('../generic/preload_file');
import util = require('../core/util');
import browserfs = require('../core/browserfs');
import file_system = require('../core/file_system');

var Buffer = buffer.Buffer;
var NoSyncFile = preload_file.NoSyncFile;
/**
 * A simple filesystem that exists only in memory.
 *
 * Note: This hacks a file_data property into each file inode,
 *   which are actually just fs.Stats objects.
 */
export class InMemory extends indexed_filesystem.IndexedFileSystem implements file_system.FileSystem {
  /**
   * Constructs the file system, with no files or directories.
   */
  constructor() {
    super(new file_index.FileIndex());
  }

  /**
   * Clears all data, resetting to the 'just-initialized' state.
   */
  public empty(): void {
    this._index = new file_index.FileIndex();
  }

  public getName(): string {
    return 'In-memory';
  }

  public static isAvailable(): boolean {
    return true;
  }

  /**
   * Passes the size and taken space in bytes to the callback.
   *
   * **Note**: We can use all available memory on the system, so we return +Inf.
   * @param [String] path Unused in the implementation.
   * @param [Function(Number, Number)] cb
   */
  public diskSpace(path: string, cb: (total: number, free: number) => void): void {
    return cb(Infinity, util.roughSizeOfObject(this._index));
  }

  public isReadOnly(): boolean {
    return false;
  }

  public supportsLinks(): boolean {
    return false;
  }

  public supportsProps(): boolean {
    return false;
  }

  public _truncate(path: string, flags: file_flag.FileFlag, stats: node_fs_stats.Stats): file.File {
    stats.size = 0;
    stats.mtime = new Date();
    var file = <preload_file.NoSyncFile> stats.file_data;
    file._flag = flags;
    file._buffer = new Buffer(0);
    return file;
  }

  public _fetch(path: string, flags: file_flag.FileFlag, stats: node_fs_stats.Stats): file.File {
    var file = <preload_file.NoSyncFile> stats.file_data;
    file._flag = flags;
    return file;
  }

  public _create(path: string, flags: file_flag.FileFlag, inode: file_index.FileInode<node_fs_stats.Stats>): file.File {
    var stats = inode.getData();
    var file = new NoSyncFile(this, path, flags, stats);
    stats.file_data = file;
    this._index.addPath(path, inode);
    return file;
  }

  public _rmdirSync(path: string, inode: file_index.DirInode): void {}
}

browserfs.registerFileSystem('InMemory', InMemory);
