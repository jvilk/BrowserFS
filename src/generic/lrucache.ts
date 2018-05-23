/*
 * This cache is generically extensible.
 * It is useful to implement in key-value-filesystems.
 */
import Inode from '../generic/inode';

export class LRUNode {
  public prev: LRUNode | null = null;
  public next: LRUNode | null = null;
  constructor(public key: string, public value: Buffer | string | Inode) {}
}

// Adapted from https://chrisrng.svbtle.com/lru-cache-in-javascript
export class LRUCache {
  private size = 0;
  private map: {[id: string]: LRUNode} = {};
  private head: LRUNode | null = null;
  private tail: LRUNode | null = null;
  constructor(public readonly limit: number) {}

  /**
   * Change or add a new value in the cache
   * We overwrite the entry if it already exists
   */
  public set(key: string, value: Buffer | string | Inode): void {
    const node = new LRUNode(key, value);
    if (this.map[key]) {
      this.map[key].value = node.value;
      this.remove(node.key);
    } else {
      if (this.size >= this.limit) {
        delete this.map[this.tail!.key];
        this.size--;
        this.tail = this.tail!.prev;
        this.tail!.next = null;
      }
    }
    this.setHead(node);
  }

  /* Retrieve a single entry from the cache */
  public get(key: string): Buffer | string | Inode | null {
    if (this.map[key]) {
      const value = this.map[key].value;
      const node = new LRUNode(key, value);
      this.remove(key);
      this.setHead(node);
      return value;
    } else {
      return null;
    }
  }

  /* Remove a single entry from the cache */
  public remove(key: string): void {
    const node = this.map[key];
    if (!node) {
      return;
    }
    if (node.prev !== null) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }
    if (node.next !== null) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
    delete this.map[key];
    this.size--;
  }

  /* Resets the entire cache - Argument limit is optional to be reset */
  public removeAll() {
    this.size = 0;
    this.map = {};
    this.head = null;
    this.tail = null;
  }

  private setHead(node: LRUNode): void {
    node.next = this.head;
    node.prev = null;
    if (this.head !== null) {
        this.head.prev = node;
    }
    this.head = node;
    if (this.tail === null) {
        this.tail = node;
    }
    this.size++;
    this.map[node.key] = node;
  }
}
