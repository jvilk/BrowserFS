import IndexedDBFileSystem from '../../../src/backend/IndexedDB';
import {FileSystem} from '../../../src/core/file_system';

export default function IDBFSFactory(cb: (name: string, obj: FileSystem[]) => void): void {
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
