import HTML5FS from '../../../src/backend/HTML5FS';
import BackendFactory = require('../BackendFactory');
import file_system = require('../../../src/core/file_system');

function HTML5FSFactory(cb: (name: string, obj: file_system.FileSystem[]) => void): void {
  if (HTML5FS.isAvailable()) {
    var fs = new HTML5FS(10, window.TEMPORARY);
    fs.allocate((err?) => {
      if (err) {
        throw err;
      } else {
        fs.empty((err2?) => {
          if (err2) {
            throw err2;
          } else {
            cb('HTML5FS', [fs]);
          }
        });
      }
    });
  } else {
    cb('HTML5FS', []);
  }
}

var _: BackendFactory = HTML5FSFactory;

export = HTML5FSFactory;
