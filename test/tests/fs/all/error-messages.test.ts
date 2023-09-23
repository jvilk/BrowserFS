import { backends, fs, configure, fixturesDir } from '../../../common';
import * as path from 'path';

import { promisify } from 'util';
import type { ApiError } from '../../../../src/ApiError';

const existingFile = path.join(fixturesDir, 'exit.js');

const expectAsyncError = async (fn, p: string, ...args) => {
	let error: ApiError;
	try {
		await promisify(fn)(p, ...args);
	} catch (err) {
		error = err;
	}
	expect(error).toBeDefined();
	expect(error.path).toBe(p);
	expect(error.message).toContain(p);
	return error;
};

const expectSyncError = (fn, p: string, ...args) => {
	let error: ApiError;
	try {
		fn(p, ...args);
	} catch (err) {
		error = err;
	}
	expect(error).toBeDefined();
	expect(error.path).toBe(p);
	expect(error.message).toContain(p);
	return error;
};

describe.each(backends)('%s File System Tests', (name, options) => {
	const configured = configure({ fs: name, options });

	it('should handle async operations with error', async () => {
		await configured;
		const fn = path.join(fixturesDir, 'non-existent');

		await expectAsyncError(fs.stat, fn);

		if (!fs.getMount('/').metadata.readonly) {
			await expectAsyncError(fs.mkdir, existingFile, 0o666);
			await expectAsyncError(fs.rmdir, fn);
			await expectAsyncError(fs.rmdir, existingFile);
			await expectAsyncError(fs.rename, fn, 'foo');
			await expectAsyncError(fs.open, fn, 'r');
			await expectAsyncError(fs.readdir, fn);
			await expectAsyncError(fs.unlink, fn);

			if (fs.getMount('/').metadata.supportsLinks) {
				await expectAsyncError(fs.link, fn, 'foo');
			}

			if (fs.getMount('/').metadata.supportsProperties) {
				await expectAsyncError(fs.chmod, fn, 0o666);
			}
		}

		if (fs.getMount('/').metadata.supportsLinks) {
			await expectAsyncError(fs.lstat, fn);
			await expectAsyncError(fs.readlink, fn);
		}
	});

	// Sync operations
	if (fs.getMount('/').metadata.synchronous) {
		it('should handle sync operations with error', async () => {
			await configured;
			const fn = path.join(fixturesDir, 'non-existent');
			const existingFile = path.join(fixturesDir, 'exit.js');

			expectSyncError(fs.statSync, fn);

			if (!fs.getMount('/').metadata.readonly) {
				expectSyncError(fs.mkdirSync, existingFile, 0o666);
				expectSyncError(fs.rmdirSync, fn);
				expectSyncError(fs.rmdirSync, existingFile);
				expectSyncError(fs.renameSync, fn, 'foo');
				expectSyncError(fs.openSync, fn, 'r');
				expectSyncError(fs.readdirSync, fn);
				expectSyncError(fs.unlinkSync, fn);

				if (fs.getMount('/').metadata.supportsProperties) {
					expectSyncError(fs.chmodSync, fn, 0o666);
				}

				if (fs.getMount('/').metadata.supportsLinks) {
					expectSyncError(fs.linkSync, fn, 'foo');
				}
			}

			if (fs.getMount('/').metadata.supportsLinks) {
				expectSyncError(fs.lstatSync, fn);
				expectSyncError(fs.readlinkSync, fn);
			}
		});
	}
});
