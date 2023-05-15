/**
 * Sanity checks our buffer implementation. The Node tests assume that all
 * numerical transformations work, so they do not test these cases.
 */
import assert from '../../harness/wrapped-assert';

export default function () {
	let i: number,
		buff = new Buffer(8);

	/**
	 * Simple get/set tests
	 */

	function testFunction(readFunc: string, writeFunc: string) {
		return function (nums: number | number[]) {
			let writeNum: number, expectNum: number;
			if (Array.isArray(nums)) {
				writeNum = nums[0];
				expectNum = nums[1];
			} else {
				writeNum = expectNum = nums;
			}
			(<any>buff)[writeFunc](writeNum, 0, true);
			if (!isNaN(expectNum)) {
				assert.strictEqual(expectNum, (<any>buff)[readFunc](0));
			} else {
				assert(isNaN((<any>buff)[readFunc](0)));
			}
		};
	}

	const oneByteInts = [0, 0x7f, [0xff, -1], -1 * 0x7f, -1];
	oneByteInts.forEach(testFunction('readInt8', 'writeInt8'));

	const readMethods = ['readInt16LE', 'readInt16BE'];
	const writeMethods = ['writeInt16LE', 'writeInt16BE'];
	const twoByteInts = [0, 0x7fff, [0xffff, -1], -1 * 0x7fff, -1];
	for (i = 0; i < 2; i++) {
		twoByteInts.forEach(testFunction(readMethods[i], writeMethods[i]));
	}

	const fourByteInts = [0, 0x7fffffff, [0xffffffff, 0xffffffff | 0], -1, -1 * 0x7fffffff];
	const readMethods4B = ['readInt32LE', 'readInt32BE'];
	const writeMethods4B = ['writeInt32LE', 'writeInt32BE'];
	for (i = 0; i < 2; i++) {
		fourByteInts.forEach(testFunction(readMethods4B[i], writeMethods4B[i]));
	}

	const floatVals = [0, -1, 1, [Math.pow(2, 128), Number.POSITIVE_INFINITY], [-1 * Math.pow(2, 128), Number.NEGATIVE_INFINITY], NaN];
	floatVals.forEach(testFunction('readFloatLE', 'writeFloatLE'));
	floatVals.forEach(testFunction('readFloatBE', 'writeFloatBE'));

	// int -> float
	const int2float = [
		[0x7f800000, Number.POSITIVE_INFINITY],
		[-8388608, Number.NEGATIVE_INFINITY],
		[0x7fc00000, Number.NaN],
	];
	int2float.forEach(testFunction('readFloatLE', 'writeInt32LE'));
	int2float.forEach(testFunction('readFloatBE', 'writeInt32BE'));

	const doubleVals = [0, -1, 1, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, NaN];
	doubleVals.forEach(testFunction('readDoubleLE', 'writeDoubleLE'));
	doubleVals.forEach(testFunction('readDoubleBE', 'writeDoubleBE'));

	// long -> double
	const long2double = [
		[0, 0, 0],
		[0x80000000, 0, 0],
		[0x7ff00000, 0, Number.POSITIVE_INFINITY],
		[0xfff00000, 0, Number.NEGATIVE_INFINITY],
		[0x7ff00001, 0, Number.NaN],
		[0xfff00001, 0, Number.NaN],
		// Denormalized
		[0, 1, 4.94065645841246544176568792868e-324],
	];

	long2double.forEach(function (nums) {
		// LE
		buff.writeUInt32LE(nums[1], 0);
		buff.writeUInt32LE(nums[0], 4);
		if (isNaN(nums[2])) {
			assert(isNaN(buff.readDoubleLE(0)));
		} else {
			assert.strictEqual(nums[2], buff.readDoubleLE(0));
		}

		// BE
		buff.writeUInt32BE(nums[0], 0);
		buff.writeUInt32BE(nums[1], 4);
		if (isNaN(nums[2])) {
			assert(isNaN(buff.readDoubleBE(0)));
		} else {
			assert.strictEqual(nums[2], buff.readDoubleBE(0));
		}
	});

	// signed vs unsigned
	buff.writeUInt8(0xff, 0);
	assert.strictEqual(-1, buff.readInt8(0));
	buff.writeInt8(-1, 0);
	assert.strictEqual(0xff, buff.readUInt8(0));

	buff.writeUInt16LE(0xffff, 0);
	assert.strictEqual(-1, buff.readInt16LE(0));
	assert.strictEqual(-1, buff.readInt16BE(0));
	buff.writeInt16LE(-1, 0);
	assert.strictEqual(0xffff, buff.readUInt16LE(0));
	assert.strictEqual(0xffff, buff.readUInt16BE(0));

	buff.writeUInt32LE(0xffffffff, 0);
	assert.strictEqual(-1, buff.readInt32LE(0));
	assert.strictEqual(-1, buff.readInt32BE(0));
	buff.writeInt32LE(-1, 0);
	assert.strictEqual(0xffffffff, buff.readUInt32LE(0));
	assert.strictEqual(0xffffffff, buff.readUInt32BE(0));

	/**
	 * Endianness Fun Time (tm)
	 */
	buff.writeUInt8(1 << 7, 0);
	buff.writeUInt8(1, 1);
	assert.strictEqual(384, buff.readInt16LE(0));
	assert.strictEqual(-32767, buff.readInt16BE(0));

	buff.writeUInt8(1, 0);
	buff.writeUInt8(1 << 1, 1);
	buff.writeUInt8(1 << 2, 2);
	buff.writeUInt8(1 << 3, 3);
	assert.strictEqual(134480385, buff.readInt32LE(0));
	assert.strictEqual(16909320, buff.readInt32BE(0));
	assert.strictEqual(3.972466068346319e-34, buff.readFloatLE(0));
	assert.strictEqual(2.388012128110808e-38, buff.readFloatBE(0));

	buff.writeUInt8(1 << 4, 4);
	buff.writeUInt8(1 << 5, 5);
	buff.writeUInt8(1 << 6, 6);
	buff.writeUInt8(1 << 7, 7);
	assert.strictEqual(-1.793993013121266e-307, buff.readDoubleLE(0));
	assert.strictEqual(8.209688573201296e-304, buff.readDoubleBE(0));

	/**
	 * Slice test! Ensure that sliced buffers share the same backing memory.
	 */
	const buff1 = new Buffer(4);
	const buff2 = buff1.slice(2);
	buff1.writeInt16LE(-203, 2);
	assert.strictEqual(-203, buff1.readInt16LE(2));
	assert.strictEqual(-203, buff2.readInt16LE(0));

	/**
	 * Testing that the 'binary' encoding !== 'ascii' encoding.
	 */
	// Characters are truncated at 0xFF.
	assert.equal(buff.write(String.fromCharCode(0xfff), 0, 10, 'binary'), 1);
	assert.equal(buff.toString('binary', 0, 1), String.fromCharCode(0xff));
	// Characters are truncated at 0x7F.
	buff.write(String.fromCharCode(0xff), 0, 1, 'ascii');
	assert.equal(buff.toString('ascii', 0, 1), String.fromCharCode(0x7f));

	/**
	 * Testing extended ASCII support.
	 * TODO: Test explicitly on ExtendedAscii class, since we no longer
	 * use our own buffer implementation.
	 */
	// Write as UTF-8, read as ASCII/Extended ASCII. Boundary condition.
	/*buff.write("Hello" + String.fromCharCode(0x7F) + "World");
  assert(buff.toString('ascii', 0, 11) === buff.toString('extended_ascii', 0, 11));
  buff.write('\u00A6', 0, 1, 'extended_ascii');
  assert(buff.toString('ascii', 0, 1) !== buff.toString('extended_ascii', 0, 1));
  assert(buff.toString('ascii', 0, 1) !== '\u00A6');
  assert(buff.toString('extended_ascii', 0, 1) === '\u00A6');*/

	/**
	 * Array setter accepts signed numbers.
	 */
	buff[0] = -5;
	assert.equal(buff[0], 251);

	/**
	 * Copying to/from buffers that are slices.
	 */
	const originalBuff1 = new Buffer(10),
		originalBuff2 = new Buffer(10),
		slice1 = originalBuff1.slice(1),
		slice2 = originalBuff2.slice(1);

	// Zero first two offsets of destination slice.
	originalBuff2.writeUInt8(0, 0);
	originalBuff2.writeUInt8(0, 1);

	originalBuff1.writeUInt8(1, 0);
	originalBuff1.writeUInt8(2, 1);

	// slice2[1] should be 2.
	slice1.copy(slice2, 0, 0, 1);
	assert.equal(slice2.readUInt8(0), 2);
	assert.equal(originalBuff2.readUInt8(1), 2);
}
