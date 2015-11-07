import kvfs = require('../generic/key_value_filesystem');
export declare class InMemoryStore implements kvfs.SyncKeyValueStore, kvfs.SimpleSyncStore {
    private store;
    name(): string;
    clear(): void;
    beginTransaction(type: string): kvfs.SyncKeyValueRWTransaction;
    get(key: string): NodeBuffer;
    put(key: string, data: NodeBuffer, overwrite: boolean): boolean;
    del(key: string): void;
}
export default class InMemoryFileSystem extends kvfs.SyncKeyValueFileSystem {
    constructor();
}
