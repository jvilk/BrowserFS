'use strict';

var assert = require('assert'),
 buffer = require('buffer'),
 Buffer = buffer.Buffer,
 SlowBuffer = buffer.SlowBuffer,
 ones = [1, 1, 1, 1];

// BFS: Changed deepEqual -> equal on toJSON.
function equalCheck(b1, b2) {
  if (!Buffer.isBuffer(b2)) {
    b2 = new Buffer(b2);
  }
  assert.equal(JSON.stringify(b1), JSON.stringify(b2));
}

module.exports = function() {
  // should create a Buffer
  var sb = new SlowBuffer(4);
  assert(sb instanceof Buffer);
  assert.strictEqual(sb.length, 4);
  sb.fill(1);
  equalCheck(sb, ones);

  // BFS: Do not support.
  // underlying ArrayBuffer should have the same length
  //assert.strictEqual(sb.buffer.byteLength, 4);

  // should work without new
  sb = SlowBuffer(4);
  assert(sb instanceof Buffer);
  assert.strictEqual(sb.length, 4);
  sb.fill(1);
  equalCheck(sb, ones);

  // should work with edge cases
  assert.strictEqual(SlowBuffer(0).length, 0);
  // BFS: I don't do pooling like Node.
  /*try {
    assert.strictEqual(SlowBuffer(buffer.kMaxLength).length, buffer.kMaxLength);
  } catch (e) {
    assert.equal(e.message, 'Invalid array buffer length');
  }*/

  // BFS: No!
  // should work with number-coercible values
  //assert.strictEqual(SlowBuffer('6').length, 6);
  //assert.strictEqual(SlowBuffer(true).length, 1);

  // BFS: Inconsistent w/ Buffer???
  // should create zero-length buffer if parameter is not a number
  //assert.strictEqual(SlowBuffer().length, 0);
  //assert.strictEqual(SlowBuffer(NaN).length, 0);
  //assert.strictEqual(SlowBuffer({}).length, 0);
  //assert.strictEqual(SlowBuffer('string').length, 0);

  // should throw with invalid length
  assert.throws(function() {
    new SlowBuffer(Infinity);
  }, 'invalid Buffer length');
  assert.throws(function() {
    new SlowBuffer(-1);
  }, 'invalid Buffer length');
  assert.throws(function() {
    new SlowBuffer(buffer.kMaxLength + 1);
  }, 'invalid Buffer length');
};