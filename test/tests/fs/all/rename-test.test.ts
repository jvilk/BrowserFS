import { backends, fs } from '../../../common';
import * as path from 'path';

describe.each(backends)('%s File and Directory Rename Tests', () => {
	let rootFS;
	let isReadOnly;

	beforeAll(() => {
		rootFS = fs.getRootFS();
		isReadOnly = rootFS.isReadOnly();
	});

	if (isReadOnly) {
		return;
	}

	/**
	 * Creates the following directory structure within the given dir:
	 * - _rename_me
	 *   - lol.txt
	 * - file.dat
	 */
	function populate_directory(dir, cb) {
		const dir1 = path.resolve(dir, '_rename_me');
		const file1 = path.resolve(dir, 'file.dat');
		const file2 = path.resolve(dir1, 'lol.txt');

		fs.mkdir(dir1, e => {
			if (e) {
				throw e;
			}
			fs.writeFile(file1, Buffer.from('filedata'), e => {
				if (e) {
					throw e;
				}
				fs.writeFile(file2, Buffer.from('lololol'), e => {
					if (e) {
						throw e;
					}
					cb();
				});
			});
		});
	}

	/**
	 * Check that the directory structure created in populate_directory remains.
	 */
	function check_directory(dir, cb) {
		const dir1 = path.resolve(dir, '_rename_me');
		const file1 = path.resolve(dir, 'file.dat');
		const file2 = path.resolve(dir1, 'lol.txt');

		fs.readdir(dir, (e, contents) => {
			if (e) {
				throw e;
			}
			expect(contents.length).toBe(2);
			fs.readdir(dir1, (e, contents) => {
				if (e) {
					throw e;
				}
				expect(contents.length).toBe(1);
				fs.exists(file1, exists => {
					expect(exists).toBe(true);
					fs.exists(file2, exists => {
						expect(exists).toBe(true);
						cb();
					});
				});
			});
		});
	}

	test('Directory Rename', done => {
		const oldDir = '/rename_test';
		const newDir = '/rename_test2';

		fs.mkdir(oldDir, e => {
			if (e) {
				throw e;
			}
			populate_directory(oldDir, () => {
				fs.rename(oldDir, oldDir, e => {
					if (e) {
						throw new Error('Failed invariant: CAN rename a directory to itself.');
					}
					check_directory(oldDir, () => {
						fs.mkdir(newDir, e => {
							if (e) {
								throw e;
							}
							fs.rmdir(newDir, e => {
								if (e) {
									throw e;
								}
								fs.rename(oldDir, newDir, e => {
									if (e) {
										throw new Error('Failed to rename directory.');
									}
									check_directory(newDir, () => {
										fs.exists(oldDir, exists => {
											if (exists) {
												throw new Error('Failed invariant: Renamed directory still exists at old name.');
											}
											// Renaming directories with *different* parent directories.
											fs.mkdir(oldDir, e => {
												if (e) {
													throw e;
												}
												populate_directory(oldDir, () => {
													fs.rename(oldDir, path.resolve(newDir, 'newDir'), e => {
														if (e) {
															throw new Error('Failed to rename directories with different parents.');
														}
														done();
													});
												});
											});
										});
									});
								});
							});
						});
					});
				});
			});
		});
	});

	test('File Rename', done => {
		const fileDir = '/rename_file_test';
		const file1 = path.resolve(fileDir, 'fun.js');
		const file2 = path.resolve(fileDir, 'fun2.js');
		fs.mkdir(fileDir, e => {
			if (e) {
				throw e;
			}
			fs.writeFile(file1, Buffer.from('while(1) alert("Hey! Listen!");'), e => {
				fs.rename(file1, file1, e => {
					if (e) {
						throw new Error('Failed invariant: CAN rename file to itself.');
					}
					fs.rename(file1, file2, e => {
						if (e) {
							throw new Error('Failed invariant: Failed to rename file.');
						}
						fs.writeFile(file1, Buffer.from('hey'), e => {
							if (e) {
								throw e;
							}
							fs.rename(file1, file2, e => {
								if (e) {
									throw new Error('Failed invariant: Renaming a file to an existing file overwrites the file.');
								}
								fs.readFile(file2, (e, contents) => {
									if (e) {
										throw e;
									}
									expect(contents.toString()).toBe('hey');
									fs.exists(file1, exists => {
										expect(exists).toBe(false);
										done();
									});
								});
							});
						});
					});
				});
			});
		});
	});

	test('File to Directory and Directory to File Rename', done => {
		const dir = '/rename_filedir_test';
		const file = '/rename_filedir_test.txt';
		fs.mkdir(dir, e => {
			if (e) {
				throw e;
			}
			fs.writeFile(file, Buffer.from('file contents go here'), e => {
				if (e) {
					throw e;
				}
				fs.rename(file, dir, e => {
					if (e == null) {
						throw new Error('Failed invariant: Cannot rename a file over an existing directory.');
					} else {
						// Some *native* file systems throw EISDIR, others throw EPERM.... accept both.
						expect(e.code === 'EISDIR' || e.code === 'EPERM').toBe(true);
					}

					// JV: Removing test for now. I noticed that you can do that in Node v0.12 on Mac,
					// but it might be FS independent.
					/*fs.rename(dir, file, function (e) {
									  if (e == null) {
										throw new Error("Failed invariant: Cannot rename a directory over a file.");
									  } else {
										assert(e.code === 'ENOTDIR');
									  }
									});*/

					done();
				});
			});
		});
	});

	test('Cannot Rename a Directory Inside Itself', done => {
		const renDir1 = '/renamedir_1';
		const renDir2 = '/renamedir_1/lol';
		fs.mkdir(renDir1, e => {
			if (e) {
				throw e;
			}
			fs.rename(renDir1, renDir2, e => {
				if (e == null) {
					throw new Error('Failed invariant: Cannot move a directory inside itself.');
				} else {
					// expect(e.code).toBe('EBUSY');
				}
				done();
			});
		});
	});
});
