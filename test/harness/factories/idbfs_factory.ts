import IndexedDBFileSystem from '../../../src/backend/IndexedDB';
import BackendFactory = require('../BackendFactory');
import file_system = require('../../../src/core/file_system');

function IDBFSFactory(cb: (name: string, obj: file_system.FileSystem[]) => void): void {
  if (IndexedDBFileSystem.isAvailable()) {
    new IndexedDBFileSystem((e, idbfs?) => {
      if (e) {
        throw e;
      } else {
        idbfs.empty((e?) => {
          if (e) {
            throw e;
          } else {
            cb('IndexedDB', [idbfs]);
          }
        });
      }
    }, 'test' + Math.random());
  } else {
    cb('IndexedDB', []);
  }
}

var _: BackendFactory = IDBFSFactory;

export = IDBFSFactory;
