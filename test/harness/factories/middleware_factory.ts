import {FileSystem} from '../../../src/core/file_system';
import InMemory from '../../../src/backend/InMemory';
import Middleware from '../../../src/backend/Middleware';

export default function HTTPDownloadFSFactory(cb: (name: string, objs: FileSystem[]) => void): void {
  if (InMemory.isAvailable() && Middleware.isAvailable()) {
    InMemory.Create({}, (e, mfs) => {
      if (e) {
        throw e;
      } else {
        Middleware.Create({ wrapped: mfs }, (e, fs) => {
          if (e) {
            throw e;
          } else {
            cb('Middleware', [fs]);
          }
        });
      }
    });
  } else {
    cb('Middleware', []);
  }
}
