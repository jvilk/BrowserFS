import { AsyncMirror } from './AsyncMirror';
import { DropboxFileSystem as Dropbox } from './Dropbox';
import { EmscriptenFileSystem as Emscripten } from './Emscripten';
import { FileSystemAccessFileSystem as FileSystemAccess } from './FileSystemAccess';
import { FolderAdapter } from './FolderAdapter';
import { InMemoryFileSystem as InMemory } from './InMemory';
import { IndexedDBFileSystem as IndexedDB } from './IndexedDB';
import { LocalStorageFileSystem as LocalStorage } from './LocalStorage';
import { OverlayFS } from './OverlayFS';
import { WorkerFS } from './WorkerFS';
import { HTTPRequest } from './HTTPRequest';
import { ZipFS } from './ZipFS';
import { IsoFS } from './IsoFS';
import { BackendConstructor } from './backend';

export const backends: { [backend: string]: BackendConstructor } = {
	AsyncMirror,
	Dropbox,
	Emscripten,
	FileSystemAccess,
	FolderAdapter,
	InMemory,
	IndexedDB,
	IsoFS,
	LocalStorage,
	OverlayFS,
	WorkerFS,
	HTTPRequest,
	XMLHTTPRequest: HTTPRequest,
	ZipFS,
};

export {
	AsyncMirror,
	Dropbox,
	Emscripten,
	FileSystemAccess,
	FolderAdapter,
	InMemory,
	IndexedDB,
	IsoFS,
	LocalStorage,
	OverlayFS,
	WorkerFS,
	HTTPRequest,
	HTTPRequest as XMLHTTPRequest,
	ZipFS,
};
