import MountableFileSystem from '../../../src/backend/MountableFileSystem';
import {FileSystem} from '../../../src/core/file_system';
import InMemoryFileSystem from '../../../src/backend/InMemory';

export default function MFSFactory(cb: (name: string, objs: FileSystem[]) => void) {
  if (MountableFileSystem.isAvailable()) {
    MountableFileSystem.Create({
      '/test': new InMemoryFileSystem(),
      '/tmp': new InMemoryFileSystem()
    }, (e, fs?) => {
      if (e) {
        throw e;
      }
      cb('MountableFileSystem', [fs]);
    });
  } else {
    cb('MountableFileSystem', []);
  }
}
