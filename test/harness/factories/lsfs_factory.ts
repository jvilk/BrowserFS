import LocalStorageFileSystem from '../../../src/backend/LocalStorage';
import {FileSystem} from '../../../src/core/file_system';
import BackendFactory from '../BackendFactory';

export default function LSFSFactory(cb: (name: string, objs: FileSystem[]) => void) {
  if (LocalStorageFileSystem.isAvailable()) {
    var backend = new LocalStorageFileSystem();
    backend.empty();
    cb('localStorage', [backend]);
  } else {
    cb('localStorage', []);
  }
}

var _: BackendFactory = LSFSFactory;
