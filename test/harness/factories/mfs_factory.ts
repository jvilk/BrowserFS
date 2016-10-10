import MountableFileSystem from '../../../src/backend/MountableFileSystem';
import {FileSystem} from '../../../src/core/file_system';
import InMemoryFileSystem from '../../../src/backend/InMemory';

export default function MFSFactory(cb: (name: string, objs: FileSystem[]) => void) {
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
