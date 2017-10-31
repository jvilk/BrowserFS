import CacheStorageFileSystem from '../../../src/backend/CacheStorage';
import {FileSystem} from '../../../src/core/file_system';

export default function CacheStorageFSFactory(cb: (name: string, obj: FileSystem[]) => void): void {
  if (CacheStorageFileSystem.isAvailable()) {
    CacheStorageFileSystem.Create({
      storeName: `test-${Math.random()}`
    }, (e, fs?) => {
      if (e) {
        throw e;
      }
      fs.empty((e?) => {
        if (e) {
          throw e;
        }
        cb('CacheStorageFS', [fs]);
      });
    });
  } else {
    cb('CacheStorageFS', []);
  }
}
