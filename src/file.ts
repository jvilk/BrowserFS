import { ApiError, ErrorCode } from './ApiError';
import { Stats } from './stats';
import type { Buffer } from 'buffer';

export enum ActionType {
	// Indicates that the code should not do anything.
	NOP = 0,
	// Indicates that the code should throw an exception.
	THROW_EXCEPTION = 1,
	// Indicates that the code should truncate the file, but only if it is a file.
	TRUNCATE_FILE = 2,
	// Indicates that the code should create the file.
	CREATE_FILE = 3,
}

/**
 * Represents one of the following file flags. A convenience object.
 *
 * * `'r'` - Open file for reading. An exception occurs if the file does not exist.
 * * `'r+'` - Open file for reading and writing. An exception occurs if the file does not exist.
 * * `'rs'` - Open file for reading in synchronous mode. Instructs the filesystem to not cache writes.
 * * `'rs+'` - Open file for reading and writing, and opens the file in synchronous mode.
 * * `'w'` - Open file for writing. The file is created (if it does not exist) or truncated (if it exists).
 * * `'wx'` - Like 'w' but opens the file in exclusive mode.
 * * `'w+'` - Open file for reading and writing. The file is created (if it does not exist) or truncated (if it exists).
 * * `'wx+'` - Like 'w+' but opens the file in exclusive mode.
 * * `'a'` - Open file for appending. The file is created if it does not exist.
 * * `'ax'` - Like 'a' but opens the file in exclusive mode.
 * * `'a+'` - Open file for reading and appending. The file is created if it does not exist.
 * * `'ax+'` - Like 'a+' but opens the file in exclusive mode.
 *
 * Exclusive mode ensures that the file path is newly created.
 */
export class FileFlag {
	// Contains cached FileMode instances.
	private static flagCache: Map<string, FileFlag> = new Map();
	// Array of valid mode strings.
	private static validFlagStrs = ['r', 'r+', 'rs', 'rs+', 'w', 'wx', 'w+', 'wx+', 'a', 'ax', 'a+', 'ax+'];

	/**
	 * Get an object representing the given file flag.
	 * @param modeStr The string representing the flag
	 * @return The FileFlag object representing the flag
	 * @throw when the flag string is invalid
	 */
	public static getFileFlag(flagStr: string): FileFlag {
		// Check cache first.
		if (!FileFlag.flagCache.has(flagStr)) {
			FileFlag.flagCache.set(flagStr, new FileFlag(flagStr));
		}
		return FileFlag.flagCache.get(flagStr);
	}

	private flagStr: string;
	/**
	 * This should never be called directly.
	 * @param modeStr The string representing the mode
	 * @throw when the mode string is invalid
	 */
	constructor(flagStr: string) {
		this.flagStr = flagStr;
		if (FileFlag.validFlagStrs.indexOf(flagStr) < 0) {
			throw new ApiError(ErrorCode.EINVAL, 'Invalid flag: ' + flagStr);
		}
	}

	/**
	 * Get the underlying flag string for this flag.
	 */
	public getFlagString(): string {
		return this.flagStr;
	}

	/**
	 * Get the equivalent mode (0b0xxx: read, write, execute)
	 * Note: Execute will always be 0
	 */
	public getMode(): number {
		let mode = 0;
		mode <<= 1;
		mode += +this.isReadable();
		mode <<= 1;
		mode += +this.isWriteable();
		mode <<= 1;
		return mode;
	}

	/**
	 * Returns true if the file is readable.
	 */
	public isReadable(): boolean {
		return this.flagStr.indexOf('r') !== -1 || this.flagStr.indexOf('+') !== -1;
	}
	/**
	 * Returns true if the file is writeable.
	 */
	public isWriteable(): boolean {
		return this.flagStr.indexOf('w') !== -1 || this.flagStr.indexOf('a') !== -1 || this.flagStr.indexOf('+') !== -1;
	}
	/**
	 * Returns true if the file mode should truncate.
	 */
	public isTruncating(): boolean {
		return this.flagStr.indexOf('w') !== -1;
	}
	/**
	 * Returns true if the file is appendable.
	 */
	public isAppendable(): boolean {
		return this.flagStr.indexOf('a') !== -1;
	}
	/**
	 * Returns true if the file is open in synchronous mode.
	 */
	public isSynchronous(): boolean {
		return this.flagStr.indexOf('s') !== -1;
	}
	/**
	 * Returns true if the file is open in exclusive mode.
	 */
	public isExclusive(): boolean {
		return this.flagStr.indexOf('x') !== -1;
	}
	/**
	 * Returns one of the static fields on this object that indicates the
	 * appropriate response to the path existing.
	 */
	public pathExistsAction(): ActionType {
		if (this.isExclusive()) {
			return ActionType.THROW_EXCEPTION;
		} else if (this.isTruncating()) {
			return ActionType.TRUNCATE_FILE;
		} else {
			return ActionType.NOP;
		}
	}
	/**
	 * Returns one of the static fields on this object that indicates the
	 * appropriate response to the path not existing.
	 */
	public pathNotExistsAction(): ActionType {
		if ((this.isWriteable() || this.isAppendable()) && this.flagStr !== 'r+') {
			return ActionType.CREATE_FILE;
		} else {
			return ActionType.THROW_EXCEPTION;
		}
	}
}

