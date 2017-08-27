import {FileSystem} from '../../../src/core/file_system';
import InMemory from '../../../src/backend/InMemory';
import Middleware from '../../../src/backend/Middleware';
import {getFileSystem} from '../../../src/core/browserfs';

export default function MiddlewareFactory(cb: (name: string, objs: FileSystem[]) => void): void {
  if (InMemory.isAvailable() && Middleware.isAvailable()) {
    getFileSystem({
      fs: "Middleware",
      options: {
        wrapped: { fs: 'InMemory' }
      }
    }, (e, fs?) => {
      if (e) {
        throw e;
      } else {
        cb('Middleware', [fs]);
      }
    });
  } else {
    cb('Middleware', []);
  }
}
