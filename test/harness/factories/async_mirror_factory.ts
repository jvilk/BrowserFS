import AsyncMirrorFS from '../../../src/backend/AsyncMirror';
import {FileSystem} from '../../../src/core/file_system';
import InMemoryFileSystem from '../../../src/backend/InMemory';
import IDBFSFactory from './idbfs_factory';

export default function AsyncMirrorFactory(cb: (name: string, objs: FileSystem[]) => void) {
  IDBFSFactory((name: string, obj: FileSystem[]) => {
	 if (obj.length > 0) {
     AsyncMirrorFS.Create({
       sync: new InMemoryFileSystem(),
       async: obj[0]
     }, (e, rv?) => {
       if (e) {
         throw e;
       } else {
         cb('AsyncMirror', [rv]);
       }
     });
	 } else {
     cb("AsyncMirror", []);
	 }
  });
}
