import OverlayFS = require('../../../src/backend/overlay');
import BackendFactory = require('../BackendFactory');
import file_system = require('../../../src/core/file_system');
import in_memory = require('../../../src/backend/in_memory');
import ZipFactory = require('./zipfs_factory');

function OverlayFactory(cb: (name: string, objs: file_system.FileSystem[]) => void) {
  ZipFactory((name: string, obj: file_system.FileSystem[]) => {
    // Use only one of the given file systems.
    // Mirror zip changes in in-memory.
    var ofs = new OverlayFS(new in_memory.InMemoryFileSystem(), obj[0]);
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