import { BFSCallback, BackendOptions } from '../core/file_system';
import { SyncKeyValueStore, SimpleSyncStore, SimpleSyncRWTransaction, SyncKeyValueRWTransaction, SyncKeyValueFileSystem } from '../generic/key_value_filesystem';
import type { Buffer } from 'buffer';

/**
 * A simple in-memory key-value store backed by a JavaScript object.
 */
export class InMemoryStore implements SyncKeyValueStore, SimpleSyncStore {
	private store: Map<string, Buffer> = new Map<string, Buffer>();

	public name() {
		return InMemoryFileSystem.Name;
	}
	public clear() {
		this.store.clear();
	}

	public beginTransaction(type: string): SyncKeyValueRWTransaction {
		return new SimpleSyncRWTransaction(this);
	}

	public get(key: string): Buffer {
		return this.store.get(key);
	}

	public put(key: string, data: Buffer, overwrite: boolean): boolean {
		if (!overwrite && this.store.has(key)) {
			return false;
		}
		this.store.set(key, data);
		return true;
	}

	public del(key: string): void {
		this.store.delete(key);
	}
}

/**
 * A simple in-memory file system backed by an InMemoryStore.
 * Files are not persisted across page loads.
 */
export default class InMemoryFileSystem extends SyncKeyValueFileSystem {
	public static readonly Name = 'InMemory';

	public static readonly Options: BackendOptions = {};

	/**
	 * Creates an InMemoryFileSystem instance.
	 */
	public static Create(options: any, cb: BFSCallback<InMemoryFileSystem>): void {
		cb(null, new InMemoryFileSystem());
	}

	public static CreateAsync(opts: any): Promise<InMemoryFileSystem> {
		return new Promise((resolve, reject) => {
			this.Create(opts, (error, fs) => {
				if (error || !fs) {
					reject(error);
				} else {
					resolve(fs);
				}
			});
		});
	}

	private constructor() {
		super({ store: new InMemoryStore() });
	}
}
