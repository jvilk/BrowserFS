define([], function() { return function(){
  var datStr = "hey\nhere's some data.",
      cb = function(data) {
        if (currentEncoding === null) {
          assert(typeof(data) !== 'string');
          assert(data.toString() === datStr);
        } else {
          assert(data === datStr);
        }
      },
      currentEncoding = null,
      streams = [process.stdout, process.stderr, process.stdin],
      i;

  for (i = 0; i < streams.length; i++) {
    streams[i].setEncoding(null);
    streams[i].on('data', cb);
    // Write as string, receive as buffer.
    streams[i].write(datStr);
    // Write as buffer, receive as buffer.
    streams[i].write(new Buffer(datStr));
    // Prepare for next loop.
    streams[i].setEncoding('utf8');
  }

  currentEncoding = 'utf8';
  for (i = 0; i < streams.length; i++) {
    // Write as string, receive as string.
    streams[i].write(datStr);
    // Write as buffer, receive as string.
    streams[i].write(new Buffer(datStr));
    // Remove all listeners.
    streams[i].removeAllListeners();
  }
};});
