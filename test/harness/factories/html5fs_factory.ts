import html5fs = require('../../../src/backend/html5fs');
import BackendFactory = require('../BackendFactory');
import file_system = require('../../../src/core/file_system');

function HTML5FSFactory(cb: (obj: file_system.FileSystem[]) => void): void {
  if (html5fs.HTML5FS.isAvailable()) {
    var fs = new html5fs.HTML5FS(10, window.TEMPORARY);
    fs.allocate((err?) => {
      if (err) {
        throw err;
      } else {
        fs.empty((err2?) => {
          if (err2) {
            throw err2;
          } else {
            cb([fs]);
          }
        });
      }
    });
  } else {
    cb([]);
  }
}

var _: BackendFactory = HTML5FSFactory;

export = HTML5FSFactory;
