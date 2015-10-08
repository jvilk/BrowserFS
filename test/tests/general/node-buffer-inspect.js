'use strict';
var assert = require('assert'),
  buffer = require('buffer'),
  Buffer = buffer.Buffer;

// BFS: Switching 'util.inspect' to 'buffer.inspect'.
module.exports = function() {
  var IMB = buffer.INSPECT_MAX_BYTES;
  buffer.INSPECT_MAX_BYTES = 2;

  var b = new Buffer(4);
  b.fill('1234');

  var s = new buffer.SlowBuffer(4);
  s.fill('1234');

  var expected = '<Buffer 31 32 ... >';

  assert.strictEqual(b.inspect(b), expected);
  assert.strictEqual(b.inspect(s), expected);

  b = new Buffer(2);
  b.fill('12');

  s = new buffer.SlowBuffer(2);
  s.fill('12');

  expected = '<Buffer 31 32>';

  assert.strictEqual(b.inspect(b), expected);
  assert.strictEqual(b.inspect(s), expected);

  buffer.INSPECT_MAX_BYTES = Infinity;

  assert.doesNotThrow(function() {
    assert.strictEqual(b.inspect(b), expected);
    assert.strictEqual(b.inspect(s), expected);
  });
  buffer.INSPECT_MAX_BYTES = IMB;
};