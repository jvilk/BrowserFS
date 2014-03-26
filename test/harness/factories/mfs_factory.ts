import mfs = require('../../../src/backend/mountable_file_system');
import BackendFactory = require('../BackendFactory');
import file_system = require('../../../src/core/file_system');
import in_memory = require('../../../src/backend/in_memory');

function MFSFactory(cb: (name: string, objs: file_system.FileSystem[]) => void) {
  if (mfs.MountableFileSystem.isAvailable()) {
    // Add mountable filesystem
    var im2 = new in_memory.InMemoryFileSystem(), im3 = new in_memory.InMemoryFileSystem(),
      mfsObj = new mfs.MountableFileSystem();
    mfsObj.mount('/test', im2);
    mfsObj.mount('/tmp', im3);
    cb('MountableFileSystem', [mfsObj]);
  } else {
    cb('MountableFileSystem', []);
  }
}

var _: BackendFactory = MFSFactory;

export = MFSFactory;
