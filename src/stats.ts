import type { StatsBase } from 'fs';
import { Cred } from './cred';
import { Buffer } from 'buffer';
import { S_IFDIR, S_IFLNK, S_IFMT, S_IFREG } from './emulation/constants';

/**
 * Indicates the type of the given file. Applied to 'mode'.
 */
export enum FileType {
	FILE = S_IFREG,
	DIRECTORY = S_IFDIR,
	SYMLINK = S_IFLNK,
}

/**
 * Implementation of Node's `Stats`.
 *
 * Attribute descriptions are from `man 2 stat'
 * @see http://nodejs.org/api/fs.html#fs_class_fs_stats
 * @see http://man7.org/linux/man-pages/man2/stat.2.html
 */
export class Stats implements StatsBase<number> {
	public static fromBuffer(buffer: Buffer): Stats {
		const size = buffer.readUInt32LE(0),
			mode = buffer.readUInt32LE(4),
			atime = buffer.readDoubleLE(8),
			mtime = buffer.readDoubleLE(16),
			ctime = buffer.readDoubleLE(24),
			uid = buffer.readUInt32LE(32),
			gid = buffer.readUInt32LE(36);

		return new Stats(mode & S_IFMT, size, mode & ~S_IFMT, atime, mtime, ctime, uid, gid);
	}

	/**
	 * Clones the stats object.
	 */
	public static clone(s: Stats): Stats {
		return new Stats(s.mode & S_IFMT, s.size, s.mode & ~S_IFMT, s.atimeMs, s.mtimeMs, s.ctimeMs, s.uid, s.gid, s.birthtimeMs);
	}

	public blocks: number;
	public mode: number;
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
	// user ID of owner
	public uid: number = 0;
	// group ID of owner
	public gid: number = 0;
	// Some file systems stash data on stats objects.
	public fileData: Buffer | null = null;
	public atimeMs: number;
	public mtimeMs: number;
	public ctimeMs: number;
	public birthtimeMs: number;
	public size: number;

	public get atime(): Date {
		return new Date(this.atimeMs);
	}

	public get mtime(): Date {
		return new Date(this.mtimeMs);
	}

	public get ctime(): Date {
		return new Date(this.ctimeMs);
	}

	public get birthtime(): Date {
		return new Date(this.birthtimeMs);
	}

	/**
	 * Provides information about a particular entry in the file system.
	 * @param itemType Type of the item (FILE, DIRECTORY, SYMLINK, or SOCKET)
	 * @param size Size of the item in bytes. For directories/symlinks,
	 *   this is normally the size of the struct that represents the item.
	 * @param mode Unix-style file mode (e.g. 0o644)
	 * @param atimeMs time of last access, in milliseconds since epoch
	 * @param mtimeMs time of last modification, in milliseconds since epoch
	 * @param ctimeMs time of last time file status was changed, in milliseconds since epoch
	 * @param uid the id of the user that owns the file
	 * @param gid the id of the group that owns the file
	 * @param birthtimeMs time of file creation, in milliseconds since epoch
	 */
	constructor(itemType: FileType, size: number, mode?: number, atimeMs?: number, mtimeMs?: number, ctimeMs?: number, uid?: number, gid?: number, birthtimeMs?: number) {
		this.size = size;
		let currentTime = 0;
		if (typeof atimeMs !== 'number') {
			currentTime = Date.now();
			atimeMs = currentTime;
		}
		if (typeof mtimeMs !== 'number') {
			if (!currentTime) {
				currentTime = Date.now();
			}
			mtimeMs = currentTime;
		}
		if (typeof ctimeMs !== 'number') {
			if (!currentTime) {
				currentTime = Date.now();
			}
			ctimeMs = currentTime;
		}
		if (typeof birthtimeMs !== 'number') {
			if (!currentTime) {
				currentTime = Date.now();
			}
			birthtimeMs = currentTime;
		}
		if (typeof uid !== 'number') {
			uid = 0;
		}
		if (typeof gid !== 'number') {
			gid = 0;
		}
		this.atimeMs = atimeMs;
		this.ctimeMs = ctimeMs;
		this.mtimeMs = mtimeMs;
		this.birthtimeMs = birthtimeMs;

		if (!mode) {
			switch (itemType) {
				case FileType.FILE:
					this.mode = 0o644;
					break;
				case FileType.DIRECTORY:
				default:
					this.mode = 0o777;
			}
		} else {
			this.mode = mode;
		}
		// number of 512B blocks allocated
		this.blocks = Math.ceil(size / 512);
		// Check if mode also includes top-most bits, which indicate the file's
		// type.
		if ((this.mode & S_IFMT) == 0) {
			this.mode |= itemType;
		}
	}

