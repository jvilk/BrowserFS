import node_fs_stats = require('../core/node_fs_stats');
import node_path = require('../core/node_path');

var Stats = node_fs_stats.Stats;
var path = node_path.path;

/**
 * A simple class for storing a filesystem index. Assumes that all paths passed
 * to it are *absolute* paths.
 *
 * Can be used as a partial or a full index, although care must be taken if used
 * for the former purpose, especially when directories are concerned.
 */
export class FileIndex {
  // Maps directory paths to directory inodes, which contain files.
  private _index: {[path: string]: DirInode}

  /**
   * Constructs a new FileIndex.
   */
  constructor() {
    // _index is a single-level key,value store that maps *directory* paths to
    // DirInodes. File information is only contained in DirInodes themselves.
    this._index = {};
    // Create the root directory.
    this.addPath('/', new DirInode());
  }

  /**
   * Split into a (directory path, item name) pair
   */
  private _split_path(p: string): string[] {
    var dirpath = path.dirname(p);
    var itemname = p.substr(dirpath.length + (dirpath === "/" ? 0 : 1));
    return [dirpath, itemname];
  }

  /**
   * Runs the given function over all files in the index.
   */
  public fileIterator(cb: (file: node_fs_stats.Stats) => void): void {
    for (var path in this._index) {
      var dir = this._index[path];
      var files = dir.getListing();
      for (var i = 0; i < files.length; i++) {
        var item = dir.getItem(files[i]);
        if (item.isFile()) {
          cb((<FileInode<node_fs_stats.Stats>> item).getData());
        }
      }
    }
  }

  /**
   * Adds the given absolute path to the index if it is not already in the index.
   * Creates any needed parent directories.
   * @param [String] path The path to add to the index.
   * @param [BrowserFS.FileInode | BrowserFS.DirInode] inode The inode for the
   *   path to add.
   * @return [Boolean] 'True' if it was added or already exists, 'false' if there
   *   was an issue adding it (e.g. item in path is a file, item exists but is
   *   different).
   * @todo If adding fails and implicitly creates directories, we do not clean up
   *   the new empty directories.
   */
  public addPath(path: string, inode: Inode): boolean {
    if (inode == null) {
      throw new Error('Inode must be specified');
    }
    if (path[0] !== '/') {
      throw new Error('Path must be absolute, got: ' + path);
    }

    // Check if it already exists.
    if (this._index.hasOwnProperty(path)) {
      return this._index[path] === inode;
    }

    var splitPath = this._split_path(path);
    var dirpath = splitPath[0];
    var itemname = splitPath[1];
    // Try to add to its parent directory first.
    var parent = this._index[dirpath];
    if (parent === undefined && path !== '/') {
      // Create parent.
      parent = new DirInode();
      if (!this.addPath(dirpath, parent)) {
        return false;
      }
    }
    // Add myself to my parent.
    if (path !== '/') {
      if (!parent.addItem(itemname, inode)) {
        return false;
      }
    }
    // If I'm a directory, add myself to the index.
    if (!inode.isFile()) {
      this._index[path] = <DirInode> inode;
    }
    return true;
  }

  /**
   * Removes the given path. Can be a file or a directory.
   * @return [BrowserFS.FileInode | BrowserFS.DirInode | null] The removed item,
   *   or null if it did not exist.
   */
  public removePath(path: string): Inode {
    var splitPath = this._split_path(path);
    var dirpath = splitPath[0];
    var itemname = splitPath[1];

    // Try to remove it from its parent directory first.
    var parent = this._index[dirpath];
    if (parent === undefined) {
      return null;
    }
    // Remove myself from my parent.
    var inode = parent.remItem(itemname);
    if (inode === null) {
      return null;
    }
    // If I'm a directory, remove myself from the index, and remove my children.
    if (!inode.isFile()) {
      var dirInode = <DirInode> inode;
      var children = dirInode.getListing();
      for (var i = 0; i < children.length; i++) {
        this.removePath(path + '/' + children[i]);
      }

      // Remove the directory from the index, unless it's the root.
      if (path !== '/') {
        delete this._index[path];
      }
    }
    return inode;
  }

  /**
   * Retrieves the directory listing of the given path.
   * @return [String[]] An array of files in the given path, or 'null' if it does
   *   not exist.
   */
  public ls(path: string): string[] {
    var item = this._index[path];
    if (item === undefined) {
      return null;
    }
    return item.getListing();
  }

