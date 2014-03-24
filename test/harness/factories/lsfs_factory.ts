import lsfs = require('../../../src/backend/localStorage');
import file_system = require('../../../src/core/file_system');
import BackendFactory = require('../BackendFactory');

function LSFSFactory(cb: (objs: file_system.FileSystem[]) => void) {
  if (lsfs.LocalStorageFileSystem.isAvailable()) {
    var backend = new lsfs.LocalStorageFileSystem();
    backend.empty();
    cb([backend]);
  } else {
    cb([]);
  }
}

var _: BackendFactory = LSFSFactory;

export = LSFSFactory;
