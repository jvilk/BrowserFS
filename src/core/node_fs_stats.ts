/// <reference path="../../vendor/DefinitelyTyped/node/node.d.ts" />
// Import the type annotation from Node.
import fs = require('fs');
import file = require('./file');

/**
 * @class
 */
export enum FileType {
  FILE = 1,
  DIRECTORY = 2,
  SYMLINK = 3,
  SOCKET = 4
}

/**
 * Emulation of Node's `fs.Stats` object.
 *
 * Attribute descriptions are from `man 2 stat'
 * @see http://nodejs.org/api/fs.html#fs_class_fs_stats
 * @see http://man7.org/linux/man-pages/man2/stat.2.html
 * @class
 */
export class Stats implements fs.Stats {
  public blocks: number;
  /**
   * UNSUPPORTED ATTRIBUTES
   * I assume no one is going to need these details, although we could fake
   * appropriate values if need be.
   */
  // ID of device containing file
  public dev: number = 0;
  // inode number
  public ino: number = 0;
  // device ID (if special file)
  public rdev: number = 0;
  // number of hard links
  public nlink: number = 1;
  // blocksize for file system I/O
  public blksize: number = 4096;
  // @todo Maybe support these? atm, it's a one-user filesystem.
  // user ID of owner
  public uid: number = 0;
  // group ID of owner
  public gid: number = 0;
  // XXX: Some file systems stash a file on stats objects.
  public file_data: file.File;

  /**
   * Provides information about a particular entry in the file system.
   * @param [Number] item_type type of the item (FILE, DIRECTORY, SYMLINK, or SOCKET)
   * @param [Number] size Size of the item in bytes. For directories/symlinks,
   *   this is normally the size of the struct that represents the item.
   * @param [Number] mode Unix-style file mode (e.g. 0o644)
   * @param [Date?] atime time of last access
   * @param [Date?] mtime time of last modification
   * @param [Date?] ctime time of creation
   */
  constructor(
    public item_type: FileType,
    public size: number,
    public mode: number = 0x1a4,
    public atime: Date = new Date(),
    public mtime: Date = new Date(),
    public ctime: Date = new Date()) {
    // number of 512B blocks allocated
    this.blocks = Math.ceil(size / 512);
    // XXX: Fix mode for emscripten.
    if (this.item_type === FileType.FILE) {
      this.mode |= 0x8000;
    } else {
      this.mode |= 0x4000;
    }
  }

  /**
   * **Nonstandard**: Clone the stats object.
   * @return [BrowserFS.node.fs.Stats]
   */
  public clone(): Stats {
    return new Stats(this.item_type, this.size, this.mode, this.atime, this.mtime, this.ctime);
  }

  /**
   * @return [Boolean] True if this item is a file.
   */
  public isFile(): boolean {
    return this.item_type === FileType.FILE;
  }

  /**
   * @return [Boolean] True if this item is a directory.
   */
  public isDirectory(): boolean {
    return this.item_type === FileType.DIRECTORY;
  }

  /**
   * @return [Boolean] True if this item is a symbolic link (only valid through lstat)
   */
  public isSymbolicLink(): boolean {
    return this.item_type === FileType.SYMLINK;
  }

  /**
   * @return [Boolean] True if this item is a socket
   */
  public isSocket(): boolean {
    return this.item_type === FileType.SOCKET;
  }

  /**
   * Until a character/FIFO filesystem comes about, everything is block based.
   * @return [Boolean] True; we currently only support block devices.
   */
  public isBlockDevice(): boolean {
    return true;
  }

  /**
   * @return [Boolean] False; we currently only support block devices.
   */
  public isCharacterDevice(): boolean {
    return false;
  }

  /**
   * @return [Boolean] False; we currently only support block devices.
   */
  public isFIFO(): boolean {
    return false;
  }
}
