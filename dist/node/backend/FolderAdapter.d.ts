import { BaseFileSystem, FileSystem } from '../core/file_system';
import { ApiError } from '../core/api_error';
export default class FolderAdapter extends BaseFileSystem implements FileSystem {
    private _wrapped;
    private _folder;
    constructor(folder: string, wrapped: FileSystem);
    initialize(cb: (e?: ApiError) => void): void;
    getName(): string;
    isReadOnly(): boolean;
    supportsProps(): boolean;
    supportsSynch(): boolean;
    supportsLinks(): boolean;
    static isAvailable(): boolean;
}
