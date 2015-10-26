import file_system = require('./file_system');
import EmscriptenFS from '../generic/emscripten_fs';
import * as FileSystem from './backends';
export declare function install(obj: any): void;
export declare function registerFileSystem(name: string, fs: file_system.FileSystemConstructor): void;
export declare function BFSRequire(module: string): any;
export declare function initialize(rootfs: file_system.FileSystem): file_system.FileSystem;
export { EmscriptenFS, FileSystem };
