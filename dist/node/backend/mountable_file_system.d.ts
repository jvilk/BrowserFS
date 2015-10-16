import file_system = require('../core/file_system');
import api_error = require('../core/api_error');
export declare class MountableFileSystem extends file_system.BaseFileSystem implements file_system.FileSystem {
    private mntMap;
    private rootFs;
    constructor();
    mount(mnt_pt: string, fs: file_system.FileSystem): void;
    umount(mnt_pt: string): void;
    _get_fs(path: string): {
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
    rename(oldPath: string, newPath: string, cb: (e?: api_error.ApiError) => void): void;
    renameSync(oldPath: string, newPath: string): void;
}
