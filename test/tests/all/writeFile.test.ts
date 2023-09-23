import { backends, fs, configure, tmpDir, fixturesDir } from '../../common';
import * as path from 'path';

import { promisify } from 'node:util';
import { jest } from '@jest/globals';

const s =
	'南越国是前203年至前111年存在于岭南地区的一个国家，国都位于番禺，疆域包括今天中国的广东、广西两省区的大部份地区，福建省、湖南、贵州、云南的一小部份地区和越南的北部。南越国是秦朝灭亡后，由南海郡尉赵佗于前203年起兵兼并桂林郡和象郡后建立。前196年和前179年，南越国曾先后两次名义上臣属于西汉，成为西汉的“外臣”。前112年，南越国末代君主赵建德与西汉发生战争，被汉武帝于前111年所灭。南越国共存在93年，历经五代君主。南越国是岭南地区的第一个有记载的政权国家，采用封建制和郡县制并存的制度，它的建立保证了秦末乱世岭南地区社会秩序的稳定，有效的改善了岭南地区落后的政治、经济现状。\n';

describe.each(backends)('%s fs.writeFile', (name, options) => {
	const configured = configure({ fs: name, options });

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('should write and read file with specified content', async () => {
		await configured;

		if (fs.getMount('/').metadata.readonly) {
			return;
		}

		const join = path.join;
		const filename = join(tmpDir, 'test.txt');
		await promisify<string, string, void>(fs.writeFile)(filename, s);
		const buffer = await promisify(fs.readFile);
		filename;
		const expected = Buffer.byteLength(s);
		expect(expected).toBe(buffer.length);

		await promisify(fs.unlink)(filename);
	});

	it('should write and read file using buffer', async () => {
		await configured;

		if (fs.getMount('/').metadata.readonly) {
			return;
		}

		const join = path.join;
		const filename = join(tmpDir, 'test2.txt');

		const buf = Buffer.from(s, 'utf8');

		await promisify<string, Buffer, void>(fs.writeFile)(filename, buf);
		const buffer = await promisify(fs.readFile);
		filename;
		expect(buf.length).toBe(buffer.length);

		await promisify(fs.unlink)(filename);
	});

	it('should write base64 data to a file and read it back asynchronously', async () => {
		await configured;

		if (fs.getMount('/').metadata.readonly) {
			return;
		}

		const data =
			'/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAAQABADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDhfBUFl/wkOmPqKJJZw3aiZFBw4z93jnkkc9u9dj8XLfSI/EBt7DTo7ea2Ox5YXVo5FC7gTjq24nJPXNVtO0KATRvNHCIg3zoWJWQHqp+o4pun+EtJ0zxBq8mnLJa2d1L50NvnKRjJBUE5PAx3NYxxUY0pRtvYHSc5Ka2X9d7H/9k=';

		const buf = Buffer.from(data, 'base64');
		const filePath = path.join(tmpDir, 'test.jpg');

		await promisify<string, Buffer, void>(fs.writeFile)(filePath, buf);

		const bufdat = await promisify<string, Buffer>(fs.readFile)(filePath);
		expect(bufdat.toString('base64')).toBe(data);
	});
});
