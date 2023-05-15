import assert from '../../harness/wrapped-assert';

export default function () {
	const zero: Buffer[] = [];
	const one = [new Buffer('asdf')];
	const _long: Buffer[] = [];
	for (let i = 0; i < 10; i++) _long.push(new Buffer('asdf'));

	const flatZero = Buffer.concat(zero);
	const flatOne = Buffer.concat(one);
	const flatLong = Buffer.concat(_long);
	const flatLongLen = Buffer.concat(_long, 40);

	assert(flatZero.length === 0);
	assert(flatOne.toString() === 'asdf');
	// A special case where concat used to return the first item,
	// if the length is one. This check is to make sure that we don't do that.
	assert(flatOne !== one[0]);
	assert(flatLong.toString() === new Array(10 + 1).join('asdf'));
	assert(flatLongLen.toString() === new Array(10 + 1).join('asdf'));
	assert.throws(function () {
		Buffer.concat(<any>[42]);
	}, TypeError);
	// BFS: Adding for good measure.
	assert.throws(function () {
		Buffer.concat(<any>[42], 10);
	}, TypeError);
}
