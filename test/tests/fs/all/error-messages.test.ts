import { backends, fs } from '../../../common';
import * as path from 'path';
import common from '../../../common';

const existingFile = path.join(common.fixturesDir, 'exit.js');

describe.each(backends)('%s File System Tests', () => {
	const rootFS = fs.getRootFS();

	it('should handle async operations with error', done => {
		const fn = path.join(common.fixturesDir, 'non-existent');

		fs.stat(fn, (err: any) => {
			expect(err.path).toBe(fn);
			expect(err.message).toContain(fn);

			fs.lstat(fn, (err: any) => {
				expect(err.path).toBe(fn);
				expect(err.message).toContain(fn);

				if (!rootFS.isReadOnly()) {
					fs.unlink(fn, (err: any) => {
						expect(err.path).toBe(fn);
						expect(err.message).toContain(fn);

						fs.rename(fn, 'foo', (err: any) => {
							expect(err.path).toBe(fn);
							expect(err.message).toContain(fn);

							fs.rmdir(fn, (err: any) => {
								expect(err.path).toBe(fn);
								expect(err.message).toContain(fn);

								fs.mkdir(existingFile, 0o666, (err: any) => {
									expect(err.path).toBe(existingFile);
									expect(err.message).toContain(existingFile);

									fs.rmdir(existingFile, (err: any) => {
										expect(err.path).toBe(existingFile);
										expect(err.message).toContain(existingFile);
										done();
									});
								});
							});
						});
					});
				} else {
					done();
				}
			});
		});
	});

	if (rootFS.supportsLinks()) {
		it('should handle async link operations with error', done => {
			const fn = path.join(common.fixturesDir, 'non-existent');

			fs.readlink(fn, (err: any) => {
				expect(err.path).toBe(fn);
				expect(err.message).toContain(fn);

				if (!rootFS.isReadOnly()) {
					fs.link(fn, 'foo', (err: any) => {
						expect(err.path).toBe(fn);
						expect(err.message).toContain(fn);
						done();
					});
				} else {
					done();
				}
			});
		});
	}

	if (rootFS.supportsProps() && !rootFS.isReadOnly()) {
		it('should handle async chmod operation with error', done => {
			const fn = path.join(common.fixturesDir, 'non-existent');

			fs.chmod(fn, 0o666, (err: any) => {
				expect(err.path).toBe(fn);
				expect(err.message).toContain(fn);
				done();
			});
		});
	}

	// Sync operations
	if (rootFS.supportsSynch()) {
		let errors: string[] = [];

		it('should handle sync operations with error', () => {
			const fn = path.join(common.fixturesDir, 'non-existent');
			const existingFile = path.join(common.fixturesDir, 'exit.js');
			const canWrite = !rootFS.isReadOnly();

			let expected = 0;

			try {
				expected++;
				fs.statSync(fn);
			} catch (err) {
				errors.push('stat');
				expect(err.path).toBe(fn);
				expect(err.message).toContain(fn);
			}

			if (canWrite) {
				try {
					expected++;
					fs.mkdirSync(existingFile, 0o666);
				} catch (err) {
					errors.push('mkdir');
					expect(err.path).toBe(existingFile);
					expect(err.message).toContain(existingFile);
				}

				try {
					expected++;
					fs.rmdirSync(fn);
				} catch (err) {
					errors.push('rmdir');
					expect(err.path).toBe(fn);
					expect(err.message).toContain(fn);
				}

				try {
					expected++;
					fs.rmdirSync(existingFile);
				} catch (err) {
					errors.push('rmdir');
					expect(err.path).toBe(existingFile);
					expect(err.message).toContain(existingFile);
				}

				try {
					expected++;
					fs.renameSync(fn, 'foo');
				} catch (err) {
					errors.push('rename');
					expect(err.path).toBe(fn);
					expect(err.message).toContain(fn);
				}

				try {
					expected++;
					fs.lstatSync(fn);
				} catch (err) {
					errors.push('lstat');
					expect(err.path).toBe(fn);
					expect(err.message).toContain(fn);
				}

				try {
					expected++;
					fs.openSync(fn, 'r');
				} catch (err) {
					errors.push('opens');
					expect(err.path).toBe(fn);
					expect(err.message).toContain(fn);
				}

				try {
					expected++;
					fs.readdirSync(fn);
				} catch (err) {
					errors.push('readdir');
					expect(err.path).toBe(fn);
					expect(err.message).toContain(fn);
				}

				try {
					expected++;
					fs.unlinkSync(fn);
				} catch (err) {
					errors.push('unlink');
					expect(err.message).toContain(fn);
				}

				if (rootFS.supportsProps()) {
					try {
						expected++;
						fs.chmodSync(fn, 0o666);
					} catch (err) {
						errors.push('chmod');
						expect(err.path).toBe(fn);
						expect(err.message).toContain(fn);
					}
				}

				if (rootFS.supportsLinks()) {
					try {
						expected++;
						fs.linkSync(fn, 'foo');
					} catch (err) {
						errors.push('link');
						expect(err.path).toBe(fn);
						expect(err.message).toContain(fn);
					}

					try {
						expected++;
						fs.readlinkSync(fn);
					} catch (err) {
						errors.push('readlink');
						expect(err.path).toBe(fn);
						expect(err.message).toContain(fn);
					}
				}
			}
			expect(errors.length).toBe(expected);
		});
	}
});
