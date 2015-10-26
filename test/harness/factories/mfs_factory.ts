import MountableFileSystem from '../../../src/backend/MountableFileSystem';
import BackendFactory = require('../BackendFactory');
import file_system = require('../../../src/core/file_system');
import InMemoryFileSystem from '../../../src/backend/InMemory';

function MFSFactory(cb: (name: string, objs: file_system.FileSystem[]) => void) {
  if (MountableFileSystem.isAvailable()) {
    // Add mountable filesystem
    var im2 = new InMemoryFileSystem(), im3 = new InMemoryFileSystem(),
      mfsObj = new MountableFileSystem();
    mfsObj.mount('/test', im2);
    mfsObj.mount('/tmp', im3);
    cb('MountableFileSystem', [mfsObj]);
  } else {
    cb('MountableFileSystem', []);
  }
}

var _: BackendFactory = MFSFactory;

export = MFSFactory;
