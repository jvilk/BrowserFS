import file_system = require('../core/file_system');
import api_error = require('../core/api_error');
import node_fs_stats = require('../core/node_fs_stats');
import file = require('../core/file');
import file_flag = require('../core/file_flag');
import node_path = require('../core/node_path');
import Inode = require('../generic/inode');
import buffer = require('../core/buffer');
import preload_file = require('../generic/preload_file');
var ROOT_NODE_ID: string = "/",
  path = node_path.path,
  ApiError = api_error.ApiError,
  Buffer = buffer.Buffer;
/**
 * Generates a random ID.
 */
function GenerateRandomID(): string {
  // From http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Represents a *synchronous* key-value store.
 */
export interface SyncKeyValueStore {
  /**
   * The name of the key-value store.
   */
  name(): string;
  /**
   * Empties the key-value store completely.
   */
  clear(): void;
  /**
   * Begins a new read-only transaction.
   */
  beginTransaction(type: "readonly"): SyncKeyValueROTransaction;
  /**
   * Begins a new read-write transaction.
   */
  beginTransaction(type: "readwrite"): SyncKeyValueRWTransaction;
  beginTransaction(type: string): SyncKeyValueROTransaction;
}

/**
 * A read-only transaction for a synchronous key value store.
 */
export interface SyncKeyValueROTransaction {
  /**
   * Retrieves the data at the given key. Throws an ApiError if an error occurs
   * or if the key does not exist.
   * @param key The key to look under for data.
   * @return The data stored under the key, or undefined if not present.
   */
  get(key: string): NodeBuffer;
}

/**
 * A read-write transaction for a synchronous key value store.
 */
export interface SyncKeyValueRWTransaction extends SyncKeyValueROTransaction {
  /**
   * Adds the data to the store under the given key.
   * @param key The key to add the data under.
   * @param data The data to add to the store.
   * @param overwrite If 'true', overwrite any existing data. If 'false',
   *   throws an error if the key already exists.
   * @return True if storage succeeded, false otherwise.
   */
  put(key: string, data: NodeBuffer, overwrite: boolean): boolean;
  /**
   * Deletes the data at the given key.
   * @param key The key to delete from the store.
   */
  delete(key: string): void;
  /**
   * Commits the transaction.
   */
  commit(): void;
  /**
   * Aborts and rolls back the transaction.
   */
  abort(): void;
}

/**
 * Represents an *asynchronous* key-value store.
 */
export interface AsyncKeyValueStore {
  /**
   * The name of the key-value store.
   */
  name(): string;
  /**
   * Empties the key-value store completely.
   */
  clear(cb: (e?: api_error.ApiError) => void): void;
  /**
   * Adds the data to the store under the given key. Overwrites any existing
   * data.
   * @param key The key to add the data under.
   * @param data The data to add to the store.
   * @param overwrite If 'true', overwrite any existing data. If 'false',
   *   throws an error if the key already exists.
   */
  put(key: string, data: NodeBuffer, overwrite: boolean, cb: (e: api_error.ApiError,
    data?: NodeBuffer) => void): void;
  /**
   * Retrieves the data at the given key.
   * @param key The key to look under for data.
   */
  get<T>(key: string, cb: (e: api_error.ApiError, data?: NodeBuffer) => void): void;
  /**
   * Deletes the data at the given key.
   * @param key The key to delete from the store.
   */
  delete(key: string, cb: (e?: api_error.ApiError) => void): void;
}

export interface SyncKeyValueFileSystemOptions {
  /**
   * The actual key-value store to read from/write to.
   */
  store: SyncKeyValueStore;
  /**
   * Should the file system support properties (mtime/atime/ctime/chmod/etc)?
   * Enabling this slightly increases the storage space per file, and adds
   * atime updates every time a file is accessed, mtime updates every time
   * a file is modified, and permission checks on every operation.
   * 
   * Defaults to *false*.
   */
  //supportProps?: boolean;
  /**
   * Should the file system support links? 
   */
  //supportLinks?: boolean;
}

export class SyncKeyValueFile extends preload_file.PreloadFile implements file.File {
  constructor(_fs: SyncKeyValueFileSystem, _path: string, _flag: file_flag.FileFlag, _stat: node_fs_stats.Stats, contents?: NodeBuffer) {
    super(_fs, _path, _flag, _stat, contents);
  }

  public syncSync(): void {
    (<SyncKeyValueFileSystem> this._fs)._syncSync(this._path, this._buffer, this._stat);
  }

  public closeSync(): void {
    this.syncSync();
  }
}

/**
 * A "Synchronous key-value file system". Stores data to/retrieves data from an
 * underlying key-value store.
 * 
 * We use a unique ID for each node in the file system. The root node has a
 * fixed ID.
 * @todo Introduce Node ID caching.
 * @todo Check modes.
 */
export class SyncKeyValueFileSystem extends file_system.SynchronousFileSystem {
  private store: SyncKeyValueStore;
  constructor(options: SyncKeyValueFileSystemOptions) {
    super();
    this.store = options.store;
    // INVARIANT: Ensure that the root exists.
    this.makeRootDirectory();
  }

  public static isAvailable(): boolean { return true; }
  public getName(): string { return this.store.name(); }
  public isReadOnly(): boolean { return false; }
  public supportsSymlinks(): boolean { return false; }
  public supportsProps(): boolean { return false; }
  public supportsSynch(): boolean { return true; }

  /**
   * Checks if the root directory exists. Creates it if it doesn't.
   */
  private makeRootDirectory() {
    var tx = this.store.beginTransaction('readwrite');
    if (tx.get(ROOT_NODE_ID) === undefined) {
      // Create new inode.
      var currTime = (new Date()).getTime(),
        // Mode 0666
        dirInode = new Inode(GenerateRandomID(), 4096, 438 | node_fs_stats.FileType.DIRECTORY, currTime, currTime, currTime);
      // If the root doesn't exist, the first random ID shouldn't exist,
      // either.
      tx.put(dirInode.id, new Buffer("{}"), false);
      tx.put(ROOT_NODE_ID, dirInode.toBuffer(), false);
      tx.commit();
    }
  }

  /**
   * Helper function for findINode.
   * @param parent The parent directory of the file we are attempting to find.
   * @param filename The filename of the inode we are attempting to find, minus
   *   the parent.
   * @return string The ID of the file's inode in the file system.
   */
  private _findINode(tx: SyncKeyValueROTransaction, parent: string, filename: string): string {
    var read_directory = (inode: Inode): string => {
      // Get the root's directory listing.
      var dirList = this.getDirListing(tx, parent, inode);
      // Get the file's ID.
      if (dirList[filename]) {
        return dirList[filename];
      } else {
        throw ApiError.ENOENT(path.resolve(parent, filename));
      }
    }
    if (parent === '/') {
      // BASE CASE: Return the root's ID.
      return ROOT_NODE_ID;
    } else {
      return read_directory(this.getINode(tx, parent + path.sep + filename, 
        this._findINode(tx, path.dirname(parent), path.basename(parent))));
    }
  }

  /**
   * Finds the Inode of the given path.
   * @param p The path to look up.
   * @return The Inode of the path p.
   * @todo memoize/cache
   */
  private findINode(tx: SyncKeyValueROTransaction, p: string): Inode {
    return this.getINode(tx, p, this._findINode(tx, path.dirname(p), path.basename(p)));
  }

  /**
   * Given the ID of a node, retrieves the corresponding Inode.
   * @param tx The transaction to use.
   * @param p The corresponding path to the file (used for error messages).
   * @param id The ID to look up.
   */
  private getINode(tx: SyncKeyValueROTransaction, p: string, id: string): Inode {
    var inode = tx.get(id);
    if (inode === undefined) {
      throw ApiError.ENOENT(p);
    }
    return Inode.fromBuffer(inode);
  }

  /**
   * Given the Inode of a directory, retrieves the corresponding directory
   * listing.
   */
  private getDirListing(tx: SyncKeyValueROTransaction, p: string, inode: Inode): { [fileName: string]: string } {
    if (!inode.isDirectory()) {
      throw ApiError.ENOTDIR(p);
    }
    var data = tx.get(inode.id);
    if (data === undefined) {
      throw ApiError.ENOENT(p);
    }
    return JSON.parse(data.toString());
  }

  /**
   * Commits a new node under a random ID. Retries 5 times before giving up in
   * the exceedingly unlikely chance that we try to reuse a random GUID.
   * @return The GUID that the data was stored under.
   */
  private commitNewNode(tx: SyncKeyValueRWTransaction, data: NodeBuffer): string {
    var retries = 0, currId: string;
    while (retries < 5) {
      try {
        currId = GenerateRandomID();
        tx.put(currId, data, false);
        return currId;
      } catch (e) {
        // Ignore and reroll.
      }
    }
    throw new ApiError(api_error.ErrorCode.EIO, 'Unable to commit data to key-value store.');
  }

  /**
   * Commits a new file (well, a FILE or a DIRECTORY) to the file system with
   * the given mode.
   * Note: This will commit the transaction.
   * @param p The path to the new file.
   * @param type The type of the new file.
   * @param mode The mode to create the new file with.
   * @param data The data to store at the file's data node.
   * @return The Inode for the new file.
   */
  private commitNewFile(tx: SyncKeyValueRWTransaction, p: string, type: node_fs_stats.FileType, mode: number, data: NodeBuffer): Inode {
    var parentDir = path.dirname(p),
      fname = path.basename(p),
      parentNode = this.findINode(tx, parentDir),
      dirListing = this.getDirListing(tx, parentDir, parentNode),
      currTime = (new Date()).getTime();

    // Check if file already exists.
    if (dirListing[fname]) {
      throw ApiError.EEXIST(p);
    }

    try {
      // Commit data.
      var dataId = this.commitNewNode(tx, data),
        fileNode = new Inode(dataId, data.length, mode | type, currTime, currTime, currTime),
        // Commit file node.
        fileNodeId = this.commitNewNode(tx, fileNode.toBuffer());
      // Update and commit parent directory listing.
      dirListing[fname] = fileNodeId;
      tx.put(parentNode.id, new Buffer(JSON.stringify(dirListing)), true);
    } catch (e) {
      tx.abort();
      throw e;
    }
    tx.commit();
    return fileNode;
  }

  /**
   * Delete all contents stored in the file system.
   */
  public empty(): void {
    this.store.clear();
    // INVARIANT: Root always exists.
    this.makeRootDirectory();
  }

  public renameSync(oldPath: string, newPath: string): void {
    var tx = this.store.beginTransaction('readwrite'),
      oldParent = path.dirname(oldPath), oldName = path.basename(oldPath),
      newParent = path.dirname(newPath), newName = path.basename(newPath),
      // Remove oldPath from parent's directory listing.
      oldDirNode = this.findINode(tx, oldParent),
      oldDirList = this.getDirListing(tx, oldParent, oldDirNode);
    if (!oldDirList[oldName]) {
      throw ApiError.ENOENT(oldPath);
    }
    var nodeId: string = oldDirList[oldName];
    delete oldDirList[oldName];
    
    // Add newPath to parent's directory listing.
    var newDirNode = this.findINode(tx, newParent);
    var newDirList = this.getDirListing(tx, newParent, newDirNode);
    if (newDirList[newName]) {
      throw ApiError.EEXIST(newPath);
    }
    newDirList[newName] = nodeId;

    // Commit the two changed directory listings.
    try {
      tx.put(oldDirNode.id, new Buffer(JSON.stringify(oldDirList)), true);
      tx.put(newDirNode.id, new Buffer(JSON.stringify(newDirList)), true);
    } catch (e) {
      tx.abort();
      throw e;
    }

    tx.commit();
  }

  public statSync(p: string, isLstat: boolean): node_fs_stats.Stats {
    // Get the inode to the item, convert it into a Stats object.
    return this.findINode(this.store.beginTransaction('readonly'), p).toStats();
  }

  public createFileSync(p: string, flag: file_flag.FileFlag, mode: number): file.File {
    var tx = this.store.beginTransaction('readwrite'),
      data = new Buffer(0),
      newFile = this.commitNewFile(tx, p, node_fs_stats.FileType.FILE, mode, data);
    // Open the file.
    return new SyncKeyValueFile(this, p, flag, newFile.toStats(), data);
  }

  public openFileSync(p: string, flag: file_flag.FileFlag): file.File {
    var tx = this.store.beginTransaction('readonly'),
      node = this.findINode(tx, p),
      data = tx.get(node.id);
    if (data === undefined) {
      throw ApiError.ENOENT(p);
    }
    return new SyncKeyValueFile(this, p, flag, node.toStats(), data);
  }

  /**
   * Remove all traces of the given path from the file system.
   * @param p The path to remove from the file system.
   * @param isDir Does the path belong to a directory, or a file?
   * @todo Update mtime.
   */
  private removeEntry(p: string, isDir: boolean): void {
    var tx = this.store.beginTransaction('readwrite'),
      parent: string = path.dirname(p),
      parentNode = this.findINode(tx, parent),
      parentListing = this.getDirListing(tx, parent, parentNode),
      fileName: string = path.basename(p);

    if (!parentListing[fileName]) {
      throw ApiError.ENOENT(p);
    }

    // Remove from directory listing of parent.
    var fileNodeId = parentListing[fileName];
    delete parentListing[fileName];

    // Get file inode.
    var fileNode = this.getINode(tx, p, fileNodeId);
    if (!isDir && fileNode.isDirectory()) {
      throw ApiError.EISDIR(p);
    } else if (isDir && !fileNode.isDirectory()) {
      throw ApiError.ENOTDIR(p);
    }

    try {
      // Delete data.
      tx.delete(fileNode.id);
      // Delete node.
      tx.delete(fileNodeId);
      // Update directory listing.
      tx.put(parentNode.id, new Buffer(JSON.stringify(parentListing)), true);
    } catch (e) {
      tx.abort();
      throw e;
    }
    // Success.
    tx.commit();
  }

  public unlinkSync(p: string): void {
    this.removeEntry(p, false);
  }

  public rmdirSync(p: string): void {
    this.removeEntry(p, true);
  }

  public mkdirSync(p: string, mode: number): void {
    var tx = this.store.beginTransaction('readwrite'),
      data = new Buffer('{}');
    this.commitNewFile(tx, p, node_fs_stats.FileType.DIRECTORY, mode, data);
  }

  public readdirSync(p: string): string[]{
    var tx = this.store.beginTransaction('readonly');
    return Object.keys(this.getDirListing(tx, p, this.findINode(tx, p)));
  }

  public _syncSync(p: string, data: NodeBuffer, stats: node_fs_stats.Stats): void {
    // @todo Ensure mtime updates properly, and use that to determine if a data
    //       update is required.
    var tx = this.store.beginTransaction('readwrite'),
      // We use the _findInode helper because we actually need the INode id.
      fileInodeId = this._findINode(tx, path.dirname(p), path.basename(p)),
      fileInode = this.getINode(tx, p, fileInodeId),
      inodeChanged = fileInode.update(stats);

    try {
      // Sync data.
      tx.put(fileInode.id, data, true);
      // Sync metadata.
      if (inodeChanged) {
        tx.put(fileInodeId, fileInode.toBuffer(), true);
      }
    } catch (e) {
      tx.abort();
      throw e;
    }
    tx.commit();
  }
}

/**
 * An "Asynchronous key-value file system". Stores data to/retrieves data from
 * an underlying asynchronous key-value store.
 */
export class AsyncKeyValueFileSystem extends file_system.BaseFileSystem {

}
