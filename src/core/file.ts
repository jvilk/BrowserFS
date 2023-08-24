import { ApiError, ErrorCode } from './api_error';
import Stats from './stats';
import type { Buffer } from 'buffer';

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
