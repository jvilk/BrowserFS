import Stats from "../core/node_fs_stats";
import * as path from "path";

export class FileCache {

  private _index: Map<string, DirInode>;

  constructor() {
    this._index = new Map();
    this._index.set("/", new DirInode());

  }

  addDirectory(path: string): DirInode | null {
    const dirInode = new DirInode();
    if (this.addPath(path, dirInode)) {
      return dirInode;
    }
    return null;
  }

  addFile(path: string) {
    const fileInode = new FileInode();
    if (this.addPath(path, fileInode)) {
      return fileInode;
    }
    return null;
  }

  addPath(path: string, inode: Inode) {
    if (!inode) {
      throw new Error('Inode must be specified');
    }
    if (path === '/') {
      throw new Error("Can't overwrite root Directory");
    }
    if (path[0] !== '/') {
      throw new Error('Path must be absolute, got: ' + path);
    }

    // Check if it already exists.
    if (this._index.has(path)) {
      return this._index.get(path) === inode;
    }

    const splitPath = this._split_path(path);
    const dirpath = splitPath[0];
    const itemname = splitPath[1];
    // Try to add to its parent directory first.
    let parent = this._index.get(dirpath);
    if (parent === undefined) {
      // Create parent.
      parent = new DirInode();
      if (!this.addPath(dirpath, parent)) {
        return false;
      }
    }

    // Add myself to my parent.
    if (!parent.addItem(itemname, inode)) {
      return false;
    }

    // If I'm a directory, add myself to the index.
    if (isDirInode(inode)) {
      this._index.set(path, inode);
    }
    return true;
  }

  removePath(path: string): Inode | undefined {
    if (path === '/') {
      throw new Error("Can't remove root Directory");
    }
    if (path[0] !== '/') {
      throw new Error('Path must be absolute, got: ' + path);
    }

    const splitPath = this._split_path(path);
    const dirpath = splitPath[0];
    const itemname = splitPath[1];

    const parent = this._index.get(dirpath);
    if (parent === undefined) {
      return undefined;
    }

    const inode = parent.remItem(itemname);
    if (inode === undefined) {
      return inode;
    }

    if (isDirInode(inode)) {
      const children = inode.ls();
      for (const name of children) {
        this.removePath(path + '/' + name);
      }

      // Remove the directory from the index, unless it's the root.
      this._index.delete(path);
    }
    return inode;

  }

  getInode(path: string): Inode | undefined {
    if (path[0] !== '/') {
      throw new Error('Path must be absolute, got: ' + path);
    }
    if (path === '/') {
      return this._index.get("/");
    }

    const splitPath = this._split_path(path);
    const dirpath = splitPath[0];
    const itemname = splitPath[1];

    const parent = this._index.get(dirpath);
    if (parent)
      return parent.getItem(itemname);
    else
      return undefined;
  }

  /**
   * Split into a (directory path, item name) pair
   */
  private _split_path(p: string): string[] {
    const dirpath = path.dirname(p);
    const itemname = p.substr(dirpath.length + (dirpath === "/" ? 0 : 1));
    return [dirpath, itemname];
  }
}


export interface Inode {
  stats: Stats | null;

  //is this an inode for a file?
  isFile(): boolean;

  // Is this an inode for a directory?
  isDir(): boolean;
}

export class FileInode implements Inode {
  stats: Stats | null;
  buffer: Buffer;

  constructor() {
    this.stats = null;
  }

  public isFile(): boolean {
    return true;
  }

  public isDir(): boolean {
    return false;
  }
}

export class DirInode implements Inode {
  stats: Stats | null;
  // the listing for a directory
  // an item with undefined value means we know it exists but we don't know what it is
  // this happens when a readdir command fetches the listing,
  // without further queries we can't determine the type of the inode
  _ls: Map<string, Inode | undefined>;

  constructor() {
    this.stats = null;
  }

  public isFile(): boolean {
    return false;
  }

  public isDir(): boolean {
    return true;
  }

  getItem(name: string): Inode | undefined {
    return this._ls.get(name);
  }

  addItem(name: string, inode: Inode) {
    this._ls.set(name, inode);
  }

  remItem(name: string) {
    let item = this._ls.get(name);
    this._ls.delete(name);
    return item;
  }

  ls(): Array<string> {
    return [...this._ls.keys()];
  }

  setIndex(index: Array<string>) {
    for (let name of index) {
      this._ls.set(name, undefined);
    }
  }
}

/**
 * @hidden
 */
export function isFileInode(inode: Inode | null): inode is FileInode {
  return !!inode && inode.isFile();
}

/**
 * @hidden
 */
export function isDirInode(inode: Inode | null): inode is DirInode {
  return !!inode && inode.isDir();
}
