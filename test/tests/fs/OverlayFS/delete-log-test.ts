import { fs } from '../../../common';
import * as BrowserFS from '../../../../src/core/browserfs';

let __numWaiting: number;

describe('Deletion Log', () => {
	let rootFS: BrowserFS.Backend.OverlayFS;
	let readable: BrowserFS.FileSystem;
	let writable: typeof fs;
	const logPath = '/.deletedFiles.log';

	beforeAll(() => {
		rootFS = fs.getRootFS() as BrowserFS.Backend.OverlayFS;
		const fses = rootFS.getOverlayedFileSystems();
		readable = fses.readable;
		writable = fses.writable;
	});

	test('Deletion Log Functionality', async () => {
		if (__numWaiting) {
		}

		// Back up the current log.
		const deletionLog = rootFS.getDeletionLog();

		// Delete a file in the underlay.
		fs.unlinkSync('/test/fixtures/files/node/a.js');
		expect(fs.existsSync('/test/fixtures/files/node/a.js')).toBe(false);

		// Try to move the deletion log.
		expect(() => {
			fs.renameSync(logPath, logPath + '2');
		}).toThrow('Should not be able to rename the deletion log.');

		// Move another file over the deletion log.
		expect(() => {
			fs.renameSync('/test/fixtures/files/node/a1.js', logPath);
		}).toThrow('Should not be able to rename a file over the deletion log.');

		// Remove the deletion log.
		expect(() => {
			fs.unlinkSync(logPath);
		}).toThrow('Should not be able to delete the deletion log.');

		// Open the deletion log.
		expect(() => {
			fs.openSync(logPath, 'r');
		}).toThrow('Should not be able to open the deletion log.');

		// Re-write a.js.
		fs.writeFileSync('/test/fixtures/files/node/a.js', Buffer.from('hi', 'utf8'));
		expect(fs.existsSync('/test/fixtures/files/node/a.js')).toBe(true);

		// Remove something else.
		fs.unlinkSync('/test/fixtures/files/node/a1.js');
		expect(fs.existsSync('/test/fixtures/files/node/a1.js')).toBe(false);

		// Wait for OverlayFS to persist delete log changes.
		__numWaiting++;
		await new Promise<void>(resolve => {
			const interval = setInterval(() => {
				if (!(rootFS as any)._deleteLogUpdatePending) {
					clearInterval(interval);
					resolve();
				}
			}, 4);
		});

		// Re-mount OverlayFS.
		return new Promise<void>(resolve => {
			BrowserFS.Backend.OverlayFS.Create(
				{
					writable,
					readable,
				},
				(e, overlayFs) => {
					expect(e).toBeNull();
					rootFS = overlayFs as BrowserFS.Backend.OverlayFS;
					fs.initialize(rootFS);
					rootFS = (rootFS as BrowserFS.Backend.OverlayFS).unwrap();
					expect(fs.existsSync('/test/fixtures/files/node/a.js')).toBe(true);
					rootFS.restoreDeletionLog('');
					expect(fs.existsSync('/test/fixtures/files/node/a1.js')).toBe(true);
					// Manually restore original deletion log.
					rootFS.restoreDeletionLog(deletionLog);
					resolve();
				}
			);
		});
	});
});
