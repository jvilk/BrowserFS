import { BackendConstructor, BFSCallback, FileSystem } from './file_system';
import { ApiError } from './api_error';
import { checkOptions } from './util';
import AsyncMirror from '../backend/AsyncMirror';
import Dropbox from '../backend/Dropbox';
import Emscripten from '../backend/Emscripten';
import FileSystemAccess from '../backend/FileSystemAccess';
import FolderAdapter from '../backend/FolderAdapter';
import InMemory from '../backend/InMemory';
import IndexedDB from '../backend/IndexedDB';
import LocalStorage from '../backend/LocalStorage';
import MountableFileSystem from '../backend/MountableFileSystem';
import OverlayFS from '../backend/OverlayFS';
import WorkerFS from '../backend/WorkerFS';
import HTTPRequest from '../backend/HTTPRequest';
import ZipFS from '../backend/ZipFS';
import IsoFS from '../backend/IsoFS';

// Monkey-patch `Create` functions to check options before file system initialization.
for (const fsType of [
	AsyncMirror,
	Dropbox,
	Emscripten,
	FileSystemAccess,
	FolderAdapter,
	InMemory,
	IndexedDB,
	IsoFS,
	LocalStorage,
	MountableFileSystem,
	OverlayFS,
	WorkerFS,
	HTTPRequest,
	ZipFS,
] as BackendConstructor[]) {
	const create = fsType.Create;
	fsType.Create = function (opts?: any, cb?: BFSCallback<FileSystem>): void {
		const oneArg = typeof opts === 'function';
		const normalizedCb = oneArg ? opts : cb;
		const normalizedOpts = oneArg ? {} : opts;

		function wrappedCb(e?: ApiError): void {
			if (e) {
				normalizedCb(e);
			} else {
				create.call(fsType, normalizedOpts, normalizedCb);
			}
		}

		checkOptions(fsType, normalizedOpts)
			.then(() => wrappedCb())
			.catch(wrappedCb);
	};
}

/**
 * @hidden
 */
export const backends: { [name: string]: BackendConstructor } = {
	AsyncMirror,
	Dropbox,
	Emscripten,
	FileSystemAccess,
	FolderAdapter,
	InMemory,
	IndexedDB,
	IsoFS,
	LocalStorage,
	MountableFileSystem,
	OverlayFS,
	WorkerFS,
	HTTPRequest,
	XmlHttpRequest: HTTPRequest,
	ZipFS,
};
