import idbfs = require('../../../src/backend/IndexedDB');
import BackendFactory = require('../BackendFactory');
import file_system = require('../../../src/core/file_system');

function IDBFSFactory(cb: (obj: file_system.FileSystem[]) => void): void {
  if (idbfs.IndexedDBFileSystem.isAvailable()) {
    new idbfs.IndexedDBFileSystem((e, idbfs?) => {
      if (e) {
        throw e;
      } else {
        idbfs.empty((e?) => {
          if (e) {
            throw e;
          } else {
            cb([idbfs]);
          }
        });
      }
    }, 'test');
  } else {
    cb([]);
  }
}

var _: BackendFactory = IDBFSFactory;

export = IDBFSFactory;
