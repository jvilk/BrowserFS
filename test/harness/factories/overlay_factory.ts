import OverlayFS from '../../../src/backend/OverlayFS';
import BackendFactory = require('../BackendFactory');
import file_system = require('../../../src/core/file_system');
import InMemoryFileSystem from '../../../src/backend/InMemory';
import ZipFactory = require('./zipfs_factory');

function OverlayFactory(cb: (name: string, objs: file_system.FileSystem[]) => void) {
  ZipFactory((name: string, obj: file_system.FileSystem[]) => {
    // Use only one of the given file systems.
    // Mirror zip changes in in-memory.
    var ofs = new OverlayFS(new InMemoryFileSystem(), obj[0]);
    ofs.initialize((err?) => {
      if (err) {
        throw err;
      } else {
        cb('OverlayFS', [ofs]);
      }
    });
  });
}

var _: BackendFactory = OverlayFactory;

export = OverlayFactory;