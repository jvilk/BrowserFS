import { backends, fs, configure } from '../../../common';
import * as path from 'path';
import common from '../../../common';
import { promisify } from 'util';
import type { ApiError } from '../../../../src/core/api_error';

const existingFile = path.join(common.fixturesDir, 'exit.js');

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
	const rootFS = fs.getRootFS();

	it('should handle async operations with error', async () => {
		await configured;
		const fn = path.join(common.fixturesDir, 'non-existent');

		await expectAsyncError(fs.stat, fn);

		if (!rootFS.isReadOnly()) {
			await expectAsyncError(fs.mkdir, existingFile, 0o666);
			await expectAsyncError(fs.rmdir, fn);
			await expectAsyncError(fs.rmdir, existingFile);
			await expectAsyncError(fs.rename, fn, 'foo');
			await expectAsyncError(fs.open, fn, 'r');
			await expectAsyncError(fs.readdir, fn);
			await expectAsyncError(fs.unlink, fn);

			if (rootFS.supportsLinks()) {
				await expectAsyncError(fs.link, fn, 'foo');
			}

			if (rootFS.supportsProps()) {
				await expectAsyncError(fs.chmod, fn, 0o666);
			}
		}

		if (rootFS.supportsLinks()) {
			await expectAsyncError(fs.lstat, fn);
			await expectAsyncError(fs.readlink, fn);
		}
	});

	// Sync operations
	if (rootFS.supportsSynch()) {
		it('should handle sync operations with error', async () => {
			await configured;
			const fn = path.join(common.fixturesDir, 'non-existent');
			const existingFile = path.join(common.fixturesDir, 'exit.js');

			expectSyncError(fs.statSync, fn);

			if (!rootFS.isReadOnly()) {
				expectSyncError(fs.mkdirSync, existingFile, 0o666);
				expectSyncError(fs.rmdirSync, fn);
				expectSyncError(fs.rmdirSync, existingFile);
				expectSyncError(fs.renameSync, fn, 'foo');
				expectSyncError(fs.openSync, fn, 'r');
				expectSyncError(fs.readdirSync, fn);
				expectSyncError(fs.unlinkSync, fn);

				if (rootFS.supportsProps()) {
					expectSyncError(fs.chmodSync, fn, 0o666);
				}

				if (rootFS.supportsLinks()) {
					expectSyncError(fs.linkSync, fn, 'foo');
				}
			}

			if (rootFS.supportsLinks()) {
				expectSyncError(fs.lstatSync, fn);
				expectSyncError(fs.readlinkSync, fn);
			}
		});
	}
});
