import { fs } from '../../../common';
import { type FileSystem, OverlayFS } from '../../../../src';
import { Cred } from '../../../../src/cred';

let __numWaiting: number;

describe('Deletion Log', () => {
	let rootFS: InstanceType<typeof OverlayFS>;
	let readable: FileSystem;
	let writable: FileSystem;
	const logPath = '/.deletedFiles.log';

	beforeAll(() => {
		rootFS = fs.getMount('/') as InstanceType<typeof OverlayFS>;
		const fses = rootFS.getOverlayedFileSystems();
		readable = fses.readable;
		writable = fses.writable;
	});

	test('Deletion Log Functionality', async () => {
		if (__numWaiting) {
		}

		// Back up the current log.
		const deletionLog = rootFS.fs.getDeletionLog();

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
		const overlayFs = await OverlayFS.Create({ writable, readable });

		rootFS = overlayFs as InstanceType<typeof OverlayFS>;
		fs.initialize({ '/': rootFS });
		const newRoot = (rootFS as InstanceType<typeof OverlayFS>).unwrap();
		expect(fs.existsSync('/test/fixtures/files/node/a.js')).toBe(true);
		rootFS.fs.restoreDeletionLog('', Cred.Root);
		expect(fs.existsSync('/test/fixtures/files/node/a1.js')).toBe(true);
		// Manually restore original deletion log.
		rootFS.fs.restoreDeletionLog(deletionLog, Cred.Root);
	});
});