	public toBuffer(): Buffer {
		const buffer = Buffer.alloc(32);
		buffer.writeUInt32LE(this.size, 0);
		buffer.writeUInt32LE(this.mode, 4);
		buffer.writeDoubleLE(this.atime.getTime(), 8);
		buffer.writeDoubleLE(this.mtime.getTime(), 16);
		buffer.writeDoubleLE(this.ctime.getTime(), 24);
		buffer.writeUInt32LE(this.uid, 32);
		buffer.writeUInt32LE(this.gid, 36);
		return buffer;
	}

	/**
	 * @return [Boolean] True if this item is a file.
	 */
	public isFile(): boolean {
		return (this.mode & S_IFMT) === S_IFREG;
	}

	/**
	 * @return [Boolean] True if this item is a directory.
	 */
	public isDirectory(): boolean {
		return (this.mode & S_IFMT) === S_IFDIR;
	}

	/**
	 * @return [Boolean] True if this item is a symbolic link (only valid through lstat)
	 */
	public isSymbolicLink(): boolean {
		return (this.mode & S_IFMT) === S_IFLNK;
	}

	/**
	 * Checks if a given user/group has access to this item
	 * @param mode The request access as 4 bits (unused, read, write, execute)
	 * @param uid The requesting UID
	 * @param gid The requesting GID
	 * @returns [Boolean] True if the request has access, false if the request does not
	 */
	public hasAccess(mode: number, cred: Cred): boolean {
		if (cred.euid === 0 || cred.egid === 0) {
			//Running as root
			return true;
		}
		const perms = this.mode & ~S_IFMT;
		let uMode = 0xf,
			gMode = 0xf,
			wMode = 0xf;

		if (cred.euid == this.uid) {
			const uPerms = (0xf00 & perms) >> 8;
			uMode = (mode ^ uPerms) & mode;
		}
		if (cred.egid == this.gid) {
			const gPerms = (0xf0 & perms) >> 4;
			gMode = (mode ^ gPerms) & mode;
		}
		const wPerms = 0xf & perms;
		wMode = (mode ^ wPerms) & mode;
		/*
        Result = 0b0xxx (read, write, execute)
        If any bits are set that means the request does not have that permission.
    */
		const result = uMode & gMode & wMode;
		return !result;
	}

	/**
	 * Convert the current stats object into a cred object
	 */
	public getCred(uid: number = this.uid, gid: number = this.gid): Cred {
		return new Cred(uid, gid, this.uid, this.gid, uid, gid);
	}

	/**
	 * Change the mode of the file. We use this helper function to prevent messing
	 * up the type of the file, which is encoded in mode.
	 */
	public chmod(mode: number): void {
		this.mode = (this.mode & S_IFMT) | mode;
	}

	/**
	 * Change the owner user/group of the file.
	 * This function makes sure it is a valid UID/GID (that is, a 32 unsigned int)
	 */
	public chown(uid: number, gid: number): void {
		if (!isNaN(+uid) && 0 <= +uid && +uid < 2 ** 32) {
			this.uid = uid;
		}
		if (!isNaN(+gid) && 0 <= +gid && +gid < 2 ** 32) {
			this.gid = gid;
		}
	}

	// We don't support the following types of files.

	public isSocket(): boolean {
		return false;
	}

	public isBlockDevice(): boolean {
		return false;
	}

	public isCharacterDevice(): boolean {
		return false;
	}

	public isFIFO(): boolean {
		return false;
	}
}
