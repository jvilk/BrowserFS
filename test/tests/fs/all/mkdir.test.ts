import { backends, fs, configure } from '../../../common';
import common from '../../../common';
import { promisify } from 'node:util';

describe.each(backends)('%s fs.mkdir', (name, options) => {
	const configured = configure({ fs: name, options });

	if (!fs.getRootFS().isReadOnly()) {
		const pathname1 = common.tmpDir + '/mkdir-test1';

		it('should create a directory and verify its existence', async () => {
			await configured;

			await promisify(fs.mkdir)(pathname1);
			const exists = await promisify(fs.exists)(pathname1);
			expect(exists).toBe(true);
		});

		const pathname2 = common.tmpDir + '/mkdir-test2';

		it('should create a directory with custom permissions and verify its existence', async () => {
			await configured;

			await promisify<string, number, void>(fs.mkdir)(pathname2, 0o777);
			const exists = await promisify(fs.exists)(pathname2);
			expect(exists).toBe(true);
		});

		const pathname3 = common.tmpDir + '/mkdir-test3/again';

		it('should not be able to create multi-level directories', async () => {
			await configured;

			try {
				await promisify<string, number, void>(fs.mkdir)(pathname3, 0o777);
			} catch (err) {
				expect(err).not.toBeNull();
			}
		});
	}
});
