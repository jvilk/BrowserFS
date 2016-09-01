import {default as FS, FSModule} from './FS';
import {FileSystem} from './file_system';
import {ApiError} from './api_error';
import Stats from './node_fs_stats';

// Manually export the individual public functions of fs.
// Required because some code will invoke functions off of the module.
// e.g.:
// let writeFile = fs.writeFile;
// writeFile(...)

let fs = new FS();
let _fsMock: FSModule = <any> {};

let FSProto = FS.prototype;
Object.keys(FSProto).forEach((key) => {
  if (typeof fs[key] === 'function') {
    _fsMock[key] = function() {
      return (<Function> fs[key]).apply(fs, arguments);
    };
  } else {
    _fsMock[key] = fs[key];
  }
});

_fsMock['changeFSModule'] = function(newFs: FS): void {
  fs = newFs;
}
_fsMock['getFSModule'] = function(): FS {
  return fs;
}
_fsMock['_wrapCb'] = function(cb: Function, numArgs: number): Function {
  return fs._wrapCb(cb, numArgs);
};
_fsMock['FS'] = FS;

export default _fsMock;
