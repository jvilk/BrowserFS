import OverlayFS from '../../../src/backend/OverlayFS';
import {FileSystem} from '../../../src/core/file_system';
import InMemoryFileSystem from '../../../src/backend/InMemory';
import ZipFactory from './zipfs_factory';

export default function OverlayFactory(cb: (name: string, objs: FileSystem[]) => void) {
  ZipFactory((name: string, obj: FileSystem[]) => {
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
