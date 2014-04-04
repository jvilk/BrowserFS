export interface SyncCache {
  get(key: string): NodeBuffer;
  del(key: string): boolean;
  put(key: string, data: NodeBuffer): void;
}

export interface AsyncCache {
  get(key: string, cb?: (data: NodeBuffer) => void): void;
  del(key: string, cb?: (success: boolean) => void): void;
  put(key: string, data: NodeBuffer, cb?: () => void): void;
}
/**
 * My data! The cache, it does nothing!
 */
export class NopAsyncCache implements AsyncCache {
  public get(key: string, cb: (data: NodeBuffer) => void = () => {}): void {
    cb(null);
  }
  public del(key: string, cb: (success: boolean) => void = () => {}): void {
    cb(false);
  }
  public put(key: string, data: NodeBuffer, cb: () => void = () => {}): void {
    cb();
  }
}

export class NopSyncCache implements SyncCache {
  public get(key: string): NodeBuffer { return null; }
  public del(key: string): boolean { return false; }
  public put(key: string, data: NodeBuffer): void { }
}

var getTime: () => number = (() => {
  return typeof performance !== 'undefined' ? () => { return performance.now(); } : () => { return Date.now(); };
})();

export class InMemoryCache implements SyncCache {
  private delay: number = 500;
  private countDown: number = 5000;
  /**
   * Lookup table from key to cache entry.
   */
  private lookup: {[key: string]: number} = {};
  /**
   * The cache. May have 'null' empty items.
   */
  private cache: {key: string; data: NodeBuffer; metadata: boolean}[] = [];
  /**
   * List of free slots in the cache. If empty, a new item must be appended to
   * the cache.
   */
  private freeList: number[] = [];
  private size: number = 0;
  private lastUpdateTime: number = getTime();
  constructor(private maxSize: number, private secondLevelCache: AsyncCache = new NopAsyncCache()) {
    setInterval(() => {
      this.reset();
    }, this.delay);
  }

  private reset() {
    var time: number = getTime();
    if (time - this.lastUpdateTime >= this.delay) {
      this.lastUpdateTime = time;
      var i: number, cache = this.cache, cacheLength: number = cache.length;
      for (i = 0; i < cacheLength; i++) {
        var cacheItem = cache[i];
        if (cache[i] != null) {
          cache[i].metadata = false;
        }
      }
    }
  }

  private tryReset() {
    if (--this.countDown === 0) {
      this.countDown = this.delay * 200;
      this.reset();
    }
  }

  /**
   * Chooses an item to discard.
   * NRU.
   */
  private discard() {
    var i: number, cache = this.cache, cacheLength: number = cache.length,
      maxCandidateSize: number = 0, item: {data: NodeBuffer; metadata: boolean},
      candidate: number;
    for (i = 0; i < cacheLength; i++) {
      item = cache[i];
      // Remove the largest item not recently used.
      if (item != null && !item.metadata && item.data.length > maxCandidateSize) {
        maxCandidateSize = item.data.length;
        candidate = i;
      }
    }
    if (candidate == null) {
      // All items have been recently used; remove randomly.
      do {
        candidate = Math.floor(Math.random() * (this.cache.length - 1));
      } while (cache[candidate] == null);
    }
    this._remove(cache[candidate].key, candidate);
  }

  /**
   * Cache primitive: Removes the given item, updates the size.
   */
  private _remove(key: string, idx: number): void {
    var size: number = this.cache[idx].data.length;
    delete this.lookup[key];
    this.cache[idx] = null;
    this.freeList.push(idx);
    // Recover space in the cache.
    this.size -= size;
  }

  public put(key: string, data: NodeBuffer): void {
    var idx: number = this.lookup[key], size: number, dataLength: number,
      maxSize: number;
    this.tryReset();
    if (idx) {
      // Value update.
      this._remove(key, idx);
      return this.put(key, data);
    }
    // Check our current size. Do we need to discard something?
    size = this.size; maxSize = this.maxSize; dataLength = data.length;
    if (size + dataLength > maxSize) {
      if (dataLength > maxSize) {
        // Impossible to store.
        return;
      }
      // Discard until empty enough.
      while ((this.size + dataLength) > maxSize) {
        this.discard();
      }
    }

    if (this.freeList.length > 0) {
      // New value, use free entry in cache.
      idx = this.freeList.pop();
      this.cache[idx] = { data: data, metadata: true, key: key };
    } else {
      // New value, expand cache size.
      idx = this.cache.push({ data: data, metadata: true, key: key }) - 1;
    }
    this.lookup[key] = idx;
    // Update cache size.
    this.size += data.length;
  }

  public get(key: string): NodeBuffer {
    var idx: number = this.lookup[key];
    this.tryReset();
    if (idx) {
      return this.cache[idx].data;
    }
    return null;
  }

  public del(key: string): boolean {
    var idx: number = this.lookup[key];
    this.tryReset();
    if (idx) {
      this._remove(key, idx);
      return true;
    }
    return false;
  }
}