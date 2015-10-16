import file_system = require('./file_system');
export declare function install(obj: any): void;
export declare var FileSystem: {
    [name: string]: any;
};
export declare function registerFileSystem(name: string, fs: file_system.FileSystemConstructor): void;
export declare function BFSRequire(module: string): any;
export declare function initialize(rootfs: file_system.FileSystem): file_system.FileSystem;