  /**
   * Returns the inode of the given item.
   * @param [String] path
   * @return [BrowserFS.FileInode | BrowserFS.DirInode | null] Returns null if
   *   the item does not exist.
   */
  public getInode(path: string): Inode {
    var splitPath = this._split_path(path);
    var dirpath = splitPath[0];
    var itemname = splitPath[1];
    // Retrieve from its parent directory.
    var parent = this._index[dirpath];
    if (parent === undefined) {
      return null;
    }
    // Root case
    if (dirpath === path) {
      return parent;
    }
    return parent.getItem(itemname);
  }

  /**
   * Static method for constructing indices from a JSON listing.
   * @param [Object] listing Directory listing generated by tools/XHRIndexer.coffee
   * @return [BrowserFS.FileIndex] A new FileIndex object.
   */
  public static from_listing(listing): FileIndex {
    var idx = new FileIndex();
    // Add a root DirNode.
    var rootInode = new DirInode();
    idx._index['/'] = rootInode;
    var queue = [['', listing, rootInode]];
    while (queue.length > 0) {
      var inode;
      var next = queue.pop();
      var pwd = next[0];
      var tree = next[1];
      var parent = next[2];
      for (var node in tree) {
        var children = tree[node];
        var name = "" + pwd + "/" + node;
        if (children != null) {
          idx._index[name] = inode = new DirInode();
          queue.push([name, children, inode]);
        } else {
          // This inode doesn't have correct size information, noted with -1.
          inode = new FileInode<node_fs_stats.Stats>(new Stats(node_fs_stats.FileType.FILE, -1, 0x16D));
        }
        if (parent != null) {
          parent._ls[node] = inode;
        }
      }
    }
    return idx;
  }
}

/**
 * Generic interface for file/directory inodes.
 * Note that Stats objects are what we use for file inodes.
 */
export interface Inode {
  // Is this an inode for a file?
  isFile(): boolean;
  // Is this an inode for a directory?
  isDir(): boolean;
}

/**
 * Inode for a file. Stores an arbitrary (filesystem-specific) data payload.
 */
export class FileInode<T> implements Inode {
  constructor(private data: T) { }
  public isFile(): boolean { return true; }
  public isDir(): boolean { return false; }
  public getData(): T { return this.data; }
  public setData(data: T): void { this.data = data; }
}

/**
 * Inode for a directory. Currently only contains the directory listing.
 */
export class DirInode implements Inode {
  private _ls: {[path: string]: Inode} = {};
  /**
   * Constructs an inode for a directory.
   */
  constructor() {}
  public isFile(): boolean {
    return false;
  }
  public isDir(): boolean {
    return true;
  }

  /**
   * Return a Stats object for this inode.
   * @todo Should probably remove this at some point. This isn't the
   *       responsibility of the FileIndex.
   * @return [BrowserFS.node.fs.Stats]
   */
  public getStats(): node_fs_stats.Stats {
    return new Stats(node_fs_stats.FileType.DIRECTORY, 4096, 0x16D);
  }
  /**
   * Returns the directory listing for this directory. Paths in the directory are
   * relative to the directory's path.
   * @return [String[]] The directory listing for this directory.
   */
  public getListing(): string[] {
    return Object.keys(this._ls);
  }
  /**
   * Returns the inode for the indicated item, or null if it does not exist.
   * @param [String] p Name of item in this directory.
   * @return [BrowserFS.FileInode | BrowserFS.DirInode | null]
   */
  public getItem(p: string): Inode {
    var _ref;
    return (_ref = this._ls[p]) != null ? _ref : null;
  }
  /**
   * Add the given item to the directory listing. Note that the given inode is
   * not copied, and will be mutated by the DirInode if it is a DirInode.
   * @param [String] p Item name to add to the directory listing.
   * @param [BrowserFS.FileInode | BrowserFS.DirInode] inode The inode for the
   *   item to add to the directory inode.
   * @return [Boolean] True if it was added, false if it already existed.
   */
  public addItem(p: string, inode: Inode): boolean {
    if (p in this._ls) {
      return false;
    }
    this._ls[p] = inode;
    return true;
  }
  /**
   * Removes the given item from the directory listing.
   * @param [String] p Name of item to remove from the directory listing.
   * @return [BrowserFS.FileInode | BrowserFS.DirInode | null] Returns the item
   *   removed, or null if the item did not exist.
   */
  public remItem(p: string): Inode {
    var item = this._ls[p];
    if (item === undefined) {
      return null;
    }
    delete this._ls[p];
    return item;
  }
}
