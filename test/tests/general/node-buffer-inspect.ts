import assert from '../../harness/wrapped-assert';
import * as BrowserFS from '../../../src/core/browserfs';

// BFS: Switching 'util.inspect' to 'buffer.inspect'.
export default function () {
	const buffer = BrowserFS.BFSRequire('buffer');
	const IMB = buffer.INSPECT_MAX_BYTES;
	(<any>buffer).INSPECT_MAX_BYTES = 2;

	let b = new Buffer(4);
	b.fill('1234');

	let s = new buffer.SlowBuffer(4);
	s.fill('1234');

	let expected = '<Buffer 31 32 ... >';

	assert.strictEqual((<any>b).inspect(b), expected);
	assert.strictEqual((<any>b).inspect(s), expected);

	b = new Buffer(2);
	b.fill('12');

	s = new buffer.SlowBuffer(2);
	s.fill('12');

	expected = '<Buffer 31 32>';

	assert.strictEqual((<any>b).inspect(b), expected);
	assert.strictEqual((<any>b).inspect(s), expected);

	(<any>buffer).INSPECT_MAX_BYTES = Infinity;

	assert.doesNotThrow(function () {
		assert.strictEqual((<any>b).inspect(b), expected);
		assert.strictEqual((<any>b).inspect(s), expected);
	});
	(<any>buffer).INSPECT_MAX_BYTES = IMB;
}
