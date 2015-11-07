import kvfs = require('../generic/key_value_filesystem');
import { ApiError } from '../core/api_error';
export declare class IndexedDBROTransaction implements kvfs.AsyncKeyValueROTransaction {
    tx: IDBTransaction;
    store: IDBObjectStore;
    constructor(tx: IDBTransaction, store: IDBObjectStore);
    get(key: string, cb: (e: ApiError, data?: NodeBuffer) => void): void;
}
export declare class IndexedDBRWTransaction extends IndexedDBROTransaction implements kvfs.AsyncKeyValueRWTransaction, kvfs.AsyncKeyValueROTransaction {
    constructor(tx: IDBTransaction, store: IDBObjectStore);
    put(key: string, data: NodeBuffer, overwrite: boolean, cb: (e: ApiError, committed?: boolean) => void): void;
    del(key: string, cb: (e?: ApiError) => void): void;
    commit(cb: (e?: ApiError) => void): void;
    abort(cb: (e?: ApiError) => void): void;
}
export declare class IndexedDBStore implements kvfs.AsyncKeyValueStore {
    private storeName;
    private db;
    constructor(cb: (e: ApiError, store?: IndexedDBStore) => void, storeName?: string);
    name(): string;
    clear(cb: (e?: ApiError) => void): void;
    beginTransaction(type?: string): kvfs.AsyncKeyValueROTransaction;
}
export default class IndexedDBFileSystem extends kvfs.AsyncKeyValueFileSystem {
    constructor(cb: (e: ApiError, fs?: IndexedDBFileSystem) => void, storeName?: string);
    static isAvailable(): boolean;
}
