import InMemoryFileSystem from '../../../src/backend/InMemory';
import file_system = require('../../../src/core/file_system');
import BackendFactory = require('../BackendFactory');

function InMemoryFSFactory(cb: (name: string, objs: file_system.FileSystem[]) => void): void {
  if (InMemoryFileSystem.isAvailable()) {
    cb('InMemory', [new InMemoryFileSystem()]);
  } else {
    cb('InMemory', []);
  }
}

var _: BackendFactory = InMemoryFSFactory;

export = InMemoryFSFactory;
