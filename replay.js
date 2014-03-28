function ReplayStart() {
  /**
   * Replays a log file.
   */
  var fname = 'log_0.txt',
    descHash = {}, parsedData, i = 0, inNode = false,
    fs = require('fs'), Buffer, getTime = (function() {
      return typeof performance !== 'undefined' ? function() { return performance.now(); } : function() { return Date.now(); };
    })(),
    timeNow = getTime();

  if (typeof BrowserFS === 'undefined') {
    inNode = true;
    fs.mkdirSync('tmp');
    Buffer = require('buffer').Buffer;
  } else {
    var Buffer = BrowserFS.BFSRequire('buffer').Buffer;
  }

  function fixPath2(p) {
    // Maps browser path to local path, if needed.
    var parts = p.split('/');
    // In the browser, fix some relative paths.
    if (!inNode) {
      switch(parts[1]) {
        case 'tmp':
        case 'sys':
          // Path is fine.
          return p;
        case 'vendor':
        case 'benchmark':
          // Append /sys
          return '/sys' + p;
        default:
          // Append /tmp
          return '/tmp' + p;
      }
    }
    // First part is empty (all paths begin w/ '/'), second part has dir.
    switch(parts[1]) {
      case 'tmp':
        // Slice off root part.
        return p.slice(1);
      case 'sys':
        // Slice off /sys/
        return p.slice(5);
      case 'vendor':
        return p.slice(1);
      case 'benchmark':
        return p.slice(1);
      default:
        // From a FD (path local to FS backend); append /tmp mountpoint.
        return 'tmp' + p;
    }
  }

  // XXX: hackfix for /sys statting
  function fixPath(p) {
    p = fixPath2(p);
    if (p === '') {
      return '.';
    }
    return p;
  }

  function getFd(p) {
    if (descHash.hasOwnProperty(p)) {
      return descHash[p];
    }
    throw new Error("File " + p + " isn't open.");
  }

  function putFd(p, fd) {
    if (descHash.hasOwnProperty(p)) {
      throw new Error("File " + p + " is already open.");
    }
    descHash[p] = fd;
  }

  function delFd(p, fd) {
    if (descHash.hasOwnProperty(p)) {
      delete descHash[p];
    } else {
      throw new Error("File " + p + " is not open.");
    }
  }

  var errors = [];
  function next(e) {
    if (e) errors.push(i-1);

    if (i === parsedData.length) {
      // done
      console.log("Benchmark time: " + (getTime() - timeNow) + " ms");
      console.log(JSON.stringify(errors));
      return;
    }
    var cmd = parsedData[i++];
    if (cmd.length > 1) {
      var p = fixPath(cmd[1]);
    }

    switch(cmd[0]) {
      case 'readFile':
      case 'stat':
      case 'readdir':
      case 'mkdir':
        return fs[cmd[0]](p, next);
      case 'open':
        return fs.open(p, cmd[2], function(e, fd) {
          if (e) console.error(e);
          else {
            putFd(p, fd);
          }
          next();
        });
      case 'fstat':
        return fs.fstat(getFd(p), next);
      case 'read':
      case 'write':
        var data = new Buffer(cmd[2]);
        return fs[cmd[0]](getFd(p), data, 0, cmd[2], null, next);
      case 'close':
        var fd = getFd(p);
        delFd(p);
        return fs.close(fd, next);
      default:
        throw new Error("Unrecognized command: " + cmd[0]);
    }
  }

  fs.readFile(fname, {encoding: 'utf8'}, function(err, data) {
    if (err) throw err;
    parsedData = JSON.parse(data);
    next();
  });
}

ReplayStart();