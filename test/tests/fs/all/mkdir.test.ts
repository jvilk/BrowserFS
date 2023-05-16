import { fs } from '../../../common';

describe('mkdir', () => {
	it('should not create a file in a non-existent directory', () => {
		if (!fs.getRootFS().isReadOnly()) {
			return new Promise<void>((resolve, reject) => {
				fs.writeFile('does/not/exist.txt', "BFS plz don't create this", err => {
					if (!err) {
						reject(new Error('Created a file in a nonexistent directory!'));
						return;
					}

					fs.mkdir('does', err => {
						if (err) {
							reject(err);
							return;
						}

						fs.mkdir('does/not', err => {
							if (err) {
								reject(err);
								return;
							}

							fs.writeFile('does/not/exist.txt', 'Should work', err => {
								if (err) {
									reject(err);
									return;
								}

								resolve();
							});
						});
					});
				});
			});
		}
	});
});
