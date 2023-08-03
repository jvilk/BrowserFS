import Stats, { FileType } from '../src/core/stats';
import { BFSRequire, configureAsync } from '../src/index';
import { backends as Backends } from '../src/core/backends';

/* Used by (almost) all tests */
export default {
	tmpDir: '/tmp/',
	fixturesDir: '/test/fixtures/files/node',
};
await configureAsync({ fs: 'InMemory' });
export const fs = BFSRequire('fs');

export function createMockStats(mode): Stats {
	return new Stats(FileType.FILE, -1, mode);
}

export const backends = Object.entries(Backends);
