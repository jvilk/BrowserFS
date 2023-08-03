import { backends, fs } from '../../../common';
import common from '../../../common';

describe.each(backends)('%s fs.mkdir', () => {
	if (!fs.getRootFS().isReadOnly()) {
		const pathname1 = common.tmpDir + '/mkdir-test1';

		it('should create a directory and verify its existence', done => {
			fs.mkdir(pathname1, err => {
				expect(err).toBeNull();
				fs.exists(pathname1, y => {
					expect(y).toBe(true);
					done();
				});
			});
		});

		const pathname2 = common.tmpDir + '/mkdir-test2';

		it('should create a directory with custom permissions and verify its existence', done => {
			fs.mkdir(pathname2, 0o777, err => {
				expect(err).toBeNull();
				fs.exists(pathname2, y => {
					expect(y).toBe(true);
					done();
				});
			});
		});

		const pathname3 = common.tmpDir + '/mkdir-test3/again';

		it('should not be able to create multi-level directories', done => {
			fs.mkdir(pathname3, 0o777, err => {
				expect(err).not.toBeNull();
				done();
			});
		});
	}
});
