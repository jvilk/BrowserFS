import {FileSystem} from '../../../src/core/file_system';
import HTTPSync from '../../../src/backend/HTTPSync';

export default function HTTPDownloadFSFactory(cb: (name: string, objs: FileSystem[]) => void): void {
  if (HTTPSync.isAvailable()) {
    HTTPSync.Create({
      baseUrl: 'localhost:8888/',
      preferXHR: true
    }, (e1, xhrFS) => {
      HTTPSync.Create({
        baseUrl: 'localhost:8888/',
        preferXHR: false
      }, (e2, fetchFS) => {
        if (e1 || e2) {
          throw e1 || e2;
        } else {
          cb('HTTPSync', [xhrFS, fetchFS]);
        }
      });
    });
  } else {
    cb('HTTPSync', []);
  }
}
