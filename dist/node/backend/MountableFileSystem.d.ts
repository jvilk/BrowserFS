import file_system = require('../core/file_system');
import { ApiError } from '../core/api_error';
export default class MountableFileSystem extends file_system.BaseFileSystem implements file_system.FileSystem {
    private mntMap;
    private mountList;
    private rootFs;
    constructor();
    mount(mountPoint: string, fs: file_system.FileSystem): void;
    umount(mountPoint: string): void;
    _getFs(path: string): {
        fs: file_system.FileSystem;
        path: string;
    };
    getName(): string;
    static isAvailable(): boolean;
    diskSpace(path: string, cb: (total: number, free: number) => void): void;
    isReadOnly(): boolean;
    supportsLinks(): boolean;
    supportsProps(): boolean;
    supportsSynch(): boolean;
    private standardizeError(err, path, realPath);
    rename(oldPath: string, newPath: string, cb: (e?: ApiError) => void): void;
    renameSync(oldPath: string, newPath: string): void;
    readdirSync(p: string): string[];
    readdir(p: string, cb: (err: NodeJS.ErrnoException, listing?: string[]) => any): void;
    rmdirSync(p: string): void;
    private _containsMountPt(p);
    rmdir(p: string, cb: (err?: NodeJS.ErrnoException) => any): void;
}
