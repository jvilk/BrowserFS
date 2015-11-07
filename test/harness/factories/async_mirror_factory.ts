import AsyncMirrorFS from '../../../src/backend/AsyncMirror';
import BackendFactory = require('../BackendFactory');
import file_system = require('../../../src/core/file_system');
import InMemoryFileSystem from '../../../src/backend/InMemory';
import IDBFSFactory = require('./idbfs_factory');

function AsyncMirrorFactory(cb: (name: string, objs: file_system.FileSystem[]) => void) {
  IDBFSFactory((name: string, obj: file_system.FileSystem[]) => {
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

var _: BackendFactory = AsyncMirrorFactory;

export = AsyncMirrorFactory;