import { backends, fs, configure } from '../../../common';
import * as path from 'path';
import common from '../../../common';
import { promisify } from 'node:util';

describe.each(backends)('%s File Writing', (name, options) => {
	const configured = configure({ fs: name, options });

	it('should write base64 data to a file and read it back', async () => {
		await configured;

		if (fs.getRootFS().isReadOnly()) {
			return;
		}

		const data =
			'/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAAQABADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDhfBUFl/wkOmPqKJJZw3aiZFBw4z93jnkkc9u9dj8XLfSI/EBt7DTo7ea2Ox5YXVo5FC7gTjq24nJPXNVtO0KATRvNHCIg3zoWJWQHqp+o4pun+EtJ0zxBq8mnLJa2d1L50NvnKRjJBUE5PAx3NYxxUY0pRtvYHSc5Ka2X9d7H/9k=';

		const buf = Buffer.from(data, 'base64');
		const filePath = path.join(common.tmpDir, 'test.jpg');

		await promisify<string, Buffer, void>(fs.writeFile)(filePath, buf);

		const bufdat = await promisify<string, Buffer>(fs.readFile)(filePath);
		expect(bufdat.toString('base64')).toBe(data);
	});
});
