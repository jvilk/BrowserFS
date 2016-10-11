import {FileSystem} from '../../../src/core/file_system';
import InMemoryFileSystem from '../../../src/backend/InMemory';
import FolderAdapter from '../../../src/backend/FolderAdapter';

export default function FolderAdapterFactory(cb: (name: string, obj: FileSystem[]) => void): void {
  let fa = new FolderAdapter('/home', new InMemoryFileSystem());
  fa.initialize((err) => {
    if (!err) {
      cb('FolderAdapter', [fa]);
    } else {
      cb('FolderAdapter', []);
    }
  });
}
