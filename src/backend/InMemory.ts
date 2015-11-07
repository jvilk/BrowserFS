import kvfs = require('../generic/key_value_filesystem');

/**
 * A simple in-memory key-value store backed by a JavaScript object.
 */
export class InMemoryStore implements kvfs.SyncKeyValueStore, kvfs.SimpleSyncStore {
  private store: { [key: string]: NodeBuffer } = {};

  public name() { return 'In-memory'; }
  public clear() { this.store = {}; }

  public beginTransaction(type: string): kvfs.SyncKeyValueRWTransaction {
    return new kvfs.SimpleSyncRWTransaction(this);
  }

  public get(key: string): NodeBuffer {
    return this.store[key];
  }

  public put(key: string, data: NodeBuffer, overwrite: boolean): boolean {
    if (!overwrite && this.store.hasOwnProperty(key)) {
      return false;
    }
    this.store[key] = data;
    return true;
  }

  public del(key: string): void {
    delete this.store[key];
  }
}

/**
 * A simple in-memory file system backed by an InMemoryStore.
 */
export default class InMemoryFileSystem extends kvfs.SyncKeyValueFileSystem {
  constructor() {
    super({ store: new InMemoryStore() });
  }
}
