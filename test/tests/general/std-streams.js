var assert = require('wrapped-assert'),
  Buffer = require('buffer').Buffer,
  fs = require('fs');

module.exports = function() {
  var datStr = "hey\nhere's some data.",
      count = 0,
      streamComplete = 0,
      cb = function(stream) {
          var localCount = 0;
          return function(data) {
            assert(typeof(data) !== 'string');
            assert.equal(data.toString(), datStr);
            count++;
            if (++localCount === 2) {
              localCount = 0;
              if (++streamComplete === 3) {
                streamComplete = 0;
              }
            }
          }
        },
        streams = [process.stdout, process.stderr, process.stdin],
        i;

  for (i = 0; i < streams.length; i++) {
    streams[i].on('data', cb(streams[i]));
    // Write as string, receive as buffer.
    streams[i].write(datStr);
    // Write as buffer, receive as buffer.
    streams[i].write(new Buffer(datStr));
  }

  process.on('exit', function() {
    for (i = 0; i < streams.length; i++) {
     // Remove all listeners.
     streams[i].removeAllListeners();
    }
    assert.equal(count, 6);
  });
};
