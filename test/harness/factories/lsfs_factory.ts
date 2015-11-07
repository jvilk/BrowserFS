import LocalStorageFileSystem from '../../../src/backend/LocalStorage';
import file_system = require('../../../src/core/file_system');
import BackendFactory = require('../BackendFactory');

function LSFSFactory(cb: (name: string, objs: file_system.FileSystem[]) => void) {
  if (LocalStorageFileSystem.isAvailable()) {
    var backend = new LocalStorageFileSystem();
    backend.empty();
    cb('localStorage', [backend]);
  } else {
    cb('localStorage', []);
  }
}

var _: BackendFactory = LSFSFactory;

export = LSFSFactory;
