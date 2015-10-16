import kvfs = require('../generic/key_value_filesystem');
import api_error = require('../core/api_error');
export declare class IndexedDBROTransaction implements kvfs.AsyncKeyValueROTransaction {
    tx: IDBTransaction;
    store: IDBObjectStore;
    constructor(tx: IDBTransaction, store: IDBObjectStore);
    get(key: string, cb: (e: api_error.ApiError, data?: NodeBuffer) => void): void;
}
export declare class IndexedDBRWTransaction extends IndexedDBROTransaction implements kvfs.AsyncKeyValueRWTransaction, kvfs.AsyncKeyValueROTransaction {
    constructor(tx: IDBTransaction, store: IDBObjectStore);
    put(key: string, data: NodeBuffer, overwrite: boolean, cb: (e: api_error.ApiError, committed?: boolean) => void): void;
    del(key: string, cb: (e?: api_error.ApiError) => void): void;
    commit(cb: (e?: api_error.ApiError) => void): void;
    abort(cb: (e?: api_error.ApiError) => void): void;
}
export declare class IndexedDBStore implements kvfs.AsyncKeyValueStore {
    private storeName;
    private db;
    constructor(cb: (e: api_error.ApiError, store?: IndexedDBStore) => void, storeName?: string);
    name(): string;
    clear(cb: (e?: api_error.ApiError) => void): void;
    beginTransaction(type?: string): kvfs.AsyncKeyValueROTransaction;
}
export declare class IndexedDBFileSystem extends kvfs.AsyncKeyValueFileSystem {
    constructor(cb: (e: api_error.ApiError, fs?: IndexedDBFileSystem) => void, storeName?: string);
    static isAvailable(): boolean;
}
