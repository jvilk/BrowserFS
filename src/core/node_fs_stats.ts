/// <reference path="../../vendor/node.d.ts" />
// Import the type annotation from Node.
import fs = require('fs');
import file = require('file');

export enum FileType {
  FILE = 1,
  DIRECTORY = 2,
  SYMLINK = 3,
  SOCKET = 4
}

export class Stats implements fs.Stats {
  public item_type: FileType;
  public size: number;
  public mode: number;
  public atime: Date;
  public mtime: Date;
  public ctime: Date;
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
  constructor(item_type: FileType, size, mode = 0x1a4, atime = new Date(), mtime = new Date(), ctime = new Date()) {
    this.item_type = item_type;
    this.size = size;
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
