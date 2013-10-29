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
 * @class
 */
export class Stats implements fs.Stats {
  public blocks: number;
  public dev: number = 0;
  public ino: number = 0;
  public rdev: number = 0;
  public nlink: number = 1;
  public blksize: number = 4096;
  public uid: number = 0;
  public gid: number = 0;
  // XXX: Some file systems stash a file on stats objects.
  public file_data: file.File;
  constructor(
    public item_type: FileType,
    public size: number,
    public mode: number = 0x1a4,
    public atime: Date = new Date(),
    public mtime: Date = new Date(),
    public ctime: Date = new Date()) {
    this.blocks = Math.ceil(size / 512);
  }

  public clone(): Stats {
    return new Stats(this.item_type, this.size, this.mode, this.atime, this.mtime, this.ctime);
  }

  public isFile(): boolean {
    return this.item_type === FileType.FILE;
  }

  public isDirectory(): boolean {
    return this.item_type === FileType.DIRECTORY;
  }

  public isSymbolicLink(): boolean {
    return this.item_type === FileType.SYMLINK;
  }

  public isSocket(): boolean {
    return this.item_type === FileType.SOCKET;
  }

  public isBlockDevice(): boolean {
    return true;
  }

  public isCharacterDevice(): boolean {
    return false;
  }

  public isFIFO(): boolean {
    return false;
  }
}
