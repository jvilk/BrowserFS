import { Stats, FileType } from '../src/stats';
import { configure as _configure, fs } from '../src/index';
import * as path from 'node:path';
import * as _fs from 'node:fs';

export const tmpDir = 'tmp/';
export const fixturesDir = 'test/fixtures/files/node';

function copy(srcFS: typeof _fs, dstFS: typeof fs, _p: string) {
	const p = path.posix.resolve(_p);
	const stats = srcFS.statSync(p);

	if (!stats.isDirectory()) {
		dstFS.writeFileSync(p, srcFS.readFileSync(_p));
		return;
	}

	dstFS.mkdirSync(p);
	for (const file of srcFS.readdirSync(_p)) {
		copy(srcFS, dstFS, path.posix.join(p, file));
	}
}

export async function configure(config) {
	const result = await _configure(config);
	copy(_fs, fs, fixturesDir);
	return result;
}

export { fs };

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
	//LocalStorage: {},
	OverlayFS: { readable: { fs: 'InMemory' }, writable: { fs: 'InMemory' } },
	//WorkerFS: {},
	//HTTPRequest: {},
	//ZipFS: {},
};

export const backends = Object.entries(tests);
