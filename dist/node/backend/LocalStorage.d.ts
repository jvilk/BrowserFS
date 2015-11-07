import kvfs = require('../generic/key_value_filesystem');
export declare class LocalStorageStore implements kvfs.SyncKeyValueStore, kvfs.SimpleSyncStore {
    constructor();
    name(): string;
    clear(): void;
    beginTransaction(type: string): kvfs.SyncKeyValueRWTransaction;
    get(key: string): NodeBuffer;
    put(key: string, data: NodeBuffer, overwrite: boolean): boolean;
    del(key: string): void;
}
export default class LocalStorageFileSystem extends kvfs.SyncKeyValueFileSystem {
    constructor();
    static isAvailable(): boolean;
}
