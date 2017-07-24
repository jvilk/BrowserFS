import {BFSCallback} from '../core/file_system';
import {SyncKeyValueStore, SimpleSyncStore, SimpleSyncRWTransaction, SyncKeyValueRWTransaction, SyncKeyValueFileSystem} from '../generic/key_value_filesystem';

/**
 * A simple in-memory key-value store backed by a JavaScript object.
 */
export class InMemoryStore implements SyncKeyValueStore, SimpleSyncStore {
  private store: { [key: string]: Buffer } = {};

  public name() { return 'In-memory'; }
  public clear() { this.store = {}; }

  public beginTransaction(type: string): SyncKeyValueRWTransaction {
    return new SimpleSyncRWTransaction(this);
  }

  public get(key: string): Buffer {
    return this.store[key];
  }

  public put(key: string, data: Buffer, overwrite: boolean): boolean {
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
 * Files are not persisted across page loads.
 */
export default class InMemoryFileSystem extends SyncKeyValueFileSystem {
  /**
   * Creates an InMemoryFileSystem instance.
   */
  public static Create(cb: BFSCallback<InMemoryFileSystem>): void;
  public static Create(options: any, cb: BFSCallback<InMemoryFileSystem>): void;
  public static Create(options: any, cb?: any): void {
    const normalizedCb: BFSCallback<InMemoryFileSystem> = cb ? cb : options;
    normalizedCb(null, new InMemoryFileSystem());
  }
  constructor() {
    super({ store: new InMemoryStore() });
  }
}
