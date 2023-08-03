import { backends, fs } from '../../../common';
import * as path from 'path';

describe.each(backends)('%s PermissionsTest', () => {
	const testFileContents = Buffer.from('this is a test file, plz ignore.');

	function is_writable(mode: number) {
		return (mode & 146) > 0;
	}

	function is_readable(mode: number) {
		return (mode & 0x124) > 0;
	}

	function is_executable(mode: number) {
		return (mode & 0x49) > 0;
	}

	function process_file(p: string, fileMode: number) {
		return new Promise<void>((resolve, reject) => {
			fs.readFile(p, (err, data) => {
				if (err) {
					if (err.code === 'EPERM') {
						// Invariant 2: We can only read a file if we have read permissions on the file.
						expect(is_readable(fileMode)).toBe(false);
						resolve();
					} else {
						reject(err);
					}
				} else {
					// Invariant 2: We can only read a file if we have read permissions on the file.
					expect(is_readable(fileMode)).toBe(true);
					resolve();
				}
			});

			// Try opening file for appending, but append *nothing*.
			fs.open(p, 'a', (err, fd) => {
				if (err) {
					if (err.code === 'EPERM') {
						// Invariant 3: We can only write to a file if we have write permissions on the file.
						expect(is_writable(fileMode)).toBe(false);
						resolve();
					} else {
						reject(err);
					}
				} else {
					// Invariant 3: We can only write to a file if we have write permissions on the file.
					expect(is_writable(fileMode)).toBe(true);
					fs.close(fd, () => {
						resolve();
					});
				}
			});
		});
	}

	function process_directory(p: string, dirMode: number) {
		return new Promise<void>((resolve, reject) => {
			fs.readdir(p, (err, dirs) => {
				if (err) {
					if (err.code === 'EPERM') {
						// Invariant 2: We can only readdir if we have read permissions on the directory.
						expect(is_readable(dirMode)).toBe(false);
						resolve();
					} else {
						reject(err);
					}
				} else {
					// Invariant 2: We can only readdir if we have read permissions on the directory.
					expect(is_readable(dirMode)).toBe(true);
					const promises = dirs.map(dir => process_item(path.resolve(p, dir), dirMode));
					Promise.all(promises)
						.then(() => {
							// Try to write a file into the directory.
							const testFile = path.resolve(p, '__test_file_plz_ignore.txt');
							fs.writeFile(testFile, testFileContents, err => {
								if (err) {
									if (err.code === 'EPERM') {
										// Invariant 3: We can only write to a new file if we have write permissions in the directory.
										expect(is_writable(dirMode)).toBe(false);
										resolve();
									} else {
										reject(err);
									}
								} else {
									// Invariant 3: We can only write to a new file if we have write permissions in the directory.
									expect(is_writable(dirMode)).toBe(true);
									// Clean up.
									fs.unlink(testFile, err => {
										expect(err).toBe(null); // Clean up does not affect the test result, so we don't need to assert on the error.
										resolve();
									});
								}
							});
						})
						.catch(reject);
				}
			});
		});
	}

	function process_item(p: string, parentMode: number) {
		return new Promise<void>((resolve, reject) => {
			fs.stat(p, (err, stat) => {
				if (err) {
					if (err.code === 'EPERM') {
						// Invariant 4: Ensure we do not have execute permissions on parent directory.
						expect(is_executable(parentMode)).toBe(false);
						resolve();
					} else {
						reject(err);
					}
				} else {
					// Invariant 4: Ensure we have execute permissions on parent directory.
					expect(is_executable(parentMode)).toBe(true);
					if (fs.getRootFS().isReadOnly()) {
						// Invariant 1: RO FS do not support write permissions.
						expect(is_writable(stat.mode)).toBe(false);
					}
					if (stat.isDirectory()) {
						process_directory(p, stat.mode).then(resolve).catch(reject);
					} else {
						process_file(p, stat.mode).then(resolve).catch(reject);
					}
				}
			});
		});
	}

	it('should satisfy the permissions invariants', () => {
		return process_item('/', 0x1ff);
	});
});
