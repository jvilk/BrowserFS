import node_fs_stats = require('../core/node_fs_stats');
import node_path = require('../core/node_path');

var Stats = node_fs_stats.Stats;
var path = node_path.path;

export class FileIndex {
  private _index: {[path: string]: Inode}
  constructor() {
    this._index = {};
  }

  private _split_path(p: string): string[] {
    var dirpath = path.dirname(p);
    var itemname = p.substr(dirpath.length + (dirpath === "/" ? 0 : 1));
    return [dirpath, itemname];
  }

  public addPath(path: string, inode: Inode): boolean {
    if (inode == null) {
      throw new Error('Inode must be specified');
    }
    if (path[0] !== '/') {
      throw new Error('Path must be absolute, got: ' + path);
    }
    if (this._index.hasOwnProperty(path)) {
      return this._index[path] === inode;
    }

    var splitPath = this._split_path(path);
    var dirpath = splitPath[0];
    var itemname = splitPath[1];
    var parent = <DirInode> this._index[dirpath];
    if (parent === undefined && path !== '/') {
      parent = new DirInode();
      if (!this.addPath(dirpath, parent)) {
        return false;
      }
    }
    if (path !== '/') {
      if (!parent.addItem(itemname, inode)) {
        return false;
      }
    }
    if (!inode.isFile()) {
      this._index[path] = inode;
    }
    return true;
  }

  public removePath(path: string): Inode {
    var splitPath = this._split_path(path);
    var dirpath = splitPath[0];
    var itemname = splitPath[1];
    var parent = <DirInode> this._index[dirpath];
    if (parent === undefined) {
      return null;
    }
    var inode = parent.remItem(itemname);
    if (inode === null) {
      return null;
    }
    if (!inode.isFile()) {
      delete this._index[path];
    }
    return inode;
  }

  public ls(path: string): string[] {
    var item = <DirInode> this._index[path];
    if (item === undefined) {
      return null;
    }
    return item.getListing();
  }

  public getInode(path: string): Inode {
    var splitPath = this._split_path(path);
    var dirpath = splitPath[0];
    var itemname = splitPath[1];
    var parent = <DirInode> this._index[dirpath];
    if (parent === undefined) {
      return null;
    }
    if (dirpath === path) {
      return parent;
    }
    return parent.getItem(itemname);
  }

  public static from_listing(listing): FileIndex {
    var idx = new FileIndex();
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
          idx._index[name] = inode = new Stats(node_fs_stats.FileType.FILE, -1);
        }
        if (parent != null) {
          parent._ls[node] = inode;
        }
      }
    }
    return idx;
  }
}

export interface Inode {
  isFile(): boolean;
  isDirectory(): boolean;
}

export class DirInode implements Inode {
  private _ls: {[path: string]: Inode};
  constructor() {
    this._ls = {};
  }

  public isFile(): boolean {
    return false;
  }

  public isDirectory(): boolean {
    return true;
  }

  public getStats(): node_fs_stats.Stats {
    return new Stats(node_fs_stats.FileType.DIRECTORY, 4096);
  }

  public getListing(): string[] {
    return Object.keys(this._ls);
  }

  public getItem(p: string): Inode {
    var _ref;
    return (_ref = this._ls[p]) != null ? _ref : null;
  }

  public addItem(p: string, inode: Inode): boolean {
    if (p in this._ls) {
      return false;
    }
    this._ls[p] = inode;
    return true;
  }

  public remItem(p: string): Inode {
    var item = this._ls[p];
    if (item === undefined) {
      return null;
    }
    delete this._ls[p];
    return item;
  }
}