export interface File {
	/**
	 * **Core**: Get the current file position.
	 */
	getPos(): number | undefined;
	/**
	 * **Core**: Asynchronous `stat`.
	 */
	stat(): Promise<Stats>;
	/**
	 * **Core**: Synchronous `stat`.
	 */
	statSync(): Stats;
	/**
	 * **Core**: Asynchronous close.
	 */
	close(): Promise<void>;
	/**
	 * **Core**: Synchronous close.
	 */
	closeSync(): void;
	/**
	 * **Core**: Asynchronous truncate.
	 */
	truncate(len: number): Promise<void>;
	/**
	 * **Core**: Synchronous truncate.
	 */
	truncateSync(len: number): void;
	/**
	 * **Core**: Asynchronous sync.
	 */
	sync(): Promise<void>;
	/**
	 * **Core**: Synchronous sync.
	 */
	syncSync(): void;
	/**
	 * **Core**: Write buffer to the file.
	 * Note that it is unsafe to use fs.write multiple times on the same file
	 * without waiting for the callback.
	 * @param buffer Buffer containing the data to write to
	 *  the file.
	 * @param offset Offset in the buffer to start reading data from.
	 * @param length The amount of bytes to write to the file.
	 * @param position Offset from the beginning of the file where this
	 *   data should be written. If position is null, the data will be written at
	 *   the current position.
	 * @returns Promise resolving to the new length of the buffer
	 */
	write(buffer: Buffer, offset: number, length: number, position: number | null): Promise<number>;
	/**
	 * **Core**: Write buffer to the file.
	 * Note that it is unsafe to use fs.writeSync multiple times on the same file
	 * without waiting for it to return.
	 * @param buffer Buffer containing the data to write to
	 *  the file.
	 * @param offset Offset in the buffer to start reading data from.
	 * @param length The amount of bytes to write to the file.
	 * @param position Offset from the beginning of the file where this
	 *   data should be written. If position is null, the data will be written at
	 *   the current position.
	 */
	writeSync(buffer: Buffer, offset: number, length: number, position: number | null): number;
	/**
	 * **Core**: Read data from the file.
	 * @param buffer The buffer that the data will be
	 *   written to.
	 * @param offset The offset within the buffer where writing will
	 *   start.
	 * @param length An integer specifying the number of bytes to read.
	 * @param position An integer specifying where to begin reading from
	 *   in the file. If position is null, data will be read from the current file
	 *   position.
	 * @returns Promise resolving to the new length of the buffer
	 */
	read(buffer: Buffer, offset: number, length: number, position: number | null): Promise<number>;
	/**
	 * **Core**: Read data from the file.
	 * @param buffer The buffer that the data will be written to.
	 * @param offset The offset within the buffer where writing will start.
	 * @param length An integer specifying the number of bytes to read.
	 * @param position An integer specifying where to begin reading from
	 *   in the file. If position is null, data will be read from the current file
	 *   position.
	 */
	readSync(buffer: Buffer, offset: number, length: number, position: number): number;
	/**
	 * **Supplementary**: Asynchronous `datasync`.
	 *
	 * Default implementation maps to `sync`.
	 */
	datasync(): Promise<void>;
	/**
	 * **Supplementary**: Synchronous `datasync`.
	 *
	 * Default implementation maps to `syncSync`.
	 */
	datasyncSync(): void;
	/**
	 * **Optional**: Asynchronous `chown`.
	 */
	chown(uid: number, gid: number): Promise<void>;
	/**
	 * **Optional**: Synchronous `chown`.
	 */
	chownSync(uid: number, gid: number): void;
	/**
	 * **Optional**: Asynchronous `fchmod`.
	 */
	chmod(mode: number): Promise<void>;
	/**
	 * **Optional**: Synchronous `fchmod`.
	 */
	chmodSync(mode: number): void;
	/**
	 * **Optional**: Change the file timestamps of the file.
	 */
	utimes(atime: Date, mtime: Date): Promise<void>;
	/**
	 * **Optional**: Change the file timestamps of the file.
	 */
	utimesSync(atime: Date, mtime: Date): void;
}

/**
 * Base class that contains shared implementations of functions for the file
 * object.
 */
export class BaseFile {
	public async sync(): Promise<void> {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public syncSync(): void {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public async datasync(): Promise<void> {
		return this.sync();
	}
	public datasyncSync(): void {
		return this.syncSync();
	}
	public async chown(uid: number, gid: number): Promise<void> {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public chownSync(uid: number, gid: number): void {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public async chmod(mode: number): Promise<void> {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public chmodSync(mode: number): void {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public async utimes(atime: Date, mtime: Date): Promise<void> {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
	public utimesSync(atime: Date, mtime: Date): void {
		throw new ApiError(ErrorCode.ENOTSUP);
	}
}
