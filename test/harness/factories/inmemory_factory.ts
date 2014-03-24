import in_memory_fs = require('../../../src/backend/in_memory');
import file_system = require('../../../src/core/file_system');
import BackendFactory = require('../BackendFactory');

function InMemoryFSFactory(cb: (objs: file_system.FileSystem[]) => void): void {
  if (in_memory_fs.InMemoryFileSystem.isAvailable()) {
    cb([new in_memory_fs.InMemoryFileSystem()]);
  } else {
    cb([]);
  }
}

var _: BackendFactory = InMemoryFSFactory;

export = InMemoryFSFactory;
