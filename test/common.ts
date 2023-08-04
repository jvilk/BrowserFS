import Stats, { FileType } from '../src/core/stats';
import { BFSRequire } from '../src/index';
//import type { backends as Backends } from '../src/core/backends';

/* Used by (almost) all tests */
export default {
	tmpDir: '/tmp/',
	fixturesDir: '/test/fixtures/files/node',
};
export { configure } from '../src/index';
export const fs = BFSRequire('fs');

export function createMockStats(mode): Stats {
	return new Stats(FileType.FILE, -1, mode);
}

const tests /*: { [B in keyof typeof Backends]: Parameters<typeof Backends[B]['Create']>[0] }*/ = {
	AsyncMirror: { sync: { fs: 'InMemory' }, async: { fs: 'InMemory' } },
	//Dropbox: {},
	//Emscripten: {},
	//FileSystemAccess: {},
	FolderAdapter: { wrapped: { fs: 'InMemory' }, folder: '/example' },
	InMemory: {},
	//IndexedDB: {},
	//IsoFS: {},
	LocalStorage: {},
	MountableFileSystem: { '/tmp': { fs: 'InMemory' } },
	OverlayFS: { readable: { fs: 'InMemory' }, writable: { fs: 'InMemory' } },
	//WorkerFS: {},
	//HTTPRequest: {},
	//ZipFS: {},
};

export const backends = Object.entries(tests);
