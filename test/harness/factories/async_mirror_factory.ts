import AsyncMirrorFS from '../../../src/backend/AsyncMirror';
import {FileSystem} from '../../../src/core/file_system';
import InMemoryFileSystem from '../../../src/backend/InMemory';
import IDBFSFactory from './idbfs_factory';

export default function AsyncMirrorFactory(cb: (name: string, objs: FileSystem[]) => void) {
  IDBFSFactory((name: string, obj: FileSystem[]) => {
	 if (obj.length > 0) {
		 var amfs = new AsyncMirrorFS(new InMemoryFileSystem(), obj[0]);
     amfs.initialize((err?) => {
       if (err) {
         throw err;
       } else {
         cb('AsyncMirror', [amfs]);
       }
     });
	 } else {
     cb("AsyncMirror", []);
	 }
  });
}
