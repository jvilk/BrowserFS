import HTML5FS from '../../../src/backend/HTML5FS';
import {FileSystem} from '../../../src/core/file_system';

export default function HTML5FSFactory(cb: (name: string, obj: FileSystem[]) => void): void {
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
